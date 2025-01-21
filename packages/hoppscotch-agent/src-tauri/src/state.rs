use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit};
use axum::body::Bytes;
use dashmap::DashMap;
use serde::de::DeserializeOwned;
use tauri_plugin_store::StoreExt;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::{
    error::{AgentError, AgentResult},
    global::{AGENT_STORE, REGISTRATIONS},
    model::Registration,
};

#[derive(Debug, Default)]
pub struct AppState {
    /// The active registration code that is being registered.
    pub active_registration_code: RwLock<Option<String>>,

    /// Cancellation Tokens for the running requests
    pub cancellation_tokens: DashMap<usize, CancellationToken>,

    /// Registrations against the agent, the key is the auth
    /// token associated to the registration
    registrations: DashMap<String, Registration>,
}

impl AppState {
    #[tracing::instrument(skip(app_handle))]
    pub fn new(app_handle: tauri::AppHandle) -> AgentResult<Self> {
        tracing::info!("Initializing application state");
        let store = match app_handle.store(AGENT_STORE) {
            Ok(store) => store,
            Err(e) => {
                tracing::error!("Failed to access app store: {}", e);
                return Err(e.into());
            }
        };

        // Try loading and parsing registrations from the store, if that failed,
        // load the default list
        let registrations = store
            .get(REGISTRATIONS)
            .and_then(|val| serde_json::from_value(val.clone()).ok())
            .unwrap_or_else(|| {
                tracing::debug!("No existing registrations found, initializing empty map");
                DashMap::new()
            });

        // Try to save the latest registrations list
        let _ = store.set(REGISTRATIONS, serde_json::to_value(&registrations)?);

        if let Err(e) = store.save() {
            tracing::error!("Failed to persist store changes: {}", e);
            return Err(e.into());
        }

        tracing::info!("Application state initialized successfully");

        Ok(Self {
            active_registration_code: RwLock::new(None),
            cancellation_tokens: DashMap::new(),
            registrations,
        })
    }

    /// Gets you a readonly reference to the registrations list
    /// NOTE: Although DashMap API allows you to update the list from an immutable
    /// reference, you shouldn't do it for registrations as `update_registrations`
    /// performs save operation that needs to be done and should be used instead
    #[tracing::instrument]
    pub fn get_registrations(&self) -> &DashMap<String, Registration> {
        tracing::debug!("Retrieving registrations list");
        &self.registrations
    }

    /// Provides you an opportunity to update the registrations list
    /// and also persists the data to the disk.
    /// This function bypasses `store.reload()` to avoid issues from stale or inconsistent
    /// data on disk. By relying solely on the in-memory `self.registrations`,
    /// we make sure that updates are applied based on the most recent changes in memory.
    #[tracing::instrument(skip(self, app_handle, update_func))]
    pub fn update_registrations(
        &self,
        app_handle: tauri::AppHandle,
        update_func: impl FnOnce(&DashMap<String, Registration>),
    ) -> Result<(), AgentError> {
        tracing::info!("Updating registrations");
        update_func(&self.registrations);

        let store = match app_handle.store(AGENT_STORE) {
            Ok(store) => store,
            Err(e) => {
                tracing::error!("Failed to access app store: {}", e);
                return Err(e.into());
            }
        };

        if store.has(REGISTRATIONS) {
            tracing::debug!("Clearing existing registrations from store");
            // We've confirmed `REGISTRATIONS` exists in the store
            if !store.delete(REGISTRATIONS) {
                tracing::error!("Failed to clear existing registrations");
                return Err(AgentError::RegistrationClearError);
            }
        } else {
            tracing::debug!("`REGISTRATIONS` key not found in store; continuing with update.");
        }

        // Since we've established `self.registrations` as the source of truth,
        // we avoid reloading the store from disk and instead choose to override it.
        match serde_json::to_value(self.registrations.clone()) {
            Ok(value) => {
                let _ = store.set(REGISTRATIONS, value);
            }
            Err(e) => {
                tracing::error!("Failed to serialize registrations: {}", e);
                return Err(e.into());
            }
        }

        // Explicitly save the changes
        if let Err(e) = store.save() {
            tracing::error!("Failed to persist store changes: {}", e);
            return Err(e.into());
        }

        tracing::info!("Registrations updated successfully");
        Ok(())
    }

    /// Clear all the registrations
    #[tracing::instrument(skip(self, app_handle))]
    pub fn clear_registrations(&self, app_handle: tauri::AppHandle) -> Result<(), AgentError> {
        tracing::info!("Clearing all registrations");
        self.update_registrations(app_handle, |registrations| registrations.clear())?;
        tracing::info!("All registrations cleared successfully");
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub async fn clear_active_registration(&self) {
        tracing::debug!("Clearing active registration code");
        let mut active_registration_code = self.active_registration_code.write().await;
        *active_registration_code = None;
        tracing::debug!("Active registration code cleared");
    }

    #[tracing::instrument(skip(self))]
    pub async fn validate_registration(&self, registration: &str) -> bool {
        tracing::debug!("Validating registration code");
        let is_valid = self.active_registration_code.read().await.as_deref() == Some(registration);
        if is_valid {
            tracing::info!("Registration code validated successfully");
        } else {
            tracing::warn!("Invalid registration code provided");
        }
        is_valid
    }

    #[tracing::instrument(skip(self))]
    pub fn remove_cancellation_token(&self, req_id: usize) -> Option<(usize, CancellationToken)> {
        tracing::debug!(req_id, "Removing cancellation token");
        let result = self.cancellation_tokens.remove(&req_id);
        if result.is_some() {
            tracing::info!(req_id, "Cancellation token removed successfully");
        } else {
            tracing::debug!(req_id, "No cancellation token found to remove");
        }
        result
    }

    #[tracing::instrument(skip(self))]
    pub fn add_cancellation_token(&self, req_id: usize, cancellation_token: CancellationToken) {
        tracing::debug!(req_id, "Adding new cancellation token");
        self.cancellation_tokens.insert(req_id, cancellation_token);
        tracing::debug!(req_id, "Cancellation token added successfully");
    }

    #[tracing::instrument(skip(self))]
    pub fn validate_access(&self, auth_key: &str) -> bool {
        tracing::debug!(auth_key, "Validating access");
        let is_valid = self.registrations.get(auth_key).is_some();
        if is_valid {
            tracing::info!(auth_key, "Access validated successfully");
        } else {
            tracing::warn!(auth_key, "Invalid access attempt");
        }
        is_valid
    }

    #[tracing::instrument(skip(self, data))]
    pub fn validate_access_and_get_data<T>(
        &self,
        auth_key: &str,
        nonce: &str,
        data: &Bytes,
    ) -> Option<T>
    where
        T: DeserializeOwned,
    {
        tracing::debug!(
            auth_key,
            nonce_len = nonce.len(),
            "Validating access and decrypting data"
        );

        let registration = match self.registrations.get(auth_key) {
            Some(reg) => reg,
            None => {
                tracing::warn!(auth_key, "Registration not found");
                return None;
            }
        };

        let key: [u8; 32] = match base16::decode(&registration.shared_secret_b16).ok()?[0..32]
            .try_into()
            .ok()
        {
            Some(k) => k,
            None => {
                tracing::error!(auth_key, "Failed to decode shared secret");
                return None;
            }
        };

        let nonce: [u8; 12] = match base16::decode(nonce).ok()?[0..12].try_into().ok() {
            Some(n) => n,
            None => {
                tracing::error!(auth_key, "Failed to decode nonce");
                return None;
            }
        };

        let cipher = Aes256Gcm::new(&key.into());
        let data = data.iter().cloned().collect::<Vec<u8>>();

        let plain_data = match cipher.decrypt(&nonce.into(), data.as_slice()) {
            Ok(d) => d,
            Err(e) => {
                tracing::error!(auth_key, error = ?e, "Decryption failed");
                return None;
            }
        };

        match serde_json::from_reader(plain_data.as_slice()) {
            Ok(result) => {
                tracing::info!(auth_key, "Data successfully decrypted and parsed");
                Some(result)
            }
            Err(e) => {
                tracing::error!(auth_key, error = ?e, "Failed to parse decrypted data");
                None
            }
        }
    }

    #[tracing::instrument(skip(self))]
    pub fn get_registration(&self, auth_key: &str) -> Option<Registration> {
        tracing::debug!(auth_key, "Retrieving registration tracing::info");
        let result = self
            .registrations
            .get(auth_key)
            .map(|reference| reference.value().clone());

        if result.is_some() {
            tracing::info!(
                auth_key,
                "Registration tracing::info retrieved successfully"
            );
        } else {
            tracing::debug!(auth_key, "No registration tracing::info found");
        }

        result
    }
}

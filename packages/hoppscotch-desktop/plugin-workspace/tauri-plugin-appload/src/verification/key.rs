use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use super::error::{Result, VerificationError};
use crate::api::ApiClient;

#[derive(Debug, Clone)]
pub struct KeyManager {
    verified_key: VerifyingKey,
    api_client: ApiClient,
}

impl KeyManager {
    pub async fn new(api_client: ApiClient) -> Result<Self> {
        tracing::info!("Initializing KeyManager");

        tracing::debug!("Retrieving verified key");
        let server_key = api_client.list_key().await.map_err(|e| {
            tracing::error!(error = %e, "Failed to fetch server keys");
            VerificationError::KeyValidation(e.to_string())
        })?;

        tracing::debug!("Decoding and verifying key bytes");
        let key_bytes = base64::engine::general_purpose::STANDARD
            .decode(&server_key.key)
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to decode key bytes");
                VerificationError::InvalidKeyFormat(e.to_string())
            })?;

        let key_bytes: [u8; 32] = key_bytes.try_into().map_err(|_| {
            tracing::error!("Key length is invalid");
            VerificationError::InvalidKeyLength("Expected 32 bytes".to_string())
        })?;

        let verified_key = VerifyingKey::from_bytes(&key_bytes).map_err(|e| {
            tracing::error!(error = %e, "Invalid key format");
            VerificationError::InvalidKeyFormat(e.to_string())
        })?;

        tracing::debug!("Key successfully retrieved");

        Ok(Self {
            verified_key,
            api_client,
        })
    }

    pub async fn verify_signature(&self, data: &[u8], signature: &Signature) -> Result<()> {
        tracing::info!("Verifying signature");
        let verifying_key = self.verified_key;
        verifying_key.verify(data, signature).map_err(|_| {
            tracing::error!("Signature verification failed");
            VerificationError::InvalidSignature
        })
    }
}

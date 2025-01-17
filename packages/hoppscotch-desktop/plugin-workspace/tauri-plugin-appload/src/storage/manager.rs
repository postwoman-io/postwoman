use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing;

use super::{Registry, Result, ServerEntry, StorageError, StorageLayout};
use crate::bundle::VerifiedBundle;

pub struct StorageManager {
    layout: Arc<StorageLayout>,
    registry: Arc<RwLock<Registry>>,
    locks: Arc<RwLock<Vec<PathBuf>>>,
}

impl StorageManager {
    pub async fn new(root: PathBuf) -> Result<Self> {
        tracing::info!(root = ?root, "Initializing StorageManager with root directory");
        let layout = StorageLayout::new(root);

        let registry = Registry::load(&layout).await?;

        Ok(Self {
            layout: Arc::new(layout),
            registry: Arc::new(RwLock::new(registry)),
            locks: Arc::new(RwLock::new(Vec::new())),
        })
    }

    pub async fn init(&self) -> Result<()> {
        tracing::info!("Initializing storage directories");
        let dirs = [
            self.layout.bundles_dir(),
            self.layout.cache_dir(),
            self.layout.temp_dir(),
            self.layout.key_dir(),
        ];

        for dir in &dirs {
            tracing::debug!(directory = ?dir, "Creating directory");
            tokio::fs::create_dir_all(dir).await?;
        }

        tracing::info!("Storage directories initialized successfully");
        Ok(())
    }

    pub async fn store_bundle(
        &self,
        name: &str,
        server_url: &str,
        version: &str,
        verified: &VerifiedBundle,
    ) -> Result<()> {
        tracing::info!(bundle_name = name, "Storing bundle");

        let bundle_path = self.layout.bundle_path(name);
        let temp_path = self.layout.temp_dir().join(format!("{}.tmp", name));

        for path in [&bundle_path, &temp_path] {
            if let Some(parent) = path.parent() {
                tracing::debug!(path = ?parent, "Ensuring directory exists");
                tokio::fs::create_dir_all(parent).await?;
            }
        }

        tracing::debug!(
            bundle_name = name,
            temp_path = ?temp_path,
            "Ensuring sufficient space for the bundle"
        );
        self.ensure_space(verified.content.len()).await?;

        tracing::debug!(
            bundle_name = name,
            temp_path = ?temp_path,
            "Writing bundle content to temporary file"
        );
        tokio::fs::write(&temp_path, &verified.content).await?;

        tracing::debug!(
            bundle_name = name,
            temp_path = ?temp_path,
            bundle_path = ?bundle_path,
            "Renaming temporary file to final bundle path"
        );
        tokio::fs::rename(temp_path, bundle_path).await?;

        let mut registry = self.registry.write().await;
        registry.update_server_entry(
            server_url,
            ServerEntry {
                bundle_name: name.to_string(),
                version: version.to_string(),
                created_at: chrono::Utc::now(),
                last_accessed: chrono::Utc::now(),
            },
        )?;

        registry.save(&self.layout).await?;

        tracing::info!(bundle_name = name, "Bundle stored successfully");
        Ok(())
    }

    pub async fn get_bundle_entry(&self, server_url: &str) -> Result<Option<ServerEntry>> {
        let registry = self.registry.read().await;
        Ok(registry.get_bundle_for_server(server_url).cloned())
    }

    pub async fn load_bundle(&self, name: &str) -> Result<Vec<u8>> {
        tracing::info!(bundle_name = name, "Loading bundle");

        let bundle_path = self.layout.bundle_path(name);

        if !bundle_path.exists() {
            tracing::warn!(bundle_name = name, "Bundle not found");
            return Err(StorageError::BundleNotFound(name.to_string()));
        }

        tracing::debug!(bundle_name = name, bundle_path = ?bundle_path, "Reading bundle content");
        let content = tokio::fs::read(&bundle_path).await?;

        tracing::info!(bundle_name = name, "Bundle loaded successfully");
        Ok(content)
    }

    pub async fn delete_bundle(&self, name: &str, server_url: &str) -> Result<()> {
        tracing::info!(bundle_name = name, "Deleting bundle");

        let bundle_path = self.layout.bundle_path(name);

        if bundle_path.exists() {
            tracing::debug!(bundle_name = name, bundle_path = ?bundle_path, "Removing bundle file");
            tokio::fs::remove_file(bundle_path).await?;
        }

        let mut registry = self.registry.write().await;
        registry.remove_server_entry(server_url)?;
        registry.save(&self.layout).await?;

        tracing::info!(bundle_name = name, "Bundle deleted successfully");
        Ok(())
    }

    async fn ensure_space(&self, required: usize) -> Result<()> {
        tracing::debug!(required_space = required, "Checking available disk space");
        let available = sys_info::disk_info()
            .map_err(|e| {
                tracing::error!(error = %e, "Failed to retrieve disk information");
                StorageError::OtherError(format!("Failed to get disk info: {}", e))
            })?
            .free;

        if (required as u64) > available {
            tracing::warn!(
                required_space = required,
                available_space = available,
                "Insufficient disk space"
            );
            return Err(StorageError::StorageFull {
                required: required as u64,
                available,
            });
        }

        tracing::debug!(
            available_space = available,
            "Sufficient disk space available"
        );
        Ok(())
    }

    pub fn layout(&self) -> &StorageLayout {
        &self.layout
    }
}

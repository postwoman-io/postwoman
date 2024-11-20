use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing;

use super::{Result, StorageError, StorageLayout};
use crate::bundle::VerifiedBundle;
use crate::BundleMetadata;

pub struct StorageManager {
    layout: Arc<StorageLayout>,
    locks: Arc<RwLock<Vec<PathBuf>>>,
}

impl StorageManager {
    pub fn new(root: PathBuf) -> Self {
        tracing::info!(root = ?root, "Initializing StorageManager with root directory");
        let layout = StorageLayout::new(root);
        Self {
            layout: Arc::new(layout),
            locks: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn init(&self) -> Result<()> {
        tracing::info!("Initializing storage directories");
        let dirs = [
            self.layout.bundles_dir(),
            self.layout.cache_dir(),
            self.layout.temp_dir(),
            self.layout.keys_dir(),
        ];

        for dir in &dirs {
            tracing::debug!(directory = ?dir, "Creating directory");
            tokio::fs::create_dir_all(dir).await?;
        }

        tracing::info!("Storage directories initialized successfully");
        Ok(())
    }

    pub async fn store_bundle(&self, name: &str, verified: &VerifiedBundle) -> Result<()> {
        tracing::info!(bundle_name = name, "Storing bundle");

        let bundle_path = self.layout.bundle_path(name);
        let meta_path = self.layout.bundle_meta_path(name);
        let temp_path = self.layout.temp_dir().join(format!("{}.tmp", name));

        for path in [&bundle_path, &meta_path, &temp_path] {
            if let Some(parent) = path.parent() {
                tracing::debug!(path = ?parent, "Ensuring directory exists");
                tokio::fs::create_dir_all(parent).await.map_err(|e| {
                    tracing::error!(path = ?parent, error = %e, "Failed to create directory");
                    StorageError::Io(e)
                })?;
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
            meta_path = ?meta_path,
            "Serializing and writing bundle metadata"
        );
        let meta_json = serde_json::to_vec_pretty(&verified.metadata).map_err(|e| {
            tracing::error!(bundle_name = name, error = %e, "Failed to serialize metadata");
            StorageError::InvalidPath(e.to_string())
        })?;

        tokio::fs::write(&meta_path, meta_json).await?;

        tracing::debug!(
            bundle_name = name,
            temp_path = ?temp_path,
            bundle_path = ?bundle_path,
            "Renaming temporary file to final bundle path"
        );
        tokio::fs::rename(temp_path, bundle_path).await?;

        tracing::info!(bundle_name = name, "Bundle stored successfully");
        Ok(())
    }

    pub async fn load_bundle(&self, name: &str) -> Result<(Vec<u8>, BundleMetadata)> {
        tracing::info!(bundle_name = name, "Loading bundle");

        let bundle_path = self.layout.bundle_path(name);
        let meta_path = self.layout.bundle_meta_path(name);

        if !bundle_path.exists() || !meta_path.exists() {
            tracing::warn!(bundle_name = name, "Bundle or metadata file not found");
            return Err(StorageError::BundleNotFound(name.to_string()));
        }

        tracing::debug!(bundle_name = name, bundle_path = ?bundle_path, "Reading bundle content");
        let content = tokio::fs::read(&bundle_path).await?;

        tracing::debug!(bundle_name = name, meta_path = ?meta_path, "Reading and deserializing metadata");
        let metadata: BundleMetadata = serde_json::from_slice(&tokio::fs::read(&meta_path).await?)
            .map_err(|e| {
                tracing::error!(bundle_name = name, error = %e, "Failed to deserialize metadata");
                StorageError::InvalidPath(e.to_string())
            })?;

        tracing::info!(bundle_name = name, "Bundle loaded successfully");
        Ok((content, metadata))
    }

    pub async fn delete_bundle(&self, name: &str) -> Result<()> {
        tracing::info!(bundle_name = name, "Deleting bundle");

        let bundle_path = self.layout.bundle_path(name);
        let meta_path = self.layout.bundle_meta_path(name);

        if bundle_path.exists() {
            tracing::debug!(bundle_name = name, bundle_path = ?bundle_path, "Removing bundle file");
            tokio::fs::remove_file(bundle_path).await?;
        }

        if meta_path.exists() {
            tracing::debug!(bundle_name = name, meta_path = ?meta_path, "Removing metadata file");
            tokio::fs::remove_file(meta_path).await?;
        }

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

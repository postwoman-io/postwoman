use std::io::Cursor;
use std::sync::Arc;

use ed25519_dalek::Signer;
use tokio::sync::RwLock;
use zip::ZipArchive;

use super::error::{BundleError, Result};
use super::model::Bundle;
use crate::config::ServerConfig;
use crate::model::FileEntry;

#[derive(Clone)]
pub struct BundleManager {
    current_bundle: Arc<RwLock<Bundle>>,
    config: Arc<ServerConfig>,
}

impl BundleManager {
    pub fn new(config: Arc<ServerConfig>, content: Vec<u8>, files: Vec<FileEntry>) -> Result<Self> {
        tracing::info!("Initializing BundleManager with a new bundle");

        { content.len() <= config.max_bundle_size }
            .then_some(())
            .ok_or_else(|| {
                let err = BundleError::TooLarge {
                    size: content.len(),
                    max: config.max_bundle_size,
                };
                tracing::error!(
                    size = content.len(),
                    max_size = config.max_bundle_size,
                    "Bundle exceeds size limit"
                );
                err
            })?;

        ZipArchive::new(Cursor::new(&content)).map_err(|e| {
            tracing::error!(error = ?e, "Invalid ZIP archive");
            BundleError::Zip(e)
        })?;

        let signing_key = config.signing_key.as_ref().ok_or_else(|| {
            tracing::error!("No signing key configured");
            BundleError::Config("No signing key configured".into())
        })?;
        let signature = signing_key.sign(&content);

        let bundle = Bundle::new(content, signature, files);
        tracing::info!("Successfully created initial bundle");

        Ok(Self {
            current_bundle: Arc::new(RwLock::new(bundle)),
            config,
        })
    }

    pub fn server_config(&self) -> &ServerConfig {
        tracing::info!("Retrieving the current config");
        &self.config
    }

    pub async fn bundle(&self) -> Bundle {
        tracing::info!("Retrieving the current bundle");
        self.current_bundle.read().await.clone()
    }
}

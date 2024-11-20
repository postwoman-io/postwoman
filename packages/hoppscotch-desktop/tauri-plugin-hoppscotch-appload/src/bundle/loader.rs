use std::sync::Arc;

use super::{BundleError, Result, VerifiedBundle};
use crate::{
    api::ApiClient,
    cache::CacheManager,
    storage::StorageManager,
    verification::{BundleVerifier, KeyManager},
};

pub struct BundleLoader {
    cache: Arc<CacheManager>,
    storage: Arc<StorageManager>,
}

impl BundleLoader {
    pub fn new(cache: Arc<CacheManager>, storage: Arc<StorageManager>) -> Self {
        Self { cache, storage }
    }

    pub async fn load_bundle(&self, name: &str, server_url: &str) -> Result<()> {
        tracing::info!(bundle_name = %name, "Starting bundle loading process");

        let api_client = ApiClient::new(server_url).map_err(|e| {
            tracing::error!(bundle_name = %name, error = %e, "Failed to create API client");
            BundleError::MetadataError(e.to_string())
        })?;

        let key_manager = KeyManager::new(api_client.clone()).await.map_err(|e| {
            tracing::error!(bundle_name = %name, error = %e, "Failed to initialize key manager");
            BundleError::Verification(e)
        })?;

        let verifier = BundleVerifier::new(key_manager);

        let metadata = api_client.fetch_bundle_metadata(name).await.map_err(|e| {
            tracing::error!(bundle_name = %name, error = %e, "Failed to fetch bundle metadata");
            BundleError::MetadataError(e.to_string())
        })?;

        let content = api_client.download_bundle(name).await.map_err(|e| {
            tracing::error!(bundle_name = %name, error = %e, "Failed to download bundle");
            BundleError::MetadataError(e.to_string())
        })?;

        tracing::info!(bundle_name = %name, "Verifying bundle integrity");
        verifier.verify_bundle(&content, &metadata).await?;

        let verified = VerifiedBundle::new(content, metadata)?;

        tracing::info!(bundle_name = %name, "Storing verified bundle");
        self.storage.store_bundle(name, &verified).await?;

        tracing::info!(bundle_name = %name, "Caching verified bundle");
        self.cache.cache_bundle(name, &verified).await?;

        tracing::info!(bundle_name = %name, "Bundle loading completed successfully");
        Ok(())
    }
}

use base64::{engine::general_purpose::STANDARD, Engine};
use std::sync::Arc;

use super::{BundleError, Result, VerifiedBundle};
use crate::{
    api::ApiClient,
    cache::CacheManager,
    storage::StorageManager,
    verification::{BundleVerifier, KeyManager},
};

struct BundleInfo {
    name: String,
    content: Vec<u8>,
}

pub struct BundleLoader {
    cache: Arc<CacheManager>,
    storage: Arc<StorageManager>,
}

impl BundleLoader {
    pub fn new(cache: Arc<CacheManager>, storage: Arc<StorageManager>) -> Self {
        Self { cache, storage }
    }

    pub async fn load_bundle(&self, server_url: &str) -> Result<()> {
        tracing::info!(server_url = %server_url, "Starting bundle loading process");

        let api_client = self.create_api_client(server_url)?;
        let key_manager = self.init_key_manager(&api_client).await?;
        let verifier = BundleVerifier::new(key_manager);

        let metadata = api_client.fetch_bundle_metadata("latest").await.map_err(|e| {
            tracing::error!(server_url = %server_url, error = %e, "Failed to fetch bundle metadata");
            BundleError::MetadataError(e.to_string())
        })?;

        let bundle_info = match self.storage.get_bundle_entry(server_url).await? {
            Some(entry) if entry.version == metadata.version => {
                tracing::info!(server_url = %server_url, "Bundle version matches, using cached version");
                self.load_existing_bundle(&entry.bundle_name).await?
            }
            Some(entry) => {
                tracing::info!(
                    server_url = %server_url,
                    local_version = %entry.version,
                    remote_version = %metadata.version,
                    "Version mismatch, downloading new bundle"
                );
                self.storage
                    .delete_bundle(&entry.bundle_name, server_url)
                    .await?;
                self.download_new_bundle(server_url, &api_client, &verifier, &metadata)
                    .await?
            }
            None => {
                tracing::info!(server_url = %server_url, "No existing bundle found, downloading");
                self.download_new_bundle(server_url, &api_client, &verifier, &metadata)
                    .await?
            }
        };

        let verified = VerifiedBundle::new(bundle_info.content, metadata.clone())?;

        tracing::info!(server_url = %server_url, "Caching verified bundle");
        self.cache
            .cache_bundle(&bundle_info.name, &verified)
            .await?;

        tracing::info!(server_url = %server_url, "Bundle loading completed successfully");
        Ok(())
    }

    fn create_api_client(&self, server_url: &str) -> Result<ApiClient> {
        ApiClient::new(server_url).map_err(|e| {
            tracing::error!(server_url = %server_url, error = %e, "Failed to create API client");
            BundleError::MetadataError(e.to_string())
        })
    }

    async fn init_key_manager(&self, api_client: &ApiClient) -> Result<KeyManager> {
        KeyManager::new(api_client.clone()).await.map_err(|e| {
            tracing::error!(error = %e, "Failed to initialize key manager");
            BundleError::Verification(e)
        })
    }

    async fn load_existing_bundle(&self, bundle_name: &str) -> Result<BundleInfo> {
        tracing::info!(bundle_name = %bundle_name, "Loading bundle from storage");
        let content = self.storage.load_bundle(bundle_name).await?;
        Ok(BundleInfo {
            name: bundle_name.to_string(),
            content,
        })
    }

    async fn download_new_bundle(
        &self,
        server_url: &str,
        api_client: &ApiClient,
        verifier: &BundleVerifier,
        metadata: &crate::BundleMetadata,
    ) -> Result<BundleInfo> {
        tracing::info!(server_url = %server_url, "Downloading bundle");
        let content = api_client.download_bundle("latest").await.map_err(|e| {
            tracing::error!(server_url = %server_url, error = %e, "Failed to download bundle");
            BundleError::MetadataError(e.to_string())
        })?;

        tracing::info!(server_url = %server_url, "Verifying bundle integrity");
        verifier.verify_bundle(&content, metadata).await?;

        let verified = VerifiedBundle::new(content.clone(), metadata.clone())?;

        let name = self.generate_bundle_name(server_url, metadata);

        tracing::info!(server_url = %server_url, "Storing verified bundle");
        self.storage
            .store_bundle(&name, server_url, &metadata.version, &verified)
            .await?;

        Ok(BundleInfo { name, content })
    }

    fn generate_bundle_name(&self, server_url: &str, metadata: &crate::BundleMetadata) -> String {
        format!(
            "{}-{}",
            server_url
                .split("://")
                .nth(1)
                .unwrap_or("unknown")
                .replace(['/', '.', ':'], "-")
                .trim_end_matches('-'),
            metadata.version
        )
    }
}

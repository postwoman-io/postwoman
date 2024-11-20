use super::error::Result;
use super::key::KeyManager;
use crate::BundleMetadata;

#[derive(Debug, Clone)]
pub struct BundleVerifier {
    key_manager: KeyManager,
}

impl BundleVerifier {
    pub fn new(key_manager: KeyManager) -> Self {
        Self { key_manager }
    }

    pub async fn verify_bundle(&self, content: &[u8], metadata: &BundleMetadata) -> Result<()> {
        tracing::info!(
            file_count = metadata.manifest.files.len(),
            "Verifying bundle signature"
        );

        self.key_manager
            .verify_signature(content, &metadata.signature)
            .await
            .map_err(|e| {
                tracing::error!(
                    error = %e,
                    "Signature verification failed"
                );
                e
            })
    }
}

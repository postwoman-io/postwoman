use std::sync::Arc;

use axum::{
    body::Body,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};

use super::error::{ApiError, Result};
use super::model::{ApiResponse, BundleManifest, PublicKeyInfo};
use crate::bundle::BundleManager;

pub struct ApiHandler {
    pub bundle_manager: Arc<BundleManager>,
}

impl ApiHandler {
    pub fn new(bundle_manager: Arc<BundleManager>) -> Self {
        Self { bundle_manager }
    }

    pub async fn get_manifest(&self) -> Result<impl IntoResponse> {
        tracing::info!("Fetching bundle manifest");
        let bundle = self.bundle_manager.bundle().await;

        let version = bundle.metadata.version;
        let created_at = bundle.metadata.created_at;
        let signature = bundle.metadata.signature;
        let manifest = bundle.metadata.manifest;

        let manifest = BundleManifest {
            version,
            created_at,
            signature,
            manifest,
        };

        tracing::info!("Successfully retrieved bundle manifest");

        Ok(Json(ApiResponse::ok(manifest)))
    }

    pub async fn download_bundle(&self) -> Result<impl IntoResponse> {
        tracing::info!("Starting bundle download");
        let bundle = self.bundle_manager.bundle().await;

        let response = Response::builder()
            .header("content-type", "application/zip")
            .header("content-length", bundle.content.len().to_string())
            .header("content-disposition", "attachment; filename=\"bundle.zip\"")
            .body(Body::from(bundle.content.clone()))
            .map_err(|e| {
                tracing::error!(error = ?e, "Failed to create download response");
                ApiError::DownloadFailed(e.to_string())
            })?;

        tracing::info!(
            content_length = bundle.content.len(),
            "Successfully prepared bundle for download"
        );
        Ok(response)
    }

    pub async fn key(&self) -> Result<impl IntoResponse> {
        tracing::info!("Listing public key");
        let server_config = self.bundle_manager.server_config();
        let verifying_key = server_config.verifying_key;

        let verifying_key = verifying_key.as_ref().ok_or_else(|| {
            tracing::error!("No signing key configured");
            ApiError::InvalidRequest("No signing key configured".into())
        })?;

        let verifying_key = STANDARD.encode(verifying_key.to_bytes());
        tracing::debug!(verifying_key = ?verifying_key);

        let key_info = PublicKeyInfo { key: verifying_key };

        tracing::info!("Successfully retrieved public key info");
        Ok(Json(ApiResponse::ok(key_info)))
    }
}

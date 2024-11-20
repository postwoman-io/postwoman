use std::time::Duration;

use reqwest::{Client as HttpClient, StatusCode, Url};
use serde::de::DeserializeOwned;

use crate::{BundleMetadata, PublicKeyInfo};

use super::{
    error::{ApiError, Result},
    model::ApiResponse,
    API_VERSION,
};

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone)]
pub struct ApiClient {
    client: HttpClient,
    base_url: Url,
}

impl ApiClient {
    pub fn new(base_url: impl AsRef<str>) -> Result<Self> {
        tracing::info!(
            "Initializing ApiClient with base URL: {}",
            base_url.as_ref()
        );

        let client = HttpClient::builder()
            .timeout(DEFAULT_TIMEOUT)
            .user_agent(format!(
                "{}/{}",
                env!("CARGO_PKG_NAME"),
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .map_err(ApiError::RequestFailed)?;

        Ok(Self {
            client,
            base_url: base_url.as_ref().parse().map_err(ApiError::InvalidUrl)?,
        })
    }

    pub async fn list_key(&self) -> Result<PublicKeyInfo> {
        self.get(&format!("/api/{API_VERSION}/key")).await
    }

    pub async fn fetch_bundle_metadata(&self, name: &str) -> Result<BundleMetadata> {
        tracing::debug!(bundle_name = name, "Fetching metadata");
        self.get(&format!("/api/{API_VERSION}/manifest")).await
    }

    pub async fn download_bundle(&self, name: &str) -> Result<Vec<u8>> {
        tracing::debug!(bundle_name = name, "Downloading bundle");
        let url = self.build_url(&format!("/api/{API_VERSION}/bundle"))?;

        let response = self.client.get(url).send().await.map_err(|e| {
            tracing::error!(bundle_name = name, error = %e, "Download request failed");
            ApiError::RequestFailed(e)
        })?;

        match response.status() {
            StatusCode::OK => {
                tracing::debug!(bundle_name = name, "Download successful");
                Ok(response.bytes().await?.to_vec())
            }
            StatusCode::NOT_FOUND => {
                tracing::warn!(bundle_name = name, "Bundle not found");
                Err(ApiError::BundleNotFound(name.to_string()))
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                tracing::error!(bundle_name = name, status = %status, error = %error_text, "Download failed");
                Err(ApiError::from_status(status.as_u16(), error_text))
            }
        }
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        tracing::debug!(path, "Sending GET request");
        let url = self.build_url(path)?;

        let response = self.client.get(url).send().await.map_err(|e| {
            tracing::error!(path, error = %e, "Request failed");
            ApiError::RequestFailed(e)
        })?;

        match response.status() {
            StatusCode::OK => {
                let api_response: ApiResponse<T> = response.json().await?;
                if api_response.success {
                    Ok(api_response.data)
                } else {
                    Err(ApiError::ServerError {
                        status: 200,
                        message: api_response.error.unwrap_or_else(|| "Unknown error".into()),
                    })
                }
            }
            StatusCode::NOT_FOUND => Err(ApiError::BundleNotFound(path.to_string())),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                tracing::error!(path, status = %status, error = %error_text, "Request failed");
                Err(ApiError::from_status(status.as_u16(), error_text))
            }
        }
    }

    fn build_url(&self, path: &str) -> Result<Url> {
        self.base_url.join(path).map_err(|e| {
            tracing::error!(path, error = %e, "Invalid URL");
            ApiError::InvalidUrl(e)
        })
    }
}

use std::sync::Arc;

use tauri::{
    http::{Response, Uri},
    Config,
};

use super::error::Result;
use crate::cache::CacheManager;

pub struct UriHandler {
    cache: Arc<CacheManager>,
    config: Config,
}

impl UriHandler {
    pub fn new(cache: Arc<CacheManager>, config: Config) -> Self {
        Self { cache, config }
    }

    async fn fetch_content(&self, host: &str, path: &str) -> Result<Vec<u8>> {
        let file_path = if path.is_empty() { "index.html" } else { path };
        tracing::debug!(host = %host, path = %path, resolved_path = %file_path, "Fetching file content.");
        Ok(self.cache.get_file(host, file_path).await?)
    }

    fn determine_mime(path: &str) -> &str {
        if path.is_empty() || path == "index.html" {
            "text/html; charset=utf-8"
        } else {
            mime_guess::from_path(path)
                .first_raw()
                .unwrap_or("application/octet-stream")
        }
    }

    pub async fn handle(&self, uri: &Uri) -> Result<Response<Vec<u8>>> {
        let host = uri.host().unwrap_or_default();
        let path = uri.path().trim_start_matches('/');

        match self.fetch_content(host, path).await {
            Ok(content) => {
                tracing::info!(host = %host, path = %path, "Successfully retrieved file content.");
                let mime_type = Self::determine_mime(path);
                let csp = match self.config
                    .app
                    .security
                    .csp.as_ref() {
                    Some(csp) => csp.to_string(),
                    None => String::from("null"),
                };

                Response::builder()
                    .status(200)
                    .header("content-type", mime_type)
                    .header(
                        "content-security-policy",
                        csp
                    )
                    .header("Access-Control-Allow-Credentials", "true")
                    .header("x-content-type-options", "nosniff")
                    .body(content)
            }
            Err(e) => {
                tracing::error!(error = %e, host = %host, path = %path, "Failed to retrieve file content.");
                Response::builder()
                    .status(404)
                    .body(Vec::new())
            }
        }.map_err(Into::into)
    }
}

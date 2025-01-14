use std::sync::Arc;

use tauri::http::{Response, Uri};

use super::error::Result;
use crate::cache::CacheManager;

pub struct UriHandler {
    cache: Arc<CacheManager>,
}

impl UriHandler {
    pub fn new(cache: Arc<CacheManager>) -> Self {
        Self { cache }
    }

    async fn fetch_content(&self, host: &str, path: &str) -> Result<Vec<u8>> {
        let file_path = if path.is_empty() { "index.html" } else { path };
        tracing::debug!(host = %host, path = %path, resolved_path = %file_path, "Fetching file content.");
        Ok(self.cache.get_file(host, file_path).await?)
    }

    fn determine_mime(path: &str) -> &str {
        mime_guess::from_path(path)
            .first_raw()
            .unwrap_or("application/octet-stream")
    }

    pub async fn handle(&self, uri: &Uri) -> Result<Response<Vec<u8>>> {
        let host = uri.host().unwrap_or_default();
        let path = uri.path().trim_start_matches('/');

        match self.fetch_content(host, path).await {
            Ok(content) => {
                tracing::info!(host = %host, path = %path, "Successfully retrieved file content.");
                let mime_type = Self::determine_mime(path);
                Response::builder()
                    .status(200)
                    .header("content-type", mime_type)
                    .header(
                        "content-security-policy",
                        "default-src blob: data: filesystem: ws: wss: http: https: tauri: 'unsafe-eval' 'unsafe-inline' 'self' customprotocol: asset:; \
                         script-src * 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'; \
                         connect-src ipc: http://ipc.localhost https://api.hoppscotch.io *; \
                         font-src https://fonts.gstatic.com data: 'self'; \
                         img-src 'self' asset: http://asset.localhost blob: data: customprotocol:; \
                         style-src 'unsafe-inline' 'self' https://fonts.googleapis.com data: asset:; \
                         worker-src * 'self' data: 'unsafe-eval' blob:;"
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

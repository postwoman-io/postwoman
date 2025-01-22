use std::io;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum WebViewError {
    #[error("Failed to open URL: {0}")]
    UrlOpen(#[from] io::Error),
    #[error("Failed to download WebView2 installer: {0}")]
    Download(String),
    #[error("WebView2 installation failed: {0}")]
    Installation(String),
    #[error("Failed during request: {0}")]
    Request(#[from] tauri_plugin_http::reqwest::Error),
}

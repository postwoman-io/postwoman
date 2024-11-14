use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum ExternalError {
    #[error("Failed to parse URL")]
    UrlParse(#[from] #[source] #[serde(skip)] url::ParseError),
    #[error("Network error")]
    Network(#[from] #[source] #[serde(skip)] reqwest::Error),
    #[error("IO error")]
    Io(#[from] #[source] #[serde(skip)] std::io::Error),
    #[error("Failed to access path: {0}")]
    PathAccess(String),
    #[error("ZIP archive error")]
    Archive(#[from] #[source] #[serde(skip)] zip::result::ZipError),
    #[error("Tauri error")]
    Tauri(#[from] #[source] #[serde(skip)] tauri::Error),
}

pub type ExternalResult<T> = std::result::Result<T, ExternalError>;

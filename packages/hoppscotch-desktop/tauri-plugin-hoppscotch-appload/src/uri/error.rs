use thiserror::Error;

#[derive(Debug, Error)]
pub enum UriError {
    #[error("HTTP error: {0}")]
    Http(#[from] tauri::http::Error),

    #[error("Cache error: {0}")]
    Cache(#[from] crate::cache::CacheError),
}

pub type Result<T> = std::result::Result<T, UriError>;

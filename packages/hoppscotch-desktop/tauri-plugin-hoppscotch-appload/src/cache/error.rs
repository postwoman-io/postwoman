use thiserror::Error;

pub type Result<T> = std::result::Result<T, CacheError>;

#[derive(Debug, Error)]
pub enum CacheError {
    #[error("Cache entry not found: {0}")]
    NotFound(String),

    #[error("Cache entry expired: {0}")]
    Expired(String),

    #[error("Cache full")]
    CacheFull,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Verification error: {0}")]
    Verification(#[from] crate::verification::VerificationError),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Invalid cache entry: {0}")]
    InvalidEntry(String),
}

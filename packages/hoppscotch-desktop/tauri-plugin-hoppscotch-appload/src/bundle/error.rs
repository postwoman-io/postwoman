use thiserror::Error;

#[derive(Debug, Error)]
pub enum BundleError {
    #[error("File not found in bundle: {0}")]
    FileNotFound(String),

    #[error("Invalid bundle format: {0}")]
    InvalidFormat(String),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Storage error: {0}")]
    Storage(#[from] crate::storage::StorageError),

    #[error("API error: {0}")]
    Api(#[from] crate::api::ApiError),

    #[error("Cache error: {0}")]
    Cache(#[from] crate::cache::CacheError),

    #[error("Verification error: {0}")]
    Verification(#[from] crate::verification::VerificationError),
}

pub type Result<T> = std::result::Result<T, BundleError>;

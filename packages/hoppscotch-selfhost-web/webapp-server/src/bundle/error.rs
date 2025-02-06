use thiserror::Error;

#[derive(Debug, Error)]
pub enum BundleError {
    #[error("Bundle not found: {0}")]
    NotFound(String),

    #[error("Bundle validation failed: {0}")]
    ValidationFailed(String),

    #[error("Path access error: {0}")]
    PathAccess(String),

    #[error("Unknown public key: {0}")]
    UnknownKey(String),

    #[error("Bundle too large: {size} bytes (max: {max} bytes)")]
    TooLarge { size: usize, max: usize },

    #[error("Configuration error: {0}")]
    Config(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Zip(#[from] zip::result::ZipError),

    #[error(transparent)]
    Serialization(#[from] serde_json::Error),

    #[error(transparent)]
    Signing(#[from] crate::signing::SigningError),
}

pub type Result<T> = std::result::Result<T, BundleError>;

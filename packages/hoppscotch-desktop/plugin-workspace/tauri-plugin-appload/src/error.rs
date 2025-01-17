use serde::Serialize;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
    #[error(transparent)]
    Api(#[from] crate::api::ApiError),

    #[error(transparent)]
    Cache(#[from] crate::cache::CacheError),

    #[error(transparent)]
    Storage(#[from] crate::storage::StorageError),

    #[error(transparent)]
    Bundle(#[from] crate::bundle::BundleError),

    #[error(transparent)]
    Verification(#[from] crate::verification::VerificationError),

    #[error(transparent)]
    Tauri(#[from] tauri::Error),

    #[error("Window not found")]
    WindowNotFound,

    #[error("Configuration error: {0}")]
    Config(String),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

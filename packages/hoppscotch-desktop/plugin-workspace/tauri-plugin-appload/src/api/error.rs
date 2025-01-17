use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("Invalid server response: {0}")]
    InvalidResponse(String),

    #[error("Bundle not found: {0}")]
    BundleNotFound(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Bundle verification failed: {0}")]
    VerificationFailed(String),

    #[error("API error {status}: {message}")]
    ServerError { status: u16, message: String },

    #[error("Failed to parse response: {0}")]
    ParseError(#[from] serde_json::Error),

    #[error("Server connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(#[from] url::ParseError),
}

impl ApiError {
    pub fn is_not_found(&self) -> bool {
        matches!(self, Self::BundleNotFound(_))
    }

    pub fn is_verification_error(&self) -> bool {
        matches!(self, Self::VerificationFailed(_))
    }

    pub fn from_status(status: u16, message: impl Into<String>) -> Self {
        Self::ServerError {
            status,
            message: message.into(),
        }
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;

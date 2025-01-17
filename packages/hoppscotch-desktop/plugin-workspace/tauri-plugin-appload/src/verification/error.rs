use thiserror::Error;

pub type Result<T> = std::result::Result<T, VerificationError>;

#[derive(Debug, Error)]
pub enum VerificationError {
    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid file hash: expected {expected}, got {actual}")]
    InvalidHash { expected: String, actual: String },

    #[error("Key validation failed: {0}")]
    KeyValidation(String),

    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),

    #[error("Invalid key length: {0}")]
    InvalidKeyLength(String),

    #[error(transparent)]
    Base64(#[from] base64::DecodeError),

    #[error(transparent)]
    Ed25519(#[from] ed25519_dalek::SignatureError),

    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl VerificationError {
    pub fn is_key_error(&self) -> bool {
        matches!(self, Self::KeyValidation(_))
    }

    pub fn is_verification_error(&self) -> bool {
        matches!(self, Self::InvalidSignature | Self::InvalidHash { .. })
    }
}

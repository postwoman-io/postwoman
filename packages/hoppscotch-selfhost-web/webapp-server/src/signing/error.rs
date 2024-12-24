use base64::DecodeError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SigningError {
    #[error("Environment variable not found")]
    EnvVarMissing,

    #[error("Invalid base64 encoding: {0}")]
    InvalidBase64(#[from] DecodeError),

    #[error("Invalid key length: expected 32 bytes")]
    InvalidKeyLength,

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),

    #[error("Signature verification failed: {0}")]
    VerificationFailed(String),

    #[error("Key generation failed: {0}")]
    GenerationFailed(String),
}

impl SigningError {
    pub fn is_invalid_signature(&self) -> bool {
        matches!(
            self,
            SigningError::InvalidSignature | SigningError::VerificationFailed(_)
        )
    }

    pub fn is_configuration_error(&self) -> bool {
        matches!(
            self,
            SigningError::EnvVarMissing
                | SigningError::InvalidKeyFormat(_)
                | SigningError::InvalidKeyLength
        )
    }
}

impl From<ed25519_dalek::SignatureError> for SigningError {
    fn from(err: ed25519_dalek::SignatureError) -> Self {
        tracing::error!(error = ?err, "Signature verification failed");
        SigningError::InvalidSignature
    }
}

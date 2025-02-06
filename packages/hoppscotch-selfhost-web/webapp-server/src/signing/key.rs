use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use ed25519_dalek::{SigningKey, VerifyingKey};

#[derive(Debug, Clone)]
pub struct SigningKeyPair {
    pub signing_key: SigningKey,
    pub verifying_key: VerifyingKey,
    pub key_id: String,
}

impl SigningKeyPair {
    pub fn new() -> Self {
        tracing::info!("Generating new signing key pair");

        let signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifying_key = VerifyingKey::from(&signing_key);

        let key_id = format!("key_{}", Utc::now().format("%Y%m%d_%H%M%S"));

        tracing::info!(key_id = %key_id, "Generated new signing key pair");
        tracing::info!(signing_key_bytes_encoded = ?STANDARD.encode(signing_key.to_bytes()));
        tracing::info!(verifying_key_bytes_encoded = ?STANDARD.encode(verifying_key.to_bytes()));

        Self {
            signing_key,
            verifying_key,
            key_id,
        }
    }
}

impl std::fmt::Display for SigningKeyPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SigningKeyPair(id: {})", self.key_id)
    }
}

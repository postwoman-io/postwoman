use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

/// Describes one registered app instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Registration {
    pub registered_at: DateTime<Utc>,

    /// base16 (lowercase) encoded shared secret that the client
    /// and agent established during registration that is used
    /// to encrypt traffic between them
    pub shared_secret_b16: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaskedRegistration {
    pub registered_at: DateTime<Utc>,
    pub auth_key_hash: String,
}

impl From<(&String, &Registration)> for MaskedRegistration {
    fn from((key, registration): (&String, &Registration)) -> Self {
        let hash = Sha256::digest(key.as_bytes());
        let short_hash = base16::encode_lower(&hash[..3]);

        Self {
            registered_at: registration.registered_at,
            auth_key_hash: short_hash,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RegistrationsList {
    pub registrations: Vec<MaskedRegistration>,
    pub total: usize,
}

/// Single instance payload.
#[derive(Clone, Serialize)]
pub struct Payload {
    args: Vec<String>,
    cwd: String,
}

impl Payload {
    pub fn new(args: Vec<String>, cwd: String) -> Self {
        Self { args, cwd }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandshakeResponse {
    #[allow(non_snake_case)]
    pub __hoppscotch__agent__: bool,

    pub status: String,
    pub agent_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmedRegistrationRequest {
    pub registration: String,

    /// base16 (lowercase) encoded public key shared by the client
    /// to the agent so that the agent can establish a shared secret
    /// which will be used to encrypt traffic between agent
    /// and client after registration
    pub client_public_key_b16: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthKeyResponse {
    pub auth_key: String,
    pub created_at: DateTime<Utc>,

    /// base16 (lowercase) encoded public key shared by the
    /// agent so that the client can establish a shared secret
    /// which will be used to encrypt traffic between agent
    /// and client after registration
    pub agent_public_key_b16: String,
}

/// A logger guard, managed by tauri runtime to make sure
/// logger doesn't get cleaned up or dropped during app's run time.
pub struct LogGuard(pub tracing_appender::non_blocking::WorkerGuard);

#[derive(Debug, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub context: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

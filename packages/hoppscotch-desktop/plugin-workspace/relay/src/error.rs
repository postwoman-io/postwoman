use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RelayError {
    #[error("Unsupported feature '{feature}' in relay '{relay}': {message}")]
    UnsupportedFeature {
        feature: String,
        message: String,
        relay: String,
    },

    #[error("Network error: {message}")]
    Network {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cause: Option<String>,
    },

    #[error("Request timed out during {}", .phase.as_ref().map_or("execution", TimeoutPhase::as_str))]
    Timeout {
        message: String,
        phase: Option<TimeoutPhase>,
    },

    #[error("Certificate error: {message}")]
    Certificate {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cause: Option<String>,
    },

    #[error("Failed to parse response: {message}")]
    Parse {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cause: Option<String>,
    },

    #[error("Request aborted: {message}")]
    Abort { message: String },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimeoutPhase {
    Connect,
    Tls,
    Response,
}

impl TimeoutPhase {
    fn as_str(&self) -> &'static str {
        match self {
            TimeoutPhase::Connect => "connection establishment",
            TimeoutPhase::Tls => "TLS handshake",
            TimeoutPhase::Response => "response waiting",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RequestResult<T> {
    Success { response: T },
    Error { error: RelayError },
}

pub type Result<T> = std::result::Result<T, RelayError>;

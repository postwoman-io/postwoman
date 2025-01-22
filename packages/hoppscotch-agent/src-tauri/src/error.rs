use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Invalid Registration")]
    InvalidRegistration,
    #[error("Invalid Client Public Key")]
    InvalidClientPublicKey,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Request not found or already completed")]
    RequestNotFound,
    #[error("Internal server error")]
    InternalServerError,
    #[error("Invalid request: {0}")]
    BadRequest(String),
    #[error("Client certificate error")]
    ClientCertError,
    #[error("Root certificate error")]
    RootCertError,
    #[error("Invalid method")]
    InvalidMethod,
    #[error("Invalid URL")]
    InvalidUrl,
    #[error("Invalid headers")]
    InvalidHeaders,
    #[error("Request run error: {0}")]
    RequestRunError(String),
    #[error("Request cancelled")]
    RequestCancelled,
    #[error("Failed to clear registrations")]
    RegistrationClearError,
    #[error("Failed to insert registrations")]
    RegistrationInsertError,
    #[error("Failed to save registrations to store")]
    RegistrationSaveError,
    #[error("Serde error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Store error: {0}")]
    TauriPluginStore(#[from] tauri_plugin_store::Error),
    #[error("Relay error: {0}")]
    Relay(#[from] hoppscotch_relay::RelayError),
}

impl IntoResponse for AgentError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AgentError::InvalidRegistration => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::InvalidClientPublicKey => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AgentError::RequestNotFound => (StatusCode::NOT_FOUND, self.to_string()),
            AgentError::InternalServerError => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            AgentError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AgentError::ClientCertError => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::RootCertError => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::InvalidMethod => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::InvalidUrl => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::InvalidHeaders => (StatusCode::BAD_REQUEST, self.to_string()),
            AgentError::RequestRunError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AgentError::RequestCancelled => (StatusCode::BAD_REQUEST, self.to_string()),
            _ => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error".to_string(),
            ),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

pub type AgentResult<T> = std::result::Result<T, AgentError>;

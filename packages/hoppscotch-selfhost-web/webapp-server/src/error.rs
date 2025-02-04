use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("Bundle not found: {0}")]
    BundleNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error(transparent)]
    Bundle(#[from] crate::bundle::BundleError),

    #[error(transparent)]
    Signing(#[from] crate::signing::SigningError),

    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),

    #[error(transparent)]
    Axum(#[from] axum::Error),

    #[error(transparent)]
    Http(#[from] axum::http::Error),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
    code: u16,
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            Error::BundleNotFound(name) => {
                tracing::warn!(bundle_name = %name, "Bundle not found");
                (StatusCode::NOT_FOUND, self.to_string())
            }
            Error::ValidationError(msg) => {
                tracing::warn!(message = %msg, "Validation error");
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            Error::Bundle(crate::bundle::BundleError::NotFound(msg)) => {
                tracing::warn!(message = %msg, "Bundle not found");
                (StatusCode::NOT_FOUND, msg.clone())
            }
            Error::Bundle(crate::bundle::BundleError::ValidationFailed(msg)) => {
                tracing::warn!(message = %msg, "Bundle validation failed");
                (StatusCode::BAD_REQUEST, msg.clone())
            }
            Error::Config(msg) => {
                tracing::error!(error = %msg, "Configuration error");
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            _ => {
                tracing::error!(error = ?self, "Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        let body = ErrorResponse {
            success: false,
            error: error_message,
            code: status.as_u16(),
        };

        tracing::debug!(
            status = %status,
            error = %body.error,
            code = body.code,
            "Generating error response"
        );

        (status, Json(body)).into_response()
    }
}

impl From<Error> for StatusCode {
    fn from(error: Error) -> Self {
        match error {
            Error::BundleNotFound(_) => StatusCode::NOT_FOUND,
            Error::ValidationError(_) => StatusCode::BAD_REQUEST,
            Error::Bundle(crate::bundle::BundleError::NotFound(_)) => StatusCode::NOT_FOUND,
            Error::Bundle(crate::bundle::BundleError::ValidationFailed(_)) => {
                StatusCode::BAD_REQUEST
            }
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl Error {
    pub fn is_not_found(&self) -> bool {
        matches!(
            self,
            Error::BundleNotFound(_) | Error::Bundle(crate::bundle::BundleError::NotFound(_))
        )
    }

    pub fn is_validation_error(&self) -> bool {
        matches!(
            self,
            Error::ValidationError(_)
                | Error::Bundle(crate::bundle::BundleError::ValidationFailed(_))
        )
    }
}

use axum::http::StatusCode;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Failed to download bundle: {0}")]
    DownloadFailed(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error(transparent)]
    Bundle(#[from] crate::bundle::BundleError),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Axum(#[from] axum::Error),
}

pub type Result<T> = std::result::Result<T, ApiError>;

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_message) = match &self {
            ApiError::DownloadFailed(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            ApiError::InvalidRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            _ => {
                tracing::error!(error = ?self, "Internal server error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        let body = serde_json::json!({
            "success": false,
            "error": error_message,
            "code": status.as_u16()
        });

        (status, axum::Json(body)).into_response()
    }
}

use std::sync::Arc;

use axum::{extract::State, routing::get, Router};

mod error;
mod handler;
mod model;

use error::Result;
use handler::ApiHandler;

pub fn routes(bundle_manager: Arc<crate::bundle::BundleManager>) -> Router {
    tracing::info!("Setting up API routes");
    let handler = Arc::new(ApiHandler::new(bundle_manager));

    Router::new()
        .route("/api/v1/manifest", get(get_manifest))
        .route("/api/v1/bundle", get(download_bundle))
        .route("/api/v1/key", get(key))
        .with_state(handler)
}

async fn get_manifest(
    State(handler): State<Arc<ApiHandler>>,
) -> Result<impl axum::response::IntoResponse> {
    tracing::debug!("Received request for bundle manifest");
    handler.get_manifest().await
}

async fn download_bundle(
    State(handler): State<Arc<ApiHandler>>,
) -> Result<impl axum::response::IntoResponse> {
    tracing::debug!("Received request to download bundle");
    handler.download_bundle().await
}

async fn key(State(handler): State<Arc<ApiHandler>>) -> Result<impl axum::response::IntoResponse> {
    tracing::debug!("Received request to list public keys");
    handler.key().await
}

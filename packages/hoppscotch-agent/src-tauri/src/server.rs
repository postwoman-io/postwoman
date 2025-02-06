use axum::Router;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;

use crate::route;
use crate::state::AppState;

#[tracing::instrument(skip(state, cancellation_token, app_handle))]
pub async fn run_server(
    state: Arc<AppState>,
    cancellation_token: CancellationToken,
    app_handle: tauri::AppHandle,
) {
    tracing::info!("Initializing server");
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .merge(route::route(state, app_handle))
        .layer(cors);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 9119));
    tracing::info!(address = %addr, "Starting server");

    match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => {
            tracing::info!(address = %addr, "Server bound successfully");

            if let Err(e) = axum::serve(listener, app.into_make_service())
                .with_graceful_shutdown(async move {
                    cancellation_token.cancelled().await;
                    tracing::info!("Graceful shutdown initiated");
                })
                .await
            {
                tracing::error!(error = %e, "Server error occurred");
                return;
            }

            tracing::info!("Server shut down successfully");
        }
        Err(e) => {
            tracing::error!(
                error = %e,
                address = %addr,
                "Failed to bind server to address"
            );
        }
    }
}

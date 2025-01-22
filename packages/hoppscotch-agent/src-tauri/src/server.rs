use axum::Router;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;

use crate::route;
use crate::state::AppState;

pub async fn run_server(
    state: Arc<AppState>,
    cancellation_token: CancellationToken,
    app_handle: tauri::AppHandle,
) {
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .merge(route::route(state, app_handle))
        .layer(cors);

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 9119));

    println!("Server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(async move {
            cancellation_token.cancelled().await;
        })
        .await
        .unwrap();

    println!("Server shut down");
}

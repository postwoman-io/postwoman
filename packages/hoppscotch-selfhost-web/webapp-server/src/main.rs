use std::net::SocketAddr;
use std::path::Path;

use axum::{http::StatusCode, routing::get, Router};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod bundle;
mod config;
mod error;
mod model;
mod signing;

use bundle::{BundleBuilder, BundleManager};
use config::{ServerConfig, DEFAULT_PORT};
use signing::SigningKeyPair;

#[tokio::main]
async fn main() -> error::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().without_time())
        .init();

    tracing::info!("Initializing Hoppscotch Web Static Server");

    let key_pair = SigningKeyPair::new();
    tracing::debug!("Generated new signing key pair");

    let config = ServerConfig::load(key_pair);
    tracing::debug!(?config, "Configuration loaded successfully");

    let frontend_path = Path::new(config.frontend_path()).canonicalize()?;
    if !frontend_path.exists() {
        tracing::error!(?frontend_path, "Frontend path does not exist");
        panic!("Frontend path does not exist");
    }
    tracing::info!(?frontend_path, "Frontend path verified");

    let builder = BundleBuilder::new(&frontend_path)?;
    tracing::info!(?frontend_path, "Initialized bundle builder from path",);

    let (content, files) = builder.finish()?;
    tracing::info!("Bundle built successfully with {} files", files.len());

    tracing::debug!("Initialized bundle manager");
    let bundle_manager = BundleManager::new(config.into(), content, files)?;
    tracing::info!("Bundle signed and stored successfully in the bundle manager");

    let app = Router::new()
        .route("/health", get(|| async { StatusCode::OK }))
        .merge(api::routes(bundle_manager.into()))
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], DEFAULT_PORT));
    tracing::info!("Attempting to bind to address: {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Server successfully bound to {}", listener.local_addr()?);

    tracing::info!("Starting server");
    axum::serve(listener, app).await?;

    Ok(())
}

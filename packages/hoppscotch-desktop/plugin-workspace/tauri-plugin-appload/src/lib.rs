// Copyright 2024 CuriousCorrelation
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! app bundle loading plugin for Tauri.
//! This plugin handles downloading and loading external web app bundles in Tauri webviews.

// TODO: Fix these. There are icons in the asset directory for the web app.
#![doc(
    html_logo_url = "https://github.com/<Placeholder>/<Placeholder>/raw/main/packages/app/public/favicon.ico",
    html_favicon_url = "https://github.com/<Placeholder>/<Placeholder>/raw/main/packages/app/public/favicon.ico"
)]

use std::sync::Arc;
use tauri::{
    plugin::{Builder, Plugin, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod api;
mod bundle;
mod cache;
mod commands;
mod config;
mod envvar;
mod error;
mod global;
mod models;
mod storage;
mod ui;
mod uri;
mod verification;

pub use error::{Error, Result};

#[cfg(mobile)]
use mobile::Appload;

const KERNEL_JS: &str = include_str!("kernel.js");

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("appload")
        .setup(move |app, api| {
            tracing::info!("Initializing appload plugin");

            tracing::debug!("Loading configuration settings.");
            let mut config = config::Config::default();

            tracing::debug!("Resolving app config directory for storage root.");
            let app_config_dir = app.path().app_config_dir().map_err(|e| {
                tracing::error!(error = %e, "Failed to resolve app config directory.");
                Error::Config(e.to_string())
            })?;

            tracing::info!(
                path = ?app_config_dir,
                "Setting storage root to app config directory."
            );
            config.storage.root_dir = app_config_dir;

            let rt = tokio::runtime::Runtime::new().map_err(|e| {
                tracing::error!(error = %e, "Failed to create Tokio runtime.");
                Error::Config(e.to_string())
            })?;

            let storage = rt.block_on(async {
                let storage = storage::StorageManager::new(config.storage.root_dir.clone())
                    .await
                    .map_err(|e| {
                        tracing::error!(error = %e, "Failed to initialize storage manager");
                        Error::Config(e.to_string())
                    })?;

                storage.init().await.map_err(|e| {
                    tracing::error!(error = %e, "Failed to initialize storage directories");
                    Error::Config(e.to_string())
                })?;

                Ok::<_, Error>(Arc::new(storage))
            })?;

            tracing::debug!("Initializing cache manager.");
            let cache = Arc::new(cache::CacheManager::new(
                storage.layout().cache_dir(),
                cache::CachePolicy::new(
                    config.cache.max_size,
                    config.cache.file_ttl,
                    config.cache.hot_ratio,
                ),
            ));

            tracing::debug!("Setting up bundle loader.");
            let bundle_loader = Arc::new(bundle::BundleLoader::new(cache.clone(), storage.clone()));

            tracing::debug!("Setting up uri handler.");
            let config = app.config();
            let uri_handler = Arc::new(uri::UriHandler::new(cache.clone(), config.clone()));

            #[cfg(desktop)]
            tracing::debug!("Initializing desktop-specific components.");
            #[cfg(desktop)]
            let view = desktop::init(app, api, bundle_loader.clone())?;

            #[cfg(mobile)]
            tracing::debug!("Initializing mobile-specific components.");
            #[cfg(mobile)]
            let view = mobile::init(app, api, bundle_loader.clone())?;

            app.manage(bundle_loader);
            app.manage(cache);
            app.manage(storage);
            app.manage(uri_handler);
            app.manage(view);

            tracing::info!("appload plugin setup complete.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::download,
            commands::load,
            commands::clear
        ])
        .register_uri_scheme_protocol("app", move |ctx, req| {
            let app = ctx.app_handle();
            let uri = req.uri();
            tracing::debug!(url = %uri, "Handling app URI scheme request.");

            let uri_handler = app.state::<Arc<uri::UriHandler>>();

            tokio::runtime::Runtime::new()
                .map_err(|e| {
                    tracing::error!(error = %e, "Failed to create Tokio runtime.");
                    Error::Config(e.to_string())
                })
                .unwrap()
                .block_on(async { uri_handler.handle(uri).await })
                .unwrap()
        })
        .build()
}

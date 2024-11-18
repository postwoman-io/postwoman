// Copyright 2024 CuriousCorrelation
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Hoppscotch app bundle loading plugin for Tauri.
//! This plugin handles downloading and loading external Hoppscotch web app bundles in Tauri webviews.

// TODO: Fix these. There are icons in asset directory for the web app.
#![doc(
    html_logo_url = "https://github.com/hoppscotch/hoppscotch/raw/main/packages/hoppscotch-app/public/favicon.ico",
    html_favicon_url = "https://github.com/hoppscotch/hoppscotch/raw/main/packages/hoppscotch-app/public/favicon.ico"
)]

use std::sync::Arc;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

use global::{BUNDLE_CLEANUP_INTERVAL, BUNDLE_MAX_AGE};

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod global;
mod models;
mod bundle;
mod replacer;
mod envvar;

pub use error::{Error, Result};

use bundle::BundleManager;

#[cfg(desktop)]
use desktop::HoppscotchAppload;
#[cfg(mobile)]
use mobile::HoppscotchAppload;

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tracing::info!("Initializing hoppscotch-appload plugin");

    Builder::<R>::new("hoppscotch-appload")
        .setup(move |app, api| {
            tracing::debug!("Setting up hoppscotch-appload plugin");

            let app_data_path = app.path().app_data_dir().map_err(|e| {
                tracing::error!(?e, "Failed to get app data directory");
                error::Error::PathAccess("Failed to get app data directory".into())
            })?;

            let bundle_manager = Arc::new(BundleManager::new(app_data_path));

            {
                let app_handle = app.app_handle().clone();
                let bundle_manager = bundle_manager.clone();

                // Periodic bundle cleanup
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(BUNDLE_CLEANUP_INTERVAL).await;

                        tracing::debug!("Running periodic bundle cleanup");
                        bundle_manager.cleanup_old_archives(BUNDLE_MAX_AGE);

                        let stats = bundle_manager.get_stats();
                        tracing::debug!(
                            total_archives = stats.total_archives,
                            active_readers = stats.active_readers,
                            "Bundle manager stats after cleanup"
                        );

                        if app_handle.windows().is_empty() {
                            break;
                        }
                    }
                });
            }

            #[cfg(mobile)]
            let hoppscotch_appload = mobile::init(app, api)?;

            #[cfg(desktop)]
            let hoppscotch_appload = desktop::init(app, api)?;

            app.manage(bundle_manager.clone());
            app.manage(hoppscotch_appload);

            tracing::info!("Plugin setup complete");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::download, commands::load])
        .register_uri_scheme_protocol("app", |ctx, request| {
            let app = ctx.app_handle();
            let url = request.uri();
            tracing::debug!(?url, "Handling app URI scheme request");

            let host = url.host().unwrap_or("");
            let path = url.path().trim_start_matches('/');
            tracing::debug!(?host, ?path, "Processing request path");

            app.state::<Arc<BundleManager>>()
                .fetch(host, path)
                .map_err(|e| {
                    tracing::error!(?e, ?host, "Failed to handle file request");
                    tauri::http::Response::builder()
                        .status(404)
                        .body("Not found")
                        .unwrap()
                })
                .map(|(content, mime_type)| {
                    tracing::debug!(
                        ?mime_type,
                        content_length = content.len(),
                        "Successfully loaded file"
                    );
                    let mut builder = tauri::http::Response::builder().status(200);
                    if let Some(mime) = mime_type {
                        builder = builder.header("Content-Type", mime);
                    }
                    builder.body(content).unwrap()
                })
                .unwrap()
        })
        .build()
}

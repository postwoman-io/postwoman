// Copyright 2024 CuriousCorrelation
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Hoppscotch app bundle loading plugin for Tauri.
//! This plugin handles downloading and loading external Hoppscotch web app bundles in Tauri webviews.

// TODO: Fix these.
#![doc(
    html_logo_url = "https://github.com/hoppscotch/hoppscotch/raw/main/packages/hoppscotch-app/public/favicon.ico",
    html_favicon_url = "https://github.com/hoppscotch/hoppscotch/raw/main/packages/hoppscotch-app/public/favicon.ico"
)]

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
mod util;

pub use error::{Error, Result};

use util::Bundle;

#[cfg(desktop)]
use desktop::HoppscotchAppload;
#[cfg(mobile)]
use mobile::HoppscotchAppload;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the hoppscotch-appload APIs.
pub trait HoppscotchApploadExt<R: Runtime> {
    fn hoppscotch_appload(&self) -> &HoppscotchAppload<R>;
}

impl<R: Runtime, T: Manager<R>> crate::HoppscotchApploadExt<R> for T {
    fn hoppscotch_appload(&self) -> &HoppscotchAppload<R> {
        self.state::<HoppscotchAppload<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tracing::info!("Initializing hoppscotch-appload plugin");

    Builder::new("hoppscotch-appload")
        .setup(|app, api| {
            tracing::debug!("Setting up hoppscotch-appload plugin");

            #[cfg(mobile)]
            let hoppscotch_appload = {
                tracing::debug!("Initializing mobile implementation");
                mobile::init(app, api)?
            };

            #[cfg(desktop)]
            let hoppscotch_appload = {
                tracing::debug!("Initializing desktop implementation");
                desktop::init(app, api)?
            };

            tracing::debug!("Managing plugin state");
            app.manage(hoppscotch_appload);

            tracing::info!("Plugin setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::download, commands::load])
        .register_uri_scheme_protocol("app", |ctx, req| {
            let url = req.uri();
            tracing::debug!(?url, "Handling app URI scheme request");

            let response = {
                let host = url.host().unwrap_or("");
                let path = url.path().trim_start_matches('/');

                tracing::debug!(?host, ?path, "Processing request path");

                let app_data_path = match ctx.app_handle().path().app_data_dir() {
                    Ok(path) => {
                        tracing::debug!(?path, "Found app data directory");
                        path
                    }
                    Err(e) => {
                        tracing::error!(?e, "Failed to get app data directory");
                        return tauri::http::Response::builder()
                            .status(500)
                            .body("Internal server error".into())
                            .unwrap();
                    }
                };

                match Bundle::new(app_data_path, host) {
                    Ok(mut handler) => {
                        tracing::debug!("Created bundle handler");
                        match handler.handle_file(path) {
                            Ok((content, mime_type)) => {
                                tracing::debug!(?mime_type, content_length = content.len(), "Successfully loaded file");
                                let mut builder = tauri::http::Response::builder().status(200);
                                if let Some(mime) = mime_type {
                                    builder = builder.header("Content-Type", mime);
                                }
                                builder.body(content).unwrap()
                            }
                            Err(e) => {
                                tracing::error!(?e, ?path, "Failed to handle file request");
                                tauri::http::Response::builder()
                                    .status(404)
                                    .body("Not found".into())
                                    .unwrap()
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(?e, ?host, "Failed to create bundle handler");
                        tauri::http::Response::builder()
                            .status(500)
                            .body("Failed to load bundle".into())
                            .unwrap()
                    }
                }
            };

            tracing::debug!(
                status = response.status().as_u16(),
                "Returning response"
            );
            response
        })
        .build()
}

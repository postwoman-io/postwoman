use std::sync::Arc;

use tauri::{command, AppHandle, Manager, Runtime};

use crate::{
    bundle::BundleManager, DownloadOptions, DownloadResponse, Error, LoadOptions,
    LoadResponse, Result,
};

/// Download an app bundle from the given URL and optionally load it immediately
#[command]
pub async fn download<R: Runtime>(
    app: AppHandle<R>,
    options: DownloadOptions,
) -> Result<DownloadResponse> {
    tracing::info!(?options, "Starting app bundle download");

    let paths = app.path().app_data_dir().map_err(|e| {
        tracing::error!(?e, "Failed to access app data directory");
        Error::PathAccess("app data directory".into())
    })?;

    let bundle_name = options.name.unwrap_or_else(|| {
        options
            .url
            .host_str()
            .unwrap_or("unknown")
            .replace('.', "-")
    });
    tracing::debug!(?bundle_name, "Using bundle name");

    let bundle_path = paths.join(format!("{}.zip", bundle_name));
    tracing::debug!(?bundle_path, "Target bundle path");

    if bundle_path.exists() {
        tracing::debug!("Found existing bundle - downloading update");
        tracing::debug!(
            ?bundle_path,
            "Existing bundle will be replaced with updated version"
        );
    }

    let mut bundle_url = options.url;
    bundle_url.set_path("assets/bundle.zip");

    tracing::debug!(?bundle_url, "Downloading bundle from URL");
    let content = reqwest::get(bundle_url)
        .await
        .map_err(|e| {
            tracing::error!(?e, "Failed to download bundle");
            e
        })?
        .bytes()
        .await?;

    tokio::fs::create_dir_all(&paths).await?;
    tokio::fs::write(&bundle_path, content).await?;
    tracing::debug!(?bundle_path, "Bundle written to disk");

    if let Some(manager) = app.try_state::<Arc<BundleManager>>() {
        tracing::debug!(?bundle_name, "Caching bundle in memory");
        manager.get_archive(&bundle_name)?;
        tracing::info!(?bundle_path, "Bundle successfully cached in memory");
    } else {
        tracing::warn!("BundleManager not found in app state");
    }

    Ok(DownloadResponse {
        success: true,
        path: bundle_path.to_string_lossy().into(),
    })
}

const KERNEL_JS: &str = include_str!("./kernel.js");

#[command]
pub async fn load<R: Runtime>(app: AppHandle<R>, options: LoadOptions) -> Result<LoadResponse> {
    tracing::info!(?options, "Starting app load process");

    let window_label = format!("app-{}", options.name);
    let url = format!("app://{}/", options.name);
    tracing::debug!(?window_label, ?url, "Initialized load parameters");

    if options.inline {
        tracing::debug!("Attempting inline load");
        let window = app.get_focused_window().ok_or_else(|| {
            tracing::error!("No focused window found for inline loading");
            Error::PathAccess("No focused window".into())
        })?;

        tracing::debug!(?url, "Attempting to navigate current window");
        window
            .webviews()
            .first()
            .ok_or_else(|| {
                tracing::error!("No webview found in focused window");
                Error::PathAccess("No focused window".into())
            })?
            .eval(&format!("window.location.href = '{}'", url))?;

        tracing::info!(?window_label, "Successfully completed inline load");
        return Ok(LoadResponse {
            success: true,
            window_label: window.label().into(),
        });
    }

    tracing::debug!(?window_label, "Creating new window");
    let window =
        tauri::WebviewWindowBuilder::new(&app, &window_label, tauri::WebviewUrl::App(url.into()))
            .title(&options.window.title)
            .inner_size(options.window.width, options.window.height)
            .resizable(options.window.resizable)
            .initialization_script(KERNEL_JS)
            .build()
            .map_err(|e| {
                tracing::error!(?e, ?window_label, "Failed to create window");
                e
            })?;

    let visible = window.is_visible().unwrap_or(false);
    if !visible {
        tracing::warn!(?window_label, "Window created but not visible");
    }
    tracing::info!(?window_label, ?visible, "Window creation completed");

    Ok(LoadResponse {
        success: visible,
        window_label,
    })
}

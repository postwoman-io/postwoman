use crate::{
    bundle::BundleLoader,
    models::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse},
    Result,
};
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, Runtime};

fn sanitize_window_label(input: &str) -> String {
    input
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

#[command]
pub async fn download<R: Runtime>(
    app: AppHandle<R>,
    options: DownloadOptions,
) -> Result<DownloadResponse> {
    tracing::info!(?options, "Starting download process");
    let bundle_loader = app.state::<Arc<BundleLoader>>();
    tracing::debug!("Retrieved BundleLoader state");

    tracing::info!(url = %options.server_url, "Attempting to load bundle");
    bundle_loader
        .load_bundle(options.server_url.as_str())
        .await
        .map_err(|e| {
            tracing::error!(?e, url = %options.server_url, "Failed to load bundle");
            e
        })?;

    let storage = app.state::<Arc<crate::storage::StorageManager>>();
    tracing::debug!("Retrieved StorageManager state");

    tracing::info!(url = %options.server_url, "Fetching bundle entry from storage");
    let entry = storage
        .get_bundle_entry(options.server_url.as_str())
        .await
        .map_err(|e| {
            tracing::error!(?e, url = %options.server_url, "Failed to fetch bundle entry");
            e
        })?
        .ok_or_else(|| {
            tracing::error!(url = %options.server_url, "Bundle not found after download");
            crate::Error::Config("Bundle not found after download".into())
        })?;

    let response = DownloadResponse {
        success: true,
        bundle_name: entry.bundle_name,
        server_url: options.server_url,
        version: entry.version,
    };

    tracing::info!(?response, "Download completed successfully");
    Ok(response)
}

#[command]
pub async fn load<R: Runtime>(app: AppHandle<R>, options: LoadOptions) -> Result<LoadResponse> {
    tracing::info!(?options, "Starting load process");

    let window_label = format!("app_{}", sanitize_window_label(&options.bundle_name));
    let url = format!("app://{}/", options.bundle_name);

    tracing::debug!(window_label = %window_label, "Generated sanitized window label");

    if options.inline {
        let window = app.get_focused_window().ok_or_else(|| {
            tracing::error!("No focused window found for inline loading");
            crate::Error::WindowNotFound
        })?;
        tracing::debug!(window_label = %window.label(), "Found focused window for inline loading");

        window
            .webviews()
            .first()
            .ok_or_else(|| {
                tracing::error!("No webview found in focused window");
                crate::Error::WindowNotFound
            })?
            .eval(&format!("window.location.href = '{}'", url))
            .map_err(|e| {
                tracing::error!(?e, url = %url, "Failed to evaluate inline loading script");
                e
            })?;

        let response = LoadResponse {
            success: true,
            window_label: window.label().into(),
        };
        tracing::info!(?response, "Inline loading completed successfully");
        return Ok(response);
    }

    let window =
        tauri::WebviewWindowBuilder::new(&app, &window_label, tauri::WebviewUrl::App(url.into()))
            .title(&options.window.title)
            .inner_size(options.window.width, options.window.height)
            .resizable(options.window.resizable)
            .initialization_script(super::KERNEL_JS)
            .build()
            .map_err(|e| {
                tracing::error!(?e, ?window_label, "Failed to create window");
                e
            })?;

    let response = LoadResponse {
        success: window.is_visible().unwrap_or(false),
        window_label,
    };

    tracing::info!(?response, "Load process completed successfully");
    Ok(response)
}

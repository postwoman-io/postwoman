use std::sync::Arc;

use tauri::{
    command, AppHandle, LogicalPosition, Manager, Runtime, TitleBarStyle, WebviewUrl,
    WebviewWindowBuilder,
};

use crate::{
    bundle::BundleLoader,
    models::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse},
    ui, Result,
};

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
    let label = format!("{}", sanitize_window_label(&options.window.title));
    tracing::info!(?options, bundle = %options.bundle_name, "Loading bundle");

    let url = format!("app://{}/", options.bundle_name);
    tracing::debug!(%url, "Generated app URL");

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.parse().unwrap()))
        .initialization_script(crate::KERNEL_JS)
        .title(sanitize_window_label(&label))
        .inner_size(options.window.width, options.window.height)
        .resizable(options.window.resizable)
        .build()
        .map_err(|e| {
            tracing::error!(?e, ?label, "Failed to create window");
            e
        })?;

    #[cfg(target_os = "macos")]
    {
        let window_clone = window.clone();
        window.run_on_main_thread(move || {
            ui::macos::posit::setup_window(window_clone);
        })?;
    }

    if let Some(main_window) = app.get_webview_window("main") {
        main_window.close()?;
        tracing::info!("Closing `main` window");
    }

    let response = LoadResponse {
        success: window.is_visible().unwrap_or(false),
        window_label: label,
    };

    tracing::info!(?response, "Bundle loaded successfully");
    Ok(response)
}

use std::sync::Arc;

use tauri::{command, AppHandle, Manager, Runtime};

use crate::{
    bundle::BundleLoader,
    models::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse},
    Result,
};

#[command]
pub async fn download<R: Runtime>(
    app: AppHandle<R>,
    options: DownloadOptions,
) -> Result<DownloadResponse> {
    let bundle_loader = app.state::<Arc<BundleLoader>>();

    let name = options.bundle_name.unwrap_or_else(|| {
        options
            .server_url
            .host_str()
            .unwrap_or("unknown")
            .replace('.', "-")
    });

    bundle_loader
        .load_bundle(&name, options.server_url.as_str())
        .await?;

    Ok(DownloadResponse {
        success: true,
        path: name,
        server_url: options.server_url,
    })
}

#[command]
pub async fn load<R: Runtime>(app: AppHandle<R>, options: LoadOptions) -> Result<LoadResponse> {
    let window_label = format!("app-{}", options.name);
    let url = format!("app://{}/", options.name);

    if options.inline {
        let window = app.get_focused_window().ok_or_else(|| {
            tracing::error!("No focused window found for inline loading");
            crate::Error::WindowNotFound
        })?;

        window
            .webviews()
            .first()
            .ok_or_else(|| {
                tracing::error!("No webview found in focused window");
                crate::Error::WindowNotFound
            })?
            .eval(&format!("window.location.href = '{}'", url))?;

        return Ok(LoadResponse {
            success: true,
            window_label: window.label().into(),
        });
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

    Ok(LoadResponse {
        success: window.is_visible().unwrap_or(false),
        window_label,
    })
}

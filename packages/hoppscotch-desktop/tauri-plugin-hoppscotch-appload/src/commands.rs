use tauri::{command, AppHandle, Manager, Runtime};

use crate::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse, Result};

/// Download an app bundle from the given URL
#[command]
pub async fn download<R: Runtime>(
    app: AppHandle<R>,
    options: DownloadOptions,
) -> Result<DownloadResponse> {
    tracing::debug!(?options, "Downloading app bundle");

    let paths = app.path().app_data_dir().map_err(|_| {
        tracing::error!("Failed to get app data directory");
        crate::Error::PathAccess("app data directory".into())
    })?;

    let bundle_name = options.name.unwrap_or_else(|| {
        options
            .url
            .host_str()
            .unwrap_or("unknown")
            .replace('.', "-")
    });
    tracing::debug!(?bundle_name, "Using bundle name");

    let mut bundle_url = options.url;
    bundle_url.set_path("assets/bundle.zip");
    tracing::debug!(?bundle_url, "Downloading from URL");

    // Download the bundle
    let content = match reqwest::get(bundle_url).await {
        Ok(response) => {
            tracing::debug!("Successfully contacted download URL");
            response.bytes().await?
        }
        Err(e) => {
            tracing::error!(?e, "Failed to download bundle");
            return Err(e.into());
        }
    };

    // Make sure target directory exists
    if let Err(e) = tokio::fs::create_dir_all(&paths).await {
        tracing::error!(?e, ?paths, "Failed to create app data directory");
        return Err(e.into());
    }
    tracing::debug!(?paths, "Created app data directory");

    // Save the bundle
    let bundle_path = paths.join(format!("{}.zip", bundle_name));
    if let Err(e) = tokio::fs::write(&bundle_path, content).await {
        tracing::error!(?e, ?bundle_path, "Failed to write bundle to disk");
        return Err(e.into());
    }
    tracing::info!(?bundle_path, "Successfully saved bundle to disk");

    Ok(DownloadResponse {
        success: true,
        path: bundle_path.to_string_lossy().into(),
    })
}

const KERNEL_JS: &str = include_str!("./kernel.js");

/// Load an app in a new window
#[command]
pub async fn load<R: Runtime>(app: AppHandle<R>, options: LoadOptions) -> Result<LoadResponse> {
    tracing::debug!(?options, "Loading app");

    let window_label = format!("app-{}", options.name);
    let url = format!("app://{}/index.html", options.name);
    let webview_url = tauri::WebviewUrl::App(url.clone().into());

    if options.inline {
        if let Some(window) = app.get_focused_window() {
            tracing::debug!(?url, "Navigating current window");
            window.webviews()[0].eval(&format!("window.location.href = '{}'", url))?;

            Ok(LoadResponse {
                success: true,
                window_label: window.label().into(),
            })
        } else {
            tracing::error!("No focused window found for inline loading");
            Err(crate::Error::PathAccess("No focused window".into()))
        }
    } else {
        tracing::debug!(?window_label, ?url, "Creating window");

        let window = match tauri::WebviewWindowBuilder::new(&app, &window_label, webview_url)
            .title(&options.window.title)
            .inner_size(options.window.width, options.window.height)
            .resizable(options.window.resizable)
            .initialization_script(KERNEL_JS)
            .build()
        {
            Ok(window) => {
                tracing::info!(?window_label, "Successfully created window");
                window
            }
            Err(e) => {
                tracing::error!(?e, ?window_label, "Failed to create window");
                return Err(e.into());
            }
        };

        let visible = window.is_visible().unwrap_or(false);
        tracing::debug!(?visible, ?window_label, "Window visibility status");

        Ok(LoadResponse {
            success: visible,
            window_label,
        })
    }
}

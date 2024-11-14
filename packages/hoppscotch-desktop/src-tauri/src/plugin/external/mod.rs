mod error;
mod util;

use std::path::PathBuf;

use tauri::Manager;
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

use error::{ExternalError, ExternalResult};
use util::Bundle;

const KERNEL_JS: &str = include_str!("./kernel.js");

struct AppPath {
    data_dir: PathBuf,
    local_data_dir: PathBuf,
}

impl AppPath {
    fn new<R: Runtime>(app_handle: &AppHandle<R>) -> ExternalResult<Self> {
        Ok(Self {
            data_dir: app_handle
                .path()
                .app_data_dir()
                .map_err(|_| ExternalError::PathAccess("app data directory".into()))?,
            local_data_dir: app_handle
                .path()
                .app_local_data_dir()
                .map_err(|_| ExternalError::PathAccess("local data directory".into()))?,
        })
    }
}

#[tauri::command]
async fn download<R: Runtime>(url: String, app_handle: AppHandle<R>) -> ExternalResult<()> {
    let paths = AppPath::new(&app_handle)?;
    println!(
        "Downloading from {} to {}",
        url,
        paths.local_data_dir.display()
    );

    let mut url = url::Url::parse(&url)?;
    url.set_path("bundle.zip");

    let content = reqwest::get(url).await?.bytes().await?;
    tokio::fs::create_dir_all(&paths.local_data_dir).await?;

    let bundle_path = paths.local_data_dir.join("bundle.zip");
    let mut file = tokio::fs::File::create(bundle_path).await?;

    tokio::io::copy(&mut content.as_ref(), &mut file).await?;

    Ok(())
}

#[tauri::command]
async fn load<R: Runtime>(app_name: String, app_handle: AppHandle<R>) -> ExternalResult<()> {
    let url = format!("app://{}/index.html", app_name);
    let webview_url = tauri::WebviewUrl::App(url.into());

    tauri::WebviewWindowBuilder::new(&app_handle, "app", webview_url)
        .title("Hoppscotch")
        .initialization_script(KERNEL_JS)
        .build()?;

    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("external")
        .invoke_handler(tauri::generate_handler![download, load])
        .register_uri_scheme_protocol("app", |ctx, req| {
            let url = req.uri();

            let response = {
                let host = url.host().unwrap_or("");
                let path = url.path().trim_start_matches('/');
                let app_data_path = ctx
                    .app_handle()
                    .path()
                    .app_data_dir()
                    .expect("Failed to get app data directory");

                Bundle::new(app_data_path, host)
                    .ok()
                    .and_then(|mut handler| handler.handle_file(path).ok())
                    .map(|(content, mime_type)| {
                        let mut builder = tauri::http::Response::builder().status(200);
                        if let Some(mime) = mime_type {
                            builder = builder.header("Content-Type", mime);
                        }
                        builder.body(content).unwrap()
                    })
            }
            .unwrap_or_else(|| {
                tauri::http::Response::builder()
                    .status(404)
                    .body("Not found".into())
                    .unwrap()
            });

            response
        })
        .build()
}

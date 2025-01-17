use std::sync::Arc;

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{
    bundle::BundleLoader,
    models::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse},
    Result,
};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    api: PluginApi<R, C>,
    bundle_loader: Arc<BundleLoader>,
) -> Result<Appload<R>> {
    Ok(Appload {
        app: app.clone(),
        bundle_loader,
    })
}

pub struct Appload<R: Runtime> {
    app: AppHandle<R>,
    bundle_loader: Arc<BundleLoader>,
}

impl<R: Runtime> Appload<R> {
    pub async fn download(&self, options: DownloadOptions) -> Result<DownloadResponse> {
        super::commands::download(self.app.clone(), options).await
    }

    pub async fn load(&self, options: LoadOptions) -> Result<LoadResponse> {
        super::commands::load(self.app.clone(), options).await
    }
}

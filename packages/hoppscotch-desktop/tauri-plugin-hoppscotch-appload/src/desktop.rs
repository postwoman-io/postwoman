use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<HoppscotchAppload<R>> {
    Ok(HoppscotchAppload(app.clone()))
}

/// Desktop implementation of the Hoppscotch app loading plugin
pub struct HoppscotchAppload<R: Runtime>(AppHandle<R>);

impl<R: Runtime> HoppscotchAppload<R> {
    /// Download an app bundle
    pub async fn download(&self, options: DownloadOptions) -> crate::Result<DownloadResponse> {
        super::commands::download(self.0.clone(), options).await
    }

    /// Load an app in a new window
    pub async fn load(&self, options: LoadOptions) -> crate::Result<LoadResponse> {
        super::commands::load(self.0.clone(), options).await
    }
}

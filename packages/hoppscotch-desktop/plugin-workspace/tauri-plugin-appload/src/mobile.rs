use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_appload);

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "app.tauri.appload";

/// Initialize plugin for mobile platforms
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Appload<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "Appload")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_appload)?;
    Ok(Appload(handle))
}

/// Mobile implementation of the app loading plugin
pub struct Appload<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Appload<R> {
    /// Download an app bundle
    pub async fn download(&self, options: DownloadOptions) -> crate::Result<DownloadResponse> {
        self.0
            .run_mobile_plugin("download", options)
            .map_err(Into::into)
    }

    /// Load an app in a new window
    pub async fn load(&self, options: LoadOptions) -> crate::Result<LoadResponse> {
        self.0
            .run_mobile_plugin("load", options)
            .map_err(Into::into)
    }
}

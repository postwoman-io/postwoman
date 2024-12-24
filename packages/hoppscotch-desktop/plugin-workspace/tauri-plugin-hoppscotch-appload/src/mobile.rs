use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{DownloadOptions, DownloadResponse, LoadOptions, LoadResponse};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_hoppscotch_appload);

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "app.tauri.hoppscotch.appload";

/// Initialize plugin for mobile platforms
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<HoppscotchAppload<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "HoppscotchAppload")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_hoppscotch_appload)?;
    Ok(HoppscotchAppload(handle))
}

/// Mobile implementation of the Hoppscotch app loading plugin
pub struct HoppscotchAppload<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> HoppscotchAppload<R> {
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

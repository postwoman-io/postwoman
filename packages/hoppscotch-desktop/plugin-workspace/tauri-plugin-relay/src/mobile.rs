use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_relay);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Relay<R>> {
    tracing::debug!("Initializing Relay for mobile platform");

    #[cfg(target_os = "android")]
    let handle = {
        tracing::debug!("Registering Android plugin");
        api.register_android_plugin("", "ExamplePlugin")?
    };

    #[cfg(target_os = "ios")]
    let handle = {
        tracing::debug!("Registering iOS plugin");
        api.register_ios_plugin(init_plugin_relay)?
    };

    tracing::info!("Mobile plugin initialization complete");
    Ok(Relay(handle))
}

pub struct Relay<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Relay<R> {
    pub fn run(&self, request: RunRequest) -> crate::Result<ExecuteResponse> {
        tracing::debug!(?request, "Running mobile plugin");
        let result = self.0.run_mobile_plugin("run", request);

        match &result {
            Ok(_) => tracing::debug!("Mobile plugin execution successful"),
            Err(e) => tracing::error!(?e, "Mobile plugin execution failed"),
        }

        result.map_err(Into::into)
    }
}

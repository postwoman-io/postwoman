use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::HoppscotchRelay;
#[cfg(mobile)]
use mobile::HoppscotchRelay;

pub trait HoppscotchRelayExt<R: Runtime> {
    fn hoppscotch_relay(&self) -> &HoppscotchRelay<R>;
}

impl<R: Runtime, T: Manager<R>> crate::HoppscotchRelayExt<R> for T {
    fn hoppscotch_relay(&self) -> &HoppscotchRelay<R> {
        tracing::trace!("Accessing HoppscotchRelay state");
        self.state::<HoppscotchRelay<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tracing::info!("Beginning hoppscotch-relay plugin initialization");

    Builder::new("hoppscotch-relay")
        .invoke_handler(tauri::generate_handler![commands::execute, commands::cancel])
        .setup(|app, api| {
            tracing::info!("Setting up hoppscotch-relay plugin");

            #[cfg(mobile)]
            {
                tracing::debug!("Initializing mobile-specific components");
                let hoppscotch_relay = mobile::init(app, api)?;
                tracing::debug!("Mobile components initialized successfully");
                app.manage(hoppscotch_relay);
            }

            #[cfg(desktop)]
            {
                tracing::debug!("Initializing desktop-specific components");
                let hoppscotch_relay = desktop::init(app, api)?;
                tracing::debug!("Desktop components initialized successfully");
                app.manage(hoppscotch_relay);
            }

            tracing::info!("hoppscotch-relay plugin setup complete");
            Ok(())
        })
        .build()
}

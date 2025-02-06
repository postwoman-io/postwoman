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
use desktop::Relay;
#[cfg(mobile)]
use mobile::Relay;

pub trait RelayExt<R: Runtime> {
    fn relay(&self) -> &Relay<R>;
}

impl<R: Runtime, T: Manager<R>> crate::RelayExt<R> for T {
    fn relay(&self) -> &Relay<R> {
        tracing::trace!("Accessing Relay state");
        self.state::<Relay<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tracing::info!("Beginning relay plugin initialization");

    Builder::new("relay")
        .invoke_handler(tauri::generate_handler![
            commands::execute,
            commands::cancel
        ])
        .setup(|app, api| {
            tracing::info!("Setting up relay plugin");

            #[cfg(mobile)]
            {
                tracing::debug!("Initializing mobile-specific components");
                let relay = mobile::init(app, api)?;
                tracing::debug!("Mobile components initialized successfully");
                app.manage(relay);
            }

            #[cfg(desktop)]
            {
                tracing::debug!("Initializing desktop-specific components");
                let relay = desktop::init(app, api)?;
                tracing::debug!("Desktop components initialized successfully");
                app.manage(relay);
            }

            tracing::info!("relay plugin setup complete");
            Ok(())
        })
        .build()
}

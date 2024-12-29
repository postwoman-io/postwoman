pub mod command;
pub mod controller;
pub mod dialog;
pub mod error;
pub mod global;
pub mod model;
pub mod route;
pub mod server;
pub mod state;
pub mod tray;
pub mod updater;
pub mod util;
pub mod webview;

use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener, Manager, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;
use tokio_util::sync::CancellationToken;
use tracing_subscriber::{fmt::format::JsonFields, EnvFilter};

use error::{AgentError, AgentResult};
use model::{LogGuard, Payload};
use state::AppState;

#[tracing::instrument(skip(app_handle))]
fn create_main_window(app_handle: &AppHandle) -> AgentResult<()> {
    tracing::info!("Creating main application window");

    let main = &app_handle
        .config()
        .app
        .windows
        .first()
        .ok_or(AgentError::NoMainWindow)?;

    tracing::debug!("Building webview window from config");
    let window = WebviewWindowBuilder::from_config(app_handle, main)?.build()?;

    window.hide()?;

    tracing::info!("Main window created successfully");
    Ok(())
}

#[tracing::instrument(skip(app_handle))]
pub fn show_main_window(app_handle: &AppHandle) -> AgentResult<()> {
    tracing::debug!("Attempting to show main window");
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
        tracing::info!("Main window shown and focused");
    }
    Ok(())
}

#[tracing::instrument(skip(app_handle))]
pub fn hide_main_window(app_handle: &AppHandle) -> AgentResult<()> {
    tracing::debug!("Attempting to hide main window");
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide()?;
        tracing::info!("Main window hidden");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing::info!("Initializing Hoppscotch Agent");

    // The installer takes care of installing `WebView`,
    // this check is only required for portable variant.
    #[cfg(all(feature = "portable", windows))]
    {
        tracing::debug!("Checking WebView initialization for portable Windows variant");
        webview::init_webview();
    }

    let cancellation_token = CancellationToken::new();
    let server_cancellation_token = cancellation_token.clone();

    tracing::debug!("Building Tauri application");
    let builder = tauri::Builder::default()
        // NOTE: Currently, plugins run in the order they were added in to the builder,
        // so `tauri_plugin_single_instance` needs to be registered first.
        // See: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/single-instance
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            tracing::info!(
                app_name = %app.package_info().name,
                "Single instance handler triggered"
            );

            if let Err(e) = app.emit("single-instance", Payload::new(args, cwd)) {
                tracing::error!(error = %e, "Failed to emit single-instance event");
            }

            // Application is already running, bring it to foreground.
            if let Err(e) = show_main_window(&app) {
                tracing::error!(error = %e, "Failed to show window");
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(move |app| {
            // let _ = setup_logging(&app.handle())?;

            tracing::info!("Setting up application");
            let app_handle = app.handle();

            #[cfg(all(desktop, not(feature = "portable")))]
            {
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_autostart::ManagerExt;

                tracing::debug!("Configuring autostart for desktop variant");
                let _ = app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None,
                ));

                let autostart_manager = app.autolaunch();

                tracing::info!(
                    enabled = autostart_manager.is_enabled().unwrap_or(false),
                    "Checking autostart status"
                );

                if !autostart_manager.is_enabled().unwrap_or(false) {
                    if let Err(e) = autostart_manager.enable() {
                        tracing::error!(error = %e, "Failed to enable autostart");
                    } else {
                        tracing::info!("Autostart enabled successfully");
                    }
                }
            };

            #[cfg(desktop)]
            {
                tracing::debug!("Initializing desktop-specific features");
                let _ = app
                    .handle()
                    .plugin(tauri_plugin_updater::Builder::new().build());
                let _ = app.handle().plugin(tauri_plugin_dialog::init());

                let updater = app.updater_builder().build().unwrap();
                let app_handle_ref = app_handle.clone();

                tauri::async_runtime::spawn_blocking(|| {
                    tauri::async_runtime::block_on(async {
                        updater::check_and_install_updates(app_handle_ref, updater).await;
                    })
                });
            };

            // Create and hide the main window during setup.
            create_main_window(&app_handle)?;

            tracing::debug!("Initializing application state");
            let app_state = Arc::new(AppState::new(app_handle.clone())?);
            app.manage(app_state.clone());

            let server_cancellation_token = server_cancellation_token.clone();
            let server_app_handle = app_handle.clone();

            tracing::debug!("Spawning server process");
            tauri::async_runtime::spawn(async move {
                server::run_server(app_state, server_cancellation_token, server_app_handle).await;
            });

            #[cfg(all(desktop))]
            {
                tracing::debug!("Creating system tray");
                let handle = app.handle();
                tray::create_tray(handle)?;
            }

            // Blocks the app from populating the macOS dock
            #[cfg(target_os = "macos")]
            {
                tracing::debug!("Setting macOS activation policy");
                app_handle
                    .set_activation_policy(tauri::ActivationPolicy::Accessory)
                    .unwrap();
            };

            let app_handle_ref = app_handle.clone();
            app_handle.listen("registration-received", move |_| {
                tracing::info!("Registration received event triggered");
                if let Err(e) = show_main_window(&app_handle_ref) {
                    tracing::error!(error = %e, "Failed to show window");
                }
            });

            tracing::info!("Application setup completed successfully");
            Ok(())
        })
        .manage(cancellation_token)
        .on_window_event(|window, event| {
            match &event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    tracing::info!("Window close requested");
                    api.prevent_close();

                    if let Err(e) = window.hide() {
                        tracing::error!(error = %e, "Failed to hide window");
                    }

                    let app_state = window.state::<Arc<AppState>>();
                    let mut current_code = app_state.active_registration_code.blocking_write();
                    if current_code.is_some() {
                        tracing::debug!("Clearing active registration code");
                        *current_code = None;
                    }

                    if let Err(e) = window.emit("window-hidden", ()) {
                        tracing::error!(error = %e, "Failed to emit window-hidden event");
                    }
                }
                _ => {
                    tracing::debug!(event = ?event, "Window event received");
                }
            };
        })
        .invoke_handler(tauri::generate_handler![
            command::get_otp,
            command::list_registrations
        ]);

    tracing::info!("Building Tauri application with context");
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    tracing::info!("Running application");
    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, code, .. } => {
            if code.is_none() || matches!(code, Some(0)) {
                tracing::info!("Exit requested, preventing immediate exit");
                api.prevent_exit();
            } else if code.is_some() {
                tracing::info!("Exit with non-zero code requested, initiating shutdown");
                let state = app_handle.state::<CancellationToken>();
                state.cancel();
            }
        }
        _ => {}
    });
}

#[tracing::instrument(skip(app_handle))]
pub fn setup_logging(app_handle: &AppHandle) -> AgentResult<()> {
    tracing::info!("Setting up logging system");

    let app_data_dir = app_handle.path().app_data_dir()?;
    tracing::debug!(path = ?app_data_dir, "Creating app data directory");
    std::fs::create_dir_all(&app_data_dir)?;

    tracing::debug!("Configuring file appender");
    let file_appender = tracing_appender::rolling::RollingFileAppender::builder()
        .rotation(tracing_appender::rolling::Rotation::DAILY)
        .filename_prefix("hoppscotch-agent")
        .filename_suffix("log")
        .max_log_files(1)
        .build(&app_data_dir)?;

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing::debug!("Building subscriber with JSON formatting");
    let subscriber = tracing_subscriber::fmt()
        .fmt_fields(JsonFields::new())
        .with_target(false)
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            if cfg!(debug_assertions) {
                "debug"
            } else {
                "info"
            }
            .into()
        }))
        .with_filter_reloading()
        .finish();

    tracing::subscriber::set_global_default(subscriber)?;

    app_handle.manage(LogGuard(_guard));

    tracing::info!("Logging system initialized successfully");
    Ok(())
}

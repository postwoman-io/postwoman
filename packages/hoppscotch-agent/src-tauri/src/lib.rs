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

use log::{error, info};
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;
use tokio_util::sync::CancellationToken;

use model::Payload;
use state::AppState;

#[tauri::command]
async fn get_otp(state: tauri::State<'_, Arc<AppState>>) -> Result<Option<String>, ()> {
    Ok(state.active_registration_code.read().await.clone())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    // The installer takes care of installing `WebView`,
    // this check is only required for portable variant.
    #[cfg(all(feature = "portable", windows))]
    webview::init_webview();

    let cancellation_token = CancellationToken::new();
    let server_cancellation_token = cancellation_token.clone();

    tauri::Builder::default()
        // NOTE: Currently, plugins run in the order they were added in to the builder,
        // so `tauri_plugin_single_instance` needs to be registered first.
        // See: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/single-instance
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            info!("{}, {args:?}, {cwd}", app.package_info().name);

            app.emit("single-instance", Payload::new(args, cwd))
                .unwrap();

            // Application is already running, bring it to foreground.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                error!("Failed to get `main` window");
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(move |app| {
            let app_handle = app.app_handle();

            #[cfg(all(desktop, not(feature = "portable")))]
            {
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_autostart::ManagerExt;

                let _ = app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None,
                ));

                let autostart_manager = app.autolaunch();

                println!(
                    "autostart enabled: {}",
                    autostart_manager.is_enabled().unwrap()
                );

                if !autostart_manager.is_enabled().unwrap() {
                    let _ = autostart_manager.enable();
                    println!(
                        "autostart updated: {}",
                        autostart_manager.is_enabled().unwrap()
                    );
                }
            };

            #[cfg(desktop)]
            {
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

            let app_state = Arc::new(AppState::new(app_handle.clone())?);

            app.manage(app_state.clone());

            let server_cancellation_token = server_cancellation_token.clone();

            let server_app_handle = app_handle.clone();

            tauri::async_runtime::spawn(async move {
                server::run_server(app_state, server_cancellation_token, server_app_handle).await;
            });

            #[cfg(all(desktop))]
            {
                let handle = app.handle();
                tray::create_tray(handle)?;
            }

            // Blocks the app from populating the macOS dock
            #[cfg(target_os = "macos")]
            {
                app_handle
                    .set_activation_policy(tauri::ActivationPolicy::Accessory)
                    .unwrap();
            };

            let app_handle_ref = app_handle.clone();

            app_handle.listen("registration_received", move |_| {
                WebviewWindowBuilder::from_config(
                    &app_handle_ref,
                    &app_handle_ref.config().app.windows[0],
                )
                .unwrap()
                .build()
                .unwrap()
                .show()
                .unwrap();
            });

            Ok(())
        })
        .manage(cancellation_token)
        .on_window_event(|window, event| {
            match &event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    let app_state = window.state::<Arc<AppState>>();

                    let mut current_code = app_state.active_registration_code.blocking_write();

                    if current_code.is_some() {
                        *current_code = None;
                    }
                }
                _ => {}
            };
        })
        .invoke_handler(tauri::generate_handler![get_otp])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, code, .. } => {
                if code.is_none() || matches!(code, Some(0)) {
                    api.prevent_exit()
                } else if code.is_some() {
                    let state = app_handle.state::<CancellationToken>();
                    state.cancel();
                }
            }
            _ => {}
        });
}

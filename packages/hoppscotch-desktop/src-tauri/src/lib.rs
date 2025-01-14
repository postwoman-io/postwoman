pub mod server;

use std::sync::OnceLock;

use tauri::Emitter;
use tauri_plugin_deep_link::DeepLinkExt;

static SERVER_PORT: OnceLock<u16> = OnceLock::new();

#[tauri::command]
fn hopp_auth_port() -> u16 {
    *SERVER_PORT.get().expect("Server port not initialized")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing::info!("Starting Hoppscotch Desktop v{}", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tracing::info!(app_name = %app.package_info().name, "Configuring deep link handler");

            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                tracing::info!(
                    urls = ?urls,
                    count = urls.len(),
                    "Processing deep link request"
                );
                handle
                    .emit("scheme-request-received", urls)
                    .unwrap_or_else(|e| {
                        tracing::error!(
                            error.message = %e,
                            error.type = %std::any::type_name_of_val(&e),
                            "Deep link event emission failed"
                        );
                    });
            });
            Ok(())
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let port = portpicker::pick_unused_port().expect("Cannot find unused port");
            SERVER_PORT.set(port).expect("Failed to set server port");
            let port = server::init(port, handle);
            tracing::info!(port = port, "Server initialization complete");
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_hoppscotch_appload::init())
        .plugin(tauri_plugin_hoppscotch_relay::init())
        .invoke_handler(tauri::generate_handler![hopp_auth_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

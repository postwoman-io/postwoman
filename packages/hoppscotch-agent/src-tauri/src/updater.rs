use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_dialog::MessageDialogButtons;
use tauri_plugin_dialog::MessageDialogKind;

#[cfg(feature = "portable")]
use {crate::dialog, crate::util, native_dialog::MessageType};

pub async fn check_and_install_updates(
    app: tauri::AppHandle,
    updater: tauri_plugin_updater::Updater,
) {
    let update = updater.check().await;

    if let Ok(Some(update)) = update {
        #[cfg(not(feature = "portable"))]
        {
            let do_update = app
                .dialog()
                .message(format!(
                    "Update to {} is available!{}",
                    update.version,
                    update
                        .body
                        .clone()
                        .map(|body| format!("\n\nRelease Notes: {}", body))
                        .unwrap_or("".into())
                ))
                .title("Update Available")
                .kind(MessageDialogKind::Info)
                .buttons(MessageDialogButtons::OkCancelCustom(
                    "Update".to_string(),
                    "Cancel".to_string(),
                ))
                .blocking_show();

            if do_update {
                let _ = update.download_and_install(|_, _| {}, || {}).await;

                tauri::process::restart(&app.env());
            }
        }
        #[cfg(feature = "portable")]
        {
            let download_url = "https://hoppscotch.com/download";
            let message = format!(
                "An update (version {}) is available for the Hoppscotch Agent.\n\nPlease download the latest portable version from our website.",
                update.version
            );

            dialog::info(&message);

            if dialog::confirm(
                "Open Download Page",
                "Would you like to open the download page in your browser?",
                MessageType::Info,
            ) {
                if let None = util::open_link(download_url) {
                    dialog::error(&format!(
                        "Failed to open download page. Please visit {}",
                        download_url
                    ));
                }
            }
        }
    }
}

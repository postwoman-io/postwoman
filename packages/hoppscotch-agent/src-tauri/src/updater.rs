#[cfg(desktop)]
pub async fn check_and_install_updates(app: tauri::AppHandle, updater: tauri_plugin_updater::Updater) {
  use tauri::Manager;
  use tauri_plugin_dialog::MessageDialogKind;
  use tauri_plugin_dialog::DialogExt;


  let update = updater.check().await;

  if let Ok(Some(update)) = update {
      let do_update = app.dialog()
        .message(
          format!(
              "Update to {} is available!{}",
              update.version,
              update.body
                .clone()
                .map(|body| format!("\n\nRelease Notes: {}", body))
                .unwrap_or("".into())
          )
        )
        .title("Update Available")
        .kind(MessageDialogKind::Info)
        .ok_button_label("Update")
        .cancel_button_label("Cancel")
        .blocking_show();

      if do_update {
          let _ = update.download_and_install(|_, _| {}, || {}).await;

          tauri::process::restart(&app.env());
      }
  }
}

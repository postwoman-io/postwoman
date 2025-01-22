use native_dialog::{MessageDialog, MessageType};

pub fn panic(msg: &str) {
    const FATAL_ERROR: &str = "Fatal error";

    MessageDialog::new()
        .set_type(MessageType::Error)
        .set_title(FATAL_ERROR)
        .set_text(msg)
        .show_alert()
        .unwrap_or_default();

    log::error!("{}: {}", FATAL_ERROR, msg);

    panic!("{}: {}", FATAL_ERROR, msg);
}

pub fn info(msg: &str) {
    log::info!("{}", msg);

    MessageDialog::new()
        .set_type(MessageType::Info)
        .set_title("Info")
        .set_text(msg)
        .show_alert()
        .unwrap_or_default();
}

pub fn warn(msg: &str) {
    log::warn!("{}", msg);

    MessageDialog::new()
        .set_type(MessageType::Warning)
        .set_title("Warning")
        .set_text(msg)
        .show_alert()
        .unwrap_or_default();
}

pub fn error(msg: &str) {
    log::error!("{}", msg);

    MessageDialog::new()
        .set_type(MessageType::Error)
        .set_title("Error")
        .set_text(msg)
        .show_alert()
        .unwrap_or_default();
}

pub fn confirm(title: &str, msg: &str, icon: MessageType) -> bool {
    MessageDialog::new()
        .set_type(icon)
        .set_title(title)
        .set_text(msg)
        .show_confirm()
        .unwrap_or_default()
}

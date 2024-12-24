use serde::{Deserialize, Serialize};
use url::Url;

/// Options for downloading an app bundle
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadOptions {
    /// URL from which to download the app bundle
    pub url: Url,
    /// Optional name to save the bundle as
    pub name: Option<String>,
}

/// Response for download operation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResponse {
    /// Whether the download was successful
    pub success: bool,
    /// Path where the bundle was saved
    pub path: String,
}

/// Options for loading an app
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadOptions {
    /// Name of the app to load
    pub name: String,
    /// Whether to load in current window
    #[serde(default)]
    pub inline: bool,
    /// Window configuration
    #[serde(default)]
    pub window: WindowOptions,
}

/// Response for load operation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResponse {
    /// Whether the app was loaded successfully
    pub success: bool,
    /// Label of the created window
    pub window_label: String,
}

/// Window configuration options
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowOptions {
    /// Window title
    #[serde(default = "default_window_title")]
    pub title: String,
    /// Initial window width
    #[serde(default = "default_window_width")]
    pub width: f64,
    /// Initial window height
    #[serde(default = "default_window_height")]
    pub height: f64,
    /// Whether window should be resizable
    #[serde(default = "default_resizable")]
    pub resizable: bool,
}

fn default_window_title() -> String {
    "Hoppscotch".into()
}

fn default_window_width() -> f64 {
    800.0
}

fn default_window_height() -> f64 {
    600.0
}

fn default_resizable() -> bool {
    true
}

impl Default for WindowOptions {
    fn default() -> Self {
        Self {
            title: default_window_title(),
            width: default_window_width(),
            height: default_window_height(),
            resizable: default_resizable(),
        }
    }
}

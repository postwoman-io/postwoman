/// The WebView2 Runtime is a critical dependency for Tauri applications on Windows.
/// We need to check for its presence, see [Source: GitHub Issue #59 - Portable windows build](https://github.com/tauri-apps/tauri-action/issues/59#issuecomment-827142638)
///
/// > "Tauri requires an installer if you define app resources, external binaries or running on environments that do not have Webview2 runtime installed. So I don't think it's a good idea to have a "portable" option since a Tauri binary itself isn't 100% portable."
///
/// The approach for checking WebView2 installation is based on Microsoft's official documentation, which states:
///
/// > ###### Detect if a WebView2 Runtime is already installed
/// >
/// > To verify that a WebView2 Runtime is installed, use one of the following approaches:
/// >
/// >    *  Approach 1: Inspect the `pv (REG_SZ)` regkey for the WebView2 Runtime at both of the following registry locations.  The `HKEY_LOCAL_MACHINE` regkey is used for _per-machine_ install.  The `HKEY_CURRENT_USER` regkey is used for _per-user_ install.
/// >
/// >       For WebView2 applications, at least one of these regkeys must be present and defined with a version greater than 0.0.0.0.  If neither regkey exists, or if only one of these regkeys exists but its value is `null`, an empty string, or 0.0.0.0, this means that the WebView2 Runtime isn't installed on the client.  Inspect these regkeys to detect whether the WebView2 Runtime is installed, and to get the version of the WebView2 Runtime.  Find `pv (REG_SZ)` at the following two locations.
/// >
/// >       The two registry locations to inspect on 64-bit Windows:
/// >
/// >       ```
/// >       HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
/// >
/// >       HKEY_CURRENT_USER\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
/// >       ```
/// >
/// >       The two registry locations to inspect on 32-bit Windows:
/// >
/// >       ```
/// >       HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
/// >
/// >       HKEY_CURRENT_USER\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
/// >       ```
/// >
/// >    *  Approach 2: Run [GetAvailableCoreWebView2BrowserVersionString](/microsoft-edge/webview2/reference/win32/webview2-idl#getavailablecorewebview2browserversionstring) and evaluate whether the `versionInfo` is `nullptr`.  `nullptr` indicates that the WebView2 Runtime isn't installed.  This API returns version information for the WebView2 Runtime or for any installed preview channels of Microsoft Edge (Beta, Dev, or Canary).
///
/// See: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution?tabs=dotnetcsharp#detect-if-a-webview2-runtime-is-already-installed
///
/// Our implementation uses Approach 1, checking both the 32-bit (WOW6432Node) and 64-bit registry locations
/// to make sure we have critical dependencis compatibility with different system architectures.
pub mod error;

use std::{io, ops::Not};

use native_dialog::MessageType;

use crate::{dialog, util};
use error::WebViewError;

#[cfg(windows)]
use {
    std::io::Cursor,
    std::process::Command,
    tauri_plugin_http::reqwest,
    tempfile::TempDir,
    winreg::{
        enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
        RegKey,
    },
};

const TAURI_WEBVIEW_REF: &str = "https://v2.tauri.app/references/webview-versions/";
const WINDOWS_WEBVIEW_REF: &str =
    "https://developer.microsoft.com/microsoft-edge/webview2/#download-section";

fn is_available() -> bool {
    #[cfg(windows)]
    {
        const KEY_WOW64: &str = r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        const KEY: &str =
            r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        [
            hklm.open_subkey(KEY_WOW64),
            hkcu.open_subkey(KEY_WOW64),
            hklm.open_subkey(KEY),
            hkcu.open_subkey(KEY),
        ]
        .into_iter()
        .any(|result| result.is_ok())
    }

    #[cfg(not(windows))]
    {
        true
    }
}

fn open_install_website() -> Result<(), WebViewError> {
    let url = if cfg!(windows) {
        WINDOWS_WEBVIEW_REF
    } else {
        TAURI_WEBVIEW_REF
    };

    util::open_link(url).map(|_| ()).ok_or_else(|| {
        WebViewError::UrlOpen(io::Error::new(
            io::ErrorKind::Other,
            "Failed to open browser to WebView download section",
        ))
    })
}

#[cfg(windows)]
async fn install() -> Result<(), WebViewError> {
    const WEBVIEW2_BOOTSTRAPPER_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
    const DEFAULT_FILENAME: &str = "MicrosoftEdgeWebview2Setup.exe";

    let client = reqwest::Client::builder()
        .user_agent("Hoppscotch Agent")
        .gzip(true)
        .build()?;

    let response = client.get(WEBVIEW2_BOOTSTRAPPER_URL).send().await?;

    if !response.status().is_success() {
        return Err(WebViewError::Download(format!(
            "Failed to download WebView2 bootstrapper. Status: {}",
            response.status()
        )));
    }

    let filename =
        get_filename_from_response(&response).unwrap_or_else(|| DEFAULT_FILENAME.to_owned());

    let tmp_dir = TempDir::with_prefix("WebView-setup-")?;
    let installer_path = tmp_dir.path().join(filename);

    let content = response.bytes().await?;
    {
        let mut file = std::fs::File::create(&installer_path)?;
        io::copy(&mut Cursor::new(content), &mut file)?;
    }

    let status = Command::new(&installer_path).args(["/install"]).status()?;

    if !status.success() {
        return Err(WebViewError::Installation(format!(
            "Installer exited with code `{}`.",
            status.code().unwrap_or(-1)
        )));
    }

    Ok(())
}

#[cfg(windows)]
fn get_filename_from_response(response: &reqwest::Response) -> Option<String> {
    response
        .headers()
        .get("content-disposition")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split("filename=").last())
        .map(|name| name.trim().replace('\"', ""))
        .or_else(|| {
            response
                .url()
                .path_segments()
                .and_then(|segments| segments.last())
                .map(|name| name.to_string())
        })
        .filter(|name| !name.is_empty())
}

#[cfg(not(windows))]
async fn install() -> Result<(), WebViewError> {
    Err(WebViewError::Installation(
        "Unable to auto-install WebView. Please refer to https://v2.tauri.app/references/webview-versions/".to_string(),
    ))
}

pub fn init_webview() {
    if is_available() {
        return;
    }

    if dialog::confirm(
        "WebView Error",
        "WebView is required for this application to work.\n\n\
         Do you want to install it?",
        MessageType::Error,
    )
    .not()
    {
        log::warn!("Declined to setup WebView.");

        std::process::exit(1);
    }

    if let Err(e) = tauri::async_runtime::block_on(install()) {
        dialog::error(&format!(
            "Failed to install WebView: {}\n\n\
             Please install it manually from webpage that should open when you click 'Ok'.\n\n\
             If that doesn't work, please visit Microsoft Edge Webview2 download section.",
            e
        ));

        if let Err(e) = open_install_website() {
            log::warn!("Failed to launch WebView website:\n{}", e);
        }

        std::process::exit(1);
    }

    if is_available().not() {
        dialog::panic(
            "Unable to setup WebView:\n\n\
             Please install it manually and relaunch the application.\n\
             https://developer.microsoft.com/microsoft-edge/webview2/#download-section",
        );
    }
}

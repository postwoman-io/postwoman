use std::{ffi::c_void, mem::size_of, mem::transmute, ptr};

use hex_color::HexColor;
use tauri::{Listener, Runtime, WebviewWindow};
use windows::Win32::{
    Foundation::{BOOL, COLORREF, HWND},
    Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_USE_IMMERSIVE_DARK_MODE},
    UI::Controls::{
        SetWindowThemeAttribute, WTA_NONCLIENT, WTNCA_NODRAWCAPTION, WTNCA_NODRAWICON,
        WTNCA_NOMIRRORHELP, WTNCA_NOSYSMENU,
    },
};
use winver::WindowsVersion;

#[derive(Debug)]
pub struct WindowsWindow<R: Runtime> {
    window: WebviewWindow<R>,
    hwnd: HWND,
}

impl<R: Runtime> WindowsWindow<R> {
    pub fn new(window: WebviewWindow<R>) -> Self {
        let hwnd = window.hwnd().expect("Failed to get window handle");
        let hwnd = HWND(hwnd.0);
        Self { window, hwnd }
    }

    pub fn setup(&self) {
        self.update_theme(HexColor::rgb(23, 23, 23));
        self.setup_theme_listener();
    }

    pub fn update_theme(&self, color: HexColor) {
        self.set_dark_mode();
        self.set_caption_color(color);
        self.set_theme_attributes();
    }

    fn setup_theme_listener(&self) {
        let window = self.window.clone();
        self.window.listen("hopp-bg-changed", move |event| {
            let color_str = event.payload();

            if let Ok(color_str) = serde_json::from_str::<&str>(color_str) {
                if let Ok(color) = HexColor::parse_rgb(color_str.trim()) {
                    let windows_window = WindowsWindow::new(window.clone());
                    windows_window.update_theme(color);
                }
            }
        });
    }

    fn set_dark_mode(&self) {
        unsafe {
            let use_dark_mode = BOOL::from(true);
            DwmSetWindowAttribute(
                self.hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                ptr::addr_of!(use_dark_mode) as *const c_void,
                size_of::<BOOL>().try_into().unwrap(),
            )
            .expect("Failed to set dark mode");
        }
    }

    fn set_caption_color(&self, color: HexColor) {
        if let Some(version) = WindowsVersion::detect() {
            if version >= WindowsVersion::new(10, 0, 22000) {
                unsafe {
                    let color_ref = self.hex_color_to_colorref(color);
                    DwmSetWindowAttribute(
                        self.hwnd,
                        DWMWA_CAPTION_COLOR,
                        ptr::addr_of!(color_ref) as *const c_void,
                        size_of::<COLORREF>().try_into().unwrap(),
                    )
                    .expect("Failed to set caption color");
                }
            }
        }
    }

    fn set_theme_attributes(&self) {
        unsafe {
            let theme_attributes = WinThemeAttribute::new();
            SetWindowThemeAttribute(
                self.hwnd,
                WTA_NONCLIENT,
                ptr::addr_of!(theme_attributes) as *const c_void,
                size_of::<WinThemeAttribute>().try_into().unwrap(),
            )
            .expect("Failed to set theme attributes");
        }
    }

    fn hex_color_to_colorref(&self, color: HexColor) -> COLORREF {
        unsafe { COLORREF(transmute::<[u8; 4], u32>([color.r, color.g, color.b, 0])) }
    }
}

#[derive(Debug)]
struct WinThemeAttribute {
    flag: u32,
    mask: u32,
}

impl WinThemeAttribute {
    fn new() -> Self {
        let flag = WTNCA_NODRAWCAPTION | WTNCA_NODRAWICON;
        let mask = WTNCA_NODRAWCAPTION | WTNCA_NODRAWICON | WTNCA_NOSYSMENU | WTNCA_NOMIRRORHELP;
        Self { flag, mask }
    }
}

pub fn setup_window<R: Runtime>(window: WebviewWindow<R>) {
    let windows_window = WindowsWindow::new(window);
    windows_window.setup();
}

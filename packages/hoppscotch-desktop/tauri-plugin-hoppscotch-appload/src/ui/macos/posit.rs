use cocoa::{
    appkit::{
        NSAppearance, NSAppearanceNameVibrantDark, NSAppearanceNameVibrantLight, NSView, NSWindow,
        NSWindowButton, NSWindowTitleVisibility,
    },
    base::{id, nil, BOOL, YES},
    delegate,
    foundation::{NSRect, NSUInteger},
};
use hex_color::HexColor;
use objc::{
    msg_send,
    runtime::{Object, Sel},
    sel, sel_impl,
};
use rand::distributions::{Alphanumeric, DistString};
use tauri::{Emitter, Listener, LogicalPosition, Runtime, WebviewWindow};

#[derive(Debug)]
pub struct MacosWindow<R: Runtime> {
    window: WebviewWindow<R>,
    traffic_lights_inset: LogicalPosition<f64>,
    ns_window: id,
}

impl<R: Runtime> MacosWindow<R> {
    pub fn new(window: WebviewWindow<R>, traffic_lights_inset: LogicalPosition<f64>) -> Self {
        let ns_window = window.ns_window().expect("Failed to get NS window handle") as id;
        unsafe {
            ns_window.setTitlebarAppearsTransparent_(YES);
            ns_window.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
        }
        Self {
            window,
            traffic_lights_inset,
            ns_window,
        }
    }

    pub fn setup(&self) {
        self.reposition_controls();
        self.setup_theme_listener();
        unsafe {
            let delegate = self.create_window_delegate();
            self.ns_window.setDelegate_(delegate);
        }
    }

    pub fn update_theme(&self, color: HexColor) {
        let brightness = (color.r as u64 + color.g as u64 + color.b as u64) / 3;
        unsafe {
            let window_handle = self.ns_window;
            let appearance = if brightness >= 128 {
                NSAppearance(NSAppearanceNameVibrantLight)
            } else {
                NSAppearance(NSAppearanceNameVibrantDark)
            };
            NSWindow::setAppearance(window_handle, appearance);
            self.reposition_controls();
        }
    }

    fn setup_theme_listener(&self) {
        let window = self.window.clone();
        self.window.listen("hopp-bg-changed", move |event| {
            let color_str = event.payload();

            if let Ok(color_str) = serde_json::from_str::<&str>(color_str) {
                if let Ok(color) = HexColor::parse_rgb(color_str.trim()) {
                    let macos_window =
                        MacosWindow::new(window.clone(), LogicalPosition::new(15.0, 23.0));
                    macos_window.update_theme(color);
                }
            }
        });
    }

    fn reposition_controls(&self) {
        unsafe {
            let buttons = self.window_buttons();
            let title_bar = buttons.title_bar_container();

            let frame_height = buttons.height() + self.traffic_lights_inset.y;
            title_bar.adjust_frame(frame_height, self.window_height());

            buttons.reposition(self.traffic_lights_inset.x);
        }
    }

    unsafe fn create_window_delegate(&self) -> id {
        let current_delegate = self.ns_window.delegate();
        let state = Box::new(WindowState::new(
            self.window.clone(),
            self.traffic_lights_inset,
        ));
        let app_box = Box::into_raw(state) as *mut std::ffi::c_void;

        let delegate_name = format!(
            "WindowDelegate_{}_{}",
            self.window.label(),
            Alphanumeric.sample_string(&mut rand::thread_rng(), 20)
        );

        delegate!(&delegate_name, {
            window: id = self.ns_window,
            app_box: *mut std::ffi::c_void = app_box,
            toolbar: id = nil,
            super_delegate: id = current_delegate,

            (windowShouldClose:) => WindowDelegate::window_should_close as extern fn(&Object, Sel, id) -> BOOL,
            (windowWillClose:) => WindowDelegate::window_will_close as extern fn(&Object, Sel, id),
            (windowDidResize:) => WindowDelegate::window_did_resize::<R> as extern fn(&Object, Sel, id),
            (windowDidMove:) => WindowDelegate::window_did_move as extern fn(&Object, Sel, id),

            (windowDidChangeBackingProperties:) => WindowDelegate::window_did_change_backing_properties as extern fn(&Object, Sel, id),

            (windowDidBecomeKey:) => WindowDelegate::window_did_become_key as extern fn(&Object, Sel, id),
            (windowDidResignKey:) => WindowDelegate::window_did_resign_key as extern fn(&Object, Sel, id),

            (draggingEntered:) => WindowDelegate::dragging_entered as extern fn(&Object, Sel, id) -> BOOL,
            (prepareForDragOperation:) => WindowDelegate::prepare_for_drag_operation as extern fn(&Object, Sel, id) -> BOOL,
            (performDragOperation:) => WindowDelegate::perform_drag_operation as extern fn(&Object, Sel, id) -> BOOL,
            (concludeDragOperation:) => WindowDelegate::conclude_drag_operation as extern fn(&Object, Sel, id),
            (draggingExited:) => WindowDelegate::dragging_exited as extern fn(&Object, Sel, id),

            (window:willUseFullScreenPresentationOptions:) => WindowDelegate::window_will_use_full_screen_presentation_options as extern fn(&Object, Sel, id, NSUInteger) -> NSUInteger,
            (windowDidEnterFullScreen:) => WindowDelegate::window_did_enter_full_screen::<R> as extern fn(&Object, Sel, id),
            (windowWillEnterFullScreen:) => WindowDelegate::window_will_enter_full_screen::<R> as extern fn(&Object, Sel, id),
            (windowDidExitFullScreen:) => WindowDelegate::window_did_exit_full_screen::<R> as extern fn(&Object, Sel, id),
            (windowDidEndLiveResize:) => WindowDelegate::window_did_end_live_resize::<R> as extern fn(&Object, Sel, id),
            (windowWillExitFullScreen:) => WindowDelegate::window_will_exit_full_screen::<R> as extern fn(&Object, Sel, id),
            (windowDidFailToEnterFullScreen:) => WindowDelegate::window_did_fail_to_enter_full_screen as extern fn(&Object, Sel, id),

            (effectiveAppearanceDidChange:) => WindowDelegate::effective_appearance_did_change as extern fn(&Object, Sel, id),
            (effectiveAppearanceDidChangedOnMainThread:) => WindowDelegate::effective_appearance_did_change_on_main_thread as extern fn(&Object, Sel, id)
        })
    }

    unsafe fn window_height(&self) -> f64 {
        NSView::frame(self.ns_window).size.height
    }

    unsafe fn window_buttons(&self) -> WindowButtons {
        WindowButtons::new(self.ns_window)
    }
}

#[derive(Debug)]
struct WindowButtons {
    close: id,
    minimize: id,
    zoom: id,
}

impl WindowButtons {
    unsafe fn new(window: id) -> Self {
        Self {
            close: window.standardWindowButton_(NSWindowButton::NSWindowCloseButton),
            minimize: window.standardWindowButton_(NSWindowButton::NSWindowMiniaturizeButton),
            zoom: window.standardWindowButton_(NSWindowButton::NSWindowZoomButton),
        }
    }

    unsafe fn height(&self) -> f64 {
        let close_frame: NSRect = msg_send![self.close, frame];
        close_frame.size.height
    }

    unsafe fn title_bar_container(&self) -> TitleBarContainer {
        TitleBarContainer(self.close.superview().superview())
    }

    unsafe fn button_spacing(&self) -> f64 {
        NSView::frame(self.minimize).origin.x - NSView::frame(self.close).origin.x
    }

    unsafe fn reposition(&self, inset_x: f64) {
        let spacing = self.button_spacing();
        for (i, button) in [self.close, self.minimize, self.zoom].iter().enumerate() {
            let mut frame = NSView::frame(*button);
            frame.origin.x = inset_x + (i as f64 * spacing);
            frame.origin.y = 0.0;
            button.setFrameOrigin(frame.origin);
        }
    }
}

struct TitleBarContainer(id);

impl TitleBarContainer {
    unsafe fn adjust_frame(&self, height: f64, window_height: f64) {
        let mut frame = NSView::frame(self.0);
        frame.size.height = height;
        frame.origin.y = window_height - height;
        frame.origin.x = 0.0;
        let _: () = msg_send![self.0, setFrame: frame];
    }
}

#[derive(Debug)]
struct WindowState<R: Runtime> {
    window: WebviewWindow<R>,
    traffic_lights_inset: LogicalPosition<f64>,
}

impl<R: Runtime> WindowState<R> {
    fn new(window: WebviewWindow<R>, traffic_lights_inset: LogicalPosition<f64>) -> Self {
        Self {
            window,
            traffic_lights_inset,
        }
    }
}

struct WindowDelegate;

impl WindowDelegate {
    extern "C" fn window_should_close(this: &Object, _: Sel, sender: id) -> BOOL {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            msg_send![super_del, windowShouldClose: sender]
        }
    }

    extern "C" fn window_will_close(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowWillClose: notification];
        }
    }

    extern "C" fn window_did_resize<R: Runtime>(this: &Object, _: Sel, notification: id) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let macos_window =
                    MacosWindow::new(state.window.clone(), state.traffic_lights_inset);
                macos_window.reposition_controls();
            });

            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidResize: notification];
        }
    }

    extern "C" fn window_did_move(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidMove: notification];
        }
    }

    extern "C" fn window_did_change_backing_properties(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidChangeBackingProperties: notification];
        }
    }

    extern "C" fn window_did_become_key(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidBecomeKey: notification];
        }
    }

    extern "C" fn window_did_resign_key(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidResignKey: notification];
        }
    }

    extern "C" fn dragging_entered(this: &Object, _: Sel, notification: id) -> BOOL {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            msg_send![super_del, draggingEntered: notification]
        }
    }

    extern "C" fn prepare_for_drag_operation(this: &Object, _: Sel, notification: id) -> BOOL {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            msg_send![super_del, prepareForDragOperation: notification]
        }
    }

    extern "C" fn perform_drag_operation(this: &Object, _: Sel, sender: id) -> BOOL {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            msg_send![super_del, performDragOperation: sender]
        }
    }

    extern "C" fn conclude_drag_operation(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, concludeDragOperation: notification];
        }
    }

    extern "C" fn dragging_exited(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, draggingExited: notification];
        }
    }

    extern "C" fn window_will_use_full_screen_presentation_options(
        this: &Object,
        _: Sel,
        window: id,
        proposed_options: NSUInteger,
    ) -> NSUInteger {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            msg_send![super_del, window: window willUseFullScreenPresentationOptions: proposed_options]
        }
    }

    extern "C" fn window_did_enter_full_screen<R: Runtime>(
        this: &Object,
        _: Sel,
        notification: id,
    ) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let _ = state.window.emit("did-enter-fullscreen", ());
            });

            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidEnterFullScreen: notification];
        }
    }

    extern "C" fn window_will_enter_full_screen<R: Runtime>(
        this: &Object,
        _: Sel,
        notification: id,
    ) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let _ = state.window.emit("will-enter-fullscreen", ());
            });

            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowWillEnterFullScreen: notification];
        }
    }

    extern "C" fn window_did_end_live_resize<R: Runtime>(this: &Object, _: Sel, _: id) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let macos_window =
                    MacosWindow::new(state.window.clone(), state.traffic_lights_inset);
                macos_window.reposition_controls();
            });
        }
    }

    extern "C" fn window_did_exit_full_screen<R: Runtime>(this: &Object, _: Sel, notification: id) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let _ = state.window.emit("did-exit-fullscreen", ());
                let macos_window =
                    MacosWindow::new(state.window.clone(), state.traffic_lights_inset);
                macos_window.reposition_controls();
            });

            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidExitFullScreen: notification];
        }
    }

    extern "C" fn window_will_exit_full_screen<R: Runtime>(
        this: &Object,
        _: Sel,
        notification: id,
    ) {
        unsafe {
            Self::with_window_state::<R, _>(this, |state| {
                let _ = state.window.emit("will-exit-fullscreen", ());
            });

            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowWillExitFullScreen: notification];
        }
    }

    extern "C" fn window_did_fail_to_enter_full_screen(this: &Object, _: Sel, window: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, windowDidFailToEnterFullScreen: window];
        }
    }

    extern "C" fn effective_appearance_did_change(this: &Object, _: Sel, notification: id) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () = msg_send![super_del, effectiveAppearanceDidChange: notification];
        }
    }

    extern "C" fn effective_appearance_did_change_on_main_thread(
        this: &Object,
        _: Sel,
        notification: id,
    ) {
        unsafe {
            let super_del: id = *this.get_ivar("super_delegate");
            let _: () =
                msg_send![super_del, effectiveAppearanceDidChangedOnMainThread: notification];
        }
    }

    unsafe fn with_window_state<R: Runtime, F>(this: &Object, f: F)
    where
        F: FnOnce(&mut WindowState<R>),
    {
        let ptr: *mut std::ffi::c_void = *this.get_ivar("app_box");
        let state_ptr = ptr as *mut WindowState<R>;
        f(&mut *state_ptr);
    }
}

pub fn setup_window<R: Runtime>(window: WebviewWindow<R>) {
    let macos_window = MacosWindow::new(window, LogicalPosition::new(15.0, 16.0));
    macos_window.setup();
    macos_window.update_theme(HexColor::WHITE);
}

// src-tauri/src/lib.rs — the whole native side of Periodic Table.
//
// Deliberately tiny, same philosophy as Latex-Floater's copy of this file:
// the window itself is declared in tauri.conf.json, its size and position
// are remembered by the window-state plugin, and the renderer talks to this
// file through exactly one command (set_opacity). Everything else — theme,
// pin state, viewed elements, battle-pass XP — lives in the renderer's
// localStorage, because nothing native needs to know about it. Unlike
// Latex-Floater there's no clipboard command (nothing here gets exported)
// and no global hotkey (this isn't meant to be instantly summoned like a
// floater).

use tauri::{LogicalSize, Manager, WebviewWindow};

// Must match minWidth/minHeight (and the default width/height) in
// tauri.conf.json.
const MIN_WIDTH: f64 = 700.0;
const MIN_HEIGHT: f64 = 500.0;

// Whole-window opacity. Neither tauri nor tao exposes this, and doing it in
// CSS would need a transparent window (which costs the native shadow and
// resize borders on Windows), so it goes straight to the OS. Both platforms
// insist that window attributes are touched from the main thread, and Tauri
// runs commands on a worker thread, hence run_on_main_thread.
#[tauri::command]
fn set_opacity(window: WebviewWindow, value: f64) -> Result<(), String> {
    let value = value.clamp(0.2, 1.0);
    let target = window.clone();
    window
        .run_on_main_thread(move || apply_opacity(&target, value))
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn apply_opacity(window: &WebviewWindow, value: f64) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA,
        WS_EX_LAYERED,
    };
    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = hwnd.0 as _;
    // A layered window is composited differently, so only be one while
    // actually translucent; at full opacity go back to a normal window.
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        if value >= 1.0 {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex & !(WS_EX_LAYERED as isize));
        } else {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED as isize);
            SetLayeredWindowAttributes(hwnd, 0, (value * 255.0).round() as u8, LWA_ALPHA);
        }
    }
}

#[cfg(target_os = "macos")]
fn apply_opacity(window: &WebviewWindow, value: f64) {
    use objc2_app_kit::NSWindow;
    let Ok(ns_window) = window.ns_window() else { return };
    // ns_window() hands back the NSWindow* tao owns; we only borrow it for
    // one property write on the main thread, which is exactly what AppKit
    // permits.
    unsafe {
        let ns_window: &NSWindow = &*(ns_window as *const NSWindow);
        ns_window.setAlphaValue(value);
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
fn apply_opacity(_window: &WebviewWindow, _value: f64) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Remembers the main window's size and position across launches in
        // the app's data directory, and clamps them to a visible monitor on
        // restore.
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            // tauri-plugin-window-state has already restored the saved size
            // by this point, but it restores whatever was saved with no
            // regard for minWidth/minHeight in tauri.conf.json — normally a
            // non-issue, since the OS enforces that minimum during an
            // interactive drag-resize, but at least PowerToys' Grab and Move
            // resizes windows through an API that bypasses that check
            // entirely (found and fixed in Latex-Floater; carried over here
            // preemptively), and a size that small can then get saved and
            // keep coming back on every future launch. Clamp each dimension
            // up to the minimum independently (so an otherwise-fine 900x300
            // becomes 900x500, not 700x500) before the window is ever shown
            // — it's created with "visible": false in tauri.conf.json
            // specifically so this can run first, with no flash of the
            // wrong size.
            if let Some(window) = app.get_webview_window("main") {
                if let (Ok(scale), Ok(size)) = (window.scale_factor(), window.inner_size()) {
                    let logical = size.to_logical::<f64>(scale);
                    let width = logical.width.max(MIN_WIDTH);
                    let height = logical.height.max(MIN_HEIGHT);
                    if width > logical.width || height > logical.height {
                        let _ = window.set_size(LogicalSize::new(width, height));
                    }
                }
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_opacity])
        .run(tauri::generate_context!())
        .expect("error while running Periodic Table");
}

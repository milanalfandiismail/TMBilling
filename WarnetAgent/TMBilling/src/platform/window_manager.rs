use gpui_kit::Window;
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, GWL_STYLE, SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE,
    SWP_NOZORDER, WS_BORDER, WS_CAPTION, WS_THICKFRAME, SetForegroundWindow, BringWindowToTop,
    FindWindowW, GetWindowRect, SetWindowPos, ShowWindow, HWND_TOPMOST, SW_HIDE,
    SW_SHOW, SWP_NOACTIVATE, SWP_NOOWNERZORDER,
};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Secondary monitors get their own taskbar window, so hide every one of them.
pub fn set_taskbar_visibility(visible: bool) {
    let cmd = if visible { SW_SHOW } else { SW_HIDE };
    for class in ["Shell_TrayWnd", "Shell_SecondaryTrayWnd", "TrayButton"] {
        let name = wide(class);
        if let Ok(h) = unsafe { FindWindowW(PCWSTR(name.as_ptr()), PCWSTR::null()) } {
            unsafe {
                let _ = ShowWindow(h, cmd);
            }
        }
    }
}

pub fn hwnd(window: &Window) -> Option<HWND> {
    // inherent Window::window_handle() returns gpui's own handle, so call the trait explicitly
    match HasWindowHandle::window_handle(window).ok()?.as_raw() {
        RawWindowHandle::Win32(h) => Some(HWND(h.hwnd.get() as *mut core::ffi::c_void)),
        _ => None,
    }
}

/// Drops the resize frame so the client area equals the window rect; otherwise an
/// invisible 8px border shows up as a gap around the kiosk and overlay surfaces.
pub fn strip_frame(h: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(h, GWL_STYLE) as u32;
        let trimmed = style & !(WS_CAPTION.0 | WS_THICKFRAME.0 | WS_BORDER.0);
        if trimmed != style {
            SetWindowLongPtrW(h, GWL_STYLE, trimmed as isize);
            let _ = SetWindowPos(
                h,
                None,
                0,
                0,
                0,
                0,
                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
            );
        }
    }
}

pub fn window_rect(h: HWND) -> Option<RECT> {
    let mut rect = RECT::default();
    match unsafe { GetWindowRect(h, &mut rect) } {
        Ok(()) => Some(rect),
        Err(_) => None,
    }
}

pub fn monitor_rect(h: HWND) -> Option<RECT> {
    unsafe {
        let monitor = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(monitor, &mut info).as_bool() {
            Some(info.rcMonitor)
        } else {
            None
        }
    }
}

pub fn focus(h: HWND) {
    unsafe {
        let _ = SetForegroundWindow(h);
        let _ = BringWindowToTop(h);
    }
}

/// Pindahkan tanpa mengubah ukuran (ukuran diurus gpui lewat Window::resize).
pub fn move_to(h: HWND, x: i32, y: i32) {
    unsafe {
        let _ = SetWindowPos(
            h,
            Some(HWND_TOPMOST),
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        );
    }
}

/// Release the desktop from kiosk mode even if the process is killed by a panic.
pub struct TaskbarGuard;

impl Drop for TaskbarGuard {
    fn drop(&mut self) {
        set_taskbar_visibility(true);
    }
}

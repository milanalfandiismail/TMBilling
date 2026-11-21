use gpui_kit::Window;
use std::sync::atomic::{AtomicIsize, Ordering};
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


/// Tinggi kartu overlay dalam koordinat klien. Area di bawahnya transparan dan
/// harus meneruskan klik ke desktop, bukan menahannya.

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

pub fn handle(raw: isize) -> HWND {
    HWND(raw as *mut core::ffi::c_void)
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

/// `ResizeBuffers` tidak langsung dipakai DWM; tanpa ini jendela menampilkan
/// isi lama sampai ada aktivasi (Alt+Tab), terutama di VM/WARP.
/// Diagnostik VM: jejak geometri ke %TEMP%\tmbilling-ui.log bila TM_UI_LOG=1.
pub fn trace(msg: impl AsRef<str>) {
    use std::io::Write;
    use std::sync::OnceLock;
    static START: OnceLock<std::time::Instant> = OnceLock::new();
    if std::env::var_os("TM_UI_LOG").is_none() {
        return;
    }
    let start = START.get_or_init(std::time::Instant::now);
    let path = std::env::temp_dir().join("tmbilling-ui.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(f, "[{:>6}ms] {}", start.elapsed().as_millis(), msg.as_ref());
    }
}

pub fn flush() {
    unsafe {
        let _ = windows::Win32::Graphics::Dwm::DwmFlush();
    }
}

pub fn focus(h: HWND) {
    unsafe {
        let _ = SetForegroundWindow(h);
        let _ = BringWindowToTop(h);
    }
}

/// Pindahkan dan ubah ukuran dalam satu SetWindowPos supaya tidak ada frame
/// di mana jendela sudah pindah tapi masih kecil (resize gpui berjalan async).
pub fn place(h: HWND, left: i32, top: i32, width: i32, height: i32) {
    unsafe {
        let _ = SetWindowPos(
            h,
            Some(HWND_TOPMOST),
            left,
            top,
            width,
            height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        );
    }
}

/// Sembunyikan window selama transisi geometri; gpui masih melukis viewport lama
/// beberapa frame setelah SetWindowPos, jadi frame itu tidak boleh terlihat.
pub fn hide(h: HWND) {
    unsafe {
        let _ = ShowWindow(h, SW_HIDE);
    }
}

/// Tampilkan lagi setelah viewport gpui sudah sama dengan ukuran window baru.
pub fn reveal(h: HWND) {
    unsafe {
        let _ = ShowWindow(h, SW_SHOW);
        let _ = SetWindowPos(
            h,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        );
        let _ = SetForegroundWindow(h);
        let _ = BringWindowToTop(h);
    }
}

/// Window yang sedang disembunyikan ke tray; 0 bila tidak ada.
static MINIMIZED: AtomicIsize = AtomicIsize::new(0);

/// Minimize overlay: sembunyikan dari taskbar, sisakan ikon tray.
pub fn minimize_to_tray(h: HWND) {
    MINIMIZED.store(h.0 as isize, Ordering::Relaxed);
    hide(h);
}
/// Kembalikan window yang disembunyikan ke tray. False bila tidak ada.
pub fn restore_from_tray() -> bool {
    let raw = MINIMIZED.swap(0, Ordering::Relaxed);
    if raw == 0 {
        return false;
    }
    reveal(handle(raw));
    true
}

/// Release the desktop from kiosk mode even if the process is killed by a panic.
pub struct TaskbarGuard;

impl Drop for TaskbarGuard {
    fn drop(&mut self) {
        set_taskbar_visibility(true);
    }
}

use windows::Win32::UI::WindowsAndMessaging::{BringWindowToTop, SetWindowPos, HWND_NOTOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, SW_SHOW};
use single_instance::SingleInstance;
use windows::core::PWSTR;
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, GetWindowThreadProcessId, SetForegroundWindow, ShowWindow,
    SW_RESTORE,
};

/// Returns None when another instance already owns the name.
pub fn acquire(name: &str) -> Option<SingleInstance> {
    let guard = SingleInstance::new(name).ok()?;
    if guard.is_single() {
        Some(guard)
    } else {
        focus_existing();
        None
    }
}

fn exe_name_of(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len)
            .ok()?;
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.rsplit('\\').next().map(|s| s.to_string())
    }
}

struct Found(isize);

extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let found = unsafe { &mut *(lparam.0 as *mut Found) };
    unsafe {
        // Window minimize-to-tray tetap ada tapi tidak visible, jadi saring lewat
        // ukuran: window milik tray-icon berukuran 0 dan tidak boleh terpilih.
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err()
            || rect.right - rect.left < 200
            || rect.bottom - rect.top < 200
        {
            return BOOL(1);
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid != 0 && pid != std::process::id() {
            if let Some(name) = exe_name_of(pid) {
                let own = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()));
                if Some(name) == own {
                    found.0 = hwnd.0 as isize;
                    return BOOL(0);
                }
            }
        }
    }
    BOOL(1)
}

/// Brings the window of the already running instance to the front.
pub fn focus_existing() {
    if super::window_manager::restore_from_tray() {
        return;
    }
    let mut found = Found(0);
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut found as *mut Found as isize));
        if found.0 != 0 {
            let hwnd = HWND(found.0 as *mut core::ffi::c_void);
            let _ = ShowWindow(hwnd, SW_RESTORE);
            super::window_manager::reveal(hwnd);
            let _ = SetForegroundWindow(hwnd);
        }
    }
}

struct TargetFinder<'a> {
    target_exe: &'a str,
    hwnd: isize,
}

unsafe extern "system" fn enum_proc_target(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let finder = &mut *(lparam.0 as *mut TargetFinder);
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid != 0 {
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_ok()
            && rect.right - rect.left > 100
            && rect.bottom - rect.top > 100
        {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut buf = [0u16; 1024];
                let mut len = buf.len() as u32;
                let ok = QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    PWSTR(buf.as_mut_ptr()),
                    &mut len,
                )
                .is_ok();
                let _ = windows::Win32::Foundation::CloseHandle(handle);
                if ok {
                    let exe_path = String::from_utf16_lossy(&buf[..len as usize]);
                    if exe_path
                        .to_ascii_lowercase()
                        .ends_with(&finder.target_exe.to_ascii_lowercase())
                    {
                        finder.hwnd = hwnd.0 as isize;
                        return BOOL(0);
                    }
                }
            }
        }
    }
    BOOL(1)
}

/// Brings the window to the front as a normal (non-topmost) window, restoring if minimized.
pub fn activate_window(hwnd: HWND) {
    unsafe {
        let _ = ShowWindow(hwnd, SW_RESTORE);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_NOTOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        );
        let _ = SetForegroundWindow(hwnd);
        let _ = BringWindowToTop(hwnd);
    }
}

/// Brings the window of the target executable to the front. Returns true if found.
pub fn focus_exe(target_exe: &str) -> bool {
    let mut finder = TargetFinder {
        target_exe,
        hwnd: 0,
    };
    unsafe {
        let _ = EnumWindows(
            Some(enum_proc_target),
            LPARAM(&mut finder as *mut TargetFinder as isize),
        );
        if finder.hwnd != 0 {
            let hwnd = HWND(finder.hwnd as *mut core::ffi::c_void);
            activate_window(hwnd);
            return true;
        }
    }
    false
}

/// Restores a hidden/tray window of the target executable and brings it to front.
pub fn restore_exe(target_exe: &str) -> bool {
    let mut finder = TargetFinder {
        target_exe,
        hwnd: 0,
    };
    unsafe {
        let _ = EnumWindows(
            Some(enum_proc_target),
            LPARAM(&mut finder as *mut TargetFinder as isize),
        );
        if finder.hwnd != 0 {
            let hwnd = HWND(finder.hwnd as *mut core::ffi::c_void);
            let _ = ShowWindow(hwnd, SW_SHOW);
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = SetForegroundWindow(hwnd);
            let _ = BringWindowToTop(hwnd);
            return true;
        }
    }
    false
}

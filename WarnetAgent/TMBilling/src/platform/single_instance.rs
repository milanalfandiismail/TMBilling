use single_instance::SingleInstance;
use windows::core::PWSTR;
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow, ShowWindow,
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
        if !IsWindowVisible(hwnd).as_bool() {
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
    let mut found = Found(0);
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut found as *mut Found as isize));
        if found.0 != 0 {
            let hwnd = HWND(found.0 as *mut core::ffi::c_void);
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = SetForegroundWindow(hwnd);
        }
    }
}

use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, ShowWindow, SW_HIDE, SW_SHOW};
use windows::core::PCWSTR;

pub fn set_taskbar_visibility(visible: bool) {
    unsafe {
        let cmd = if visible { SW_SHOW } else { SW_HIDE };
        
        // Main Taskbar
        let shell_tray = "Shell_TrayWnd".encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let handle = FindWindowW(PCWSTR(shell_tray.as_ptr()), PCWSTR::null());
        if handle.0 != 0 {
            let _ = ShowWindow(handle, cmd);
        }

        // Start Button
        let button = "Button".encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let btn_handle = FindWindowW(PCWSTR(button.as_ptr()), PCWSTR::null());
        if btn_handle.0 != 0 {
            let _ = ShowWindow(btn_handle, cmd);
        }
        
        // Secondary Taskbars (multi-monitor)
        let secondary_tray = "SecondaryTrayWnd".encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let sec_handle = FindWindowW(PCWSTR(secondary_tray.as_ptr()), PCWSTR::null());
        if sec_handle.0 != 0 {
            let _ = ShowWindow(sec_handle, cmd);
        }
    }
}

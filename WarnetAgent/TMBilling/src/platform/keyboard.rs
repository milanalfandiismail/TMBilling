use once_cell::sync::Lazy;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
    UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL,
};

/// Same default as GLOBAL_HOOK_ENABLED in the Tauri client: the hook blocks while kiosk/AFK.
pub static HOOK_ENABLED: AtomicBool = AtomicBool::new(true);

static HHOOK_HANDLE: Lazy<Mutex<Option<isize>>> = Lazy::new(|| Mutex::new(None));

pub fn set_enabled(enabled: bool) {
    HOOK_ENABLED.store(enabled, Ordering::SeqCst);
}

/// Key filtering split out of the hook so it can be tested without installing one.
pub fn should_block(vk: u32, msg_type: u32, alt: bool, ctrl: bool) -> bool {
    let down = msg_type == 0x100 || msg_type == 0x104;
    // Alt+F4 is blocked on both key events so a stuck key cannot survive.
    if vk == 0x73 {
        return true;
    }
    // LWin, RWin, Apps: block key down only, otherwise the OS key state gets stuck.
    if down && matches!(vk, 0x5B..=0x5D) {
        return true;
    }
    if alt && matches!(vk, 0x09 | 0x1B | 0x20 | 0x0D) {
        return true;
    }
    if ctrl && vk == 0x1B {
        return true;
    }
    false
}

pub fn init() {
    std::thread::spawn(|| unsafe {
        // A hook that cannot be installed means an unlocked kiosk; exit so the watchdog restarts us.
        let h_instance = match GetModuleHandleW(None) {
            Ok(h) => h,
            Err(_) => std::process::exit(1),
        };
        let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), Some(h_instance.into()), 0) {
            Ok(h) => h,
            Err(_) => std::process::exit(1),
        };
        *HHOOK_HANDLE.lock().unwrap() = Some(hook.0 as isize);

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
}

pub fn cleanup() {
    unsafe {
        if let Some(hook) = *HHOOK_HANDLE.lock().unwrap() {
            let _ = UnhookWindowsHookEx(HHOOK(hook as *mut core::ffi::c_void));
        }
    }
}

unsafe extern "system" fn keyboard_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }
    let kb = *(l_param.0 as *const KBDLLHOOKSTRUCT);
    let vk = kb.vkCode;
    let msg_type = w_param.0 as u32;

    #[cfg(debug_assertions)]
    if vk == 0x7B {
        // F12 leaves kiosk mode on a dev build.
        cleanup();
        std::process::exit(0);
    }

    if HOOK_ENABLED.load(Ordering::SeqCst) {
        let alt = (GetAsyncKeyState(0x12) as u16 & 0x8000) != 0;
        let ctrl = (GetAsyncKeyState(0x11) as u16 & 0x8000) != 0;
        if should_block(vk, msg_type, alt, ctrl) {
            return LRESULT(1);
        }
    }
    CallNextHookEx(None, n_code, w_param, l_param)
}

#[cfg(test)]
mod tests {
    use super::should_block;

    #[test]
    fn blocked_keys_include_alt_tab() {
        assert!(should_block(0x09, 0x100, true, false));
        assert!(!should_block(0x09, 0x100, false, false));
    }

    #[test]
    fn windows_key_and_alt_f4_are_blocked() {
        assert!(should_block(0x5B, 0x100, false, false));
        assert!(should_block(0x73, 0x101, false, false));
        assert!(!should_block(0x41, 0x100, false, false));
    }
}

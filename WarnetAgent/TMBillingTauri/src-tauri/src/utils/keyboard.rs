use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, KBDLLHOOKSTRUCT,
    WH_KEYBOARD_LL, HHOOK, GetMessageW, TranslateMessage, DispatchMessageW, MSG,
};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use std::sync::Mutex;
use std::sync::atomic::Ordering;
use once_cell::sync::Lazy;
use crate::state::GLOBAL_HOOK_ENABLED;
static HHOOK_HANDLE: Lazy<Mutex<Option<isize>>> = Lazy::new(|| Mutex::new(None));
pub fn init_keyboard_hook() {
    #[cfg(target_os = "windows")]
    std::thread::spawn(|| {
        unsafe {
            // Module handle of current process (required for low-level hook)
            let h_instance = GetModuleHandleW(None).unwrap();
            let hook = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(keyboard_proc),
                h_instance,
                0,
            ).expect("Failed to set keyboard hook");
            
            *HHOOK_HANDLE.lock().unwrap() = Some(hook.0);
            
            // Thread must have a message loop to process the hook
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, HWND(0), 0, 0).as_bool() {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    });
}

pub fn cleanup_keyboard_hook() {
    #[cfg(target_os = "windows")]
    unsafe {
        if let Some(hook) = *HHOOK_HANDLE.lock().unwrap() {
            let _ = UnhookWindowsHookEx(HHOOK(hook));
        }
    }
}

unsafe extern "system" fn keyboard_proc(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code < 0 {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    let kb_struct = *(l_param.0 as *const KBDLLHOOKSTRUCT);
    let vk_code = kb_struct.vkCode;
    let msg_type = w_param.0 as u32;

    // 0. FORCED BLOCK F4 (ALT+F4) - Paling atas biar gak lolos
    if vk_code == 0x73 && GLOBAL_HOOK_ENABLED.load(Ordering::SeqCst) {
        return LRESULT(1);
    }

    // EMERGENCY EXIT: F12 (Prioritas Utama - Hanya Aktif di Mode Debug/Development)
    #[cfg(debug_assertions)]
    if vk_code == 0x7B {
        let _ = cleanup_keyboard_hook();
        std::process::exit(0);
    }

    if GLOBAL_HOOK_ENABLED.load(Ordering::SeqCst) {
        // 1. BLOCK WINDOWS KEY & APPS KEY (Block Down ONLY)
        // 0x5B = LWin, 0x5C = RWin, 0x5D = Apps Key
        // Kita cuma block KeyDown (0x100) & SysKeyDown (0x104)
        // Biarkan KeyUp (0x101 / 0x105) lewat biar state sistem nggak nyangkut (stuck)
        if vk_code == 0x5B || vk_code == 0x5C || vk_code == 0x5D {
            if msg_type == 0x100 || msg_type == 0x104 {
                return LRESULT(1);
            }
        }
        // Cek status Alt secara real-time via sistem (0x12 = VK_MENU / ALT)
        let is_alt_down = (GetAsyncKeyState(0x12) as u16 & 0x8000) != 0;
        let ctrl_pressed = (GetAsyncKeyState(0x11) as u16 & 0x8000) != 0;
        let shift_pressed = (GetAsyncKeyState(0x10) as u16 & 0x8000) != 0;

        // 2. BLOCK ALT COMBINATIONS (Alt + Tab, Esc, Space, etc)
        if is_alt_down {
            // Tab(0x09), Esc(0x1B), Space(0x20), Enter(0x0D)
            if vk_code == 0x09 || vk_code == 0x1B || vk_code == 0x20 || vk_code == 0x0D {
                return LRESULT(1);
            }
        }

        // 3. BLOCK CTRL COMBINATIONS
        if ctrl_pressed {
            // Ctrl + Esc (0x1B)
            if vk_code == 0x1B {
                return LRESULT(1);
            }
            // Ctrl + Shift + Esc (0x1B + Shift)
            if shift_pressed && vk_code == 0x1B {
                return LRESULT(1);
            }
        }

        // 4. BLOCK WINDOWS KEY COMBINATIONS (Win + D, Win + R, etc)
        // Kita sudah blokir Win Key di atas, tapi ini buat jaga-jaga kombinasi cepat
        if (vk_code == 0x5B || vk_code == 0x5C) && msg_type == 0x100 {
            return LRESULT(1);
        }
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

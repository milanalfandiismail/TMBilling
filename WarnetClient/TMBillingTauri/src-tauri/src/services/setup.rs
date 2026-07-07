use std::sync::atomic::Ordering;
use tauri::{App, Manager, GlobalShortcutManager};
use crate::commands::window_commands;
use crate::utils::keyboard::init_keyboard_hook;
use crate::utils::window_manager::set_taskbar_visibility;

pub fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let main_window = app.get_window("main").unwrap();
    
    // 1. Inisialisasi Hook & Taskbar
    set_taskbar_visibility(false);
    init_keyboard_hook();

    // --- 5. Global Hotkey (Admin Access) ---
    let win_ctrl = main_window.clone();
    let mut shortcuts = app.global_shortcut_manager();
    let handle_ctrl = app.handle();
    match shortcuts.register("Ctrl+Alt+A", move || {
        println!("Hotkey Ctrl+Alt+A dipencet!");
        let win = win_ctrl.clone();
        window_commands::switch_to_kiosk(win.clone(), handle_ctrl.clone());
        // Kasih nafas dikit buat Windows ganti mode
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let _ = win.emit("show-admin-login", ());
        });
    }) {
        Ok(_) => println!("Hotkey Ctrl+Alt+A terdaftar sukses!"),
        Err(e) => eprintln!("Gagal daftar Hotkey Ctrl+Alt+A: {:?}", e),
    }

    let win_f11 = main_window.clone();
    let handle_f11 = app.handle();
    let _ = shortcuts.register("F11", move || {
        println!("Hotkey F11 dipencet!");
        let win = win_f11.clone();
        window_commands::switch_to_kiosk(win.clone(), handle_f11.clone());
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let _ = win.emit("show-admin-login", ());
        });
    });

    // 2. Force Release Windows Key
    unsafe {
        use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP};
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST};
        
        keybd_event(0x5B, 0, KEYEVENTF_KEYUP, 0); 
        keybd_event(0x5C, 0, KEYEVENTF_KEYUP, 0); 

        // TRICK: Set WS_EX_TOOLWINDOW biar window "nempel" di semua virtual desktop
        let hwnd_raw = main_window.hwnd().unwrap();
        let hwnd = HWND(hwnd_raw.0); // Convert Tauri HWND to windows-rs HWND
        
        let current_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        let new_style = current_style | WS_EX_TOOLWINDOW.0 | WS_EX_TOPMOST.0;
        SetWindowLongW(hwnd, GWL_EXSTYLE, new_style as i32);
    }

    main_window.set_always_on_top(true).unwrap();
    main_window.set_fullscreen(true).unwrap();
    main_window.set_decorations(false).unwrap();

    // 3. Watcher Sticky (Biar ngikut kalau desktop pindah)
    let window_clone = main_window.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1500));
            if crate::state::GLOBAL_HOOK_ENABLED.load(Ordering::SeqCst) {
                let _ = window_clone.set_always_on_top(true);
                // Trik narik window ke Virtual Desktop aktif
                let _ = window_clone.unminimize();
                let _ = window_clone.show();
                let _ = window_clone.set_focus(); 
            }
        }
    });

    // 4. Background Polling Service (Integrasi Flask)
    crate::services::polling::start_polling_service(app.handle());

    Ok(())
}

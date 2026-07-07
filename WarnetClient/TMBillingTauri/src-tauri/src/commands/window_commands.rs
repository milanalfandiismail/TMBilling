use tauri::{Window, LogicalSize, Position, LogicalPosition, AppHandle, GlobalShortcutManager};
use std::sync::atomic::Ordering;
use crate::state::GLOBAL_HOOK_ENABLED;
use crate::utils::window_manager::set_taskbar_visibility;

#[tauri::command]
pub fn switch_to_overlay(window: Window, app_handle: AppHandle) {
    // 1. Matikan lock keyboard & munculkan taskbar
    GLOBAL_HOOK_ENABLED.store(false, Ordering::SeqCst);
    set_taskbar_visibility(true);
    
    // 2. HAPUS SEMUA HOTKEY (Biar nggak ganggu user)
    let mut shortcuts = app_handle.global_shortcut_manager();
    let _ = shortcuts.unregister_all();

    window.set_fullscreen(false).unwrap();
    window.set_always_on_top(true).unwrap();
    window.set_size(LogicalSize::new(320.0, 400.0)).unwrap();
    window.set_decorations(false).unwrap();
    window.set_resizable(false).unwrap();
    
    // 3. Pindah ke Pojok Kanan Atas
    if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let logical_screen = screen_size.to_logical::<f64>(scale_factor);
        
        let x = logical_screen.width - 330.0; // Width (320) + Padding (10)
        let y = 10.0; // Padding atas
        let _ = window.set_position(Position::Logical(LogicalPosition { x, y }));
    }
}

#[tauri::command]
pub fn switch_to_kiosk(window: Window, app_handle: AppHandle) {
    // 1. Aktifkan lock keyboard & sembunyikan taskbar
    GLOBAL_HOOK_ENABLED.store(true, Ordering::SeqCst);
    set_taskbar_visibility(false);
    
    let _ = window.set_decorations(false);
    let _ = window.set_resizable(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_fullscreen(true);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();

    // 2. DAFTARKAN HOTKEY LAGI
    let mut shortcuts = app_handle.global_shortcut_manager();
    
    // Ctrl+Alt+A
    let win_a = window.clone();
    let _ = shortcuts.register("Ctrl+Alt+A", move || {
        let _ = win_a.emit("show-admin-login", ());
    });

    // F11
    let win_f = window.clone();
    let _ = shortcuts.register("F11", move || {
        let _ = win_f.emit("show-admin-login", ());
    });
}

#[tauri::command]
pub fn minimize_window(window: Window) {
    window.hide().unwrap();
}

#[tauri::command]
pub fn set_kiosk_lock(window: Window, enabled: bool) {
    GLOBAL_HOOK_ENABLED.store(enabled, Ordering::SeqCst);
    set_taskbar_visibility(!enabled);
    
    if enabled {
        window.set_fullscreen(true).unwrap();
        window.set_always_on_top(true).unwrap();
        window.set_decorations(false).unwrap();
    } else {
        window.set_fullscreen(false).unwrap();
        window.set_always_on_top(true).unwrap();
        window.set_size(LogicalSize::new(320.0, 400.0)).unwrap();
        window.set_decorations(false).unwrap();
        window.set_resizable(false).unwrap();
        
        // Pindah ke Pojok Kanan Atas
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let logical_screen = screen_size.to_logical::<f64>(scale_factor);
            let x = logical_screen.width - 330.0;
            let y = 10.0;
            let _ = window.set_position(Position::Logical(LogicalPosition { x, y }));
        }
    }
}



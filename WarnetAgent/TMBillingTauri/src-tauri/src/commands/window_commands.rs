use tauri::{Window, LogicalSize, Position, LogicalPosition, AppHandle, GlobalShortcutManager};
use std::sync::atomic::Ordering;
use crate::state::GLOBAL_HOOK_ENABLED;
use crate::utils::window_manager::set_taskbar_visibility;

fn get_responsive_overlay_geometry(monitor: &tauri::Monitor) -> (LogicalSize<f64>, LogicalPosition<f64>) {
    let screen_size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let logical_screen = screen_size.to_logical::<f64>(scale_factor);

    // Responsive: jika layar compact (misal 1366x768 / 1280x720) gunakan ukuran lebih ramping
    let (width, height) = if logical_screen.height <= 800.0 {
        (600.0, 500.0)
    } else {
        (680.0, 530.0)
    };

    // Posisikan pas di ujung kanan layar atas
    let x = (logical_screen.width - width).max(0.0);
    let y = 0.0;

    (LogicalSize::new(width, height), LogicalPosition { x, y })
}

/// Pindahkan window ke mode kiosk (fullscreen) atau mode overlay (kartu kecil).
///
/// Window disembunyikan selama transisi karena DWM tidak menginvalidasi area yang
/// ditinggalkan window transparan: tanpa hide/show, frame kiosk lama tertinggal
/// sebagai ghost sampai user melakukan minimize/restore.
fn apply_mode_geometry(window: &Window, fullscreen: bool) {
    let _ = window.hide();

    if fullscreen {
        let _ = window.set_decorations(false);
        let _ = window.set_resizable(false);
        let _ = window.set_always_on_top(true);
        let _ = window.set_fullscreen(true);
    } else {
        let _ = window.set_fullscreen(false);
        let _ = window.set_always_on_top(true);
        let _ = window.set_decorations(false);
        let _ = window.set_resizable(false);

        if let Ok(Some(monitor)) = window.current_monitor() {
            let (size, pos) = get_responsive_overlay_geometry(&monitor);
            let _ = window.set_size(size);
            let _ = window.set_position(Position::Logical(pos));
        } else {
            let _ = window.set_size(LogicalSize::new(360.0, 400.0));
        }
    }

    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn switch_to_overlay(window: Window, app_handle: AppHandle) {
    // 1. Matikan lock keyboard & munculkan taskbar
    GLOBAL_HOOK_ENABLED.store(false, Ordering::SeqCst);
    set_taskbar_visibility(true);

    // 2. HAPUS SEMUA HOTKEY (Biar nggak ganggu user)
    let mut shortcuts = app_handle.global_shortcut_manager();
    let _ = shortcuts.unregister_all();

    // 3. Pindah ke Pojok Kanan Atas Pas & Responsif
    apply_mode_geometry(&window, false);
}

#[tauri::command]
pub fn switch_to_kiosk(window: Window, app_handle: AppHandle) {
    // 1. Aktifkan lock keyboard & sembunyikan taskbar
    GLOBAL_HOOK_ENABLED.store(true, Ordering::SeqCst);
    set_taskbar_visibility(false);

    // 2. Fullscreen penuh
    apply_mode_geometry(&window, true);

    // 3. DAFTARKAN HOTKEY LAGI
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
pub fn switch_to_afk(window: Window, _app_handle: AppHandle) {
    // 1. Kunci keyboard & sembunyikan taskbar
    GLOBAL_HOOK_ENABLED.store(true, Ordering::SeqCst);
    set_taskbar_visibility(false);

    // 2. Fullscreen penuh
    apply_mode_geometry(&window, true);
}

#[tauri::command]
pub fn minimize_window(window: Window) {
    window.hide().unwrap();
}

#[tauri::command]
pub fn set_kiosk_lock(window: Window, enabled: bool) {
    GLOBAL_HOOK_ENABLED.store(enabled, Ordering::SeqCst);
    set_taskbar_visibility(!enabled);

    apply_mode_geometry(&window, enabled);
}

#[tauri::command]
pub fn set_overlay_modal_fullscreen(window: Window, fullscreen: bool) {
    apply_mode_geometry(&window, fullscreen);
}

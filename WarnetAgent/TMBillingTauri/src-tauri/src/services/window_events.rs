use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, GlobalWindowEvent};

pub fn handle_single_instance(app: &AppHandle, argv: Vec<String>, cwd: String) {
    println!("Deteksi instansi kedua! Argv: {:?}, Cwd: {}", argv, cwd);
    if let Some(window) = app.get_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("single-instance-focus", ());
    }
}

pub fn handle_window_event(event: GlobalWindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
        if crate::state::GLOBAL_HOOK_ENABLED.load(Ordering::SeqCst) {
            // Jika sedang Lock (Kiosk), jangan kasih sembunyi atau keluar!
            api.prevent_close();
        } else {
            // Jika sedang Overlay, baru boleh sembunyi ke tray
            event.window().hide().unwrap();
            api.prevent_close();
        }
    }
}

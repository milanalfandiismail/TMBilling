#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod commands;
mod state;
mod utils;
mod services;

fn main() {
    // ========== SECURITY CHECKS (MUST RUN FIRST) ==========
    #[cfg(not(debug_assertions))]
    {
        // Layer 1: Verify process name
        if let Err(e) = crate::utils::security::verify_process_name("TMBilling.exe") {
            eprintln!("[SECURITY] {}", e);
            std::process::exit(1);
        }
        
        // Layer 4: Verify file integrity
        if let Err(e) = crate::utils::security::verify_file_integrity() {
            eprintln!("[SECURITY] {}", e);
            eprintln!("[SECURITY] Please reinstall TMBilling Client");
            std::process::exit(1);
        }
        
        // Layer 3: Lock executable file (prevent rename/delete while running)
        if let Ok(lock) = crate::utils::security::lock_executable_file() {
            let _ = crate::utils::security::FILE_LOCK.set(lock); // Keep handle alive
        }
    }
    
    // ========== CONTINUE TAURI SETUP ==========
    
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(crate::services::window_events::handle_single_instance))
        .manage(crate::utils::api::ApiService::new())
        .system_tray(crate::services::tray::create_tray())
        .on_system_tray_event(crate::services::tray::handle_tray_event)
        .invoke_handler(tauri::generate_handler![
            crate::commands::window_commands::set_kiosk_lock,
            crate::commands::window_commands::switch_to_overlay,
            crate::commands::window_commands::switch_to_kiosk,
            crate::commands::window_commands::minimize_window,
            crate::commands::network_commands::get_network_info,
            crate::commands::auth_commands::login_process,
            crate::commands::auth_commands::logout_process,
            crate::commands::system_commands::force_shutdown,
            crate::commands::system_commands::get_external_bg,
            crate::commands::system_commands::get_client_warnet,
        ])
        .setup(|app| {
            crate::services::setup::setup_app(app)?;
            Ok(())
        })
        .on_window_event(crate::services::window_events::handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Bersihkan hook saat aplikasi benar-benar berhenti
    crate::utils::keyboard::cleanup_keyboard_hook();
}
// force rebuild

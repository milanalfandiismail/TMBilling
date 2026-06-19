#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod models;
mod commands;
mod state;
mod utils;

use crate::commands::{
    window_commands,
    network_commands,
    auth_commands,
};
use tauri::{
    Manager, WindowEvent, GlobalShortcutManager,
    SystemTray, SystemTrayMenu, CustomMenuItem, SystemTrayEvent
};
use crate::utils::keyboard::{init_keyboard_hook, cleanup_keyboard_hook};
use crate::utils::window_manager::set_taskbar_visibility;
use std::sync::atomic::Ordering;
use sha2::{Sha256, Digest};
use once_cell::sync::OnceCell;
use std::fs::{File, OpenOptions};
use std::os::windows::fs::OpenOptionsExt;
use std::io::Read;
use winreg::enums::*;
use winreg::RegKey;

// =========================================================================
// SECURITY LAYERS - FILE PROTECTION SYSTEM
// =========================================================================

// Global file lock handle (kept alive throughout program lifetime)
#[cfg(not(debug_assertions))]
static FILE_LOCK: OnceCell<File> = OnceCell::new();

/// Layer 1: Self-Verification - Check process name at startup
#[cfg(not(debug_assertions))]
fn verify_process_name(expected_name: &str) -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Cannot get exe path: {}", e))?;
    
    let exe_name = exe_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid executable name")?;
    
    if exe_name.eq_ignore_ascii_case(expected_name) {
        Ok(())
    } else {
        Err(format!("Security: Invalid executable name. Expected '{}', got '{}'", 
                    expected_name, exe_name))
    }
}

/// Layer 3: File Lock - Prevent rename/delete while running
#[cfg(not(debug_assertions))]
fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    
    // Open with exclusive access (no delete/rename allowed)
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001) // FILE_SHARE_READ only
        .open(&exe_path)
}

/// Layer 4: Registry Hash Verification - Detect file tampering
#[cfg(not(debug_assertions))]
fn verify_file_integrity() -> Result<(), String> {
    // Read expected hash from Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey = hklm.open_subkey("Software\\TMBilling")
        .map_err(|_| "Registry key not found")?;
    
    let expected_hash: String = subkey.get_value("Hash_TMBilling")
        .map_err(|_| "Integrity hash not found in registry")?;
    
    // Compute current file hash
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Cannot get exe path: {}", e))?;
    
    let mut file = File::open(&exe_path)
        .map_err(|e| format!("Cannot open exe for hashing: {}", e))?;
    
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];
    
    loop {
        let n = file.read(&mut buffer)
            .map_err(|e| format!("Cannot read exe: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    
    let current_hash = format!("{:X}", hasher.finalize());
    
    // Compare hashes (case-insensitive)
    if expected_hash.eq_ignore_ascii_case(&current_hash) {
        Ok(())
    } else {
        Err("File integrity check failed - executable may have been modified".to_string())
    }
}

async fn take_and_upload_screenshot(api: &crate::utils::api::ApiService, ip: &str) -> Result<(), String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Gagal deteksi layar: {}", e))?;
    let screen = screens.first().ok_or_else(|| "Layar tidak ditemukan".to_string())?;
    
    let image = screen.capture().map_err(|e| format!("Gagal capture layar: {}", e))?;
    
    let mut buffer = std::io::Cursor::new(Vec::new());
    image.write_to(&mut buffer, screenshots::image::ImageOutputFormat::Png)
        .map_err(|e| format!("Gagal convert PNG: {}", e))?;
    
    let png_bytes = buffer.into_inner();
    api.upload_screenshot(ip, png_bytes).await?;
    Ok(())
}


fn main() {
    // ========== SECURITY CHECKS (MUST RUN FIRST) ==========
    #[cfg(not(debug_assertions))]
    {
        // Layer 1: Verify process name
        if let Err(e) = verify_process_name("TMBilling.exe") {
            eprintln!("[SECURITY] {}", e);
            std::process::exit(1);
        }
        
        // Layer 4: Verify file integrity
        if let Err(e) = verify_file_integrity() {
            eprintln!("[SECURITY] {}", e);
            eprintln!("[SECURITY] Please reinstall TMBilling Client");
            std::process::exit(1);
        }
        
        // Layer 3: Lock executable file (prevent rename/delete while running)
        if let Ok(lock) = lock_executable_file() {
            let _ = FILE_LOCK.set(lock); // Keep handle alive
        }
    }
    
    // ========== CONTINUE TAURI SETUP ==========
    
    let show = CustomMenuItem::new("show".to_string(), "Tampilkan");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("Deteksi instansi kedua! Argv: {:?}, Cwd: {}", argv, cwd);
            if let Some(window) = app.get_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("single-instance-focus", ());
            }
        }))
        .manage(crate::utils::api::ApiService::new())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                let window = app.get_window("main").unwrap();
                match id.as_str() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    _ => {}
                }
            }
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                let _ = window.show();
                let _ = window.set_focus();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            window_commands::set_kiosk_lock,
            window_commands::switch_to_overlay,
            window_commands::switch_to_kiosk,
            window_commands::minimize_window,
            network_commands::get_network_info,
            auth_commands::login_process,
            auth_commands::logout_process,
        ])
        .setup(|app| {
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
            let window_polling = main_window.clone();
            tauri::async_runtime::spawn(async move {
                let api = crate::utils::api::ApiService::new();
                
                // --- PROSES IDENTIFIKASI AWAL ---
                if let Ok(net) = crate::commands::network_commands::get_network_info() {
                    match api.identify(&net.ip, &net.mac).await {
                        Ok(res) => {
                            if res.valid {
                                let pc_kode = res.pc_kode.clone().unwrap_or_default();
                                println!("Identifikasi Sukses: PC {}", pc_kode);
                                let _ = window_polling.emit("pc-identified", res);
                            } else {
                                eprintln!("Identifikasi Ditolak: {}", res.error.unwrap_or_default());
                            }
                        }
                        Err(e) => eprintln!("Gagal Identify ke Server: {}", e),
                    }
                }

                loop {
                    // Ambil Network Info
                    if let Ok(net) = crate::commands::network_commands::get_network_info() {
                        let is_emergency = crate::state::IS_EMERGENCY_MODE.load(Ordering::SeqCst);
                        
                        match api.get_status(&net.ip, &net.mac).await {
                            Ok(status) => {
                                if is_emergency {
                                    // Emergency: kirim dummy status ke UI tetap
                                    let dummy_status = crate::utils::api::StatusResponse {
                                        status: "admin".to_string(),
                                        sisa_waktu: Some(999999),
                                        nama: Some("SUPER ADMIN".to_string()),
                                        grup: Some("SYSTEM".to_string()),
                                        pc_kode: None,
                                        shutdown_timer: Some(0),
                                        command: None,
                                        message: None,
                                    };
                                    let _ = window_polling.emit("time-update", 999999);
                                    let _ = window_polling.emit("status-update", dummy_status);
                                } else {
                                    // Normal mode: kirim data asli ke UI
                                    println!("Polling PC: {:?} | Sisa Detik: {:?}", status.status, status.sisa_waktu);
                                    let _ = window_polling.emit("time-update", status.sisa_waktu.unwrap_or(0));
                                    let _ = window_polling.emit("status-update", status.clone());

                                    if status.status == "kosong" || status.status == "error" {
                                        if crate::state::SESSION_ACTIVE.load(Ordering::SeqCst) {
                                            println!("Sesi dihentikan oleh Server/Kasir. Mengunci...");
                                            crate::state::SESSION_ACTIVE.store(false, Ordering::SeqCst);
                                            let _ = window_polling.emit("force-lock", ());
                                        }
                                    }

                                    if let Some(cmd) = status.command {
                                        if cmd == "lock" || cmd == "logout" {
                                            let _ = window_polling.emit("force-lock", ());
                                        } else if cmd == "screenshot" {
                                            println!("Menerima perintah screenshot...");
                                            let api_clone = api.clone();
                                            let client_ip = net.ip.clone();
                                            tauri::async_runtime::spawn(async move {
                                                if let Err(e) = take_and_upload_screenshot(&api_clone, &client_ip).await {
                                                    eprintln!("Gagal memproses screenshot: {}", e);
                                                } else {
                                                    println!("Screenshot berhasil diproses & diunggah!");
                                                }
                                            });
                                        } else if cmd == "shutdown" {
                                            println!("Menerima perintah shutdown! Mengeksekusi...");
                                            #[cfg(target_os = "windows")]
                                            {
                                                let _ = std::process::Command::new("shutdown")
                                                    .args(["/s", "/f", "/t", "0"])
                                                    .spawn();
                                            }
                                        } else if cmd == "restart" {
                                            println!("Menerima perintah restart! Mengeksekusi...");
                                            #[cfg(target_os = "windows")]
                                            {
                                                let _ = std::process::Command::new("shutdown")
                                                    .args(["/r", "/f", "/t", "0"])
                                                    .spawn();
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("Polling error: {}", e);
                            }
                        }
                    }
                    
                    // Interval polling (5 detik)
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            });

            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                if crate::state::GLOBAL_HOOK_ENABLED.load(Ordering::SeqCst) {
                    // Jika sedang Lock (Kiosk), jangan kasih sembunyi atau keluar!
                    api.prevent_close();
                } else {
                    // Jika sedang Overlay, baru boleh sembunyi ke tray
                    event.window().hide().unwrap();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::network_commands::get_network_info,
            crate::commands::window_commands::minimize_window,
            crate::commands::window_commands::set_kiosk_lock,
            crate::commands::window_commands::switch_to_overlay,
            crate::commands::window_commands::switch_to_kiosk,
            crate::commands::window_commands::set_window_fullscreen,
            crate::commands::auth_commands::login_process,
            crate::commands::auth_commands::logout_process,
            crate::commands::system_commands::force_shutdown,
            crate::commands::system_commands::get_external_bg,
            crate::commands::system_commands::get_client_warnet,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Bersihkan hook saat aplikasi benar-benar berhenti
    cleanup_keyboard_hook();
}

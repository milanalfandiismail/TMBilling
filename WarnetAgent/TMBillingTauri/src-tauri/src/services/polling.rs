use std::sync::atomic::Ordering;
use tauri::Manager;
use crate::utils::screenshot::take_and_upload_screenshot;

pub fn start_polling_service(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let api = crate::utils::api::ApiService::new();
        let mut current_interval_secs: u64 = 5; // Default & fallback 5 detik
        
        // --- PROSES IDENTIFIKASI AWAL ---
        if let Ok(net) = crate::commands::network_commands::get_network_info() {
            match api.identify(&net.ip, &net.mac).await {
                Ok(res) => {
                    if let Some(interval) = res.polling_interval {
                        if interval == 1 || interval == 5 || interval == 10 {
                            current_interval_secs = interval;
                        }
                    }
                    if res.valid {
                        let pc_kode = res.pc_kode.clone().unwrap_or_default();
                        println!("Identifikasi Sukses: PC {} (Interval: {}s)", pc_kode, current_interval_secs);
                        let _ = app.emit_all("pc-identified", res);
                    } else {
                        eprintln!("Identifikasi Ditolak: {}", res.error.unwrap_or_default());
                    }
                }
                Err(e) => {
                    eprintln!("Gagal Identify ke Server: {}", e);
                    current_interval_secs = 5;
                }
            }
        }

        loop {
            // Ambil Network Info
            if let Ok(net) = crate::commands::network_commands::get_network_info() {
                let is_emergency = crate::state::IS_EMERGENCY_MODE.load(Ordering::SeqCst);
                
                match api.get_status(&net.ip, &net.mac).await {
                    Ok(status) => {
                        if let Some(interval) = status.polling_interval {
                            if interval == 1 || interval == 5 || interval == 10 {
                                current_interval_secs = interval;
                            }
                        }

                        let is_lock_command = status.command.as_deref() == Some("lock") || status.command.as_deref() == Some("logout");
                        let is_session_ended = status.status == "kosong" || status.status == "error";

                        if is_emergency && (is_lock_command || is_session_ended) {
                            println!("Emergency mode dihentikan oleh Server/Kasir (Status: {}, Cmd: {:?}). Mengunci...", status.status, status.command);
                            crate::state::SESSION_ACTIVE.store(false, Ordering::SeqCst);
                            crate::state::IS_ADMIN_MODE.store(false, Ordering::SeqCst);
                            crate::state::IS_EMERGENCY_MODE.store(false, Ordering::SeqCst);
                            let _ = app.emit_all("force-lock", ());
                        } else if is_emergency {
                            // Emergency mode masih aktif & server tidak meminta lock:
                            // Kirim status SYSTEM ke UI
                            let sys_status = crate::utils::api::StatusResponse {
                                status: "system".to_string(),
                                sisa_waktu: Some(999999),
                                nama: Some("SYSTEM".to_string()),
                                grup: Some("SYSTEM".to_string()),
                                pc_kode: status.pc_kode.clone(),
                                shutdown_timer: Some(0),
                                command: None,
                                message: None,
                                is_afk: Some(false),
                                polling_interval: Some(current_interval_secs),
                            };
                            let _ = app.emit_all("time-update", 999999);
                            let _ = app.emit_all("status-update", sys_status);
                        } else {
                            // Normal mode: kirim data asli ke UI
                            println!("Polling PC: {:?} | Sisa Detik: {:?}", status.status, status.sisa_waktu);
                            let _ = app.emit_all("time-update", status.sisa_waktu.unwrap_or(0));
                            let _ = app.emit_all("status-update", status.clone());

                            if is_session_ended {
                                if crate::state::SESSION_ACTIVE.load(Ordering::SeqCst) {
                                    println!("Sesi dihentikan oleh Server/Kasir. Mengunci...");
                                    crate::state::SESSION_ACTIVE.store(false, Ordering::SeqCst);
                                    let _ = app.emit_all("force-lock", ());
                                }
                            }

                            if let Some(cmd) = status.command {
                                if cmd == "lock" || cmd == "logout" {
                                    let _ = app.emit_all("force-lock", ());
                                } else if cmd == "afk_lock" {
                                    let _ = app.emit_all("force-afk-lock", ());
                                } else if cmd == "afk_unlock" {
                                    let _ = app.emit_all("force-afk-unlock", ());
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
                        // Fallback ke interval default 5 detik saat offline/error
                        current_interval_secs = 5;
                    }
                }
            }
            
            // Interval polling dinamis (1s, 5s, atau 10s dengan fallback 5s)
            tokio::time::sleep(std::time::Duration::from_secs(current_interval_secs)).await;
        }
    });
}

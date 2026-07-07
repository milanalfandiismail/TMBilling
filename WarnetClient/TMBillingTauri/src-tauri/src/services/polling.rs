use std::sync::atomic::Ordering;
use tauri::Manager;
use crate::utils::screenshot::take_and_upload_screenshot;

pub fn start_polling_service(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let api = crate::utils::api::ApiService::new();
        
        // --- PROSES IDENTIFIKASI AWAL ---
        if let Ok(net) = crate::commands::network_commands::get_network_info() {
            match api.identify(&net.ip, &net.mac).await {
                Ok(res) => {
                    if res.valid {
                        let pc_kode = res.pc_kode.clone().unwrap_or_default();
                        println!("Identifikasi Sukses: PC {}", pc_kode);
                        let _ = app.emit_all("pc-identified", res);
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
                            let _ = app.emit_all("time-update", 999999);
                            let _ = app.emit_all("status-update", dummy_status);
                        } else {
                            // Normal mode: kirim data asli ke UI
                            println!("Polling PC: {:?} | Sisa Detik: {:?}", status.status, status.sisa_waktu);
                            let _ = app.emit_all("time-update", status.sisa_waktu.unwrap_or(0));
                            let _ = app.emit_all("status-update", status.clone());

                            if status.status == "kosong" || status.status == "error" {
                                if crate::state::SESSION_ACTIVE.load(Ordering::SeqCst) {
                                    println!("Sesi dihentikan oleh Server/Kasir. Mengunci...");
                                    crate::state::SESSION_ACTIVE.store(false, Ordering::SeqCst);
                                    let _ = app.emit_all("force-lock", ());
                                }
                            }

                            if let Some(cmd) = status.command {
                                if cmd == "lock" || cmd == "logout" {
                                    let _ = app.emit_all("force-lock", ());
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
                                } else if cmd.starts_with("kill:") {
                                    let process_name = cmd.trim_start_matches("kill:").to_string();
                                    println!("Menerima perintah kill process: {}", process_name);
                                    #[cfg(target_os = "windows")]
                                    {
                                        use std::os::windows::process::CommandExt;
                                        let _ = std::process::Command::new("taskkill")
                                            .args(["/f", "/im", &process_name])
                                            .creation_flags(0x08000000) // CREATE_NO_WINDOW
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
}

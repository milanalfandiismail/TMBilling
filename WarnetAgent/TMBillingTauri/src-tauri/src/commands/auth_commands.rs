use crate::models::LoginResponse;
use crate::utils::api::ApiService;
use tauri::{State, AppHandle};

#[tauri::command]
pub async fn login_process(
    username: String, 
    password: String,
    is_admin: bool,
    api: State<'_, ApiService>,
    window: tauri::Window,
    app_handle: AppHandle
) -> Result<LoginResponse, String> {
    let u_trim = username.trim().to_string();
    let p_trim = password.trim().to_string();

    // --- 1. ADMIN LOGIN (termasuk Emergency offline via admin_login) ---
    // Emergency credential check yang benar ada di admin_login (api.rs):
    // sha256(input) dibandingkan dengan hash yang tersimpan di registry.
    // Ambil Network Info
    let net = crate::commands::network_commands::get_network_info()
        .map_err(|e| e.to_string())?;

    // 3. PROSES LOGIN KE SERVER
    let login_result = if is_admin {
        api.admin_login(&net.ip, &net.mac, &u_trim, &p_trim).await
    } else {
        api.member_login(&net.ip, &net.mac, &u_trim, &p_trim).await
    };

    match login_result {
        Ok(res) => {
            if res.status == "admin" || res.status == "system" || res.status == "aktif" {
                // Jika admin atau system, set state admin
                if is_admin || res.status == "admin" || res.status == "system" {
                    crate::state::IS_ADMIN_MODE.store(true, std::sync::atomic::Ordering::SeqCst);
                }

                // Jika login emergency offline (nama = SYSTEM atau status = system),
                // set IS_EMERGENCY_MODE agar polling berjalan offline tanpa logout ke server
                let is_emergency = res.nama.as_deref() == Some("SYSTEM") || res.status == "system";
                if is_emergency {
                    crate::state::IS_EMERGENCY_MODE.store(true, std::sync::atomic::Ordering::SeqCst);
                    // Notify server (opsional, tetap sukses walau gagal)
                    let _ = api.emergency_login(&net.ip, &net.mac, &u_trim).await;
                }

                // Tandai sesi aktif
                crate::state::SESSION_ACTIVE.store(true, std::sync::atomic::Ordering::SeqCst);

                // Jika sukses, ubah mode ke Overlay
                crate::commands::window_commands::switch_to_overlay(window, app_handle);

                let default_group = if res.status == "system" {
                    "SYSTEM".to_string()
                } else if is_admin || res.status == "admin" {
                    "ADMIN".to_string()
                } else {
                    "Member".to_string()
                };

                Ok(LoginResponse {
                    status: "success".to_string(),
                    member_name: res.nama.unwrap_or_else(|| u_trim.clone()),
                    group: res.grup.unwrap_or(default_group),
                    remaining_seconds: if is_admin || res.status == "admin" || res.status == "system" { 999999 } else { res.sisa_waktu.unwrap_or(0) },
                })
            } else {
                Err(res.message.unwrap_or_else(|| "Gagal login (Invalid Status)".to_string()))
            }
        }
        Err(e) => {
            eprintln!("LOGIN ERROR: {}", e);
            Err(format!("Gagal: {}", e))
        }
    }
}

#[tauri::command]
pub async fn logout_process(
    api: State<'_, ApiService>,
    window: tauri::Window,
    app_handle: AppHandle
) -> Result<(), String> {
    // Ambil Network Info
    let net = crate::commands::network_commands::get_network_info()
        .map_err(|e| e.to_string())?;

    // Cek apakah sebelumnya dalam mode emergency
    let is_emergency = crate::state::IS_EMERGENCY_MODE.load(std::sync::atomic::Ordering::SeqCst);

    // Reset admin & emergency mode serta status sesi
    crate::state::IS_ADMIN_MODE.store(false, std::sync::atomic::Ordering::SeqCst);
    crate::state::IS_EMERGENCY_MODE.store(false, std::sync::atomic::Ordering::SeqCst);
    crate::state::SESSION_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);

    // Panggil API Logout di Flask jika BUKAN mode emergency (offline)
    if !is_emergency {
        let _ = api.logout(&net.ip, &net.mac).await;
    }

    // Pastikan balik ke mode Kiosk
    crate::commands::window_commands::switch_to_kiosk(window, app_handle);
    
    Ok(())
}

#[tauri::command]
pub async fn afk_lock_process(
    pin: Option<String>,
    api: State<'_, ApiService>,
    window: tauri::Window,
    app_handle: AppHandle
) -> Result<(), String> {
    let net = crate::commands::network_commands::get_network_info()
        .map_err(|e| e.to_string())?;

    api.afk_lock(&net.ip, &net.mac, pin).await?;
    crate::commands::window_commands::switch_to_afk(window, app_handle);
    Ok(())
}

#[tauri::command]
pub async fn afk_unlock_process(
    credential: String,
    api: State<'_, ApiService>,
    window: tauri::Window,
    app_handle: AppHandle
) -> Result<(), String> {
    let net = crate::commands::network_commands::get_network_info()
        .map_err(|e| e.to_string())?;

    api.afk_unlock(&net.ip, &net.mac, &credential).await?;
    crate::commands::window_commands::switch_to_overlay(window, app_handle);
    Ok(())
}

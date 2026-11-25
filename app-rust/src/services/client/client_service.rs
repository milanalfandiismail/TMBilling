//! Layanan client agent: identifikasi, polling status, AFK, admin/emergency login.

use chrono::Duration;
use serde_json::{json, Value};

use crate::models::pc::Pc;
use crate::models::sesi::Sesi;
use crate::models::user::{hash_password, verify_password};
use crate::repositories::{member as member_repo, pc as pc_repo, sesi as sesi_repo};
use crate::services::auth::login_throttle;
use crate::services::blackout::blackout_service;
use crate::services::sesi::sesi_service;
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::logger;
use crate::utils::time::{db_str, format_clock, format_display, now_db, parse_dt};

pub const HEARTBEAT_PERSIST_SECONDS: i64 = 30;
/// Jendela toleransi untuk poll `role=client` yang terkirim sebelum login admin.
pub const ADMIN_GRACE_SECONDS: i64 = 15;

fn normal_mac(mac: &str) -> String {
    mac.replace([':', '-', ' '], "")
        .to_uppercase()
        .trim()
        .to_string()
}

fn format_mac(mac: &str) -> String {
    let clean = normal_mac(mac);
    if clean.len() != 12 {
        return clean;
    }
    clean
        .as_bytes()
        .chunks(2)
        .map(|c| String::from_utf8_lossy(c).to_string())
        .collect::<Vec<_>>()
        .join(":")
}

async fn shutdown_timer(st: &AppState) -> i64 {
    let raw = settings_service::get_or(st, "auto_shutdown_timer_seconds", "180").await;
    raw.parse::<i64>().unwrap_or(180).clamp(30, 600)
}

async fn cari_pc(st: &AppState, ip: &str, mac: &str) -> Option<Pc> {
    if let Ok(Some(meta)) = st.pc_network.resolve(&st.pool, ip, Some(mac)).await {
        if let Ok(Some(pc)) = pc_repo::get_by_id(&st.pool, meta.id).await {
            return Some(pc);
        }
    }
    if let Ok(Some(pc)) = pc_repo::find_aktif_by_ip(&st.pool, ip).await {
        return Some(pc);
    }
    let m = format_mac(mac);
    if m.is_empty() {
        return None;
    }
    pc_repo::find_by_mac(&st.pool, &m).await.ok().flatten()
}

fn sesi_json(sesi: &Sesi, sisa: i64, tz: &str) -> Value {
    let display = |raw: &Option<String>| {
        raw.as_deref()
            .and_then(parse_dt)
            .map(|d| format_display(d, tz))
    };
    let member = sesi.tipe == "member" && sesi.member_id.is_some();
    let dibuat = display(&sesi.member_dibuat);
    let kadaluarsa = display(&sesi.member_kadaluarsa);
    json!({
        "is_member": member,
        "member": if member {
            json!({
                "id": sesi.member_id,
                "username": sesi.member_username,
                "nama_lengkap": sesi.member_nama,
                "email": sesi.member_email,
                "no_hp": sesi.member_no_hp,
                "waktu_tersimpan": sisa,
                "grup": sesi.pc_grup_nama.clone().unwrap_or_else(|| "reguler".into()),
                "dibuat_pada": sesi.member_dibuat,
                "dibuat_pada_display": dibuat,
                "kadaluarsa_pada": sesi.member_kadaluarsa,
                "kadaluarsa_pada_display": kadaluarsa,
            })
        } else { Value::Null }
    })
}

pub async fn identify(st: &AppState, ip: &str, mac: &str) -> Result<Value, String> {
    logger::rec(
        "system",
        "IDENTIFY_START",
        &format!("PC coba kenalan: IP={ip}, MAC={mac}"),
    );
    let Some(pc) = pc_repo::find_aktif_by_ip(&st.pool, ip)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err(format!("IP {ip} tidak dikenal server"));
    };
    let klien = normal_mac(mac);
    match pc
        .mac_address
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        None => {
            let rapi = format_mac(mac);
            pc_repo::set_mac(&st.pool, pc.id, &rapi)
                .await
                .map_err(|e| e.to_string())?;
            logger::rec(
                "system",
                "IDENTIFY_AUTO_REG",
                &format!("MAC PC {} otomatis didaftarkan: {rapi}", pc.kode),
            );
        }
        Some(db_mac) => {
            if normal_mac(db_mac) != klien {
                logger::rec(
                    "system",
                    "IDENTIFY_REJECTED",
                    &format!("Akses ditolak! IP {ip} terikat MAC {db_mac}, client kirim {klien}"),
                );
                return Err("PC tidak cocok (Security Mismatch)".into());
            }
        }
    }
    st.online.touch(pc.id);
    logger::rec(
        "system",
        "IDENTIFY_SUCCESS",
        &format!("PC {} berhasil diidentifikasi", pc.kode),
    );
    Ok(json!({
        "valid": true,
        "pc_kode": pc.kode,
        "grup": pc.grup_nama.clone().unwrap_or_else(|| "reguler".into()),
        "polling_interval": settings_service::client_polling_interval(st).await,
    }))
}

pub async fn status(
    st: &AppState,
    ip: &str,
    mac: &str,
    role: Option<&str>,
) -> Result<Value, String> {
    let mut pc = match pc_repo::find_aktif_by_ip(&st.pool, ip)
        .await
        .map_err(|e| e.to_string())?
    {
        Some(pc) => pc,
        None => match cari_pc(st, ip, mac).await {
            Some(pc) if pc.aktif.unwrap_or(false) => pc,
            _ => {
                return Ok(json!({
                    "status": "kosong",
                    "message": "PC tidak dikenal",
                    "shutdown_timer": 180,
                }))
            }
        },
    };

    match pc
        .mac_address
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        None => {
            let rapi = format_mac(mac);
            {
                let _guard = st.write().await;
                pc_repo::set_mac(&st.pool, pc.id, &rapi)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            pc.mac_address = Some(rapi);
        }
        Some(db_mac) => {
            if normal_mac(db_mac) != normal_mac(mac) {
                return Err("Identitas PC tidak valid (MAC Mismatch)".into());
            }
        }
    }

    st.online.touch(pc.id);
    let now = now_db();

    let mut sesi = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(s) = &sesi {
        if let Some(last) = s.last_sync.as_deref().and_then(parse_dt) {
            let ambang = blackout_service::threshold_default();
            if last < now - Duration::minutes(ambang) {
                blackout_service::deteksi(st, None).await?;
                sesi = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    st.uptime.set_billing(pc.id, sesi.is_some());

    let admin_role = matches!(role, Some("admin") | Some("emergency") | Some("system"));
    let is_launcher = matches!(role, Some("launcher"));

    if admin_role && !pc.is_admin_mode.unwrap_or(false) {
        logger::rec(
            "system",
            "REMOTE_LOGOUT",
            &format!("PC {} dipaksa logout admin/system oleh server", pc.kode),
        );
        return Ok(json!({"status": "kosong", "pc_kode": pc.kode, "command": "lock"}));
    }
    // Grace: satu poll `role=client` yang sudah terkirim sebelum login admin tidak
    // boleh mematikan mode admin yang baru dibuat.
    // Observer: role=launcher adalah background polling dari game launcher dan TIDAK boleh mematikan mode admin.
    let fresh_admin = sesi
        .as_ref()
        .and_then(|s| s.mulai_pada.as_deref().and_then(parse_dt))
        .map(|d| (now - d).num_seconds() < ADMIN_GRACE_SECONDS)
        .unwrap_or(false);
    if !admin_role && !is_launcher && pc.is_admin_mode.unwrap_or(false) && !fresh_admin {
        {
            let _guard = st.write().await;
            pc_repo::set_admin_mode(&st.pool, pc.id, false)
                .await
                .map_err(|e| e.to_string())?;
        }
        if let Some(s) = &sesi {
            if s.tipe == "admin" {
                let _ = sesi_service::tutup(st, s.id, "system").await;
                sesi = None;
            }
        }
        pc.is_admin_mode = Some(false);
    }

    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let mut res = if pc.is_admin_mode.unwrap_or(false) {
        let system = sesi
            .as_ref()
            .and_then(|s| s.nama_guest.clone())
            .map(|n| n.trim().eq_ignore_ascii_case("SYSTEM"))
            .unwrap_or(false);
        json!({
            "status": if system { "system" } else { "admin" },
            "nama": sesi
                .as_ref()
                .and_then(|s| s.nama_guest.clone())
                .filter(|n| !n.trim().is_empty())
                .unwrap_or_else(|| "Admin".into()),
            "grup": if system { "SYSTEM" } else { "ADMIN" },
            "mulai": sesi
                .as_ref()
                .and_then(|s| s.mulai_pada.as_deref())
                .and_then(parse_dt)
                .map(|d| format_clock(d, &tz)),
            "pc_kode": pc.kode,
            "shutdown_timer": 0,
        })
    } else if sesi.is_none() {
        json!({
            "status": "kosong",
            "pc_kode": pc.kode,
            "shutdown_timer": shutdown_timer(st).await,
        })
    } else {
        let sesi = sesi.clone().unwrap();
        let due = match sesi.last_sync.as_deref().and_then(parse_dt) {
            None => true,
            Some(last) => (now - last).num_seconds() >= HEARTBEAT_PERSIST_SECONDS,
        };
        if due {
            let batas = db_str(now - Duration::seconds(HEARTBEAT_PERSIST_SECONDS));
            let _guard = st.write().await;
            sqlx::query(
                "UPDATE sesi SET last_sync = ? WHERE id = ? AND status = 'aktif' \
                 AND (last_sync IS NULL OR last_sync <= ?)",
            )
            .bind(db_str(now))
            .bind(sesi.id)
            .bind(batas)
            .execute(&st.pool)
            .await
            .map_err(|e| e.to_string())?;
        }

        let sisa = sesi_service::sync_waktu_member(st, &sesi).await;
        let sisa_detik = sesi.sisa_detik(now);
        if sisa <= 0 {
            let _ = sesi_service::tutup(st, sesi.id, "system").await;
            json!({
                "status": "kosong",
                "message": "Waktu habis",
                "pc_kode": pc.kode,
                "shutdown_timer": shutdown_timer(st).await,
            })
        } else {
            let mut body = json!({
                "status": if role == Some("admin") { "admin" } else { "aktif" },
                "sisa_waktu": sisa,
                "sisa_detik": sisa_detik,
                "nama": sesi.member_username.clone()
                    .or_else(|| sesi.nama_guest.clone())
                    .unwrap_or_else(|| "Guest".into()),
                "grup": pc.grup_nama.clone().unwrap_or_else(|| "reguler".into()),
                "pc_kode": pc.kode,
                "mulai": sesi
                    .mulai_pada
                    .as_deref()
                    .and_then(parse_dt)
                    .map(|d| format_clock(d, &tz)),
                "is_afk": sesi.is_afk,
                "shutdown_timer": 0,
            });
            if let Value::Object(map) = sesi_json(&sesi, sisa, &tz) {
                for (k, v) in map {
                    map_insert(&mut body, k, v);
                }
            }
            body
        }
    };

    if let Value::Object(map) = &mut res {
        map.insert(
            "polling_interval".into(),
            json!(settings_service::client_polling_interval(st).await),
        );
        if !map.contains_key("command") {
            if let Some(cmd) = st.commands.regular.pop(pc.id) {
                // Perintah berstruktur (VNC) dikirim sebagai objek, bukan string.
                let nilai = serde_json::from_str::<serde_json::Value>(&cmd)
                    .ok()
                    .filter(|v| v.is_object())
                    .unwrap_or_else(|| json!(cmd));
                map.insert("command".into(), nilai);
            }
        }
    }
    Ok(res)
}

fn map_insert(target: &mut Value, key: String, value: Value) {
    if let Value::Object(map) = target {
        map.insert(key, value);
    }
}

pub async fn selesai(st: &AppState, ip: &str, mac: &str) -> Result<Value, String> {
    let pc = cari_pc(st, ip, mac).await.ok_or("IP PC tidak terdaftar")?;
    match pc
        .mac_address
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        None => {
            let rapi = format_mac(mac);
            pc_repo::set_mac(&st.pool, pc.id, &rapi)
                .await
                .map_err(|e| e.to_string())?;
        }
        Some(db_mac) => {
            if normal_mac(db_mac) != normal_mac(mac) {
                return Err("MAC address mismatch".into());
            }
        }
    }
    if let Some(sesi) = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
    {
        sesi_service::tutup(st, sesi.id, "client").await?;
    }
    Ok(json!({"success": true, "message": "Sesi ditutup"}))
}

pub async fn admin_login(
    st: &AppState,
    ip: &str,
    mac: &str,
    username: &str,
    password: &str,
    peer: &str,
    agent: &str,
) -> Result<Value, String> {
    if login_throttle::check(peer, username) {
        return Err("Terlalu banyak percobaan login. Coba lagi dalam 5 menit.".into());
    }
    let hasil = admin_login_inner(st, ip, mac, username, password, agent).await;
    match &hasil {
        Ok(_) => login_throttle::ok(peer, username),
        Err(_) => login_throttle::fail(peer, username),
    }
    hasil
}

async fn admin_login_inner(
    st: &AppState,
    ip: &str,
    mac: &str,
    username: &str,
    password: &str,
    agent: &str,
) -> Result<Value, String> {
    let pc = cari_pc(st, ip, mac).await.ok_or("IP PC tidak terdaftar")?;
    match pc
        .mac_address
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        None => {
            let rapi = format_mac(mac);
            pc_repo::set_mac(&st.pool, pc.id, &rapi)
                .await
                .map_err(|e| e.to_string())?;
        }
        Some(db_mac) => {
            if normal_mac(db_mac) != normal_mac(mac) {
                return Err("Identitas PC tidak valid (MAC Mismatch)".into());
            }
        }
    }
    let user = crate::repositories::user::get_by_username(&st.pool, username)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Invalid admin credentials")?;
    let role = user.role();
    if !matches!(role, "admin" | "kasir") || !user.check_password(password).await {
        return Err("Invalid admin credentials".into());
    }
    if let Some(lama) = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
    {
        sesi_service::tutup(st, lama.id, "system").await?;
    }
    {
        let _guard = st.write().await;
        pc_repo::set_admin_mode(&st.pool, pc.id, true)
            .await
            .map_err(|e| e.to_string())?;
    }
    let token = sesi_service::token_sesi();
    let display = match user.nama_lengkap.clone() {
        Some(n) if !n.is_empty() => n,
        _ => user.username.clone(),
    };
    sesi_service::buka_admin(st, pc.id, &display).await?;
    logger::audit(
        username,
        "CLIENT_ADMIN_LOGIN",
        &format!("Admin {username} login langsung di PC {}", pc.kode),
        None,
        "",
        agent,
    );
    Ok(json!({
        "success": true,
        "token_sesi": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "nama_lengkap": display,
            "role": role,
        }
    }))
}

pub async fn emergency_login(
    st: &AppState,
    ip: &str,
    mac: &str,
    username: &str,
    token: Option<&str>,
    request_ip: &str,
) -> Result<Value, String> {
    let mut pc = cari_pc(st, ip, mac).await.ok_or("IP PC tidak terdaftar")?;
    let harapan = settings_service::get_or_create_emergency_token(st).await;
    let token_ok = token
        .map(|t| !t.is_empty() && t == harapan)
        .unwrap_or(false);
    let ip_ok = !request_ip.is_empty() && Some(request_ip) == pc.ip_address.as_deref();
    if !token_ok && !ip_ok {
        logger::rec(
            "system",
            "SECURITY_ALERT",
            &format!("Emergency login ditolak: token tidak valid (IP {ip})"),
        );
        return Err("TOKEN:Token emergency login tidak valid".into());
    }
    match pc
        .mac_address
        .as_deref()
        .map(str::trim)
        .filter(|m| !m.is_empty())
    {
        None => {
            let rapi = format_mac(mac);
            {
                let _guard = st.write().await;
                pc_repo::set_mac(&st.pool, pc.id, &rapi)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            pc.mac_address = Some(rapi);
        }
        Some(db_mac) => {
            if normal_mac(db_mac) != normal_mac(mac) {
                return Err("Identitas PC tidak valid (MAC Mismatch)".into());
            }
        }
    }
    if let Some(lama) = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
    {
        sesi_service::tutup(st, lama.id, "system").await?;
    }
    {
        let _guard = st.write().await;
        pc_repo::set_admin_mode(&st.pool, pc.id, true)
            .await
            .map_err(|e| e.to_string())?;
    }
    sesi_service::buka_admin(st, pc.id, "SYSTEM").await?;
    logger::rec(
        "system",
        "EMERGENCY_LOGIN",
        &format!(
            "PC {} ({ip}) emergency login activated by '{username}'",
            pc.kode
        ),
    );
    Ok(json!({"success": true, "message": "Emergency admin mode activated"}))
}

pub async fn afk_lock(
    st: &AppState,
    ip: &str,
    mac: &str,
    pin: Option<&str>,
) -> Result<Value, String> {
    let pc = cari_pc(st, ip, mac).await.ok_or("IP PC tidak terdaftar")?;
    let sesi = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Tidak ada sesi aktif di PC ini")?;
    if sesi.is_afk {
        return Ok(json!({"success": true, "message": "PC sudah dalam status AFK"}));
    }
    let hashed = if sesi.tipe == "guest" {
        let pin = pin.map(str::trim).unwrap_or("");
        if pin.is_empty() {
            return Err("PIN / Password tidak boleh kosong untuk tamu".into());
        }
        Some(hash_password(pin))
    } else {
        None
    };
    let _guard = st.write().await;
    sqlx::query("UPDATE sesi SET is_afk = 1, afk_pin = ?, afk_sejak = ? WHERE id = ?")
        .bind(hashed)
        .bind(db_str(now_db()))
        .bind(sesi.id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let label = sesi
        .member_username
        .clone()
        .or_else(|| sesi.nama_guest.clone())
        .unwrap_or_else(|| "Guest".into());
    logger::rec(
        "system",
        "CLIENT_AFK_LOCKED",
        &format!("PC {} dikunci AFK oleh {label}", pc.kode),
    );
    Ok(json!({"success": true, "message": "PC berhasil dikunci untuk AFK"}))
}

pub async fn afk_unlock(
    st: &AppState,
    ip: &str,
    mac: &str,
    credential: &str,
) -> Result<Value, String> {
    let pc = cari_pc(st, ip, mac).await.ok_or("IP PC tidak terdaftar")?;
    let sesi = sesi_repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Tidak ada sesi aktif di PC ini")?;
    if !sesi.is_afk {
        return Ok(json!({"success": true, "message": "PC tidak dalam status AFK"}));
    }
    let kredensial = credential.trim();
    if kredensial.is_empty() {
        return Err("Password akun atau PIN wajib diisi".into());
    }
    let mut valid = match sesi.afk_pin.as_deref() {
        Some(pin) => verify_password(pin, kredensial),
        None => false,
    };
    if !valid && sesi.tipe == "member" {
        if let Some(mid) = sesi.member_id {
            if let Ok(Some(m)) = member_repo::get_by_id(&st.pool, mid).await {
                valid = verify_password(&m.password_hash, kredensial);
            }
        }
    }
    if !valid {
        logger::rec(
            "system",
            "CLIENT_AFK_UNLOCK_FAILED",
            &format!("Gagal buka kunci AFK di PC {} (Kredensial salah)", pc.kode),
        );
        return Err("KREDENSIAL:Password akun atau PIN salah".into());
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE sesi SET is_afk = 0, afk_pin = NULL, afk_sejak = NULL WHERE id = ?")
        .bind(sesi.id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({"success": true, "message": "Kunci meja berhasil dibuka"}))
}

pub async fn warnet_config(st: &AppState, host: &str) -> Value {
    let title = settings_service::get_or(st, "warnet_title", "TMBilling").await;
    let announcement = crate::utils::helpers::sanitize_html(
        &settings_service::get_or(st, "warnet_announcement", "").await,
    );
    let mut qris_path = settings_service::get_or(
        st,
        "qris_image_url",
        "/static/uploads/qris/default_qris.png",
    )
    .await;
    if !qris_path.starts_with('/') {
        qris_path = format!("/{}", qris_path.trim_start_matches('/'));
    }
    let base = {
        let configured = settings_service::get_or(st, "app_public_url", "").await;
        let chosen = if configured.is_empty() {
            host.to_string()
        } else {
            configured
        };
        chosen.trim_end_matches('/').to_string()
    };
    let paket = crate::repositories::paket::get_all(&st.pool, true, None, None)
        .await
        .map(|rows| rows.iter().map(|p| p.to_json()).collect::<Vec<_>>())
        .unwrap_or_default();
    let menu = crate::repositories::menu::get_all(&st.pool)
        .await
        .map(|rows| rows.iter().map(|m| m.to_json()).collect::<Vec<_>>())
        .unwrap_or_default();
    json!({
        "title": title,
        "announcement": announcement,
        "qris_url": format!("{base}{qris_path}"),
        "qris_path": qris_path,
        "paket": paket,
        "menu": menu,
    })
}

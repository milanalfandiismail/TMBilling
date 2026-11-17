//! Business logic PC: CRUD, arsip, batch IP range, Wake-on-LAN.

use crate::models::pc::{Pc, SesiRingkas};
use crate::repositories::grup as grup_repo;
use crate::repositories::pc as pc_repo;
use crate::state::AppState;
use crate::utils::{helpers, logger, validators};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::{Ipv4Addr, UdpSocket};

fn validasi_kode(kode: &str) -> Result<String, String> {
    let kode = kode.trim().to_uppercase();
    if kode.is_empty() {
        return Err("Kode PC wajib diisi".into());
    }
    if kode.chars().count() > 11 {
        return Err("Kode PC maksimal 11 karakter".into());
    }
    if !kode
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
    {
        return Err(
            "Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)"
                .into(),
        );
    }
    Ok(kode)
}

async fn grup_id_dari(st: &AppState, raw: Option<&str>) -> Result<Option<i64>, String> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if let Ok(id) = raw.parse::<i64>() {
        return Ok(Some(id));
    }
    Ok(grup_repo::find_by_nama(&st.pool, raw)
        .await
        .map_err(|e| e.to_string())?
        .map(|g| g.id))
}

pub fn screenshot_time(st: &AppState, kode: &str) -> Option<String> {
    let path = st
        .cfg
        .root
        .join("instance/uploads/screenshots")
        .join(format!("{kode}.png"));
    let meta = std::fs::metadata(&path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: chrono::DateTime<chrono::Utc> = modified.into();
    let tz = crate::utils::time::tz(&st.cfg.timezone);
    Some(
        dt.with_timezone(&tz)
            .format("%d/%m/%Y %H:%M:%S")
            .to_string(),
    )
}

pub async fn get_all(
    st: &AppState,
    aktif_only: bool,
    grup_raw: Option<&str>,
    search: Option<&str>,
) -> Result<(Vec<Pc>, HashMap<i64, SesiRingkas>), String> {
    let grup_id = grup_id_dari(st, grup_raw).await?;
    let mut rows = pc_repo::get_all(&st.pool, aktif_only, grup_id, search)
        .await
        .map_err(|e| e.to_string())?;
    rows.sort_by(|a, b| {
        (a.grup_id.unwrap_or(0), helpers::natural_sort_key(&a.kode))
            .cmp(&(b.grup_id.unwrap_or(0), helpers::natural_sort_key(&b.kode)))
    });
    let sesi = pc_repo::sesi_map(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok((rows, sesi))
}

pub async fn get_by_id(st: &AppState, id: i64) -> Result<Option<Pc>, String> {
    pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())
}

pub fn json_pc(st: &AppState, pc: &Pc, sesi: Option<&SesiRingkas>) -> Value {
    pc.to_json(sesi, screenshot_time(st, &pc.kode))
}

pub async fn create(st: &AppState, data: &Value, operator: &str) -> Result<Pc, String> {
    let kode = validasi_kode(data.get("kode").and_then(Value::as_str).unwrap_or(""))?;
    let existing = pc_repo::find_by_kode(&st.pool, &kode)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(pc) = &existing {
        if pc.active() {
            return Err(format!("PC dengan kode {kode} sudah ada"));
        }
    }

    let ip = validators::ip_address(data.get("ip_address").and_then(Value::as_str).unwrap_or(""))?;
    if let Some(ref ip) = ip {
        let bentrok = match &existing {
            Some(pc) => pc_repo::find_ip_exclude(&st.pool, ip, pc.id).await,
            None => pc_repo::find_by_ip(&st.pool, ip).await,
        }
        .map_err(|e| e.to_string())?;
        if bentrok.is_some() {
            return Err(format!("IP Address '{ip}' sudah digunakan oleh PC lain"));
        }
    }

    let mac = validators::mac_address(
        data.get("mac_address")
            .and_then(Value::as_str)
            .unwrap_or(""),
    )?;
    if let Some(ref mac) = mac {
        let bentrok = match &existing {
            Some(pc) => pc_repo::find_mac_exclude(&st.pool, mac, pc.id).await,
            None => pc_repo::find_by_mac(&st.pool, mac).await,
        }
        .map_err(|e| e.to_string())?;
        if bentrok.is_some() {
            return Err(format!("MAC Address '{mac}' sudah digunakan oleh PC lain"));
        }
    }

    let grup_nama = data
        .get("grup")
        .and_then(Value::as_str)
        .unwrap_or("reguler")
        .trim()
        .to_string();
    let grup = grup_repo::find_by_nama(&st.pool, &grup_nama)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Grup '{grup_nama}' tidak ditemukan. Buat dulu di menu Grup."))?;

    let nama_raw = data
        .get("nama")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let nama = validators::text(
        if nama_raw.is_empty() {
            &kode
        } else {
            &nama_raw
        },
        1,
        50,
        "Nama PC",
        false,
    )?;

    let _guard = st.write().await;
    let id = match &existing {
        Some(pc) => {
            sqlx::query("UPDATE pc SET aktif = 1, nama = ?, ip_address = ?, mac_address = ?, grup_id = ? WHERE id = ?")
                .bind(&nama)
                .bind(&ip)
                .bind(&mac)
                .bind(grup.id)
                .bind(pc.id)
                .execute(&st.pool)
                .await
                .map_err(|e| e.to_string())?;
            pc.id
        }
        None => {
            let res = sqlx::query("INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif) VALUES (?, ?, ?, ?, ?, 1)")
                .bind(&kode)
                .bind(&nama)
                .bind(&ip)
                .bind(&mac)
                .bind(grup.id)
                .execute(&st.pool)
                .await
                .map_err(|e| e.to_string())?;
            res.last_insert_rowid()
        }
    };

    logger::audit_json(
        operator,
        "TAMBAH_PC",
        &format!("PC {kode} ({grup_nama}) didaftarkan"),
        None,
        "",
        "",
        json!({"kode": kode, "nama": nama, "ip_address": ip, "mac_address": mac, "grup": grup_nama}),
    );
    st.pc_network.invalidate();
    pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "PC tidak ditemukan".into())
}

pub async fn update(st: &AppState, id: i64, data: &Value, operator: &str) -> Result<Pc, String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;

    let mut kode = pc.kode.clone();
    if let Some(raw) = data.get("kode").and_then(Value::as_str) {
        let baru = validasi_kode(raw)?;
        if baru != pc.kode {
            if pc_repo::find_by_kode(&st.pool, &baru)
                .await
                .map_err(|e| e.to_string())?
                .is_some()
            {
                return Err(format!("Kode PC '{baru}' sudah digunakan"));
            }
            kode = baru;
        }
    }

    let mut grup_id = pc.grup_id;
    if let Some(nama_grup) = data.get("grup").and_then(Value::as_str) {
        let grup = grup_repo::find_by_nama(&st.pool, nama_grup.trim())
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Grup tidak valid")?;
        grup_id = Some(grup.id);
    }

    let mut ip = pc.ip_address.clone();
    if data.get("ip_address").is_some() {
        let baru =
            validators::ip_address(data.get("ip_address").and_then(Value::as_str).unwrap_or(""))?;
        if let Some(ref baru) = baru {
            if Some(baru.clone()) != pc.ip_address
                && pc_repo::find_by_ip(&st.pool, baru)
                    .await
                    .map_err(|e| e.to_string())?
                    .is_some()
            {
                return Err(format!("IP Address '{baru}' sudah digunakan oleh PC lain"));
            }
        }
        ip = baru;
    }

    let mut mac = pc.mac_address.clone();
    if data.get("mac_address").is_some() {
        let baru = validators::mac_address(
            data.get("mac_address")
                .and_then(Value::as_str)
                .unwrap_or(""),
        )?;
        if let Some(ref baru) = baru {
            if Some(baru.clone()) != pc.mac_address
                && pc_repo::find_by_mac(&st.pool, baru)
                    .await
                    .map_err(|e| e.to_string())?
                    .is_some()
            {
                return Err(format!("MAC Address '{baru}' sudah digunakan oleh PC lain"));
            }
        }
        mac = baru;
    }

    let mut nama = pc.nama.clone();
    if let Some(raw) = data.get("nama").and_then(Value::as_str) {
        nama = Some(validators::text(raw, 1, 50, "Nama PC", false)?);
    }

    let _guard = st.write().await;
    sqlx::query("UPDATE pc SET kode = ?, nama = ?, ip_address = ?, mac_address = ?, grup_id = ? WHERE id = ?")
        .bind(&kode)
        .bind(&nama)
        .bind(&ip)
        .bind(&mac)
        .bind(grup_id)
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "EDIT_PC",
        &format!("Data PC {kode} diperbarui"),
        None,
        "",
        "",
        json!({"kode": kode, "nama": nama, "ip_address": ip, "mac_address": mac}),
    );
    st.pc_network.invalidate();
    pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "PC tidak ditemukan".into())
}

pub async fn archive(st: &AppState, id: i64, operator: &str) -> Result<String, String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    let _guard = st.write().await;
    if pc_repo::count_aktif_sesi(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        > 0
    {
        return Err(format!(
            "PC {} tidak dapat diarsipkan karena sedang digunakan dalam sesi aktif.",
            pc.kode
        ));
    }
    sqlx::query("UPDATE pc SET aktif = 0 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    st.pc_network.invalidate();
    logger::audit_json(
        operator,
        "ARSIP_PC",
        &format!("PC:{} diarsipkan", pc.kode),
        None,
        "",
        "",
        json!({"kode": pc.kode, "pc_id": id}),
    );
    Ok(format!("PC {} diarsipkan", pc.kode))
}

pub async fn restore(st: &AppState, id: i64, operator: &str) -> Result<String, String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    if pc.active() {
        return Err("PC tidak dalam arsip".into());
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE pc SET aktif = 1 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    st.pc_network.invalidate();
    logger::audit_json(
        operator,
        "RESTORE_PC",
        &format!("PC:{} dipulihkan dari arsip", pc.kode),
        None,
        "",
        "",
        json!({"kode": pc.kode, "pc_id": id}),
    );
    Ok(format!("PC {} dipulihkan", pc.kode))
}

/// Hapus permanen: riwayat sesi dilepas (pc_id NULL), data anak ikut dihapus.
pub async fn delete(st: &AppState, id: i64, operator: &str) -> Result<String, String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    let _guard = st.write().await;
    if pc_repo::count_aktif_sesi(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        > 0
    {
        return Err(format!(
            "PC {} tidak dapat dihapus karena sedang digunakan dalam sesi aktif. Harap selesaikan sesi terlebih dahulu.",
            pc.kode
        ));
    }
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    for sql in [
        "UPDATE sesi SET pc_id = NULL WHERE pc_id = ?",
        "DELETE FROM pc_uptime_log WHERE pc_id = ?",
        "DELETE FROM hardware_monitor WHERE pc_id = ?",
        "DELETE FROM pc_process WHERE pc_id = ?",
        "DELETE FROM maintenance_ticket WHERE pc_id = ?",
        "DELETE FROM pc WHERE id = ?",
    ] {
        sqlx::query(sql)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    st.pc_network.invalidate();
    st.online.forget(id);
    let shot = st
        .cfg
        .root
        .join("instance/uploads/screenshots")
        .join(format!("{}.png", pc.kode));
    let _ = std::fs::remove_file(shot);
    logger::audit_json(
        operator,
        "HAPUS_PC",
        &format!(
            "PC:{} dihapus permanen beserta seluruh dependensinya",
            pc.kode
        ),
        None,
        "",
        "",
        json!({"kode": pc.kode, "pc_id": id}),
    );
    Ok(format!("PC {} berhasil dihapus", pc.kode))
}

pub async fn update_position(st: &AppState, id: i64, data: &Value) -> Result<Pc, String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    let pos_x = validators::int_range(
        data.get("pos_x").unwrap_or(&Value::Null),
        -1,
        10000,
        "Posisi X",
    )?;
    let pos_y = validators::int_range(
        data.get("pos_y").unwrap_or(&Value::Null),
        -1,
        10000,
        "Posisi Y",
    )?;
    let _guard = st.write().await;
    sqlx::query("UPDATE pc SET pos_x = ?, pos_y = ? WHERE id = ?")
        .bind(pos_x)
        .bind(pos_y)
        .bind(pc.id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "PC tidak ditemukan".into())
}

/// Matikan mode admin paksa; sesi admin/guest ditutup tanpa nota transaksi.
pub async fn reset_admin_mode(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let pc = pc_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    let _guard = st.write().await;
    sqlx::query("UPDATE pc SET is_admin_mode = 0 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    // Tutup lewat service agar nota `tutup_sesi` (Rp0) dan uptime tercatat, seperti Python.
    let sesi_aktif: Option<(i64, Option<String>)> = sqlx::query_as(
        "SELECT id, tipe FROM sesi WHERE pc_id = ? AND status = 'aktif' ORDER BY id DESC LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    if let Some((sesi_id, tipe)) = sesi_aktif {
        let tipe = tipe.unwrap_or_default();
        if tipe == "admin" || tipe == "guest" {
            crate::services::sesi::sesi_service::tutup_locked(st, sesi_id, operator).await?;
        }
    }
    // Client kembali ke kiosk segera.
    st.commands.regular.push(id, "lock");
    st.pc_network.invalidate();
    logger::audit_json(
        operator,
        "RESET_ADMIN",
        &format!("Mode Admin PC {} dimatikan paksa", pc.kode),
        None,
        "",
        "",
        json!({"kode": pc.kode}),
    );
    Ok(())
}

pub async fn create_batch(
    st: &AppState,
    data: &Value,
    operator: &str,
) -> Result<Vec<String>, String> {
    let prefix = data
        .get("prefix")
        .and_then(Value::as_str)
        .unwrap_or("PC")
        .trim()
        .to_uppercase();
    let prefix = prefix.trim_end_matches(['-', '_']).to_string();
    if prefix.chars().count() > 6 {
        return Err("Prefix Kode PC maksimal 6 karakter".into());
    }
    if !prefix.is_empty()
        && !prefix
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
    {
        return Err("Prefix Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)".into());
    }

    let angka = |key: &str, default: i64| -> Result<i64, String> {
        match data.get(key) {
            None => Ok(default),
            Some(v) => match v
                .as_i64()
                .or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()))
            {
                Some(n) => Ok(n),
                None => Err("Nomor unit harus berupa angka valid".into()),
            },
        }
    };
    let start = angka("start_num", 1)?;
    let end = angka("end_num", 1)?;
    if start < 1 || end > 9999 || start.to_string().len() > 4 || end.to_string().len() > 4 {
        return Err("Nomor unit harus berada di antara 1 sampai 9999 (maksimal 4 digit)".into());
    }
    if start > end {
        return Err(format!(
            "Nomor awal ({start}) tidak boleh lebih besar dari nomor akhir ({end})"
        ));
    }
    let jumlah = end - start + 1;

    let grup_nama = data
        .get("grup")
        .and_then(Value::as_str)
        .unwrap_or("reguler")
        .trim()
        .to_string();
    let grup = grup_repo::find_by_nama(&st.pool, &grup_nama)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Grup {grup_nama} tidak ditemukan"))?;

    let ip_start = data
        .get("ip_start")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let ip_end = data
        .get("ip_end")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if ip_start.is_empty() {
        return Err("IP Address Awal wajib diisi".into());
    }
    if ip_end.is_empty() {
        return Err("IP Address Akhir wajib diisi".into());
    }
    let awal: Ipv4Addr = ip_start.parse().map_err(|_| {
        format!("Format IP Address Awal '{ip_start}' tidak valid (wajib format IPv4 X.X.X.X)")
    })?;
    let akhir: Ipv4Addr = ip_end.parse().map_err(|_| {
        format!("Format IP Address Akhir '{ip_end}' tidak valid (wajib format IPv4 X.X.X.X)")
    })?;
    let (awal_u, akhir_u) = (u32::from(awal), u32::from(akhir));
    if awal_u > akhir_u {
        return Err(format!(
            "IP Address Awal ({ip_start}) tidak boleh lebih besar dari IP Address Akhir ({ip_end})"
        ));
    }
    let ip_count = (akhir_u - awal_u) as i64 + 1;
    if ip_count != jumlah {
        let arah = if ip_count < jumlah {
            "kurang"
        } else {
            "lebih banyak"
        };
        return Err(format!(
            "Rentang IP Address ({ip_count} IP: {ip_start} s/d {ip_end}) {arah} dari jumlah unit PC yang akan didaftarkan ({jumlah} PC: unit {start} s/d {end}). Harap sesuaikan IP Address Akhir!"
        ));
    }

    let kode_untuk = |n: i64| {
        if prefix.is_empty() {
            n.to_string()
        } else {
            format!("{prefix}-{n}")
        }
    };

    // Fase 1: validasi seluruh kode & IP sebelum satu baris pun disimpan.
    let mut rencana: Vec<(String, String)> = Vec::new();
    for i in start..=end {
        let kode = kode_untuk(i);
        if kode.chars().count() > 11 {
            return Err(format!(
                "Kode PC '{kode}' melebihi batas maksimal 11 karakter"
            ));
        }
        let ip = Ipv4Addr::from(awal_u + (i - start) as u32).to_string();
        let kode_pc = pc_repo::find_by_kode(&st.pool, &kode)
            .await
            .map_err(|e| e.to_string())?;
        if let Some(pc) = &kode_pc {
            if pc.active() {
                return Err(format!("Kode PC {kode} sudah ada di database"));
            }
        }
        if let Some(ip_pc) = pc_repo::find_by_ip(&st.pool, &ip)
            .await
            .map_err(|e| e.to_string())?
        {
            if kode_pc.as_ref().map(|k| k.id) != Some(ip_pc.id) {
                return Err(format!(
                    "PC {kode} dengan IP {ip} bentrok dengan PC {}",
                    ip_pc.kode
                ));
            }
        }
        rencana.push((kode, ip));
    }

    let _guard = st.write().await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let mut added = Vec::new();
    for (kode, ip) in &rencana {
        sqlx::query(
            "INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif) VALUES (?, ?, ?, NULL, ?, 1)              ON CONFLICT(kode) DO UPDATE SET nama = excluded.nama, ip_address = excluded.ip_address, grup_id = excluded.grup_id, aktif = 1",
        )
        .bind(kode)
        .bind(kode)
        .bind(ip)
        .bind(grup.id)
        .execute(&mut *tx)
        .await
        .map_err(|_| "Kode atau IP PC sudah dipakai".to_string())?;
        added.push(kode.clone());
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    st.pc_network.invalidate();
    logger::audit_json(
        operator,
        "BATCH_PC",
        &format!(
            "Tambah {} PC via IP Range ({ip_start} - {ip_end})",
            added.len()
        ),
        None,
        "",
        "",
        json!({"jumlah_ditambahkan": added.len(), "daftar_kode": added, "grup": grup_nama, "ip_range": format!("{ip_start} - {ip_end}")}),
    );
    Ok(added)
}

/// Magic packet 6×0xFF + MAC×16 ke broadcast port 9.
pub fn send_magic_packet(mac: &str) -> Result<(), String> {
    if mac.is_empty() {
        return Err("MAC Address tidak boleh kosong".into());
    }
    let bersih = mac.replace(':', "").replace('-', "").to_uppercase();
    if bersih.len() != 12 || !bersih.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!("Format MAC Address tidak valid: {mac}"));
    }
    let bytes: Vec<u8> = (0..6)
        .map(|i| u8::from_str_radix(&bersih[i * 2..i * 2 + 2], 16).unwrap_or(0))
        .collect();
    let mut packet = vec![0xFFu8; 6];
    for _ in 0..16 {
        packet.extend_from_slice(&bytes);
    }
    // shortcut: satu broadcast ke 255.255.255.255:9; kirim per-interface bila router memblokir broadcast.
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    socket
        .send_to(&packet, "255.255.255.255:9")
        .map_err(|_| "Gagal mengirim WOL packet ke semua interface".to_string())?;
    Ok(())
}

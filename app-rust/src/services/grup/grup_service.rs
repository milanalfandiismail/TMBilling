//! Business logic grup: validasi nama/warna, arsip berantai, hapus berproteksi.

use crate::models::grup::Grup;
use crate::repositories::grup as grup_repo;
use crate::state::AppState;
use crate::utils::{logger, validators};
use serde_json::{json, Value};

fn validasi_nama(raw: &str) -> Result<String, String> {
    let cleaned = validators::text(raw, 2, 30, "Nama grup", true)?.to_lowercase();
    if !cleaned
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, ' ' | '_' | '-'))
    {
        return Err(
            "Nama grup hanya boleh berisi huruf, angka, spasi, garis bawah (_), atau minus (-)"
                .into(),
        );
    }
    Ok(cleaned)
}

fn validasi_warna(raw: Option<&str>) -> String {
    let hex = raw.unwrap_or("").trim().trim_start_matches('#');
    if hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        format!("#{}", hex.to_uppercase())
    } else {
        "#888888".into()
    }
}

fn keterangan(data: &Value) -> Result<String, String> {
    validators::text(
        data.get("keterangan").and_then(Value::as_str).unwrap_or(""),
        0,
        200,
        "Keterangan",
        false,
    )
}

async fn hitung(st: &AppState, sql: &str, id: i64) -> Result<i64, String> {
    let row: (i64,) = sqlx::query_as(sql)
        .bind(id)
        .fetch_one(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.0)
}

pub async fn get_all(st: &AppState, aktif_only: bool) -> anyhow::Result<Vec<Grup>> {
    grup_repo::get_all(&st.pool, aktif_only).await
}

pub async fn create(st: &AppState, data: &Value, operator: &str) -> Result<Grup, String> {
    let nama = validasi_nama(data.get("nama").and_then(Value::as_str).unwrap_or(""))?;
    let warna = validasi_warna(data.get("warna").and_then(Value::as_str));
    let ket = keterangan(data)?;
    if grup_repo::find_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Grup sudah ada".into());
    }
    let _guard = st.write().await;
    sqlx::query("INSERT INTO grup (nama, warna, keterangan, aktif) VALUES (?, ?, ?, 1)")
        .bind(&nama)
        .bind(&warna)
        .bind(&ket)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "TAMBAH_GRUP",
        &format!("Grup baru: {nama}"),
        None,
        "",
        "",
        json!({"nama": nama, "keterangan": ket, "warna": warna}),
    );
    grup_repo::find_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Grup tidak ditemukan".into())
}

pub async fn update(st: &AppState, id: i64, data: &Value, operator: &str) -> Result<Grup, String> {
    let grup = grup_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Grup tidak ditemukan")?;
    let nama = match data.get("nama") {
        Some(_) => {
            let nama = validasi_nama(data.get("nama").and_then(Value::as_str).unwrap_or(""))?;
            if nama != grup.nama.to_lowercase()
                && grup_repo::find_by_nama(&st.pool, &nama)
                    .await
                    .map_err(|e| e.to_string())?
                    .is_some()
            {
                return Err("Nama grup sudah digunakan oleh grup lain".into());
            }
            nama
        }
        None => grup.nama.clone(),
    };
    let ket = if data.get("keterangan").is_some() {
        Some(keterangan(data)?)
    } else {
        grup.keterangan.clone()
    };
    let warna = if data.get("warna").is_some() {
        validasi_warna(data.get("warna").and_then(Value::as_str))
    } else {
        grup.warna.clone().unwrap_or_else(|| "#888888".into())
    };
    let _guard = st.write().await;
    sqlx::query("UPDATE grup SET nama = ?, keterangan = ?, warna = ? WHERE id = ?")
        .bind(&nama)
        .bind(&ket)
        .bind(&warna)
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "EDIT_GRUP",
        &format!("Grup {nama} diupdate"),
        None,
        "",
        "",
        json!({"nama": nama, "keterangan": ket, "warna": warna}),
    );
    grup_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Grup tidak ditemukan".into())
}

/// Arsip berantai: PC, paket, dan member aktif di grup ikut dinonaktifkan.
pub async fn archive(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let grup = grup_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Grup tidak ditemukan")?;
    if !grup.active() {
        return Err("Grup tidak dalam arsip".into());
    }
    let _guard = st.write().await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let sesi_aktif: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sesi s JOIN pc p ON p.id = s.pc_id WHERE p.grup_id = ? AND s.status = 'aktif'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    if sesi_aktif.0 > 0 {
        return Err("Masih ada sesi aktif di grup ini".into());
    }
    let mut jumlah = [0u64; 3];
    for (i, sql) in [
        "UPDATE pc SET aktif = 0 WHERE grup_id = ? AND aktif = 1",
        "UPDATE paket SET aktif = 0 WHERE grup_id = ? AND aktif = 1",
        "UPDATE member SET aktif = 0 WHERE grup_id = ? AND aktif = 1",
    ]
    .iter()
    .enumerate()
    {
        jumlah[i] = sqlx::query(sql)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
            .rows_affected();
    }
    sqlx::query("UPDATE grup SET aktif = 0 WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "ARSIP_GRUP",
        &format!("Grup {} diarsipkan", grup.nama),
        None,
        "",
        "",
        json!({"nama_grup": grup.nama, "pc": jumlah[0], "paket": jumlah[1], "member": jumlah[2]}),
    );
    Ok(())
}

pub async fn restore(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let grup = grup_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Grup tidak ditemukan")?;
    if grup.active() {
        return Err("Grup tidak dalam arsip".into());
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE grup SET aktif = 1 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "RESTORE_GRUP",
        &format!("Grup {} dipulihkan dari arsip", grup.nama),
        None,
        "",
        "",
        json!({"nama_grup": grup.nama}),
    );
    Ok(())
}

pub async fn delete(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let grup = grup_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Grup tidak ditemukan")?;
    let _guard = st.write().await;
    if hitung(st, "SELECT COUNT(*) FROM member WHERE grup_id = ?", id).await? > 0 {
        return Err(format!(
            "Grup {} tidak bisa dihapus karena masih ada Member",
            grup.nama
        ));
    }
    if hitung(st, "SELECT COUNT(*) FROM pc WHERE grup_id = ?", id).await? > 0 {
        return Err(format!(
            "Grup {} masih digunakan oleh beberapa PC",
            grup.nama
        ));
    }
    if hitung(st, "SELECT COUNT(*) FROM paket WHERE grup_id = ?", id).await? > 0 {
        return Err(format!("Grup {} masih memiliki paket", grup.nama));
    }
    sqlx::query("DELETE FROM grup WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "HAPUS_GRUP",
        &format!("Grup {} dihapus", grup.nama),
        None,
        "",
        "",
        json!({"nama_grup": grup.nama}),
    );
    Ok(())
}

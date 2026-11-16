//! Business logic paket: validasi rentang, proteksi hapus bila dipakai sesi aktif.

use crate::models::paket::Paket;
use crate::repositories::{grup as grup_repo, paket as paket_repo};
use crate::state::AppState;
use crate::utils::{logger, validators};
use serde_json::{json, Value};

const FIELD_DURASI: &str = "Durasi paket (menit)";
const FIELD_HARGA: &str = "Harga paket";
const FIELD_KADALUARSA: &str = "Masa berlaku paket (hari)";

pub async fn get_all(
    st: &AppState,
    aktif_only: bool,
    grup: Option<&str>,
    search: Option<&str>,
) -> anyhow::Result<Vec<Paket>> {
    let grup_id = match grup {
        Some(raw) if !raw.is_empty() && raw != "null" && raw != "undefined" => {
            match raw.parse::<i64>() {
                Ok(id) => Some(id),
                Err(_) => grup_repo::find_by_nama(&st.pool, raw).await?.map(|g| g.id),
            }
        }
        _ => None,
    };
    paket_repo::get_all(&st.pool, aktif_only, grup_id, search).await
}

pub async fn create(st: &AppState, data: &Value, operator: &str) -> Result<Paket, String> {
    let nama = validators::text(
        data.get("nama").and_then(Value::as_str).unwrap_or(""),
        2,
        50,
        "Nama paket",
        true,
    )?;
    let durasi = validators::int_range(
        data.get("durasi_menit").unwrap_or(&Value::Null),
        1,
        14400,
        FIELD_DURASI,
    )?;
    let harga = validators::int_range(
        data.get("harga").unwrap_or(&Value::Null),
        0,
        1_000_000_000,
        FIELD_HARGA,
    )?;
    let kadaluarsa = validators::int_range(
        data.get("kadaluarsa_hari").unwrap_or(&json!(30)),
        1,
        3650,
        FIELD_KADALUARSA,
    )?;
    if paket_repo::find_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err(format!("Paket dengan nama '{nama}' sudah ada"));
    }
    let grup_nama = data
        .get("grup")
        .and_then(Value::as_str)
        .unwrap_or("reguler");
    let grup = grup_repo::find_by_nama(&st.pool, grup_nama)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Grup '{grup_nama}' tidak ditemukan. Buat grupnya dulu bang."))?;

    let _guard = st.write().await;
    sqlx::query(
        "INSERT INTO paket (nama, durasi_menit, harga, kadaluarsa_hari, grup_id, aktif) VALUES (?, ?, ?, ?, ?, 1)",
    )
    .bind(&nama)
    .bind(durasi)
    .bind(harga)
    .bind(kadaluarsa)
    .bind(grup.id)
    .execute(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "TAMBAH_PAKET",
        &format!("Paket {nama} ({grup_nama}) berhasil dibuat"),
        None,
        "",
        "",
        json!({"nama": nama, "durasi_menit": durasi, "harga": harga, "kadaluarsa_hari": kadaluarsa, "grup": grup_nama}),
    );
    paket_repo::find_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Paket tidak ditemukan".into())
}

pub async fn update(st: &AppState, id: i64, data: &Value, operator: &str) -> Result<Paket, String> {
    let paket = paket_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;
    let mut perubahan = serde_json::Map::new();

    let mut nama = paket.nama.clone();
    if data.get("nama").is_some() {
        nama = validators::text(
            data.get("nama").and_then(Value::as_str).unwrap_or(""),
            2,
            50,
            "Nama paket",
            true,
        )?;
        if nama != paket.nama
            && paket_repo::find_by_nama_exclude(&st.pool, &nama, id)
                .await
                .map_err(|e| e.to_string())?
                .is_some()
        {
            return Err(format!("Nama paket '{nama}' sudah dipakai paket lain"));
        }
    }

    let grup_id = match data.get("grup").and_then(Value::as_str) {
        Some(nama_grup) => {
            let grup = grup_repo::find_by_nama(&st.pool, nama_grup)
                .await
                .map_err(|e| e.to_string())?
                .ok_or("Grup yang dipilih tidak valid")?;
            if paket.grup_id != Some(grup.id) {
                perubahan.insert(
                    "grup".into(),
                    json!({"lama": paket.grup_nama.clone(), "baru": grup.nama}),
                );
            }
            Some(grup.id)
        }
        None => paket.grup_id,
    };

    let durasi = match data.get("durasi_menit") {
        Some(_) => validators::int_range(
            data.get("durasi_menit").unwrap_or(&Value::Null),
            1,
            14400,
            FIELD_DURASI,
        )?,
        None => paket.durasi_menit,
    };
    let harga = match data.get("harga") {
        Some(_) => validators::int_range(
            data.get("harga").unwrap_or(&Value::Null),
            0,
            1_000_000_000,
            FIELD_HARGA,
        )?,
        None => paket.harga,
    };
    let kadaluarsa = match data.get("kadaluarsa_hari") {
        Some(_) => validators::int_range(
            data.get("kadaluarsa_hari").unwrap_or(&Value::Null),
            1,
            3650,
            FIELD_KADALUARSA,
        )?,
        None => paket.kadaluarsa_hari.unwrap_or(30),
    };
    let aktif = match data.get("aktif") {
        Some(v) => {
            let flag = match v {
                Value::Bool(b) => *b,
                Value::Number(n) => n.as_i64().unwrap_or(0) != 0,
                Value::String(s) => {
                    matches!(s.trim().to_lowercase().as_str(), "true" | "1" | "yes")
                }
                _ => false,
            };
            if flag != paket.active() {
                perubahan.insert(
                    "aktif".into(),
                    json!({"lama": paket.active(), "baru": flag}),
                );
            }
            if flag {
                1
            } else {
                0
            }
        }
        None => {
            if paket.active() {
                1
            } else {
                0
            }
        }
    };

    let _guard = st.write().await;
    sqlx::query(
        "UPDATE paket SET nama = ?, grup_id = ?, durasi_menit = ?, harga = ?, kadaluarsa_hari = ?, aktif = ? WHERE id = ?",
    )
    .bind(&nama)
    .bind(grup_id)
    .bind(durasi)
    .bind(harga)
    .bind(kadaluarsa)
    .bind(aktif)
    .bind(id)
    .execute(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "EDIT_PAKET",
        &format!("Data paket {nama} diperbarui"),
        None,
        "",
        "",
        Value::Object(perubahan),
    );
    paket_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Paket tidak ditemukan".into())
}

pub async fn archive(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let paket = paket_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;
    let _guard = st.write().await;
    sqlx::query("UPDATE paket SET aktif = 0 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "ARSIP_PAKET",
        &format!("Paket {} diarsipkan", paket.nama),
        None,
        "",
        "",
        json!({"nama_paket": paket.nama, "paket_id": id}),
    );
    Ok(())
}

pub async fn restore(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let paket = paket_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;
    if paket.active() {
        return Err("Paket tidak dalam arsip".into());
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE paket SET aktif = 1 WHERE id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "RESTORE_PAKET",
        &format!("Paket {} dipulihkan dari arsip", paket.nama),
        None,
        "",
        "",
        json!({"nama_paket": paket.nama, "paket_id": id}),
    );
    Ok(())
}

/// Hapus permanen: riwayat sesi/transaksi dilepas (`paket_id = NULL`), bukan dihapus.
pub async fn delete(st: &AppState, id: i64, operator: &str) -> Result<(), String> {
    let paket = paket_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;
    if paket_repo::count_aktif_sesi(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        > 0
    {
        return Err("Paket ini sedang dipakai member/guest yang sedang main!".into());
    }
    let _guard = st.write().await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE sesi SET paket_id = NULL WHERE paket_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE transaksi SET paket_id = NULL WHERE paket_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM paket WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "HAPUS_PAKET",
        &format!("Paket {} dihapus permanen", paket.nama),
        None,
        "",
        "",
        json!({"nama_paket": paket.nama}),
    );
    Ok(())
}

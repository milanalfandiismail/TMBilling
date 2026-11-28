//! Deteksi & pemulihan sesi pasca mati lampu (blackout).

use chrono::Duration;
use serde_json::{json, Value};

use crate::models::sesi::Sesi;
use crate::repositories::{member as member_repo, pc as pc_repo, sesi as repo};
use crate::services::sesi::sesi_service;
use crate::state::AppState;
use crate::utils::logger;
use crate::utils::time::{day_range_utc, db_str, now_db, parse_dt, today_local};

/// Threshold default (menit) bila tidak ada parameter: `BLACKOUT_THRESHOLD_MINUTES` (default 60).
pub fn threshold_default() -> i64 {
    std::env::var("BLACKOUT_THRESHOLD_MINUTES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(60)
}

fn label(sesi: &Sesi) -> String {
    match sesi.tipe.as_str() {
        "member" => format!(
            "Member:{}",
            sesi.member_username.clone().unwrap_or_default()
        ),
        _ => format!(
            "Guest:{}",
            sesi.nama_guest.clone().unwrap_or_else(|| "Guest".into())
        ),
    }
}

/// Tandai sesi yang heartbeat-nya lewat threshold sebagai suspect blackout.
pub async fn deteksi(st: &AppState, menit_threshold: Option<i64>) -> Result<i64, String> {
    let _guard = st.write().await;
    let threshold = menit_threshold.unwrap_or_else(threshold_default);
    let now = now_db();
    let batas = db_str(now - Duration::minutes(threshold));
    let kandidat = repo::stale_aktif(&st.pool, &batas)
        .await
        .map_err(|e| e.to_string())?;
    let mut total = 0;
    for kandidat in kandidat {
        // Baca ulang: heartbeat bisa masuk di antara query dan update.
        let Some(sesi) = repo::get_aktif_by_id(&st.pool, kandidat.id)
            .await
            .map_err(|e| e.to_string())?
        else {
            continue;
        };
        if sesi.is_blackout_suspect {
            continue;
        }
        if let Some(sync) = sesi.last_sync.as_deref().and_then(parse_dt) {
            if sync >= now - Duration::minutes(threshold) {
                continue;
            }
        }
        let sisa_dashboard = sesi.sisa_menit(now);
        let referensi = sesi
            .last_sync
            .as_deref()
            .and_then(parse_dt)
            .or_else(|| sesi.mulai_pada.as_deref().and_then(parse_dt))
            .unwrap_or(now);
        let sisa_audit = sesi.hitung_sisa_pada(referensi);

        let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
        if sesi.tipe == "member" {
            if let Some(member_id) = sesi.member_id {
                let _ = sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
                    .bind(sisa_audit)
                    .bind(member_id)
                    .execute(&mut *tx)
                    .await;
            }
        }
        sqlx::query(
            "UPDATE sesi SET is_blackout_suspect = 1, is_blackout_resolved = 0, \
             sisa_menit_saat_mati = ?, status = 'selesai', selesai_pada = ? WHERE id = ?",
        )
        .bind(sisa_audit)
        .bind(db_str(referensi))
        .bind(sesi.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        total += 1;
        logger::audit_json(
            "system",
            "BLACKOUT_DETECT",
            &format!(
                "#{} | Dash: {}m | Audit: {}m",
                sesi.id, sisa_dashboard, sisa_audit
            ),
            None,
            "",
            "",
            json!({
                "sesi_id": sesi.id,
                "pc_kode": sesi.pc_kode,
                "sisa_dashboard": sisa_dashboard,
                "sisa_audit": sisa_audit,
                "tipe": sesi.tipe,
            }),
        );
    }
    if total > 0 {
        logger::audit_json(
            "system",
            "BLACKOUT_DETECT",
            &format!("{total} sesi terdeteksi blackout"),
            None,
            "",
            "",
            json!({"total": total}),
        );
    }
    Ok(total)
}

pub async fn audit_list(st: &AppState, date: Option<&str>) -> Result<Value, String> {
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let range = match date.map(str::trim).filter(|d| !d.is_empty()) {
        Some(raw) => {
            let hari = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d")
                .map_err(|_| "Format tanggal tidak valid".to_string())?;
            Some(day_range_utc(hari, &tz))
        }
        None => None,
    };
    let daftar = repo::blackout_audit_list(&st.pool, range)
        .await
        .map_err(|e| e.to_string())?;
    let items: Vec<Value> = daftar
        .iter()
        .map(|s| s.to_json_audit(&tz))
        .collect();
    Ok(json!({"data": items, "total": items.len()}))
}

pub async fn audit_dates(st: &AppState) -> Vec<String> {
    let mentah = repo::blackout_audit_dates(&st.pool)
        .await
        .unwrap_or_default();
    let tz_name = crate::services::settings::settings_service::active_timezone(st).await;
    let mut hasil: Vec<String> = mentah
        .iter()
        .filter_map(|s| parse_dt(s))
        .map(|dt| crate::utils::time::format_local(dt, &tz_name, "%Y-%m-%d"))
        .collect();
    hasil.sort();
    hasil.dedup();
    hasil.reverse();
    hasil
}


pub async fn resolve_member(st: &AppState, sesi_id: i64, operator: &str) -> Result<Value, String> {
    let _guard = st.write().await;
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| s.tipe == "member" && s.is_blackout_suspect && !s.is_blackout_resolved)
        .ok_or("Sesi tidak valid untuk di-resolve")?;
    let member_id = sesi.member_id.ok_or("Sesi tidak valid untuk di-resolve")?;
    if repo::get_aktif_by_member(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Member masih punya sesi aktif; selesaikan sesi itu dulu".into());
    }
    let Some(member) = member_repo::get_by_id(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err("Sesi tidak valid untuk di-resolve".into());
    };
    let now = now_db();
    let saldo = if member.kadaluarsa(now) {
        0
    } else {
        sesi.sisa_menit_saat_mati
    };
    let user_id = crate::services::transaksi::user_id(&st.pool, operator).await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
        .bind(saldo)
        .bind(member_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query(
        "UPDATE sesi SET is_blackout_resolved = 1, waktu_resolved = ? WHERE id = ?",
    )
    .bind(db_str(now))
    .bind(sesi.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO transaksi (sesi_id, member_id, user_id, jenis, jumlah, menit, keterangan, \
         dibuat_pada, is_refunded, operator) VALUES (?, ?, ?, 'blackout_refund', 0, ?, ?, ?, 0, ?)",
    )
    .bind(sesi.id)
    .bind(member_id)
    .bind(user_id)
    .bind(saldo)
    .bind(format!("Refund blackout: {saldo}m ke {}", member.username))
    .bind(db_str(now))
    .bind(operator)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "BLACKOUT_RESOLVE_MEMBER",
        &format!("Member:{} | Saldo: {saldo}m", member.username),
        None,
        "",
        "",
        json!({"sesi_id": sesi.id, "saldo": saldo}),
    );
    Ok(json!({"saldo_kembali": saldo, "username": member.username}))
}

async fn buka_ulang_guest(
    st: &AppState,
    sesi: &Sesi,
    pc_id: i64,
    operator: &str,
) -> Result<Value, String> {
    let now = now_db();
    let now_str = db_str(now);
    let asal = sesi.sesi_asal_id.unwrap_or(sesi.id);
    let sisa = sesi.sisa_menit_saat_mati;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query(
        "UPDATE sesi SET status = 'selesai', is_blackout_resolved = 1, waktu_resolved = ?, \
         is_afk = 0, afk_pin = NULL, afk_sejak = NULL WHERE id = ?",
    )
    .bind(&now_str)
    .bind(sesi.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let baru: i64 = sqlx::query_scalar(
        "INSERT INTO sesi (tipe, pc_id, paket_id, nama_guest, token_sesi, mulai_pada, \
         durasi_beli_menit, total_bayar, status, is_admin, waktu_mulai_sesi, \
         waktu_tersimpan_awal, sesi_asal_id, menit_pause_total, sisa_menit_saat_mati, \
         is_blackout_suspect, is_blackout_resolved, is_afk) \
         VALUES ('guest', ?, ?, ?, ?, ?, ?, ?, 'aktif', 0, ?, ?, ?, 0, 0, 0, 0, 0) RETURNING id",
    )
    .bind(pc_id)
    .bind(sesi.paket_id)
    .bind(&sesi.nama_guest)
    .bind(sesi_service::token_sesi())
    .bind(&now_str)
    .bind(sisa)
    .bind(sesi.total_bayar)
    .bind(&now_str)
    .bind(sisa)
    .bind(asal)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    let _ = operator;
    Ok(json!({"sesi_id": baru, "sisa_menit": sisa}))
}

pub async fn resolve_guest_sama(
    st: &AppState,
    sesi_id: i64,
    operator: &str,
) -> Result<Value, String> {
    let _guard = st.write().await;
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| s.tipe == "guest" && s.is_blackout_suspect && !s.is_blackout_resolved)
        .ok_or("Sesi tidak valid")?;
    let Some(pc_id) = sesi.pc_id else {
        return Err("PC sudah tidak aktif".into());
    };
    let pc = pc_repo::get_by_id(&st.pool, pc_id)
        .await
        .map_err(|e| e.to_string())?
        .filter(|p| p.active())
        .ok_or("PC sudah tidak aktif")?;
    if repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err(format!("PC {} sedang digunakan.", pc.kode));
    }
    let hasil = buka_ulang_guest(st, &sesi, pc.id, operator).await?;
    let sisa = hasil["sisa_menit"].as_i64().unwrap_or(0);
    let nama = sesi_service::nama_guest(&sesi);
    logger::audit_json(
        operator,
        "BLACKOUT_RESOLVE_GUEST_SAMA",
        &format!("{nama} lanjut di PC:{}", pc.kode),
        None,
        "",
        "",
        json!({"sesi_id": sesi.id, "pc": pc.kode, "sisa_menit": sisa}),
    );
    Ok(json!({"pc": pc.kode, "sisa_menit": sisa, "nama_guest": nama}))
}

pub async fn resolve_guest_lanjut(
    st: &AppState,
    sesi_id: i64,
    pc_baru_id: Option<i64>,
    operator: &str,
) -> Result<Value, String> {
    let _guard = st.write().await;
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data tidak ditemukan")?;
    let pc_baru = pc_repo::get_by_id(&st.pool, pc_baru_id.unwrap_or(0))
        .await
        .map_err(|e| e.to_string())?
        .filter(|p| p.active())
        .ok_or("PC tujuan sudah tidak aktif")?;
    if sesi.tipe != "guest" {
        return Err("Sesi guest tidak ditemukan".into());
    }
    if !sesi.is_blackout_suspect || sesi.is_blackout_resolved {
        return Err("Sesi bukan suspect blackout yang valid".into());
    }
    if sesi.pc_grup_id != pc_baru.grup_id {
        return Err("Hanya bisa pindah ke PC grup yang sama".into());
    }
    if repo::get_aktif_by_pc(&st.pool, pc_baru.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err(format!("PC {} sedang digunakan", pc_baru.kode));
    }
    let hasil = buka_ulang_guest(st, &sesi, pc_baru.id, operator).await?;
    let sisa = hasil["sisa_menit"].as_i64().unwrap_or(0);
    let nama = sesi_service::nama_guest(&sesi);
    logger::audit_json(
        operator,
        "BLACKOUT_RESOLVE_GUEST_LANJUT",
        &format!("{nama} pindah ke PC:{}", pc_baru.kode),
        None,
        "",
        "",
        json!({"sesi_id": sesi.id, "pc_baru": pc_baru.kode, "sisa_menit": sisa}),
    );
    Ok(json!({"pc_baru": pc_baru.kode, "sisa_menit": sisa, "nama_guest": nama}))
}

pub async fn resolve_tutup(st: &AppState, sesi_id: i64, operator: &str) -> Result<Value, String> {
    let _guard = st.write().await;
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Sesi tidak ditemukan")?;
    if !sesi.is_blackout_suspect || sesi.is_blackout_resolved {
        return Err("Sesi bukan suspect blackout yang valid".into());
    }
    let now = now_db();
    let target = label(&sesi);
    let user_id = crate::services::transaksi::user_id(&st.pool, operator).await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query(
        "UPDATE sesi SET is_blackout_resolved = 1, waktu_resolved = ? WHERE id = ?",
    )
    .bind(db_str(now))
    .bind(sesi.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO transaksi (sesi_id, member_id, user_id, jenis, jumlah, menit, keterangan, \
         dibuat_pada, is_refunded, operator) VALUES (?, ?, ?, 'tutup_sesi', 0, 0, ?, ?, 0, ?)",
    )
    .bind(sesi.id)
    .bind(sesi.member_id)
    .bind(user_id)
    .bind(format!(
        "Blackout resolved: {target} ditutup tanpa kompensasi"
    ))
    .bind(db_str(now))
    .bind(operator)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "BLACKOUT_RESOLVE_TUTUP",
        &format!("{target} ditutup"),
        None,
        "",
        "",
        json!({"sesi_id": sesi.id}),
    );
    Ok(json!({"target": target}))
}

pub async fn clear_resolved(
    st: &AppState,
    date: Option<&str>,
    operator: &str,
) -> Result<(String, u64), String> {
    let _guard = st.write().await;
    let raw = date.map(str::trim).filter(|d| !d.is_empty()).unwrap_or("");
    if raw.is_empty() {
        return Err("Pilih tanggal terlebih dahulu".into());
    }
    let hari = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d")
        .map_err(|_| "Format tanggal tidak valid".to_string())?;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let (start, end) = day_range_utc(hari, &tz);
    let jumlah = repo::delete_resolved_blackout(&st.pool, &start, &end)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "BLACKOUT_CLEAR",
        &format!("{jumlah} record dihapus ({raw})"),
        None,
        "",
        "",
        json!({"date": raw, "total": jumlah}),
    );
    Ok((raw.to_string(), jumlah))
}

/// Tutup semua sesi aktif lalu deteksi semuanya sebagai blackout (reset pasca padam).
pub async fn force_all_and_detect(st: &AppState, operator: &str) -> Result<(i64, i64), String> {
    let _guard = st.write().await;
    let now = now_db();
    let now_str = db_str(now);
    let daftar = repo::get_all_aktif(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let mut tutup = 0;
    let mut deteksi = 0;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    for sesi in daftar {
        if matches!(sesi.tipe.as_str(), "guest" | "member") {
            let referensi = sesi
                .last_sync
                .as_deref()
                .and_then(parse_dt)
                .or_else(|| sesi.mulai_pada.as_deref().and_then(parse_dt))
                .unwrap_or(now);
            let sisa = sesi.hitung_sisa_pada(referensi);
            if sesi.tipe == "member" {
                if let Some(member_id) = sesi.member_id {
                    let _ = sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
                        .bind(sisa)
                        .bind(member_id)
                        .execute(&mut *tx)
                        .await;
                }
            }
            sqlx::query(
                "UPDATE sesi SET is_blackout_suspect = 1, is_blackout_resolved = 0, \
                 sisa_menit_saat_mati = ?, status = 'selesai', selesai_pada = ? WHERE id = ?",
            )
            .bind(sisa)
            .bind(db_str(referensi))
            .bind(sesi.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            let user_id = crate::services::transaksi::user_id(&st.pool, operator).await;
            sqlx::query(
                "INSERT INTO transaksi (sesi_id, member_id, user_id, jenis, jumlah, menit, \
                 keterangan, dibuat_pada, is_refunded, operator) \
                 VALUES (?, ?, ?, 'tutup_sesi', 0, 0, ?, ?, 0, ?)",
            )
            .bind(sesi.id)
            .bind(sesi.member_id)
            .bind(user_id)
            .bind(format!("Force close blackout: {}", label(&sesi)))
            .bind(&now_str)
            .bind(operator)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            deteksi += 1;
        } else {
            sqlx::query(
                "UPDATE sesi SET status = 'selesai', selesai_pada = ?, is_afk = 0, \
                 afk_pin = NULL, afk_sejak = NULL WHERE id = ?",
            )
            .bind(&now_str)
            .bind(sesi.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        tutup += 1;
    }
    sqlx::query("UPDATE pc SET is_admin_mode = 0, last_activity = ?")
        .bind(&now_str)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "FORCE_CLOSE_ALL",
        &format!("Tutup:{tutup} | Deteksi:{deteksi}"),
        None,
        "",
        "",
        json!({"tutup": tutup, "deteksi": deteksi}),
    );
    Ok((tutup, deteksi))
}

/// Tanggal hari ini menurut zona waktu setting (dipakai route `/clear` default).
pub async fn hari_ini(st: &AppState) -> String {
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    today_local(&tz).format("%Y-%m-%d").to_string()
}

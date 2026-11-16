//! Layanan member: CRUD, top-up paket, refund, riwayat paket.

use chrono::{Duration, NaiveDateTime};
use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::models::member::Member;
use crate::models::user::hash_password;
use crate::repositories::{
    grup as grup_repo, member as repo, paket as paket_repo, sesi as sesi_repo,
    transaksi as trx_repo,
};
use crate::services::menu::menu_service;
use crate::services::transaksi as nota;
use crate::state::AppState;
use crate::utils::idempotency;
use crate::utils::logger;
use crate::utils::time::{db_str, now_db, parse_dt};
use crate::utils::validators::{email, int_range, password, phone, text, username_lower};

struct GrupInfo {
    nama: String,
    warna: String,
}

async fn grup_info(pool: &SqlitePool, id: i64) -> Result<GrupInfo, String> {
    let grup = grup_repo::get_by_id(pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Grup member tidak valid")?;
    Ok(GrupInfo {
        nama: grup.nama,
        warna: grup.warna.clone().unwrap_or_else(|| "#888888".into()),
    })
}

/// Member hangus: saldo dipaksa 0 dan tanggal kadaluarsa dibersihkan.
fn terapkan_kadaluarsa(m: &mut Member, now: NaiveDateTime) {
    if m.kadaluarsa(now) {
        m.waktu_tersimpan = 0;
        m.kadaluarsa_pada = None;
    }
}

fn tambah_saldo(m: &mut Member, menit: i64, hari: i64, now: NaiveDateTime) {
    let sebelum = m.waktu_tersimpan;
    m.waktu_tersimpan += menit;
    let baru = now + Duration::days(hari.max(0));
    let kadaluarsa = match (
        sebelum == 0,
        m.kadaluarsa_pada.as_deref().and_then(parse_dt),
    ) {
        (true, _) => baru,
        (false, Some(exp)) => exp + Duration::days(hari.max(0)),
        (false, None) => baru,
    };
    m.kadaluarsa_pada = Some(db_str(kadaluarsa));
}

async fn sisa_sesi(pool: &SqlitePool, member_id: i64) -> Result<Option<i64>, String> {
    let sesi = sesi_repo::get_aktif_by_member(pool, member_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(sesi.map(|s| s.sisa_menit(now_db())))
}

async fn bentuk_json(st: &AppState, m: &Member, sisa: Option<i64>) -> Result<Value, String> {
    let grup = grup_info(&st.pool, m.grup_id).await?;
    let waktu = sisa.unwrap_or(m.waktu_tersimpan);
    Ok(m.to_json(
        Some(&grup.nama),
        Some(&grup.warna),
        waktu,
        st.cfg.timezone.as_str(),
    ))
}

pub async fn list(
    st: &AppState,
    q: Option<&str>,
    grup: Option<&str>,
    page: i64,
    per_page: i64,
    sort_by: &str,
    order: &str,
    include_arsip: bool,
) -> Result<Value, String> {
    let grup_id = match grup.map(str::trim).filter(|g| !g.is_empty()) {
        Some(raw) => match raw.parse::<i64>() {
            Ok(id) => Some(id),
            Err(_) => grup_repo::find_by_nama(&st.pool, raw)
                .await
                .map_err(|e| e.to_string())?
                .map(|g| g.id),
        },
        None => None,
    };
    let filter = repo::Filter {
        q: q.map(str::trim).filter(|s| !s.is_empty()),
        grup_id,
        aktif_only: !include_arsip,
    };
    let (rows, total) = repo::get_paginated(
        &st.pool,
        repo::Filter {
            q: filter.q,
            grup_id: filter.grup_id,
            aktif_only: filter.aktif_only,
        },
        sort_by,
        order,
        per_page,
        (page - 1).max(0) * per_page,
    )
    .await
    .map_err(|e| e.to_string())?;

    let sesi_aktif = sesi_repo::get_all_aktif(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let now = now_db();
    let mut members = Vec::with_capacity(rows.len());
    for m in rows {
        let sisa = sesi_aktif
            .iter()
            .find(|s| s.member_id == Some(m.id) && s.tipe == "member")
            .map(|s| s.sisa_menit(now));
        members.push(bentuk_json(st, &m, sisa).await?);
    }

    let counts = repo::counts_by_grup(
        &st.pool,
        repo::Filter {
            q: filter.q,
            grup_id: None,
            aktif_only: filter.aktif_only,
        },
    )
    .await
    .map_err(|e| e.to_string())?;
    let mut grup_counts = serde_json::Map::new();
    for (gid, n) in counts {
        if let Some(gid) = gid {
            grup_counts.insert(gid.to_string(), json!(n));
        }
    }

    let pages = if per_page > 0 {
        (total + per_page - 1) / per_page
    } else {
        0
    };
    Ok(json!({
        "members": members,
        "total": total,
        "pages": pages,
        "current_page": page,
        "per_page": per_page,
        "has_next": page < pages,
        "has_prev": page > 1,
        "grup_counts": grup_counts,
    }))
}

/// `Ok(None)` bila member tidak ada (route membalas 404).
pub async fn detail(st: &AppState, id: i64) -> Result<Option<Value>, String> {
    let Some(mut m) = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };
    terapkan_kadaluarsa(&mut m, now_db());
    let sisa = sisa_sesi(&st.pool, id).await?;
    Ok(Some(bentuk_json(st, &m, sisa).await?))
}

pub async fn create(st: &AppState, body: &Value, operator: &str) -> Result<Value, String> {
    let _guard = st.write().await;
    let username = username_lower(body.get("username").and_then(|v| v.as_str()).unwrap_or(""))?;
    if repo::find_by_username(&st.pool, &username)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Username sudah ada".into());
    }
    let raw_password = body.get("password").and_then(|v| v.as_str()).unwrap_or("");
    if raw_password.trim().is_empty() {
        return Err("Password wajib diisi".into());
    }
    let raw_password = password(raw_password, 4, 16)?;
    let nama = text(
        body.get("nama_lengkap")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        0,
        100,
        "Nama lengkap",
        false,
    )?;
    let email = email(body.get("email").and_then(|v| v.as_str()).unwrap_or(""))?;
    let no_hp = phone(body.get("no_hp").and_then(|v| v.as_str()).unwrap_or(""))?;

    let grup_raw = body
        .get("grup")
        .and_then(|v| v.as_str())
        .unwrap_or("reguler")
        .trim()
        .to_string();
    let grup = match grup_raw.parse::<i64>() {
        Ok(id) => grup_repo::get_by_id(&st.pool, id)
            .await
            .map_err(|e| e.to_string())?,
        Err(_) => grup_repo::find_by_nama(&st.pool, &grup_raw)
            .await
            .map_err(|e| e.to_string())?,
    }
    .ok_or("Grup member tidak valid")?;

    let hash = hash_password(&raw_password);
    let id = repo::insert(
        &st.pool,
        &username,
        &hash,
        &nama,
        email.as_deref(),
        no_hp.as_deref(),
        grup.id,
        &db_str(now_db()),
    )
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Username sudah ada".to_string()
        } else {
            e.to_string()
        }
    })?;

    logger::audit_json(
        operator,
        "TAMBAH_MEMBER",
        &format!("Member baru: {username}"),
        Some("MEMBER"),
        "",
        "",
        json!({
            "username": username,
            "nama_lengkap": nama,
            "grup": grup.nama,
            "saldo_menit": 0,
            "no_hp": no_hp,
            "email": email,
        }),
    );
    Ok(json!({"id": id, "username": username}))
}

pub async fn update(st: &AppState, id: i64, body: &Value, operator: &str) -> Result<Value, String> {
    let _guard = st.write().await;
    let Some(mut m) = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err("Member tidak ditemukan".into());
    };
    let nama = match body.get("nama_lengkap") {
        Some(v) => text(v.as_str().unwrap_or(""), 0, 100, "Nama lengkap", false)?,
        None => m.nama_lengkap.clone().unwrap_or_default(),
    };
    let email_baru = match body.get("email") {
        Some(v) => email(v.as_str().unwrap_or(""))?,
        None => m.email.clone(),
    };
    let hp_baru = match body.get("no_hp") {
        Some(v) => phone(v.as_str().unwrap_or(""))?,
        None => m.no_hp.clone(),
    };
    let grup_id = match body.get("grup").and_then(|v| v.as_str()).map(str::trim) {
        Some(raw) if !raw.is_empty() => {
            let grup = match raw.parse::<i64>() {
                Ok(gid) => grup_repo::get_by_id(&st.pool, gid)
                    .await
                    .map_err(|e| e.to_string())?,
                Err(_) => grup_repo::find_by_nama(&st.pool, raw)
                    .await
                    .map_err(|e| e.to_string())?,
            }
            .ok_or("Grup tidak valid")?;
            grup.id
        }
        _ => m.grup_id,
    };
    let hash = match body
        .get("password")
        .and_then(|v| v.as_str())
        .filter(|p| !p.trim().is_empty())
    {
        Some(raw) => Some(hash_password(&password(raw, 4, 16)?)),
        None => None,
    };

    repo::update_profile(
        &st.pool,
        id,
        &nama,
        email_baru.as_deref(),
        hp_baru.as_deref(),
        grup_id,
        hash.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    m.nama_lengkap = Some(nama);
    m.email = email_baru;
    m.no_hp = hp_baru;
    m.grup_id = grup_id;

    logger::audit_json(
        operator,
        "EDIT_MEMBER",
        &format!("Data member {} diperbarui", m.username),
        Some("MEMBER"),
        "",
        "",
        json!({"username": m.username}),
    );
    let sisa = sisa_sesi(&st.pool, id).await?;
    Ok(json!({
        "username": m.username,
        "member": bentuk_json(st, &m, sisa).await?,
    }))
}

pub async fn archive(st: &AppState, id: i64, operator: &str) -> Result<Option<bool>, String> {
    let _guard = st.write().await;
    let Some(m) = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };
    if sesi_repo::get_aktif_by_member(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Member sedang bermain, tidak bisa diarsipkan".into());
    }
    if !m.aktif {
        return Ok(Some(true));
    }
    repo::set_aktif(&st.pool, id, false)
        .await
        .map_err(|e| e.to_string())?;
    logger::rec(
        operator,
        "ARSIP_MEMBER",
        &format!("Member {} diarsipkan", m.username),
    );
    Ok(Some(true))
}

pub async fn restore(st: &AppState, id: i64, operator: &str) -> Result<Option<String>, String> {
    let _guard = st.write().await;
    let Some(m) = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };
    if m.aktif {
        return Err("Member tidak dalam arsip".into());
    }
    repo::set_aktif(&st.pool, id, true)
        .await
        .map_err(|e| e.to_string())?;
    logger::rec(
        operator,
        "RESTORE_MEMBER",
        &format!("Member {} dipulihkan", m.username),
    );
    Ok(Some(m.username))
}

pub async fn delete(st: &AppState, id: i64, operator: &str) -> Result<Option<String>, String> {
    let _guard = st.write().await;
    let Some(m) = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };
    if sesi_repo::get_aktif_by_member(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Member sedang bermain, tidak bisa dihapus".into());
    }
    sqlx::query("UPDATE sesi SET member_id = NULL WHERE member_id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE transaksi SET member_id = NULL WHERE member_id = ?")
        .bind(id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    repo::delete(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    logger::rec(
        operator,
        "DELETE_MEMBER",
        &format!("Member {} dihapus permanen", m.username),
    );
    Ok(Some(m.username))
}

/// Top-up satu atau beberapa paket dalam satu commit.
pub async fn tambah_waktu(
    st: &AppState,
    member_id: i64,
    selections: &[(i64, i64)],
    metode: Option<&str>,
    operator: &str,
    client_request_id: Option<&str>,
) -> Result<(), String> {
    if !idempotency::claim(client_request_id.unwrap_or("")) {
        return Err("Permintaan ini sudah diproses".into());
    }
    let _guard = st.write().await;
    let metode = menu_service::metode_pembayaran(st, metode).await?;
    let Some(mut member) = repo::get_by_id(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err("Member tidak ditemukan".into());
    };
    let now = now_db();
    terapkan_kadaluarsa(&mut member, now);
    if let Some(sesi) = sesi_repo::get_aktif_by_member(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    {
        let _ = sesi;
        return Err("Member sedang bermain. Gunakan tombol '+Waktu' di dashboard PC.".into());
    }

    let operator_id = nota::user_id(&st.pool, operator).await;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let mut total_menit = 0i64;
    let mut rincian = Vec::new();

    for (paket_id, qty) in selections {
        let qty = int_range(&json!(qty), 1, 100, "Kuantitas paket")?;
        let paket = paket_repo::get_by_id(&st.pool, *paket_id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Paket tidak ditemukan")?;
        if !paket.active() {
            return Err("Paket tidak aktif".into());
        }
        if paket.grup_id != Some(member.grup_id) {
            let nama_paket = paket
                .grup_nama
                .clone()
                .unwrap_or_else(|| "reguler".into())
                .to_uppercase();
            let nama_member = grup_info(&st.pool, member.grup_id)
                .await?
                .nama
                .to_uppercase();
            return Err(format!(
                "Paket grup {nama_paket}, member grup {nama_member}"
            ));
        }
        let menit = paket.durasi_menit * qty;
        let harga = paket.harga * qty;
        let saldo_sebelum = member.waktu_tersimpan;
        tambah_saldo(
            &mut member,
            menit,
            paket.kadaluarsa_hari.unwrap_or(30) * qty,
            now,
        );
        total_menit += menit;
        rincian.push((
            paket.nama.clone(),
            menit,
            harga,
            saldo_sebelum,
            member.waktu_tersimpan,
        ));

        let no_nota = nota::generate_nota(&st.pool, &st.cfg.timezone).await;
        sqlx::query(
            "INSERT INTO transaksi (member_id, paket_id, user_id, jenis, jumlah, menit, keterangan, \
             dibuat_pada, no_nota, is_refunded, metode_pembayaran, operator) \
             VALUES (?, ?, ?, 'beli_paket_member', ?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(member_id)
        .bind(paket.id)
        .bind(operator_id)
        .bind(harga)
        .bind(menit)
        .bind(format!("Beli paket '{}' x{qty} oleh {}", paket.nama, member.username))
        .bind(db_str(now))
        .bind(&no_nota)
        .bind(Some(metode.as_str()))
        .bind(operator)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        rincian.last_mut().unwrap().0 = format!("{no_nota}|{}", rincian.last().unwrap().0);
    }

    sqlx::query("UPDATE member SET waktu_tersimpan = ?, kadaluarsa_pada = ? WHERE id = ?")
        .bind(member.waktu_tersimpan)
        .bind(member.kadaluarsa_pada.as_deref())
        .bind(member_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;

    logger::rec(
        operator,
        "TAMBAH_WAKTU",
        &format!("Member:{} | +{total_menit}m", member.username),
    );
    for (gabung, menit, harga, _before, _after) in rincian {
        let (no_nota, paket) = gabung.split_once('|').unwrap_or((gabung.as_str(), ""));
        logger::rec(
            operator,
            "TRANSAKSI",
            &format!(
                "Nota:{no_nota} | Member:{} | +{menit}m | Rp {harga} ({paket})",
                member.username
            ),
        );
    }
    Ok(())
}

pub async fn refund(
    st: &AppState,
    member_id: i64,
    transaksi_id: i64,
    operator: &str,
) -> Result<Value, String> {
    let _guard = st.write().await;
    let Some(mut member) = repo::get_by_id(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err("Member tidak ditemukan".into());
    };
    let trx = trx_repo::get_by_id(&st.pool, transaksi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Transaksi tidak valid atau sudah direfund")?;
    if trx.member_id != Some(member_id) || trx.is_refunded {
        return Err("Transaksi tidak valid atau sudah direfund".into());
    }
    let now = now_db();
    terapkan_kadaluarsa(&mut member, now);

    let paket = match trx.paket_id {
        Some(pid) => paket_repo::get_by_id(&st.pool, pid)
            .await
            .map_err(|e| e.to_string())?,
        None => None,
    };
    let durasi = if trx.menit > 0 {
        trx.menit
    } else {
        paket.as_ref().map(|p| p.durasi_menit).unwrap_or(0)
    };
    if durasi <= 0 {
        return Err("Durasi paket tidak valid untuk refund".into());
    }
    if member.waktu_tersimpan <= 0 {
        return Err("Saldo waktu member sudah habis. Paket tidak dapat direfund.".into());
    }

    let saldo_sebelum = member.waktu_tersimpan;
    let waktu_baru = (saldo_sebelum - durasi).max(0);
    if !trx_repo::claim_refund(&st.pool, transaksi_id)
        .await
        .map_err(|e| e.to_string())?
    {
        return Err("Transaksi tidak valid atau sudah direfund".into());
    }

    let dipotong = saldo_sebelum - waktu_baru;
    if let Some(mut sesi) = sesi_repo::get_aktif_by_member(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    {
        sesi.waktu_tersimpan_awal -= dipotong;
        sqlx::query("UPDATE sesi SET waktu_tersimpan_awal = ? WHERE id = ?")
            .bind(sesi.waktu_tersimpan_awal.max(0))
            .bind(sesi.id)
            .execute(&st.pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    let base = paket
        .as_ref()
        .map(|p| p.durasi_menit)
        .unwrap_or(durasi)
        .max(1);
    let qty = (durasi / base).max(1);
    let hari = paket.as_ref().and_then(|p| p.kadaluarsa_hari).unwrap_or(30) * qty;
    if let Some(exp) = member.kadaluarsa_pada.as_deref().and_then(parse_dt) {
        let baru = (exp - Duration::days(hari)).max(now);
        member.kadaluarsa_pada = Some(db_str(baru));
    }
    member.waktu_tersimpan = waktu_baru;
    repo::set_saldo(
        &st.pool,
        member_id,
        waktu_baru,
        member.kadaluarsa_pada.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let no_nota = nota::generate_nota(&st.pool, &st.cfg.timezone).await;
    let nama_paket = paket
        .as_ref()
        .map(|p| p.nama.clone())
        .unwrap_or_else(|| "Paket Dihapus".into());
    sqlx::query(
        "INSERT INTO transaksi (member_id, paket_id, jenis, jumlah, menit, keterangan, \
         dibuat_pada, no_nota, is_refunded, metode_pembayaran, operator) \
         VALUES (?, ?, 'refund_paket', ?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(member_id)
    .bind(trx.paket_id)
    .bind(-trx.jumlah)
    .bind(-durasi)
    .bind(format!("Refund paket '{nama_paket}'"))
    .bind(db_str(now))
    .bind(&no_nota)
    .bind(trx.metode_pembayaran.as_deref())
    .bind(operator)
    .execute(&st.pool)
    .await
    .map_err(|e| e.to_string())?;

    logger::rec(
        operator,
        "REFUND_PAKET",
        &format!(
            "Member:{} | Saldo: {saldo_sebelum}m -> {waktu_baru}m",
            member.username
        ),
    );
    logger::rec(
        operator,
        "TRANSAKSI",
        &format!("REFUND | Nota:{no_nota} | Rp {}", -trx.jumlah),
    );
    Ok(json!({
        "username": member.username,
        "saldo_sebelum": saldo_sebelum,
        "saldo_sesudah": waktu_baru,
        "durasi_dikurangi": durasi,
    }))
}

pub async fn riwayat(st: &AppState, member_id: i64) -> Result<Value, String> {
    let Some(mut member) = repo::get_by_id(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(json!({"paket": []}));
    };
    terapkan_kadaluarsa(&mut member, now_db());
    let rows = trx_repo::riwayat_paket_member(&st.pool, member_id)
        .await
        .map_err(|e| e.to_string())?;

    let mut saldo_sisa = member.waktu_tersimpan;
    let mut items = Vec::new();
    for row in rows {
        if saldo_sisa <= 0 {
            break;
        }
        let base = row.paket_durasi_menit.unwrap_or(0).max(1);
        let qty = (row.menit / base).max(1);
        items.push(json!({
            "id": row.id,
            "nama": row.paket_nama.clone().unwrap_or_else(|| "Paket Dihapus".into()),
            "durasi_menit": row.menit,
            "base_durasi_menit": row.paket_durasi_menit.unwrap_or(0),
            "qty": qty,
            "harga": row.jumlah,
            "dibuat_pada": row
                .dibuat_pada
                .as_deref()
                .and_then(parse_dt)
                .map(|d| crate::utils::time::format_display(d, &st.cfg.timezone)),
            "jenis": row.jenis,
        }));
        saldo_sisa -= row.menit;
    }
    Ok(json!({"paket": items}))
}

//! Mesin sesi bermain: buka, tambah waktu, pindah PC, tutup, refund, cleanup.

use chrono::{Duration, NaiveDateTime};
use serde_json::{json, Value};
use sqlx::{Sqlite, Transaction};

use crate::models::sesi::Sesi;
use crate::repositories::{
    member as member_repo, paket as paket_repo, pc as pc_repo, sesi as repo,
    transaksi as transaksi_repo,
};
use crate::services::menu::menu_service;
use crate::services::transaksi as nota;
use crate::state::AppState;
use crate::utils::logger;
use crate::utils::time::{db_str, format_display, now_db, parse_dt};
use crate::utils::validators::{int_range, text};

/// Nama tampilan pemakai guest (fallback "Guest").
pub fn nama_guest(sesi: &Sesi) -> String {
    sesi.nama_guest.clone().unwrap_or_else(|| "Guest".into())
}

/// Token sesi acak 64 karakter hex untuk client agent.
pub fn token_sesi() -> String {
    use rand::Rng;
    let bytes: Vec<u8> = (0..32).map(|_| rand::rng().random::<u8>()).collect();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

struct SesiBaru<'a> {
    tipe: &'a str,
    member_id: Option<i64>,
    user_id: Option<i64>,
    pc_id: i64,
    paket_id: Option<i64>,
    nama_guest: Option<&'a str>,
    durasi: i64,
    total: i64,
    waktu_mulai: Option<&'a str>,
    waktu_awal: i64,
    asal: Option<i64>,
}

async fn insert_sesi(tx: &mut Transaction<'_, Sqlite>, b: SesiBaru<'_>) -> Result<i64, String> {
    let now = db_str(now_db());
    sqlx::query(
        "INSERT INTO sesi (tipe, member_id, user_id, pc_id, paket_id, nama_guest, token_sesi, \
         mulai_pada, durasi_beli_menit, total_bayar, status, is_admin, waktu_mulai_sesi, \
         waktu_tersimpan_awal, sesi_asal_id, menit_pause_total, sisa_menit_saat_mati, \
         is_blackout_suspect, is_blackout_resolved, is_afk) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 0, ?, ?, ?, 0, 0, 0, 0, 0)",
    )
    .bind(b.tipe)
    .bind(b.member_id)
    .bind(b.user_id)
    .bind(b.pc_id)
    .bind(b.paket_id)
    .bind(b.nama_guest)
    .bind(token_sesi())
    .bind(&now)
    .bind(b.durasi)
    .bind(b.total)
    .bind(b.waktu_mulai)
    .bind(b.waktu_awal)
    .bind(b.asal)
    .execute(&mut **tx)
    .await
    .map(|r| r.last_insert_rowid())
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "PC sedang dipakai".to_string()
        } else {
            e.to_string()
        }
    })
}

#[allow(clippy::too_many_arguments)]
async fn insert_transaksi(
    tx: &mut Transaction<'_, Sqlite>,
    sesi_id: Option<i64>,
    member_id: Option<i64>,
    paket_id: Option<i64>,
    jenis: &str,
    jumlah: i64,
    menit: i64,
    keterangan: &str,
    no_nota: Option<&str>,
    metode: Option<&str>,
    operator: &str,
    user_id: Option<i64>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO transaksi (sesi_id, member_id, paket_id, user_id, jenis, jumlah, menit, \
         keterangan, dibuat_pada, no_nota, is_refunded, metode_pembayaran, operator) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(sesi_id)
    .bind(member_id)
    .bind(paket_id)
    .bind(user_id)
    .bind(jenis)
    .bind(jumlah)
    .bind(menit)
    .bind(keterangan)
    .bind(db_str(now_db()))
    .bind(no_nota)
    .bind(metode)
    .bind(operator)
    .execute(&mut **tx)
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub async fn buka_guest(
    st: &AppState,
    pc_kode: Option<&str>,
    paket_id: Option<i64>,
    nama_guest: Option<&str>,
    operator: &str,
    metode: Option<&str>,
) -> Result<Sesi, String> {
    let _guard = st.write().await;
    let nama = text(nama_guest.unwrap_or("Guest"), 1, 50, "Nama Guest", true)?;
    let metode = menu_service::metode_pembayaran(st, metode).await?;
    let pc = pc_repo::find_by_kode(&st.pool, pc_kode.unwrap_or(""))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak ditemukan")?;
    if repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("PC sedang dipakai".into());
    }
    let paket = paket_repo::get_by_id(&st.pool, paket_id.unwrap_or(0))
        .await
        .map_err(|e| e.to_string())?
        .filter(|p| p.active())
        .ok_or("Paket tidak valid")?;
    if paket.grup_id != pc.grup_id {
        return Err(format!(
            "PC {} dilarang pakai paket {}",
            pc.grup_nama
                .clone()
                .unwrap_or_else(|| "reguler".into())
                .to_uppercase(),
            paket
                .grup_nama
                .clone()
                .unwrap_or_else(|| "reguler".into())
                .to_uppercase()
        ));
    }
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let no_nota = nota::generate_nota(&st.pool, &tz).await;
    let user_id = nota::user_id(&st.pool, operator).await;

    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let sesi_id = insert_sesi(
        &mut tx,
        SesiBaru {
            tipe: "guest",
            member_id: None,
            user_id: None,
            pc_id: pc.id,
            paket_id: Some(paket.id),
            nama_guest: Some(&nama),
            durasi: paket.durasi_menit,
            total: paket.harga,
            waktu_mulai: None,
            waktu_awal: 0,
            asal: None,
        },
    )
    .await?;
    insert_transaksi(
        &mut tx,
        Some(sesi_id),
        None,
        Some(paket.id),
        "beli_paket_guest",
        paket.harga,
        paket.durasi_menit,
        &format!("Guest '{nama}' di {}", pc.kode),
        Some(&no_nota),
        Some(&metode),
        operator,
        user_id,
    )
    .await?;
    tx.commit().await.map_err(|e| e.to_string())?;

    logger::audit_json(
        operator,
        "BUKA_GUEST",
        &format!("PC:{} | Guest:{nama} | {}m", pc.kode, paket.durasi_menit),
        None,
        "",
        "",
        json!({
            "nominal_pembayaran": paket.harga,
            "metode_pembayaran": metode,
            "durasi_menit": paket.durasi_menit,
            "paket_id": paket.id,
        }),
    );
    logger::audit_json(
        operator,
        "TRANSAKSI",
        &format!("Nota:{no_nota} | Beli:{} | Rp {}", paket.nama, paket.harga),
        None,
        "",
        "",
        json!({
            "nominal_transaksi": paket.harga,
            "metode_pembayaran": metode,
            "tipe_tambahan": "paket",
            "paket_id": paket.id,
        }),
    );

    repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Sesi gagal dibuat".to_string())
}

pub async fn buka_member(
    st: &AppState,
    pc_kode: Option<&str>,
    username: Option<&str>,
    operator: &str,
) -> Result<Sesi, String> {
    let _guard = st.write().await;
    let pc = pc_repo::find_by_kode(&st.pool, pc_kode.unwrap_or(""))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("PC tidak tersedia")?;
    if repo::get_aktif_by_pc(&st.pool, pc.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("PC tidak tersedia".into());
    }
    let member = member_repo::get_by_username(&st.pool, username.unwrap_or(""))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Member tidak ditemukan")?;
    if Some(member.grup_id) != pc.grup_id {
        return Err(format!(
            "Member {} dilarang di PC {}",
            member_grup_nama(st, member.grup_id).await.to_uppercase(),
            pc.grup_nama
                .clone()
                .unwrap_or_else(|| "reguler".into())
                .to_uppercase()
        ));
    }
    if member.kadaluarsa(now_db()) {
        let _ = member_repo::set_waktu_tersimpan(&st.pool, member.id, 0).await;
        return Err("Waktu habis".into());
    }
    if member.waktu_tersimpan <= 0 {
        return Err("Waktu habis".into());
    }
    if repo::get_aktif_by_member(&st.pool, member.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Member sudah memiliki sesi aktif".into());
    }

    let now = db_str(now_db());
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let sesi_id = insert_sesi(
        &mut tx,
        SesiBaru {
            tipe: "member",
            member_id: Some(member.id),
            user_id: None,
            pc_id: pc.id,
            paket_id: None,
            nama_guest: None,
            durasi: 0,
            total: 0,
            waktu_mulai: Some(&now),
            waktu_awal: member.waktu_tersimpan,
            asal: None,
        },
    )
    .await?;
    tx.commit().await.map_err(|e| e.to_string())?;

    logger::audit_json(
        operator,
        "BUKA_MEMBER",
        &format!("PC:{} | Member:{}", pc.kode, member.username),
        None,
        "",
        "",
        json!({
            "member_id": member.id,
            "username_member": member.username,
            "sisa_saldo_sebelumnya": member.waktu_tersimpan,
            "paket_id": null,
        }),
    );
    repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Sesi gagal dibuat".to_string())
}

async fn member_grup_nama(st: &AppState, grup_id: i64) -> String {
    sqlx::query_scalar("SELECT nama FROM grup WHERE id = ?")
        .bind(grup_id)
        .fetch_optional(&st.pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "reguler".into())
}

/// Sesi admin untuk maintenance PC (token dibuat server, dipakai handshake client).
pub async fn buka_admin(st: &AppState, pc_id: i64, admin_nama: &str) -> Result<i64, String> {
    let now = db_str(now_db());
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let id = insert_sesi(
        &mut tx,
        SesiBaru {
            tipe: "admin",
            member_id: None,
            user_id: None,
            pc_id,
            paket_id: None,
            nama_guest: Some(admin_nama),
            durasi: 0,
            total: 0,
            waktu_mulai: Some(&now),
            waktu_awal: 0,
            asal: None,
        },
    )
    .await?;
    sqlx::query("UPDATE sesi SET is_admin = 1 WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(id)
}

#[allow(clippy::too_many_arguments)]
async fn tambah_satu(
    st: &AppState,
    tx: &mut Transaction<'_, Sqlite>,
    sesi: &Sesi,
    paket_id: i64,
    qty: i64,
    metode: &str,
    operator: &str,
    audit: Option<&mut Vec<(String, Value)>>,
) -> Result<Value, String> {
    let paket = paket_repo::get_by_id(&st.pool, paket_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;
    if !paket.active() {
        return Err("Paket tidak aktif".into());
    }
    if paket.grup_id != sesi.pc_grup_id {
        return Err(format!(
            "Paket zona {} tidak cocok dengan PC!",
            paket
                .grup_nama
                .clone()
                .unwrap_or_else(|| "reguler".into())
                .to_uppercase()
        ));
    }
    let total_menit = paket.durasi_menit * qty;
    let total_harga = paket.harga * qty;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let no_nota = nota::generate_nota(&st.pool, &tz).await;
    let user_id = nota::user_id(&st.pool, operator).await;
    let detail = json!({
        "tipe_tambahan": "waktu",
        "nominal_transaksi": total_harga,
        "metode_pembayaran": metode,
        "waktu_ditambahkan": total_menit,
    });

    if sesi.tipe == "member" {
        let member_id = sesi.member_id.ok_or("Member tidak ditemukan")?;
        let member = member_repo::get_by_id(&st.pool, member_id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Member tidak ditemukan")?;
        let tambah_hari = paket.kadaluarsa_hari.unwrap_or(0) * qty;
        let baru = member.waktu_tersimpan + total_menit;
        let kadaluarsa = match member.kadaluarsa_pada.as_deref().and_then(parse_dt) {
            Some(exp) if member.waktu_tersimpan > 0 => exp.max(now_db()) + Duration::days(tambah_hari),
            _ => now_db() + Duration::days(tambah_hari),
        };
        sqlx::query("UPDATE member SET waktu_tersimpan = ?, kadaluarsa_pada = ? WHERE id = ?")
            .bind(baru)
            .bind(db_str(kadaluarsa))
            .bind(member.id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("UPDATE sesi SET waktu_tersimpan_awal = waktu_tersimpan_awal + ? WHERE id = ?")
            .bind(total_menit)
            .bind(sesi.id)
            .execute(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;
        insert_transaksi(
            tx,
            Some(sesi.id),
            Some(member.id),
            Some(paket.id),
            "tambah_waktu_sesi",
            total_harga,
            total_menit,
            &format!("Tambah waktu member {} x{qty}", member.username),
            Some(&no_nota),
            Some(metode),
            operator,
            user_id,
        )
        .await?;
        let pesan = format!("Member:{} | +{total_menit}m", member.username);
        match audit {
            Some(rows) => rows.push((pesan, detail)),
            None => logger::audit_json(operator, "TAMBAH_WAKTU", &pesan, None, "", "", detail),
        }
        return Ok(json!({"tipe": "member", "waktu_tersimpan": baru}));
    }

    sqlx::query(
        "UPDATE sesi SET durasi_beli_menit = durasi_beli_menit + ?, \
         total_bayar = total_bayar + ? WHERE id = ?",
    )
    .bind(total_menit)
    .bind(total_harga)
    .bind(sesi.id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    let nama_guest = sesi.nama_guest.clone().unwrap_or_else(|| "Guest".into());
    insert_transaksi(
        tx,
        Some(sesi.id),
        None,
        Some(paket.id),
        "tambah_waktu_guest",
        total_harga,
        total_menit,
        &format!("Tambah waktu guest {nama_guest} x{qty}"),
        Some(&no_nota),
        Some(metode),
        operator,
        user_id,
    )
    .await?;
    let pesan = format!("Guest:{nama_guest} | +{total_menit}m");
    match audit {
        Some(rows) => rows.push((pesan, detail)),
        None => logger::audit_json(operator, "TAMBAH_WAKTU", &pesan, None, "", "", detail),
    }
    let durasi_baru = sesi.durasi_beli_menit + total_menit;
    let terpakai = sesi.menit_terpakai(now_db());
    let sisa = (durasi_baru - terpakai).max(0);
    Ok(json!({"tipe": "guest", "sisa_menit": sisa}))
}

pub async fn tambah_waktu(
    st: &AppState,
    sesi_id: i64,
    paket_id: Option<i64>,
    qty: i64,
    metode: Option<&str>,
    operator: &str,
    client_request_id: Option<&str>,
) -> Result<(i64, Value), String> {
    let guard = crate::utils::idempotency::IdempotencyGuard::acquire(client_request_id)?;
    let _guard = st.write().await;
    let qty = int_range(&json!(qty), 1, 100, "Kuantitas paket")?;
    let metode = menu_service::metode_pembayaran(st, metode).await?;
    let sesi = repo::get_aktif_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Sesi tidak aktif")?;
    if !matches!(sesi.tipe.as_str(), "guest" | "member") {
        return Err("Sesi admin tidak bisa ditambah waktu".into());
    }
    let paket_id = paket_id.ok_or("Paket tidak ditemukan")?;
    let paket = paket_repo::get_by_id(&st.pool, paket_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paket tidak ditemukan")?;

    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let hasil = tambah_satu(st, &mut tx, &sesi, paket_id, qty, &metode, operator, None).await?;
    tx.commit().await.map_err(|e| e.to_string())?;
    guard.commit();
    Ok((paket.durasi_menit * qty, hasil))
}

/// Tambah waktu beberapa sesi; satu commit untuk semua (rollback total bila gagal).
pub async fn tambah_waktu_batch(
    st: &AppState,
    entries: Vec<(i64, i64, i64)>,
    metode: Option<&str>,
    operator: &str,
    client_request_id: Option<&str>,
) -> Result<(), String> {
    let guard = crate::utils::idempotency::IdempotencyGuard::acquire(client_request_id)?;
    let _guard = st.write().await;
    let metode = menu_service::metode_pembayaran(st, metode).await?;
    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    let mut audit: Vec<(String, Value)> = Vec::new();
    for (sesi_id, paket_id, qty) in entries {
        let qty = int_range(&json!(qty), 1, 100, "Kuantitas paket")?;
        let sesi = repo::get_aktif_by_id(&st.pool, sesi_id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Sesi tidak aktif")?;
        if !matches!(sesi.tipe.as_str(), "guest" | "member") {
            return Err("Sesi admin tidak bisa ditambah waktu".into());
        }
        tambah_satu(
            st,
            &mut tx,
            &sesi,
            paket_id,
            qty,
            &metode,
            operator,
            Some(&mut audit),
        )
        .await?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    guard.commit();
    for (pesan, detail) in audit {
        logger::audit_json(operator, "TAMBAH_WAKTU", &pesan, None, "", "", detail);
    }
    Ok(())
}

async fn update_saldo_pemakai(
    tx: &mut Transaction<'_, Sqlite>,
    sesi: &Sesi,
    sisa: i64,
) -> Result<(), String> {
    if sesi.tipe == "member" {
        if let Some(member_id) = sesi.member_id {
            sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
                .bind(sisa)
                .bind(member_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    } else if sesi.tipe == "kasir" {
        if let Some(user_id) = sesi.user_id {
            sqlx::query("UPDATE user SET sisa_kuota_menit = ? WHERE id = ?")
                .bind(sisa)
                .bind(user_id)
                .execute(&mut **tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub async fn tutup(st: &AppState, sesi_id: i64, operator: &str) -> Result<(), String> {
    let _guard = st.write().await;
    tutup_locked(st, sesi_id, operator).await
}

/// Versi tanpa memegang `WRITE_LOCK` (dipakai cleanup & alur client yang sudah mengunci).
pub async fn tutup_locked(st: &AppState, sesi_id: i64, operator: &str) -> Result<(), String> {
    let sesi = repo::get_aktif_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Sesi tidak ditemukan")?;
    let sisa = sesi.sisa_menit(now_db());
    let now = db_str(now_db());
    let user_id = nota::user_id(&st.pool, operator).await;

    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    update_saldo_pemakai(&mut tx, &sesi, sisa).await?;
    sqlx::query(
        "UPDATE sesi SET status = 'selesai', selesai_pada = ?, is_afk = 0, afk_pin = NULL, \
         afk_sejak = NULL WHERE id = ?",
    )
    .bind(&now)
    .bind(sesi.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    if sesi.tipe == "admin" {
        if let Some(pc_id) = sesi.pc_id {
            sqlx::query("UPDATE pc SET is_admin_mode = 0 WHERE id = ?")
                .bind(pc_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    insert_transaksi(
        &mut tx,
        Some(sesi.id),
        sesi.member_id,
        None,
        "tutup_sesi",
        0,
        0,
        &format!("Sesi {} ditutup oleh {operator}", sesi.tipe),
        None,
        None,
        operator,
        user_id,
    )
    .await?;
    tx.commit().await.map_err(|e| e.to_string())?;

    let terpakai = sesi.menit_terpakai(now_db());
    logger::audit_json(
        operator,
        "TUTUP_SESI",
        &format!(
            "{} | PC:{} | Main:{terpakai}m",
            sesi.tipe.to_uppercase(),
            sesi.pc_kode.clone().unwrap_or_default()
        ),
        None,
        "",
        "",
        json!({
            "tipe": sesi.tipe,
            "menit_terpakai": terpakai,
            "pc_kode": sesi.pc_kode,
        }),
    );
    Ok(())
}

pub async fn pindah_pc(
    st: &AppState,
    sesi_id: i64,
    pc_kode_baru: Option<&str>,
    operator: &str,
) -> Result<(String, String), String> {
    let _guard = st.write().await;
    let sesi = repo::get_aktif_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data tidak valid")?;
    let pc_baru = pc_repo::find_by_kode(&st.pool, pc_kode_baru.unwrap_or(""))
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data tidak valid")?;
    if Some(pc_baru.id) == sesi.pc_id {
        return Err("Tidak dapat memindahkan sesi ke unit PC yang sama".into());
    }
    if sesi.pc_grup_id != pc_baru.grup_id {
        return Err("Beda grup zona!".into());
    }
    if repo::get_aktif_by_pc(&st.pool, pc_baru.id)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("PC tujuan sedang dipakai".into());
    }

    let pc_lama = sesi.pc_kode.clone().unwrap_or_default();
    let sisa = sesi.sisa_menit(now_db());
    let now = db_str(now_db());
    let user_id = nota::user_id(&st.pool, operator).await;

    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;
    update_saldo_pemakai(&mut tx, &sesi, sisa).await?;
    let target: Vec<i64> = if let Some(member_id) = sesi.member_id {
        sqlx::query_scalar("SELECT id FROM sesi WHERE member_id = ? AND status = 'aktif'")
            .bind(member_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
    } else if let Some(user_id) = sesi.user_id {
        sqlx::query_scalar("SELECT id FROM sesi WHERE user_id = ? AND status = 'aktif'")
            .bind(user_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
    } else {
        vec![sesi.id]
    };
    for id in target {
        sqlx::query(
            "UPDATE sesi SET status = 'selesai', selesai_pada = ?, is_afk = 0, afk_pin = NULL, \
             afk_sejak = NULL WHERE id = ?",
        )
        .bind(&now)
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }
    let asal = sesi.sesi_asal_id.unwrap_or(sesi.id);
    let sesi_baru = insert_sesi(
        &mut tx,
        SesiBaru {
            tipe: &sesi.tipe,
            member_id: sesi.member_id,
            user_id: sesi.user_id,
            pc_id: pc_baru.id,
            paket_id: sesi.paket_id,
            nama_guest: sesi.nama_guest.as_deref(),
            durasi: sisa,
            total: sesi.total_bayar,
            waktu_mulai: Some(&now),
            waktu_awal: sisa,
            asal: Some(asal),
        },
    )
    .await?;
    insert_transaksi(
        &mut tx,
        Some(sesi_baru),
        sesi.member_id,
        None,
        "pindah_pc",
        0,
        0,
        &format!("Pindah dari {pc_lama} ke {}", pc_baru.kode),
        None,
        None,
        operator,
        user_id,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|_| "Gagal memindahkan sesi".to_string())?;

    logger::audit_json(
        operator,
        "PINDAH_PC",
        &format!("{pc_lama} -> {} | Sisa:{sisa}m", pc_baru.kode),
        None,
        "",
        "",
        json!({"pc_lama": pc_lama, "pc_baru": pc_baru.kode, "sisa_waktu": sisa}),
    );
    Ok((pc_lama, pc_baru.kode))
}

/// Tutup sesi yang waktunya habis (heartbeat masih segar ≤120 detik).
pub async fn cleanup_expired(st: &AppState) -> i64 {
    let _guard = st.write().await;
    let now = now_db();
    let mut count = 0;
    let daftar = repo::get_all_aktif(&st.pool).await.unwrap_or_default();
    for sesi in daftar {
        if sesi.tipe == "admin" {
            continue;
        }
        if let Some(sync) = sesi.last_sync.as_deref().and_then(parse_dt) {
            if (now - sync).num_seconds() > 120 {
                continue;
            }
        }
        if sesi.sisa_menit(now) > 0 {
            continue;
        }
        let _ = tutup_locked(st, sesi.id, "system").await;
        count += 1;
    }
    count
}

/// Reset mode admin pada PC yang heartbeat-nya sudah mati.
pub async fn cleanup_inactive_admin_sessions(st: &AppState) -> u64 {
    let _guard = st.write().await;
    let daftar: Vec<i64> = sqlx::query_scalar("SELECT id FROM pc WHERE is_admin_mode = 1")
        .fetch_all(&st.pool)
        .await
        .unwrap_or_default();
    let mut count = 0;
    for pc_id in daftar {
        if st.online.is_online(pc_id) {
            continue;
        }
        let _ = sqlx::query("UPDATE pc SET is_admin_mode = 0 WHERE id = ?")
            .bind(pc_id)
            .execute(&st.pool)
            .await;
        let _ = sqlx::query(
            "UPDATE sesi SET status = 'selesai', selesai_pada = ?, is_afk = 0 \
             WHERE pc_id = ? AND tipe = 'admin' AND status = 'aktif'",
        )
        .bind(db_str(now_db()))
        .bind(pc_id)
        .execute(&st.pool)
        .await;
        count += 1;
    }
    if count > 0 {
        logger::audit_json(
            "system",
            "CLEANUP",
            &format!("Reset {count} PC dari mode Admin (Idle timeout)"),
            None,
            "",
            "",
            json!({"pc": count}),
        );
    }
    count
}

pub async fn detail(st: &AppState, sesi_id: i64) -> Result<Value, String> {
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Sesi dengan ID {sesi_id} tidak ditemukan"))?;
    let sisa = sesi.sisa_menit(now_db());
    Ok(json!({
        "id": sesi.id,
        "tipe": sesi.tipe,
        "grup": sesi.pc_grup_nama.clone().unwrap_or_else(|| "reguler".into()),
        "pc_kode": sesi.pc_kode,
        "member_id": sesi.member_id,
        "member_nama": sesi.member_nama,
        "username": sesi.member_username,
        "guest_nama": sesi.nama_guest,
        "sisa_waktu": sisa,
        "sisa_menit": sisa,
    }))
}

/// Riwayat pembelian paket guest dalam satu rantai sesi (untuk audit refund).
pub async fn riwayat_paket(st: &AppState, sesi_id: i64) -> Result<Value, String> {
    let sesi = repo::get_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?;
    let Some(sesi) = sesi else {
        return Ok(json!({"paket": []}));
    };
    if sesi.tipe != "guest" {
        return Ok(json!({"paket": []}));
    }
    let root = sesi.sesi_asal_id.unwrap_or(sesi.id);
    let ids = repo::chain_ids(&st.pool, root)
        .await
        .map_err(|e| e.to_string())?;
    let daftar = transaksi_repo::riwayat_paket_sesi(&st.pool, &ids)
        .await
        .map_err(|e| e.to_string())?;
    let mut sisa_sekala = sesi.sisa_menit(now_db());
    let mut hasil = Vec::new();
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    for t in daftar {
        if sisa_sekala <= 0 {
            break;
        }
        let base = t.paket_durasi_menit.unwrap_or(0);
        let durasi = if t.menit > 0 { t.menit } else { base };
        let qty = if base > 0 { (durasi / base).max(1) } else { 1 };
        hasil.push(json!({
            "id": t.id,
            "nama": t.paket_nama.clone().unwrap_or_else(|| "Paket Dihapus".into()),
            "durasi_menit": durasi,
            "base_durasi_menit": base,
            "qty": qty,
            "harga": t.jumlah,
            "dibuat_pada": t.dibuat_pada.as_deref().and_then(parse_dt)
                .map(|d| format_display(d, &tz)),
            "jenis": t.jenis,
        }));
        sisa_sekala -= durasi;
    }
    Ok(json!({"paket": hasil}))
}

pub async fn refund_paket_guest(
    st: &AppState,
    sesi_id: i64,
    transaksi_id: i64,
    operator: &str,
) -> Result<Value, String> {
    let _guard = st.write().await;
    let sesi = repo::get_aktif_by_id(&st.pool, sesi_id)
        .await
        .map_err(|e| e.to_string())?
        .filter(|s| s.tipe == "guest")
        .ok_or("Sesi tidak aktif atau bukan tipe guest")?;
    let transaksi = transaksi_repo::get_by_id(&st.pool, transaksi_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Transaksi tidak valid atau sudah direfund")?;
    let root = sesi.sesi_asal_id.unwrap_or(sesi.id);
    let chain = repo::chain_ids(&st.pool, root)
        .await
        .map_err(|e| e.to_string())?;
    if !chain.contains(&transaksi.sesi_id.unwrap_or(0)) || transaksi.is_refunded {
        return Err("Transaksi tidak valid atau sudah direfund".into());
    }
    let durasi = if transaksi.menit > 0 {
        transaksi.menit
    } else {
        transaksi.paket_durasi_menit.unwrap_or(0)
    };
    if durasi <= 0 {
        return Err("Durasi paket tidak valid untuk refund".into());
    }
    let sisa = sesi.sisa_menit(now_db());
    if sisa <= 0 {
        return Err("Sisa waktu guest sudah habis. Paket tidak dapat direfund.".into());
    }
    let sebelum = sesi.durasi_beli_menit;
    let dikurangi = durasi.min(sisa);
    let refund_jumlah = if durasi > 0 {
        -((transaksi.jumlah * dikurangi) / durasi)
    } else {
        0
    };
    let no_nota = nota::generate_nota(&st.pool, &crate::services::settings::settings_service::active_timezone(st).await).await;
    let user_id = nota::user_id(&st.pool, operator).await;
    let nama_paket = transaksi
        .paket_nama
        .clone()
        .unwrap_or_else(|| "?".to_string());

    let mut tx = st.pool.begin().await.map_err(|e| e.to_string())?;

    if !transaksi_repo::claim_refund_tx(&mut tx, transaksi.id)
        .await
        .map_err(|e| e.to_string())?
    {
        return Err("Transaksi tidak valid atau sudah direfund".into());
    }

    sqlx::query(
        "UPDATE sesi SET durasi_beli_menit = durasi_beli_menit - ?, \
         total_bayar = MAX(0, total_bayar + ?) WHERE id = ?",
    )
    .bind(dikurangi)
    .bind(refund_jumlah)
    .bind(sesi.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    insert_transaksi(
        &mut tx,
        Some(sesi.id),
        None,
        transaksi.paket_id,
        "refund_paket",
        refund_jumlah,
        -dikurangi,
        &format!("Refund paket guest '{nama_paket}'"),
        Some(&no_nota),
        Some(
            &transaksi
                .metode_pembayaran
                .clone()
                .unwrap_or_else(|| "Tunai".into()),
        ),
        operator,
        user_id,
    )
    .await?;
    tx.commit().await.map_err(|e| e.to_string())?;

    let sesudah = sebelum - dikurangi;
    logger::audit_json(
        operator,
        "REFUND_PAKET",
        &format!(
            "Guest:{} | Durasi: {sebelum}m -> {sesudah}m",
            sesi.nama_guest.clone().unwrap_or_default()
        ),
        None,
        "",
        "",
        json!({
            "no_nota_refund": no_nota,
            "no_nota_original": transaksi.no_nota,
            "jumlah_refund": refund_jumlah,
            "durasi_beli_sebelum": sebelum,
            "durasi_beli_sesudah": sesudah,
            "durasi_dikurangi": dikurangi,
        }),
    );
    Ok(json!({
        "nama_guest": sesi.nama_guest,
        "durasi_beli_sebelum": sebelum,
        "durasi_beli_sesudah": sesudah,
        "durasi_dikurangi": dikurangi,
    }))
}

/// Sinkronisasi saldo member/kasir ke sisa menit (tanpa commit; dipakai heartbeat).
pub async fn sync_waktu_member(st: &AppState, sesi: &Sesi) -> i64 {
    let sisa = sesi.sisa_menit(now_db());
    if sesi.tipe == "member" {
        if let Some(member_id) = sesi.member_id {
            let _ = member_repo::set_waktu_tersimpan(&st.pool, member_id, sisa).await;
        }
    } else if sesi.tipe == "kasir" {
        if let Some(user_id) = sesi.user_id {
            let _ = sqlx::query("UPDATE user SET sisa_kuota_menit = ? WHERE id = ?")
                .bind(sisa)
                .bind(user_id)
                .execute(&st.pool)
                .await;
        }
    }
    sisa
}

/// Dipakai blackout: sisa menit pada titik waktu acuan.
pub fn sisa_pada(sesi: &Sesi, acuan: NaiveDateTime) -> i64 {
    sesi.hitung_sisa_pada(acuan)
}

//! Layanan shift kasir: buka, ringkasan, tutup buta, force-close, riwayat, struk.

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::middleware::auth::Kasir;
use crate::models::shift::ShiftRecord;
use crate::repositories::{shift as repo, user as user_repo};
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::logger;
use crate::utils::time::{db_str, format_display, now_db, parse_dt};
use crate::utils::validators::{int_range, text};

/// Format ribuan `12.345.678` seperti f-string `:,.0f` Python.
pub fn ribuan(n: i64) -> String {
    let negatif = n < 0;
    let digits = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    if negatif {
        format!("-{out}")
    } else {
        out
    }
}

fn norm_metode(raw: Option<String>) -> String {
    match raw {
        Some(m) if !m.is_empty() && m != "Cash" && m != "Tunai" && m != "None" => m,
        _ => "Tunai".into(),
    }
}

async fn scalar(pool: &SqlitePool, sql: &str, awal: &str, akhir: &str) -> i64 {
    sqlx::query_scalar::<_, Option<i64>>(sql)
        .bind(awal)
        .bind(akhir)
        .fetch_one(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or(0)
}

async fn grouped(pool: &SqlitePool, sql: &str, awal: &str, akhir: &str) -> Vec<(String, i64)> {
    let rows = sqlx::query_as::<_, (Option<String>, Option<i64>)>(sql)
        .bind(awal)
        .bind(akhir)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    let mut map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (m, total) in rows {
        *map.entry(norm_metode(m)).or_insert(0) += total.unwrap_or(0);
    }
    map.into_iter().collect()
}

fn metode_terkonfigurasi(raw: Option<String>) -> Vec<String> {
    raw.unwrap_or_else(|| "Tunai, QRIS".into())
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// Ringkasan pendapatan shift pada titik `akhir`.
async fn hitung(st: &AppState, shift: &ShiftRecord, akhir: &str) -> Result<Value, String> {
    let awal = shift.waktu_mulai.clone().ok_or("Shift tidak ditemukan")?;
    let pool = &st.pool;

    let billing_gross = scalar(
        pool,
        "SELECT COALESCE(SUM(jumlah), 0) FROM transaksi WHERE dibuat_pada >= ? AND dibuat_pada <= ? \
         AND jumlah > 0 AND jenis NOT IN ('tutup_sesi', 'pindah_pc', 'refund_paket')",
        &awal,
        akhir,
    )
    .await;
    let total_kantin = scalar(
        pool,
        "SELECT COALESCE(SUM(total_harga), 0) FROM transaksi_menu WHERE tanggal >= ? AND tanggal <= ?",
        &awal,
        akhir,
    )
    .await;

    let mut refund_map = std::collections::HashMap::new();
    let mut total_refund = 0i64;
    for (m, total) in grouped(
        pool,
        "SELECT metode_pembayaran, SUM(jumlah) FROM transaksi WHERE dibuat_pada >= ? \
         AND dibuat_pada <= ? AND jenis = 'refund_paket' GROUP BY metode_pembayaran",
        &awal,
        akhir,
    )
    .await
    {
        let nilai = total.abs();
        *refund_map.entry(m).or_insert(0) += nilai;
        total_refund += nilai;
    }
    let total_billing = billing_gross - total_refund;

    let billing_map: std::collections::HashMap<String, i64> = grouped(
        pool,
        "SELECT metode_pembayaran, SUM(jumlah) FROM transaksi WHERE dibuat_pada >= ? \
         AND dibuat_pada <= ? AND jumlah > 0 \
         AND jenis NOT IN ('tutup_sesi', 'pindah_pc', 'refund_paket') \
         GROUP BY metode_pembayaran",
        &awal,
        akhir,
    )
    .await
    .into_iter()
    .collect();
    let kantin_map: std::collections::HashMap<String, i64> = grouped(
        pool,
        "SELECT metode_pembayaran, SUM(total_harga) FROM transaksi_menu WHERE tanggal >= ? \
         AND tanggal <= ? GROUP BY metode_pembayaran",
        &awal,
        akhir,
    )
    .await
    .into_iter()
    .collect();

    let tunai = "Tunai".to_string();
    let refund_tunai = *refund_map.get(&tunai).unwrap_or(&0);
    let billing_tunai_net = *billing_map.get(&tunai).unwrap_or(&0) - refund_tunai;
    let kantin_tunai = *kantin_map.get(&tunai).unwrap_or(&0);
    let total_tunai_bersih = billing_tunai_net + kantin_tunai;

    let configured = metode_terkonfigurasi(settings_service::get(st, "payment_methods").await);
    let mut semua: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for m in configured
        .iter()
        .chain(billing_map.keys())
        .chain(kantin_map.keys())
        .chain(refund_map.keys())
    {
        if m != "Tunai" {
            semua.insert(m.clone());
        }
    }
    let mut urut: Vec<String> = Vec::new();
    for m in &configured {
        if semua.contains(m) && !urut.contains(m) {
            urut.push(m.clone());
        }
    }
    for m in semua {
        if !urut.contains(&m) {
            urut.push(m);
        }
    }

    let mut non_tunai = Vec::new();
    let mut total_non_tunai = 0i64;
    let mut breakdown = serde_json::Map::new();
    breakdown.insert("Tunai".into(), json!(total_tunai_bersih));
    for m in urut {
        let b_gross = *billing_map.get(&m).unwrap_or(&0);
        let r_val = *refund_map.get(&m).unwrap_or(&0);
        let b_net = b_gross - r_val;
        let k_val = *kantin_map.get(&m).unwrap_or(&0);
        let t_val = b_net + k_val;
        non_tunai.push(json!({
            "method": m,
            "billing": b_net,
            "kantin": k_val,
            "refund": r_val,
            "total": t_val,
        }));
        total_non_tunai += t_val;
        breakdown.insert(m, json!(t_val));
    }

    let rincian = json!({
        "tunai": {
            "billing": billing_tunai_net,
            "kantin": kantin_tunai,
            "refund": refund_tunai,
            "total": total_tunai_bersih,
        },
        "non_tunai": non_tunai,
        "total_non_tunai": total_non_tunai,
    });
    let total_seharusnya = shift.modal_awal + total_tunai_bersih;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;

    Ok(json!({
        "shift_id": shift.id,
        "kasir_nama": shift.kasir_label(),
        "waktu_mulai": shift.waktu_mulai.as_deref().and_then(parse_dt)
            .map(|d| format_display(d, &tz)),
        "waktu_selesai": shift.waktu_selesai.as_deref().and_then(parse_dt)
            .map(|d| format_display(d, &tz)),
        "modal_awal": shift.modal_awal,
        "total_billing": total_billing,
        "total_refund": total_refund,
        "total_kantin": total_kantin,
        "total_pendapatan": total_billing + total_kantin,
        "total_seharusnya": total_seharusnya,
        "uang_fisik": shift.uang_fisik,
        "selisih": shift.selisih,
        "catatan": shift.catatan.clone().unwrap_or_default(),
        "status": shift.status,
        "breakdown": breakdown,
        "rincian_pembayaran": rincian,
        "detail_metode": rincian,
    }))
}

pub async fn summary(st: &AppState, shift_id: i64) -> Result<Value, String> {
    let shift = repo::get_by_id(&st.pool, shift_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Shift tidak ditemukan")?;
    let akhir = shift
        .waktu_selesai
        .clone()
        .unwrap_or_else(|| db_str(now_db()));
    hitung(st, &shift, &akhir).await
}

pub async fn start(
    st: &AppState,
    kasir_username: &str,
    modal: i64,
    operator: &str,
) -> Result<Value, String> {
    let modal = int_range(&json!(modal), 0, 100_000_000, "Modal Awal")?;
    let kasir = user_repo::find_by_username(&st.pool, kasir_username)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Kasir tidak ditemukan")?;
    if !kasir.active() {
        return Err("Kasir tidak aktif".into());
    }
    let _guard = st.write().await;
    if let Some(aktif) = repo::get_active_any(&st.pool)
        .await
        .map_err(|e| e.to_string())?
    {
        let tz = crate::services::settings::settings_service::active_timezone(st).await;
        let sejak = aktif
            .waktu_mulai
            .as_deref()
            .and_then(parse_dt)
            .map(|d| format_display(d, &tz))
            .unwrap_or_default();
        return Err(format!(
            "Tidak dapat membuka shift baru: Masih ada shift aktif oleh '{}' sejak {sejak} (ID #{}). Selesaikan shift tersebut terlebih dahulu.",
            aktif.kasir_label(),
            aktif.id
        ));
    }
    let now = db_str(now_db());
    let id = match repo::insert(&st.pool, kasir.id, modal, &now).await {
        Ok(id) => id,
        Err(e) if e.to_string().contains("UNIQUE") => {
            return Err("Tidak dapat membuka shift baru: masih ada shift aktif".into())
        }
        Err(e) => return Err(e.to_string()),
    };
    logger::rec(
        operator,
        "SHIFT_BUKA",
        &format!("Kasir:{kasir_username} | Modal:Rp{modal}"),
    );
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .map(|s| s.to_json(&tz))
        .ok_or_else(|| "Shift tidak ditemukan".to_string())
}

pub async fn active(st: &AppState, kasir: &Kasir) -> Result<Value, String> {
    let shift = if kasir.user.role() == "admin" {
        repo::get_active_any(&st.pool).await
    } else {
        repo::get_active_by_kasir(&st.pool, kasir.user.id).await
    }
    .map_err(|e| e.to_string())?;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    Ok(json!({
        "success": true,
        "shift": shift.map(|s| s.to_json(&tz)),
    }))
}

pub async fn end(
    st: &AppState,
    kasir_id: i64,
    uang_fisik: i64,
    catatan: Option<&str>,
    operator: &str,
) -> Result<Value, String> {
    let uang_fisik = int_range(&json!(uang_fisik), 0, 100_000_000, "Uang Fisik")?;
    let catatan = text(catatan.unwrap_or(""), 0, 255, "Catatan Shift", false)?;
    let _guard = st.write().await;
    let shift = repo::get_active_by_kasir(&st.pool, kasir_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Tidak ada shift aktif")?;
    let now = db_str(now_db());
    let ringkasan = hitung(st, &shift, &now).await?;
    let total_seharusnya = ringkasan["total_seharusnya"].as_i64().unwrap_or(0);
    let selisih = uang_fisik - total_seharusnya;
    let total_billing = ringkasan["total_billing"].as_i64().unwrap_or(0);
    let total_kantin = ringkasan["total_kantin"].as_i64().unwrap_or(0);
    let total_qris = ringkasan["breakdown"]["QRIS"].as_i64().unwrap_or(0);
    let total_refund = ringkasan["total_refund"].as_i64().unwrap_or(0);
    let rincian = ringkasan["rincian_pembayaran"].clone();

    repo::tutup(
        &st.pool,
        shift.id,
        &now,
        total_billing,
        total_kantin,
        total_qris,
        total_refund,
        Some(uang_fisik),
        Some(selisih),
        &catatan,
        &rincian.to_string(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let catatan_log = if catatan.is_empty() {
        "-"
    } else {
        catatan.as_str()
    };
    let tandai = if selisih > 0 {
        format!("+Rp {}", ribuan(selisih))
    } else {
        format!("-Rp {}", ribuan(selisih.abs()))
    };
    logger::rec(
        operator,
        "SHIFT_TUTUP",
        &format!(
            "Kasir:{} | Modal:Rp{} | Billing:Rp{} | Kantin:Rp{} | QRIS:Rp{} | Fisik:Rp{} | Selisih:{tandai} | Catatan:{}",
            shift.kasir_label(),
            ribuan(shift.modal_awal),
            ribuan(total_billing),
            ribuan(total_kantin),
            ribuan(total_qris),
            ribuan(uang_fisik),
            catatan_log
        ),
    );

    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    Ok(json!({
        "id": shift.id,
        "kasir_nama": shift.kasir_label(),
        "waktu_mulai": shift.waktu_mulai.as_deref().and_then(parse_dt)
            .map(|d| format_display(d, &tz)),
        "waktu_selesai": parse_dt(&now).map(|d| format_display(d, &tz)),
        "modal_awal": shift.modal_awal,
        "total_billing": total_billing,
        "total_kantin": total_kantin,
        "total_qris": total_qris,
        "total_refund": total_refund,
        "total_pendapatan": total_billing + total_kantin,
        "total_seharusnya": total_seharusnya,
        "uang_fisik": uang_fisik,
        "selisih": selisih,
        "catatan": catatan,
        "status": "SELESAI",
        "rincian_pembayaran": rincian,
        "detail_metode": rincian,
    }))
}

pub async fn force_close(
    st: &AppState,
    shift_id: i64,
    admin_username: &str,
    alasan: &str,
) -> Result<Value, String> {
    let alasan = alasan.trim();
    if alasan.chars().count() > 255 {
        return Err("Alasan force-close shift maksimal 255 karakter".into());
    }
    let _guard = st.write().await;
    let shift = repo::get_by_id(&st.pool, shift_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Shift tidak ditemukan")?;
    if shift.status != "AKTIF" {
        return Err("Shift sudah ditutup sebelumnya".into());
    }
    let now = db_str(now_db());
    let ringkasan = hitung(st, &shift, &now).await?;
    let total_seharusnya = ringkasan["total_seharusnya"].as_i64().unwrap_or(0);
    let total_billing = ringkasan["total_billing"].as_i64().unwrap_or(0);
    let total_kantin = ringkasan["total_kantin"].as_i64().unwrap_or(0);
    let total_qris = ringkasan["breakdown"]["QRIS"].as_i64().unwrap_or(0);
    let total_refund = ringkasan["total_refund"].as_i64().unwrap_or(0);
    let rincian = ringkasan["rincian_pembayaran"].clone();

    let mut catatan = if alasan.is_empty() {
        format!("[FORCE CLOSE oleh {admin_username}]")
    } else {
        format!("[FORCE CLOSE oleh {admin_username}] {alasan}")
    };
    if let Some(lama) = shift.catatan.clone().filter(|c| !c.is_empty()) {
        catatan = format!("{lama} | {catatan}");
    }

    repo::tutup(
        &st.pool,
        shift.id,
        &now,
        total_billing,
        total_kantin,
        total_qris,
        total_refund,
        None,
        None,
        &catatan,
        &rincian.to_string(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let alasan_log = if alasan.is_empty() {
        "Penutupan paksa oleh Admin"
    } else {
        alasan
    };
    logger::rec(
        admin_username,
        "SHIFT_FORCE_CLOSE",
        &format!(
            "Admin:{admin_username} FORCE CLOSE Shift #{} Kasir:{} | Alasan:{alasan_log}",
            shift.id,
            shift.kasir_label()
        ),
    );

    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    Ok(json!({
        "id": shift.id,
        "kasir_nama": shift.kasir_label(),
        "waktu_mulai": shift.waktu_mulai.as_deref().and_then(parse_dt)
            .map(|d| format_display(d, &tz)),
        "waktu_selesai": parse_dt(&now).map(|d| format_display(d, &tz)),
        "modal_awal": shift.modal_awal,
        "total_billing": total_billing,
        "total_kantin": total_kantin,
        "total_seharusnya": total_seharusnya,
        "uang_fisik": Value::Null,
        "selisih": Value::Null,
        "catatan": catatan,
        "status": "SELESAI",
        "rincian_pembayaran": rincian,
        "detail_metode": rincian,
    }))
}

pub async fn history(
    st: &AppState,
    kasir_id: Option<i64>,
    limit: i64,
    offset: i64,
    tanggal_mulai: Option<&str>,
    tanggal_selesai: Option<&str>,
) -> Result<Value, String> {
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let mulai = match tanggal_mulai.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => {
            Some(crate::utils::time::day_range_utc(parse_tanggal(raw)?, &tz).0)
        }
        None => None,
    };
    let selesai = match tanggal_selesai.map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => {
            Some(crate::utils::time::day_range_utc(parse_tanggal(raw)?, &tz).0)
        }
        None => None,
    };

    let (rows, total) = repo::history(
        &st.pool,
        kasir_id,
        mulai.as_deref(),
        selesai.as_deref(),
        limit,
        offset,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!({
        "data": rows.iter().map(|s| s.to_json(&tz)).collect::<Vec<_>>(),
        "total": total,
    }))
}

pub async fn kasir_list(st: &AppState) -> Result<Value, String> {
    let rows = sqlx::query_as::<_, (i64, String, Option<String>)>(
        "SELECT id, username, nama_lengkap FROM user WHERE role = 'kasir' AND COALESCE(aktif, 1) = 1 \
         ORDER BY username",
    )
    .fetch_all(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!({
        "kasir": rows
            .into_iter()
            .map(|(id, username, nama)| json!({
                "id": id,
                "nama": nama.filter(|n| !n.is_empty()).unwrap_or_else(|| username.clone()),
                "username": username,
            }))
            .collect::<Vec<_>>(),
    }))
}

fn parse_tanggal(raw: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d")
        .map_err(|_| format!("Format tanggal tidak valid: {raw}"))
}

fn tengah(teks: &str, lebar: usize) -> String {
    let len = teks.chars().count();
    if len >= lebar {
        return teks.to_string();
    }
    let kiri = (lebar - len) / 2;
    format!("{}{teks}", " ".repeat(kiri))
}

fn baris(kiri: &str, kanan: &str) -> String {
    let space = 32isize - kiri.chars().count() as isize - kanan.chars().count() as isize;
    if space < 1 {
        format!("{kiri} {kanan}")
    } else {
        format!("{kiri}{}{kanan}", " ".repeat(space as usize))
    }
}

pub async fn receipt_text(st: &AppState, shift_id: i64) -> Result<String, String> {
    let shift = repo::get_by_id(&st.pool, shift_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Shift tidak ditemukan")?;
    let warnet = settings_service::get_or(st, "warnet_name", "TM BILLING WARNET").await;
    let kasir = shift.kasir_label();
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let w_mulai = shift
        .waktu_mulai
        .as_deref()
        .and_then(parse_dt)
        .map(|d| format_display(d, &tz))
        .unwrap_or_default();
    let w_selesai = shift
        .waktu_selesai
        .as_deref()
        .and_then(parse_dt)
        .map(|d| format_display(d, &tz))
        .unwrap_or_else(|| "-".into());

    let mut lines = vec![
        tengah(&warnet.to_uppercase(), 32),
        tengah("STRUK SERAH TERIMA SHIFT", 32),
        "-".repeat(32),
        baris("No Shift:", &format!("#{}", shift.id)),
        baris("Kasir   :", &kasir.chars().take(18).collect::<String>()),
        baris("Mulai   :", &w_mulai),
        baris("Selesai :", &w_selesai),
        "-".repeat(32),
        baris("Modal Awal  :", &format!("Rp {}", ribuan(shift.modal_awal))),
        baris(
            "Pend.Billing:",
            &format!("Rp {}", ribuan(shift.total_billing)),
        ),
        baris(
            "Pend.Kantin :",
            &format!("Rp {}", ribuan(shift.total_kantin)),
        ),
    ];

    let mut tunai_total: Option<i64> = None;
    let mut rincian_rusak = false;
    if let Some(detail) = shift.detail_metode() {
        tunai_total = detail["tunai"]["total"].as_i64();
        if let Some(items) = detail["non_tunai"].as_array() {
            for item in items {
                let total = item["total"].as_i64().unwrap_or(0);
                if total > 0 {
                    let nama = item["method"].as_str().unwrap_or("Non-Tunai");
                    let label = format!("{}:", nama.chars().take(14).collect::<String>());
                    lines.push(baris(&label, &format!("Rp {}", ribuan(total))));
                }
            }
        }
    } else if shift.detail_metode_json.is_some() {
        rincian_rusak = true;
    }
    if rincian_rusak {
        lines.push(baris("RINCIAN BAYAR:", "TIDAK TERBACA"));
    }
    if tunai_total.is_none() && shift.total_qris > 0 {
        lines.push(baris(
            "Total QRIS  :",
            &format!("Rp {}", ribuan(shift.total_qris)),
        ));
    }
    if shift.total_refund > 0 {
        lines.push(baris(
            "Total Refund:",
            &format!("Rp {}", ribuan(shift.total_refund)),
        ));
    }
    lines.push("-".repeat(32));

    let seharusnya = match tunai_total {
        Some(t) => shift.modal_awal + t,
        None => shift.modal_awal + shift.total_billing + shift.total_kantin - shift.total_qris,
    };
    lines.push(baris(
        "Uang Seharusnya:",
        &format!("Rp {}", ribuan(seharusnya)),
    ));
    match shift.uang_fisik {
        None => {
            lines.push(baris("Uang Fisik Laci:", "BELUM DIHITUNG"));
            lines.push(baris("Selisih Uang   :", "PENUTUPAN PAKSA"));
        }
        Some(fisik) => {
            lines.push(baris("Uang Fisik Laci:", &format!("Rp {}", ribuan(fisik))));
            let selisih = shift.selisih.unwrap_or(0);
            let teks = if selisih == 0 {
                "Rp 0 (PAS)".to_string()
            } else if selisih > 0 {
                format!("+Rp {} (LEBIH)", ribuan(selisih))
            } else {
                format!("-Rp {} (KURANG)", ribuan(selisih.abs()))
            };
            lines.push(baris("Selisih Uang   :", &teks));
        }
    }
    if let Some(catatan) = shift.catatan.clone().filter(|c| !c.is_empty()) {
        lines.push("-".repeat(32));
        lines.push("Catatan:".into());
        lines.push(catatan);
    }
    lines.push("=".repeat(32));
    lines.push(tengah("Tanda Tangan Kasir", 32));
    lines.push(String::new());
    lines.push(String::new());
    lines.push(tengah(&format!("({kasir})"), 32));
    lines.push("-".repeat(32));
    lines.push(tengah("SIMPAN STRUK INI UNTUK AUDIT", 32));
    lines.push(String::new());
    Ok(lines.join("\n"))
}

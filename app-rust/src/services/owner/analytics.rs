//! Analytics owner: pendapatan harian, jam sibuk, tren member, paket terlaris, kasir, refund.

use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::time;
use chrono::{Duration, NaiveDate, Timelike};
use serde_json::{json, Value};
use std::collections::HashMap;

const WARNA: [&str; 6] = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

fn tanggal(raw: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").map_err(|_| "Format tanggal harus YYYY-MM-DD".to_string())
}

fn hari_lokal(raw: Option<&str>, tzname: &str) -> Option<NaiveDate> {
    let dt = raw.and_then(time::parse_dt)?;
    Some(
        chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc)
            .with_timezone(&time::tz(tzname))
            .date_naive(),
    )
}

pub async fn analytics(st: &AppState, start: Option<&str>, end: Option<&str>) -> Result<Value, String> {
    let tzname = settings_service::get_or(st, "timezone", time::DEFAULT_TZ).await;
    let hari_ini = time::today_local(&tzname);
    let akhir = match end {
        Some(s) => tanggal(s)?,
        None => hari_ini,
    };
    let awal = match start {
        Some(s) => tanggal(s)?,
        None => akhir - Duration::days(6),
    };
    if awal >= akhir {
        return Err("Tanggal awal harus sebelum tanggal akhir".into());
    }
    if (akhir - awal).num_days() > 366 {
        return Err("Rentang tanggal maksimal 366 hari".into());
    }

    // Batas query UTC: tengah malam lokal tanggal awal sampai sehari setelah tanggal akhir.
    let lo = time::day_range_utc(awal, &tzname).0;
    let hi = time::day_range_utc(akhir, &tzname).1;

    let mut hari: Vec<NaiveDate> = Vec::new();
    let mut d = awal;
    while d <= akhir {
        hari.push(d);
        d += Duration::days(1);
    }
    let labels: Vec<String> = hari.iter().map(|d| d.format("%d/%m/%Y").to_string()).collect();
    let posisi: HashMap<NaiveDate, usize> = hari.iter().enumerate().map(|(i, d)| (*d, i)).collect();
    let nol = || vec![0i64; hari.len()];

    // 1. Pendapatan harian: billing (berkas transaksi) + kantin.
    let mut billing = nol();
    let baris: Vec<(Option<String>, Option<i64>)> = sqlx::query_as(
        "SELECT dibuat_pada, jumlah FROM transaksi WHERE dibuat_pada >= ? AND dibuat_pada < ? AND jumlah != 0",
    )
    .bind(&lo)
    .bind(&hi)
    .fetch_all(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    for (waktu, jumlah) in baris {
        if let Some(i) = hari_lokal(waktu.as_deref(), &tzname).and_then(|d| posisi.get(&d).copied()) {
            billing[i] += jumlah.unwrap_or(0);
        }
    }

    let mut kantin = nol();
    let baris: Vec<(Option<String>, Option<i64>)> =
        sqlx::query_as("SELECT tanggal, total_harga FROM transaksi_menu WHERE tanggal >= ? AND tanggal < ?")
            .bind(&lo)
            .bind(&hi)
            .fetch_all(&st.pool)
            .await
            .map_err(|e| e.to_string())?;
    for (waktu, total) in baris {
        if let Some(i) = hari_lokal(waktu.as_deref(), &tzname).and_then(|d| posisi.get(&d).copied()) {
            kantin[i] += total.unwrap_or(0);
        }
    }

    // 2. Heatmap jam sibuk.
    let mut per_jam = [0i64; 24];
    let baris: Vec<(Option<String>,)> =
        sqlx::query_as("SELECT mulai_pada FROM sesi WHERE mulai_pada >= ? AND mulai_pada < ?")
            .bind(&lo)
            .bind(&hi)
            .fetch_all(&st.pool)
            .await
            .map_err(|e| e.to_string())?;
    for (waktu,) in baris {
        if let Some(dt) = waktu.as_deref().and_then(time::parse_dt) {
            let jam = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc)
                .with_timezone(&time::tz(&tzname))
                .hour();
            per_jam[jam as usize] += 1;
        }
    }
    let maks = per_jam.iter().copied().max().unwrap_or(0).max(1) as f64;
    let jam_labels: Vec<String> = (0..24).map(|j| format!("{j:02}:00")).collect();
    let jam_data: Vec<f64> = per_jam.iter().map(|c| ((*c as f64 / maks) * 1000.0).round() / 10.0).collect();

    // 3. Tren member baru & kadaluarsa.
    let mut baru = nol();
    let mut keluar = nol();
    let baris: Vec<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT dibuat_pada, kadaluarsa_pada FROM member WHERE (dibuat_pada >= ? AND dibuat_pada < ?) OR (kadaluarsa_pada >= ? AND kadaluarsa_pada < ?)",
    )
    .bind(&lo)
    .bind(&hi)
    .bind(&lo)
    .bind(&hi)
    .fetch_all(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    for (dibuat, kedaluwarsa) in baris {
        if let Some(i) = hari_lokal(dibuat.as_deref(), &tzname).and_then(|d| posisi.get(&d).copied()) {
            baru[i] += 1;
        }
        if let Some(i) = hari_lokal(kedaluwarsa.as_deref(), &tzname).and_then(|d| posisi.get(&d).copied()) {
            keluar[i] += 1;
        }
    }

    // 4. Paket terlaris (refund dikecualikan), 5 teratas + Lainnya.
    let baris: Vec<(Option<i64>, Option<String>, i64)> = sqlx::query_as(
        "SELECT t.paket_id, p.nama, COUNT(t.id) FROM transaksi t LEFT JOIN paket p ON p.id = t.paket_id \
         WHERE t.dibuat_pada >= ? AND t.dibuat_pada < ? AND t.paket_id IS NOT NULL \
         AND COALESCE(t.is_refunded, 0) = 0 AND t.jenis != 'refund_paket' \
         GROUP BY t.paket_id ORDER BY COUNT(t.id) DESC",
    )
    .bind(&lo)
    .bind(&hi)
    .fetch_all(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    let mut paket_labels: Vec<String> = Vec::new();
    let mut paket_data: Vec<i64> = Vec::new();
    for (_, nama, jumlah) in baris.iter().take(5) {
        paket_labels.push(nama.clone().unwrap_or_else(|| "Paket dihapus".into()));
        paket_data.push(*jumlah);
    }
    let sisa: i64 = baris.iter().skip(5).map(|(_, _, j)| *j).sum();
    if sisa > 0 {
        paket_labels.push("Lainnya".into());
        paket_data.push(sisa);
    }
    let paket_warna: Vec<&str> = WARNA.iter().take(paket_labels.len()).copied().collect();

    // 5. Pendapatan per kasir.
    let baris: Vec<(Option<String>, i64)> = sqlx::query_as(
        "SELECT u.nama_lengkap, COALESCE(SUM(t.jumlah), 0) FROM transaksi t JOIN user u ON u.id = t.user_id \
         WHERE t.dibuat_pada >= ? AND t.dibuat_pada < ? AND t.jumlah != 0 \
         GROUP BY u.id, u.nama_lengkap ORDER BY SUM(t.jumlah) DESC",
    )
    .bind(&lo)
    .bind(&hi)
    .fetch_all(&st.pool)
    .await
    .map_err(|e| e.to_string())?;
    let kasir_labels: Vec<String> = baris.iter().map(|(n, _)| n.clone().unwrap_or_default()).collect();
    let kasir_data: Vec<i64> = baris.iter().map(|(_, t)| *t).collect();

    // 6. Refund rate: pembelian paket sebagai penyebut.
    let hitung = |extra: &'static str| {
        let pool = st.pool.clone();
        let lo = lo.clone();
        let hi = hi.clone();
        async move {
            let sql = format!(
                "SELECT COUNT(*) FROM transaksi WHERE dibuat_pada >= ? AND dibuat_pada < ? \
                 AND paket_id IS NOT NULL AND jenis != 'refund_paket' {extra}"
            );
            sqlx::query_scalar::<_, i64>(&sql)
                .bind(lo)
                .bind(hi)
                .fetch_one(&pool)
                .await
        }
    };
    let total = hitung("").await.map_err(|e| e.to_string())?;
    let refund = hitung("AND is_refunded = 1").await.map_err(|e| e.to_string())?;
    let rate = if total > 0 {
        ((refund as f64 / total as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    Ok(json!({
        "pendapatan_harian": {"labels": labels, "billing": billing, "kantin": kantin},
        "heatmap_jam_sibuk": {"labels": jam_labels, "data": jam_data},
        "member_trend": {"labels": labels, "baru": baru, "kadaluarsa": keluar},
        "top_paket": {"labels": paket_labels, "data": paket_data, "colors": paket_warna},
        "pendapatan_per_kasir": {"labels": kasir_labels, "data": kasir_data},
        "refund_rate": {"total": total, "refund": refund, "refund_rate": rate},
    }))
}

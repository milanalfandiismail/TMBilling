//! Laporan keuangan, struk, dan izin hapus riwayat.

use serde_json::{json, Map, Value};

use crate::repositories::{
    menu as menu_repo, sesi as sesi_repo, transaksi as trx_repo, user as user_repo,
};
use crate::state::AppState;
use crate::utils::{logger, time};

pub struct Salah {
    pub status: u16,
    pub pesan: String,
}

impl Salah {
    fn baru(status: u16, pesan: impl Into<String>) -> Self {
        Salah {
            status,
            pesan: pesan.into(),
        }
    }
}

impl From<anyhow::Error> for Salah {
    fn from(e: anyhow::Error) -> Self {
        Salah::baru(500, e.to_string())
    }
}

impl From<sqlx::Error> for Salah {
    fn from(e: sqlx::Error) -> Self {
        Salah::baru(500, e.to_string())
    }
}

pub type Hasil<T> = Result<T, Salah>;

/// `None` untuk "semua tanggal"; selain itu wajib format YYYY-MM-DD.
pub fn parse_tanggal(raw: Option<&str>) -> Hasil<Option<String>> {
    match raw.map(|s| s.trim().to_string()) {
        None => Ok(None),
        Some(t)
            if t.is_empty() || matches!(t.to_lowercase().as_str(), "all" | "semua" | "none") =>
        {
            Ok(None)
        }
        Some(t) => match chrono::NaiveDate::parse_from_str(&t, "%Y-%m-%d") {
            Ok(d) => Ok(Some(d.format("%Y-%m-%d").to_string())),
            Err(_) => Err(Salah::baru(400, "Format tanggal salah. Gunakan YYYY-MM-DD")),
        },
    }
}

pub fn pagination_args(page: Option<i64>, per_page: Option<i64>, bawaan: i64) -> Hasil<(i64, i64)> {
    let page = page.unwrap_or(1);
    let per = per_page.unwrap_or(bawaan);
    if page < 1 {
        return Err(Salah::baru(400, "Parameter page harus >= 1"));
    }
    if !(1..=100_000).contains(&per) {
        return Err(Salah::baru(400, "Parameter per_page harus 1..100000"));
    }
    Ok((page, per))
}

fn nama_pelanggan(member_nama: Option<&str>, guest: Option<&str>) -> String {
    member_nama
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| guest.filter(|s| !s.is_empty()).map(|s| s.to_string()))
        .unwrap_or_else(|| "Guest".into())
}

pub async fn billing(
    st: &AppState,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    page: Option<i64>,
    per_page: Option<i64>,
    metode: Option<&str>,
    q: Option<&str>,
) -> Hasil<Value> {
    let tanggal = parse_tanggal(tanggal)?;
    let (page, per) = pagination_args(page, per_page, 10)?;
    let t = tanggal.as_deref();
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let gross = trx_repo::total_pemasukan(&st.pool, t, kasir_id, metode, &tz).await?;
    let refund = trx_repo::total_refund(&st.pool, t, kasir_id, metode, &tz).await?;
    let kantin = menu_repo::total_pemasukan_by_date(&st.pool, t, kasir_id, metode, &tz).await?;
    let guest = trx_repo::pendapatan_kategori(&st.pool, "guest", t, kasir_id, metode, &tz).await?;
    let member = trx_repo::pendapatan_kategori(&st.pool, "member", t, kasir_id, metode, &tz).await?;

    let offset = (page - 1) * per;
    let (rows, total) =
        trx_repo::history_paginated(&st.pool, t, kasir_id, metode, q, per, offset, &tz).await?;
    let breakdown = trx_repo::breakdown_metode(&st.pool, t, kasir_id, metode, q, &tz).await?;

    let mut breakdown_map = serde_json::Map::new();
    for (m, n) in &breakdown {
        let gross_m = trx_repo::total_pemasukan(&st.pool, t, kasir_id, Some(m.as_str()), &tz).await.unwrap_or(0);
        let refund_m = trx_repo::total_refund(&st.pool, t, kasir_id, Some(m.as_str()), &tz).await.unwrap_or(0);
        breakdown_map.insert(
            m.clone(),
            json!({
                "count": 0,
                "total": *n,
                "gross": gross_m,
                "refund": refund_m,
                "refund_count": 0,
            }),
        );
    }

    let data: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.id,
                "no_nota": r.no_nota.clone().unwrap_or_else(|| format!("OLD-{}", r.id)),
                "tanggal": r.dibuat_pada.as_deref().and_then(time::parse_dt)
                    .map(|d| time::format_display(d, &tz))
                    .unwrap_or_default(),
                "waktu": r.dibuat_pada.as_deref().and_then(time::parse_dt)
                    .map(|d| time::format_display(d, &tz))
                    .unwrap_or_default(),
                "pc_kode": r.pc_kode.clone().unwrap_or_else(|| "-".into()),
                "nama_pelanggan": nama_pelanggan(r.member_nama.as_deref(), r.guest_nama.as_deref()),
                "paket_nama": r.paket_nama.clone()
                    .or_else(|| r.keterangan.clone())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "-".into()),
                "jenis": r.jenis,
                "keterangan": r.keterangan.clone().unwrap_or_default(),
                "menit": r.menit,
                "jumlah": r.jumlah,
                "metode_pembayaran": r.metode_pembayaran.clone().unwrap_or_else(|| "Tunai".into()),
                "operator": r.operator.clone().unwrap_or_default(),
                "kasir_nama": r.operator.clone().unwrap_or_else(|| "System".into()),
                "is_refunded": r.is_refunded,
            })
        })
        .collect();

    let pages = if total == 0 {
        0
    } else {
        (total + per - 1) / per
    };
    Ok(json!({
        "status": "success",
        "tanggal": tanggal.clone().unwrap_or_else(|| "Semua Tanggal".into()),
        "page": page,
        "pages": pages,
        "total": total,
        "has_next": page < pages,
        "has_prev": page > 1,
        "per_page": per,
        "total_pendapatan": gross - refund + kantin,
        "total_pendapatan_billing": gross - refund,
        "total_pendapatan_billing_gross": gross,
        "total_billing": gross - refund,
        "total_billing_gross": gross,
        "total_refund": refund,
        "total_kantin": kantin,
        "total_guest": guest,
        "total_member": member,
        "breakdown": breakdown.iter().map(|(m, n)| json!({"metode": m, "total": n})).collect::<Vec<_>>(),
        "breakdown_metode": Value::Object(breakdown_map),
        "data": data,
    }))
}

pub async fn kantin(
    st: &AppState,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    page: Option<i64>,
    per_page: Option<i64>,
    metode: Option<&str>,
    q: Option<&str>,
) -> Hasil<Value> {
    let tanggal = parse_tanggal(tanggal)?;
    let (page, per) = pagination_args(page, per_page, 12)?;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let rows =
        menu_repo::transactions_by_date(&st.pool, tanggal.as_deref(), kasir_id, metode, &tz).await?;

    // Kelompokkan per nota supaya satu baris = satu pesanan.
    let kata = q.unwrap_or("").to_lowercase();
    let mut urutan: Vec<String> = Vec::new();
    let mut grup: std::collections::HashMap<String, (Value, Vec<Value>, i64)> =
        std::collections::HashMap::new();
    for r in &rows {
        let nota = if r.no_nota.is_empty() {
            format!("ID-{}", r.id)
        } else {
            r.no_nota.clone()
        };
        let nama = r
            .menu_nama
            .clone()
            .unwrap_or_else(|| "Menu Terhapus".into());
        if !kata.is_empty()
            && !nama.to_lowercase().contains(&kata)
            && !nota.to_lowercase().contains(&kata)
        {
            continue;
        }
        let entri = grup.entry(nota.clone()).or_insert_with(|| {
            urutan.push(nota.clone());
            (
                json!({
                    "id": r.id,
                    "no_nota": nota,
                    "tanggal": r.tanggal.map(|d| time::format_display(d, &tz)).unwrap_or_default(),
                    "pc_kode": r.pc_kode.clone().unwrap_or_else(|| "-".into()),
                    "kasir": r.kasir_nama.clone().or(r.operator.clone()).unwrap_or_else(|| "Kasir".into()),
                    "kasir_nama": r.kasir_nama.clone().or(r.operator.clone()).unwrap_or_else(|| "Kasir".into()),
                    "waktu": r.tanggal.map(|d| time::format_display(d, &tz)).unwrap_or_default(),
                    "metode_pembayaran": r.metode_pembayaran.clone().unwrap_or_else(|| "Tunai".into()),
                }),
                Vec::new(),
                0,
            )
        });
        entri.1.push(json!({
            "nama": nama,
            "menu": nama,
            "menu_nama": nama,
            "jumlah": r.jumlah,
            "harga": r.menu_harga,
            "harga_satuan": r.menu_harga,
            "total_harga": r.total_harga,
        }));
        entri.2 += r.total_harga;
    }

    let total_nota = urutan.len() as i64;
    let total_pendapatan: i64 = grup.values().map(|g| g.2).sum();
    let start = ((page - 1) * per).max(0) as usize;
    let data: Vec<Value> = urutan
        .iter()
        .skip(start)
        .take(per as usize)
        .filter_map(|n| {
            grup.get(n).map(|(meta, items, total)| {
                let mut v: Map<String, Value> = meta.as_object().cloned().unwrap_or_default();
                v.insert("items".into(), Value::Array(items.clone()));
                v.insert("items_detail".into(), Value::Array(items.clone()));
                let nama_gabung = items
                    .iter()
                    .filter_map(|i| i.get("nama").and_then(|n| n.as_str()))
                    .collect::<Vec<_>>()
                    .join(", ");
                v.insert("menu_nama".into(), json!(nama_gabung));
                let total_qty: i64 = items
                    .iter()
                    .filter_map(|i| i.get("jumlah").and_then(|n| n.as_i64()))
                    .sum();
                v.insert("jumlah".into(), json!(total_qty));
                v.insert("total_harga".into(), json!(total));
                v.insert("total".into(), json!(total));
                Value::Object(v)
            })
        })
        .collect();
    let pages = if total_nota == 0 {
        0
    } else {
        (total_nota + per - 1) / per
    };

    Ok(json!({
        "status": "success",
        "tanggal": tanggal.unwrap_or_else(|| "Semua Tanggal".into()),
        "page": page,
        "pages": pages,
        "total": total_nota,
        "has_next": page < pages,
        "has_prev": page > 1,
        "total_pendapatan": total_pendapatan,
        "total_pendapatan_menu": total_pendapatan,
        "data": data,
    }))
}

pub async fn harian(st: &AppState, kasir_id: Option<i64>) -> Hasil<Value> {
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let hari_ini = time::today_local(&tz)
        .format("%Y-%m-%d")
        .to_string();
    let billing = trx_repo::total_pemasukan(&st.pool, Some(&hari_ini), kasir_id, None, &tz).await?;
    let refund = trx_repo::total_refund(&st.pool, Some(&hari_ini), kasir_id, None, &tz).await?;
    let kantin =
        menu_repo::total_pemasukan_by_date(&st.pool, Some(&hari_ini), kasir_id, None, &tz).await?;
    let total_sesi = sesi_repo::count_by_date(&st.pool, &hari_ini, &tz).await?;
    let aktif = sesi_repo::count_aktif(&st.pool).await?;
    Ok(json!({
        "tanggal": hari_ini,
        "total_pendapatan": billing - refund + kantin,
        "total_billing": billing - refund,
        "total_kantin": kantin,
        "total_sesi": total_sesi,
        "sesi_aktif": aktif,
    }))
}

pub async fn tanggal_list(st: &AppState) -> Hasil<Value> {
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let tanggal = sesi_repo::distinct_tanggal(&st.pool, &tz).await?;
    Ok(json!({ "tanggal": tanggal }))
}

pub async fn kasir_list(st: &AppState, kasir_id: i64, role: &str) -> Hasil<Value> {
    if role != "admin" {
        let u = user_repo::get_by_id(&st.pool, kasir_id).await?;
        let satu = u
            .map(|u| {
                json!({
                    "id": u.id.to_string(),
                    "nama": u.nama_lengkap.clone().filter(|s| !s.is_empty()).unwrap_or(u.username.clone()),
                })
            })
            .into_iter()
            .collect::<Vec<_>>();
        return Ok(json!({ "kasir": satu }));
    }
    let users = user_repo::get_all(&st.pool, true).await?;
    let mut hasil: Vec<Value> = users
        .iter()
        .map(|u| {
            json!({
                "id": u.id.to_string(),
                "nama": format!("{} (Lokal)", u.nama_lengkap.clone().filter(|s| !s.is_empty()).unwrap_or(u.username.clone())),
            })
        })
        .collect();
    for op in trx_repo::distinct_remote_operators(&st.pool).await? {
        hasil.push(json!({ "id": format!("operator:{op}"), "nama": op }));
    }
    Ok(json!({ "kasir": hasil }))
}

fn meta_warnet(st: &AppState) -> (String, String, String, String) {
    let get = |k: &str, d: &str| {
        st.settings
            .get(k)
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| d.to_string())
    };
    (
        get("warnet_title", "TMBilling"),
        get("warnet_address", "Jl. Merdeka No. 123, Kota"),
        get("warnet_phone", "0812-3456-7890"),
        get("warnet_footer", "Terima kasih, selamat bermain!"),
    )
}

pub async fn struk(st: &AppState, identifier: &str) -> Hasil<Value> {
    let t = if let Ok(id) = identifier.parse::<i64>() {
        trx_repo::get_by_id(&st.pool, id).await?
    } else if let Some(t) = trx_repo::get_by_no_nota(&st.pool, identifier).await? {
        Some(t)
    } else {
        let bersih: String = identifier.trim_start_matches(['T', 'S']).to_string();
        match bersih.parse::<i64>() {
            Ok(id) => trx_repo::get_by_id(&st.pool, id).await?,
            Err(_) => None,
        }
    };
    let t = t.ok_or_else(|| Salah::baru(404, "Data transaksi tidak ditemukan"))?;

    let detail: Option<(
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )> = sqlx::query_as(
        "SELECT m.nama_lengkap, m.username, s.nama_guest, s.tipe, p.kode
             FROM transaksi t
             LEFT JOIN member m ON m.id = t.member_id
             LEFT JOIN sesi s ON s.id = t.sesi_id
             LEFT JOIN pc p ON p.id = s.pc_id
             WHERE t.id = ?",
    )
    .bind(t.id)
    .fetch_optional(&st.pool)
    .await?;
    let (member_nama, _member_user, guest, tipe, pc_kode) =
        detail.unwrap_or((None, None, None, None, None));

    let kasir = match t.user_id {
        Some(uid) => user_repo::get_by_id(&st.pool, uid).await?.map(|u| {
            u.nama_lengkap
                .clone()
                .filter(|s| !s.is_empty())
                .unwrap_or(u.username.clone())
        }),
        None => None,
    };

    let keterangan = match (&t.paket_nama, t.menit, t.paket_durasi_menit) {
        (Some(paket), menit, Some(durasi)) if durasi > 0 => {
            let qty = (menit / durasi).max(1);
            if qty > 1 {
                format!("Paket {paket} {qty}x")
            } else {
                format!("Paket {paket}")
            }
        }
        _ => t
            .keterangan
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Transaksi Warnet".into()),
    };
    let (title, address, phone, footer) = meta_warnet(st);
    let tz = crate::services::settings::settings_service::active_timezone(st).await;

    Ok(json!({
        "no_nota": t.no_nota.clone().unwrap_or_else(|| format!("OLD-{}", t.id)),
        "tanggal": t.dibuat_pada.as_deref().and_then(time::parse_dt)
            .map(|d| time::format_display(d, &tz)).unwrap_or_default(),
        "pc_kode": pc_kode.unwrap_or_else(|| "-".into()),
        "tipe": tipe.unwrap_or_else(|| "topup".into()),
        "nama_pelanggan": nama_pelanggan(member_nama.as_deref(), guest.as_deref()),
        "rincian": [{
            "keterangan": keterangan,
            "durasi": t.menit,
            "harga": t.jumlah,
        }],
        "total_durasi": t.menit,
        "total_harga": t.jumlah,
        "kasir": kasir.unwrap_or_else(|| "Kasir".into()),
        "kasir_id": t.user_id,
        "payment_method": t.metode_pembayaran.clone().unwrap_or_else(|| "Tunai".into()),
        "warnet_title": title,
        "warnet_address": address,
        "warnet_phone": phone,
        "warnet_footer": footer,
    }))
}

pub async fn struk_menu(st: &AppState, t_menu_id: i64) -> Hasil<Value> {
    let pertama = menu_repo::get_transaksi(&st.pool, t_menu_id)
        .await?
        .ok_or_else(|| Salah::baru(404, "Data transaksi menu tidak ditemukan"))?;

    let semua = if !pertama.no_nota.is_empty() {
        let nota = pertama.no_nota.clone();
        {
            sqlx::query_as::<_, crate::models::menu::TransaksiMenu>(
                "SELECT tm.*, m.nama AS menu_nama, m.harga AS menu_harga,
                        u.nama_lengkap AS kasir_nama, u.username AS kasir_username
                 FROM transaksi_menu tm
                 LEFT JOIN menu_item m ON m.id = tm.menu_id
                 LEFT JOIN user u ON u.id = tm.kasir_id
                 WHERE tm.no_nota = ? ORDER BY tm.id",
            )
            .bind(nota)
            .fetch_all(&st.pool)
            .await?
        }
    } else {
        vec![pertama.clone()]
    };

    let mut rincian = Vec::new();
    let mut total_harga = 0i64;
    let mut total_qty = 0i64;
    for tm in &semua {
        rincian.push(json!({
            "keterangan": tm.menu_nama.clone().unwrap_or_else(|| "Menu Terhapus".into()),
            "durasi": tm.jumlah,
            "harga": tm.total_harga,
        }));
        total_harga += tm.total_harga;
        total_qty += tm.jumlah;
    }
    let kasir = pertama
        .kasir_nama
        .clone()
        .filter(|s| !s.is_empty())
        .or(pertama.kasir_username.clone())
        .unwrap_or_else(|| "Kasir".into());
    let (title, address, phone, footer) = (
        meta_warnet(st).0,
        meta_warnet(st).1,
        meta_warnet(st).2,
        st.settings
            .get("warnet_footer")
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "Terima kasih atas kunjungan Anda!".into()),
    );
    let tz = crate::services::settings::settings_service::active_timezone(st).await;

    Ok(json!({
        "no_nota": if pertama.no_nota.is_empty() { format!("ID-{}", pertama.id) } else { pertama.no_nota.clone() },
        "tanggal": pertama.tanggal.map(|d| time::format_display(d, &tz)).unwrap_or_default(),
        "pc_kode": pertama.pc_kode.clone().unwrap_or_else(|| "-".into()),
        "tipe": "kantin",
        "nama_pelanggan": "Pelanggan POS",
        "rincian": rincian,
        "total_durasi": total_qty,
        "total_harga": total_harga,
        "kasir": kasir,
        "kasir_id": pertama.kasir_id,
        "payment_method": pertama.metode_pembayaran.clone().unwrap_or_else(|| "Tunai".into()),
        "tunai": pertama.tunai,
        "kembalian": pertama.kembalian,
        "warnet_title": title,
        "warnet_address": address,
        "warnet_phone": phone,
        "warnet_footer": footer,
    }))
}

const JENIS_TERKUNCI: [&str; 6] = [
    "beli_paket_guest",
    "beli_paket_member",
    "tambah_waktu_sesi",
    "tambah_waktu_guest",
    "refund_paket",
    "blackout_refund",
];

pub async fn delete_transaction(st: &AppState, id: i64, operator: &str) -> Hasil<bool> {
    let t = trx_repo::get_by_id(&st.pool, id).await?;
    if let Some(t) = &t {
        if JENIS_TERKUNCI.contains(&t.jenis.as_str()) {
            return Err(Salah::baru(
                400,
                "Nota paket tidak bisa dihapus. Gunakan Refund agar saldo member ikut kembali.",
            ));
        }
    }
    let t = match t {
        Some(t) => t,
        None => return Ok(false),
    };
    let nota = t.no_nota.clone().unwrap_or_else(|| format!("ID:{id}"));
    let hapus = {
        let _lock = st.write().await;
        trx_repo::delete_by_id(&st.pool, id).await?
    };
    if hapus {
        logger::audit_json(
            operator,
            "DELETE_STRUK",
            &format!("Struk {nota} dihapus permanen"),
            None,
            "-",
            "-",
            json!({"no_nota": t.no_nota, "total": t.jumlah, "jenis": t.jenis}),
        );
    }
    Ok(hapus)
}

pub async fn clear_all_transactions(st: &AppState, operator: &str) -> Hasil<()> {
    if !sesi_repo::get_all_aktif(&st.pool).await?.is_empty() {
        return Err(Salah::baru(
            400,
            "Tutup semua sesi aktif sebelum menghapus riwayat",
        ));
    }
    let _lock = st.write().await;
    let trx = trx_repo::delete_all(&st.pool).await?;
    let menu = menu_repo::delete_all_transaksi(&st.pool).await?;
    let sesi = sesi_repo::delete_history(&st.pool).await?;
    logger::audit_json(
        operator,
        "CLEAR_ALL_HISTORY",
        &format!("Seluruh riwayat dikosongkan ({trx} transaksi, {menu} kantin, {sesi} sesi)"),
        None,
        "-",
        "-",
        json!({"transaksi_dihapus": trx, "menu_dihapus": menu, "sesi_dihapus": sesi}),
    );
    Ok(())
}

pub async fn clear_transactions_by_date(st: &AppState, tanggal: &str, operator: &str) -> Hasil<()> {
    let tanggal = tanggal.trim().to_string();
    let hari = chrono::NaiveDate::parse_from_str(&tanggal, "%Y-%m-%d")
        .map_err(|_| Salah::baru(400, "Format tanggal salah. Gunakan YYYY-MM-DD"))?;
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let (_, target_end) = time::day_range_utc(hari, &tz);
    let _lock = st.write().await;
    for (_, mulai) in sesi_repo::mulai_pada_aktif(&st.pool).await? {
        if let Some(m) = mulai.as_deref().and_then(time::parse_dt) {
            if time::db_str(m) < target_end {
                return Err(Salah::baru(
                    400,
                    "Tutup semua sesi aktif sebelum menghapus riwayat tanggal ini",
                ));
            }
        }
    }
    let trx = trx_repo::delete_by_date(&st.pool, &tanggal, &tz).await?;
    let menu = menu_repo::delete_transaksi_by_date(&st.pool, &tanggal, &tz).await?;
    let sesi = sesi_repo::delete_history_by_date(&st.pool, &tanggal, &tz).await?;
    logger::audit_json(
        operator,
        "CLEAR_TANGGAL",
        &format!("Riwayat tanggal {tanggal} dihapus ({trx} transaksi, {menu} kantin, {sesi} sesi)"),
        None,
        "-",
        "-",
        json!({"tanggal_target": tanggal, "transaksi_dihapus": trx, "menu_dihapus": menu, "sesi_dihapus": sesi}),
    );
    Ok(())
}

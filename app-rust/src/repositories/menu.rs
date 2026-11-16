//! Query katalog F&B, transaksi menu, dan log stok.

use crate::models::menu::{MenuItem, MenuStockLog, TransaksiMenu};
use sqlx::{QueryBuilder, Sqlite, SqlitePool};

const KOLOM: &str = "id, nama, harga, stok, gambar_path, is_active";

pub async fn get_all(pool: &SqlitePool) -> Result<Vec<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!(
        "SELECT {KOLOM} FROM menu_item WHERE is_active = 1 ORDER BY nama ASC"
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_archived(pool: &SqlitePool) -> Result<Vec<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!(
        "SELECT {KOLOM} FROM menu_item WHERE is_active = 0 ORDER BY nama ASC"
    ))
    .fetch_all(pool)
    .await
}

/// Menu aktif saja, seperti `MenuRepository.get_by_id` Python.
pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<Option<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!(
        "SELECT {KOLOM} FROM menu_item WHERE id = ? AND is_active = 1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_by_id_any(pool: &SqlitePool, id: i64) -> Result<Option<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!("SELECT {KOLOM} FROM menu_item WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn find_by_nama(pool: &SqlitePool, nama: &str) -> Result<Option<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!(
        "SELECT {KOLOM} FROM menu_item WHERE nama = ? AND is_active = 1"
    ))
    .bind(nama)
    .fetch_optional(pool)
    .await
}

/// Nama sama boleh ada dua baris (satu arsip, satu baru) — ambil yang aktif lebih dulu.
pub async fn find_by_nama_any(
    pool: &SqlitePool,
    nama: &str,
) -> Result<Option<MenuItem>, sqlx::Error> {
    sqlx::query_as::<_, MenuItem>(&format!(
        "SELECT {KOLOM} FROM menu_item WHERE nama = ? ORDER BY is_active DESC LIMIT 1"
    ))
    .bind(nama)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &SqlitePool,
    nama: &str,
    harga: i64,
    stok: i64,
    gambar_path: Option<&str>,
) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "INSERT INTO menu_item (nama, harga, stok, gambar_path, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    )
    .bind(nama)
    .bind(harga)
    .bind(stok)
    .bind(gambar_path)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    nama: &str,
    harga: i64,
    stok: i64,
    gambar_path: Option<&str>,
    is_active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE menu_item SET nama = ?, harga = ?, stok = ?, gambar_path = ?, is_active = ? WHERE id = ?")
        .bind(nama)
        .bind(harga)
        .bind(stok)
        .bind(gambar_path)
        .bind(is_active)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_stok(pool: &SqlitePool, id: i64, stok: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE menu_item SET stok = ? WHERE id = ?")
        .bind(stok)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_active(pool: &SqlitePool, id: i64, aktif: bool) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE menu_item SET is_active = ? WHERE id = ?")
        .bind(aktif)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM menu_item WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn count_transaksi(pool: &SqlitePool, menu_id: i64) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(id) FROM transaksi_menu WHERE menu_id = ?")
        .bind(menu_id)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn count_transaksi_grouped(
    pool: &SqlitePool,
) -> Result<std::collections::HashMap<i64, i64>, sqlx::Error> {
    let rows: Vec<(Option<i64>, i64)> =
        sqlx::query_as("SELECT menu_id, COUNT(id) FROM transaksi_menu GROUP BY menu_id")
            .fetch_all(pool)
            .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(id, total)| id.map(|id| (id, total)))
        .collect())
}

pub async fn delete_transaksi_by_menu(pool: &SqlitePool, menu_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM transaksi_menu WHERE menu_id = ?")
        .bind(menu_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Kembalikan false bila stok terbatas tidak cukup (stok < 0 = unlimited, ditangani pemanggil).
pub async fn decrement_stok_if_available(
    pool: &SqlitePool,
    id: i64,
    jumlah: i64,
) -> Result<bool, sqlx::Error> {
    let res = sqlx::query("UPDATE menu_item SET stok = stok - ? WHERE id = ? AND stok >= ?")
        .bind(jumlah)
        .bind(id)
        .bind(jumlah)
        .execute(pool)
        .await?;
    Ok(res.rows_affected() > 0)
}

pub async fn max_nota_seq(pool: &SqlitePool, date_str: &str) -> Result<i64, sqlx::Error> {
    let prefix = format!("TMM-{date_str}-");
    let len = prefix.chars().count() as i64;
    let row: (Option<i64>,) = sqlx::query_as(
        "SELECT MAX(CAST(substr(no_nota, ?) AS INTEGER)) FROM transaksi_menu WHERE no_nota LIKE ?",
    )
    .bind(len + 1)
    .bind(format!("{prefix}%"))
    .fetch_one(pool)
    .await?;
    Ok(row.0.unwrap_or(0))
}

pub struct TransaksiBaru<'a> {
    pub no_nota: &'a str,
    pub menu_id: i64,
    pub jumlah: i64,
    pub total_harga: i64,
    pub pc_kode: Option<&'a str>,
    pub kasir_id: i64,
    pub tunai: Option<i64>,
    pub kembalian: Option<i64>,
    pub metode_pembayaran: &'a str,
    pub operator: &'a str,
    pub tanggal: &'a str,
}

pub async fn insert_transaksi(
    pool: &SqlitePool,
    t: &TransaksiBaru<'_>,
) -> Result<TransaksiMenu, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "INSERT INTO transaksi_menu (no_nota, menu_id, jumlah, total_harga, pc_kode, tanggal, kasir_id, tunai, kembalian, metode_pembayaran, operator) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(t.no_nota)
    .bind(t.menu_id)
    .bind(t.jumlah)
    .bind(t.total_harga)
    .bind(t.pc_kode)
    .bind(t.tanggal)
    .bind(t.kasir_id)
    .bind(t.tunai)
    .bind(t.kembalian)
    .bind(t.metode_pembayaran)
    .bind(t.operator)
    .fetch_one(pool)
    .await?;
    get_transaksi(pool, row.0)
        .await
        .map(|t| t.expect("baris yang baru dibuat selalu ada"))
}

pub async fn get_transaksi(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<TransaksiMenu>, sqlx::Error> {
    sqlx::query_as::<_, TransaksiMenu>(
        "SELECT t.id, t.no_nota, t.menu_id, t.jumlah, t.total_harga, t.pc_kode, t.tanggal, t.kasir_id, \
                t.tunai, t.kembalian, t.metode_pembayaran, t.operator, \
                m.nama AS menu_nama, m.harga AS menu_harga, u.nama_lengkap AS kasir_nama, u.username AS kasir_username \
         FROM transaksi_menu t LEFT JOIN menu_item m ON m.id = t.menu_id LEFT JOIN user u ON u.id = t.kasir_id \
         WHERE t.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub struct StockLogBaru<'a> {
    pub menu_id: i64,
    pub menu_nama: &'a str,
    pub jumlah_masuk: i64,
    pub stok_sebelum: i64,
    pub stok_sesudah: i64,
    pub operator: &'a str,
    pub catatan: Option<&'a str>,
    pub created_at: &'a str,
}

pub async fn insert_stock_log(pool: &SqlitePool, l: &StockLogBaru<'_>) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO menu_stock_log (menu_id, menu_nama, tipe, jumlah_masuk, stok_sebelum, stok_sesudah, operator, catatan, created_at) \
         VALUES (?, ?, 'RESTOCK', ?, ?, ?, ?, ?, ?)",
    )
    .bind(l.menu_id)
    .bind(l.menu_nama)
    .bind(l.jumlah_masuk)
    .bind(l.stok_sebelum)
    .bind(l.stok_sesudah)
    .bind(l.operator)
    .bind(l.catatan)
    .bind(l.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub struct FilterLog<'a> {
    pub start: Option<&'a str>,
    pub end: Option<&'a str>,
    pub menu_id: Option<i64>,
    pub operator: Option<&'a str>,
    pub search: Option<&'a str>,
}

const KOLOM_LOG: &str = "id, menu_id, menu_nama, tipe, jumlah_masuk, stok_sebelum, stok_sesudah, operator, catatan, created_at";

fn where_log<'a>(q: &mut QueryBuilder<'a, Sqlite>, f: &FilterLog<'a>) {
    q.push(" WHERE 1 = 1");
    if let (Some(start), Some(end)) = (f.start, f.end) {
        q.push(" AND created_at >= ").push_bind(start.to_string());
        q.push(" AND created_at < ").push_bind(end.to_string());
    }
    if let Some(menu_id) = f.menu_id {
        q.push(" AND menu_id = ").push_bind(menu_id);
    }
    if let Some(op) = f.operator {
        q.push(" AND operator = ").push_bind(op.to_string());
    }
    if let Some(s) = f.search {
        let like = format!("%{s}%");
        q.push(" AND (menu_nama LIKE ")
            .push_bind(like.clone())
            .push(" OR catatan LIKE ")
            .push_bind(like.clone())
            .push(" OR operator LIKE ")
            .push_bind(like)
            .push(")");
    }
}

pub async fn stock_logs_page(
    pool: &SqlitePool,
    f: &FilterLog<'_>,
    page: i64,
    per_page: i64,
) -> Result<(Vec<MenuStockLog>, i64), sqlx::Error> {
    let mut count = QueryBuilder::<Sqlite>::new("SELECT COUNT(*) FROM menu_stock_log");
    where_log(&mut count, f);
    let total: i64 = count.build_query_scalar().fetch_one(pool).await?;

    let mut q = QueryBuilder::<Sqlite>::new(format!("SELECT {KOLOM_LOG} FROM menu_stock_log"));
    where_log(&mut q, f);
    q.push(" ORDER BY created_at DESC, id DESC LIMIT ")
        .push_bind(per_page)
        .push(" OFFSET ")
        .push_bind((page - 1) * per_page);
    let rows = q.build_query_as::<MenuStockLog>().fetch_all(pool).await?;
    Ok((rows, total))
}

pub async fn distinct_operators(pool: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT DISTINCT operator FROM menu_stock_log WHERE operator IS NOT NULL")
            .fetch_all(pool)
            .await?;
    Ok(rows
        .into_iter()
        .map(|r| r.0)
        .filter(|s| !s.trim().is_empty())
        .collect())
}

pub async fn distinct_dates(pool: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT DISTINCT created_at FROM menu_stock_log WHERE created_at IS NOT NULL",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().filter_map(|r| r.0).collect())
}

//! Model katalog F&B, transaksi menu, dan log mutasi stok.

use crate::utils::time;
use chrono::NaiveDateTime;
use serde_json::{json, Value};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MenuItem {
    pub id: i64,
    pub nama: String,
    pub harga: i64,
    pub stok: i64,
    pub gambar_path: Option<String>,
    pub is_active: bool,
}

impl MenuItem {
    pub fn to_json(&self) -> Value {
        json!({
            "id": self.id,
            "nama": self.nama,
            "harga": self.harga,
            "stok": self.stok,
            "gambar_path": self.gambar_path,
            "is_active": self.is_active,
        })
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct TransaksiMenu {
    pub id: i64,
    pub no_nota: String,
    pub menu_id: Option<i64>,
    pub jumlah: i64,
    pub total_harga: i64,
    pub pc_kode: Option<String>,
    pub tanggal: Option<NaiveDateTime>,
    pub kasir_id: Option<i64>,
    pub tunai: Option<i64>,
    pub kembalian: Option<i64>,
    pub metode_pembayaran: Option<String>,
    pub operator: Option<String>,
    pub menu_nama: Option<String>,
    pub menu_harga: Option<i64>,
    pub kasir_nama: Option<String>,
    pub kasir_username: Option<String>,
}

fn tidak_kosong(v: Option<String>) -> Option<String> {
    v.filter(|s| !s.trim().is_empty())
}

impl TransaksiMenu {
    pub fn to_json(&self, tz_name: &str) -> Value {
        let kasir_nama = tidak_kosong(self.operator.clone())
            .or_else(|| tidak_kosong(self.kasir_nama.clone()))
            .or_else(|| tidak_kosong(self.kasir_username.clone()))
            .unwrap_or_else(|| "Kasir Lama".into());
        json!({
            "id": self.id,
            "no_nota": self.no_nota,
            "menu_id": self.menu_id,
            "menu_nama": self.menu_nama.clone().unwrap_or_else(|| "Menu Terhapus".into()),
            "menu_harga": self.menu_harga.unwrap_or(0),
            "jumlah": self.jumlah,
            "total_harga": self.total_harga,
            "pc_kode": self.pc_kode,
            "tanggal": self.tanggal.map(|t| time::format_display(t, tz_name)),
            "kasir_id": self.kasir_id,
            "kasir_nama": kasir_nama,
            "operator": self.operator,
            "tunai": self.tunai,
            "kembalian": self.kembalian,
            "metode_pembayaran": self.metode_pembayaran,
        })
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MenuStockLog {
    pub id: i64,
    pub menu_id: Option<i64>,
    pub menu_nama: String,
    pub tipe: String,
    pub jumlah_masuk: i64,
    pub stok_sebelum: i64,
    pub stok_sesudah: i64,
    pub operator: String,
    pub catatan: Option<String>,
    pub created_at: Option<NaiveDateTime>,
}

impl MenuStockLog {
    pub fn to_json(&self, tz_name: &str) -> Value {
        json!({
            "id": self.id,
            "menu_id": self.menu_id,
            "menu_nama": self.menu_nama,
            "tipe": self.tipe,
            "jumlah_masuk": self.jumlah_masuk,
            "stok_sebelum": self.stok_sebelum,
            "stok_sesudah": self.stok_sesudah,
            "operator": self.operator,
            "catatan": tidak_kosong(self.catatan.clone()).unwrap_or_else(|| "-".into()),
            "created_at": self.created_at.map(|t| time::format_display(t, tz_name)),
        })
    }
}

//! Model buku besar transaksi keuangan.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Transaksi {
    pub id: i64,
    pub sesi_id: Option<i64>,
    pub member_id: Option<i64>,
    pub paket_id: Option<i64>,
    pub user_id: Option<i64>,
    pub jenis: String,
    pub jumlah: i64,
    pub menit: i64,
    pub keterangan: Option<String>,
    pub dibuat_pada: Option<String>,
    pub no_nota: Option<String>,
    pub is_refunded: bool,
    pub metode_pembayaran: Option<String>,
    pub operator: Option<String>,
    pub paket_nama: Option<String>,
    pub paket_durasi_menit: Option<i64>,
}

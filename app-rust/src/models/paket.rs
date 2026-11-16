//! Model Paket (durasi + harga jam-jaman).

use serde::Serialize;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Paket {
    pub id: i64,
    pub nama: String,
    pub durasi_menit: i64,
    pub harga: i64,
    pub kadaluarsa_hari: Option<i64>,
    pub grup_id: Option<i64>,
    pub aktif: Option<bool>,
    pub dibuat_pada: Option<String>,
    /// Nama grup hasil join (dipakai `to_dict()` Python: fallback "reguler").
    pub grup_nama: Option<String>,
    pub grup_warna: Option<String>,
}

impl Paket {
    pub fn active(&self) -> bool {
        self.aktif.unwrap_or(true)
    }

    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "nama": self.nama,
            "durasi_menit": self.durasi_menit,
            "harga": self.harga,
            "kadaluarsa_hari": self.kadaluarsa_hari.unwrap_or(30),
            "grup_id": self.grup_id,
            "grup": self.grup_nama.clone().unwrap_or_else(|| "reguler".into()),
            "grup_warna": self.grup_warna,
            "aktif": self.active(),
        })
    }
}

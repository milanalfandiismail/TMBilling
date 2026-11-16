//! Model Grup (zona tarif: reguler, VIP, VVIP).

use serde::Serialize;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Grup {
    pub id: i64,
    pub nama: String,
    pub warna: Option<String>,
    pub keterangan: Option<String>,
    pub aktif: Option<bool>,
    pub dibuat_pada: Option<String>,
}

impl Grup {
    pub fn active(&self) -> bool {
        self.aktif.unwrap_or(true)
    }

    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "nama": self.nama,
            "keterangan": self.keterangan,
            "warna": self.warna.clone().unwrap_or_else(|| "#888888".into()),
            "aktif": self.active(),
        })
    }
}

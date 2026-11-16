//! Tiket perawatan PC.

use serde::Serialize;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Tiket {
    pub id: i64,
    pub pc_id: Option<i64>,
    pub reporter: Option<String>,
    pub kategori: String,
    pub prioritas: String,
    pub judul: String,
    pub deskripsi: Option<String>,
    pub status: Option<String>,
    pub resolusi: Option<String>,
    pub biaya: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub resolved_at: Option<String>,
    pub resolved_by: Option<String>,
    pub pc_kode: Option<String>,
}

impl Tiket {
    pub fn to_json(&self, tz: &str) -> serde_json::Value {
        let stamp = |v: &Option<String>| crate::utils::time::format_display_opt(v.as_deref(), tz);
        serde_json::json!({
            "id": self.id,
            "pc_id": self.pc_id,
            "pc_kode": self.pc_kode.clone().unwrap_or_else(|| "N/A".into()),
            "reporter": self.reporter.clone().unwrap_or_default(),
            "kategori": self.kategori,
            "prioritas": self.prioritas,
            "judul": self.judul,
            "deskripsi": self.deskripsi.clone().unwrap_or_default(),
            "status": self.status.clone().unwrap_or_else(|| "BARU".into()),
            "resolusi": self.resolusi.clone().unwrap_or_default(),
            "biaya": self.biaya.unwrap_or(0),
            "created_at": stamp(&self.created_at),
            "updated_at": stamp(&self.updated_at),
            "resolved_at": stamp(&self.resolved_at),
            "resolved_by": self.resolved_by.clone().unwrap_or_default(),
        })
    }
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct Ringkas {
    pub total: i64,
}

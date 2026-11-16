//! Model turnamen: Turnamen, Tahap, Tim, Match.

use serde::Serialize;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Turnamen {
    pub id: i64,
    pub nama: String,
    pub deskripsi: Option<String>,
    pub status: Option<String>,
    pub dibuat_pada: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Tahap {
    pub id: i64,
    pub turnamen_id: i64,
    pub nama: String,
    pub tipe_format: String,
    pub urutan: i64,
    pub status: Option<String>,
    pub dibuat_pada: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Tim {
    pub id: i64,
    pub turnamen_id: i64,
    pub nama_tim: String,
    pub status_aktif: Option<i64>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Match {
    pub id: i64,
    pub turnamen_id: i64,
    pub tahap_id: i64,
    pub round_number: i64,
    pub match_number: i64,
    pub tim1_id: Option<i64>,
    pub tim2_id: Option<i64>,
    pub skor1: Option<i64>,
    pub skor2: Option<i64>,
    pub pemenang_id: Option<i64>,
    pub bo_format: Option<i64>,
    pub next_match_id: Option<i64>,
}

impl Turnamen {
    pub fn to_json(&self, stages: Vec<Tahap>, teams_count: usize, tz: &str) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "nama": self.nama,
            "deskripsi": self.deskripsi,
            "status": self.status.clone().unwrap_or_else(|| "draft".into()),
            "dibuat_pada": crate::utils::time::format_display_opt(self.dibuat_pada.as_deref(), tz),
            "stages": stages.iter().map(|s| s.to_json(tz)).collect::<Vec<_>>(),
            "teams_count": teams_count,
        })
    }

    pub fn ringkas(&self, tz: &str) -> serde_json::Value {
        self.to_json(Vec::new(), 0, tz)
    }
}

fn display(stamp: &Option<String>, tz: &str) -> Option<String> {
    crate::utils::time::format_display_opt(stamp.as_deref(), tz)
}

impl Tahap {
    pub fn to_json(&self, tz: &str) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "nama": self.nama,
            "tipe_format": self.tipe_format,
            "urutan": self.urutan,
            "status": self.status.clone().unwrap_or_else(|| "draft".into()),
            "dibuat_pada": display(&self.dibuat_pada, tz),
        })
    }
}

impl Tim {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "nama_tim": self.nama_tim,
            "status_aktif": self.status_aktif.unwrap_or(1) != 0,
        })
    }
}

impl Match {
    pub fn to_json(&self, nama: &std::collections::HashMap<i64, String>) -> serde_json::Value {
        let n = |id: Option<i64>| id.and_then(|v| nama.get(&v).cloned());
        serde_json::json!({
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "tahap_id": self.tahap_id,
            "round_number": self.round_number,
            "match_number": self.match_number,
            "tim1_id": self.tim1_id,
            "tim2_id": self.tim2_id,
            "tim1_nama": n(self.tim1_id),
            "tim2_nama": n(self.tim2_id),
            "skor1": self.skor1.unwrap_or(0),
            "skor2": self.skor2.unwrap_or(0),
            "pemenang_id": self.pemenang_id,
            "pemenang_nama": n(self.pemenang_id),
            "bo_format": self.bo_format.unwrap_or(1),
            "next_match_id": self.next_match_id,
        })
    }
}

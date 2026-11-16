//! Model shift kasir (handover, blind cash reconciliation).

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct ShiftRecord {
    pub id: i64,
    pub kasir_id: i64,
    pub kasir_username: Option<String>,
    pub kasir_nama: Option<String>,
    pub waktu_mulai: Option<String>,
    pub waktu_selesai: Option<String>,
    pub modal_awal: i64,
    pub total_billing: i64,
    pub total_kantin: i64,
    pub total_qris: i64,
    pub total_refund: i64,
    pub uang_fisik: Option<i64>,
    pub selisih: Option<i64>,
    pub catatan: Option<String>,
    pub detail_metode_json: Option<String>,
    pub status: String,
}

impl ShiftRecord {
    pub fn kasir_label(&self) -> String {
        self.kasir_nama
            .clone()
            .filter(|s| !s.is_empty())
            .or_else(|| self.kasir_username.clone())
            .unwrap_or_else(|| "System".into())
    }

    pub fn detail_metode(&self) -> Option<serde_json::Value> {
        self.detail_metode_json
            .as_deref()
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
    }

    /// Bentuk `to_dict()` Python.
    pub fn to_json(&self, tz_name: &str) -> serde_json::Value {
        use crate::utils::time::{format_display, parse_dt};
        let display = |raw: &Option<String>| {
            raw.as_deref()
                .and_then(parse_dt)
                .map(|d| format_display(d, tz_name))
        };
        serde_json::json!({
            "id": self.id,
            "kasir_id": self.kasir_id,
            "kasir_nama": self.kasir_label(),
            "waktu_mulai": display(&self.waktu_mulai),
            "waktu_selesai": display(&self.waktu_selesai),
            "modal_awal": self.modal_awal,
            "total_billing": self.total_billing,
            "total_kantin": self.total_kantin,
            "total_qris": self.total_qris,
            "total_refund": self.total_refund,
            "uang_fisik": self.uang_fisik,
            "selisih": self.selisih,
            "catatan": self.catatan.clone().unwrap_or_default(),
            "status": self.status,
            "total_pendapatan": self.total_billing + self.total_kantin,
            "detail_metode": self.detail_metode(),
        })
    }
}

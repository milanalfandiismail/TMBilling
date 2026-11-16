//! Model member: baris tabel, hitungan kadaluarsa, dan bentuk JSON.

use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Member {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub nama_lengkap: Option<String>,
    pub email: Option<String>,
    pub no_hp: Option<String>,
    pub grup_id: i64,
    pub aktif: bool,
    pub dibuat_pada: Option<String>,
    pub waktu_tersimpan: i64,
    pub kadaluarsa_pada: Option<String>,
}

impl Member {
    /// Bentuk JSON `to_dict()` Python (grup + sisa waktu live dari sesi aktif).
    pub fn to_json(
        &self,
        grup_nama: Option<&str>,
        grup_warna: Option<&str>,
        waktu_tersimpan: i64,
        tz_name: &str,
    ) -> serde_json::Value {
        use crate::utils::time::{format_display, parse_dt};
        let display = |raw: &Option<String>| {
            raw.as_deref()
                .and_then(parse_dt)
                .map(|d| format_display(d, tz_name))
        };
        serde_json::json!({
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap.clone().unwrap_or_default(),
            "email": self.email.clone().unwrap_or_default(),
            "no_hp": self.no_hp.clone().unwrap_or_default(),
            "grup": grup_nama.unwrap_or("reguler"),
            "grup_id": self.grup_id,
            "grup_warna": grup_warna.unwrap_or("#888888"),
            "waktu_tersimpan": waktu_tersimpan,
            "kadaluarsa_pada": self.kadaluarsa_pada.clone(),
            "kadaluarsa_pada_display": display(&self.kadaluarsa_pada),
            "aktif": self.aktif,
            "dibuat_pada": self.dibuat_pada.clone(),
            "dibuat_pada_display": display(&self.dibuat_pada),
        })
    }

    /// Member hangus bila tanggal kadaluarsa sudah lewat (`cek_kadaluarsa`).
    pub fn kadaluarsa(&self, now: chrono::NaiveDateTime) -> bool {
        let Some(raw) = &self.kadaluarsa_pada else {
            return false;
        };
        match crate::utils::time::parse_dt(raw) {
            Some(exp) => exp < now,
            None => false,
        }
    }
}

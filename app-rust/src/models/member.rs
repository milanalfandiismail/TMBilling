//! Model member (dipakai sesi; CRUD penuh di Task 8).

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

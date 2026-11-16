//! Model PC (unit meja klien) + bentuk JSON `to_dict()` Python.

use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Pc {
    pub id: i64,
    pub kode: String,
    pub nama: Option<String>,
    pub ip_address: Option<String>,
    pub mac_address: Option<String>,
    pub grup_id: Option<i64>,
    pub zona: Option<String>,
    pub last_activity: Option<String>,
    pub aktif: Option<bool>,
    pub is_admin_mode: Option<bool>,
    pub pos_x: Option<i64>,
    pub pos_y: Option<i64>,
    pub grup_nama: Option<String>,
    pub grup_warna: Option<String>,
}

/// Potongan sesi aktif yang dipakai kartu PC (hindari memuat seluruh Sesi).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SesiRingkas {
    pub id: i64,
    pub tipe: Option<String>,
    pub nama_guest: Option<String>,
    pub is_afk: Option<bool>,
}

impl Pc {
    pub fn active(&self) -> bool {
        self.aktif.unwrap_or(true)
    }

    pub fn grup(&self) -> String {
        self.grup_nama.clone().unwrap_or_else(|| "reguler".into())
    }

    /// `screenshot` = waktu modifikasi PNG (None bila berkas tidak ada).
    pub fn to_json(&self, sesi: Option<&SesiRingkas>, screenshot: Option<String>) -> Value {
        let mut is_system = false;
        let mut is_admin = false;
        if let Some(s) = sesi {
            if s.tipe.as_deref() == Some("admin") {
                if s.nama_guest.as_deref().unwrap_or("").trim().to_uppercase() == "SYSTEM" {
                    is_system = true;
                } else {
                    is_admin = true;
                }
            }
        } else if self.is_admin_mode.unwrap_or(false) {
            is_admin = true;
        }

        let status = match (sesi.is_some(), is_system, is_admin) {
            (true, true, _) => "system",
            (true, _, true) => "admin",
            (true, _, _) => "terpakai",
            (false, _, true) => "admin",
            (false, _, _) => "kosong",
        };

        json!({
            "id": self.id,
            "kode": self.kode,
            "nama": self.nama,
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "grup_id": self.grup_id.unwrap_or(0),
            "grup": self.grup(),
            "grup_warna": self.grup_warna.clone().unwrap_or_else(|| "#888888".into()),
            "zona": self.grup(),
            "aktif": self.active(),
            "status": status,
            "sesi_id": sesi.map(|s| s.id),
            "is_admin_mode": is_admin,
            "is_system_mode": is_system,
            "is_afk": sesi.and_then(|s| s.is_afk).unwrap_or(false),
            "screenshot_url": screenshot.as_ref().map(|_| format!("/api/v1/kasir/monitor/screenshot/image/{}", self.id)),
            "screenshot_time": screenshot,
            "pos_x": self.pos_x.unwrap_or(-1),
            "pos_y": self.pos_y.unwrap_or(-1),
        })
    }
}

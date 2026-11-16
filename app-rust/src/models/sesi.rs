//! Model sesi bermain + hitungan sisa menit yang identik dengan Python.

use chrono::NaiveDateTime;
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::utils::time::{db_str, format_display, parse_dt};

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct Sesi {
    pub id: i64,
    pub tipe: String,
    pub member_id: Option<i64>,
    pub user_id: Option<i64>,
    pub pc_id: Option<i64>,
    pub paket_id: Option<i64>,
    pub sesi_asal_id: Option<i64>,
    pub nama_guest: Option<String>,
    pub token_sesi: Option<String>,
    pub mulai_pada: Option<String>,
    pub selesai_pada: Option<String>,
    pub durasi_beli_menit: i64,
    pub total_bayar: i64,
    pub status: String,
    pub is_admin: bool,
    pub waktu_mulai_sesi: Option<String>,
    pub waktu_tersimpan_awal: i64,
    pub last_sync: Option<String>,
    pub menit_pause_total: i64,
    pub sisa_menit_saat_mati: i64,
    pub is_blackout_suspect: bool,
    pub is_blackout_resolved: bool,
    pub waktu_resolved: Option<String>,
    pub is_afk: bool,
    pub afk_pin: Option<String>,
    pub afk_sejak: Option<String>,
    // kolom hasil join untuk kebutuhan tampilan
    pub pc_kode: Option<String>,
    pub pc_grup_id: Option<i64>,
    pub pc_grup_nama: Option<String>,
    pub member_username: Option<String>,
    pub member_nama: Option<String>,
    pub member_waktu_tersimpan: Option<i64>,
    pub member_kadaluarsa: Option<String>,
    pub paket_nama: Option<String>,
    pub paket_durasi_menit: Option<i64>,
    pub paket_harga: Option<i64>,
    pub paket_kadaluarsa_hari: Option<i64>,
}

impl Sesi {
    fn awal(&self) -> Option<NaiveDateTime> {
        if self.tipe == "member" {
            self.waktu_mulai_sesi.as_deref().and_then(parse_dt)
        } else {
            self.mulai_pada.as_deref().and_then(parse_dt)
        }
    }

    fn modal(&self) -> i64 {
        if self.tipe == "member" {
            self.waktu_tersimpan_awal
        } else {
            self.durasi_beli_menit
        }
    }

    /// Sisa menit pada titik waktu tertentu (dipakai audit blackout).
    pub fn hitung_sisa_pada(&self, acuan: NaiveDateTime) -> i64 {
        let Some(awal) = self.awal() else { return 0 };
        let terpakai = (acuan - awal).num_seconds() / 60;
        ((self.modal() + self.menit_pause_total) - terpakai).max(0)
    }

    /// Total menit terpakai efektif (dikurangi pause blackout).
    pub fn menit_terpakai(&self, now: NaiveDateTime) -> i64 {
        let pause = self.menit_pause_total;
        let awal = if self.tipe == "guest" {
            self.mulai_pada.as_deref().and_then(parse_dt)
        } else {
            self.waktu_mulai_sesi.as_deref().and_then(parse_dt)
        };
        let Some(awal) = awal else { return 0 };
        let akhir = self
            .selesai_pada
            .as_deref()
            .and_then(parse_dt)
            .unwrap_or(now);
        let raw = ((akhir - awal).num_seconds() / 60).max(0);
        (raw - pause).max(0)
    }

    /// Sisa menit real-time; untuk member/kasir jatuh ke saldo bila belum mulai.
    pub fn sisa_menit(&self, now: NaiveDateTime) -> i64 {
        let pause = self.menit_pause_total;
        match self.tipe.as_str() {
            "guest" => (self.durasi_beli_menit - self.menit_terpakai(now)).max(0),
            _ => {
                if let Some(awal) = self.waktu_mulai_sesi.as_deref().and_then(parse_dt) {
                    if self.waktu_tersimpan_awal > 0 {
                        let akhir = self
                            .selesai_pada
                            .as_deref()
                            .and_then(parse_dt)
                            .unwrap_or(now);
                        let terpakai = ((akhir - awal).num_seconds() / 60).max(0) - pause;
                        return (self.waktu_tersimpan_awal - terpakai).max(0);
                    }
                }
                self.member_waktu_tersimpan.unwrap_or(0)
            }
        }
    }

    /// Nama pemakai untuk tampilan dashboard.
    pub fn nama_pemakai(&self) -> Option<String> {
        if let Some(nama) = &self.member_nama {
            return Some(nama.clone());
        }
        if let Some(username) = &self.member_username {
            return Some(username.clone());
        }
        self.nama_guest.clone()
    }

    pub fn to_json(&self, now: NaiveDateTime, tz_name: &str) -> Value {
        let fmt = |v: &Option<String>| {
            v.as_deref()
                .and_then(parse_dt)
                .map(|d| format_display(d, tz_name))
        };
        json!({
            "id": self.id,
            "tipe": self.tipe,
            "member_id": self.member_id,
            "user_id": self.user_id,
            "member_nama": self.nama_pemakai(),
            "nama_guest": self.nama_guest,
            "pc_kode": self.pc_kode,
            "grup": self.pc_grup_nama.clone().unwrap_or_else(|| "reguler".into()),
            "paket": self.paket_nama.as_ref().map(|nama| json!({
                "id": self.paket_id,
                "nama": nama,
                "durasi_menit": self.paket_durasi_menit,
                "harga": self.paket_harga,
                "kadaluarsa_hari": self.paket_kadaluarsa_hari,
            })),
            "mulai_pada": fmt(&self.mulai_pada),
            "selesai_pada": fmt(&self.selesai_pada),
            "sisa_menit": self.sisa_menit(now),
            "status": self.status,
            "waktu_mulai_sesi": fmt(&self.waktu_mulai_sesi),
            "waktu_tersimpan_awal": self.waktu_tersimpan_awal,
            "menit_pause_total": self.menit_pause_total,
            "is_admin": self.is_admin,
            "is_afk": self.is_afk,
            "afk_sejak": fmt(&self.afk_sejak),
            "last_sync": fmt(&self.last_sync),
        })
    }

    /// Baris ringkas halaman audit mati lampu (`to_dict_audit`).
    pub fn to_json_audit(&self, tz_name: &str) -> Value {
        let ref_dt = self
            .last_sync
            .as_deref()
            .or(self.mulai_pada.as_deref())
            .and_then(parse_dt);
        let jam = ref_dt
            .map(|d| {
                format_display(d, tz_name)
                    .rsplit_once(' ')
                    .map(|(depan, _)| depan.rsplit(' ').next().unwrap_or("-").to_string())
                    .unwrap_or_else(|| "-".into())
            })
            .unwrap_or_else(|| "-".into());
        json!({
            "id": self.id,
            "pc_kode": self.pc_kode.clone().unwrap_or_else(|| "-".into()),
            "username": self.member_username.clone()
                .or_else(|| self.nama_guest.clone())
                .unwrap_or_else(|| "Guest".into()),
            "tipe": self.tipe,
            "grup": self.pc_grup_nama.clone().unwrap_or_else(|| "reguler".into()),
            "jam_mati": jam,
            "timezone": crate::utils::time::tz_label(tz_name),
            "sisa_waktu_mati": self.sisa_menit_saat_mati,
            "is_blackout_resolved": self.is_blackout_resolved,
        })
    }
}

/// Timestamp DB untuk penulisan (UTC naive, mikro detik).
pub fn stamp() -> String {
    db_str(crate::utils::time::now_db())
}

use serde::{Deserialize, Serialize};

/// Balasan /status, /auth/login, /admin-login. Nama field mengikuti server apa adanya.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StatusResponse {
    pub status: String, // "aktif" | "admin" | "system" | "kosong" | "error"
    pub sisa_waktu: Option<u32>,
    #[serde(default)]
    pub sisa_detik: Option<i64>,
    #[serde(default)]
    pub mulai: Option<String>,
    pub nama: Option<String>,
    pub grup: Option<String>,
    pub pc_kode: Option<String>,
    pub shutdown_timer: Option<u32>,
    pub command: Option<String>,
    pub message: Option<String>,
    #[serde(default)]
    pub is_afk: Option<bool>,
    #[serde(default)]
    pub polling_interval: Option<u64>,
    #[serde(default)]
    pub is_member: Option<bool>,
    #[serde(default)]
    pub member: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentifyResponse {
    pub valid: bool,
    pub pc_kode: Option<String>,
    pub grup: Option<String>,
    pub error: Option<String>,
    #[serde(default)]
    pub polling_interval: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberLoginResponse {
    pub success: bool,
    pub waktu_tersimpan: Option<u32>,
    pub nama: Option<String>,
    pub grup: Option<String>,
    pub pc_kode: Option<String>,
    pub error: Option<String>,
    #[serde(default)]
    pub is_member: Option<bool>,
    #[serde(default)]
    pub tipe: Option<String>,
    #[serde(default)]
    pub member: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AdminUserData {
    pub id: Option<i64>,
    pub username: Option<String>,
    pub nama_lengkap: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub token_sesi: Option<String>,
    pub user: Option<AdminUserData>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WarnetConfig {
    pub title: Option<String>,
    pub announcement: Option<String>,
    pub qris_url: Option<String>,
    #[serde(default)]
    pub qris_path: Option<String>,
    #[serde(default)]
    pub paket: Vec<serde_json::Value>,
    #[serde(default)]
    pub menu: Vec<serde_json::Value>,
}

/// Item Game/Aplikasi dari katalog publik server `/api/v1/public/game`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GameItem {
    pub id: i64,
    pub nama: String,
    #[serde(default)]
    pub tipe: Option<String>, // "game" | "aplikasi"
    #[serde(default)]
    pub kategori: Option<String>,
    #[serde(default)]
    pub exe_path: Option<String>,
    #[serde(default)]
    pub argumen: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub aktif: Option<bool>,
}

impl GameItem {
    pub fn is_aplikasi(&self) -> bool {
        self.tipe.as_deref().unwrap_or("game").eq_ignore_ascii_case("aplikasi")
    }

    pub fn action_label(&self) -> &'static str {
        "▶ BUKA"
    }
}


use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use crate::state::{REMAINING_SECONDS, SESSION_ACTIVE};

use winreg::enums::*;
use winreg::RegKey;
use base64::Engine;
use sha2::{Sha256, Digest};
use super::qris_memory;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusResponse {
    pub status: String, // "aktif", "admin", "kosong", "error"
    pub sisa_waktu: Option<u32>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IdentifyResponse {
    pub valid: bool,
    pub pc_kode: Option<String>,
    pub grup: Option<String>,
    pub error: Option<String>,
    #[serde(default)]
    pub polling_interval: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdminUserData {
    pub id: Option<i64>,
    pub username: Option<String>,
    pub nama_lengkap: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub token_sesi: Option<String>,
    pub user: Option<AdminUserData>,
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WarnetConfig {
    pub title: Option<String>,
    pub announcement: Option<String>,
    pub qris_url: Option<String>,
    pub paket: Vec<serde_json::Value>,
    #[serde(default)]
    pub menu: Vec<serde_json::Value>,
    #[serde(default)]
    pub qris_path: Option<String>,
}

/// URL gambar QRIS: path relatif dari server selalu menang,
/// karena host/skema mengikuti server_url milik client sendiri.
fn resolve_qris_source(base_url: &str, qris_path: Option<&str>, qris_url: Option<&str>) -> Option<String> {
    let rel = qris_path.or(qris_url)?;
    if rel.starts_with('/') {
        Some(format!("{}{}", base_url, rel))
    } else {
        Some(rel.to_string())
    }
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn to_sha256_hash(val: &str) -> String {
    let val = val.trim();
    // Sudah berupa SHA256 hash (64 hex chars) — return as-is
    if val.len() == 64 && val.chars().all(|c| c.is_ascii_hexdigit()) {
        return val.to_lowercase();
    }
    // Plain text — hash langsung (emergency creds tidak di-XOR-obfuscate)
    sha256_hex(val)
}

pub fn is_emergency_response(status: &str, nama: Option<&str>) -> bool {
    status == "system" && nama == Some("SYSTEM")
}

#[derive(Clone)]
pub struct ApiService {
    client: reqwest::Client,
    server_url: String,
    pub api_key: String,
    pub emergency_user: String,
    pub emergency_token: String,
}

impl ApiService {
    pub fn new() -> Self {
        let (url, api_key, em_user, em_token) = Self::load_config();
        let em_token = em_token; // deobfuscated by load_config
        let em_user = em_user;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            client,
            server_url: format!("{}/api/v1/public/client", url),
            api_key,
            emergency_user: em_user,
            emergency_token: em_token,
        }
    }

    fn load_config() -> (String, String, String, String) {
        // 1. Coba REGISTRY > INI priority
        let mut reg_url = None;
        let mut reg_api_key = None;
        let mut reg_em_user = None;
        let mut reg_em_token = None;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let reg_result = hklm.open_subkey("Software\\TMBilling").or_else(|_| hkcu.open_subkey("Software\\TMBilling"));

        if let Ok(subkey) = reg_result {
            if let Ok(u) = subkey.get_value::<String, _>("Url") {
                if !u.trim().is_empty() {
                    reg_url = Some(u);
                }
            }
            if let Ok(k) = subkey.get_value::<String, _>("ApiKey") {
                let k = k.trim().to_string();
                if !k.is_empty() {
                    reg_api_key = Some(k);
                }
            }
            if let Ok(user) = subkey.get_value::<String, _>("EmergencyUser") {
                let user = user.trim().to_string();
                if !user.is_empty() {
                    reg_em_user = Some(to_sha256_hash(&user));
                }
            }
            if let Ok(t) = subkey.get_value::<String, _>("EmergencyToken") {
                let t = t.trim().to_string();
                if !t.is_empty() {
                    reg_em_token = Some(to_sha256_hash(&t));
                }
            }
        }

        // 2. Fallback ke config.ini (cek folder aktif, %LOCALAPPDATA%\TMBilling, dan C:\TMBILLING)
        let mut ini_url = None;
        let mut ini_api_key = None;
        let mut ini_em_user = None;
        let mut ini_em_token = None;

        let mut config_paths = vec![std::path::PathBuf::from("config.ini")];
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            config_paths.push(std::path::PathBuf::from(local_appdata).join("TMBilling").join("config.ini"));
        }
        config_paths.push(std::path::PathBuf::from(r"C:\TMBILLING\config.ini"));

        for config_path in config_paths {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with(';') || line.starts_with('#') || line.is_empty() {
                        continue;
                    }
                    if let Some(pos) = line.find('=') {
                        let key = line[..pos].trim().to_lowercase();
                        let val = line[pos + 1..].trim().to_string();
                        if key == "url" {
                            ini_url = Some(val);
                        } else if key == "apikey" || key == "api_key" {
                            ini_api_key = Some(val);
                        } else if key == "emergencyuser" || key == "emergency_user" {
                            ini_em_user = Some(to_sha256_hash(&val));
                        } else if key == "emergencytoken" || key == "emergency_token" {
                            ini_em_token = Some(to_sha256_hash(&val));
                        }
                    }
                }
                if ini_url.is_some() {
                    break;
                }
            }
        }

        let url = reg_url.or(ini_url).unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
        let api_key = reg_api_key.or(ini_api_key).unwrap_or_default();
        let em_user = reg_em_user.or(ini_em_user).unwrap_or_default();
        let em_token = reg_em_token.or(ini_em_token).unwrap_or_default();

        (url, api_key, em_user, em_token)
    }

    pub async fn identify(&self, ip: &str, mac: &str) -> Result<IdentifyResponse, String> {
        self.identify_with_role(ip, mac, "client").await
    }

    pub async fn identify_with_role(&self, ip: &str, mac: &str, role: &str) -> Result<IdentifyResponse, String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "role": role
        });
        self.post_request("identify", body).await
    }

    pub async fn get_status(&self, ip: &str, mac: &str) -> Result<StatusResponse, String> {
        let role = if crate::state::IS_ADMIN_MODE.load(Ordering::SeqCst) { "admin" } else { "client" };
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "role": role
        });

        let mut status: StatusResponse = self.post_request("status", body).await?;
        
        let is_emergency = crate::state::IS_EMERGENCY_MODE.load(Ordering::SeqCst);
        if !is_emergency {
            if status.status == "aktif" || status.status == "admin" || status.status == "system" {
                SESSION_ACTIVE.store(true, Ordering::SeqCst);
                if status.status == "admin" || status.status == "system" {
                    status.sisa_waktu = Some(999999);
                    REMAINING_SECONDS.store(999999, Ordering::SeqCst);
                } else if let Some(menit) = status.sisa_waktu {
                    let detik = menit * 60;
                    REMAINING_SECONDS.store(detik, Ordering::SeqCst);
                    status.sisa_waktu = Some(detik);
                }
            } else {
                // Jangan reset SESSION_ACTIVE di sini agar loop polling main.rs sempat mendeteksi perubahan status kosong/error
            }
        } else {
            // Mode emergency:
            // Jika server merespon dengan status kosong atau perintah lock/logout,
            // JANGAN timpa status menjadi system agar polling loop bisa mendeteksi instruksi lock dari kasir/server
            if status.status == "kosong" || status.command.as_deref() == Some("lock") || status.command.as_deref() == Some("logout") {
                // Biarkan status dan command asli dari server
            } else {
                SESSION_ACTIVE.store(true, Ordering::SeqCst);
                status.status = "system".to_string();
                status.sisa_waktu = Some(999999);
                REMAINING_SECONDS.store(999999, Ordering::SeqCst);
            }
        }

        Ok(status)
    }

    pub async fn logout(&self, ip: &str, mac: &str) -> Result<(), String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac
        });

        let _res: serde_json::Value = self.post_request("selesai", body).await?;
        SESSION_ACTIVE.store(false, Ordering::SeqCst);
        Ok(())
    }

    pub async fn afk_lock(&self, ip: &str, mac: &str, pin: Option<String>) -> Result<(), String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "pin": pin
        });
        let _res: serde_json::Value = self.post_request("afk-lock", body).await?;
        Ok(())
    }

    pub async fn afk_unlock(&self, ip: &str, mac: &str, credential: &str) -> Result<(), String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "credential": credential
        });
        let _res: serde_json::Value = self.post_request("afk-unlock", body).await?;
        Ok(())
    }

    pub async fn member_login(&self, ip: &str, mac: &str, user: &str, pass: &str) -> Result<StatusResponse, String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": user,
            "password": pass
        });

        let base_url = self.server_url.replace("/api/v1/public/client", "");
        let url = format!("{}/api/v1/public/auth/login", base_url);

        let res = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Koneksi Gagal: {}", e))?;

        let status_code = res.status();
        let body_text = res.text().await.map_err(|e| format!("Gagal baca body: {}", e))?;

        if !status_code.is_success() {
            if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(msg) = json_err.get("error") {
                    return Err(msg.as_str().unwrap_or("Terjadi kesalahan").to_string());
                }
            }
            return Err(format!("Gagal: {}", status_code));
        }

        let raw: MemberLoginResponse = serde_json::from_str(&body_text)
            .map_err(|_e| format!("Gagal urai data member."))?;

        let is_member = raw.is_member.or_else(|| {
            raw.tipe.as_deref().map(|t| t == "member")
        }).unwrap_or(true);

        Ok(StatusResponse {
            status: "aktif".to_string(),
            sisa_waktu: raw.waktu_tersimpan.map(|m| m * 60),
            nama: raw.nama,
            grup: raw.grup,
            pc_kode: raw.pc_kode,
            shutdown_timer: Some(0),
            command: None,
            message: None,
            is_afk: Some(false),
            polling_interval: None,
            is_member: Some(is_member),
            member: raw.member,
        })
    }

    pub async fn admin_login(&self, ip: &str, mac: &str, user: &str, pass: &str) -> Result<StatusResponse, String> {
        // 1. CEK EMERGENCY CREDENTIALS OFFLINE DULU (biar bisa offline)
        let user_hash = sha256_hex(user.trim());
        let pass_hash = sha256_hex(pass.trim());
        // Kredensial darurat kosong = fitur dinonaktifkan (fail-closed), lanjut ke login server
        if !self.emergency_user.is_empty()
            && !self.emergency_token.is_empty()
            && user_hash.eq_ignore_ascii_case(&self.emergency_user)
            && pass_hash.eq_ignore_ascii_case(&self.emergency_token)
        {
            return Ok(StatusResponse {
                status: "system".to_string(),
                sisa_waktu: Some(0),
                nama: Some("SYSTEM".to_string()),
                grup: Some("SYSTEM".to_string()),
                pc_kode: None,
                shutdown_timer: Some(0),
                command: None,
                message: None,
                is_afk: Some(false),
                polling_interval: None,
                is_member: Some(false),
                member: None,
            });
        }

        // 2. COBA SERVER (admi DB biasa)
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": user,
            "password": pass,
            "role": "admin"
        });

        let url = format!("{}/admin-login", self.server_url);
        let res = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .json(&body)
            .send()
            .await;

        if let Err(e) = res {
            return Err(format!("Koneksi Gagal: {}", e));
        }

        let res = res.unwrap();
        let status = res.status();
        let body_text = res.text().await.map_err(|e| format!("Gagal baca body: {}", e))?;

        if !status.is_success() {
            if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(msg) = json_err.get("error") {
                    return Err(msg.as_str().unwrap_or("Gagal login admin").to_string());
                }
            }
            return Err(format!("Gagal: {}", status));
        }

        let raw: AdminLoginResponse = serde_json::from_str(&body_text)
            .map_err(|_| format!("Gagal urai data admin."))?;

        let display_name = match &raw.user {
            Some(u) => u.nama_lengkap.as_deref().unwrap_or(u.username.as_deref().unwrap_or(user)).to_string(),
            None => user.to_string(),
        };

        Ok(StatusResponse {
            status: "admin".to_string(),
            sisa_waktu: Some(0),
            nama: Some(display_name),
            grup: Some("ADMINISTRATOR".to_string()),
            pc_kode: None,
            shutdown_timer: Some(0),
            command: None,
            message: None,
            is_afk: Some(false),
            polling_interval: None,
            is_member: Some(false),
            member: None,
        })
    }

    pub async fn emergency_login(&self, ip: &str, mac: &str, username: &str) -> Result<StatusResponse, String> {
        // Kirim ke server agar tercatat di DB & log (PC mana yang emergency login, siapa usernya).
        // Otorisasi server berbasis IP asal PC (token darurat server tidak lagi dibagikan ke client).
        // Server tak terjangkau = tidak ada yang perlu dicatat, jadi lewati POST (hindari timeout dobel).
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": username,
        });

        let url = format!("{}/emergency-login", self.server_url);
        let _ = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .json(&body)
            .send()
            .await;

        // TETAP SUKSES walau server unreachable (emergency mode = offline-first)
        Ok(StatusResponse {
            status: "system".to_string(),
            sisa_waktu: Some(0),
            nama: Some("SYSTEM".to_string()),
            grup: Some("SYSTEM".to_string()),
            pc_kode: None,
            shutdown_timer: Some(0),
            command: None,
            message: None,
            is_afk: Some(false),
            polling_interval: None,
            is_member: Some(false),
            member: None,
        })
    }


    async fn post_request<T: serde::de::DeserializeOwned>(&self, endpoint: &str, payload: serde_json::Value) -> Result<T, String> {
        let url = format!("{}/{}", self.server_url, endpoint);
        
        let res = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Koneksi Gagal: {}", e))?;

        let status = res.status();
        let body_text = res.text().await.map_err(|e| format!("Gagal baca body: {}", e))?;

        if !status.is_success() {
            if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(msg) = json_err.get("error") {
                    return Err(msg.as_str().unwrap_or("Terjadi kesalahan").to_string());
                }
            }
            return Err(format!("Gagal ({}): {}", status, body_text));
        }

        serde_json::from_str::<T>(&body_text)
            .map_err(|_e| format!("Gagal urai data dari server."))
    }

    pub async fn upload_screenshot(&self, ip: &str, img_bytes: Vec<u8>) -> Result<(), String> {
        let base_url = self.server_url.replace("/api/v1/public/client", "");
        let url = format!("{}/api/v1/public/monitor/screenshot/upload", base_url);

        let res = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .header("Content-Type", "image/png")
            .header("X-IP-Address", ip)
            .body(img_bytes)
            .send()
            .await
            .map_err(|e| format!("Koneksi Gagal: {}", e))?;

        let status = res.status();
        if !status.is_success() {
            let body_text = res.text().await.unwrap_or_default();
            return Err(format!("Gagal upload ({}): {}", status, body_text));
        }

        Ok(())
    }

    pub async fn get_warnet_config(&self) -> Result<WarnetConfig, String> {
        let base_url = self.server_url.replace("/api/v1/public/client", "");
        let url = format!("{}/api/v1/public/client/warnet", base_url);

        let res = self.client.get(&url)
            .header("X-Client-Key", &self.api_key)
            .send()
            .await
            .map_err(|e| format!("Koneksi Gagal: {}", e))?;

        let status = res.status();
        let body_text = res.text().await.map_err(|e| format!("Gagal baca body: {}", e))?;

        if !status.is_success() {
            if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(msg) = json_err.get("error") {
                    return Err(msg.as_str().unwrap_or("Terjadi kesalahan").to_string());
                }
            }
            return Err(format!("Gagal ({}): {}", status, body_text));
        }

        let mut config: WarnetConfig = serde_json::from_str(&body_text)
            .map_err(|_| format!("Gagal urai data warnet dari server."))?;

        // QRIS: pakai data URI di memori bila URL sama, unduh hanya saat URL berubah.
        if let Some(img_url) = resolve_qris_source(
            &base_url,
            config.qris_path.as_deref(),
            config.qris_url.as_deref(),
        ) {
            if let Some(data) = qris_memory::last_for(&img_url) {
                config.qris_url = Some(data);
            } else {
                match self.client.get(&img_url)
                    .timeout(std::time::Duration::from_secs(10))
                    .send()
                    .await
                {
                    Ok(resp) if resp.status().is_success() => {
                        let bytes = resp.bytes().await.unwrap_or_default();
                        if bytes.is_empty() {
                            config.qris_url = None;
                        } else {
                            let lower = img_url.to_lowercase();
                            let mime = if lower.ends_with(".png") {
                                "image/png"
                            } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
                                "image/jpeg"
                            } else if lower.ends_with(".gif") {
                                "image/gif"
                            } else if lower.ends_with(".webp") {
                                "image/webp"
                            } else {
                                "image/png"
                            };
                            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                            let data_uri = format!("data:{};base64,{}", mime, b64);
                            qris_memory::remember(&img_url, &data_uri);
                            config.qris_url = Some(data_uri);
                        }
                    }
                    _ => {
                        // Jangan tampilkan QRIS lama untuk URL baru (risiko salah bayar).
                        eprintln!("Failed to fetch QRIS image from: {}", img_url);
                        config.qris_url = None;
                    }
                }
            }
        }

        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_qris_source;

    #[test]
    fn qris_path_beats_absolute_url() {
        assert_eq!(
            resolve_qris_source(
                "http://192.168.1.2:7015",
                Some("/static/uploads/qris/a.png"),
                Some("https://salah.example.com/a.png"),
            )
            .as_deref(),
            Some("http://192.168.1.2:7015/static/uploads/qris/a.png"),
        );
    }

    #[test]
    fn falls_back_to_qris_url_when_path_missing() {
        assert_eq!(
            resolve_qris_source("http://srv", None, Some("/static/uploads/qris/a.png")).as_deref(),
            Some("http://srv/static/uploads/qris/a.png"),
        );
        assert_eq!(
            resolve_qris_source("http://srv", None, Some("https://cdn.example.com/a.png")).as_deref(),
            Some("https://cdn.example.com/a.png"),
        );
        assert_eq!(resolve_qris_source("http://srv", None, None), None);
    }
}


#[cfg(test)]
mod secret_tests {
    use super::{is_emergency_response, to_sha256_hash};

    #[test]
    fn hash_64_hex_dipertahankan_lowercase() {
        let h = "A".repeat(64);
        assert_eq!(to_sha256_hash(&h), "a".repeat(64));
    }

    #[test]
    fn plaintext_di_hash() {
        assert_eq!(to_sha256_hash("TMBilling").len(), 64);
    }

    #[test]
    fn darurat_hanya_bila_keduanya() {
        assert!(is_emergency_response("system", Some("SYSTEM")));
        assert!(!is_emergency_response("system", None));
        assert!(!is_emergency_response("system", Some("Member")));
        assert!(!is_emergency_response("aktif", Some("SYSTEM")));
    }
}

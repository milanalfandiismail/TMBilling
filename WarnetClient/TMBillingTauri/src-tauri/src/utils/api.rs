use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use crate::state::{REMAINING_SECONDS, SESSION_ACTIVE};
use configparser::ini::Ini;
use winreg::enums::*;
use winreg::RegKey;

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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IdentifyResponse {
    pub valid: bool,
    pub pc_kode: Option<String>,
    pub grup: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberLoginResponse {
    pub success: bool,
    pub waktu_tersimpan: Option<u32>,
    pub nama: Option<String>,
    pub grup: Option<String>,
    pub pc_kode: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub token_sesi: Option<String>,
}

fn deobfuscate(hex_input: &str) -> String {
    let key = b"TMBillingSecretKey2026SecureObfuscation";
    let mut bytes = Vec::new();
    for i in (0..hex_input.len()).step_by(2) {
        if i + 2 <= hex_input.len() {
            if let Ok(b) = u8::from_str_radix(&hex_input[i..i+2], 16) {
                bytes.push(b ^ key[(i/2) % key.len()]);
            }
        }
    }
    String::from_utf8(bytes).unwrap_or_default()
}

fn is_obfuscated(input: &str) -> bool {
    let input = input.trim();
    if input.is_empty() || input.len() % 2 != 0 {
        return false;
    }
    if !input.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    let deobf = deobfuscate(input);
    if deobf.is_empty() {
        return false;
    }
    deobf.chars().all(|c| c.is_ascii() && !c.is_control())
}

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
            server_url: format!("{}/client", url),
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
        if let Ok(subkey) = hklm.open_subkey("Software\\TMBilling") {
            if let Ok(u) = subkey.get_value::<String, _>("Url") {
                if !u.trim().is_empty() {
                    reg_url = Some(u);
                }
            }
            if let Ok(k) = subkey.get_value::<String, _>("ApiKey") {
                let k = k.trim().to_string();
                if !k.is_empty() {
                    if is_obfuscated(&k) {
                        reg_api_key = Some(deobfuscate(&k));
                    } else {
                        reg_api_key = Some(k);
                    }
                }
            }
            if let Ok(user) = subkey.get_value::<String, _>("EmergencyUser") {
                let user = user.trim().to_string();
                if !user.is_empty() {
                    if is_obfuscated(&user) {
                        reg_em_user = Some(deobfuscate(&user));
                    } else {
                        reg_em_user = Some(user);
                    }
                }
            }
            if let Ok(t) = subkey.get_value::<String, _>("EmergencyToken") {
                let t = t.trim().to_string();
                if !t.is_empty() {
                    if is_obfuscated(&t) {
                        reg_em_token = Some(deobfuscate(&t));
                    } else {
                        reg_em_token = Some(t);
                    }
                }
            }
        }

        // 2. Fallback ke config.ini
        let mut ini_url = None;
        let mut ini_api_key = None;
        let mut ini_em_user = None;
        let mut ini_em_token = None;

        if let Ok(content) = std::fs::read_to_string("config.ini") {
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
                        if is_obfuscated(&val) {
                            ini_api_key = Some(deobfuscate(&val));
                        } else {
                            ini_api_key = Some(val);
                        }
                    } else if key == "emergencyuser" || key == "emergency_user" {
                        if is_obfuscated(&val) {
                            ini_em_user = Some(deobfuscate(&val));
                        } else {
                            ini_em_user = Some(val);
                        }
                    } else if key == "emergencytoken" || key == "emergency_token" {
                        if is_obfuscated(&val) {
                            ini_em_token = Some(deobfuscate(&val));
                        } else {
                            ini_em_token = Some(val);
                        }
                    }
                }
            }
        }

        let url = reg_url.or(ini_url).unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
        let api_key = reg_api_key.or(ini_api_key).unwrap_or_else(|| "TM2026".to_string());
        let em_user = reg_em_user.or(ini_em_user).unwrap_or_else(|| "TMBilling".to_string());
        let em_token = reg_em_token.or(ini_em_token).unwrap_or_else(|| "TM123qaz!@#".to_string());

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
        
        if !crate::state::IS_EMERGENCY_MODE.load(Ordering::SeqCst) {
            if status.status == "aktif" || status.status == "admin" {
                SESSION_ACTIVE.store(true, Ordering::SeqCst);
                if status.status == "admin" {
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
            SESSION_ACTIVE.store(true, Ordering::SeqCst);
            status.status = "admin".to_string();
            status.sisa_waktu = Some(999999);
            REMAINING_SECONDS.store(999999, Ordering::SeqCst);
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

    pub async fn member_login(&self, ip: &str, mac: &str, user: &str, pass: &str) -> Result<StatusResponse, String> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": user,
            "password": pass
        });

        let base_url = self.server_url.replace("/client", "");
        let url = format!("{}/api/auth/login", base_url);

        let res = self.client.post(&url)
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

        Ok(StatusResponse {
            status: "aktif".to_string(),
            sisa_waktu: raw.waktu_tersimpan.map(|m| m * 60),
            nama: raw.nama,
            grup: raw.grup,
            pc_kode: raw.pc_kode,
            shutdown_timer: Some(0),
            command: None,
            message: None,
        })
    }

    pub async fn admin_login(&self, ip: &str, mac: &str, user: &str, pass: &str) -> Result<StatusResponse, String> {
        // 1. CEK EMERGENCY CREDENTIALS OFFLINE DULU (biar bisa offline)
        if user == self.emergency_user && pass == self.emergency_token {
            return Ok(StatusResponse {
                status: "admin".to_string(),
                sisa_waktu: Some(0),
                nama: Some(user.to_string()),
                grup: Some("ADMINISTRATOR (EMERGENCY)".to_string()),
                pc_kode: None,
                shutdown_timer: Some(0),
                command: None,
                message: None,
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

        let _raw: AdminLoginResponse = serde_json::from_str(&body_text)
            .map_err(|_| format!("Gagal urai data admin."))?;

        Ok(StatusResponse {
            status: "admin".to_string(),
            sisa_waktu: Some(0),
            nama: Some(user.to_string()),
            grup: Some("ADMINISTRATOR".to_string()),
            pc_kode: None,
            shutdown_timer: Some(0),
            command: None,
            message: None,
        })
    }

    pub async fn emergency_login(&self, ip: &str, mac: &str) -> Result<StatusResponse, String> {
        // 1. COBA SERVER (bonus — biar set pc.is_admin_mode di DB)
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
        });

        let url = format!("{}/emergency-login", self.server_url);
        let _ = self.client.post(&url)
            .header("X-Client-Key", &self.api_key)
            .json(&body)
            .send()
            .await;

        // 2. TETAP SUKSES (walau server unreachable)
        Ok(StatusResponse {
            status: "admin".to_string(),
            sisa_waktu: Some(0),
            nama: Some(self.emergency_user.clone()),
            grup: Some("SUPER ADMIN (EMERGENCY)".to_string()),
            pc_kode: None,
            shutdown_timer: Some(0),
            command: None,
            message: None,
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
}

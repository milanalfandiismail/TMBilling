use std::fmt;
use std::time::Duration;

use serde::de::DeserializeOwned;

use super::models::*;

/// Batas waktu yang sama dengan klien Tauri (fail fast: kiosk harus tahu server mati).
const TIMEOUT: Duration = Duration::from_secs(4);
const CLIENT_PATH: &str = "/api/v1/public/client";

#[derive(Debug)]
pub enum ApiError {
    Network(String),
    Http { status: u16, message: String },
    Parse,
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::Network(e) => write!(f, "Koneksi Gagal: {e}"),
            ApiError::Http { status, message } if !message.is_empty() => write!(f, "{message}"),
            ApiError::Http { status, .. } => write!(f, "Gagal: {status}"),
            ApiError::Parse => write!(f, "Gagal urai data dari server."),
        }
    }
}

impl std::error::Error for ApiError {}

#[derive(Clone)]
pub struct ApiClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
}

/// Path relatif menang atas URL absolut: host mengikuti server yang dipakai klien ini.
pub fn qris_source(base_url: &str, qris_path: Option<&str>, qris_url: Option<&str>) -> Option<String> {
    let rel = qris_path.or(qris_url)?;
    if rel.starts_with('/') {
        Some(format!("{}{}", base_url, rel))
    } else {
        Some(rel.to_string())
    }
}

pub fn to_sha256_hash(val: &str) -> String {
    use sha2::{Digest, Sha256};
    let val = val.trim();
    if val.len() == 64 && val.chars().all(|c| c.is_ascii_hexdigit()) {
        return val.to_lowercase();
    }
    let mut hasher = Sha256::new();
    hasher.update(val.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn is_emergency_response(status: &str, nama: Option<&str>) -> bool {
    status == "system" && nama == Some("SYSTEM")
}

impl ApiClient {
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            http,
            base_url: base_url.into().trim_end_matches('/').to_string(),
            api_key: api_key.into(),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn send(&self, req: reqwest::RequestBuilder) -> Result<String, ApiError> {
        let res = req
            .header("X-Client-Key", &self.api_key)
            .send()
            .await
            .map_err(|e| ApiError::Network(e.to_string()))?;
        let status = res.status();
        let body = res.text().await.map_err(|e| ApiError::Network(e.to_string()))?;
        if !status.is_success() {
            let message = serde_json::from_str::<serde_json::Value>(&body)
                .ok()
                .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_string))
                .unwrap_or_default();
            return Err(ApiError::Http { status: status.as_u16(), message });
        }
        Ok(body)
    }

    async fn post<T: DeserializeOwned>(&self, path: &str, body: serde_json::Value) -> Result<T, ApiError> {
        let text = self.send(self.http.post(self.url(path)).json(&body)).await?;
        serde_json::from_str(&text).map_err(|_| ApiError::Parse)
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, ApiError> {
        let text = self.send(self.http.get(self.url(path))).await?;
        serde_json::from_str(&text).map_err(|_| ApiError::Parse)
    }

    fn client_path(&self, endpoint: &str) -> String {
        format!("{CLIENT_PATH}/{endpoint}")
    }

    pub async fn identify(&self, ip: &str, mac: &str) -> Result<IdentifyResponse, ApiError> {
        self.identify_with_role(ip, mac, "client").await
    }

    pub async fn identify_with_role(
        &self,
        ip: &str,
        mac: &str,
        role: &str,
    ) -> Result<IdentifyResponse, ApiError> {
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac, "role": role });
        self.post(&self.client_path("identify"), body).await
    }

    pub async fn status(&self, ip: &str, mac: &str, is_admin: bool) -> Result<StatusResponse, ApiError> {
        let role = if is_admin { "admin" } else { "client" };
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac, "role": role });
        self.post(&self.client_path("status"), body).await
    }

    pub async fn logout(&self, ip: &str, mac: &str) -> Result<(), ApiError> {
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac });
        let _: serde_json::Value = self.post(&self.client_path("selesai"), body).await?;
        Ok(())
    }

    pub async fn afk_lock(&self, ip: &str, mac: &str, pin: Option<&str>) -> Result<(), ApiError> {
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac, "pin": pin });
        let _: serde_json::Value = self.post(&self.client_path("afk-lock"), body).await?;
        Ok(())
    }

    pub async fn afk_unlock(&self, ip: &str, mac: &str, credential: &str) -> Result<(), ApiError> {
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac, "credential": credential });
        let _: serde_json::Value = self.post(&self.client_path("afk-unlock"), body).await?;
        Ok(())
    }

    pub async fn member_login(
        &self,
        ip: &str,
        mac: &str,
        username: &str,
        password: &str,
    ) -> Result<MemberLoginResponse, ApiError> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": username,
            "password": password
        });
        self.post("/api/v1/public/auth/login", body).await
    }

    pub async fn admin_login(
        &self,
        ip: &str,
        mac: &str,
        username: &str,
        password: &str,
    ) -> Result<AdminLoginResponse, ApiError> {
        let body = serde_json::json!({
            "ip_address": ip,
            "mac_address": mac,
            "username": username,
            "password": password,
            "role": "admin"
        });
        self.post(&self.client_path("admin-login"), body).await
    }

    /// Best effort: server hanya mencatat siapa yang emergency login.
    pub async fn emergency_login(&self, ip: &str, mac: &str, username: &str) -> Result<(), ApiError> {
        let body = serde_json::json!({ "ip_address": ip, "mac_address": mac, "username": username });
        let _: Result<serde_json::Value, _> = self.post(&self.client_path("emergency-login"), body).await;
        Ok(())
    }

    pub async fn warnet_config(&self) -> Result<WarnetConfig, ApiError> {
        let mut config: WarnetConfig = self.get(&self.client_path("warnet")).await?;
        config.qris_url = qris_source(
            &self.base_url,
            config.qris_path.as_deref(),
            config.qris_url.as_deref(),
        );
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn qris_path_wins_over_absolute_url() {
        assert_eq!(
            qris_source("http://192.168.1.2:7015", Some("/static/uploads/qris/a.png"), Some("https://x/y.png")),
            Some("http://192.168.1.2:7015/static/uploads/qris/a.png".to_string())
        );
    }

    #[test]
    fn qris_falls_back_to_url_when_path_missing() {
        assert_eq!(
            qris_source("http://srv", None, Some("/static/uploads/qris/a.png")),
            Some("http://srv/static/uploads/qris/a.png".to_string())
        );
        assert_eq!(
            qris_source("http://srv", None, Some("https://cdn.example.com/a.png")),
            Some("https://cdn.example.com/a.png".to_string())
        );
        assert_eq!(qris_source("http://srv", None, None), None);
    }

    #[test]
    fn hash_64_hex_is_kept_lowercase() {
        let h = "A".repeat(64);
        assert_eq!(to_sha256_hash(&h), h.to_lowercase());
    }

    #[test]
    fn plaintext_is_sha256_hashed() {
        assert_eq!(
            to_sha256_hash("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn emergency_only_when_status_and_name_match() {
        assert!(is_emergency_response("system", Some("SYSTEM")));
        assert!(!is_emergency_response("system", Some("Budi")));
        assert!(!is_emergency_response("aktif", Some("SYSTEM")));
    }

    #[test]
    fn base_url_trailing_slash_is_trimmed() {
        assert_eq!(ApiClient::new("http://127.0.0.1:7015/", "k").base_url(), "http://127.0.0.1:7015");
    }
}

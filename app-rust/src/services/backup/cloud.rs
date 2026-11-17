//! Unggah backup ke provider cloud aktif (Discord/WebDAV/Google Drive/NAS).
//! Urutan, nama, dan batas 24 MB mengikuti Python `app/services/backup/providers.py`.

use crate::services::settings::settings_service as settings;
use crate::state::AppState;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;

const BATAS_DISCORD: u64 = 24 * 1024 * 1024;

enum Target {
    Webhook(String),
    Webdav { url: String, user: String, pass: String },
    Gdrive { id: String, secret: String, refresh: String, folder: String },
    Nas(PathBuf),
}

impl Target {
    fn name(&self) -> &'static str {
        match self {
            Target::Webhook(_) => "Discord Webhook",
            Target::Webdav { .. } => "WebDAV",
            Target::Gdrive { .. } => "Google Drive",
            Target::Nas(_) => "NAS",
        }
    }
}

fn basic(user: &str, pass: &str) -> String {
    use base64::Engine;
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{user}:{pass}"))
    )
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(30))
        .build()
}

/// Provider aktif, urut seperti Python. Kosong bila tak ada yang diaktifkan.
async fn targets(st: &AppState) -> Vec<Target> {
    let s = settings::get_all(st).await;
    let on = |k: &str| s.get(k).map(|v| v == "true").unwrap_or(false);
    let v = |k: &str| s.get(k).cloned().unwrap_or_default();
    let mut out = Vec::new();
    let webhook = v("backup_discord_webhook_url");
    if on("backup_discord_enabled") && !webhook.is_empty() {
        out.push(Target::Webhook(webhook));
    }
    let dav = v("backup_webdav_url");
    if on("backup_webdav_enabled") && !dav.is_empty() {
        out.push(Target::Webdav {
            url: dav,
            user: v("backup_webdav_username"),
            pass: v("backup_webdav_password"),
        });
    }
    let (cid, csec, rtok) = (
        v("backup_gdrive_client_id"),
        v("backup_gdrive_client_secret"),
        v("backup_gdrive_refresh_token"),
    );
    if on("backup_gdrive_enabled") && !cid.is_empty() && !csec.is_empty() && !rtok.is_empty() {
        out.push(Target::Gdrive {
            id: cid,
            secret: csec,
            refresh: rtok,
            folder: v("backup_gdrive_folder_id"),
        });
    }
    let nas = v("backup_nas_path");
    if on("backup_nas_enabled") && !nas.is_empty() {
        out.push(Target::Nas(PathBuf::from(nas)));
    }
    out
}

fn multipart(boundary: &str, fields: &[(&str, &str)], file: Option<(&Path, &[u8])>) -> Vec<u8> {
    let mut body: Vec<u8> = Vec::new();
    for (k, v) in fields {
        body.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").as_bytes());
    }
    if let Some((path, bytes)) = file {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/zip\r\n\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(bytes);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    body
}

fn webhook_post(agent: &ureq::Agent, url: &str, isi: &str) -> bool {
    agent
        .post(url)
        .set("User-Agent", "TMBilling-Backup-Agent/1.0")
        .send_json(json!({ "content": isi }))
        .is_ok()
}

fn gdrive_token(agent: &ureq::Agent, id: &str, secret: &str, refresh: &str) -> Option<String> {
    let res = agent
        .post("https://oauth2.googleapis.com/token")
        .send_form(&[
            ("client_id", id),
            ("client_secret", secret),
            ("refresh_token", refresh),
            ("grant_type", "refresh_token"),
        ])
        .ok()?;
    let v: Value = res.into_json().ok()?;
    v.get("access_token")?.as_str().map(|s| s.to_string())
}

impl Target {
    fn upload(&self, path: &Path) -> bool {
        let Ok(bytes) = std::fs::read(path) else {
            return false;
        };
        let nama = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let agent = agent();
        match self {
            Target::Webhook(url) => {
                if bytes.len() as u64 > BATAS_DISCORD {
                    let pesan = format!(
                        "⚠️ **TMBilling Backup Alert**\nDatabase backup file (`{nama}`) is too large for Discord attachment ({:.2}MB). Please download it manually from the cashier dashboard.",
                        bytes.len() as f64 / (1024.0 * 1024.0)
                    );
                    let _ = webhook_post(&agent, url, &pesan);
                    return false;
                }
                let boundary = format!("----tm{}", hex::encode(rand::random::<[u8; 8]>()));
                let body = multipart(
                    &boundary,
                    &[("content", &format!("📅 **TMBilling Auto-Backup**\nFile: `{nama}`"))],
                    Some((path, &bytes)),
                );
                agent
                    .post(url)
                    .set("Content-Type", &format!("multipart/form-data; boundary={boundary}"))
                    .set("User-Agent", "TMBilling-Backup-Agent/1.0")
                    .send_bytes(&body)
                    .is_ok()
            }
            Target::Webdav { url, user, pass } => {
                let base = if url.ends_with('/') { url.clone() } else { format!("{url}/") };
                let mut req = agent.put(&format!("{base}{nama}")).set("Content-Type", "application/zip");
                if !user.is_empty() && !pass.is_empty() {
                    let auth = basic(user, pass);
                    req = req.set("Authorization", &auth);
                }
                req.send_bytes(&bytes).is_ok()
            }
            Target::Gdrive { id, secret, refresh, folder } => {
                let Some(token) = gdrive_token(&agent, id, secret, refresh) else {
                    return false;
                };
                let meta = if folder.is_empty() {
                    json!({ "name": nama })
                } else {
                    json!({ "name": nama, "parents": [folder] })
                };
                let boundary = format!("tm{}", hex::encode(rand::random::<[u8; 8]>()));
                let mut body = format!(
                    "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n--{boundary}\r\nContent-Type: application/zip\r\n\r\n"
                )
                .into_bytes();
                body.extend_from_slice(&bytes);
                body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
                agent
                    .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
                    .set("Authorization", &format!("Bearer {token}"))
                    .set("Content-Type", &format!("multipart/related; boundary={boundary}"))
                    .send_bytes(&body)
                    .is_ok()
            }
            Target::Nas(dir) => std::fs::copy(path, dir.join(&nama)).is_ok(),
        }
    }

    fn test(&self) -> bool {
        let agent = agent();
        match self {
            Target::Webhook(url) => webhook_post(
                &agent,
                url,
                "✅ **TMBilling Connection Test**\nDiscord Webhook is successfully connected!",
            ),
            Target::Webdav { url, user, pass } => {
                let base = if url.ends_with('/') { url.clone() } else { format!("{url}/") };
                let mut req = agent.request("PROPFIND", &base).set("Depth", "0");
                if !user.is_empty() && !pass.is_empty() {
                    req = req.set("Authorization", &basic(user, pass));
                }
                req.call().map(|r| r.status() < 400).unwrap_or(false)
            }
            Target::Gdrive { id, secret, refresh, .. } => {
                gdrive_token(&agent, id, secret, refresh).is_some()
            }
            Target::Nas(dir) => dir.is_dir(),
        }
    }
}

/// Unggah ke semua provider aktif; kembalikan (berhasil, gagal) berisi nama provider.
pub async fn upload(st: &AppState, path: &Path) -> (Vec<String>, Vec<String>) {
    let daftar = targets(st).await;
    if daftar.is_empty() {
        return (Vec::new(), Vec::new());
    }
    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let (mut ok, mut gagal) = (Vec::new(), Vec::new());
        for t in &daftar {
            if t.upload(&path) {
                ok.push(t.name().to_string());
            } else {
                gagal.push(t.name().to_string());
            }
        }
        (ok, gagal)
    })
    .await
    .unwrap_or_default()
}

/// Tes koneksi satu provider dari payload form (tanpa menyimpan setting).
pub async fn test(kind: &str, data: &Value) -> bool {
    let s = |k: &str| data.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let target = match kind {
        "webhook" => Target::Webhook(s("webhook_url")),
        "webdav" => Target::Webdav {
            url: s("webdav_url"),
            user: s("webdav_username"),
            pass: s("webdav_password"),
        },
        "gdrive" => Target::Gdrive {
            id: s("client_id"),
            secret: s("client_secret"),
            refresh: s("refresh_token"),
            folder: s("folder_id"),
        },
        "nas" => Target::Nas(PathBuf::from(s("nas_path"))),
        _ => return false,
    };
    tokio::task::spawn_blocking(move || target.test())
        .await
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multipart_memuat_field_dan_berkas() {
        let body = multipart(
            "b",
            &[("content", "halo")],
            Some((Path::new("backup.zip"), b"zip")),
        );
        let teks = String::from_utf8(body).unwrap();
        assert!(teks.starts_with("--b\r\nContent-Disposition: form-data; name=\"content\""));
        assert!(teks.contains("filename=\"backup.zip\""));
        assert!(teks.contains("\r\nzip\r\n"));
        assert!(teks.ends_with("--b--\r\n"));
    }
}

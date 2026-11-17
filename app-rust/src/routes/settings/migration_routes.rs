//! Status skema, cek rilis GitHub, unggah paket pembaruan.

use crate::middleware::auth::{admin_only, Kasir};
use crate::state::AppState;
use crate::utils::http;
use axum::{extract::State, response::Response};
use serde_json::{json, Value};
use std::sync::Arc;

const RELEASE_API: &str =
    "https://api.github.com/repos/milanalfandiismail/TMBilling/releases/latest";

/// Salinan `_parse_version` Python: 1.6.5 -> (1,6,5,999,0), 1.6.5-rc2 -> (1,6,5,1,2).
fn parse_version(raw: &str) -> (u32, u32, u32, u32, u32) {
    let clean = raw.trim().trim_start_matches(['v', 'V']);
    let (base, suffix) = match clean.split_once('-') {
        Some((a, b)) => (a, Some(b)),
        None => (clean, None),
    };
    let mut it = base.split('.').map(|p| p.parse::<u32>().unwrap_or(0));
    let major = it.next().unwrap_or(0);
    let minor = it.next().unwrap_or(0);
    let patch = it.next().unwrap_or(0);
    match suffix {
        None => (major, minor, patch, 999, 0),
        Some(s) => {
            let mut kind = 1;
            let mut num = 0;
            for part in s.split('.') {
                if let Ok(n) = part.parse::<u32>() {
                    num = n;
                } else if part.starts_with("rc") {
                    kind = 1;
                    num = part[2..].parse().unwrap_or(0);
                } else if part.starts_with("beta") {
                    kind = 0;
                    num = part[4..].parse().unwrap_or(0);
                }
            }
            (major, minor, patch, kind, num)
        }
    }
}

fn ps(cmd: &str) -> Result<String, String> {
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", cmd])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            format!("Perintah gagal (kode {})", out.status.code().unwrap_or(-1))
        } else {
            err
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn release() -> Result<Value, String> {
    let cmd = format!(
        "$ProgressPreference='SilentlyContinue'; (Invoke-RestMethod -UseBasicParsing -Headers @{{'User-Agent'='TMBilling-Update-Check'}} '{RELEASE_API}') | ConvertTo-Json -Depth 6"
    );
    let raw = ps(&cmd)?;
    serde_json::from_str(&raw).map_err(|e| format!("Gagal mengecek pembaruan GitHub: {e}"))
}

fn server_asset(data: &Value) -> Option<Value> {
    data.get("assets")?
        .as_array()?
        .iter()
        .find(|a| {
            let name = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
            name.starts_with("TMBilling_Server_") && name.ends_with(".zip")
        })
        .cloned()
}

fn tulis_paket(st: &AppState, payload: &[u8]) -> Result<(), String> {
    let path = st.cfg.root.join("instance").join("temp_update.zip");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, payload).map_err(|e| e.to_string())?;
    let check = std::fs::File::open(&path)
        .map_err(|e| e.to_string())
        .and_then(|f| {
            zip::ZipArchive::new(f).map_err(|_| "Berkas ZIP bukan format ZIP valid".to_string())
        });
    let mut zip = match check {
        Ok(z) => z,
        Err(e) => {
            let _ = std::fs::remove_file(&path);
            return Err(e);
        }
    };
    let valid = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .any(|n| {
            n.starts_with("app/") || n.starts_with("install_scripts/") || n.starts_with("app-rust/")
        });
    if !valid {
        let _ = std::fs::remove_file(&path);
        return Err("Berkas ZIP bukan paket rilis TMBilling yang valid".into());
    }
    Ok(())
}

pub async fn status(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let revisi: Option<(String,)> = sqlx::query_as("SELECT version_num FROM alembic_version")
        .fetch_optional(&st.pool)
        .await
        .ok()
        .flatten();
    let sesi_aktif = crate::repositories::sesi::count_aktif(&st.pool)
        .await
        .unwrap_or(0);
    let lengkap = revisi.map(|r| r.0).unwrap_or_default();
    let current = lengkap.chars().take(8).collect::<String>();
    let head = crate::db::migrate::HEAD_REVISION
        .chars()
        .take(8)
        .collect::<String>();
    let sesuai = !current.is_empty() && current == head;
    http::json(
        200,
        json!({
            "success": true,
            "app_version": st.cfg.version,
            "version_tag": st.cfg.version_tag(),
            "schema_revision": lengkap,
            "current": current,
            "head": head,
            "needs_upgrade": !sesuai,
            "history": [{
                "revision": head,
                "down_revision": Value::Null,
                "description": "Skema awal TMBilling 2.0.0",
                "is_current": sesuai,
                "is_head": true,
            }],
            "active_sessions": sesi_aktif,
            "db_path": st.cfg.db_path.to_string_lossy(),
        }),
    )
}

pub async fn check_github(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = match release() {
        Ok(v) => v,
        Err(e) => return http::json(500, json!({"success": false, "error": e})),
    };
    let tag = data.get("tag_name").and_then(|v| v.as_str()).unwrap_or("");
    let current = st.cfg.version_tag();
    let is_newer = parse_version(tag) > parse_version(&current);
    let asset = server_asset(&data);
    let sesi_aktif = crate::repositories::sesi::count_aktif(&st.pool)
        .await
        .unwrap_or(0);
    http::json(
        200,
        json!({
            "success": true,
            "current_version": current,
            "latest_version": tag,
            "is_newer": is_newer,
            "release_name": data.get("name").and_then(|v| v.as_str()).unwrap_or(tag),
            "release_notes": data.get("body").and_then(|v| v.as_str()).unwrap_or(""),
            "published_at": data.get("published_at").and_then(|v| v.as_str()).unwrap_or(""),
            "asset_name": asset.as_ref().and_then(|a| a.get("name").cloned()),
            "asset_size": asset.as_ref().and_then(|a| a.get("size").cloned()).unwrap_or(json!(0)),
            "asset_url": asset.as_ref().and_then(|a| a.get("browser_download_url").cloned()),
            "active_sessions_count": sesi_aktif,
        }),
    )
}

/// Jalankan penerap pembaruan dari salinan biner di %TEMP%, lalu hentikan proses ini.
fn mulai_pembaruan(st: &Arc<AppState>) {
    let (zip, root) = crate::update::coords(st);
    if let Err(e) = crate::update::spawn_apply(&zip, &root) {
        tracing::warn!("gagal menjalankan penerap pembaruan: {e}");
        return;
    }
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });
}

pub async fn update_github(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = match release() {
        Ok(v) => v,
        Err(e) => return http::json(500, json!({"error": e})),
    };
    let asset = match server_asset(&data) {
        Some(a) => a,
        None => {
            return http::json(
                400,
                json!({"error": "Asset paket pembaruan server tidak ditemukan di rilis GitHub"}),
            )
        }
    };
    let url = asset
        .get("browser_download_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if !url.starts_with("https://github.com/milanalfandiismail/")
        && !url.starts_with("https://objects.githubusercontent.com/")
    {
        return http::json(
            400,
            json!({"error": "URL unduhan tidak diizinkan. Hanya domain rilis resmi GitHub yang diperbolehkan."}),
        );
    }
    if !crate::utils::idempotency::claim("update_zip") {
        return http::json(
            409,
            json!({"error": "Pembaruan lain sedang berjalan. Tunggu hingga selesai lalu ulangi."}),
        );
    }
    let path = st.cfg.root.join("instance").join("temp_update.zip");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let cmd = format!(
        "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing -Uri '{url}' -OutFile '{}'",
        path.to_string_lossy()
    );
    let hasil = ps(&cmd)
        .and_then(|_| std::fs::read(&path).map_err(|e| e.to_string()))
        .and_then(|bytes| tulis_paket(&st, &bytes));
    crate::utils::idempotency::release("update_zip");
    match hasil {
        Ok(_) => {
            mulai_pembaruan(&st);
            crate::utils::logger::rec(
                "admin",
                "APPLICATION_UPDATE",
                "Pembaruan otomatis dari GitHub dipicu melalui dashboard",
            );
            http::json(
                202,
                json!({"success": true, "message": "Pembaruan berhasil diunduh. Server sedang memperbarui dan akan dimulai ulang..."}),
            )
        }
        Err(e) => http::json(400, json!({"error": e})),
    }
}

pub async fn upload(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    mut form: axum::extract::Multipart,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let mut bytes: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = form.next_field().await {
        if field.file_name().is_some() || field.name() == Some("file") {
            if let Ok(b) = field.bytes().await {
                if b.is_empty() {
                    return http::json(400, json!({"error": "File update wajib dipilih"}));
                }
                bytes = Some(b.to_vec());
                break;
            }
        }
    }
    let payload = match bytes {
        Some(b) => b,
        None => return http::json(400, json!({"error": "File update wajib dipilih"})),
    };
    if !crate::utils::idempotency::claim("update_zip") {
        return http::json(
            409,
            json!({"error": "Pembaruan lain sedang berjalan. Tunggu hingga selesai lalu ulangi."}),
        );
    }
    let hasil = tulis_paket(&st, &payload);
    crate::utils::idempotency::release("update_zip");
    match hasil {
        Ok(_) => {
            mulai_pembaruan(&st);
            http::json(
                202,
                json!({"success": true, "message": "Berkas berhasil diunggah. Server sedang memperbarui dan akan dimulai ulang..."}),
            )
        }
        Err(e) => http::json(400, json!({"error": e})),
    }
}

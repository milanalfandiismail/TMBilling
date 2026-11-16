//! Screenshot privat PC: simpan PNG maks 1280 px di instance/uploads/screenshots.

use std::path::PathBuf;
use std::sync::Arc;

use serde_json::{json, Value};

use crate::state::AppState;
use crate::utils::time;

pub fn folder(st: &AppState) -> PathBuf {
    st.cfg
        .root
        .join("instance")
        .join("uploads")
        .join("screenshots")
}

pub fn filename(kode: &str) -> String {
    let flat: String = kode
        .chars()
        .filter(|c| *c != '/' && *c != '\\')
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    format!("{}.png", if flat.is_empty() { "pc".into() } else { flat })
}

/// Simpan byte gambar menjadi PNG ternormalisasi. Gagal = data bukan gambar.
pub fn simpan(st: &AppState, kode: &str, bytes: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(bytes).map_err(|_| "Data gambar tidak valid".to_string())?;
    if img.width() as u64 * img.height() as u64 > 40_000_000 {
        return Err("Data gambar tidak valid".into());
    }
    let kecil = img.thumbnail(1280, 1280).to_rgb8();
    let dir = folder(st);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    kecil
        .save_with_format(dir.join(filename(kode)), image::ImageFormat::Png)
        .map_err(|e| e.to_string())
}

pub struct StatusInfo {
    pub mtime: u64,
    pub full: String,
    pub display: String,
}

/// Status screenshot: url, waktu lengkap, dan label jam ringkas.
pub async fn status(st: &Arc<AppState>, pc_id: i64, kode: &str) -> Option<StatusInfo> {
    let path = folder(st).join(filename(kode));
    let meta = std::fs::metadata(&path).ok()?;
    let modified = meta.modified().ok()?;
    let mtime = modified
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    let dt = chrono::DateTime::from_timestamp(mtime as i64, 0)?.naive_utc();
    let _ = pc_id;
    let tz = time::tz(&st.cfg.timezone);
    let local = dt.and_local_timezone(tz).single().unwrap_or_else(|| {
        dt.and_local_timezone(chrono::Utc)
            .unwrap()
            .with_timezone(&tz)
    });
    let today = time::today_local(&st.cfg.timezone);
    let display = if local.date_naive() == today {
        format!(
            "{} {}",
            local.format("%H:%M:%S"),
            time::tz_label(&st.cfg.timezone)
        )
    } else {
        format!(
            "{} {}",
            local.format("%d/%m %H:%M"),
            time::tz_label(&st.cfg.timezone)
        )
    };
    Some(StatusInfo {
        mtime,
        full: time::format_display(dt, &st.cfg.timezone),
        display,
    })
}

pub fn status_json(pc_id: i64, info: Option<&StatusInfo>) -> Value {
    match info {
        Some(s) => json!({
            "success": true,
            "screenshot_url": format!("/api/v1/kasir/monitor/screenshot/image/{pc_id}"),
            "screenshot_time": s.full,
            "screenshot_time_display": s.display,
            "mtime": s.mtime,
        }),
        None => json!({
            "success": true,
            "screenshot_url": Value::Null,
            "screenshot_time": Value::Null,
            "screenshot_time_display": Value::Null,
            "mtime": 0,
        }),
    }
}

//! Monitor hardware: telemetri client, daftar kasir, baseline, proses.

use axum::body::Bytes;
use axum::extract::{ConnectInfo, Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::models::user::hash_password;
use crate::repositories::pc as pc_repo;
use crate::repositories::sesi as sesi_repo;
use crate::services::hardware::hardware_service;
use crate::services::monitor::screenshot;
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::{http, logger};

type St = State<Arc<AppState>>;

fn gagal(status: u16, msg: impl Into<String>) -> Response {
    http::json(status, json!({"success": false, "error": msg.into()}))
}

/// Telemetri dari agent: identitas PC hanya dari IP koneksi peer.
pub async fn receive(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let kirim = headers
        .get("x-client-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let harapan = settings_service::client_api_key(&state).await;
    if kirim.is_empty() || harapan.is_empty() || kirim != harapan {
        logger::rec(
            "system",
            "API_KEY_GAGAL",
            &format!("Invalid/Missing API Key from {}", peer.ip()),
        );
        state.mismatch.record(&peer.ip().to_string(), None);
        return gagal(
            401,
            "Akses ditolak. API Key tidak valid atau belum dikonfigurasi",
        );
    }
    let ip = if peer.ip().is_loopback() {
        headers
            .get("cf-connecting-ip")
            .or_else(|| headers.get("x-forwarded-for"))
            .and_then(|v| v.to_str().ok())
            .map(|v| v.split(',').next().unwrap_or("").trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| peer.ip().to_string())
    } else {
        peer.ip().to_string()
    };
    let data = http::parse_json(&body);
    match hardware_service::process_metric(&state, &ip, &data).await {
        Ok(hasil) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Metrics for {} saved", hasil.kode),
                "polling_interval": hasil.polling,
            }),
        ),
        Err((status, e)) => http::json(status, json!({"error": e})),
    }
}

pub async fn all(State(state): St, kasir: Kasir) -> Response {
    let _ = kasir;
    match hardware_service::list(&state).await {
        Ok(data) => http::json(200, json!({"success": true, "data": data})),
        Err(e) => http::json(500, json!({"error": e})),
    }
}

pub async fn one(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    let _ = kasir;
    match hardware_service::one(&state, pc_id).await {
        Ok(data) => http::json(200, json!({"success": true, "data": data})),
        Err(e) => http::json(404, json!({"error": e})),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(hardware_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    match hardware_service::delete(&state, hardware_id, &kasir.user.username).await {
        Ok(kode) => http::json(
            200,
            json!({"success": true, "message": format!("Data monitor PC {kode} berhasil dibersihkan")}),
        ),
        Err(e) => gagal(404, e),
    }
}

pub async fn proses(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    match hardware_service::processes(&state, pc_id).await {
        Ok((rows, stamp, label)) => http::json(
            200,
            json!({
                "success": true,
                "data": rows,
                "count": rows.len(),
                "last_updated": label,
                "last_updated_ts": stamp,
            }),
        ),
        Err(e) => gagal(500, e),
    }
}

pub async fn trigger_proses(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    state.commands.fast.push(pc.id, "refresh_processes");
    logger::rec(
        &kasir.user.username,
        "REMOTE_REFRESH_PROCESSES_TRIGGER",
        &format!("Permintaan Refresh Proses dikirim ke PC {}", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Permintaan pembaruan proses berhasil dikirim ke {}", pc.kode)}),
    )
}

pub async fn kill_proses(
    State(state): St,
    kasir: Kasir,
    Path(pc_id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let data = http::parse_json(&body);
    let nama = data
        .get("process_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if nama.is_empty() {
        return gagal(400, "Nama proses harus diisi");
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    state.commands.fast.push(pc.id, &format!("kill:{nama}"));
    logger::rec(
        &kasir.user.username,
        "REMOTE_KILL",
        &format!("Perintah Kill Process '{nama}' dikirim ke PC {}", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Perintah mengakhiri proses {nama} berhasil dikirim ke {}", pc.kode)}),
    )
}

pub async fn baseline(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    match hardware_service::update_baseline(&state, pc_id, &kasir.user.username).await {
        Ok(kode) => http::json(
            200,
            json!({"success": true, "message": format!("Baseline hardware PC {kode} berhasil diperbarui")}),
        ),
        Err(e) => gagal(400, e),
    }
}

// ---------- Screenshot ----------

pub async fn screenshot_trigger(
    State(state): St,
    kasir: Kasir,
    Path(pc_id): Path<i64>,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    // klien Tauri membaca perintah screenshot dari command pada /client/status (antrean reguler)
    state.commands.regular.push(pc.id, "screenshot");
    logger::rec(
        &kasir.user.username,
        "REMOTE_SCREENSHOT_TRIGGER",
        &format!("Permintaan Screenshot dikirim ke PC {}", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Perintah screenshot berhasil dikirim ke {}", pc.kode)}),
    )
}

pub async fn screenshot_upload(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let kirim = headers
        .get("x-client-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let harapan = settings_service::client_api_key(&state).await;
    if kirim.is_empty() || harapan.is_empty() || kirim != harapan {
        state.mismatch.record(&peer.ip().to_string(), None);
        return gagal(
            401,
            "Akses ditolak. API Key tidak valid atau belum dikonfigurasi",
        );
    }
    let ip = if peer.ip().is_loopback() {
        headers
            .get("cf-connecting-ip")
            .and_then(|v| v.to_str().ok())
            .map(|v| v.to_string())
            .unwrap_or_else(|| peer.ip().to_string())
    } else {
        peer.ip().to_string()
    };
    let pc = match pc_repo::find_aktif_by_ip(&state.pool, &ip).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "IP PC tidak dikenal"),
    };
    if body.is_empty() {
        return gagal(400, "Data gambar kosong");
    }
    if let Err(e) = screenshot::simpan(&state, &pc.kode, &body) {
        logger::rec(
            "system",
            "SCREENSHOT_UPLOAD_ERROR",
            &format!("Gagal simpan screenshot: {e}"),
        );
        return gagal(
            if e == "Data gambar tidak valid" {
                400
            } else {
                500
            },
            if e == "Data gambar tidak valid" {
                "Data gambar tidak valid"
            } else {
                "Gagal memproses screenshot"
            },
        );
    }
    logger::rec(
        "system",
        "SCREENSHOT_UPLOAD",
        &format!("Screenshot PC {} berhasil disimpan", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": "Screenshot berhasil diunggah"}),
    )
}

pub async fn screenshot_status(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    let info = screenshot::status(&state, pc.id, &pc.kode).await;
    http::json(200, screenshot::status_json(pc.id, info.as_ref()))
}

pub async fn screenshot_image(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    let path = screenshot::folder(&state).join(screenshot::filename(&pc.kode));
    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let mut res = (StatusCode::OK, axum::body::Body::from(bytes)).into_response();
            res.headers_mut().insert(
                axum::http::header::CONTENT_TYPE,
                axum::http::HeaderValue::from_static("image/png"),
            );
            res
        }
        Err(_) => gagal(404, "Screenshot tidak tersedia"),
    }
}

pub async fn screenshot_all(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let pcs = match pc_repo::get_all(&state.pool, true, None, None).await {
        Ok(pcs) => pcs,
        Err(e) => return gagal(500, e.to_string()),
    };
    let mut out: Vec<Value> = Vec::new();
    for pc in pcs {
        let info = screenshot::status(&state, pc.id, &pc.kode).await;
        out.push(match info {
            Some(s) => json!({
                "pc_id": pc.id,
                "pc_kode": pc.kode,
                "pc_grup_id": pc.grup_id.unwrap_or(0),
                "pc_grup_nama": pc.grup_nama.clone().unwrap_or_else(|| "Unknown".into()),
                "screenshot_url": format!("/api/v1/kasir/monitor/screenshot/image/{}", pc.id),
                "screenshot_time": s.full,
                "screenshot_time_display": s.display,
                "mtime": s.mtime,
            }),
            None => json!({
                "pc_id": pc.id,
                "pc_kode": pc.kode,
                "pc_grup_id": pc.grup_id.unwrap_or(0),
                "pc_grup_nama": pc.grup_nama.clone().unwrap_or_else(|| "Unknown".into()),
                "screenshot_url": Value::Null,
                "screenshot_time": Value::Null,
                "screenshot_time_display": Value::Null,
                "mtime": 0,
            }),
        });
    }
    http::json(200, json!({"success": true, "data": out}))
}

// ---------- Remote action ----------

async fn sesi_system(state: &Arc<AppState>, pc_id: i64, is_admin_mode: bool) -> bool {
    if !is_admin_mode {
        return false;
    }
    match sesi_repo::get_aktif_by_pc(&state.pool, pc_id).await {
        Ok(Some(s)) => {
            s.nama_guest
                .clone()
                .unwrap_or_default()
                .trim()
                .to_uppercase()
                == "SYSTEM"
        }
        _ => false,
    }
}

pub async fn remote_afk_lock(
    State(state): St,
    kasir: Kasir,
    Path(pc_id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let data = http::parse_json(&body);
    let pin = data
        .get("pin")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if pin.is_empty() {
        return gagal(400, "PIN / Password kunci layar tidak boleh kosong");
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    let sesi = match sesi_repo::get_aktif_by_pc(&state.pool, pc.id).await {
        Ok(Some(s)) => s,
        _ => return gagal(400, "Tidak ada sesi aktif di PC ini"),
    };
    let now = crate::utils::time::db_str(crate::utils::time::now_db());
    let hash = hash_password(&pin);
    let _ = sqlx::query("UPDATE sesi SET is_afk = 1, afk_pin = ?, afk_sejak = ? WHERE id = ?")
        .bind(&hash)
        .bind(&now)
        .bind(sesi.id)
        .execute(&state.pool)
        .await;
    state.commands.fast.push(pc.id, "afk_lock");
    logger::rec(
        &kasir.user.username,
        "REMOTE_AFK_LOCK",
        &format!(
            "PC {} dikunci AFK secara remote oleh kasir dengan PIN",
            pc.kode
        ),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Perintah kunci AFK berhasil dikirim ke {}", pc.kode)}),
    )
}

pub async fn remote_afk_unlock(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    let sesi = match sesi_repo::get_aktif_by_pc(&state.pool, pc.id).await {
        Ok(Some(s)) => s,
        _ => return gagal(400, "Tidak ada sesi aktif di PC ini"),
    };
    let _ =
        sqlx::query("UPDATE sesi SET is_afk = 0, afk_pin = NULL, afk_sejak = NULL WHERE id = ?")
            .bind(sesi.id)
            .execute(&state.pool)
            .await;
    state.commands.fast.push(pc.id, "afk_unlock");
    logger::rec(
        &kasir.user.username,
        "REMOTE_AFK_UNLOCK",
        &format!(
            "PC {} dibuka kunci AFK secara remote (Master Unlock) oleh kasir",
            pc.kode
        ),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Kunci AFK PC {} berhasil dibuka oleh kasir", pc.kode)}),
    )
}

pub async fn remote_action(
    State(state): St,
    kasir: Kasir,
    Path((pc_id, action)): Path<(i64, String)>,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    if action != "shutdown" && action != "restart" {
        return gagal(400, "Aksi tidak valid");
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => return gagal(404, "PC tidak ditemukan"),
    };
    if sesi_system(&state, pc.id, pc.is_admin_mode.unwrap_or(false)).await {
        return gagal(
            403,
            "Aksi operasional (Restart/Shutdown) tidak diizinkan pada PC dalam mode SYSTEM",
        );
    }
    // Dieksekusi aplikasi Tauri dari antrean reguler; TMMonitor tidak mengenal restart/shutdown.
    state.commands.regular.push(pc.id, &action);
    let label = if action == "shutdown" {
        "Shutdown"
    } else {
        "Restart"
    };
    logger::rec(
        &kasir.user.username,
        "REMOTE_ACTION",
        &format!("Perintah {label} dikirim ke PC {}", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Perintah {label} berhasil dikirim ke {}", pc.kode)}),
    )
}

pub async fn remote_batch(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if let Err(res) = auth::shift_required(&state, &kasir).await {
        return res;
    }
    let data = http::parse_json(&body);
    let action = data.get("action").and_then(|v| v.as_str()).unwrap_or("");
    if action != "shutdown" && action != "restart" {
        return gagal(400, "Aksi tidak valid (hanya shutdown/restart)");
    }
    let ids: Vec<i64> = data
        .get("pc_ids")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_i64()).collect())
        .unwrap_or_default();
    if ids.is_empty() {
        return gagal(400, "Daftar PC (pc_ids) harus berupa array non-kosong");
    }
    let label = if action == "shutdown" {
        "Shutdown"
    } else {
        "Restart"
    };
    let mut sukses: Vec<String> = Vec::new();
    let mut errors: Vec<Value> = Vec::new();
    for id in ids {
        let pc = match pc_repo::get_by_id(&state.pool, id).await {
            Ok(Some(pc)) => pc,
            _ => {
                errors.push(json!({"pc_id": id, "error": "PC tidak ditemukan"}));
                continue;
            }
        };
        if sesi_system(&state, pc.id, pc.is_admin_mode.unwrap_or(false)).await {
            errors.push(json!({
                "pc_id": id,
                "pc_kode": pc.kode,
                "error": "Aksi operasional tidak diizinkan pada PC mode SYSTEM",
            }));
            continue;
        }
        // Batch memakai antrean yang sama dengan aksi tunggal (dibaca aplikasi Tauri).
        state.commands.regular.push(pc.id, action);
        logger::rec(
            &kasir.user.username,
            "REMOTE_ACTION_BATCH",
            &format!("Perintah {label} batch dikirim ke PC {}", pc.kode),
        );
        sukses.push(pc.kode.clone());
    }
    http::json(
        200,
        json!({
            "success": !sukses.is_empty(),
            "success_pcs": sukses,
            "errors": errors,
            "total_success": sukses.len(),
            "total_failed": errors.len(),
        }),
    )
}

/// Dipakai test: memastikan hanya method tertentu yang terdaftar.
pub const _METHODS: [&str; 2] = ["GET", "POST"];

#[allow(dead_code)]
fn _status(_: StatusCode, _: Value) {}

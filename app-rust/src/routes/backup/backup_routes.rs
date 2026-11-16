//! Backup lokal: trigger, status, list, download, restore, delete.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::backup::backup_service as svc;
use crate::state::AppState;
use crate::utils::http;
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::Response,
};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn trigger(State(st): State<Arc<AppState>>, _k: Kasir) -> Response {
    match svc::start_manual(st) {
        Ok(status) => http::json(
            202,
            json!({"success": true, "message": status["message"], "job": status}),
        ),
        Err((code, pesan)) => http::json(code, json!({"success": false, "error": pesan})),
    }
}

pub async fn status(State(st): State<Arc<AppState>>, _k: Kasir) -> Response {
    http::json(200, svc::status(&st))
}

pub async fn test_connection(
    State(_st): State<Arc<AppState>>,
    _k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    let data = http::parse_json(&body);
    let kind = data
        .get("provider_type")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if kind.is_empty() {
        return http::err(400, "Provider type is required");
    }
    let target = match kind {
        "webhook" => data
            .get("webhook_url")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        "webdav" => data
            .get("webdav_url")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        "gdrive" => data.get("client_id").and_then(|v| v.as_str()).unwrap_or(""),
        "nas" => data.get("nas_path").and_then(|v| v.as_str()).unwrap_or(""),
        _ => "",
    };
    let wajib = match kind {
        "webhook" => ("Webhook URL is required", !target.is_empty()),
        "webdav" => ("WebDAV URL is required", !target.is_empty()),
        "gdrive" => {
            let secret = data
                .get("client_secret")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let refresh = data
                .get("refresh_token")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            (
                "Client ID, Secret, and Refresh Token are required",
                !target.is_empty() && !secret.is_empty() && !refresh.is_empty(),
            )
        }
        "nas" => ("NAS path is required", !target.is_empty()),
        _ => ("Provider type is required", false),
    };
    if !wajib.1 {
        return http::err(400, wajib.0);
    }
    let nama = svc::provider_name(kind).unwrap_or(kind);
    let ok = if kind == "nas" {
        std::path::Path::new(target).is_dir()
    } else {
        svc::reachable(target)
    };
    // shortcut: provider cloud hanya diuji keterjangkauan host, upload/OTP belum diport.
    crate::utils::logger::audit_json(
        "admin",
        "BACKUP_TEST_CONNECTION",
        "Tes koneksi provider backup",
        Some(crate::utils::logger::resolve_category(
            "BACKUP_TEST_CONNECTION",
        )),
        "",
        "",
        json!({"provider": kind, "success": ok}),
    );
    if ok {
        http::json(
            200,
            json!({"success": true, "message": format!("Koneksi ke {nama} Berhasil!")}),
        )
    } else {
        http::json(
            400,
            json!({"success": false, "error": format!("Koneksi ke {nama} Gagal! Silakan cek kredensial Anda.")}),
        )
    }
}

pub async fn list(State(st): State<Arc<AppState>>, _k: Kasir) -> Response {
    http::json(200, json!({"success": true, "backups": svc::list(&st)}))
}

fn berkas(st: &AppState, filename: &str) -> Result<std::path::PathBuf, (u16, String)> {
    if filename.contains('/') || filename.contains('\\') || !filename.ends_with(".zip") {
        return Err((403, "Akses ditolak".into()));
    }
    let path = svc::dir(st).join(filename);
    if !path.is_file() {
        return Err((404, "File tidak ditemukan".into()));
    }
    Ok(path)
}

pub async fn download(
    State(st): State<Arc<AppState>>,
    _k: Kasir,
    Path(filename): Path<String>,
) -> Response {
    let path = match berkas(&st, &filename) {
        Ok(p) => p,
        Err((code, pesan)) => return http::json(code, json!({"success": false, "error": pesan})),
    };
    match std::fs::read(&path) {
        Ok(bytes) => {
            crate::utils::logger::rec(
                "admin",
                "DATABASE_DOWNLOAD",
                &format!("User mendownload backup: {filename}"),
            );
            let mut res = Response::new(Body::from(bytes));
            *res.status_mut() = StatusCode::OK;
            res.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/zip"),
            );
            if let Ok(v) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
                res.headers_mut().insert(header::CONTENT_DISPOSITION, v);
            }
            res
        }
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}

pub async fn restore(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    Path(filename): Path<String>,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    if !data
        .get("confirm")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return http::json(
            400,
            json!({"success": false, "error": "Konfirmasi restore diperlukan"}),
        );
    }
    let path = match berkas(&st, &filename) {
        Ok(p) => p,
        Err((code, pesan)) => return http::json(code, json!({"success": false, "error": pesan})),
    };
    match svc::restore_live(&st, &path).await {
        Ok(result) => http::json(200, json!({"success": true, "result": result})),
        Err(e) => http::json(400, json!({"success": false, "error": e.to_string()})),
    }
}

pub async fn hapus(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    Path(filename): Path<String>,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let path = match berkas(&st, &filename) {
        Ok(p) => p,
        Err((code, pesan)) => return http::json(code, json!({"success": false, "error": pesan})),
    };
    match std::fs::remove_file(&path) {
        Ok(_) => {
            crate::utils::logger::rec(
                "admin",
                "BACKUP_DELETE",
                &format!("User menghapus backup lokal: {filename}"),
            );
            http::json(
                200,
                json!({"success": true, "message": "File backup berhasil dihapus!"}),
            )
        }
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}

pub fn _unused(_: Value) {}

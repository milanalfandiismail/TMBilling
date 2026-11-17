//! CMS panduan sistem.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::tutorial::tutorial_service as svc;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Request, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn gagal(e: (u16, String)) -> Response {
    http::json(e.0, json!({"success": false, "error": e.1}))
}

pub async fn list(State(state): St, _kasir: Kasir) -> Response {
    match svc::list(&state).await {
        Ok(mut data) => {
            data["success"] = json!(true);
            http::json(200, data)
        }
        Err(e) => gagal(e),
    }
}

pub async fn detail(State(state): St, _kasir: Kasir, Path(id): Path<i64>) -> Response {
    match svc::detail(&state, id).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let kosong = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .is_empty()
        || data
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .is_empty();
    if kosong {
        return http::err(400, "Judul dan isi panduan wajib diisi");
    }
    match svc::create(&state, &data).await {
        Ok(data) => http::json(201, data),
        Err(e) => gagal(e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match svc::update(&state, id, &data).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::delete(&state, id).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

pub async fn categories(State(state): St, _kasir: Kasir) -> Response {
    match svc::categories(&state).await {
        Ok(mut data) => {
            data["success"] = json!(true);
            http::json(200, data)
        }
        Err(e) => gagal(e),
    }
}

pub async fn delete_category(State(state): St, kasir: Kasir, Path(nama): Path<String>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::delete_category(&state, &nama).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

pub async fn upload_image(State(state): St, kasir: Kasir, req: Request) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let (_, berkas) = match http::payload(req, &state).await {
        Ok(v) => v,
        Err(e) => return http::err(400, e),
    };
    let Some(berkas) = berkas else {
        return http::err(400, "Tidak ada file gambar yang diunggah");
    };
    match svc::upload_image(&state, &berkas).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

pub async fn cleanup_temp(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let konten = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let dihapus = svc::cleanup_temp(&state, konten);
    http::json(200, json!({"success": true, "removed": dihapus}))
}

pub async fn export_json(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::export_json(&state).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(e),
    }
}

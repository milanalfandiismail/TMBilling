//! CRUD paket: `/api/v1/kasir/paket`.

use crate::middleware::auth::{admin_only, Kasir};
use crate::repositories::paket as paket_repo;
use crate::services::paket::paket_service;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn pesan(e: String) -> Response {
    http::err(400, e)
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let include_arsip = q.get("include_arsip").map(|v| v == "1").unwrap_or(false);
    let aktif_only = match q.get("aktif") {
        Some(v) => v.to_lowercase() == "true",
        None => !include_arsip,
    };
    let grup = q
        .get("grup_id")
        .or_else(|| q.get("grup"))
        .map(String::as_str);
    let search = q.get("q").map(String::as_str).filter(|s| !s.is_empty());
    match paket_service::get_all(&state, aktif_only, grup, search).await {
        Ok(rows) => http::json(
            200,
            json!({"paket": rows.iter().map(|p| p.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e.to_string()),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match paket_service::create(&state, &data, &kasir.user.username).await {
        Ok(paket) => http::json(
            201,
            json!({
                "success": true,
                "message": format!("Paket '{}' berhasil dibuat", paket.nama),
                "id": paket.id,
                "paket": paket.to_json()
            }),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match paket_service::update(&state, id, &data, &kasir.user.username).await {
        Ok(paket) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Paket '{}' berhasil diupdate", paket.nama),
                "paket": paket.to_json()
            }),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn archive(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match paket_service::archive(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Paket berhasil diarsipkan"}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match paket_service::restore(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Paket berhasil dipulihkan"}),
        ),
        Err(e) => pesan(e),
    }
}

/// Hapus permanen wajib konfirmasi nama paket (case-insensitive).
pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let paket = match paket_repo::get_by_id(&state.pool, id).await {
        Ok(Some(p)) => p,
        Ok(None) => return http::err(404, "Paket tidak ditemukan"),
        Err(e) => return http::err(500, e.to_string()),
    };
    let data = http::parse_json(&body);
    let confirm = data.get("confirm").map(|v| match v {
        Value::String(s) => s.trim().to_lowercase(),
        other => other.to_string().trim().to_lowercase(),
    });
    if confirm.as_deref() != Some(paket.nama.to_lowercase().as_str()) {
        return http::err(400, "Ketik nama paket untuk konfirmasi hapus permanen");
    }
    match paket_service::delete(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Paket berhasil dihapus"}),
        ),
        Err(e) => pesan(e),
    }
}

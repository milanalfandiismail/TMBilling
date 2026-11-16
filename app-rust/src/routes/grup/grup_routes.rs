//! CRUD grup: `/api/v1/kasir/grup`.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::grup::grup_service;
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
    // Service mengembalikan pesan domain; semuanya 400 seperti `ValueError` di Python.
    http::err(400, e)
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let include_arsip = q.get("include_arsip").map(|v| v == "1").unwrap_or(false);
    match grup_service::get_all(&state, !include_arsip).await {
        Ok(rows) => http::json(
            200,
            json!({"grup": rows.iter().map(|g| g.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e.to_string()),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match grup_service::create(&state, &data, &kasir.user.username).await {
        Ok(grup) => http::json(
            201,
            json!({"success": true, "message": format!("Grup {} berhasil dibuat", grup.nama)}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match grup_service::update(&state, id, &data, &kasir.user.username).await {
        Ok(grup) => http::json(
            200,
            json!({"success": true, "message": format!("Grup {} berhasil diperbarui", grup.nama)}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn archive(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match grup_service::archive(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Grup berhasil diarsipkan"}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match grup_service::restore(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Grup berhasil dipulihkan"}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match grup_service::delete(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Grup berhasil dihapus"}),
        ),
        Err(e) => pesan(e),
    }
}

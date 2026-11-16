//! CRUD staff kasir/admin (admin-only, setara `routes/user/user_routes.py`).

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::user::user_service;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

fn bad_request(message: String) -> Response {
    http::err(400, message)
}

fn guard(kasir: &Kasir) -> Option<Response> {
    admin_only(kasir).err()
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    let aktif_only = q.get("include_arsip").map(|v| v != "1").unwrap_or(true);
    match user_service::list(&state, aktif_only).await {
        Ok(users) => http::json(200, json!(users)),
        Err(e) => http::err(500, e.to_string()),
    }
}

pub async fn get_one(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    match user_service::get(&state, id).await {
        Ok(user) => http::json(200, user),
        Err(e) => http::err(404, e),
    }
}

pub async fn create(State(state): State<Arc<AppState>>, kasir: Kasir, body: Bytes) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    match user_service::create(&state, &data, &kasir.user.username).await {
        Ok(user) => http::json(
            201,
            json!({"success": true, "user": user, "message": "User berhasil ditambahkan"}),
        ),
        Err(e) => bad_request(e),
    }
}

pub async fn update(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    match user_service::update(&state, id, &data, &kasir.user.username).await {
        Ok(user) => http::json(
            200,
            json!({"success": true, "user": user, "message": "Data staff diperbarui"}),
        ),
        Err(e) => bad_request(e),
    }
}

pub async fn archive(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    match user_service::archive(&state, id, &kasir.user.username).await {
        Ok((status, body)) => http::json(status, body),
        Err(e) => bad_request(e),
    }
}

pub async fn restore(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    match user_service::restore(&state, id, &kasir.user.username).await {
        Ok((status, body)) => http::json(status, body),
        Err(e) => bad_request(e),
    }
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    let confirm = data
        .get("confirm")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    let target = match user_service::get(&state, id).await {
        Ok(user) => user,
        Err(e) => return http::err(404, e),
    };
    let username = target
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    if confirm != username {
        return http::err(400, "Ketik username untuk konfirmasi hapus permanen");
    }
    match user_service::delete(&state, id, &kasir.user.username).await {
        Ok(body) => http::json(200, body),
        Err(e) => bad_request(e),
    }
}

pub async fn reset_kuota(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(id): Path<i64>,
) -> Response {
    if let Some(res) = guard(&kasir) {
        return res;
    }
    match user_service::reset_kuota(&state, id, &kasir.user.username).await {
        Ok(user) => http::json(
            200,
            json!({"success": true, "user": user, "message": "Kuota bermain kasir berhasil direset"}),
        ),
        Err(e) => bad_request(e),
    }
}

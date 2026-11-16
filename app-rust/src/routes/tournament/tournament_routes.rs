//! Turnamen eSports: bracket playoff/swiss.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::tournament::tournament_service as svc;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn gagal(e: (u16, String)) -> Response {
    http::json(e.0, json!({"success": false, "error": e.1}))
}

pub async fn list(State(state): St, _kasir: Kasir) -> Response {
    match svc::list(&state).await {
        Ok(data) => http::json(200, data),
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
    match svc::create(&state, &data, &kasir.user.username).await {
        Ok(data) => http::json(201, data),
        Err(e) => gagal(e),
    }
}

pub async fn update_skor(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match svc::update_skor(&state, id, &data, &kasir.user.username).await {
        Ok(_) => http::json(
            200,
            json!({"success": true, "message": "Skor pertandingan diperbarui"}),
        ),
        Err(e) => gagal(e),
    }
}

pub async fn next_swiss(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::next_swiss(&state, id, &kasir.user.username).await {
        Ok(ronde) => http::json(
            200,
            json!({"success": true, "message": format!("Ronde {ronde} berhasil dibuat")}),
        ),
        Err(e) => gagal(e),
    }
}

pub async fn finish_stage(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let tim: Vec<i64> = data
        .get("tim_ids")
        .or_else(|| data.get("team_ids"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect())
        .unwrap_or_default();
    match svc::finish_stage(&state, id, &tim, &kasir.user.username).await {
        Ok(pesan) => http::json(200, json!({"success": true, "message": pesan})),
        Err(e) => gagal(e),
    }
}

pub async fn delete(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::delete(&state, id, &kasir.user.username).await {
        Ok(pesan) => http::json(200, json!({"success": true, "message": pesan})),
        Err(e) => gagal(e),
    }
}

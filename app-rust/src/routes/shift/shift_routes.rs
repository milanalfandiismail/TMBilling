//! Rute shift kasir: `/api/v1/kasir/shift`.

use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::shift::shift_service;
use crate::state::AppState;
use crate::utils::http;
use crate::utils::validators::int_range;

type St = State<Arc<AppState>>;

fn gagal(status: u16, msg: impl Into<String>) -> Response {
    http::json(status, json!({"error": msg.into()}))
}

pub async fn start(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    let data: Value = http::parse_json(&body);
    let modal = data
        .get("modal_awal")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0);
    match shift_service::start(&state, &kasir.user.username, modal, &kasir.user.username).await {
        Ok(shift) => http::json(201, json!({"success": true, "shift": shift})),
        Err(e) => gagal(400, e),
    }
}

pub async fn active(State(state): St, kasir: Kasir) -> Response {
    match shift_service::active(&state, &kasir).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(500, e),
    }
}

pub async fn summary(State(state): St, kasir: Kasir, Path(shift_id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match shift_service::summary(&state, shift_id).await {
        Ok(data) => http::json(200, json!({"success": true, "summary": data})),
        Err(e) => gagal(400, e),
    }
}

pub async fn summary_aktif(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let aktif = crate::repositories::shift::get_active_any(&state.pool).await;
    let shift_id = match aktif {
        Ok(Some(s)) => s.id,
        Ok(None) => return gagal(400, "Tidak ada shift aktif"),
        Err(e) => return gagal(500, e.to_string()),
    };
    match shift_service::summary(&state, shift_id).await {
        Ok(data) => http::json(200, json!({"success": true, "summary": data})),
        Err(e) => gagal(400, e),
    }
}

pub async fn end(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    let data: Value = http::parse_json(&body);
    let uang = data
        .get("uang_fisik")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0);
    let catatan = data.get("catatan").and_then(|v| v.as_str());
    match shift_service::end(&state, kasir.user.id, uang, catatan, &kasir.user.username).await {
        Ok(result) => http::json(200, json!({"success": true, "result": result})),
        Err(e) if e == "Tidak ada shift aktif" => gagal(400, e),
        Err(e) => gagal(400, e),
    }
}

pub async fn force_close(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let shift_id = data
        .get("shift_id")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0);
    if shift_id == 0 {
        return gagal(400, "Shift ID wajib diisi");
    }
    let alasan = data.get("alasan").and_then(|v| v.as_str()).unwrap_or("");
    match shift_service::force_close(&state, shift_id, &kasir.user.username, alasan).await {
        Ok(result) => http::json(
            200,
            json!({"success": true, "result": result, "message": "Shift berhasil ditutup paksa"}),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn receipt(State(state): St, kasir: Kasir, Path(shift_id): Path<i64>) -> Response {
    if kasir.user.role() != "admin" {
        let shift = crate::repositories::shift::get_by_id(&state.pool, shift_id).await;
        match shift {
            Ok(Some(s)) if s.kasir_id == kasir.user.id => {}
            Ok(_) => return gagal(403, "Akses ditolak"),
            Err(e) => return gagal(500, e.to_string()),
        }
    }
    match shift_service::receipt_text(&state, shift_id).await {
        Ok(text) => http::json(200, json!({"success": true, "receipt_text": text})),
        Err(e) => gagal(404, e),
    }
}

pub async fn history(
    State(state): St,
    kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let limit = q
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(10);
    let offset = q
        .get("offset")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);
    if let Err(e) = int_range(&json!(limit), 1, 100, "Parameter limit") {
        return gagal(400, e);
    }
    if offset < 0 {
        return gagal(400, "Parameter offset harus >= 0");
    }
    let kasir_id = if kasir.user.role() == "admin" {
        q.get("kasir_id").and_then(|v| v.parse::<i64>().ok())
    } else {
        Some(kasir.user.id)
    };
    match shift_service::history(
        &state,
        kasir_id,
        limit,
        offset,
        q.get("tanggal_mulai").map(String::as_str),
        q.get("tanggal_selesai").map(String::as_str),
    )
    .await
    {
        Ok(shifts) => http::json(200, json!({"success": true, "shifts": shifts})),
        Err(e) => gagal(400, e),
    }
}

pub async fn kasir_list(State(state): St, _kasir: Kasir) -> Response {
    match shift_service::kasir_list(&state).await {
        Ok(data) => http::json(200, json!({"success": true, "kasir": data["kasir"]})),
        Err(e) => gagal(500, e),
    }
}

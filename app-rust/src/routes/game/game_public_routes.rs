//! Katalog game publik: `/api/v1/public/game`.

use crate::services::game::game_service;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

pub async fn list(State(state): St, Query(q): Query<HashMap<String, String>>) -> Response {
    let kategori = q.get("category").map(String::as_str);
    let tipe = q.get("tipe").map(String::as_str);
    let search = q
        .get("q")
        .map(String::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let limit = q.get("limit").and_then(|v| v.parse::<i64>().ok());
    let offset = q
        .get("offset")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);
    match game_service::get_all(&state, true, kategori, tipe, search, limit, offset).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "data": rows.iter().map(|g| g.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e),
    }
}

pub async fn kategori_list(State(state): St) -> Response {
    match game_service::kategori_all(&state).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "data": rows.iter().map(|k| k.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e),
    }
}

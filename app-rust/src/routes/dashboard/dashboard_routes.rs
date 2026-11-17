//! API dashboard kasir: kartu PC, metrik server, analytics.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::dashboard::dashboard_service;
use crate::services::owner;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

pub async fn pc_list(State(state): St, _kasir: Kasir) -> Response {
    http::json(200, dashboard_service::pc_list(&state).await)
}

pub async fn server_metrics(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let berkas = state.cfg.root.join("app/tmp/lhm_metrics.json");
    let data: Value = std::fs::read_to_string(berkas)
        .ok()
        .and_then(|t| serde_json::from_str(t.as_str()).ok())
        .unwrap_or_else(|| json!({"status": "offline"}));
    http::json(200, json!({"success": true, "data": data}))
}

pub async fn analytics(
    State(state): St,
    kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match owner::analytics::analytics(&state, q.get("start").map(String::as_str), q.get("end").map(String::as_str)).await {
        Ok(data) => http::json(200, json!({"success": true, "data": data})),
        Err(pesan) => http::json(400, json!({"success": false, "error": pesan})),
    }
}

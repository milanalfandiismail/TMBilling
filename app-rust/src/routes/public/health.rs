//! `GET /api/health` — status kasar tanpa angka atau path.

use crate::state::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::sync::Arc;

const MIN_FREE_BYTES: u64 = 512 * 1024 * 1024;

pub async fn health(State(state): State<Arc<AppState>>) -> Response {
    let db = match sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => "ok",
        Err(_) => "down",
    };
    let disk = match state
        .cfg
        .db_path
        .parent()
        .and_then(|p| fs2::available_space(p).ok())
    {
        Some(free) if free >= MIN_FREE_BYTES => "ok",
        Some(_) => "low",
        None => "unknown",
    };
    // Status backup terakhir diisi scheduler (Task 14); sebelum itu "unknown".
    let backup = "unknown";
    let healthy = [db, disk, backup]
        .iter()
        .all(|v| *v == "ok" || *v == "unknown");
    let status = if healthy { "ok" } else { "degraded" };
    (
        StatusCode::OK,
        Json(json!({"status": status, "checks": {"db": db, "disk": disk, "backup": backup}})),
    )
        .into_response()
}

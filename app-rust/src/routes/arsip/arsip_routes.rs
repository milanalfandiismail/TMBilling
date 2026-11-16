//! Tab Data Diarsipkan: agregat 7 kategori.

use crate::middleware::auth::Kasir;
use crate::services::arsip::arsip_service;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::State;
use axum::response::Response;
use serde_json::json;
use std::sync::Arc;

pub async fn index(State(state): State<Arc<AppState>>, _kasir: Kasir) -> Response {
    http::json(
        200,
        json!({"success": true, "data": arsip_service::get(&state).await}),
    )
}

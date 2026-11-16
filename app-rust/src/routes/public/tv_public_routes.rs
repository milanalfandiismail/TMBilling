//! Billboard TV publik: `/api/v1/public/tv/data`.

use crate::services::public::tv_service;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::State;
use axum::response::Response;
use serde_json::json;
use std::sync::Arc;

pub async fn data(State(state): State<Arc<AppState>>) -> Response {
    http::json(
        200,
        json!({"success": true, "data": tv_service::live_data(&state).await}),
    )
}

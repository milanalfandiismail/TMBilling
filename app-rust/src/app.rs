//! Router aplikasi: aset embed, health publik, dan guard whitelist.

use crate::assets::StaticAssets;
use crate::middleware::whitelist;
use crate::routes::public::health;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::Path;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use std::sync::Arc;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";

pub fn router(state: Arc<AppState>) -> Router {
    let guarded = Router::new()
        .route("/kasir/", get(shell_placeholder))
        .route("/kasir/login", get(shell_placeholder))
        .layer(axum::middleware::from_fn_with_state(state.clone(), whitelist::guard));

    Router::new()
        .route("/api/health", get(health::health))
        .merge(guarded)
        .route("/static/{*path}", get(static_file))
        .with_state(state)
}

/// Placeholder sampai template dashboard diport.
async fn shell_placeholder() -> &'static str {
    "TMBilling"
}

async fn static_file(Path(path): Path<String>) -> Response {
    match StaticAssets::get(&path) {
        Some(file) => {
            let mime = crate::assets::content_type(&path);
            let body: Body = Body::from(file.data.into_owned());
            let mut res = (StatusCode::OK, body).into_response();
            res.headers_mut().insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static(IMMUTABLE));
            res
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

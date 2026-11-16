//! Router aplikasi: aset embed, health publik, dan guard whitelist.

use crate::assets::StaticAssets;
use crate::middleware::{csrf, whitelist};
use crate::routes::auth::auth_kasir;
use crate::routes::public::health;
use crate::routes::settings::settings_routes;
use crate::routes::user::user_routes;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::Path;
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::Router;
use std::sync::Arc;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";

pub fn router(state: Arc<AppState>) -> Router {
    let kasir_api = Router::new()
        .route("/api/v1/kasir/auth/login", post(auth_kasir::login))
        .route("/api/v1/kasir/auth/logout", post(auth_kasir::logout))
        .route("/api/v1/kasir/auth/check", get(auth_kasir::check))
        .route(
            "/api/v1/kasir/auth/admin-check",
            post(auth_kasir::admin_check),
        )
        .route(
            "/api/v1/kasir/user",
            get(user_routes::list).post(user_routes::create),
        )
        .route(
            "/api/v1/kasir/user/",
            get(user_routes::list).post(user_routes::create),
        )
        .route(
            "/api/v1/kasir/user/{id}",
            get(user_routes::get_one)
                .put(user_routes::update)
                .delete(user_routes::delete),
        )
        .route(
            "/api/v1/kasir/user/{id}/archive",
            post(user_routes::archive),
        )
        .route(
            "/api/v1/kasir/user/{id}/restore",
            post(user_routes::restore),
        )
        .route(
            "/api/v1/kasir/user/{id}/reset-kuota",
            post(user_routes::reset_kuota),
        )
        .route("/api/v1/kasir/settings", get(settings_routes::get_all))
        .route("/api/v1/kasir/settings/", get(settings_routes::get_all))
        .route(
            "/api/v1/kasir/settings/auto-shutdown",
            put(settings_routes::auto_shutdown),
        )
        .route(
            "/api/v1/kasir/settings/client-polling-interval",
            put(settings_routes::client_polling_interval),
        )
        .route(
            "/api/v1/kasir/settings/apikey",
            put(settings_routes::apikey),
        )
        .route(
            "/api/v1/kasir/settings/timezone",
            put(settings_routes::timezone),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist/regenerate-token",
            post(settings_routes::regenerate_token),
        )
        .route(
            "/api/v1/kasir/settings/{key}",
            get(settings_routes::get_one).put(settings_routes::put_one),
        );

    let guarded = Router::new()
        .route("/kasir/", get(shell_placeholder))
        .route("/kasir/login", get(auth_kasir::login_page))
        .merge(kasir_api)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            csrf::guard,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            whitelist::guard,
        ));

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
            res.headers_mut()
                .insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            res.headers_mut()
                .insert(header::CACHE_CONTROL, HeaderValue::from_static(IMMUTABLE));
            res
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

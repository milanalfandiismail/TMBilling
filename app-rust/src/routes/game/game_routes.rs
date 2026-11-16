//! Katalog game/aplikasi: `/api/v1/kasir/game`.

use crate::middleware::auth::{admin_only, Kasir};
use crate::repositories::game as game_repo;
use crate::services::game::game_service;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::{Path, Query, Request, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn pesan(e: String) -> Response {
    http::err(400, e)
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let aktif_only = q.get("include_arsip").map(|v| v != "1").unwrap_or(true);
    let kategori = q.get("category").map(String::as_str);
    let tipe = q.get("tipe").map(String::as_str);
    let search = q
        .get("q")
        .map(String::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty());
    match game_service::get_all(&state, aktif_only, kategori, tipe, search, None, 0).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "data": rows.iter().map(|g| g.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, req: Request) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let payload = http::payload(req, &state).await;
    let (data, upload) = match payload {
        Ok(v) => v,
        Err(e) => return http::err(400, e),
    };
    match game_service::create(&state, &data, upload.as_ref(), &kasir.user.username).await {
        Ok(game) => {
            let label = if game.tipe() == "aplikasi" {
                "Aplikasi"
            } else {
                "Game"
            };
            http::json(
                201,
                json!({
                    "success": true,
                    "message": format!("{label} '{}' berhasil ditambahkan", game.nama),
                    "data": game.to_json(),
                }),
            )
        }
        Err(e) => pesan(e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, req: Request) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let payload = http::payload(req, &state).await;
    let (data, upload) = match payload {
        Ok(v) => v,
        Err(e) => return http::err(400, e),
    };
    match game_service::update(&state, id, &data, upload.as_ref(), &kasir.user.username).await {
        Ok(game) => {
            let label = if game.tipe() == "aplikasi" {
                "Aplikasi"
            } else {
                "Game"
            };
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("{label} '{}' berhasil diperbarui", game.nama),
                    "data": game.to_json(),
                }),
            )
        }
        Err(e) => pesan(e),
    }
}

pub async fn archive(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match game_service::archive(&state, id, &kasir.user.username).await {
        Ok(message) => http::json(200, json!({"success": true, "message": message})),
        Err(e) => pesan(e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match game_service::restore(&state, id, &kasir.user.username).await {
        Ok(message) => http::json(200, json!({"success": true, "message": message})),
        Err(e) => pesan(e),
    }
}

pub async fn hapus(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let game = match game_repo::get_by_id(&state.pool, id).await {
        Ok(Some(g)) => g,
        Ok(None) => return http::err(404, "Game tidak ditemukan"),
        Err(e) => return http::err(500, e.to_string()),
    };
    let data = http::parse_json(&body);
    let confirm = data.get("confirm").map(|v| match v {
        Value::String(s) => s.trim().to_lowercase(),
        other => other.to_string().trim().to_lowercase(),
    });
    if confirm.as_deref() != Some(game.nama.to_lowercase().as_str()) {
        return http::err(400, "Ketik nama game untuk konfirmasi hapus permanen");
    }
    match game_service::delete(&state, id, &kasir.user.username).await {
        Ok(message) => http::json(200, json!({"success": true, "message": message})),
        Err(e) => pesan(e),
    }
}

pub async fn kategori_list(State(state): St, _kasir: Kasir) -> Response {
    match game_service::kategori_all(&state).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "data": rows.iter().map(|k| k.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => http::err(500, e),
    }
}

pub async fn kategori_create(State(state): St, kasir: Kasir, body: axum::body::Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    match game_service::kategori_create(&state, &data).await {
        Ok(k) => http::json(
            201,
            json!({
                "success": true,
                "message": format!("Kategori '{}' berhasil ditambahkan", k.nama),
                "data": k.to_json(),
            }),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn kategori_hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match game_service::kategori_delete(&state, id).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Kategori berhasil dihapus"}),
        ),
        Err(e) => pesan(e),
    }
}

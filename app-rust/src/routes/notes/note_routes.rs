//! Rute catatan serah terima: `/api/v1/kasir/notes`.

use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::middleware::auth::Kasir;
use crate::services::notes::note_service::{self, NoteError};
use crate::state::AppState;
use crate::utils::http;
use crate::utils::logger;

type St = State<Arc<AppState>>;

fn tolak(e: NoteError) -> Response {
    http::json(e.status, json!({"success": false, "error": e.message}))
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let notes = note_service::list(&state, q.get("q").map(String::as_str));
    http::json(200, json!({"success": true, "notes": notes}))
}

pub async fn get(State(state): St, _kasir: Kasir, Path(filename): Path<String>) -> Response {
    match note_service::get(&state, &filename) {
        Ok(note) => http::json(200, json!({"success": true, "note": note})),
        Err(e) => tolak(e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    let data: Value = http::parse_json(&body);
    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Catatan Baru");
    let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    match note_service::create(&state, title, content) {
        Ok(note) => {
            logger::rec(
                &kasir.user.username,
                "NOTE_CREATED",
                &format!(
                    "Membuat catatan baru: {}",
                    note["filename"].as_str().unwrap_or("")
                ),
            );
            http::json(201, json!({"success": true, "note": note}))
        }
        Err(e) => tolak(e),
    }
}

pub async fn save(
    State(state): St,
    _kasir: Kasir,
    Path(filename): Path<String>,
    body: Bytes,
) -> Response {
    let data: Value = http::parse_json(&body);
    let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let title = data.get("title").and_then(|v| v.as_str());
    match note_service::save(&state, &filename, content, title) {
        Ok(note) => http::json(200, json!({"success": true, "note": note})),
        Err(e) => tolak(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(filename): Path<String>) -> Response {
    match note_service::delete(&state, &filename) {
        Ok(()) => {
            logger::rec(
                &kasir.user.username,
                "NOTE_DELETED",
                &format!("Menghapus catatan: {filename}"),
            );
            http::json(
                200,
                json!({"success": true, "message": format!("Catatan '{filename}' berhasil dihapus")}),
            )
        }
        Err(e) => tolak(e),
    }
}

pub async fn download(State(state): St, _kasir: Kasir, Path(filename): Path<String>) -> Response {
    let path = match note_service::validate_path(&state, &filename) {
        Ok(p) => p,
        Err(e) => return tolak(e),
    };
    if !path.exists() {
        return http::json(
            404,
            json!({"success": false, "error": "Berkas tidak ditemukan"}),
        );
    }
    let nama = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.clone());
    match tokio::fs::read(&path).await {
        Ok(bytes) => (
            [
                (
                    header::CONTENT_TYPE,
                    "text/plain; charset=utf-8".to_string(),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{nama}\""),
                ),
            ],
            bytes,
        )
            .into_response(),
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}

pub async fn pin(State(state): St, kasir: Kasir, Path(filename): Path<String>) -> Response {
    match note_service::toggle_pin(&state, &filename) {
        Ok(result) => {
            let aksi = if result["is_pinned"].as_bool().unwrap_or(false) {
                "Menyematkan"
            } else {
                "Melepas sematan"
            };
            logger::rec(
                &kasir.user.username,
                "NOTE_PIN_TOGGLED",
                &format!("{aksi} catatan: {filename}"),
            );
            http::json(200, json!({"success": true, "result": result}))
        }
        Err(e) => tolak(e),
    }
}

pub async fn duplicate(State(state): St, kasir: Kasir, Path(filename): Path<String>) -> Response {
    match note_service::duplicate(&state, &filename) {
        Ok(note) => {
            logger::rec(
                &kasir.user.username,
                "NOTE_DUPLICATED",
                &format!(
                    "Menduplikasi catatan {filename} -> {}",
                    note["filename"].as_str().unwrap_or("")
                ),
            );
            http::json(201, json!({"success": true, "note": note}))
        }
        Err(e) => tolak(e),
    }
}

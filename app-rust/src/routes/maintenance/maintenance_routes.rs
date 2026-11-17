//! Tiket servis PC.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::maintenance::maintenance_service as svc;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn gagal(e: (u16, String)) -> Response {
    http::json(e.0, json!({"success": false, "error": e.1}))
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    let data: Value = http::parse_json(&body);
    let prioritas = data.get("prioritas").and_then(|v| v.as_str()).unwrap_or("");
    if prioritas.eq_ignore_ascii_case("KRITIS") && !kasir.is_admin() {
        return http::err(403, "Prioritas KRITIS hanya dapat dibuat oleh admin");
    }
    match svc::create(&state, &data, &kasir.user.username).await {
        Ok(tiket) => http::json(201, json!({"success": true, "ticket": tiket})),
        Err(e) => gagal(e),
    }
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let data = json!(q);
    match svc::list(&state, &data).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "tickets": rows.get("tickets").cloned().unwrap_or(json!([]))}),
        ),
        Err(e) => gagal(e),
    }
}

pub async fn update_status(
    State(state): St,
    _kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    let data: Value = http::parse_json(&body);
    let operator = &_kasir.user.username;
    match svc::update_status(&state, id, &data, operator).await {
        Ok(tiket) => http::json(200, json!({"success": true, "ticket": tiket})),
        Err(e) => gagal(e),
    }
}

pub async fn report(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let data = json!(q);
    match svc::report(&state, &data).await {
        Ok(rows) => http::json(200, json!({"success": true, "report": rows})),
        Err(e) => gagal(e),
    }
}

pub async fn export(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let data = json!(q);
    match svc::report(&state, &data).await {
        Ok(rows) => {
            let mut teks = String::from("PC,Kategori,Prioritas,Status,Biaya,Judul\n");
            if let Some(list) = rows.get("list_tiket").and_then(|v| v.as_array()) {
                for t in list {
                    teks.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        t.get("pc_kode").and_then(|v| v.as_str()).unwrap_or("-"),
                        t.get("kategori").and_then(|v| v.as_str()).unwrap_or("-"),
                        t.get("prioritas").and_then(|v| v.as_str()).unwrap_or("-"),
                        t.get("status").and_then(|v| v.as_str()).unwrap_or("-"),
                        t.get("biaya").and_then(|v| v.as_i64()).unwrap_or(0),
                        t.get("judul")
                            .and_then(|v| v.as_str())
                            .unwrap_or("-")
                            .replace(',', " "),
                    ));
                }
            }
            let mut res = http::json(200, json!({"success": true}));
            *res.body_mut() = axum::body::Body::from(teks);
            res.headers_mut().insert(
                axum::http::header::CONTENT_TYPE,
                axum::http::HeaderValue::from_static("text/csv; charset=utf-8"),
            );
            res.headers_mut().insert(
                axum::http::header::CONTENT_DISPOSITION,
                axum::http::HeaderValue::from_static(
                    "attachment; filename=laporan_maintenance.csv",
                ),
            );
            res
        }
        Err(e) => gagal(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match svc::delete(&state, id, &kasir.user.username).await {
        Ok(pesan) => http::json(200, json!({"success": true, "message": pesan})),
        Err(e) => gagal(e),
    }
}

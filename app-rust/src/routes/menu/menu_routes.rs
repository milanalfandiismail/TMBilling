//! Rute katalog F&B: `/api/v1/kasir/menu`.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::menu::menu_service;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn gagal(status: u16, pesan: impl Into<String>) -> Response {
    http::json(status, json!({"success": false, "error": pesan.into()}))
}

fn alasan(e: String) -> Response {
    // Service mengembalikan pesan domain; semua kegagalan validasi = 400 seperti `ValueError` Python.
    gagal(400, e)
}

pub async fn list(State(state): St, _kasir: Kasir) -> Response {
    match menu_service::get_all(&state).await {
        Ok(rows) => http::json(
            200,
            json!({"success": true, "data": rows.iter().map(|m| m.to_json()).collect::<Vec<_>>()}),
        ),
        Err(e) => gagal(500, e),
    }
}

pub async fn archived(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match menu_service::get_archived(&state).await {
        Ok(rows) => http::json(200, json!({"success": true, "data": rows})),
        Err(e) => gagal(500, e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, req: axum::extract::Request) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let (data, upload) = match http::payload(req, &state).await {
        Ok(v) => v,
        Err(e) => return gagal(400, e),
    };
    match menu_service::create(&state, &data, upload.as_ref(), &kasir.user.username).await {
        Ok(menu) => http::json(
            201,
            json!({
                "success": true,
                "data": menu.to_json(),
                "message": format!("Menu '{}' berhasil dibuat!", menu.nama),
            }),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn update(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    req: axum::extract::Request,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let (data, upload) = match http::payload(req, &state).await {
        Ok(v) => v,
        Err(e) => return gagal(400, e),
    };
    match menu_service::update(&state, id, &data, upload.as_ref(), &kasir.user.username).await {
        Ok(menu) => http::json(
            200,
            json!({"success": true, "data": menu.to_json(), "message": "Menu berhasil diperbarui!"}),
        ),
        Err(e) => alasan(e),
    }
}

/// Restock butuh shift aktif di Python (`@shift_required`); gate shift menyusul di Task 8.
// shortcut: tambah-stok belum memeriksa shift aktif, pasang saat ShiftService tersedia (Task 8).
pub async fn tambah_stok(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let data: Value = http::parse_body(&headers, body).await;
    let jumlah = data.get("jumlah_tambah").or_else(|| data.get("jumlah"));
    if jumlah.map(|v| v.is_null()).unwrap_or(true) || jumlah.and_then(Value::as_str) == Some("") {
        return gagal(400, "Jumlah penambahan stok harus diisi");
    }
    let catatan = data.get("catatan").and_then(Value::as_str);
    match menu_service::tambah_stok(&state, id, jumlah, catatan, &kasir.user.username).await {
        Ok(menu) => http::json(
            200,
            json!({
                "success": true,
                "data": menu.to_json(),
                "message": format!(
                    "Stok '{}' berhasil ditambah sebanyak +{} (Total sekarang: {})!",
                    menu.nama,
                    jumlah.and_then(|v| v.as_i64()).unwrap_or(0),
                    menu.stok
                ),
            }),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match menu_service::archive(&state, id, &kasir.user.username).await {
        Ok(nama) => http::json(
            200,
            json!({"success": true, "message": format!("Menu '{nama}' berhasil dipindahkan ke arsip!")}),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match menu_service::restore(&state, id, &kasir.user.username).await {
        Ok(menu) => http::json(
            200,
            json!({
                "success": true,
                "data": menu.to_json(),
                "message": format!("Menu '{}' berhasil dipulihkan dari arsip!", menu.nama),
            }),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn permanent(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match menu_service::hard_delete(&state, id, &kasir.user.username).await {
        Ok((nama, total)) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Menu '{nama}' dan {total} transaksi terkait berhasil dihapus permanen!"),
                "transaksi_dihapus": total,
            }),
        ),
        Err(e) => gagal(404, e),
    }
}

pub async fn checkout(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    let data: Value = http::parse_json(&body);
    if data.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return gagal(400, "Payload JSON kosong");
    }
    match menu_service::checkout(&state, &data, &kasir.user).await {
        Ok(hasil) => http::json(
            200,
            json!({"success": true, "data": hasil, "message": "Transaksi F&B berhasil diproses!"}),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn stock_logs(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let hasil = menu_service::stock_logs(
        &state,
        q.get("tanggal").map(String::as_str),
        q.get("menu_id").map(String::as_str),
        q.get("operator").map(String::as_str),
        q.get("search").map(String::as_str),
        q.get("page").map(String::as_str),
        q.get("per_page").map(String::as_str),
    )
    .await;
    match hasil {
        Ok(h) => http::json(
            200,
            json!({
                "success": true,
                "data": h.items,
                "pagination": {
                    "total": h.total,
                    "page": h.page,
                    "pages": h.pages,
                    "has_prev": h.has_prev,
                    "has_next": h.has_next,
                },
                "operators": h.operators,
                "dates": h.dates,
            }),
        ),
        Err(e) => alasan(e),
    }
}

pub async fn stock_log_dates(State(state): St, _kasir: Kasir) -> Response {
    match menu_service::log_dates(&state).await {
        Ok(dates) => http::json(200, json!({"success": true, "dates": dates})),
        Err(e) => alasan(e),
    }
}

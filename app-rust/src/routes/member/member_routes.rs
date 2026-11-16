//! Rute member: `/api/v1/kasir/member`.

use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::middleware::auth::{admin_only, shift_required, Kasir};
use crate::services::member::member_service;
use crate::state::AppState;
use crate::utils::http;

type St = State<Arc<AppState>>;

fn gagal(status: u16, msg: impl Into<String>) -> Response {
    http::json(status, json!({"success": false, "error": msg.into()}))
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let page = q
        .get("page")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(1)
        .max(1);
    let per_page = q
        .get("per_page")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(5)
        .clamp(1, 100);
    let sort_by = q.get("sort_by").map(String::as_str).unwrap_or("grup_id");
    let order = q.get("order").map(String::as_str).unwrap_or("asc");
    let include_arsip = q.get("include_arsip").map(|v| v == "1").unwrap_or(false);
    match member_service::list(
        &state,
        q.get("q").map(String::as_str),
        q.get("grup_id").map(String::as_str),
        page,
        per_page,
        sort_by,
        order,
        include_arsip,
    )
    .await
    {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(400, e),
    }
}

pub async fn detail(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    match member_service::detail(&state, id).await {
        Ok(Some(member)) => http::json(200, json!({"member": member})),
        Ok(None) => gagal(404, "Member tidak ditemukan"),
        Err(e) => gagal(500, e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match member_service::create(&state, &data, &kasir.user.username).await {
        Ok(info) => http::json(
            201,
            json!({
                "success": true,
                "message": format!("Member '{}' berhasil ditambahkan", info["username"].as_str().unwrap_or("")),
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match member_service::update(&state, id, &data, &kasir.user.username).await {
        Ok(info) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Member '{}' berhasil diupdate", info["username"].as_str().unwrap_or("")),
                "member": info["member"],
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn archive(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match member_service::archive(&state, id, &kasir.user.username).await {
        Ok(Some(_)) => http::json(
            200,
            json!({"success": true, "message": "Member berhasil diarsipkan"}),
        ),
        Ok(None) => gagal(404, "Member tidak ditemukan"),
        Err(e) => gagal(400, e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match member_service::restore(&state, id, &kasir.user.username).await {
        Ok(Some(_)) => http::json(
            200,
            json!({"success": true, "message": "Member berhasil dipulihkan"}),
        ),
        Ok(None) => gagal(404, "Member tidak ditemukan"),
        Err(e) => gagal(400, e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let Some(member) = member_service::detail(&state, id).await.ok().flatten() else {
        return gagal(404, "Member tidak ditemukan");
    };
    let username = member["username"].as_str().unwrap_or("").to_string();
    let data: Value = http::parse_json(&body);
    let konfirmasi = data
        .get("confirm")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if konfirmasi != username.to_lowercase() {
        return gagal(400, "Ketik username member untuk konfirmasi hapus permanen");
    }
    match member_service::delete(&state, id, &kasir.user.username).await {
        Ok(Some(_)) => http::json(
            200,
            json!({"success": true, "message": "Member berhasil dihapus"}),
        ),
        Ok(None) => gagal(404, "Member tidak ditemukan"),
        Err(e) => gagal(400, e),
    }
}

/// `selections` atau `paket_id` + `qty`; baris pertama adalah member target.
fn ambil_target(data: &Value) -> Result<(i64, Vec<(i64, i64)>), String> {
    let member_id = data
        .get("member_id")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .ok_or("Member tidak ditemukan")?;
    let mut selections = Vec::new();
    if let Some(items) = data.get("selections").and_then(|v| v.as_array()) {
        for item in items {
            let paket_id = item
                .get("paket_id")
                .and_then(|v| {
                    v.as_i64()
                        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                })
                .ok_or("Paket belum dipilih")?;
            let qty = item
                .get("qty")
                .and_then(|v| {
                    v.as_i64()
                        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                })
                .unwrap_or(1);
            selections.push((paket_id, qty));
        }
    }
    if selections.is_empty() {
        let paket_id = data
            .get("paket_id")
            .and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
            .ok_or("Paket belum dipilih")?;
        let qty = data
            .get("qty")
            .and_then(|v| {
                v.as_i64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
            .unwrap_or(1);
        if qty <= 0 {
            return Err("Kuantitas harus minimal 1".into());
        }
        selections.push((paket_id, qty));
    }
    Ok((member_id, selections))
}

pub async fn tambah_waktu(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let (member_id, selections) = match ambil_target(&data) {
        Ok(v) => v,
        Err(e) => return gagal(400, e),
    };
    let metode = data.get("metode_pembayaran").and_then(|v| v.as_str());
    let client_id = data.get("client_request_id").and_then(|v| v.as_str());
    match member_service::tambah_waktu(
        &state,
        member_id,
        &selections,
        metode,
        &kasir.user.username,
        client_id,
    )
    .await
    {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Waktu berhasil ditambah"}),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn riwayat(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    match member_service::riwayat(&state, id).await {
        Ok(data) => http::json(200, data),
        Err(e) => gagal(400, e),
    }
}

pub async fn refund(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }
    let data: Value = http::parse_json(&body);
    let member_id = data
        .get("member_id")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0);
    let transaksi_id = data
        .get("transaksi_id")
        .and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        })
        .unwrap_or(0);
    match member_service::refund(&state, member_id, transaksi_id, &kasir.user.username).await {
        Ok(info) => http::json(
            200,
            json!({
                "success": true,
                "message": format!(
                    "Refund berhasil: -{} Menit |  Member {}.",
                    info["durasi_dikurangi"].as_i64().unwrap_or(0),
                    info["username"].as_str().unwrap_or("")
                ),
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

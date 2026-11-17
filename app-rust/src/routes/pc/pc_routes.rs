//! CRUD PC + batch, posisi denah, reset admin, Wake-on-LAN.

use crate::middleware::auth::{admin_only, shift_required, Kasir};
use crate::repositories::pc as pc_repo;
use crate::services::pc::pc_service;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use serde_json::{json, Map, Value};
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
    let include_arsip = q.get("include_arsip").map(|v| v == "1").unwrap_or(false);
    let search = q
        .get("q")
        .map(String::as_str)
        .filter(|s| !s.trim().is_empty());
    let grup = q.get("grup_id").map(String::as_str);
    match pc_service::get_all(&state, !include_arsip, grup, search).await {
        Ok((rows, sesi)) => {
            let mut list = Vec::with_capacity(rows.len());
            let mut grouped: Map<String, Value> = Map::new();
            for pc in &rows {
                let s = sesi.get(&pc.id);
                let item = pc_service::json_pc(&state, pc, s);
                grouped
                    .entry(pc.grup())
                    .or_insert_with(|| Value::Array(Vec::new()))
                    .as_array_mut()
                    .unwrap()
                    .push(item.clone());
                list.push(item);
            }
            http::json(
                200,
                json!({"pc_list": list, "grouped": Value::Object(grouped)}),
            )
        }
        Err(e) => http::err(500, e),
    }
}

pub async fn get_one(State(state): St, _kasir: Kasir, Path(id): Path<i64>) -> Response {
    let sesi = pc_repo::sesi_map(&state.pool).await.unwrap_or_default();
    match pc_service::get_by_id(&state, id).await {
        Ok(Some(pc)) => http::json(200, pc_service::json_pc(&state, &pc, sesi.get(&pc.id))),
        Ok(None) => http::err(404, "PC tidak ditemukan"),
        Err(e) => http::err(500, e),
    }
}

pub async fn create(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match pc_service::create(&state, &data, &kasir.user.username).await {
        Ok(pc) => http::json(
            201,
            json!({
                "success": true,
                "message": format!("PC {} berhasil ditambahkan", pc.kode),
                "pc": pc_service::json_pc(&state, &pc, None),
            }),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn update(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match pc_service::update(&state, id, &data, &kasir.user.username).await {
        Ok(pc) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Data PC {} berhasil diperbarui", pc.kode),
                "pc": pc_service::json_pc(&state, &pc, None),
            }),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn hapus(State(state): St, kasir: Kasir, Path(id): Path<i64>, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, id).await {
        Ok(Some(pc)) => pc,
        Ok(None) => return http::err(404, "PC tidak ditemukan"),
        Err(e) => return http::err(500, e.to_string()),
    };
    let data = http::parse_json(&body);
    let confirm = data.get("confirm").map(|v| match v {
        Value::String(s) => s.trim().to_lowercase(),
        other => other.to_string().trim().to_lowercase(),
    });
    if confirm.as_deref() != Some(pc.kode.to_lowercase().as_str()) {
        return http::err(400, "Ketik kode PC untuk konfirmasi hapus permanen");
    }
    match pc_service::delete(&state, id, &kasir.user.username).await {
        Ok(_) => http::json(
            200,
            json!({"success": true, "message": format!("PC {} berhasil dihapus", pc.kode)}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn archive(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match pc_service::archive(&state, id, &kasir.user.username).await {
        Ok(message) => http::json(200, json!({"success": true, "message": message})),
        Err(e) => pesan(e),
    }
}

pub async fn restore(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match pc_service::restore(&state, id, &kasir.user.username).await {
        Ok(message) => http::json(200, json!({"success": true, "message": message})),
        Err(e) => pesan(e),
    }
}

pub async fn reset_admin(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    match pc_service::reset_admin_mode(&state, id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Mode Admin dimatikan"}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn position(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match pc_service::update_position(&state, id, &data).await {
        Ok(pc) => http::json(
            200,
            json!({"success": true, "pc": pc_service::json_pc(&state, &pc, None)}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn batch(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data: Value = http::parse_json(&body);
    match pc_service::create_batch(&state, &data, &kasir.user.username).await {
        Ok(added) => http::json(
            201,
            json!({"success": true, "added": added.len(), "errors": []}),
        ),
        Err(e) => pesan(e),
    }
}

pub async fn wol(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let data: Value = http::parse_json(&body);
    let ids: Vec<i64> = data
        .get("pc_ids")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default();
    let macs: Vec<String> = data
        .get("mac_addresses")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    if ids.is_empty() && macs.is_empty() {
        return http::err(400, "Tidak ada pc_ids atau mac_addresses yang diberikan");
    }
    let mut ok = Vec::new();
    let mut errors = Vec::new();
    for id in &ids {
        match pc_repo::get_by_id(&state.pool, *id).await {
            Ok(Some(pc)) => match pc.mac_address.clone() {
                Some(mac) if !mac.is_empty() => match pc_service::send_magic_packet(&mac) {
                    Ok(()) => ok.push(pc.kode.clone()),
                    Err(e) => errors.push(format!("{}: {e}", pc.kode)),
                },
                _ => errors.push(format!("{} tidak memiliki MAC Address", pc.kode)),
            },
            Ok(None) => errors.push(format!("PC {id} tidak ditemukan")),
            Err(e) => errors.push(e.to_string()),
        }
    }
    for mac in &macs {
        match pc_service::send_magic_packet(mac) {
            Ok(()) => ok.push(mac.clone()),
            Err(e) => errors.push(e),
        }
    }
    if !ok.is_empty() {
        crate::utils::logger::audit_json(
            &kasir.user.username,
            "WOL_PACKET",
            &format!("Magic Packet terkirim ke {} target", ok.len()),
            None,
            "",
            "",
            json!({"sukses": ok, "gagal": errors}),
        );
    }
    let satuan = if !ids.is_empty() { "PC" } else { "MAC" };
    http::json(
        200,
        json!({
            "success": true,
            "message": format!("Magic Packet terkirim ke {} {satuan}", ok.len()),
            "result": {"success": ok, "errors": errors},
        }),
    )
}

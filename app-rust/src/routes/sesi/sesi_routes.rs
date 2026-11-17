//! Siklus hidup sesi: buka, tambah waktu, pindah PC, tutup, refund.
//!

use crate::middleware::auth::{shift_required, Kasir};
use crate::services::sesi::sesi_service;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

type St = State<Arc<AppState>>;

fn angka(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(|x| {
        x.as_i64()
            .or_else(|| x.as_str().and_then(|s| s.trim().parse::<i64>().ok()))
    })
}

fn teks<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str)
}

fn gagal(status: u16, msg: String) -> Response {
    http::json(status, json!({"success": false, "error": msg}))
}

pub async fn buka_guest(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    match sesi_service::buka_guest(
        &state,
        teks(&v, "pc_kode"),
        angka(&v, "paket_id"),
        teks(&v, "nama_guest"),
        &kasir.user.username,
        teks(&v, "metode_pembayaran"),
    )
    .await
    {
        Ok(sesi) => {
            let sisa = sesi.sisa_menit(crate::utils::time::now_db());
            http::json(
                201,
                json!({
                    "success": true,
                    "sesi_id": sesi.id,
                    "token_sesi": sesi.token_sesi,
                    "sisa_menit": sisa,
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

pub async fn buka_member(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    let username = teks(&v, "username").unwrap_or("").to_string();
    match sesi_service::buka_member(
        &state,
        teks(&v, "pc_kode"),
        Some(&username),
        &kasir.user.username,
    )
    .await
    {
        Ok(sesi) => http::json(
            201,
            json!({
                "success": true,
                "message": format!("Sesi member {username} dibuka"),
                "sesi_id": sesi.id,
                "token_sesi": sesi.token_sesi,
                "waktu_tersimpan": sesi.waktu_tersimpan_awal,
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn buka_guest_batch(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    let kodes: Vec<String> = v
        .get("pc_kodes")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();
    if kodes.is_empty() {
        return gagal(
            400,
            "Daftar PC (pc_kodes) harus berupa array non-kosong".into(),
        );
    }
    let paket_id = match angka(&v, "paket_id") {
        Some(id) if id > 0 => id,
        _ => return gagal(400, "Paket harus dipilih".into()),
    };
    let prefix = teks(&v, "nama_guest_prefix").unwrap_or("Guest");
    let metode = teks(&v, "metode_pembayaran");
    let mut created = Vec::new();
    let mut errors = Vec::new();
    for (idx, kode) in kodes.iter().enumerate() {
        let nama = if kodes.len() > 1 && !prefix.contains('-') {
            format!("{prefix}-{}", idx + 1)
        } else if kodes.len() == 1 {
            prefix.to_string()
        } else {
            format!("{prefix} {}", idx + 1)
        };
        match sesi_service::buka_guest(
            &state,
            Some(kode),
            Some(paket_id),
            Some(&nama),
            &kasir.user.username,
            metode,
        )
        .await
        {
            Ok(sesi) => created.push(json!({
                "pc_kode": kode,
                "sesi_id": sesi.id,
                "token_sesi": sesi.token_sesi,
                "nama_guest": sesi.nama_guest,
            })),
            Err(e) => errors.push(json!({"pc_kode": kode, "error": e})),
        }
    }
    let total_success = created.len();
    let total_failed = errors.len();
    let status = if total_success == 0 { 400 } else { 201 };
    http::json(
        status,
        json!({
            "success": total_success > 0,
            "created": created,
            "errors": errors,
            "total_success": total_success,
            "total_failed": total_failed,
        }),
    )
}

pub async fn tambah_waktu_batch(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    let sesi_ids: Vec<i64> = v
        .get("sesi_ids")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default();
    if sesi_ids.is_empty() {
        return gagal(
            400,
            "Daftar sesi (sesi_ids) harus berupa array non-kosong".into(),
        );
    }
    let default_paket = angka(&v, "paket_id");
    let default_qty = angka(&v, "qty").unwrap_or(1);
    let selections: Vec<(i64, i64)> = v
        .get("selections")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|s| Some((angka(s, "paket_id")?, angka(s, "qty").unwrap_or(1))))
                .collect()
        })
        .unwrap_or_default();
    if selections.is_empty() && default_paket.is_none() {
        return gagal(400, "Paket belum dipilih".into());
    }
    let mut entries = Vec::new();
    if sesi_ids.len() == 1 {
        for (paket_id, qty) in &selections {
            entries.push((sesi_ids[0], *paket_id, *qty));
        }
        if entries.is_empty() {
            entries.push((sesi_ids[0], default_paket.unwrap_or(0), default_qty));
        }
    } else {
        let paket_id = default_paket.unwrap_or(0);
        if paket_id == 0 {
            return gagal(400, "Paket belum dipilih".into());
        }
        for id in &sesi_ids {
            entries.push((*id, paket_id, default_qty));
        }
    }
    match sesi_service::tambah_waktu_batch(
        &state,
        entries,
        teks(&v, "metode_pembayaran"),
        &kasir.user.username,
        teks(&v, "client_request_id"),
    )
    .await
    {
        Ok(()) => http::json(
            200,
            json!({
                "success": true,
                "success_ids": sesi_ids,
                "errors": [],
                "total_success": sesi_ids.len(),
                "total_failed": 0,
            }),
        ),
        Err(e) => http::json(
            400,
            json!({
                "success": false,
                "success_ids": [],
                "errors": [{"error": e}],
                "total_success": 0,
                "total_failed": sesi_ids.len(),
            }),
        ),
    }
}

pub async fn tambah_waktu_sesi(
    State(state): St,
    kasir: Kasir,
    Path(sesi_id): Path<i64>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    let selections: Vec<(i64, i64)> = v
        .get("selections")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|s| Some((angka(s, "paket_id")?, angka(s, "qty").unwrap_or(1))))
                .collect()
        })
        .unwrap_or_default();
    if !selections.is_empty() {
        let entries: Vec<(i64, i64, i64)> =
            selections.iter().map(|(p, q)| (sesi_id, *p, *q)).collect();
        return match sesi_service::tambah_waktu_batch(
            &state,
            entries,
            teks(&v, "metode_pembayaran"),
            &kasir.user.username,
            teks(&v, "client_request_id"),
        )
        .await
        {
            Ok(()) => http::json(
                200,
                json!({"success": true, "message": "Waktu berhasil ditambahkan"}),
            ),
            Err(e) => gagal(400, e),
        };
    }
    let paket_id = angka(&v, "paket_id");
    if paket_id.is_none() {
        return gagal(400, "Paket tidak ditemukan".into());
    }
    match sesi_service::tambah_waktu(
        &state,
        sesi_id,
        paket_id,
        angka(&v, "qty").unwrap_or(1),
        teks(&v, "metode_pembayaran"),
        &kasir.user.username,
        teks(&v, "client_request_id"),
    )
    .await
    {
        Ok((menit, hasil)) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Ditambahkan {menit} menit"),
                "tipe": hasil.get("tipe"),
                "waktu_baru": hasil.get("sisa_menit").cloned()
                    .or_else(|| hasil.get("waktu_tersimpan").cloned()),
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn pindah_pc(
    State(state): St,
    kasir: Kasir,
    Path(sesi_id): Path<i64>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    match sesi_service::pindah_pc(
        &state,
        sesi_id,
        teks(&v, "pc_kode_baru"),
        &kasir.user.username,
    )
    .await
    {
        Ok((lama, baru)) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("Sesi dipindah ke {baru}"),
                "pc_lama": lama,
                "pc_baru": baru,
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn tutup(State(state): St, kasir: Kasir, Path(sesi_id): Path<i64>) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    match sesi_service::tutup(&state, sesi_id, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Sesi berhasil ditutup"}),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn tutup_batch(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    let sesi_ids: Vec<i64> = v
        .get("sesi_ids")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default();
    if sesi_ids.is_empty() {
        return gagal(
            400,
            "Daftar sesi (sesi_ids) harus berupa array non-kosong".into(),
        );
    }
    let mut closed = Vec::new();
    let mut errors = Vec::new();
    for id in sesi_ids {
        match sesi_service::tutup(&state, id, &kasir.user.username).await {
            Ok(()) => closed.push(id),
            Err(e) => errors.push(json!({"sesi_id": id, "error": e})),
        }
    }
    let total_success = closed.len();
    let total_failed = errors.len();
    http::json(
        200,
        json!({
            "success": total_failed == 0,
            "closed_ids": closed,
            "errors": errors,
            "total_success": total_success,
            "total_failed": total_failed,
        }),
    )
}

pub async fn detail(State(state): St, _kasir: Kasir, Path(sesi_id): Path<i64>) -> Response {
    match sesi_service::detail(&state, sesi_id).await {
        Ok(v) => http::json(200, v),
        Err(e) => http::err(404, e),
    }
}

pub async fn riwayat_paket(State(state): St, _kasir: Kasir, Path(sesi_id): Path<i64>) -> Response {
    match sesi_service::riwayat_paket(&state, sesi_id).await {
        Ok(v) => http::json(200, v),
        Err(e) => http::err(400, e),
    }
}

pub async fn refund_paket(
    State(state): St,
    kasir: Kasir,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    if let Err(res) = shift_required(&state, &kasir).await {
        return res;
    }

    let v = http::parse_body(&headers, body).await;
    match sesi_service::refund_paket_guest(
        &state,
        angka(&v, "sesi_id").unwrap_or(0),
        angka(&v, "transaksi_id").unwrap_or(0),
        &kasir.user.username,
    )
    .await
    {
        Ok(hasil) => {
            let nama = hasil["nama_guest"].as_str().unwrap_or("Guest");
            let dikurangi = hasil["durasi_dikurangi"].as_i64().unwrap_or(0);
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("Refund berhasil: -{dikurangi} Menit | Guest {nama}."),
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

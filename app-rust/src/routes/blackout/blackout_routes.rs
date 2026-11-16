//! Audit & pemulihan sesi blackout (pasca mati lampu).

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::blackout::blackout_service;
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

fn gagal(status: u16, msg: String) -> Response {
    http::json(status, json!({"success": false, "error": msg}))
}

fn angka(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(|x| {
        x.as_i64()
            .or_else(|| x.as_str().and_then(|s| s.trim().parse::<i64>().ok()))
    })
}

pub async fn deteksi(State(state): St, kasir: Kasir, headers: HeaderMap, body: Bytes) -> Response {
    let v = http::parse_body(&headers, body).await;
    let threshold = angka(&v, "threshold_menit");
    if let Some(nilai) = threshold {
        if !(1..=1440).contains(&nilai) {
            return gagal(400, "Threshold blackout harus antara 1 sampai 1.440".into());
        }
    }
    match blackout_service::deteksi(&state, threshold).await {
        Ok(total) => http::json(
            200,
            json!({
                "success": true,
                "total": total,
                "message": if total > 0 {
                    format!("{total} sesi terdeteksi blackout")
                } else {
                    "Tidak ada sesi terdeteksi".to_string()
                },
                "operator": kasir.user.username,
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

pub async fn list(
    State(state): St,
    _kasir: Kasir,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    match blackout_service::audit_list(&state, q.get("date").map(String::as_str)).await {
        Ok(v) => http::json(200, v),
        Err(e) => gagal(400, e),
    }
}

pub async fn dates(State(state): St, _kasir: Kasir) -> Response {
    let daftar = blackout_service::audit_dates(&state).await;
    http::json(200, json!({"dates": daftar}))
}

pub async fn resolve_member(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    match blackout_service::resolve_member(&state, id, &kasir.user.username).await {
        Ok(hasil) => {
            let saldo = hasil["saldo_kembali"].as_i64().unwrap_or(0);
            let username = hasil["username"].as_str().unwrap_or("");
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("Saldo {saldo}m dikembalikan ke {username}"),
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

pub async fn resolve_guest_sama(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    match blackout_service::resolve_guest_sama(&state, id, &kasir.user.username).await {
        Ok(hasil) => {
            let nama = hasil["nama_guest"].as_str().unwrap_or("Guest");
            let pc = hasil["pc"].as_str().unwrap_or("-");
            let sisa = hasil["sisa_menit"].as_i64().unwrap_or(0);
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("Guest {nama} lanjut di PC {pc} ({sisa}m)"),
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

pub async fn resolve_guest_lanjut(
    State(state): St,
    kasir: Kasir,
    Path(id): Path<i64>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let v = http::parse_body(&headers, body).await;
    let pc_baru = angka(&v, "pc_baru_id");
    if pc_baru.is_none() {
        return gagal(400, "PC tujuan wajib diisi".into());
    }
    match blackout_service::resolve_guest_lanjut(&state, id, pc_baru, &kasir.user.username).await {
        Ok(hasil) => {
            let nama = hasil["nama_guest"].as_str().unwrap_or("Guest");
            let pc = hasil["pc_baru"].as_str().unwrap_or("-");
            let sisa = hasil["sisa_menit"].as_i64().unwrap_or(0);
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("Guest {nama} pindah ke {pc} ({sisa}m)"),
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

pub async fn resolve_tutup(State(state): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    match blackout_service::resolve_tutup(&state, id, &kasir.user.username).await {
        Ok(hasil) => {
            let target = hasil["target"].as_str().unwrap_or("-");
            http::json(
                200,
                json!({
                    "success": true,
                    "message": format!("Catatan blackout {target} ditutup"),
                }),
            )
        }
        Err(e) => gagal(400, e),
    }
}

pub async fn force_all(State(state): St, kasir: Kasir) -> Response {
    match blackout_service::force_all_and_detect(&state, &kasir.user.username).await {
        Ok((tutup, deteksi)) => http::json(
            200,
            json!({
                "success": true,
                "total_tutup": tutup,
                "total_deteksi": deteksi,
                "message": format!("{tutup} sesi ditutup, {deteksi} sesi masuk blackout"),
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

/// Gate `shift_required` menyusul Task 8 (shift service belum ada).
pub async fn clear(State(state): St, kasir: Kasir, headers: HeaderMap, body: Bytes) -> Response {
    if let Err(resp) = admin_only(&kasir) {
        return resp;
    }
    let v = http::parse_body(&headers, body).await;
    let date = v.get("date").and_then(Value::as_str);
    match blackout_service::clear_resolved(&state, date, &kasir.user.username).await {
        Ok((tanggal, jumlah)) => http::json(
            200,
            json!({
                "success": true,
                "message": format!("{jumlah} record audit pada {tanggal} telah dihapus"),
            }),
        ),
        Err(e) => gagal(400, e),
    }
}

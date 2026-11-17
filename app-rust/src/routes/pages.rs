//! Halaman HTML: dashboard kasir, dokumentasi, dan portal publik.
//! Portal publik memakai data server-render minimal (grup, paket, spek) yang
//! memang dipakai template; sisanya diambil JavaScript lewat API.

use std::sync::Arc;

use axum::extract::State;
use axum::response::{Html, IntoResponse, Redirect, Response};
use serde_json::{json, Value};

use crate::services::settings::settings_service as set;
use crate::state::AppState;
use crate::templates;

pub(crate) async fn dasar(st: &AppState) -> Value {
    let ambil = |kunci: &'static str, bawaan: &'static str| set::get_or(st, kunci, bawaan);
    json!({
        "warnet_title": ambil("warnet_title", "TMBilling").await,
        "warnet_address": ambil("warnet_address", "").await,
        "warnet_rules": ambil("warnet_announcement", "").await,
        "footer_label": ambil("warnet_title", "TMBilling").await,
        "gmaps_info": ambil("warnet_gmaps", "").await,
        "page_title": "TMBilling",
        "version": st.cfg.version,
        "v_cache": st.cfg.cache_version(),
    })
}

fn gagal_page(pesan: &str) -> Response {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        Html(pesan.to_string()),
    )
        .into_response()
}

pub(crate) fn halaman(nama: &str, ctx: Value, csrf: &str) -> Response {
    match templates::render_with(nama, minijinja::Value::from_serialize(&ctx), csrf) {
        Ok(html) => Html(html).into_response(),
        Err(e) => gagal_page(&format!("Render gagal: {e}")),
    }
}

fn gabung(ctx: &mut Value, tambahan: Value) {
    if let (Some(a), Some(b)) = (ctx.as_object_mut(), tambahan.as_object()) {
        a.extend(b.clone());
    }
}

async fn grup_json(st: &AppState) -> Value {
    let baris: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT nama, COALESCE(warna,'#888888'), COALESCE(keterangan,'') FROM grup WHERE aktif = 1 ORDER BY nama",
    )
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    Value::Array(
        baris
            .into_iter()
            .map(|(nama, warna, keterangan)| json!({"nama": nama, "warna": warna, "keterangan": keterangan}))
            .collect(),
    )
}

pub async fn landing(State(st): State<Arc<AppState>>) -> Response {
    let ctx = dasar(&st).await;
    halaman("public/landing/index.html", ctx, "")
}

pub async fn paket(State(st): State<Arc<AppState>>) -> Response {
    let mut ctx = dasar(&st).await;
    let grup = grup_json(&st).await;
    let paket: Vec<(String, i64, i64, i64, String)> = sqlx::query_as(
        "SELECT p.nama, p.durasi_menit, p.harga, p.kadaluarsa_hari, COALESCE(g.nama,'reguler')
         FROM paket p LEFT JOIN grup g ON g.id = p.grup_id
         WHERE p.aktif = 1 ORDER BY g.nama, p.harga",
    )
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let groups: Vec<Value> = grup
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|g| {
            let nama = g["nama"].as_str().unwrap_or("").to_string();
            let daftar: Vec<Value> = paket
                .iter()
                .filter(|p| p.4 == nama)
                .map(|p| {
                    json!({"nama": p.0, "durasi_menit": p.1, "harga": p.2, "kadaluarsa_hari": p.3})
                })
                .collect();
            let mut g = g;
            g["active_paket_list"] = Value::Array(daftar);
            g
        })
        .collect();
    gabung(&mut ctx, json!({"groups": groups}));
    halaman("public/paket/index.html", ctx, "")
}

pub async fn livepc(State(st): State<Arc<AppState>>) -> Response {
    let mut ctx = dasar(&st).await;
    gabung(&mut ctx, json!({"groups": grup_json(&st).await}));
    halaman("public/livepc/index.html", ctx, "")
}

pub async fn specs(State(st): State<Arc<AppState>>) -> Response {
    let mut ctx = dasar(&st).await;
    let grup = grup_json(&st).await;
    let pc: Vec<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT pc.kode, COALESCE(g.nama,'reguler'), COALESCE(h.cpu_name,'-'),
                COALESCE(h.gpu_name,'-'), COALESCE(h.total_ram,'-')
         FROM pc LEFT JOIN grup g ON g.id = pc.grup_id
         LEFT JOIN hardware_monitor h ON h.pc_id = pc.id
         WHERE pc.aktif = 1",
    )
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let groups: Vec<Value> = grup
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|g| {
            let nama = g["nama"].as_str().unwrap_or("").to_string();
            let daftar: Vec<Value> = pc
                .iter()
                .filter(|p| p.1 == nama)
                .map(|p| {
                    json!({
                        "kode": p.0,
                        "aktif": true,
                        "hardware": {"cpu_name": p.2, "gpu_name": p.3, "total_ram": p.4},
                    })
                })
                .collect();
            let mut g = g;
            g["pc_list"] = Value::Array(daftar.clone());
            g["sorted_pc_list"] = Value::Array(daftar);
            g
        })
        .collect();
    let katalog = serde_json::to_string(&groups).unwrap_or_else(|_| "[]".into());
    gabung(
        &mut ctx,
        json!({"groups": groups, "specs_catalog_json": katalog}),
    );
    halaman("public/specs/index.html", ctx, "")
}

pub async fn games(State(st): State<Arc<AppState>>) -> Response {
    let ctx = dasar(&st).await;
    halaman("public/game/index.html", ctx, "")
}

pub async fn tv(State(st): State<Arc<AppState>>) -> Response {
    let ctx = dasar(&st).await;
    halaman("public/tv/index.html", ctx, "")
}

pub async fn tv_static(State(st): State<Arc<AppState>>) -> Response {
    let ctx = dasar(&st).await;
    halaman("public/tv/static.html", ctx, "")
}

pub async fn member_login(
    State(st): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Response {
    let ctx = dasar(&st).await;
    halaman(
        "public/member/login.html",
        ctx,
        &crate::utils::http::cookie(&headers, "csrf_token").unwrap_or_default(),
    )
}

pub async fn member_dashboard() -> Response {
    Redirect::to("/member/login").into_response()
}

/// `/pc-status` publik: status meja tanpa membocorkan nama member.
pub async fn pc_status(State(st): State<Arc<AppState>>) -> Response {
    let baris: Vec<(String, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT pc.kode, COALESCE(g.nama,'reguler'), s.tipe, s.nama_guest
         FROM pc LEFT JOIN grup g ON g.id = pc.grup_id
         LEFT JOIN sesi s ON s.pc_id = pc.id AND s.status = 'aktif'
         WHERE pc.aktif = 1 ORDER BY pc.kode",
    )
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let pcs: Vec<Value> = baris
        .into_iter()
        .map(|(kode, grup, tipe, _)| {
            let terpakai = tipe.is_some();
            json!({
                "kode": kode,
                "grup": grup,
                "status": if terpakai { "terpakai" } else { "kosong" },
                "nama": if terpakai { "Member" } else { "" },
            })
        })
        .collect();
    crate::utils::http::json(200, json!({"success": true, "pcs": pcs}))
}

fn sesi_kasir(
    st: &AppState,
    headers: &axum::http::HeaderMap,
) -> Option<crate::middleware::auth::SessionData> {
    let raw = crate::utils::http::cookie(headers, "tm_session")?;
    crate::middleware::auth::decode(&st.cfg, &raw)
}

pub async fn kasir_index(
    State(st): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Response {
    let Some(sesi) = sesi_kasir(&st, &headers) else {
        return Redirect::to("/kasir/login").into_response();
    };
    let mut ctx = dasar(&st).await;
    gabung(
        &mut ctx,
        json!({
            "user_timezone": st.cfg.timezone,
            "user_timezone_label": crate::utils::time::tz_label(&st.cfg.timezone),
            "username": sesi.uname,
            "session": {
                "username": sesi.uname,
                "kasir_role": sesi.role,
                "user_id": sesi.uid,
            },
        }),
    );
    halaman(
        "kasir/index.html",
        ctx,
        &crate::utils::http::cookie(&headers, "csrf_token").unwrap_or_default(),
    )
}

pub async fn documentation(
    State(st): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> Response {
    let Some(sesi) = sesi_kasir(&st, &headers) else {
        return Redirect::to("/kasir/login").into_response();
    };
    let mut ctx = dasar(&st).await;
    gabung(&mut ctx, json!({"session": {"username": sesi.uname}}));
    halaman(
        "kasir/documentation.html",
        ctx,
        &crate::utils::http::cookie(&headers, "csrf_token").unwrap_or_default(),
    )
}

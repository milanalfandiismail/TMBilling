//! Halaman HTML: dashboard kasir, dokumentasi, dan portal publik.
//! Portal publik memakai data server-render minimal (grup, paket, spek) yang
//! memang dipakai template; sisanya diambil JavaScript lewat API.

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::HeaderMap;
use std::collections::HashMap;
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
        "v_cache": crate::assets::cache_version(),
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

/// Halaman HTML yang menerbitkan ulang cookie CSRF bila browser sudah membuangnya.
pub(crate) fn halaman_csrf(nama: &str, ctx: Value, headers: &HeaderMap) -> Response {
    let (token, cookie) = crate::middleware::csrf::ensure_cookie(headers);
    let mut res = halaman(nama, ctx, &token);
    if let Some(v) = cookie.and_then(|c| c.parse().ok()) {
        res.headers_mut()
            .append(axum::http::header::SET_COOKIE, v);
    }
    res
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
    let pc: Vec<(i64, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT pc.id, pc.kode, COALESCE(g.nama,'reguler'), COALESCE(g.warna,'#3b82f6'),
                COALESCE(h.cpu_name,'-'), COALESCE(h.gpu_name,'-'), COALESCE(h.total_ram,'-')
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
                .filter(|p| p.2 == nama)
                .map(|p| {
                    json!({
                        "kode": p.1,
                        "aktif": true,
                        "hardware": {"cpu_name": p.4, "gpu_name": p.5, "total_ram": p.6},
                    })
                })
                .collect();
            let mut g = g;
            g["pc_list"] = Value::Array(daftar.clone());
            g["sorted_pc_list"] = Value::Array(daftar);
            g
        })
        .collect();
    let mut katalog = serde_json::Map::new();
    for (id, kode, grup_nama, warna, cpu, gpu, ram) in &pc {
        katalog.insert(
            kode.clone(),
            json!({
                "kode": kode,
                "grup": {"nama": grup_nama, "warna": warna},
                "online": st.online.is_online(*id),
                "cpu": {"name": cpu, "cores": Value::Null},
                "gpu": {"name": gpu},
                "ram": {"total": ram, "sticks": []},
            }),
        );
    }
    let katalog = serde_json::to_string(&katalog).unwrap_or_else(|_| "{}".into());
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

pub async fn member_dashboard(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<HashMap<String, String>>,
) -> Response {
    let Some(mid) = crate::routes::public::member_portal::sesi(&st, &headers) else {
        return Redirect::to("/member/login").into_response();
    };
    let member: Option<(String, String, Option<String>, Option<String>, i64, Option<String>, String)> =
        sqlx::query_as(
            "SELECT m.username, m.nama_lengkap, m.email, m.no_hp, COALESCE(m.waktu_tersimpan,0),
                    m.kadaluarsa_pada, COALESCE(g.nama,'reguler')
             FROM member m LEFT JOIN grup g ON g.id = m.grup_id WHERE m.id = ?",
        )
        .bind(mid)
        .fetch_optional(&st.pool)
        .await
        .unwrap_or(None);
    let Some((username, nama, email, no_hp, menit, kadaluarsa, grup)) = member else {
        return Redirect::to("/member/login").into_response();
    };
    let halaman_ini = q.get("tx_page").and_then(|v| v.parse::<i64>().ok()).unwrap_or(1).max(1);
    let total_menit: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(MAX(0, CAST((julianday(COALESCE(selesai_pada, datetime('now','localtime'))) - julianday(mulai_pada)) * 1440 AS INTEGER) - COALESCE(menit_pause_total,0))),0)
         FROM sesi WHERE member_id = ?",
    )
    .bind(mid)
    .fetch_one(&st.pool)
    .await
    .unwrap_or(0);
    let total_spent: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(jumlah),0) FROM transaksi WHERE member_id = ? AND jumlah > 0 AND COALESCE(is_refunded,0) = 0",
    )
    .bind(mid)
    .fetch_one(&st.pool)
    .await
    .unwrap_or(0);
    let sesi: Vec<(Option<String>, String, String, i64)> = sqlx::query_as(
        "SELECT p.kode, s.mulai_pada, s.status,
                CAST(MAX(0, CAST((julianday(COALESCE(s.selesai_pada, datetime('now','localtime'))) - julianday(s.mulai_pada)) * 1440 AS INTEGER) - COALESCE(s.menit_pause_total,0)) AS INTEGER)
         FROM sesi s LEFT JOIN pc p ON p.id = s.pc_id
         WHERE s.member_id = ? ORDER BY s.mulai_pada DESC LIMIT 10",
    )
    .bind(mid)
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let total_tx: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transaksi WHERE member_id = ?")
        .bind(mid)
        .fetch_one(&st.pool)
        .await
        .unwrap_or(0);
    let pages = ((total_tx + 9) / 10).max(1);
    let page = halaman_ini.min(pages);
    let txs: Vec<(String, i64, Option<String>, String, i64, i64)> = sqlx::query_as(
        "SELECT jenis, jumlah, keterangan, COALESCE(dibuat_pada,''), COALESCE(is_refunded,0), COALESCE(menit,0)
         FROM transaksi WHERE member_id = ? ORDER BY dibuat_pada DESC, id DESC LIMIT 10 OFFSET ?",
    )
    .bind(mid)
    .bind((page - 1) * 10)
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let mut ctx = dasar(&st).await;
    gabung(&mut ctx, json!({
        "member": {
            "username": username, "nama_lengkap": nama, "email": email, "no_hp": no_hp,
            "waktu_tersimpan": menit, "kadaluarsa_pada": kadaluarsa, "aktif": true,
            "grup": {"nama": grup}
        },
        "total_play_hours": (total_menit as f64 / 60.0 * 10.0).round() / 10.0,
        "total_spent": total_spent,
        "sesi_history": sesi.into_iter().map(|(kode, mulai, status, m)| json!({
            "__menit_terpakai": m, "pc": {"kode": kode.unwrap_or_default()},
            "mulai_pada": mulai, "status": status
        })).collect::<Vec<_>>(),
        "transaksi_history": txs.into_iter().map(|(jenis, jumlah, ket, dibuat, refund, m)| json!({
            "jenis": jenis, "jumlah": jumlah, "keterangan": ket, "dibuat_pada": dibuat,
            "is_refunded": refund == 1, "menit": m,
            "___get_jenis_display": jenis_display(&jenis)
        })).collect::<Vec<_>>(),
        "tx_pagination": {
            "page": page, "pages": pages, "has_prev": page > 1, "has_prev_num": page - 1,
            "has_next": page < pages, "next_num": page + 1, "prev_num": page - 1
        }
    }));
    halaman(
        "public/member/dashboard.html",
        ctx,
        &crate::utils::http::cookie(&headers, "csrf_token").unwrap_or_default(),
    )
}

fn jenis_display(jenis: &str) -> String {
    match jenis {
        "beli_paket_guest" => "🎮 Guest Beli Paket",
        "beli_paket_member" => "👤 Member Beli Paket",
        "tambah_waktu_sesi" => "⏰ Member Tambah Waktu",
        "tambah_waktu_guest" => "⏱️ Guest Tambah Waktu",
        "tutup_sesi" => "🔒 Tutup Sesi",
        "pindah_pc" => "🔄 Pindah PC",
        "refund_paket" => "↩️ Refund Paket",
        lain => lain,
    }
    .to_string()
}

/// `/pc-status` publik: status meja tanpa membocorkan nama member.
pub async fn pc_status(State(st): State<Arc<AppState>>) -> Response {
    let baris: Vec<(String, String, Option<String>, Option<String>, Option<i64>, bool)> = sqlx::query_as(
        "SELECT pc.kode, COALESCE(g.nama,'reguler'), s.tipe, s.nama_guest,
                CASE WHEN s.mulai_pada IS NULL THEN NULL
                     ELSE MAX(0, s.durasi_beli_menit - CAST((strftime('%s','now') - strftime('%s', s.mulai_pada)) / 60 AS INTEGER))
                END,
                pc.is_admin_mode
         FROM pc LEFT JOIN grup g ON g.id = pc.grup_id
         LEFT JOIN sesi s ON s.pc_id = pc.id AND s.status = 'aktif'
         WHERE pc.aktif = 1 ORDER BY pc.kode",
    )
    .fetch_all(&st.pool)
    .await
    .unwrap_or_default();
    let pcs: Vec<Value> = baris
        .into_iter()
        .map(|(kode, grup, tipe, guest, sisa, admin)| {
            let ada_sesi = tipe.is_some();
            let terpakai = ada_sesi || admin;
            let nama = if admin {
                "Admin / Teknisi"
            } else if ada_sesi {
                if tipe.as_deref() == Some("member") { "Member" } else { guest.as_deref().unwrap_or("Guest") }
            } else {
                ""
            };
            let sisa_tampil = if admin {
                Some("ADMIN".to_string())
            } else {
                sisa.map(|m| if m >= 60 { format!("{}j {}m", m / 60, m % 60) } else { format!("{m}m") })
            };
            json!({
                "kode": kode,
                "grup": grup,
                "status": if terpakai { "terpakai" } else { "kosong" },
                "nama": nama,
                "sisa_waktu_display": sisa_tampil,
            })
        })
        .collect();
    crate::utils::http::json(200, json!(pcs))
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
    halaman_csrf("kasir/index.html", ctx, &headers)
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
    halaman_csrf("kasir/documentation.html", ctx, &headers)
}

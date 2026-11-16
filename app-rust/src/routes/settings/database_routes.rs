//! Backup manual, unduh DB, QRIS, token uninstall, statistik & purge.

use crate::middleware::auth::{admin_only, Kasir};
use crate::routes::client::client_routes::{kunci_sama, peer_ip};
use crate::services::backup::backup_service as svc;
use crate::services::settings::settings_service as settings;
use crate::state::AppState;
use crate::utils::http;
use axum::{
    body::Body,
    extract::{Multipart, State},
    http::{header, HeaderValue, StatusCode},
    response::Response,
};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn manual_backup(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    match svc::start_manual(st) {
        Ok(status) => http::json(
            202,
            json!({"success": true, "message": status["message"], "job": status}),
        ),
        Err((code, pesan)) => http::json(code, json!({"success": false, "error": pesan})),
    }
}

pub async fn download_db(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let tmp = st.cfg.root.join("instance").join("download_snapshot.db");
    if let Err(e) = svc::snapshot(&st.pool, &tmp).await {
        return http::json(500, json!({"error": e.to_string()}));
    }
    let bytes = std::fs::read(&tmp).unwrap_or_default();
    let _ = std::fs::remove_file(&tmp);
    let mut res = Response::new(Body::from(bytes));
    *res.status_mut() = StatusCode::OK;
    res.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/x-sqlite3"),
    );
    res.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("attachment; filename=\"warnet.db\""),
    );
    res
}

pub async fn upload_qris(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    mut form: Multipart,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let mut berkas: Option<(String, Vec<u8>)> = None;
    while let Ok(Some(field)) = form.next_field().await {
        if field.name() == Some("file") || field.file_name().is_some() {
            let name = field.file_name().unwrap_or("qris").to_string();
            if let Ok(bytes) = field.bytes().await {
                berkas = Some((name, bytes.to_vec()));
                break;
            }
        }
    }
    let (name, bytes) = match berkas {
        Some(v) if !v.0.is_empty() => v,
        _ => return http::json(400, json!({"error": "File QRIS wajib diunggah"})),
    };
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    if !["png", "jpg", "jpeg", "gif", "webp"].contains(&ext.as_str()) {
        return http::json(
            400,
            json!({"error": "Ekstensi file tidak diizinkan (Gunakan: png, jpg, jpeg, gif, webp)"}),
        );
    }
    let img = match image::load_from_memory(&bytes) {
        Ok(i) => i,
        Err(_) => return http::json(400, json!({"error": "File gambar tidak valid"})),
    };
    let img = if img.width() > 800 || img.height() > 800 {
        img.resize(800, 800, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };
    let folder = st.cfg.upload_dir.join("qris");
    let _ = std::fs::create_dir_all(&folder);
    let fname = format!("qris_{}.png", chrono::Local::now().timestamp());
    if let Err(e) = img.save(folder.join(&fname)) {
        return http::json(500, json!({"error": e.to_string()}));
    }
    let url = format!("/static/uploads/qris/{fname}");
    if let Err(e) = settings::set(&st, "qris_path", &url).await {
        return http::json(500, json!({"error": e.to_string()}));
    }
    http::json(
        200,
        json!({"success": true, "qris_url": url, "message": "QRIS berhasil diperbarui"}),
    )
}

pub async fn uninstall_token_client(
    State(st): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    connect: axum::extract::ConnectInfo<std::net::SocketAddr>,
) -> Response {
    let kunci = headers
        .get("x-client-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !kunci_sama(kunci, &settings::client_api_key(&st).await) {
        return http::err(
            401,
            "Akses ditolak. API Key tidak valid atau belum dikonfigurasi",
        );
    }
    let ip = peer_ip(&headers, connect.0);
    match crate::repositories::pc::find_by_ip(&st.pool, &ip).await {
        Ok(Some(_)) => http::json(
            200,
            json!({"success": true, "uninstall_token": settings::get_or_create_uninstall_token(&st).await}),
        ),
        _ => http::json(403, json!({"error": "Perangkat tidak terdaftar"})),
    }
}

pub async fn database_stats(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let ukuran = std::fs::metadata(&st.cfg.db_path)
        .map(|m| m.len())
        .unwrap_or(0);
    let mut hitung = serde_json::Map::new();
    for t in [
        "transaksi",
        "transaksi_menu",
        "sesi",
        "member",
        "pc",
        "menu_item",
    ] {
        let n: Option<(i64,)> = sqlx::query_as(&format!("SELECT COUNT(*) FROM \"{t}\""))
            .fetch_optional(&st.pool)
            .await
            .ok()
            .flatten();
        hitung.insert(t.to_string(), json!(n.map(|v| v.0).unwrap_or(0)));
    }
    http::json(
        200,
        json!({"success": true, "stats": {"db_size_bytes": ukuran, "db_size_human": format!("{:.2} MB", ukuran as f64 / 1_048_576.0), "rows": hitung}}),
    )
}

pub async fn purge_and_vacuum(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let bulan = data
        .get("retention_months")
        .and_then(|v| v.as_i64())
        .unwrap_or(6);
    if !(1..=120).contains(&bulan) {
        return http::json(
            400,
            json!({"success": false, "error": "Batas bulan retensi tidak valid."}),
        );
    }
    let _guard = st.write().await;
    let batas = (chrono::Utc::now() - chrono::Duration::days(bulan * 30))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let sebelum = std::fs::metadata(&st.cfg.db_path)
        .map(|m| m.len())
        .unwrap_or(0);
    if let Err(e) = svc::create(&st, false).await {
        return http::json(500, json!({"success": false, "error": e.to_string()}));
    }
    for sql in [
        format!("DELETE FROM transaksi_menu WHERE tanggal < '{batas}'"),
        format!("DELETE FROM transaksi WHERE tanggal < '{batas}'"),
        format!("DELETE FROM sesi WHERE status <> 'aktif' AND mulai_pada < '{batas}'"),
    ] {
        let _ = sqlx::raw_sql(&sql).execute(&st.pool).await;
    }
    let _ = sqlx::raw_sql("VACUUM").execute(&st.pool).await;
    let sesudah = std::fs::metadata(&st.cfg.db_path)
        .map(|m| m.len())
        .unwrap_or(0);
    crate::utils::logger::rec("admin", "DB_MAINTENANCE", &format!("Purge {bulan} bulan"));
    http::json(
        200,
        json!({
            "success": true,
            "message": "Pembersihan database dan optimasi VACUUM berhasil dieksekusi.",
            "storage_stats": {
                "before_bytes": sebelum,
                "after_bytes": sesudah,
                "saved_space_human": format!("{:.2} MB", sebelum.saturating_sub(sesudah) as f64 / 1_048_576.0),
            }
        }),
    )
}

pub fn _unused(_: Value) {}

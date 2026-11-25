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
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = st
        .cfg
        .root
        .join("instance")
        .join(format!("download_snapshot_{stamp}.db"));
    {
        let _guard = st.write().await;
        if let Err(e) = svc::snapshot(&st.pool, &tmp).await {
            return http::json(500, json!({"error": e.to_string()}));
        }
    }
    let bytes = tokio::fs::read(&tmp).await.unwrap_or_default();
    let _ = tokio::fs::remove_file(&tmp).await;
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
    let folder = st.cfg.upload_dir.join("qris");
    let fname = format!("qris_{}.png", chrono::Local::now().timestamp());
    let folder_clone = folder.clone();
    let fname_clone = fname.clone();
    let res = tokio::task::spawn_blocking(move || -> Result<(), (u16, &'static str)> {
        let img = match image::load_from_memory(&bytes) {
            Ok(i) => i,
            Err(_) => return Err((400, "File gambar tidak valid")),
        };
        if img.width() > 8000 || img.height() > 8000 {
            return Err((400, "Dimensi gambar terlalu besar (maksimal 8000x8000)"));
        }
        let img = if img.width() > 800 || img.height() > 800 {
            img.resize(800, 800, image::imageops::FilterType::Lanczos3)
        } else {
            img
        };
        let _ = std::fs::create_dir_all(&folder_clone);
        if img.save(folder_clone.join(&fname_clone)).is_err() {
            return Err((500, "Gagal menyimpan file QRIS"));
        }
        Ok(())
    })
    .await;

    match res {
        Ok(Ok(())) => {}
        Ok(Err((code, msg))) => return http::json(code, json!({"error": msg})),
        Err(e) => return http::json(500, json!({"error": e.to_string()})),
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

fn ukuran_manusia(b: u64) -> String {
    let mut v = b as f64;
    for u in ["B", "KB", "MB", "GB"] {
        if v < 1024.0 {
            return format!("{v:.2} {u}");
        }
        v /= 1024.0;
    }
    format!("{v:.2} TB")
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
    let daftar = [
        ("pc_process", "DELETE FROM pc_process WHERE last_update < ?"),
        ("pc_uptime_log", "DELETE FROM pc_uptime_log WHERE tanggal < ?"),
        ("maintenance_ticket", "DELETE FROM maintenance_ticket WHERE status IN ('SELESAI', 'DITOLAK') AND created_at < ?"),
        ("transaksi_menu", "DELETE FROM transaksi_menu WHERE tanggal < ?"),
        ("transaksi", "DELETE FROM transaksi WHERE dibuat_pada < ?"),
        ("sesi", "DELETE FROM sesi WHERE status = 'selesai' AND selesai_pada < ?"),
        ("shift_record", "DELETE FROM shift_record WHERE status = 'SELESAI' AND waktu_mulai < ?"),
    ];
    let mut tx = match st.pool.begin().await {
        Ok(tx) => tx,
        Err(e) => return http::json(500, json!({"success": false, "error": e.to_string()})),
    };
    let mut terhapus = serde_json::Map::new();
    for (nama, sql) in daftar {
        let n = match sqlx::query(sql).bind(&batas).execute(&mut *tx).await {
            Ok(r) => r.rows_affected(),
            Err(e) => return http::json(500, json!({"success": false, "error": e.to_string()})),
        };
        terhapus.insert(nama.to_string(), json!(n));
    }
    if let Err(e) = tx.commit().await {
        return http::json(500, json!({"success": false, "error": e.to_string()}));
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
            "retention_months": bulan,
            "cutoff_date": batas,
            "deleted_summary": terhapus,
            "storage_stats": {
                "initial_size_bytes": sebelum,
                "final_size_bytes": sesudah,
                "initial_size_human": ukuran_manusia(sebelum),
                "final_size_human": ukuran_manusia(sesudah),
                "saved_space_human": ukuran_manusia(sebelum.saturating_sub(sesudah)),
            }
        }),
    )
}

pub fn _unused(_: Value) {}

/// Status scheduler: bukti proses hidup, bukan detail job.
pub async fn scheduler_status(k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    http::json(
        200,
        json!({
            "success": true,
            "running": true,
            "tick_seconds": crate::scheduler::TICK_SECONDS,
        }),
    )
}

pub async fn scheduler_restart(k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    http::json(
        200,
        json!({"success": true, "message": "Scheduler berjalan dengan interval 60 detik"}),
    )
}

/// Flush delta uptime dari RAM ke `pc_uptime_log` tanpa menunggu tick berikutnya.
pub async fn uptime_flush(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let tz = settings::active_timezone(&st).await;
    let tanggal = crate::utils::time::today_local(&tz)
        .format("%Y-%m-%d")
        .to_string();
    let _guard = st.write().await;
    let delta: Vec<(i64, i64, i64)> = st
        .uptime
        .drain()
        .into_iter()
        .map(|(id, acc)| (id, acc.online, acc.billing))
        .collect();
    let jumlah = delta.len();
    match crate::repositories::uptime::flush(&st.pool, &tanggal, &delta).await {
        Ok(_) => http::json(
            200,
            json!({"success": true, "message": format!("{jumlah} PC di-flush ke log uptime")}),
        ),
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}

/// Simpan interval scheduler (detik) ke pengaturan.
pub async fn scheduler_update(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);

    // Bentuk lama (interval tick scheduler) tetap dilayani.
    if let Some(detik) = data
        .get("interval_seconds")
        .or_else(|| data.get("interval"))
        .and_then(|v| v.as_i64())
    {
        if !(5..=3600).contains(&detik) {
            return http::json(
                400,
                json!({"success": false, "error": "Interval harus antara 5 dan 3600 detik"}),
            );
        }
        return match crate::services::settings::settings_service::set(
            &st,
            "scheduler_interval_seconds",
            &detik.to_string(),
        )
        .await
        {
            Ok(_) => http::json(
                200,
                json!({"success": true, "message": format!("Interval scheduler diset {detik} detik")}),
            ),
            Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
        };
    }

    let angka = |kunci: &str| {
        data.get(kunci).and_then(|v| {
            v.as_i64()
                .or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()))
        })
    };
    let satuan = |kunci: &str| data.get(kunci).and_then(|v| v.as_str()).map(str::to_string);

    let Some(backup_value) = angka("backup_value") else {
        return http::json(400, json!({"success": false, "error": "backup_value dan backup_unit wajib diisi"}));
    };
    let Some(backup_unit) = satuan("backup_unit") else {
        return http::json(400, json!({"success": false, "error": "backup_value dan backup_unit wajib diisi"}));
    };
    let Some(cleanup_value) = angka("cleanup_value") else {
        return http::json(400, json!({"success": false, "error": "cleanup_value dan cleanup_unit wajib diisi"}));
    };
    let Some(cleanup_unit) = satuan("cleanup_unit") else {
        return http::json(400, json!({"success": false, "error": "cleanup_value dan cleanup_unit wajib diisi"}));
    };
    let Some(screenshot_value) = angka("screenshot_value") else {
        return http::json(400, json!({"success": false, "error": "screenshot_value dan screenshot_unit wajib diisi"}));
    };
    let Some(screenshot_unit) = satuan("screenshot_unit") else {
        return http::json(400, json!({"success": false, "error": "screenshot_value dan screenshot_unit wajib diisi"}));
    };
    let screenshot_enabled = data
        .get("screenshot_enabled")
        .map(|v| match v {
            serde_json::Value::Bool(b) => *b,
            serde_json::Value::String(s) => s == "1" || s.eq_ignore_ascii_case("true"),
            _ => false,
        })
        .unwrap_or(false);

    if backup_value < 1 || cleanup_value < 1 || screenshot_value < 1 {
        return http::json(400, json!({"success": false, "error": "Nilai interval minimal 1"}));
    }
    let unit_valid = ["detik", "menit", "jam", "hari", "minggu", "bulan"];
    for u in [&backup_unit, &cleanup_unit, &screenshot_unit] {
        if !unit_valid.contains(&u.as_str()) {
            return http::json(
                400,
                json!({"success": false, "error": format!("Unit tidak valid. Gunakan: {}", unit_valid.join(", "))}),
            );
        }
    }

    let pasangan = [
        ("auto_backup_value", backup_value.to_string()),
        ("auto_backup_unit", backup_unit),
        ("auto_cleanup_value", cleanup_value.to_string()),
        ("auto_cleanup_unit", cleanup_unit),
        ("screenshot_auto_enabled", if screenshot_enabled { "1".to_string() } else { "0".to_string() }),
        ("screenshot_auto_value", screenshot_value.to_string()),
        ("screenshot_auto_unit", screenshot_unit),
    ];
    for (kunci, nilai) in pasangan {
        if let Err(e) = crate::services::settings::settings_service::set(&st, kunci, &nilai).await {
            return http::json(500, json!({"success": false, "error": e.to_string()}));
        }
    }
    http::json(
        200,
        json!({"success": true, "message": "Konfigurasi scheduler berhasil disimpan"}),
    )
}

/// Unggah `.db`/ZIP Python 1.6.5 lalu kembalikan pratinjau selisih skema.
pub async fn import_preview(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    mut form: Multipart,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let mut bytes = None;
    while let Ok(Some(field)) = form.next_field().await {
        if field.name() == Some("file") || field.file_name().is_some() {
            if let Ok(data) = field.bytes().await {
                bytes = Some(data.to_vec());
                break;
            }
        }
    }
    let Some(bytes) = bytes.filter(|b| !b.is_empty()) else {
        return http::json(400, json!({"error": "Berkas database wajib diunggah"}));
    };
    let hasil = match crate::services::backup::python_import::stage(&st, &bytes) {
        Ok(staged) => match crate::services::backup::python_import::inspect(&staged.path).await {
            Ok(preview) => Ok(json!({"success": true, "token": staged.token, "preview": preview})),
            Err(e) => Err(e),
        },
        Err(e) => Err(e),
    };
    match hasil {
        Ok(body) => http::json(200, body),
        Err(e) => http::json(400, json!({"error": e.to_string()})),
    }
}

/// Timpa database aktif dengan berkas yang sudah dipratinjau.
pub async fn import_apply(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data: Value = serde_json::from_slice(&body).unwrap_or_else(|_| json!({}));
    let token = data.get("token").and_then(|v| v.as_str()).unwrap_or("");
    match crate::services::backup::python_import::apply(&st, token).await {
        Ok(result) => http::json(200, json!({"success": true, "result": result})),
        Err(e) => http::json(400, json!({"success": false, "error": e.to_string()})),
    }
}

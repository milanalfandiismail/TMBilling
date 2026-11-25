//! Handler pengelolaan paket biner pembaruan klien TMBilling (TMBilling.exe)

use axum::{
    body::Bytes,
    extract::{Multipart, State},
    response::Response,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

use crate::middleware::auth::{admin_only, Kasir};
use crate::repositories::pc as pc_repo;
use crate::repositories::sesi as sesi_repo;
use crate::state::AppState;
use crate::utils::{http, logger};

type St = State<Arc<AppState>>;

fn update_folder(state: &AppState) -> PathBuf {
    state.cfg.root.join("client-update")
}

fn update_exe_path(state: &AppState) -> PathBuf {
    update_folder(state).join("TMBilling.exe")
}

fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

async fn is_pc_in_system_mode(state: &Arc<AppState>, pc_id: i64, is_admin_mode: bool) -> bool {
    if !is_admin_mode {
        return false;
    }
    match sesi_repo::get_aktif_by_pc(&state.pool, pc_id).await {
        Ok(Some(s)) => {
            s.nama_guest
                .clone()
                .unwrap_or_default()
                .trim()
                .to_uppercase()
                == "SYSTEM"
        }
        _ => false,
    }
}

/// GET /api/v1/kasir/settings/client-update
/// Mendapatkan status dan metadata paket biner TMBilling.exe saat ini
pub async fn get_info(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }

    let folder = update_folder(&state);
    let _ = tokio::fs::create_dir_all(&folder).await;
    let path = update_exe_path(&state);

    if !path.exists() {
        return http::json(
            200,
            json!({
                "success": true,
                "exists": false,
                "filename": "TMBilling.exe",
                "file_size": 0,
                "file_size_formatted": "-",
                "sha256": Value::Null,
                "modified_at": Value::Null
            }),
        );
    }

    match tokio::fs::metadata(&path).await {
        Ok(meta) => {
            let size = meta.len();
            let modified = meta
                .modified()
                .ok()
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Local> = t.into();
                    dt.format("%Y-%m-%d %H:%M:%S").to_string()
                })
                .unwrap_or_else(|| "-".to_string());

            let sha256 = match tokio::fs::read(&path).await {
                Ok(bytes) => hex::encode(Sha256::digest(&bytes)),
                Err(_) => "-".to_string(),
            };

            http::json(
                200,
                json!({
                    "success": true,
                    "exists": true,
                    "filename": "TMBilling.exe",
                    "file_size": size,
                    "file_size_formatted": format_bytes(size),
                    "sha256": sha256,
                    "modified_at": modified
                }),
            )
        }
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}

/// POST /api/v1/kasir/settings/client-update/upload
/// Mengunggah biner TMBilling.exe baru via multipart/form-data
pub async fn upload_package(State(state): St, kasir: Kasir, mut form: Multipart) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }

    let folder = update_folder(&state);
    if let Err(e) = tokio::fs::create_dir_all(&folder).await {
        return http::json(
            500,
            json!({"success": false, "error": format!("Gagal membuat folder: {}", e)}),
        );
    }

    let tmp_path = folder.join("TMBilling.exe.upload.tmp");
    let final_path = update_exe_path(&state);

    let mut found_file = false;
    let mut total_bytes: u64 = 0;
    let mut hasher = Sha256::new();
    let mut header_bytes = Vec::with_capacity(2);

    loop {
        let mut field = match form.next_field().await {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(e) => {
                let _ = tokio::fs::remove_file(&tmp_path).await;
                let status = if e.status() == axum::http::StatusCode::PAYLOAD_TOO_LARGE {
                    413
                } else {
                    400
                };
                return http::json(
                    status,
                    json!({"success": false, "error": format!("Gagal membaca multipart form: {}", e.body_text())}),
                );
            }
        };

        let field_name = field.name().unwrap_or("").to_string();
        if field_name == "file" || field.file_name().is_some() {
            found_file = true;

            let mut out_file = match tokio::fs::File::create(&tmp_path).await {
                Ok(f) => f,
                Err(e) => {
                    return http::json(
                        500,
                        json!({"success": false, "error": format!("Gagal membuat file temporary: {}", e)}),
                    );
                }
            };

            loop {
                match field.chunk().await {
                    Ok(Some(chunk)) => {
                        if header_bytes.len() < 2 {
                            let take_len = (2 - header_bytes.len()).min(chunk.len());
                            header_bytes.extend_from_slice(&chunk[..take_len]);
                        }
                        hasher.update(&chunk);
                        total_bytes += chunk.len() as u64;
                        if let Err(e) = out_file.write_all(&chunk).await {
                            let _ = tokio::fs::remove_file(&tmp_path).await;
                            return http::json(
                                500,
                                json!({"success": false, "error": format!("Gagal menulis chunk: {}", e)}),
                            );
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        let _ = tokio::fs::remove_file(&tmp_path).await;
                        let status = if e.status() == axum::http::StatusCode::PAYLOAD_TOO_LARGE {
                            413
                        } else {
                            400
                        };
                        return http::json(
                            status,
                            json!({"success": false, "error": format!("Stream upload terputus: {}", e.body_text())}),
                        );
                    }
                }
            }

            let _ = out_file.flush().await;
            break;
        }
    }

    if !found_file || total_bytes == 0 {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return http::json(
            400,
            json!({"success": false, "error": "Berkas biner TMBilling.exe tidak ditemukan atau kosong"}),
        );
    }

    // Validasi magic bytes Windows PE (MZ = 0x4D, 0x5A)
    if header_bytes.len() < 2 || header_bytes[0] != 0x4D || header_bytes[1] != 0x5A {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return http::json(
            400,
            json!({"success": false, "error": "Berkas yang diunggah bukan biner executable Windows (.exe) yang valid"}),
        );
    }

    // Rename atomik berkas temporary menjadi TMBilling.exe
    if let Err(e) = tokio::fs::rename(&tmp_path, &final_path).await {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return http::json(
            500,
            json!({"success": false, "error": format!("Gagal memindahkan berkas paket: {}", e)}),
        );
    }

    let sha256 = hex::encode(hasher.finalize());
    let size_str = format_bytes(total_bytes);

    logger::rec(
        &kasir.user.username,
        "CLIENT_UPDATE_UPLOAD",
        &format!(
            "Upload paket update TMBilling.exe ({} | SHA256: {})",
            size_str, sha256
        ),
    );

    http::json(
        200,
        json!({
            "success": true,
            "message": "Paket update TMBilling.exe berhasil diunggah",
            "file_size": total_bytes,
            "file_size_formatted": size_str,
            "sha256": sha256
        }),
    )
}

/// DELETE /api/v1/kasir/settings/client-update
/// Menghapus berkas paket update biner dari server
pub async fn delete_package(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }

    let path = update_exe_path(&state);
    if path.exists() {
        if let Err(e) = tokio::fs::remove_file(&path).await {
            return http::json(
                500,
                json!({"success": false, "error": format!("Gagal menghapus file: {}", e)}),
            );
        }
    }

    logger::rec(
        &kasir.user.username,
        "CLIENT_UPDATE_DELETE",
        "Menghapus paket update biner TMBilling.exe dari server",
    );

    http::json(
        200,
        json!({"success": true, "message": "Paket update berhasil dihapus"}),
    )
}

/// POST /api/v1/kasir/settings/client-update/broadcast
/// Mengirimkan perintah update ke seluruh PC klien yang sedang aktif/online
pub async fn broadcast_update(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }

    let path = update_exe_path(&state);
    if !path.exists() {
        return http::json(
            400,
            json!({"success": false, "error": "Biner update TMBilling.exe belum diunggah ke server"}),
        );
    }

    let payload: Value = http::parse_json(&body);
    let target_ids: Option<Vec<i64>> = payload.get("pc_ids").and_then(|v| {
        v.as_array()
            .map(|arr| arr.iter().filter_map(|i| i.as_i64()).collect())
    });

    let pcs = match pc_repo::get_all(&state.pool, true, None, None).await {
        Ok(p) => p,
        Err(e) => return http::json(500, json!({"success": false, "error": e.to_string()})),
    };

    let mut queued = 0;
    for pc in pcs {
        if pc.is_admin_mode.unwrap_or(false) {
            continue;
        }
        if let Some(ref ids) = target_ids {
            if !ids.contains(&pc.id) {
                continue;
            }
        }
        if is_pc_in_system_mode(&state, pc.id, pc.is_admin_mode.unwrap_or(false)).await {
            continue;
        }

        state.commands.regular.push(pc.id, "update");
        queued += 1;
    }

    logger::rec(
        &kasir.user.username,
        "CLIENT_UPDATE_BROADCAST",
        &format!("Mengirim sinyal update massal ke {} PC klien", queued),
    );

    http::json(
        200,
        json!({
            "success": true,
            "message": format!("Perintah update berhasil diantrekan ke {} PC klien", queued),
            "queued_count": queued
        }),
    )
}

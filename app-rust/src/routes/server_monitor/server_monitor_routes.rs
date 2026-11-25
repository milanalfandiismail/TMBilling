//! Server Monitor: metrik dari LHM Service + kontrol prosesnya.

use axum::extract::State;
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::state::AppState;
use crate::utils::http;

type St = State<Arc<AppState>>;

fn lhm_path(st: &AppState) -> std::path::PathBuf {
    st.cfg.root.join("app").join("tmp").join("lhm_metrics.json")
}

fn offline() -> Value {
    json!({
        "error": "LHM Service Offline",
        "cpu": {"name": "LHM Offline (N/A)", "percent": 0, "cores": 0, "threads": 0, "freq_mhz": 0, "temp": "N/A"},
        "ram": {"percent": 0, "used": 0, "total": 0, "free": 0},
        "disk": [],
        "nic": [],
        "gpu": [{"name": "LHM Offline (N/A)", "load": 0, "mem_used_mb": 0, "mem_total_mb": 0, "temp_c": "N/A"}],
    })
}

pub async fn metrics(State(state): St, kasir: Kasir) -> Response {
    let _ = kasir;
    let path = lhm_path(&state);
    // JSON LHM lebih tua dari 5 detik dianggap offline.
    let data = tokio::fs::metadata(&path)
        .await
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.elapsed().ok())
        .filter(|umur| umur.as_secs() <= 5)
        .and_then(|_| {
            let p = path.clone();
            tokio::task::block_in_place(|| std::fs::read_to_string(p).ok())
        })
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or_else(offline);
    http::json(200, json!({"success": true, "data": data}))
}

pub async fn lhm_start(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let exe = state
        .cfg
        .root
        .join("app")
        .join("services")
        .join("server_monitor")
        .join("TMLHMService.exe");
    if !exe.exists() {
        return http::json(
            404,
            json!({"success": false, "error": format!("Executable TMLHMService.exe tidak ditemukan di {}!", exe.display())}),
        );
    }
    let script = format!(
        "Start-Process \"{}\" -Verb RunAs -WindowStyle Hidden",
        exe.display()
    );
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .spawn();
    http::json(
        200,
        json!({"success": true, "message": "Permintaan aktivasi LHM Service dikirim. Harap setujui prompt UAC di server."}),
    )
}

pub async fn lhm_stop(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let _ = tokio::process::Command::new("taskkill")
        .args(["/F", "/IM", "TMLHMService.exe"])
        .output()
        .await;
    let _ = tokio::fs::remove_file(lhm_path(&state)).await;
    http::json(
        200,
        json!({"success": true, "message": "LHM Service dimatikan."}),
    )
}

pub async fn lhm_status(State(_state): St, kasir: Kasir) -> Response {
    let _ = kasir;
    let out = tokio::process::Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq TMLHMService.exe"])
        .output()
        .await;
    let running = out
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("TMLHMService.exe"))
        .unwrap_or(false);
    http::json(200, json!({"success": true, "is_running": running}))
}

//! Pembacaan, pembersihan, dan ekspor audit log (file JSON lines).

use std::fs;
use std::io::Write;

use serde_json::{json, Value};

use crate::state::AppState;
use crate::utils::{logger, time};

const MAKS_BACA: usize = 5000;

fn jalur_log(st: &AppState) -> std::path::PathBuf {
    st.cfg.logs_dir.join("warnet.log")
}

fn kategori_cocok(kategori: &str, cat: &str, action: &str) -> bool {
    if kategori.is_empty() || kategori.eq_ignore_ascii_case("Semua") {
        return true;
    }
    let k = kategori.to_lowercase();
    let c = cat.to_uppercase();
    let a = action.to_uppercase();
    match k.as_str() {
        "transaksi" => c == "TRANSACTION" || c == "PAYMENT_BILLING",
        "sesi" => c == "SESI_BILLING",
        "blackout" => a.contains("BLACKOUT"),
        "sistem" => {
            c != "TRANSACTION"
                && c != "PAYMENT_BILLING"
                && c != "SESI_BILLING"
                && !a.contains("BLACKOUT")
        }
        _ => c == k.to_uppercase(),
    }
}

/// Ambil `limit` baris log terbaru yang cocok filter teks & kategori.
pub fn logs(st: &AppState, limit: usize, filter: &str, kategori: &str) -> Value {
    let isi = fs::read_to_string(jalur_log(st)).unwrap_or_default();
    let baris: Vec<&str> = isi.lines().collect();
    let mulai = baris.len().saturating_sub(MAKS_BACA.max(limit));
    let mut parsed: Vec<Value> = Vec::new();
    for line in &baris[mulai..] {
        if !filter.is_empty() && !line.to_lowercase().contains(&filter.to_lowercase()) {
            continue;
        }
        let data = serde_json::from_str::<Value>(line).ok();
        let ambil = |k: &str, d: &str| {
            data.as_ref()
                .and_then(|v| v.get(k))
                .and_then(|v| v.as_str())
                .unwrap_or(d)
                .to_string()
        };
        let action = ambil("action", "");
        let category = data
            .as_ref()
            .and_then(|v| v.get("category"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| logger::resolve_category(&action).to_string());
        if !kategori_cocok(kategori, &category, &action) {
            continue;
        }
        parsed.push(json!({
            "timestamp": ambil("timestamp", ""),
            "user": ambil("user", ""),
            "action": action,
            "detail": ambil("detail", ""),
            "category": category,
            "ip_address": ambil("ip_address", "-"),
            "browser_agent": ambil("browser_agent", "-"),
            "detail_json": data.as_ref().and_then(|v| v.get("detail_json")).cloned(),
            "raw": line,
        }));
        if parsed.len() >= limit {
            break;
        }
    }
    json!({ "logs": parsed, "total": parsed.len() })
}

/// Bersihkan log: arsipkan ke gzip lalu kosongkan berkas.
pub fn clear(st: &AppState, operator: &str, archive: bool) -> Value {
    let jalur = jalur_log(st);
    let total = fs::read_to_string(&jalur)
        .map(|s| s.lines().count())
        .unwrap_or(0);
    let arsip = if archive {
        logger::archive(20).ok().flatten()
    } else {
        None
    };
    if let Ok(mut f) = fs::File::create(&jalur) {
        let _ = f.flush();
    }
    logger::audit_json(
        operator,
        "CLEAR_LOG",
        &format!("Log sistem dibersihkan ({total} baris diarsipkan)"),
        None,
        "-",
        "-",
        json!({
            "total_dibersihkan": total,
            "diarsipkan": arsip.is_some(),
            "lokasi_arsip": arsip.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "-".into()),
        }),
    );
    json!({
        "success": true,
        "total_dibersihkan": total,
        "archive_path": arsip.map(|p| p.display().to_string()),
    })
}

/// Isi teks seluruh log untuk diekspor, plus cap waktu nama berkas.
pub fn export(st: &AppState, filter: &str) -> (String, String) {
    let isi = fs::read_to_string(jalur_log(st)).unwrap_or_default();
    let teks = if filter.is_empty() {
        isi
    } else {
        isi.lines()
            .filter(|l| l.to_lowercase().contains(&filter.to_lowercase()))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let cap = time::now_local(&st.cfg.timezone)
        .format("%Y%m%d_%H%M%S")
        .to_string();
    (teks, cap)
}

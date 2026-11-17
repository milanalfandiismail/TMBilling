//! Payload billboard TV publik.

use serde_json::{json, Value};

use crate::repositories::tournament as turnamen_repo;
use crate::services::{
    dashboard::dashboard_service, menu::menu_service, paket::paket_service, settings::settings_service,
    tournament::tournament_service,
};
use crate::state::AppState;

fn tz_abbr(zona: &str) -> &'static str {
    if zona.contains("Makassar") {
        "WITA"
    } else if zona.contains("Jayapura") {
        "WIT"
    } else if zona.contains("Singapore") || zona.contains("Hong_Kong") {
        "SGT"
    } else {
        "WIB"
    }
}

pub async fn live_data(st: &AppState) -> Value {
    let dasar = dashboard_service::pc_list(st).await;
    let pcs = dasar
        .get("pc_list")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let total = pcs.len() as i64;
    let aktif = pcs
        .iter()
        .filter(|p| p.get("status").and_then(|v| v.as_str()) == Some("terpakai"))
        .count() as i64;

    let running_text = settings_service::get_or(
        st,
        "tv_running_text",
        "Selamat datang di TMBilling! Selamat bermain dan jaga ketertiban.",
    )
    .await;
    let slide: i64 = settings_service::get_or(st, "tv_slide_duration", "15")
        .await
        .parse()
        .unwrap_or(15);
    let slides = settings_service::get_or(st, "tv_slides_enabled", "1,2,3,4").await;
    let judul = settings_service::get_or(st, "warnet_title", "TMBilling").await;
    let aturan_html = settings_service::get_or(st, "warnet_announcement", "").await;
    // Aturan HTML utuh dipakai apa adanya; daftar baris hanya untuk teks polos.
    let aturan: Vec<String> = if aturan_html.contains('<') {
        Vec::new()
    } else {
        aturan_html
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect()
    };
    let mut menu = menu_service::get_all(st).await.unwrap_or_default();
    menu.retain(|m| m.is_active);
    menu.sort_by(|a, b| a.nama.cmp(&b.nama));
    let mut promos = paket_service::get_all(st, true, None, None)
        .await
        .unwrap_or_default();
    promos.sort_by_key(|p| p.harga);
    let turnamen = turnamen_live(st).await;

    json!({
        "occupancy": {
            "total_pc": total,
            "pc_aktif": aktif,
            "pc_kosong": total - aktif,
            "utilisasi": if total > 0 { (aktif * 100) / total } else { 0 },
        },
        "pc_list": pcs,
        "by_grup": dasar.get("by_grup").cloned().unwrap_or(json!({})),
        "grup_meta": dasar.get("grup_meta").cloned().unwrap_or(json!({})),
        "tournament": turnamen,
        "promos": promos.iter().map(|p| p.to_json()).collect::<Vec<_>>(),
        "settings": {
            "running_text": running_text,
            "slide_duration": slide,
            "slides_enabled": slides.split(',').map(|s| s.trim().parse::<i64>().unwrap_or(0)).filter(|n| *n > 0).collect::<Vec<_>>(),
            "warnet_rules": aturan,
            "warnet_rules_html": aturan_html,
            "timezone_abbr": tz_abbr(&st.cfg.timezone),
            "warnet_title": judul,
        },
        "menu_items": menu.iter().map(|m| m.to_json()).collect::<Vec<_>>(),
    })
}

/// Turnamen aktif + tahap aktif + klasemen swiss, bentuk sama dengan Python `TVSignageService`.
async fn turnamen_live(st: &AppState) -> Value {
    let tz = &st.cfg.timezone;
    let daftar = match turnamen_repo::get_all(&st.pool).await {
        Ok(v) => v,
        Err(_) => return Value::Null,
    };
    let Some(t) = daftar
        .into_iter()
        .find(|t| t.status.as_deref() == Some("aktif"))
    else {
        return Value::Null;
    };
    let stages = turnamen_repo::stages(&st.pool, t.id).await.unwrap_or_default();
    let tim = turnamen_repo::teams(&st.pool, t.id).await.unwrap_or_default();
    let nama = turnamen_repo::nama_tim(&st.pool, t.id).await.unwrap_or_default();
    let (active_stage, matches, standings) = {
        let aktif = stages
            .iter()
            .find(|s| s.status.as_deref() == Some("aktif"))
            .or_else(|| stages.first());
        let (mut matches, mut standings) = (Vec::new(), Vec::new());
        if let Some(s) = aktif {
            matches = turnamen_repo::matches_of_stage(&st.pool, s.id)
                .await
                .unwrap_or_default()
                .iter()
                .map(|m| m.to_json(&nama))
                .collect();
            if s.tipe_format == "swiss" {
                standings = tournament_service::standings(&st.pool, s.id)
                    .await
                    .unwrap_or_default();
            }
        }
        (aktif.map(|s| s.to_json(tz)), matches, standings)
    };
    json!({
        "tournament": t.to_json(stages, tim.len(), tz),
        "active_stage": active_stage,
        "standings": standings,
        "matches": matches,
    })
}

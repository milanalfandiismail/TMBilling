//! Payload billboard TV publik.

use serde_json::{json, Value};

use crate::services::{
    dashboard::dashboard_service, menu::menu_service, settings::settings_service,
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
    let aturan_html = settings_service::get_or(st, "warnet_rules", "").await;
    let aturan: Vec<String> = aturan_html
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    let menu = menu_service::get_all(st).await.unwrap_or_default();

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
        // shortcut: turnamen & promo billboard belum diport, null sampai Task 15.
        "tournament": Value::Null,
        "promos": json!([]),
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

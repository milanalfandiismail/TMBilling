//! Laporan uptime PC (harian & rentang) — admin.

use axum::extract::{Query, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::repositories::uptime;
use crate::state::AppState;
use crate::utils::{http, time};

type St = State<Arc<AppState>>;

#[derive(Deserialize)]
pub struct DailyQuery {
    pub date: Option<String>,
}

#[derive(Deserialize)]
pub struct RangeQuery {
    pub start: Option<String>,
    pub end: Option<String>,
}

pub async fn daily(State(state): St, kasir: Kasir, Query(q): Query<DailyQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let tanggal = match q.date.filter(|d| !d.is_empty()) {
        Some(d) => match chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => {
                return http::json(
                    400,
                    json!({"success": false, "error": "Format tanggal salah. Gunakan YYYY-MM-DD"}),
                )
            }
        },
        None => {
            let tz = crate::services::settings::settings_service::active_timezone(&state).await;
            time::today_local(&tz)
        }
    };
    let rows = uptime::daily(&state.pool, &tanggal.format("%Y-%m-%d").to_string())
        .await
        .unwrap_or_default();
    let tz = crate::services::settings::settings_service::active_timezone(&state).await;
    let mut data: Vec<serde_json::Value> = rows
        .iter()
        .map(|b| uptime::daily_json(b, &tz))
        .collect();
    data.sort_by(|a, b| {
        let ka = a.get("pc_kode").and_then(|v| v.as_str()).unwrap_or("");
        let kb = b.get("pc_kode").and_then(|v| v.as_str()).unwrap_or("");
        crate::utils::helpers::natural_sort_key(ka)
            .cmp(&crate::utils::helpers::natural_sort_key(kb))
    });
    http::json(
        200,
        json!({"success": true, "date": tanggal.format("%Y-%m-%d").to_string(), "report": data}),
    )
}

pub async fn range(State(state): St, kasir: Kasir, Query(q): Query<RangeQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let (start, end) = match (q.start.as_deref(), q.end.as_deref()) {
        (Some(s), Some(e)) if !s.is_empty() && !e.is_empty() => (s, e),
        _ => {
            return http::json(
                400,
                json!({"success": false, "error": "Parameter 'start' dan 'end' wajib diisi"}),
            )
        }
    };
    let (sd, ed) = match (
        chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d"),
        chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d"),
    ) {
        (Ok(a), Ok(b)) => (a, b),
        _ => {
            return http::json(
                400,
                json!({"success": false, "error": "Format tanggal salah. Gunakan YYYY-MM-DD"}),
            )
        }
    };
    if sd > ed {
        return http::json(
            400,
            json!({"success": false, "error": "Tanggal mulai tidak boleh melebihi tanggal akhir"}),
        );
    }
    if (ed - sd).num_days() + 1 > 366 {
        return http::json(
            400,
            json!({"success": false, "error": "Rentang tanggal maksimal 366 hari"}),
        );
    }
    let rows = uptime::range(&state.pool, start, end)
        .await
        .unwrap_or_default();
    http::json(200, uptime::range_json(&rows))
}

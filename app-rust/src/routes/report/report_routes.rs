//! Laporan keuangan, struk, audit log, dan ekspor PDF.

use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::services::report::{log_audit, pdf, report_service as rep};
use crate::state::AppState;
use crate::utils::{http, time};

type St = State<Arc<AppState>>;

#[derive(Deserialize)]
pub struct LaporanQuery {
    pub tanggal: Option<String>,
    pub kasir_id: Option<i64>,
    pub metode_pembayaran: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub q: Option<String>,
}

#[derive(Deserialize)]
pub struct LogQuery {
    pub filter: Option<String>,
    pub kategori: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct ClearBody {
    pub archive: Option<bool>,
}

fn salah(e: rep::Salah) -> Response {
    http::json(e.status, json!({"error": e.pesan}))
}

fn kasir_filter(kasir: &Kasir, diminta: Option<i64>) -> Option<i64> {
    if kasir.user.role.as_deref() == Some("kasir") {
        Some(kasir.user.id)
    } else {
        diminta
    }
}

fn pdf_response(bytes: Vec<u8>, filename: &str) -> Response {
    if bytes.is_empty() {
        return http::json(500, json!({"error": "Gagal membuat PDF"}));
    }
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/pdf".to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment;filename={filename}"),
            ),
        ],
        bytes,
    )
        .into_response()
}

pub async fn laporan(State(st): St, kasir: Kasir, Query(q): Query<LaporanQuery>) -> Response {
    match rep::billing(
        &st,
        q.tanggal.as_deref(),
        kasir_filter(&kasir, q.kasir_id),
        q.page,
        q.per_page,
        q.metode_pembayaran.as_deref().filter(|m| !m.is_empty()),
        q.q.as_deref().filter(|s| !s.is_empty()),
    )
    .await
    {
        Ok(v) => http::json(200, v),
        Err(e) => salah(e),
    }
}

pub async fn laporan_kantin(
    State(st): St,
    kasir: Kasir,
    Query(q): Query<LaporanQuery>,
) -> Response {
    match rep::kantin(
        &st,
        q.tanggal.as_deref(),
        kasir_filter(&kasir, q.kasir_id),
        q.page,
        q.per_page,
        q.metode_pembayaran.as_deref().filter(|m| !m.is_empty()),
        q.q.as_deref().filter(|s| !s.is_empty()),
    )
    .await
    {
        Ok(v) => http::json(200, v),
        Err(e) => salah(e),
    }
}

pub async fn laporan_harian(State(st): St, kasir: Kasir) -> Response {
    let kasir_id = if kasir.user.role.as_deref() == Some("kasir") {
        Some(kasir.user.id)
    } else {
        None
    };
    match rep::harian(&st, kasir_id).await {
        Ok(v) => http::json(200, v),
        Err(e) => salah(e),
    }
}

pub async fn tanggal_list(State(st): St, _kasir: Kasir) -> Response {
    match rep::tanggal_list(&st).await {
        Ok(v) => http::json(200, v),
        Err(e) => salah(e),
    }
}

pub async fn kasir_list(State(st): St, kasir: Kasir) -> Response {
    match rep::kasir_list(
        &st,
        kasir.user.id,
        kasir.user.role.as_deref().unwrap_or("kasir"),
    )
    .await
    {
        Ok(v) => http::json(200, v),
        Err(e) => salah(e),
    }
}

pub async fn struk(State(st): St, kasir: Kasir, Path(identifier): Path<String>) -> Response {
    match rep::struk(&st, &identifier).await {
        Ok(v) => {
            let milik = v.get("kasir_id").and_then(|x| x.as_i64());
            if kasir.user.role.as_deref() != Some("admin") && milik != Some(kasir.user.id) {
                return http::json(403, json!({"error": "Struk ini milik kasir lain"}));
            }
            http::json(200, v)
        }
        Err(e) => salah(e),
    }
}

pub async fn struk_menu(State(st): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    match rep::struk_menu(&st, id).await {
        Ok(v) => {
            let milik = v.get("kasir_id").and_then(|x| x.as_i64());
            if kasir.user.role.as_deref() != Some("admin") && milik != Some(kasir.user.id) {
                return http::json(403, json!({"error": "Struk ini milik kasir lain"}));
            }
            http::json(200, v)
        }
        Err(e) => salah(e),
    }
}

pub async fn get_logs(State(st): St, kasir: Kasir, Query(q): Query<LogQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let limit = q.limit.unwrap_or(500).clamp(1, 5000);
    http::json(
        200,
        log_audit::logs(
            &st,
            limit,
            q.filter.as_deref().unwrap_or(""),
            q.kategori.as_deref().unwrap_or(""),
        ),
    )
}

pub async fn clear_logs(
    State(st): St,
    kasir: Kasir,
    body: Option<axum::Json<ClearBody>>,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let archive = body.and_then(|b| b.0.archive).unwrap_or(true);
    let hasil = log_audit::clear(&st, &kasir.user.username, archive);
    let total = hasil
        .get("total_dibersihkan")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    http::json(
        200,
        json!({
            "success": true,
            "message": format!("Log berhasil dibersihkan ({total} baris)"),
            "data": hasil,
        }),
    )
}

pub async fn clear_transactions(State(st): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    match rep::clear_all_transactions(&st, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": "Seluruh riwayat transaksi berhasil dikosongkan"}),
        ),
        Err(e) => salah(e),
    }
}

pub async fn delete_transaction(State(st): St, kasir: Kasir, Path(id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    match rep::delete_transaction(&st, id, &kasir.user.username).await {
        Ok(true) => http::json(
            200,
            json!({"success": true, "message": "Struk berhasil dihapus"}),
        ),
        Ok(false) => http::json(404, json!({"error": "Struk tidak ditemukan"})),
        Err(e) => salah(e),
    }
}

pub async fn clear_date_transactions(
    State(st): St,
    kasir: Kasir,
    Path(tanggal): Path<String>,
) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    match rep::clear_transactions_by_date(&st, &tanggal, &kasir.user.username).await {
        Ok(()) => http::json(
            200,
            json!({"success": true, "message": format!("Transaksi tanggal {tanggal} berhasil dihapus")}),
        ),
        Err(e) => salah(e),
    }
}

pub async fn export_logs(State(st): St, kasir: Kasir, Query(q): Query<LogQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let (teks, cap) = log_audit::export(&st, q.filter.as_deref().unwrap_or(""));
    (
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                "text/plain; charset=utf-8".to_string(),
            ),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment;filename=warnet_log_{cap}.txt"),
            ),
        ],
        teks,
    )
        .into_response()
}

pub async fn blackout_log(State(st): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let blackout = log_audit::logs(&st, 200, "BLACKOUT", "");
    let restart = log_audit::logs(&st, 10, "SERVER_RESTART", "");
    http::json(
        200,
        json!({
            "blackout_logs": blackout.get("logs").cloned().unwrap_or_else(|| json!([])),
            "restart_logs": restart.get("logs").cloned().unwrap_or_else(|| json!([])),
        }),
    )
}

fn baris_billing(v: &serde_json::Value) -> Vec<String> {
    let mut out = vec![
        format!(
            "Total Pendapatan : Rp {}",
            rapi(
                v.get("total_pendapatan")
                    .and_then(|x| x.as_i64())
                    .unwrap_or(0)
            )
        ),
        format!(
            "Billing          : Rp {}",
            rapi(v.get("total_billing").and_then(|x| x.as_i64()).unwrap_or(0))
        ),
        format!(
            "Kantin           : Rp {}",
            rapi(v.get("total_kantin").and_then(|x| x.as_i64()).unwrap_or(0))
        ),
        format!(
            "Refund           : Rp {}",
            rapi(v.get("total_refund").and_then(|x| x.as_i64()).unwrap_or(0))
        ),
        String::new(),
        "Rincian Transaksi".into(),
    ];
    if let Some(rows) = v.get("data").and_then(|d| d.as_array()) {
        for r in rows {
            out.push(format!(
                "{} | {} | {} | Rp {} | {}",
                r.get("no_nota").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("tanggal").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("keterangan").and_then(|x| x.as_str()).unwrap_or("-"),
                rapi(r.get("jumlah").and_then(|x| x.as_i64()).unwrap_or(0)),
                r.get("metode_pembayaran")
                    .and_then(|x| x.as_str())
                    .unwrap_or("Tunai"),
            ));
        }
    }
    out
}

fn rapi(n: i64) -> String {
    let neg = n < 0;
    let s = n.abs().to_string();
    let mut out = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            out.push('.');
        }
        out.push(c);
    }
    let hasil: String = out.chars().rev().collect();
    if neg {
        format!("-{hasil}")
    } else {
        hasil
    }
}

pub async fn export_billing(
    State(st): St,
    kasir: Kasir,
    Query(q): Query<LaporanQuery>,
) -> Response {
    let data = match rep::billing(
        &st,
        q.tanggal.as_deref(),
        kasir_filter(&kasir, q.kasir_id),
        Some(1),
        Some(100),
        q.metode_pembayaran.as_deref().filter(|m| !m.is_empty()),
        None,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return salah(e),
    };
    let judul = format!(
        "Laporan Billing {}",
        data.get("tanggal").and_then(|x| x.as_str()).unwrap_or("-")
    );
    let bytes = pdf::render(&judul, "TMBilling", &baris_billing(&data));
    let cap = time::now_local(&st.cfg.timezone)
        .format("%Y%m%d_%H%M%S")
        .to_string();
    pdf_response(bytes, &format!("laporan_billing_{cap}.pdf"))
}

pub async fn export_kantin(State(st): St, kasir: Kasir, Query(q): Query<LaporanQuery>) -> Response {
    let data = match rep::kantin(
        &st,
        q.tanggal.as_deref(),
        kasir_filter(&kasir, q.kasir_id),
        Some(1),
        Some(100),
        q.metode_pembayaran.as_deref().filter(|m| !m.is_empty()),
        None,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return salah(e),
    };
    let mut baris = vec![
        format!(
            "Total Pemasukan Kantin : Rp {}",
            rapi(
                data.get("total_pendapatan")
                    .and_then(|x| x.as_i64())
                    .unwrap_or(0)
            )
        ),
        String::new(),
        "Rincian Pesanan".into(),
    ];
    if let Some(rows) = data.get("data").and_then(|d| d.as_array()) {
        for r in rows {
            baris.push(format!(
                "{} | {} | PC {} | Rp {}",
                r.get("no_nota").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("tanggal").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("pc_kode").and_then(|x| x.as_str()).unwrap_or("-"),
                rapi(r.get("total").and_then(|x| x.as_i64()).unwrap_or(0)),
            ));
        }
    }
    let judul = format!(
        "Laporan Kantin {}",
        data.get("tanggal").and_then(|x| x.as_str()).unwrap_or("-")
    );
    let bytes = pdf::render(&judul, "TMBilling", &baris);
    let cap = time::now_local(&st.cfg.timezone)
        .format("%Y%m%d_%H%M%S")
        .to_string();
    pdf_response(bytes, &format!("laporan_kantin_{cap}.pdf"))
}

pub async fn export_pnl(State(st): St, kasir: Kasir, Query(q): Query<LaporanQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let data = match rep::billing(
        &st,
        q.tanggal.as_deref(),
        None,
        Some(1),
        Some(100),
        None,
        None,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return salah(e),
    };
    let bill = data
        .get("total_billing")
        .and_then(|x| x.as_i64())
        .unwrap_or(0);
    let kantin = data
        .get("total_kantin")
        .and_then(|x| x.as_i64())
        .unwrap_or(0);
    let baris = vec![
        format!("Pendapatan Billing : Rp {}", rapi(bill)),
        format!("Pendapatan Kantin  : Rp {}", rapi(kantin)),
        format!("Total Pendapatan   : Rp {}", rapi(bill + kantin)),
        format!(
            "Refund             : Rp {}",
            rapi(
                data.get("total_refund")
                    .and_then(|x| x.as_i64())
                    .unwrap_or(0)
            )
        ),
    ];
    let judul = format!(
        "Laporan Laba Rugi {}",
        data.get("tanggal").and_then(|x| x.as_str()).unwrap_or("-")
    );
    let bytes = pdf::render(&judul, "TMBilling", &baris);
    let cap = time::now_local(&st.cfg.timezone)
        .format("%Y%m%d_%H%M%S")
        .to_string();
    pdf_response(bytes, &format!("laporan_pnl_{cap}.pdf"))
}

pub async fn export_audit_pdf(State(st): St, kasir: Kasir, Query(q): Query<LogQuery>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let data = log_audit::logs(&st, 500, q.filter.as_deref().unwrap_or(""), "");
    let mut baris = Vec::new();
    if let Some(rows) = data.get("logs").and_then(|d| d.as_array()) {
        for r in rows {
            baris.push(format!(
                "{} | {} | {} | {}",
                r.get("timestamp").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("user").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("action").and_then(|x| x.as_str()).unwrap_or("-"),
                r.get("detail").and_then(|x| x.as_str()).unwrap_or(""),
            ));
        }
    }
    let bytes = pdf::render("Audit Log Sistem", "TMBilling", &baris);
    let cap = time::now_local(&st.cfg.timezone)
        .format("%Y%m%d_%H%M%S")
        .to_string();
    pdf_response(bytes, &format!("audit_log_{cap}.pdf"))
}

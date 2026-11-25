//! Render template Jinja (minijinja) yang di-embed, dengan global `url_for`.

use crate::assets::TemplateAssets;
use anyhow::Result;
use minijinja::{Environment, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::OnceLock;

thread_local! {
    /// Token CSRF milik request yang sedang dirender (dipakai `{{ csrf_token() }}`).
    static CSRF: RefCell<String> = const { RefCell::new(String::new()) };
}

fn env() -> &'static Environment<'static> {
    static ENV: OnceLock<Environment<'static>> = OnceLock::new();
    ENV.get_or_init(|| {
        let mut env = Environment::new();
        env.set_loader(|name: &str| {
            Ok(TemplateAssets::get(name).map(|f| String::from_utf8_lossy(&f.data).to_string()))
        });
        // Jinja memakai `mapping.get(kunci, bawaan)`; minijinja tidak punya method itu.
        env.set_unknown_method_callback(|_st, value, method, args| {
            if method == "get" && value.kind() == minijinja::value::ValueKind::Map {
                let key = args.first().cloned().unwrap_or_default();
                let bawaan = args.get(1).cloned().unwrap_or_default();
                let v = value.get_item(&key)?;
                return Ok(if v.is_undefined() { bawaan } else { v });
            }
            // Jinja memakai method str bawaan Python; minijinja tidak punya.
            // shortcut: hanya "{:,}" dan "{}" yang dipakai template, perluas bila ada spec lain.
            if method == "format" {
                if let Some(t) = value.as_str() {
                    let mut hasil = String::new();
                    let mut sisa = t;
                    for (i, arg) in args.iter().enumerate() {
                        let _ = i;
                        if let Some(pos) = sisa.find("{:,}").or_else(|| sisa.find("{}")) {
                            let ribuan = sisa[pos..].starts_with("{:,}");
                            hasil.push_str(&sisa[..pos]);
                            let angka = arg.to_string();
                            if ribuan {
                                hasil.push_str(&pisah_ribuan(&angka));
                            } else {
                                hasil.push_str(&angka);
                            }
                            sisa = &sisa[pos + if ribuan { 4 } else { 2 }..];
                        }
                    }
                    hasil.push_str(sisa);
                    return Ok(Value::from(hasil));
                }
            }
            // Method ORM Python (mis. `s.menit_terpakai()`) dipetakan ke kunci tersembunyi `__nama`.
            if let Ok(v) = value.get_attr(&format!("__{method}")) {
                if !v.is_undefined() {
                    return Ok(v);
                }
            }
            if let Some(t) = value.as_str() {
                let hasil = match method {
                    "lower" => t.to_lowercase(),
                    "upper" => t.to_uppercase(),
                    "strip" => t.trim().to_string(),
                    "replace" => {
                        let dari = args.first().map(|a| a.to_string()).unwrap_or_default();
                        let ke = args.get(1).map(|a| a.to_string()).unwrap_or_default();
                        t.replace(&dari, &ke)
                    }
                    _ => return Err(minijinja::Error::from(minijinja::ErrorKind::UnknownMethod)),
                };
                return Ok(Value::from(hasil));
            }
            Err(minijinja::Error::from(minijinja::ErrorKind::UnknownMethod))
        });
        env.add_function("url_for", url_for);
        env.add_function("csrf_token", || CSRF.with(|c| c.borrow().clone()));
        // Jinja memanggil format_display(...) sebagai global; padanan filter Python.
        env.add_function(
            "format_display",
            |state: &minijinja::State,
             raw: Value,
             kwargs: minijinja::value::Kwargs|
             -> Result<String, minijinja::Error> {
                let s = raw.as_str().map(|v| v.to_string()).unwrap_or_default();
                let fmt = kwargs
                    .get::<Option<String>>("fmt")?
                    .unwrap_or_else(|| "%d/%m/%Y %H:%M".to_string());
                let tz_name = state
                    .lookup("user_timezone")
                    .and_then(|v| v.as_str().map(str::to_string))
                    .filter(|v| !v.is_empty())
                    .or_else(|| std::env::var("TIMEZONE").ok())
                    .or_else(|| std::env::var("APP_TIMEZONE").ok())
                    .unwrap_or_else(|| "Asia/Makassar".to_string());
                let label = crate::utils::time::tz_label(&tz_name);
                let resolved_fmt = fmt.replace("%Z", &label);
                Ok(crate::utils::time::parse_dt(&s)
                    .map(|d| {
                        chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(d, chrono::Utc)
                            .with_timezone(&crate::utils::time::tz(&tz_name))
                            .format(&resolved_fmt)
                            .to_string()
                    })
                    .unwrap_or(s))
            },
        );
        env.add_function("format_rupiah", |raw: Value| -> String {
            let n: i64 = if raw.is_undefined() || raw.is_none() {
                0
            } else if let Some(v) = raw.as_i64() {
                v
            } else if let Ok(v) = raw.to_string().trim().parse::<f64>() {
                v.round() as i64
            } else {
                0
            };
            let neg = n < 0;
            let s = n.unsigned_abs().to_string();
            let mut out = String::with_capacity(s.len() + s.len() / 3);
            for (i, c) in s.chars().enumerate() {
                if i > 0 && (s.len() - i) % 3 == 0 {
                    out.push('.');
                }
                out.push(c);
            }
            if neg {
                format!("-Rp {out}")
            } else {
                format!("Rp {out}")
            }
        });
        env
    })
}

/// Peta endpoint → path. Diperluas saat portal publik diport (Task 12).
fn routes() -> &'static HashMap<&'static str, &'static str> {
    static MAP: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();
    MAP.get_or_init(|| {
        HashMap::from([
            ("public.landing", "/"),
            ("public.livepc", "/livepc"),
            ("public.paket", "/paket"),
            ("public.spesifikasi", "/spesifikasi"),
            ("public.games", "/games"),
            ("public.tv", "/tv"),
            ("public.tv_static", "/tv/static"),
            ("member_portal.login_page", "/member/login"),
            ("member_portal.dashboard_page", "/member/dashboard"),
            ("static", "/static"),
            ("kasir.login", "/kasir/login"),
            ("kasir.index", "/kasir/"),
        ])
    })
}

pub fn url_for(args: minijinja::value::Rest<Value>, kwargs: minijinja::value::Kwargs)
    -> Result<String, minijinja::Error> {
    let name = args.0.first().map(|v| v.to_string()).unwrap_or_default();
    let base = routes().get(name.as_str()).copied().unwrap_or("/");
    // Jinja memanggil url_for('static', filename='…') dengan argumen kata kunci.
    if let Some(f) = kwargs.get::<Option<String>>("filename")? {
        return Ok(format!("{base}/{f}"));
    }
    let path = match args.0.get(1).and_then(|v| v.as_str()) {
        Some(s) => format!("{base}/{s}"),
        None => base.to_string(),
    };
    let mut query_parts = Vec::new();
    for key in kwargs.args() {
        if let Ok(val) = kwargs.get::<Value>(key) {
            if !val.is_undefined() && !val.is_none() {
                query_parts.push(format!("{key}={val}"));
            }
        }
    }
    if query_parts.is_empty() {
        Ok(path)
    } else {
        Ok(format!("{path}?{}", query_parts.join("&")))
    }
}

pub fn render_with(name: &str, ctx: Value, csrf: &str) -> Result<String> {
    CSRF.with(|c| *c.borrow_mut() = csrf.to_string());
    render(name, ctx)
}

pub fn render(name: &str, ctx: Value) -> Result<String> {
    Ok(env().get_template(name)?.render(ctx)?)
}

/// `"{:,}".format(n)` Jinja: pemisah ribuan koma (template lalu mengganti ',' jadi '.').
fn pisah_ribuan(angka: &str) -> String {
    let negatif = angka.starts_with('-');
    let digit: String = angka.chars().filter(char::is_ascii_digit).collect();
    let mut out = String::new();
    for (i, c) in digit.chars().enumerate() {
        if i > 0 && (digit.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    if negatif { format!("-{out}") } else { out }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn render_member_login_dan_dashboard_sukses() {
        let base = json!({
            "warnet_title": "TMBilling Test",
            "v_cache": "1",
            "version": "2.0.0",
            "member": {
                "username": "budi",
                "nama_lengkap": "Budi Santoso",
                "email": "budi@example.com",
                "no_hp": "08123456789",
                "waktu_tersimpan": 125,
                "kadaluarsa_pada": "2026-12-31 23:59:00",
                "dibuat_pada": "2026-01-01 10:00:00",
                "aktif": true,
                "grup": { "nama": "VIP" }
            },
            "total_play_hours": 12.5,
            "total_spent": 150000,
            "sesi_history": [{
                "menit_terpakai": 65,
                "pc": { "kode": "PC-01" },
                "mulai_pada": "2026-11-25 10:00:00",
                "selesai_pada": null,
                "status": "aktif"
            }],
            "sesi_pagination": {
                "page": 1, "pages": 2, "total": 11,
                "has_prev": false, "prev_num": 0,
                "has_next": true, "next_num": 2
            },
            "transaksi_history": [{
                "jenis": "beli_paket_member",
                "jumlah": 50000,
                "keterangan": "Paket 5 Jam",
                "dibuat_pada": "2026-11-25 09:30:00",
                "is_refunded": false,
                "menit": 300,
                "no_nota": "INV-001",
                "jenis_display": "Beli Paket"
            }],
            "tx_pagination": {
                "page": 1, "pages": 2, "total": 11,
                "has_prev": false, "prev_num": 0,
                "has_next": true, "next_num": 2
            }
        });
        let login_html = render_with("public/member/login.html", Value::from_serialize(&base), "csrf-1").unwrap();
        assert!(login_html.contains("TMBilling Test"));
        let dash_html = render_with("public/member/dashboard.html", Value::from_serialize(&base), "csrf-2").unwrap();
        assert!(dash_html.contains("Rp 150.000"));
        assert!(dash_html.contains("Rp 50.000"));
        assert!(dash_html.contains("PC-01"));
    }
}

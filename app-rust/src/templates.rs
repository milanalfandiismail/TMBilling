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
            |raw: Value, kwargs: minijinja::value::Kwargs| -> Result<String, minijinja::Error> {
                let s = raw.as_str().map(|v| v.to_string()).unwrap_or_default();
                let fmt = kwargs
                    .get::<Option<String>>("fmt")?
                    .unwrap_or_else(|| "%d/%m/%Y %H:%M".to_string());
                let tz_name = std::env::var("TIMEZONE").unwrap_or_else(|_| "Asia/Makassar".to_string());
                Ok(crate::utils::time::parse_dt(&s)
                    .map(|d| {
                        chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(d, chrono::Utc)
                            .with_timezone(&crate::utils::time::tz(&tz_name))
                            .format(&fmt)
                            .to_string()
                    })
                    .unwrap_or(s))
            },
        );
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
    Ok(match args.0.get(1) {
        None => base.to_string(),
        Some(v) => match v.as_str() {
            Some(s) => format!("{base}/{s}"),
            None => base.to_string(),
        },
    })
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

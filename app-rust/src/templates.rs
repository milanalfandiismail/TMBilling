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
        env.add_function("url_for", url_for);
        env.add_function("csrf_token", || CSRF.with(|c| c.borrow().clone()));
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
            ("kasir.login", "/kasir/login"),
            ("kasir.index", "/kasir/"),
        ])
    })
}

pub fn url_for(args: minijinja::value::Rest<Value>) -> String {
    let name = args.0.first().map(|v| v.to_string()).unwrap_or_default();
    let base = routes().get(name.as_str()).copied().unwrap_or("/");
    match args.0.get(1) {
        None => base.to_string(),
        Some(v) => match v.as_str() {
            Some(s) => format!("{base}/{s}"),
            None => base.to_string(),
        },
    }
}

pub fn render_with(name: &str, ctx: Value, csrf: &str) -> Result<String> {
    CSRF.with(|c| *c.borrow_mut() = csrf.to_string());
    render(name, ctx)
}

pub fn render(name: &str, ctx: Value) -> Result<String> {
    Ok(env().get_template(name)?.render(ctx)?)
}

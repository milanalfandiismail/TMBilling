//! Aset statis & template yang di-embed ke biner (tanpa berkas eksternal).

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../app/static"]
pub struct StaticAssets;

#[derive(RustEmbed)]
#[folder = "../app/templates"]
pub struct TemplateAssets;

/// Content-Type dari ekstensi berkas; cukup untuk aset yang dipakai dashboard.
pub fn content_type(path: &str) -> &'static str {
    match path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json",
        "html" | "htm" => "text/html; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "eot" => "application/vnd.ms-fontobject",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// Versi cache untuk aset aplikasi (js/css): berubah setiap kali isinya berubah,
/// sehingga `?v=` di template tidak pernah menahan JS lama di cache immutable.
pub fn cache_version() -> &'static str {
    use std::hash::{Hash, Hasher};
    static V: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    V.get_or_init(|| {
        let mut h = std::collections::hash_map::DefaultHasher::new();
        let mut paths: Vec<_> = StaticAssets::iter()
            .filter(|p| p.starts_with("js/") || p.starts_with("css/"))
            .collect();
        paths.sort();
        for p in paths {
            p.hash(&mut h);
            if let Some(f) = StaticAssets::get(&p) {
                f.data.hash(&mut h);
            }
        }
        format!("{:x}", h.finish())
    })
}

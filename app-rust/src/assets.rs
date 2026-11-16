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

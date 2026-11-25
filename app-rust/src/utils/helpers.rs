//! Helper bersama: sanitasi HTML, urutan alami kode PC, dan parsing Google Maps.

use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

const ALLOWED_TAGS: [&str; 32] = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "a",
    "span",
    "div",
    "hr",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "img",
];

const SAFE_PREFIXES: [&str; 6] = ["http://", "https://", "mailto:", "/", "#", "data:image/"];

/// Allowlist sama dengan `SafeHTMLParser` Python; atribut `on*` dibuang ammonia secara default.
pub fn sanitize_html(input: &str) -> String {
    let mut builder = ammonia::Builder::default();
    builder
        .tags(ALLOWED_TAGS.into_iter().collect::<HashSet<_>>())
        .generic_attributes(["class", "style", "id", "align"].into_iter().collect())
        .tag_attributes(HashMap::from([
            // ammonia menambahkan rel="noopener noreferrer" sendiri; mendeklarasikannya di sini ditolak crate.
            (
                "a",
                ["href", "target", "title", "class"].into_iter().collect(),
            ),
            (
                "img",
                ["src", "alt", "title", "width", "height", "class", "style"]
                    .into_iter()
                    .collect(),
            ),
        ]))
        .url_schemes(["http", "https", "mailto", "data"].into_iter().collect())
        .attribute_filter(|_element, attribute, value| {
            let attr = attribute.to_ascii_lowercase();
            if attr == "href" || attr == "src" {
                // Buang karakter kontrol/spasi agar "java\tscript:" tidak lolos.
                let compact: String = value
                    .chars()
                    .filter(|c| !c.is_control() && !c.is_whitespace())
                    .collect::<String>()
                    .to_ascii_lowercase();
                if !SAFE_PREFIXES.iter().any(|p| compact.starts_with(p)) {
                    return None;
                }
            }
            if attr == "style" {
                let low = value.to_ascii_lowercase();
                if low.contains("url(")
                    || low.contains("expression")
                    || low.contains("javascript")
                    || low.contains("@import")
                {
                    return None;
                }
            }
            Some(value.into())
        });
    builder.clean(input).to_string()
}

/// Urutkan "PC-2" sebelum "PC-10" (setara `natural_sort_key`).
pub fn natural_sort_key(code: &str) -> (Vec<u64>, String) {
    let mut numbers = Vec::new();
    let mut current = String::new();
    for ch in code.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
        } else {
            if !current.is_empty() {
                numbers.push(current.parse().unwrap_or(0));
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        numbers.push(current.parse().unwrap_or(0));
    }
    (numbers, code.to_lowercase())
}

fn percent_encode_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            _ => {
                out.push('%');
                out.push_str(&format!("{b:02X}"));
            }
        }
    }
    out
}

fn extract_iframe_src(raw: &str) -> Option<String> {
    let lower = raw.to_ascii_lowercase();
    let idx = lower.find("src=")?;
    let rest = raw[idx + 4..].trim_start();
    let quote = rest.chars().next().filter(|&c| c == '"' || c == '\'')?;
    let after = &rest[1..];
    let end = after.find(quote)?;
    Some(after[..end].trim().to_string())
}

fn extract_coord_token(url: &str, marker: &str) -> Option<String> {
    let mut rest = url;
    while let Some(pos) = rest.find(marker) {
        let candidate = &rest[pos + marker.len()..];
        let mut end = 0usize;
        for (i, ch) in candidate.char_indices() {
            if (i == 0 && ch == '-') || ch.is_ascii_digit() || ch == '.' {
                end = i + ch.len_utf8();
            } else {
                break;
            }
        }
        let val = &candidate[..end];
        if val.parse::<f64>().is_ok() {
            return Some(val.to_string());
        }
        rest = candidate;
    }
    None
}

fn build_direction_url(src_url: &str, warnet_address: &str) -> String {
    if let (Some(lat), Some(lng)) = (
        extract_coord_token(src_url, "!3d"),
        extract_coord_token(src_url, "!2d"),
    ) {
        return format!("https://www.google.com/maps/dir/?api=1&destination={lat},{lng}");
    }
    let addr = warnet_address.trim();
    if !addr.is_empty() {
        return format!(
            "https://www.google.com/maps/dir/?api=1&destination={}",
            percent_encode_component(addr)
        );
    }
    "https://www.google.com/maps".to_string()
}

fn is_http_url(s: &str) -> bool {
    s.starts_with("https://") || s.starts_with("http://")
}

fn is_gmaps_embed(s: &str) -> bool {
    s.starts_with("https://www.google.com/maps/embed")
        || s.starts_with("http://www.google.com/maps/embed")
}

fn is_gmaps_host(s: &str) -> bool {
    is_http_url(s) && (s.contains("google.com/maps") || s.contains("maps.google.com"))
}

/// Menganalisis input Google Maps (iframe, embed URL, shortlink, atau URL Maps biasa).
pub fn parse_google_maps_info(gmaps_input: &str, warnet_address: &str) -> Value {
    let raw = gmaps_input.trim();
    if raw.is_empty() {
        return json!({"raw": "", "embed_url": Value::Null, "nav_url": Value::Null, "is_valid": false});
    }

    let mut embed_url: Option<String> = None;
    let mut nav_url: Option<String> = None;

    if raw.to_ascii_lowercase().contains("<iframe") {
        if let Some(src_val) = extract_iframe_src(raw) {
            if is_gmaps_embed(&src_val) {
                nav_url = Some(build_direction_url(&src_val, warnet_address));
                embed_url = Some(src_val);
            } else if is_gmaps_host(&src_val) {
                nav_url = Some(src_val.clone());
                embed_url = Some(src_val);
            }
        }
    } else if is_gmaps_embed(raw) {
        embed_url = Some(raw.to_string());
        nav_url = Some(build_direction_url(raw, warnet_address));
    } else if raw.starts_with("https://maps.app.goo.gl/")
        || raw.starts_with("http://maps.app.goo.gl/")
        || raw.starts_with("https://goo.gl/maps/")
        || raw.starts_with("http://goo.gl/maps/")
    {
        nav_url = Some(raw.to_string());
    } else if is_gmaps_host(raw) {
        nav_url = Some(raw.to_string());
        if raw.contains("output=embed") {
            embed_url = Some(raw.to_string());
        }
    }

    let is_valid = embed_url.is_some() || nav_url.is_some();
    json!({
        "raw": raw,
        "embed_url": embed_url,
        "nav_url": nav_url,
        "is_valid": is_valid,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitasi_membuang_script_dan_protokol_berbahaya() {
        let out = sanitize_html(
            r#"<p onclick="x()">hai</p><script>alert(1)</script><a href="javascript:alert(1)">a</a>"#,
        );
        assert!(out.contains("<p>hai</p>"), "{out}");
        assert!(!out.contains("script"), "{out}");
        assert!(!out.contains("javascript"), "{out}");
        assert!(!out.contains("onclick"), "{out}");
        let link = sanitize_html(r#"<a href="https://contoh.id" target="_blank">ok</a>"#);
        assert!(link.contains("https://contoh.id"), "{link}");
        assert!(link.contains("target"), "{link}");
    }

    #[test]
    fn urutan_natural_kode_pc() {
        let mut codes = vec!["PC-10", "PC-2", "PC-1"];
        codes.sort_by_key(|c| natural_sort_key(c));
        assert_eq!(codes, vec!["PC-1", "PC-2", "PC-10"]);
    }

    #[test]
    fn test_parse_google_maps_info_iframe() {
        let iframe = r#"<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d-1.23!2d116.85!3d-1.26" width="600"></iframe>"#;
        let res = parse_google_maps_info(iframe, "Jl. Merdeka");
        assert_eq!(res["is_valid"], true);
        assert_eq!(
            res["embed_url"],
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d-1.23!2d116.85!3d-1.26"
        );
        assert_eq!(
            res["nav_url"],
            "https://www.google.com/maps/dir/?api=1&destination=-1.26,116.85"
        );
    }

    #[test]
    fn test_parse_google_maps_info_shortlink() {
        let short = "https://maps.app.goo.gl/abcdef123";
        let res = parse_google_maps_info(short, "Jl. Merdeka");
        assert_eq!(res["is_valid"], true);
        assert_eq!(res["embed_url"], Value::Null);
        assert_eq!(res["nav_url"], "https://maps.app.goo.gl/abcdef123");
    }

    #[test]
    fn test_parse_google_maps_info_kosong() {
        let res = parse_google_maps_info("", "Jl. Merdeka");
        assert_eq!(res["is_valid"], false);
        assert_eq!(res["embed_url"], Value::Null);
        assert_eq!(res["nav_url"], Value::Null);
    }
}

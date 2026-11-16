//! Helper bersama: sanitasi HTML dan urutan alami kode PC.

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
}

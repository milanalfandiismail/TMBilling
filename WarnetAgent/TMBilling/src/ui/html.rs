use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::c;
use gpui_kit::Rgba;

#[derive(Clone, PartialEq, Default)]
struct Style {
    color: Option<Rgba>,
    bold: bool,
    italic: bool,
    underline: bool,
}

#[derive(Clone)]
struct Run {
    text: String,
    style: Style,
}

/// Warna dari atribut style: #rgb, #rrggbb, rgb(r,g,b), atau nama umum.
pub fn parse_color(value: &str) -> Option<Rgba> {
    let v = value.trim().to_ascii_lowercase();
    if let Some(hex) = v.strip_prefix('#') {
        let digits: String = hex.chars().filter(|c| c.is_ascii_hexdigit()).collect();
        return match digits.len() {
            3 => {
                let d: Vec<u32> = digits.chars().filter_map(|c| c.to_digit(16)).collect();
                Some(c(((d[0] * 17) << 16) | ((d[1] * 17) << 8) | (d[2] * 17)))
            }
            6 => u32::from_str_radix(&digits, 16).ok().map(c),
            _ => None,
        };
    }
    if let Some(rest) = v.strip_prefix("rgb(").and_then(|r| r.strip_suffix(')')) {
        let parts: Vec<u32> = rest
            .split(',')
            .filter_map(|p| p.trim().parse::<u32>().ok())
            .collect();
        if parts.len() == 3 {
            return Some(c((parts[0].min(255) << 16) | (parts[1].min(255) << 8) | parts[2].min(255)));
        }
        return None;
    }
    let hex = match v.as_str() {
        "red" => 0xF87171,
        "green" => 0x34D399,
        "blue" => 0x60A5FA,
        "yellow" => 0xFBBF24,
        "orange" => 0xF97316,
        "gray" | "grey" => 0xA3A3A3,
        "white" => 0xFFFFFF,
        "black" => 0x000000,
        _ => return None,
    };
    Some(c(hex))
}

fn style_from_attrs(attrs: &str, current: &Style) -> Style {
    let mut style = current.clone();
    let lower = attrs.to_ascii_lowercase();
    if let Some(pos) = lower.find("style=") {
        let rest = attrs[pos + 6..].trim_start_matches(['"', char::from(39)]);
        let value = rest
            .split(['"', char::from(39)])
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        for part in value.split(';') {
            if let Some(color) = part.trim().strip_prefix("color:") {
                if let Some(rgba) = parse_color(color) {
                    style.color = Some(rgba);
                }
            }
        }
    }
    if let Some(pos) = lower.find("color=") {
        let rest = attrs[pos + 6..].trim_start_matches(['"', char::from(39)]);
        let value = rest.split(['"', char::from(39)]).next().unwrap_or("");
        if let Some(rgba) = parse_color(value) {
            style.color = Some(rgba);
        }
    }
    style
}

fn decode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(pos) = rest.find('&') {
        out.push_str(&rest[..pos]);
        let tail = &rest[pos..];
        let entity = tail.find(';').map(|end| (&tail[1..end], end));
        match entity {
            Some((name, end)) => {
                let ch = match name {
                    "amp" => Some('&'),
                    "lt" => Some('<'),
                    "gt" => Some('>'),
                    "quot" => Some('"'),
                    "apos" | "#39" => Some(char::from(39)),
                    "nbsp" => Some(' '),
                    _ => None,
                };
                match ch {
                    Some(c) => {
                        out.push(c);
                        rest = &tail[end + 1..];
                    }
                    None => {
                        out.push('&');
                        rest = &tail[1..];
                    }
                }
            }
            None => {
                out.push_str(tail);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

fn is_block(tag: &str) -> bool {
    matches!(
        tag,
        "p" | "div" | "li" | "tr" | "br" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "ul" | "ol"
            | "table"
    )
}

fn is_inline(tag: &str) -> bool {
    matches!(
        tag,
        "b" | "strong" | "i" | "em" | "u" | "s" | "span" | "a" | "font" | "small" | "code"
    )
}

/// Blok teks + gaya, dipakai bersama oleh render dan text_of.
fn parse(html: &str) -> Vec<(String, Vec<Run>)> {
    let mut blocks: Vec<(String, Vec<Run>)> = Vec::new();
    let mut runs: Vec<Run> = Vec::new();
    let mut style = Style::default();
    let mut stack: Vec<Style> = Vec::new();
    let mut tag = String::new();
    let mut rest = html;

    let flush = |runs: &mut Vec<Run>, blocks: &mut Vec<(String, Vec<Run>)>, tag: &str| {
        if runs.iter().any(|r| !r.text.trim().is_empty()) {
            blocks.push((tag.to_string(), std::mem::take(runs)));
        } else {
            runs.clear();
        }
    };

    while let Some(lt) = rest.find('<') {
        let text = &rest[..lt];
        if !text.is_empty() {
            let text = decode(text);
            match runs.last_mut() {
                Some(run) if run.style == style => run.text.push_str(&text),
                _ => runs.push(Run { text, style: style.clone() }),
            }
        }
        let Some(gt) = rest[lt..].find('>') else {
            break;
        };
        let inner = &rest[lt + 1..lt + gt];
        rest = &rest[lt + gt + 1..];

        let closing = inner.starts_with('/');
        let body = inner.trim_start_matches('/').trim();
        let name: String = body
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_ascii_lowercase();
        let attrs = &body[name.len()..];

        if closing {
            if is_block(&name) {
                flush(&mut runs, &mut blocks, &tag);
                tag.clear();
            } else if is_inline(&name) {
                style = stack.pop().unwrap_or_default();
            }
            continue;
        }

        if is_block(&name) {
            flush(&mut runs, &mut blocks, &tag);
            tag = name.clone();
            stack.clear();
            style = Style::default();
        } else if is_inline(&name) {
            stack.push(style.clone());
            style = style_from_attrs(attrs, &style);
            if name == "b" || name == "strong" {
                style.bold = true;
            }
            if name == "i" || name == "em" {
                style.italic = true;
            }
            if name == "u" {
                style.underline = true;
            }
        }
    }
    flush(&mut runs, &mut blocks, &tag);
    blocks
}

/// Teks polos, dipakai untuk pencarian dan test.
pub fn text_of(html: &str) -> String {
    parse(html)
        .into_iter()
        .map(|(_, runs)| {
            let mut line = String::new();
            for run in runs {
                line.push_str(&run.text);
            }
            line.trim().to_string()
        })
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn render_html(html: &str, base: f32, fallback: Rgba) -> AnyElement {
    let mut column = div().flex().flex_col().w_full().gap(px(6.0));
    let blocks = parse(html);
    if blocks.is_empty() {
        return div()
            .text_size(px(base))
            .text_color(fallback)
            .child(text_of(html))
            .into_any_element();
    }
    for (tag, runs) in blocks {
        let heading = tag.starts_with('h');
        let mut row = div().flex().flex_row().flex_wrap().items_baseline().w_full();
        if tag == "li" {
            row = row.child(
                div()
                    .w(px(14.0))
                    .flex_shrink_0()
                    .text_size(px(base))
                    .text_color(fallback)
                    .child("•"),
            );
        }
        let mut text = div().flex().flex_row().flex_wrap().flex_1();
        for run in runs {
            let mut el = div()
                .text_size(px(if heading { base + 2.0 } else { base }))
                .text_color(run.style.color.unwrap_or(fallback))
                .child(run.text);
            if run.style.bold || heading {
                el = el.font_weight(FontWeight::BOLD);
            }
            if run.style.italic {
                el = el.italic();
            }
            if run.style.underline {
                el = el.underline();
            }
            text = text.child(el);
        }
        row = row.child(text);
        column = column.child(row);
    }
    column.into_any_element()
}

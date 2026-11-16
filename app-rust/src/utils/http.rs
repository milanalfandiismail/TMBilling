//! Pembantu respons JSON dan cookie agar bentuk error seragam dengan Python.

use axum::body::Bytes;
use axum::extract::FromRequest;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

pub fn parse_json(body: &Bytes) -> Value {
    serde_json::from_slice(body).unwrap_or_else(|_| Value::Object(Default::default()))
}

pub fn json(status: u16, value: Value) -> Response {
    (
        StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        axum::Json(value),
    )
        .into_response()
}

pub fn json_with_cookies(status: u16, value: Value, cookies: &[String]) -> Response {
    let mut res = json(status, value);
    for c in cookies {
        if let Ok(v) = HeaderValue::from_str(c) {
            res.headers_mut().append(header::SET_COOKIE, v);
        }
    }
    res
}

pub fn err(status: u16, message: impl Into<String>) -> Response {
    json(status, serde_json::json!({ "error": message.into() }))
}

pub fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';')
        .filter_map(|p| p.trim().split_once('='))
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.to_string())
}

/// Berkas unggahan multipart (hanya satu bidang berkas yang dipakai).
pub struct Upload {
    pub filename: String,
    pub bytes: Vec<u8>,
}

/// Baca body JSON **atau** multipart: (data, berkas).
pub async fn payload<S>(
    req: axum::extract::Request,
    state: &S,
) -> Result<(serde_json::Value, Option<Upload>), String>
where
    S: Clone + Send + Sync,
{
    let json = req
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("application/json"))
        .unwrap_or(false);
    if json {
        let bytes = axum::body::to_bytes(req.into_body(), 64 * 1024 * 1024)
            .await
            .map_err(|e| e.to_string())?;
        return Ok((parse_json(&bytes), None));
    }
    let mut mp = axum::extract::Multipart::from_request(req, state)
        .await
        .map_err(|e| e.to_string())?;
    let mut map = serde_json::Map::new();
    let mut upload = None;
    while let Some(field) = mp.next_field().await.map_err(|e| e.to_string())? {
        let name = field.name().unwrap_or("").to_string();
        let filename = field.file_name().map(str::to_string);
        let bytes = field.bytes().await.map_err(|e| e.to_string())?;
        match (filename, name.as_str()) {
            (Some(f), "icon") | (Some(f), "image") | (Some(f), "file") if !f.is_empty() => {
                upload = Some(Upload {
                    filename: f,
                    bytes: bytes.to_vec(),
                });
            }
            (Some(f), _) if !f.is_empty() => {
                upload = Some(Upload {
                    filename: f,
                    bytes: bytes.to_vec(),
                });
            }
            _ => {
                map.insert(
                    name,
                    serde_json::Value::String(String::from_utf8_lossy(&bytes).to_string()),
                );
            }
        }
    }
    Ok((serde_json::Value::Object(map), upload))
}

/// Body JSON **atau** urlencoded/multipart sederhana → `Value` datar (nilai teks).
pub async fn parse_body(headers: &HeaderMap, body: Bytes) -> Value {
    let tipe = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if tipe.starts_with("application/json") {
        return parse_json(&body);
    }
    let teks = String::from_utf8_lossy(&body);
    let mut map = serde_json::Map::new();
    for pasangan in teks.split('&').filter(|s| !s.is_empty()) {
        let (k, v) = pasangan.split_once('=').unwrap_or((pasangan, ""));
        map.insert(
            percent_decode(k),
            serde_json::Value::String(percent_decode(v)),
        );
    }
    serde_json::Value::Object(map)
}

fn percent_decode(raw: &str) -> String {
    let bytes = raw.replace('+', " ");
    let bytes = bytes.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&raw[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

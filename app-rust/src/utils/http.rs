//! Pembantu respons JSON dan cookie agar bentuk error seragam dengan Python.

use axum::body::Bytes;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

pub fn parse_json(body: &Bytes) -> Value {
    serde_json::from_slice(body).unwrap_or_else(|_| Value::Object(Default::default()))
}

pub fn json(status: u16, value: Value) -> Response {
    (StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR), axum::Json(value))
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

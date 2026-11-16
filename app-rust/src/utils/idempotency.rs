//! Penjaga permintaan duplikat untuk jalur uang.
//!
//! shortcut: kunci hidup di memori satu proses dan hilang saat restart; cukup untuk retry
//! detik-menit. Naikkan ke tabel DB bila perlu tahan restart.

use crate::utils::constants::{IDEMPOTENCY_MAX_KEYS, IDEMPOTENCY_TTL_SECONDS};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

fn seen() -> &'static Mutex<HashMap<String, Instant>> {
    static SEEN: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    SEEN.get_or_init(|| Mutex::new(HashMap::new()))
}

/// `true` bila kunci baru, `false` bila sudah dipakai dalam TTL. Kunci kosong selalu `true`.
pub fn claim(key: &str) -> bool {
    if key.is_empty() { return true; }
    let now = Instant::now();
    let ttl = Duration::from_secs(IDEMPOTENCY_TTL_SECONDS);
    let mut map = seen().lock().unwrap();
    map.retain(|_, ts| now.duration_since(*ts) <= ttl);
    if map.len() > IDEMPOTENCY_MAX_KEYS { map.clear(); }
    match map.get(key) {
        Some(_) => false,
        None => { map.insert(key.to_string(), now); true }
    }
}

/// Lepaskan kunci agar percobaan ulang tidak diblokir setelah request gagal.
pub fn release(key: &str) {
    if !key.is_empty() { seen().lock().unwrap().remove(key); }
}

/// Kosongkan semua kunci. Dipakai tes.
pub fn reset() {
    seen().lock().unwrap().clear();
}

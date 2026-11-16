//! Pembatas login gagal per (IP, username) dan per IP, setara versi Python.
//!
//! shortcut: hitungan hilang saat server restart, pindah ke tabel bila audit lintas restart dibutuhkan.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

pub const MAX_FAILURES: usize = 5;
pub const MAX_FAILURES_PER_IP: usize = 20;
pub const WINDOW: Duration = Duration::from_secs(300);

fn store() -> &'static Mutex<HashMap<String, Vec<Instant>>> {
    static STORE: OnceLock<Mutex<HashMap<String, Vec<Instant>>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn pair_key(ip: &str, username: &str) -> String {
    format!("{ip}\u{1}{username}")
}

fn ip_key(ip: &str) -> String {
    format!("__ip__\u{1}{ip}")
}

fn prune(map: &mut HashMap<String, Vec<Instant>>, key: &str, now: Instant) -> usize {
    match map.get_mut(key) {
        Some(list) => {
            list.retain(|t| now.duration_since(*t) < WINDOW);
            list.len()
        }
        None => 0,
    }
}

pub fn check(ip: &str, username: &str) -> bool {
    let now = Instant::now();
    let mut map = store().lock().unwrap();
    prune(&mut map, &pair_key(ip, username), now) >= MAX_FAILURES
        || prune(&mut map, &ip_key(ip), now) >= MAX_FAILURES_PER_IP
}

pub fn fail(ip: &str, username: &str) {
    let now = Instant::now();
    let mut map = store().lock().unwrap();
    map.retain(|_, list| list.last().map(|t| now.duration_since(*t) < WINDOW).unwrap_or(false));
    map.entry(pair_key(ip, username)).or_default().push(now);
    map.entry(ip_key(ip)).or_default().push(now);
}

pub fn ok(ip: &str, username: &str) {
    let mut map = store().lock().unwrap();
    map.remove(&pair_key(ip, username));
    map.remove(&ip_key(ip));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lima_gagal_memblokir_pasangan_dan_ip() {
        let ip = "10.0.0.1";
        ok(ip, "admin");
        for _ in 0..MAX_FAILURES - 1 {
            fail(ip, "admin");
        }
        assert!(!check(ip, "admin"));
        fail(ip, "admin");
        assert!(check(ip, "admin"));
        assert!(!check(ip, "kasir"), "batas per-IP baru tercapai di 20");
        for _ in 0..MAX_FAILURES_PER_IP {
            fail(ip, "lain");
        }
        assert!(check(ip, "kasir"), "IP diblokir setelah 20 kegagalan");
        ok(ip, "admin");
        assert!(!check(ip, "kasir"));
    }
}

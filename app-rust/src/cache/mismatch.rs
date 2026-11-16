//! Penanda client yang mengirim API key salah, dibersihkan begitu key valid.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(600);

#[derive(Default)]
pub struct MismatchStore {
    entries: Mutex<HashMap<String, (Option<i64>, Instant)>>,
}

impl MismatchStore {
    pub fn record(&self, ip: &str, pc_id: Option<i64>) {
        if ip.is_empty() {
            return;
        }
        let mut map = self.entries.lock().unwrap();
        map.retain(|_, (_, at)| at.elapsed() < TTL);
        map.insert(ip.to_string(), (pc_id, Instant::now()));
    }

    pub fn clear(&self, ip: &str, pc_id: Option<i64>) {
        let mut map = self.entries.lock().unwrap();
        map.remove(ip);
        if let Some(id) = pc_id {
            map.retain(|_, (pc, _)| *pc != Some(id));
        }
    }

    pub fn is_mismatch(&self, ip: &str) -> bool {
        let mut map = self.entries.lock().unwrap();
        map.retain(|_, (_, at)| at.elapsed() < TTL);
        map.contains_key(ip)
    }
}

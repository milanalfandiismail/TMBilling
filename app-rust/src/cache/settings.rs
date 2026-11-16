//! Write-through cache pengaturan global + cache negatif (setara `SettingsCacheStore`).

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

#[derive(Default)]
struct Inner {
    map: Option<HashMap<String, String>>,
    missing: HashSet<String>,
    complete: bool,
}

#[derive(Default)]
pub struct SettingsCache {
    inner: Mutex<Inner>,
}

impl SettingsCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.inner
            .lock()
            .unwrap()
            .map
            .as_ref()
            .and_then(|m| m.get(key).cloned())
    }

    pub fn get_all(&self) -> HashMap<String, String> {
        self.inner.lock().unwrap().map.clone().unwrap_or_default()
    }

    pub fn has_snapshot(&self) -> bool {
        self.inner.lock().unwrap().map.is_some()
    }

    pub fn set(&self, key: &str, value: &str) {
        let mut g = self.inner.lock().unwrap();
        g.map
            .get_or_insert_with(HashMap::new)
            .insert(key.to_string(), value.to_string());
        g.missing.remove(key);
    }

    /// Dipanggil hanya dengan isi tabel settings utuh, sehingga snapshot dianggap lengkap.
    pub fn update_all(&self, data: HashMap<String, String>) {
        let mut g = self.inner.lock().unwrap();
        g.map.get_or_insert_with(HashMap::new).extend(data);
        g.missing.clear();
        g.complete = true;
    }

    pub fn mark_missing(&self, key: &str) {
        self.inner.lock().unwrap().missing.insert(key.to_string());
    }

    pub fn is_missing(&self, key: &str) -> bool {
        self.inner.lock().unwrap().missing.contains(key)
    }

    pub fn is_complete(&self) -> bool {
        self.inner.lock().unwrap().complete
    }

    pub fn invalidate(&self) {
        let mut g = self.inner.lock().unwrap();
        g.map = None;
        g.complete = false;
        g.missing.clear();
    }
}

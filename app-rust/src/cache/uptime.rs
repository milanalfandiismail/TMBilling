//! Akumulasi detik online & billing per PC di RAM; scheduler yang mem-flush ke DB.

use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default, Clone, Copy)]
pub struct UptimeAcc {
    pub online: i64,
    pub billing: i64,
    pub billing_active: bool,
}

#[derive(Default)]
pub struct UptimeStore {
    inner: Mutex<HashMap<i64, UptimeAcc>>,
}

impl UptimeStore {
    pub fn set_billing(&self, pc_id: i64, active: bool) {
        let mut map = self.inner.lock().unwrap();
        map.entry(pc_id).or_default().billing_active = active;
    }

    /// Tambah satu detak (default 60 detik) ke akumulator PC.
    pub fn add(&self, pc_id: i64, seconds: i64) {
        let mut map = self.inner.lock().unwrap();
        let acc = map.entry(pc_id).or_default();
        acc.online += seconds;
        if acc.billing_active {
            acc.billing += seconds;
        }
    }

    pub fn snapshot(&self) -> Vec<(i64, UptimeAcc)> {
        self.inner
            .lock()
            .unwrap()
            .iter()
            .map(|(k, v)| (*k, *v))
            .collect()
    }
}

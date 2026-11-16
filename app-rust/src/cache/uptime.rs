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
    last_tick: Mutex<HashMap<i64, i64>>,
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

    /// Satu detak telemetri: selisih waktu sejak detak terakhir (maks 60 s).
    pub fn heartbeat(&self, pc_id: i64, billing: bool, now: i64) {
        let prev = {
            let mut ticks = self.last_tick.lock().unwrap();
            let prev = ticks.insert(pc_id, now);
            prev
        };
        let mut map = self.inner.lock().unwrap();
        let acc = map.entry(pc_id).or_default();
        acc.billing_active = billing;
        if let Some(p) = prev {
            let delta = (now - p).clamp(0, 60);
            acc.online += delta;
            if billing {
                acc.billing += delta;
            }
        }
    }

    /// Ambil akumulator lalu kosongkan (dipakai scheduler saat flush ke DB).
    pub fn drain(&self) -> Vec<(i64, UptimeAcc)> {
        let mut map = self.inner.lock().unwrap();
        let hasil = map.iter().map(|(k, v)| (*k, *v)).collect();
        for acc in map.values_mut() {
            acc.online = 0;
            acc.billing = 0;
        }
        hasil
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

//! Detak jantung client di RAM (setara `OnlineStatusStore`): online bila < 15 detik.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const ONLINE_TTL: Duration = Duration::from_secs(15);

#[derive(Default)]
pub struct OnlineStatusStore {
    seen: Mutex<HashMap<i64, Instant>>,
}

impl OnlineStatusStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn touch(&self, pc_id: i64) {
        let mut g = self.seen.lock().unwrap();
        g.retain(|_, at| at.elapsed() < ONLINE_TTL);
        g.insert(pc_id, Instant::now());
    }

    pub fn is_online(&self, pc_id: i64) -> bool {
        self.seen
            .lock()
            .unwrap()
            .get(&pc_id)
            .is_some_and(|at| at.elapsed() < ONLINE_TTL)
    }

    pub fn forget(&self, pc_id: i64) {
        self.seen.lock().unwrap().remove(&pc_id);
    }

    pub fn online_ids(&self) -> Vec<i64> {
        self.seen.lock().unwrap().keys().copied().collect()
    }
}

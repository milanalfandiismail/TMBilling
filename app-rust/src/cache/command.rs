//! Antrean perintah per PC (GUI reguler & cepat/VNC).

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

pub const MAX_COMMAND_QUEUE_PER_PC: usize = 10;
const DEDUPLICATED: [&str; 3] = ["screenshot", "lock", "unlock"];

#[derive(Default)]
pub struct CommandQueue {
    inner: Mutex<HashMap<i64, VecDeque<String>>>,
}

impl CommandQueue {
    pub fn push(&self, pc_id: i64, cmd: &str) {
        if pc_id <= 0 || cmd.is_empty() {
            return;
        }
        let mut map = self.inner.lock().unwrap();
        let q = map.entry(pc_id).or_default();
        if DEDUPLICATED.contains(&cmd) && q.iter().any(|c| c == cmd) {
            return;
        }
        q.push_back(cmd.to_string());
        while q.len() > MAX_COMMAND_QUEUE_PER_PC {
            q.pop_front();
        }
    }

    pub fn pop(&self, pc_id: i64) -> Option<String> {
        let mut map = self.inner.lock().unwrap();
        map.get_mut(&pc_id).and_then(|q| q.pop_front())
    }

    pub fn clear(&self, pc_id: i64) {
        self.inner.lock().unwrap().remove(&pc_id);
    }
}

#[derive(Default)]
pub struct Queues {
    pub regular: CommandQueue,
    pub fast: CommandQueue,
}

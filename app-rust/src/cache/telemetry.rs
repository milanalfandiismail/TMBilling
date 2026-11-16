//! Snapshot telemetri & daftar proses di RAM (jalur polling tidak menyentuh disk).

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default)]
pub struct HardwareMetricsStore {
    inner: Mutex<HashMap<i64, Value>>,
}

impl HardwareMetricsStore {
    pub fn set(&self, pc_id: i64, v: Value) {
        self.inner.lock().unwrap().insert(pc_id, v);
    }
    pub fn get(&self, pc_id: i64) -> Option<Value> {
        self.inner.lock().unwrap().get(&pc_id).cloned()
    }
    pub fn forget(&self, pc_id: i64) {
        self.inner.lock().unwrap().remove(&pc_id);
    }
}

#[derive(Default)]
pub struct ProcessMemoryStore {
    inner: Mutex<HashMap<i64, (Vec<Value>, i64)>>,
}

impl ProcessMemoryStore {
    pub fn set(&self, pc_id: i64, list: Vec<Value>, stamp: i64) {
        self.inner.lock().unwrap().insert(pc_id, (list, stamp));
    }
    pub fn get(&self, pc_id: i64) -> Option<(Vec<Value>, i64)> {
        self.inner.lock().unwrap().get(&pc_id).cloned()
    }
    pub fn last_updated(&self, pc_id: i64) -> i64 {
        self.inner
            .lock()
            .unwrap()
            .get(&pc_id)
            .map(|(_, t)| *t)
            .unwrap_or(0)
    }
}

#[derive(Debug, Clone)]
pub struct MetricSample {
    pub cpu_usage: f64,
    pub ram_usage_pct: f64,
}

#[derive(Default)]
pub struct TelemetryHistoryStore {
    inner: Mutex<HashMap<i64, Vec<MetricSample>>>,
}

impl TelemetryHistoryStore {
    pub fn push(&self, pc_id: i64, cpu: f64, ram: f64, max_len: usize) {
        let mut map = self.inner.lock().unwrap();
        let list = map.entry(pc_id).or_default();
        list.push(MetricSample {
            cpu_usage: cpu,
            ram_usage_pct: ram,
        });
        while list.len() > max_len {
            list.remove(0);
        }
    }
    pub fn get(&self, pc_id: i64) -> Vec<MetricSample> {
        self.inner
            .lock()
            .unwrap()
            .get(&pc_id)
            .cloned()
            .unwrap_or_default()
    }
}

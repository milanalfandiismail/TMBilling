//! Baris `hardware_monitor` (baseline anti-maling + metrik terakhir).

use serde_json::Value;

use crate::utils::time;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct HardwareMonitor {
    pub id: i64,
    pub pc_id: i64,
    pub cpu_usage: Option<f64>,
    pub cpu_temp: Option<f64>,
    pub gpu_temp: Option<f64>,
    pub total_ram: Option<String>,
    pub nic_speed: Option<String>,
    pub motherboard: Option<String>,
    pub cpu_name: Option<String>,
    pub gpu_name: Option<String>,
    pub active_window: Option<String>,
    pub hardware_baseline: Option<String>,
    pub hardware_current_specs: Option<String>,
    pub hardware_mismatch: Option<bool>,
    pub hardware_mismatch_desc: Option<String>,
    pub hardware_mismatch_time: Option<String>,
    pub hardware_cctv_window: Option<String>,
    pub hardware_last_sync: Option<String>,
    pub last_update: Option<String>,
}

pub const KOLOM: &str = "id, pc_id, cpu_usage, cpu_temp, gpu_temp, total_ram, nic_speed, motherboard, \
cpu_name, gpu_name, active_window, hardware_baseline, hardware_current_specs, hardware_mismatch, \
hardware_mismatch_desc, hardware_mismatch_time, hardware_cctv_window, hardware_last_sync, last_update";

impl HardwareMonitor {
    pub fn to_json(
        &self,
        metric: Option<&Value>,
        health: &Value,
        pc: (&str, &str, i64, &str),
    ) -> Value {
        let mut out = serde_json::json!({
            "id": self.id,
            "pc_id": self.pc_id,
            "cpu_usage": self.cpu_usage,
            "cpu_temp": self.cpu_temp,
            "gpu_temp": self.gpu_temp,
            "total_ram": self.total_ram,
            "nic_speed": self.nic_speed,
            "motherboard": self.motherboard,
            "cpu_name": self.cpu_name,
            "gpu_name": self.gpu_name,
            "active_window": self.active_window,
            "last_update": self.last_update,
            "last_update_ts": self.last_update.as_deref().and_then(|v| time::parse_dt(v)).map(|d| d.and_utc().timestamp_millis()),
            "hardware_baseline": self.hardware_baseline,
            "hardware_current_specs": self.hardware_current_specs,
            "hardware_mismatch": self.hardware_mismatch.unwrap_or(false),
            "hardware_mismatch_desc": self.hardware_mismatch_desc,
            "hardware_mismatch_time": self.hardware_mismatch_time,
            "hardware_cctv_window": self.hardware_cctv_window,
            "hardware_last_sync": self.hardware_last_sync,
            "pc_kode": pc.0,
            "pc_nama": pc.1,
            "pc_grup_id": pc.2,
            "pc_grup_nama": pc.3,
            "health": health,
        });
        if let (Some(m), Some(obj)) = (metric, out.as_object_mut()) {
            for k in [
                "cpu_usage",
                "cpu_temp",
                "gpu_temp",
                "total_ram",
                "nic_speed",
                "motherboard",
                "cpu_name",
                "gpu_name",
                "active_window",
            ] {
                if let Some(v) = m.get(k) {
                    obj.insert(k.to_string(), v.clone());
                }
            }
        }
        out
    }
}

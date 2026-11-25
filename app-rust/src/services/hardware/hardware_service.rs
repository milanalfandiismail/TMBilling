//! Telemetri hardware: parsing metrik, baseline anti-maling, riwayat proses.

use serde_json::{json, Map, Value};

use crate::repositories::{hardware as hw_repo, pc as pc_repo};
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::{logger, time};

/// Grace period cold boot: mismatch hardware diabaikan selama proses booting.

fn metric_float(v: Option<&Value>, field: &str) -> Result<f64, String> {
    // Metrik yang tidak dikirim agent dianggap 0 (sama seperti Python), bukan galat.
    let raw = match v {
        None | Some(Value::Null) => 0.0,
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) if s.trim().is_empty() => 0.0,
        Some(Value::String(s)) => s.trim().parse::<f64>().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    if !raw.is_finite() {
        return Err(format!("Metrik {field} tidak valid"));
    }
    Ok((raw * 10.0).round() / 10.0)
}

fn text_of(data: &Map<String, Value>, keys: &[&str], default: &str) -> String {
    for k in keys {
        if let Some(v) = data.get(*k) {
            if !v.is_null() {
                return match v {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
            }
        }
    }
    default.to_string()
}

fn serial_of(serials: &Map<String, Value>, key: &str) -> Option<String> {
    serials
        .get(key)
        .map(|v| match v {
            Value::String(s) => s.trim().to_string(),
            Value::Null => String::new(),
            other => other.to_string(),
        })
        .filter(|s| !s.is_empty())
}

fn kosong(serial: &str) -> bool {
    matches!(serial, "Unknown" | "" | "None" | "null")
}

fn gpu_generik(pnp: &str, nama: &str) -> bool {
    let p = pnp.to_lowercase();
    let n = nama.to_lowercase();
    if p.contains("root\\basicdisplay") {
        return true;
    }
    if n.contains("microsoft basic")
        || n.contains("basic display")
        || n.contains("standard vga")
        || n.contains("remote display")
    {
        return true;
    }
    kosong(&p) && kosong(&n)
}

fn cctv_window(dari: &str, sampai: &str) -> String {
    format!("{dari} s/d {sampai}")
}

pub struct Hasil {
    pub kode: String,
    pub polling: i64,
}

pub async fn process_metric(
    st: &AppState,
    client_ip: &str,
    data: &Value,
) -> Result<Hasil, (u16, String)> {
    let obj = data
        .as_object()
        .ok_or((400, "No JSON payload provided".to_string()))?;

    let pc = match st.pc_network.resolve(&st.pool, client_ip, None).await {
        Ok(Some(meta)) => pc_repo::get_by_id(&st.pool, meta.id).await.ok().flatten(),
        _ => None,
    };
    let pc = match pc {
        Some(p) => p,
        None => match pc_repo::find_by_ip(&st.pool, client_ip).await {
            Ok(Some(p)) => {
                st.pc_network.invalidate();
                p
            }
            _ => {
                return Err((
                    404,
                    format!("PC dengan IP '{client_ip}' belum terdaftar di database kasir."),
                ))
            }
        },
    };

    let cpu_usage = metric_float(obj.get("CpuUsage").or_else(|| obj.get("cpu_usage")), "CPU")
        .map_err(|e| (400, e))?;
    let cpu_temp = metric_float(
        obj.get("CpuTemp").or_else(|| obj.get("cpu_temp")),
        "CPU temp",
    )
    .map_err(|e| (400, e))?;
    let gpu_temp = metric_float(
        obj.get("GpuTemp").or_else(|| obj.get("gpu_temp")),
        "GPU temp",
    )
    .map_err(|e| (400, e))?;
    let total_ram = text_of(obj, &["TotalRam", "total_ram"], "Unknown");
    let nic_speed = text_of(obj, &["NicSpeed", "nic_speed"], "Unknown");
    let motherboard = text_of(obj, &["Motherboard", "motherboard"], "Unknown");
    let cpu_name = text_of(obj, &["CpuName", "cpu_name"], "Unknown");
    let gpu_name = text_of(obj, &["GpuName", "gpu_name"], "Unknown");
    let active_window = text_of(obj, &["ActiveWindow", "active_window"], "");

    let was_offline = !st.online.is_online(pc.id);
    if was_offline {
        st.online.touch(pc.id);
    }
    let in_grace = false;

    if let Some(list) = obj
        .get("ProcessList")
        .or_else(|| obj.get("process_list"))
        .and_then(|v| v.as_array())
    {
        let rows: Vec<(String, String)> = list
            .iter()
            .filter_map(|p| {
                let name = p
                    .get("name")
                    .or_else(|| p.get("Name"))?
                    .as_str()?
                    .to_string();
                let title = p
                    .get("title")
                    .or_else(|| p.get("Title"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Some((name, title))
            })
            .collect();
        let mut nama_db = hw_repo::process_names(&st.pool, pc.id)
            .await
            .unwrap_or_default();
        let mut nama_baru: Vec<String> = rows.iter().map(|(n, _)| n.clone()).collect();
        nama_db.sort();
        nama_baru.sort();
        if nama_db != nama_baru {
            let _guard = st.write().await;
            let _ = hw_repo::replace_processes(&st.pool, pc.id, &rows).await;
        }
        let stamp = time::now_db().and_utc().timestamp_millis();
        st.processes.set(
            pc.id,
            rows.iter()
                .map(|(n, t)| json!({"name": n, "title": t, "last_update": time::db_str(time::now_db())}))
                .collect(),
            stamp,
        );
    }

    let ram_pct = calculate_ram_pct(&total_ram, obj);
    st.history.push(pc.id, cpu_usage, ram_pct, 3);
    st.uptime
        .heartbeat(pc.id, false, time::now_db().and_utc().timestamp());

    let metrik = hw_repo::Metrik {
        cpu_usage,
        cpu_temp,
        gpu_temp,
        total_ram: &total_ram,
        nic_speed: &nic_speed,
        motherboard: &motherboard,
        cpu_name: &cpu_name,
        gpu_name: &gpu_name,
        active_window: &active_window,
    };

    let now = time::db_str(time::now_db());
    let row = hw_repo::get_by_pc_id(&st.pool, pc.id)
        .await
        .map_err(|e| (500, e.to_string()))?;

    if row.is_none() {
        let id = hw_repo::insert_row(&st.pool, pc.id, &metrik)
            .await
            .map_err(|e| (500, e.to_string()))?;
        let specs = obj
            .get("HardwareSerials")
            .or_else(|| obj.get("hardware_serials"))
            .and_then(|v| v.as_object())
            .map(|serials| serde_json::to_string(serials).unwrap_or_else(|_| "{}".into()));
        let keamanan = hw_repo::Keamanan {
            baseline: specs.as_deref(),
            current_specs: specs.as_deref(),
            mismatch: false,
            desc: None,
            mismatch_time: None,
            cctv_window: None,
            last_sync: Some(&now),
        };
        hw_repo::set_keamanan(&st.pool, id, &keamanan)
            .await
            .map_err(|e| (500, e.to_string()))?;
    } else {
        let r = row.as_ref().unwrap();
        hw_repo::update_metrics(&st.pool, r.id, &metrik)
            .await
            .map_err(|e| (500, e.to_string()))?;
        if let Some(serials) = obj
            .get("HardwareSerials")
            .or_else(|| obj.get("hardware_serials"))
            .and_then(|v| v.as_object())
        {
            let specs = serde_json::to_string(serials).unwrap_or_else(|_| "{}".into());
            let mut reasons: Vec<String> = Vec::new();
            let baseline: Option<Value> = r
                .hardware_baseline
                .as_ref()
                .and_then(|b| serde_json::from_str(b).ok());
            match baseline.as_ref().and_then(|b| b.as_object()) {
                None => {}
                Some(base) => {
                    for (key, label) in [
                        ("MotherboardSerial", "Serial Motherboard"),
                        ("CpuId", "Processor ID"),
                    ] {
                        let b = serial_of(base, key).unwrap_or_default();
                        let c = serial_of(serials, key).unwrap_or_default();
                        if !kosong(&b) {
                            if kosong(&c) {
                                if !in_grace {
                                    reasons.push(format!(
                                        "{label} hilang/tidak terdeteksi (sebelumnya '{b}')"
                                    ));
                                }
                            } else if b != c {
                                let ket = if key == "CpuId" {
                                    format!("Processor ID berubah (dari '{b}' ke '{c}')")
                                } else {
                                    format!("Motherboard berubah (dari '{b}' ke '{c}')")
                                };
                                reasons.push(ket);
                            }
                        }
                    }
                    let b_pnp = serial_of(base, "GpuPnpId").unwrap_or_default();
                    let c_pnp = serial_of(serials, "GpuPnpId").unwrap_or_default();
                    let b_nama = serial_of(base, "GpuName").unwrap_or_default();
                    let c_nama = serial_of(serials, "GpuName").unwrap_or_else(|| gpu_name.clone());
                    if !gpu_generik(&b_pnp, &b_nama) {
                        if gpu_generik(&c_pnp, &c_nama) {
                            if !in_grace {
                                let prev = if !b_nama.is_empty() && b_nama != "Unknown" {
                                    b_nama.clone()
                                } else {
                                    b_pnp.clone()
                                };
                                reasons.push(format!(
                                    "GPU/VGA fisik dicopot atau hilang (sebelumnya '{prev}')"
                                ));
                            }
                        } else if !kosong(&b_pnp) && !kosong(&c_pnp) && b_pnp != c_pnp {
                            reasons.push("GPU/VGA ditukar (PNP Device ID berbeda)".into());
                        }
                    }
                    if let Some(base_disks) = base.get("DiskSerials").and_then(|v| v.as_array()) {
                        let base_set: Vec<String> = base_disks
                            .iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect();
                        let cur_set: Vec<String> = serials
                            .get("DiskSerials")
                            .and_then(|v| v.as_array())
                            .map(|a| {
                                a.iter()
                                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default();
                        if !base_set.is_empty() {
                            let hilang = base_set.iter().any(|d| !cur_set.contains(d));
                            if hilang && (!in_grace || !cur_set.is_empty()) {
                                reasons.push("Penyimpanan (SSD/HDD) dicopot/hilang".into());
                            }
                        }
                    }
                }
            }

            let sudah_mismatch = r.hardware_mismatch.unwrap_or(false);
            if !reasons.is_empty() {
                if !sudah_mismatch {
                    let desc = reasons.join("; ");
                    let window = cctv_window(&now, &now);
                    let mut k = hw_repo::Keamanan {
                        baseline: r.hardware_baseline.as_deref(),
                        current_specs: Some(&specs),
                        mismatch: true,
                        desc: Some(&desc),
                        mismatch_time: Some(&now),
                        cctv_window: Some(&window),
                        last_sync: r.hardware_last_sync.as_deref(),
                    };
                    if r.hardware_baseline.is_none() {
                        k.baseline = Some(&specs);
                    }
                    hw_repo::set_keamanan(&st.pool, r.id, &k)
                        .await
                        .map_err(|e| (500, e.to_string()))?;
                    logger::rec(
                        "system",
                        "HARDWARE_ALERT",
                        &format!("PC {} terdeteksi mismatch: {desc} ({window})", pc.kode),
                    );
                }
            } else if sudah_mismatch {
                let mut k = hw_repo::Keamanan {
                    baseline: r.hardware_baseline.as_deref(),
                    current_specs: Some(&specs),
                    mismatch: false,
                    desc: None,
                    mismatch_time: None,
                    cctv_window: None,
                    last_sync: Some(&now),
                };
                if r.hardware_baseline.is_none() {
                    k.baseline = Some(&specs);
                }
                hw_repo::set_keamanan(&st.pool, r.id, &k)
                    .await
                    .map_err(|e| (500, e.to_string()))?;
            } else {
                let mut k = hw_repo::Keamanan {
                    baseline: r.hardware_baseline.as_deref(),
                    current_specs: Some(&specs),
                    mismatch: false,
                    desc: None,
                    mismatch_time: None,
                    cctv_window: None,
                    last_sync: r.hardware_last_sync.as_deref(),
                };
                if r.hardware_baseline.is_none() {
                    k.baseline = Some(&specs);
                }
                hw_repo::set_keamanan(&st.pool, r.id, &k)
                    .await
                    .map_err(|e| (500, e.to_string()))?;
            }
        }
    }

    st.metrics.set(
        pc.id,
        json!({
            "cpu_usage": cpu_usage,
            "cpu_temp": cpu_temp,
            "gpu_temp": gpu_temp,
            "total_ram": total_ram,
            "nic_speed": nic_speed,
            "motherboard": motherboard,
            "cpu_name": cpu_name,
            "gpu_name": gpu_name,
            "active_window": active_window,
        }),
    );

    Ok(Hasil {
        kode: pc.kode,
        polling: settings_service::client_polling_interval(st).await,
    })
}

fn calculate_ram_pct(total_ram: &str, data: &Map<String, Value>) -> f64 {
    let used: f64 = data
        .get("ProcessList")
        .or_else(|| data.get("process_list"))
        .and_then(|v| v.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|p| p.get("memory").or_else(|| p.get("Memory")))
                .filter_map(|v| v.as_f64())
                .sum()
        })
        .unwrap_or(0.0);
    let total = parse_gb(total_ram);
    if total <= 0.0 {
        return 0.0;
    }
    ((used / total) * 1000.0).round() / 10.0
}

fn parse_gb(v: &str) -> f64 {
    let s = v.trim().to_uppercase();
    s.trim_end_matches("GB")
        .trim()
        .parse::<f64>()
        .unwrap_or(0.0)
}

pub fn health(st: &AppState, pc_id: i64, metric: &Value) -> Value {
    let mut warnings: Vec<String> = Vec::new();
    let cpu_temp = metric
        .get("cpu_temp")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let gpu_temp = metric
        .get("gpu_temp")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    if cpu_temp >= 85.0 {
        warnings.push(format!("CPU Overheat ({cpu_temp}°C)"));
    }
    if gpu_temp >= 85.0 {
        warnings.push(format!("GPU Overheat ({gpu_temp}°C)"));
    }
    let history = st.history.get(pc_id);
    if history.len() >= 3 {
        if history.iter().all(|h| h.cpu_usage >= 90.0) {
            warnings.push("CPU High Usage (>90%)".into());
        }
        if history.iter().all(|h| h.ram_usage_pct >= 90.0) {
            warnings.push("RAM High Usage (>90%)".into());
        }
    }
    if warnings.is_empty() {
        json!({"status": "normal", "message": "Optimal"})
    } else {
        json!({"status": "danger", "message": warnings.join("; ")})
    }
}

pub async fn list(st: &AppState) -> Result<Vec<Value>, String> {
    let rows = hw_repo::get_all(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let mut out: Vec<Value> = Vec::new();
    for row in rows.iter() {
        let Some(pc) = hw_repo::pc_meta(&st.pool, row.pc_id).await.ok().flatten() else {
            continue;
        };
        let metric = st.metrics.get(row.pc_id);
        let health = health(st, row.pc_id, &metric.clone().unwrap_or_else(|| json!({})));
        out.push(row.to_json(metric.as_ref(), &health, (&pc.0, &pc.1, pc.2, &pc.3)));
    }
    out.sort_by_key(|v| {
        (
            v.get("pc_grup_id").and_then(|x| x.as_i64()).unwrap_or(0),
            crate::utils::helpers::natural_sort_key(
                v.get("pc_kode").and_then(|x| x.as_str()).unwrap_or(""),
            ),
        )
    });
    Ok(out)
}

pub async fn one(st: &AppState, pc_id: i64) -> Result<Value, String> {
    let row = hw_repo::get_by_pc_id(&st.pool, pc_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Hardware tidak ditemukan")?;
    let pc = hw_repo::pc_meta(&st.pool, pc_id)
        .await
        .ok()
        .flatten()
        .unwrap_or(("Unknown".into(), "Unknown".into(), 0, "Unknown".into()));
    let metric = st.metrics.get(pc_id);
    let health = health(st, pc_id, &metric.clone().unwrap_or_else(|| json!({})));
    Ok(row.to_json(metric.as_ref(), &health, (&pc.0, &pc.1, pc.2, &pc.3)))
}

pub async fn delete(st: &AppState, hardware_id: i64, operator: &str) -> Result<String, String> {
    let row = hw_repo::get_by_id(&st.pool, hardware_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data hardware monitor tidak ditemukan")?;
    let kode = hw_repo::pc_meta(&st.pool, row.pc_id)
        .await
        .ok()
        .flatten()
        .map(|p| p.0)
        .unwrap_or_else(|| "Unknown".into());
    st.metrics.forget(row.pc_id);
    hw_repo::delete_by_id(&st.pool, hardware_id)
        .await
        .map_err(|e| e.to_string())?;
    logger::rec(
        operator,
        "HAPUS_MONITOR",
        &format!("Data hardware monitor PC {kode} dihapus manual oleh kasir"),
    );
    Ok(kode)
}

pub async fn update_baseline(st: &AppState, pc_id: i64, operator: &str) -> Result<String, String> {
    let row = hw_repo::get_by_pc_id(&st.pool, pc_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data hardware monitor tidak ditemukan")?;
    let specs = row
        .hardware_current_specs
        .clone()
        .ok_or("Belum ada data telemetry yang masuk dari PC ini untuk dijadikan baseline")?;
    let now = time::db_str(time::now_db());
    let k = hw_repo::Keamanan {
        baseline: Some(&specs),
        current_specs: Some(&specs),
        mismatch: false,
        desc: None,
        mismatch_time: None,
        cctv_window: None,
        last_sync: Some(&now),
    };
    hw_repo::set_keamanan(&st.pool, row.id, &k)
        .await
        .map_err(|e| e.to_string())?;
    let kode = hw_repo::pc_meta(&st.pool, pc_id)
        .await
        .ok()
        .flatten()
        .map(|p| p.0)
        .unwrap_or_else(|| "Unknown".into());
    logger::rec(
        operator,
        "UPDATE_BASELINE",
        &format!("Baseline hardware PC {kode} diperbarui"),
    );
    Ok(kode)
}

pub async fn processes(
    st: &AppState,
    pc_id: i64,
) -> Result<(Vec<Value>, i64, Option<String>), String> {
    let mem = st.processes.get(pc_id);
    let rows = match &mem {
        Some((list, _)) => list.clone(),
        None => hw_repo::processes(&st.pool, pc_id)
            .await
            .map_err(|e| e.to_string())?,
    };
    let mem_ts = st.processes.last_updated(pc_id);
    let db_ts = hw_repo::last_update(&st.pool, pc_id)
        .await
        .ok()
        .flatten()
        .and_then(|v| time::parse_dt(&v))
        .map(|d| d.and_utc().timestamp_millis())
        .unwrap_or(0);
    let stamp = mem_ts.max(db_ts);
    let tz = crate::services::settings::settings_service::active_timezone(st).await;
    let label = if stamp > 0 {
        Some(time::format_local(
            chrono::DateTime::from_timestamp_millis(stamp)
                .map(|d| d.naive_utc())
                .unwrap_or_else(time::now_db),
            &tz,
            "%d/%m/%Y %H:%M",
        ))
    } else {
        None
    };
    Ok((rows, stamp, label))
}

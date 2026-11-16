//! Akses tabel `hardware_monitor` dan `pc_process`.

use serde_json::Value;
use sqlx::SqlitePool;

use crate::models::hardware::{HardwareMonitor, KOLOM};

pub async fn get_by_pc_id(
    pool: &SqlitePool,
    pc_id: i64,
) -> Result<Option<HardwareMonitor>, sqlx::Error> {
    sqlx::query_as::<_, HardwareMonitor>(&format!(
        "SELECT {KOLOM} FROM hardware_monitor WHERE pc_id = ? ORDER BY id DESC LIMIT 1"
    ))
    .bind(pc_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_all(pool: &SqlitePool) -> Result<Vec<HardwareMonitor>, sqlx::Error> {
    sqlx::query_as::<_, HardwareMonitor>(&format!(
        "SELECT {KOLOM} FROM hardware_monitor ORDER BY pc_id"
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<Option<HardwareMonitor>, sqlx::Error> {
    sqlx::query_as::<_, HardwareMonitor>(&format!(
        "SELECT {KOLOM} FROM hardware_monitor WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn pc_meta(
    pool: &SqlitePool,
    pc_id: i64,
) -> Result<Option<(String, String, i64, String)>, sqlx::Error> {
    let row: Option<(String, Option<String>, Option<i64>, Option<String>)> = sqlx::query_as(
        "SELECT p.kode, p.nama, p.grup_id, g.nama FROM pc p LEFT JOIN grup g ON g.id = p.grup_id WHERE p.id = ?",
    )
    .bind(pc_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(kode, nama, grup_id, grup_nama)| {
        (
            kode,
            nama.unwrap_or_else(|| "Unknown".into()),
            grup_id.unwrap_or(0),
            grup_nama.unwrap_or_else(|| "Unknown".into()),
        )
    }))
}

pub struct Metrik<'a> {
    pub cpu_usage: f64,
    pub cpu_temp: f64,
    pub gpu_temp: f64,
    pub total_ram: &'a str,
    pub nic_speed: &'a str,
    pub motherboard: &'a str,
    pub cpu_name: &'a str,
    pub gpu_name: &'a str,
    pub active_window: &'a str,
}

pub async fn insert_row(pool: &SqlitePool, pc_id: i64, m: &Metrik<'_>) -> Result<i64, sqlx::Error> {
    sqlx::query(
        "INSERT INTO hardware_monitor (pc_id, cpu_usage, cpu_temp, gpu_temp, total_ram, nic_speed, \
motherboard, cpu_name, gpu_name, active_window, hardware_mismatch, last_update) \
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
    )
    .bind(pc_id)
    .bind(m.cpu_usage)
    .bind(m.cpu_temp)
    .bind(m.gpu_temp)
    .bind(m.total_ram)
    .bind(m.nic_speed)
    .bind(m.motherboard)
    .bind(m.cpu_name)
    .bind(m.gpu_name)
    .bind(m.active_window)
    .bind(crate::utils::time::db_str(crate::utils::time::now_db()))
    .execute(pool)
    .await?;
    sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(pool)
        .await
}

/// Metrik selalu disegarkan; kolom "Unknown" tidak menimpa nilai valid.
pub async fn update_metrics(pool: &SqlitePool, id: i64, m: &Metrik<'_>) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE hardware_monitor SET cpu_usage = ?, cpu_temp = ?, gpu_temp = ?, total_ram = ?, \
nic_speed = ?, motherboard = CASE WHEN ? <> 'Unknown' THEN ? ELSE motherboard END, \
cpu_name = CASE WHEN ? <> 'Unknown' THEN ? ELSE cpu_name END, \
gpu_name = CASE WHEN ? <> 'Unknown' THEN ? ELSE gpu_name END, active_window = ?, last_update = ? \
WHERE id = ?",
    )
    .bind(m.cpu_usage)
    .bind(m.cpu_temp)
    .bind(m.gpu_temp)
    .bind(m.total_ram)
    .bind(m.nic_speed)
    .bind(m.motherboard)
    .bind(m.motherboard)
    .bind(m.cpu_name)
    .bind(m.cpu_name)
    .bind(m.gpu_name)
    .bind(m.gpu_name)
    .bind(m.active_window)
    .bind(crate::utils::time::db_str(crate::utils::time::now_db()))
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub struct Keamanan<'a> {
    pub baseline: Option<&'a str>,
    pub current_specs: Option<&'a str>,
    pub mismatch: bool,
    pub desc: Option<&'a str>,
    pub mismatch_time: Option<&'a str>,
    pub cctv_window: Option<&'a str>,
    pub last_sync: Option<&'a str>,
}

pub async fn set_keamanan(pool: &SqlitePool, id: i64, k: &Keamanan<'_>) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE hardware_monitor SET hardware_baseline = ?, hardware_current_specs = ?, \
hardware_mismatch = ?, hardware_mismatch_desc = ?, hardware_mismatch_time = ?, \
hardware_cctv_window = ?, hardware_last_sync = ? WHERE id = ?",
    )
    .bind(k.baseline)
    .bind(k.current_specs)
    .bind(k.mismatch)
    .bind(k.desc)
    .bind(k.mismatch_time)
    .bind(k.cctv_window)
    .bind(k.last_sync)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_by_id(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM hardware_monitor WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn last_update(pool: &SqlitePool, pc_id: i64) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT last_update FROM hardware_monitor WHERE pc_id = ? ORDER BY id DESC LIMIT 1",
    )
    .bind(pc_id)
    .fetch_optional(pool)
    .await
}

pub async fn process_names(pool: &SqlitePool, pc_id: i64) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT name FROM pc_process WHERE pc_id = ?")
        .bind(pc_id)
        .fetch_all(pool)
        .await
}

pub async fn replace_processes(
    pool: &SqlitePool,
    pc_id: i64,
    rows: &[(String, String)],
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM pc_process WHERE pc_id = ?")
        .bind(pc_id)
        .execute(pool)
        .await?;
    let now = crate::utils::time::db_str(crate::utils::time::now_db());
    for (name, title) in rows {
        sqlx::query("INSERT INTO pc_process (pc_id, name, title, last_update) VALUES (?, ?, ?, ?)")
            .bind(pc_id)
            .bind(name)
            .bind(title)
            .bind(&now)
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn processes(pool: &SqlitePool, pc_id: i64) -> Result<Vec<Value>, sqlx::Error> {
    let rows: Vec<(i64, i64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT id, pc_id, name, title, last_update FROM pc_process WHERE pc_id = ? ORDER BY name",
    )
    .bind(pc_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, pc_id, name, title, upd)| {
            serde_json::json!({
                "id": id,
                "pc_id": pc_id,
                "name": name,
                "title": title,
                "last_update": upd,
            })
        })
        .collect())
}

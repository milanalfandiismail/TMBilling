//! Log uptime harian PC (`pc_uptime_log`) — laporan harian & rentang.

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::utils::time;

pub struct Baris {
    pub pc_id: i64,
    pub pc_kode: String,
    pub grup: String,
    pub grup_warna: String,
    pub pc_grup_id: i64,
    pub tanggal: String,
    pub online: i64,
    pub billing: i64,
    pub first_seen: Option<String>,
    pub last_seen: Option<String>,
}

const SELECT: &str = "SELECT l.pc_id, COALESCE(pc.kode,'Unknown') AS pc_kode,
        COALESCE(g.nama,'reguler') AS grup, COALESCE(g.warna,'#888888') AS grup_warna,
        COALESCE(pc.grup_id,0) AS pc_grup_id, l.tanggal,
        l.total_online_seconds AS online, l.total_billing_seconds AS billing,
        l.first_seen, l.last_seen
    FROM pc_uptime_log l
    LEFT JOIN pc ON pc.id = l.pc_id
    LEFT JOIN grup g ON g.id = pc.grup_id";

async fn rows(pool: &SqlitePool, sql: &str, binds: &[&str]) -> Result<Vec<Baris>, sqlx::Error> {
    let mut q = sqlx::query_as::<
        _,
        (
            i64,
            String,
            String,
            String,
            i64,
            String,
            i64,
            i64,
            Option<String>,
            Option<String>,
        ),
    >(sql);
    for b in binds {
        q = q.bind(*b);
    }
    Ok(q.fetch_all(pool)
        .await?
        .into_iter()
        .map(|r| Baris {
            pc_id: r.0,
            pc_kode: r.1,
            grup: r.2,
            grup_warna: r.3,
            pc_grup_id: r.4,
            tanggal: r.5,
            online: r.6,
            billing: r.7,
            first_seen: r.8,
            last_seen: r.9,
        })
        .collect())
}

pub async fn daily(pool: &SqlitePool, tanggal: &str) -> Result<Vec<Baris>, sqlx::Error> {
    rows(pool, &format!("{SELECT} WHERE l.tanggal = ?"), &[tanggal]).await
}

pub async fn range(pool: &SqlitePool, start: &str, end: &str) -> Result<Vec<Baris>, sqlx::Error> {
    rows(
        pool,
        &format!("{SELECT} WHERE l.tanggal >= ? AND l.tanggal <= ?"),
        &[start, end],
    )
    .await
}

/// Tambahkan delta uptime hasil `UptimeStore::drain` ke log harian.
pub async fn flush(
    pool: &SqlitePool,
    tanggal: &str,
    rows: &[(i64, i64, i64)],
) -> Result<(), sqlx::Error> {
    let now = time::now_db().format("%Y-%m-%d %H:%M:%S").to_string();
    for (pc_id, online, billing) in rows {
        if *online <= 0 && *billing <= 0 {
            continue;
        }
        sqlx::query(
            "INSERT INTO pc_uptime_log (pc_id, tanggal, total_online_seconds, total_billing_seconds, first_seen, last_seen)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(pc_id, tanggal) DO UPDATE SET
               total_online_seconds = total_online_seconds + excluded.total_online_seconds,
               total_billing_seconds = total_billing_seconds + excluded.total_billing_seconds,
               last_seen = excluded.last_seen",
        )
        .bind(pc_id)
        .bind(tanggal)
        .bind(online)
        .bind(billing)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Hapus log lebih tua dari tanggal batas (retensi 366 hari).
pub async fn prune(pool: &SqlitePool, batas_tanggal: &str) -> Result<u64, sqlx::Error> {
    let res = sqlx::query("DELETE FROM pc_uptime_log WHERE tanggal < ?")
        .bind(batas_tanggal)
        .execute(pool)
        .await?;
    Ok(res.rows_affected())
}

fn menit(sec: i64) -> f64 {
    (sec as f64 / 60.0 * 10.0).round() / 10.0
}

fn utilisasi(billing: i64, online: i64) -> f64 {
    if online <= 0 {
        return 0.0;
    }
    ((billing as f64 / online as f64 * 100.0 * 10.0).round() / 10.0).min(100.0)
}

pub fn daily_json(b: &Baris, tz: &str) -> Value {
    let ts = |v: &Option<String>| v.as_deref().and_then(time::parse_dt);
    json!({
        "id": 0,
        "pc_id": b.pc_id,
        "pc_kode": b.pc_kode,
        "grup": b.grup,
        "grup_warna": b.grup_warna,
        "tanggal": b.tanggal,
        "total_online_menit": menit(b.online),
        "total_billing_menit": menit(b.billing),
        "total_online_seconds": b.online,
        "total_billing_seconds": b.billing,
        "first_seen": ts(&b.first_seen),
        "last_seen": ts(&b.last_seen),
        "first_seen_display": ts(&b.first_seen).map(|d| time::format_display(d, tz)).unwrap_or_else(|| "-".into()),
        "last_seen_display": ts(&b.last_seen).map(|d| time::format_display(d, tz)).unwrap_or_else(|| "-".into()),
        "utilisasi_persen": utilisasi(b.billing, b.online),
    })
}

pub fn range_json(rows: &[Baris]) -> Value {
    use std::collections::BTreeMap;
    let mut agg: BTreeMap<String, (String, String, i64, i64, i64, i64)> = BTreeMap::new();
    let mut total_online = 0i64;
    let mut total_billing = 0i64;
    for b in rows {
        let e = agg.entry(b.pc_kode.clone()).or_insert((
            b.grup.clone(),
            b.grup_warna.clone(),
            b.pc_grup_id,
            0,
            0,
            0,
        ));
        e.3 += b.online;
        e.4 += b.billing;
        if b.online > 0 {
            e.5 += 1;
        }
        total_online += b.online;
        total_billing += b.billing;
    }
    let mut pcs: Vec<Value> = agg
        .into_iter()
        .map(|(kode, (grup, warna, gid, online, billing, hari))| {
            json!({
                "pc_kode": kode,
                "grup": grup,
                "grup_warna": warna,
                "pc_grup_id": gid,
                "total_online_menit": menit(online),
                "total_billing_menit": menit(billing),
                "hari_aktif": hari,
                "utilisasi_persen": utilisasi(billing, online),
            })
        })
        .collect();
    pcs.sort_by(|a, b| {
        let ga = a.get("pc_grup_id").and_then(|v| v.as_i64()).unwrap_or(0);
        let gb = b.get("pc_grup_id").and_then(|v| v.as_i64()).unwrap_or(0);
        ga.cmp(&gb).then_with(|| {
            let ka = a.get("pc_kode").and_then(|v| v.as_str()).unwrap_or("");
            let kb = b.get("pc_kode").and_then(|v| v.as_str()).unwrap_or("");
            crate::utils::helpers::natural_sort_key(ka)
                .cmp(&crate::utils::helpers::natural_sort_key(kb))
        })
    });
    json!({
        "summary": {
            "total_online_menit": menit(total_online),
            "total_billing_menit": menit(total_billing),
            "utilisasi_persen": utilisasi(total_billing, total_online),
            "total_pc_tercatat": pcs.len(),
        },
        "pcs": pcs,
    })
}

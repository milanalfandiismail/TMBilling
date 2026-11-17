//! Data kartu denah meja + omzet hari ini.

use std::sync::Mutex;

use serde_json::{json, Map, Value};
use sqlx::SqlitePool;

use crate::repositories::{menu as menu_repo, pc as pc_repo, transaksi as trx_repo};
use crate::state::AppState;
use crate::utils::time;

/// Omzet agregat di-cache 5 detik: dashboard mem-polling tiap detik.
static OMZET: Mutex<Option<(i64, (i64, i64))>> = Mutex::new(None);

async fn omzet(st: &AppState) -> (i64, i64) {
    let sekarang = chrono::Utc::now().timestamp();
    if let Ok(guard) = OMZET.lock() {
        if let Some((stamp, nilai)) = *guard {
            if sekarang - stamp < 5 {
                return nilai;
            }
        }
    }
    let (mulai, akhir) = time::day_range_utc(time::today_local(&st.cfg.timezone), &st.cfg.timezone);
    let _ = &akhir;
    let billing = trx_repo::total_pemasukan(&st.pool, Some(&mulai), None, None)
        .await
        .unwrap_or(0);
    let kantin = menu_repo::total_pemasukan_by_date(&st.pool, Some(&mulai), None, None)
        .await
        .unwrap_or(0);
    if let Ok(mut guard) = OMZET.lock() {
        *guard = Some((sekarang, (billing, kantin)));
    }
    (billing, kantin)
}

async fn metrik(
    pool: &SqlitePool,
) -> std::collections::HashMap<i64, (Option<String>, Option<String>, i64, Option<String>)> {
    // (active_window, nic_speed, mismatch flag, mismatch_desc)
    let rows: Vec<(i64, Option<String>, Option<String>, Option<i64>, Option<String>)> = sqlx::query_as(
        "SELECT pc_id, active_window, nic_speed, hardware_mismatch, hardware_mismatch_desc FROM hardware_monitor",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    rows.into_iter()
        .map(|(id, window, nic, mismatch, desc)| (id, (window, nic, mismatch.unwrap_or(0), desc)))
        .collect()
}

pub async fn pc_list(st: &AppState) -> Value {
    let pcs = pc_repo::get_all(&st.pool, true, None, None)
        .await
        .unwrap_or_default();
    let sesi = pc_repo::sesi_map(&st.pool).await.unwrap_or_default();
    let hw = metrik(&st.pool).await;
    let (billing, kantin) = omzet(st).await;

    let mut daftar = Vec::with_capacity(pcs.len());
    let mut by_grup: Map<String, Value> = Map::new();
    let mut grup_meta: Map<String, Value> = Map::new();

    let mut urut = pcs;
    urut.sort_by(|a, b| {
        (
            a.grup_id.unwrap_or(0),
            crate::utils::helpers::natural_sort_key(&a.kode),
        )
            .cmp(&(
                b.grup_id.unwrap_or(0),
                crate::utils::helpers::natural_sort_key(&b.kode),
            ))
    });

    for pc in urut {
        let ringkas = sesi.get(&pc.id).cloned();
        let online = st.online.is_online(pc.id);
        let mismatch = st
            .mismatch
            .is_mismatch(&pc.ip_address.clone().unwrap_or_default());
        let status_koneksi = if mismatch {
            "api_key_mismatch"
        } else if online {
            "online"
        } else {
            "offline"
        };
        let mut item = pc.to_json(
            ringkas.as_ref(),
            crate::services::pc::pc_service::screenshot_time(st, &pc.kode),
        );
        if let Value::Object(map) = &mut item {
            map.insert("online".into(), json!(online));
            map.insert("status_koneksi".into(), json!(status_koneksi));
            map.insert("api_key_mismatch".into(), json!(mismatch));
            let (window, nic, flag, desc) =
                hw.get(&pc.id).cloned().unwrap_or((None, None, 0, None));
            map.insert("active_window".into(), json!(window));
            map.insert("nic_speed".into(), json!(nic));
            map.insert("hardware_mismatch".into(), json!(flag != 0));
            map.insert("hardware_mismatch_desc".into(), json!(desc));
            map.insert(
                "is_admin".into(),
                json!(ringkas
                    .as_ref()
                    .map(|s| s.tipe.as_deref() == Some("admin"))
                    .unwrap_or(false)),
            );
            map.insert(
                "is_system".into(),
                json!(ringkas
                    .as_ref()
                    .map(|s| s.tipe.as_deref() == Some("admin")
                        && s.nama_guest.as_deref() == Some("SYSTEM"))
                    .unwrap_or(false)),
            );
            map.insert(
                "sesi_detail".into(),
                match &ringkas {
                    Some(s) => json!({
                        "id": s.id,
                        "tipe": s.tipe,
                        "nama": s.nama_guest,
                        "nama_guest": s.nama_guest,
                        "is_afk": s.is_afk,
                        "mulai_pada": s.mulai_pada,
                        "durasi_beli_menit": s.durasi_beli_menit,
                        "sisa_menit": s.sisa_menit,
                        "sisa_waktu": s.sisa_menit,
                    }),
                    None => Value::Null,
                },
            );
        }
        let nama_grup = pc.grup_nama.clone().unwrap_or_else(|| "reguler".into());
        by_grup
            .entry(nama_grup.clone())
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .map(|arr| arr.push(item.clone()));
        grup_meta.insert(
            nama_grup,
            json!({"warna": pc.grup_warna.clone().unwrap_or_else(|| "#888888".into()),
                   "id": pc.grup_id.unwrap_or(0)}),
        );
        daftar.push(item);
    }

    json!({
        "pc_list": daftar,
        "by_grup": by_grup,
        "grup_meta": grup_meta,
        "omzet_hari_ini": billing + kantin,
        "omzet_billing": billing,
        "omzet_kantin": kantin,
    })
}

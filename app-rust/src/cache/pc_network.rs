//! Pemetaan IP/MAC ke metadata PC di RAM (setara `PCNetworkCacheStore`).

use anyhow::Result;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize)]
pub struct PcMeta {
    pub id: i64,
    pub kode: String,
    pub ip: String,
    pub mac: Option<String>,
    pub is_admin_mode: bool,
    pub grup_id: Option<i64>,
}

#[derive(Default)]
struct Snapshot {
    by_ip: HashMap<String, PcMeta>,
    by_mac: HashMap<String, PcMeta>,
    loaded: bool,
}

#[derive(Default)]
pub struct PcNetworkCache {
    inner: Mutex<Snapshot>,
}

fn norm_mac(mac: &str) -> String {
    mac.trim().replace('-', ":").to_uppercase()
}

impl PcNetworkCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn by_ip(&self, ip: &str) -> Option<PcMeta> {
        self.inner.lock().unwrap().by_ip.get(ip).cloned()
    }

    pub fn by_mac(&self, mac: &str) -> Option<PcMeta> {
        self.inner
            .lock()
            .unwrap()
            .by_mac
            .get(&norm_mac(mac))
            .cloned()
    }

    pub fn loaded(&self) -> bool {
        self.inner.lock().unwrap().loaded
    }

    pub fn invalidate(&self) {
        let mut g = self.inner.lock().unwrap();
        *g = Snapshot::default();
    }

    /// Bangun snapshot baru lalu tukar sekaligus; error tidak mengosongkan snapshot lama.
    pub async fn reload(&self, pool: &SqlitePool) -> Result<()> {
        let rows: Vec<(
            i64,
            String,
            Option<String>,
            Option<String>,
            Option<i64>,
            Option<i64>,
        )> = sqlx::query_as(
            "SELECT id, kode, ip_address, mac_address, is_admin_mode, grup_id FROM pc",
        )
        .fetch_all(pool)
        .await?;

        let mut snap = Snapshot {
            loaded: true,
            ..Snapshot::default()
        };
        for (id, kode, ip, mac, admin_mode, grup_id) in rows {
            let meta = PcMeta {
                id,
                kode,
                ip: ip.clone().unwrap_or_default(),
                mac: mac.clone(),
                is_admin_mode: admin_mode.unwrap_or(0) != 0,
                grup_id,
            };
            if let Some(ip) = ip.filter(|v| !v.trim().is_empty()) {
                snap.by_ip.insert(ip, meta.clone());
            }
            if let Some(mac) = mac.filter(|v| !v.trim().is_empty()) {
                snap.by_mac.insert(norm_mac(&mac), meta);
            }
        }
        *self.inner.lock().unwrap() = snap;
        Ok(())
    }

    /// Resolusi IP lalu MAC; snapshot dibangun sekali bila belum ada.
    pub async fn resolve(
        &self,
        pool: &SqlitePool,
        ip: &str,
        mac: Option<&str>,
    ) -> Result<Option<PcMeta>> {
        if !self.loaded() {
            self.reload(pool).await?;
        }
        if let Some(meta) = self.by_ip(ip) {
            return Ok(Some(meta));
        }
        Ok(mac.and_then(|m| self.by_mac(m)))
    }
}

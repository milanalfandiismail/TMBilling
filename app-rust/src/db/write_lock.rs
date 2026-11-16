//! Gerbang tulis tunggal, setara `WRITE_LOCK` Python.
//!
//! shortcut: lock proses-level, cukup untuk satu proses server.

use crate::utils::{constants::WRITE_LOCK_SLOW_SECONDS, logger};
use std::time::Instant;
use tokio::sync::{Mutex, MutexGuard};

#[derive(Default)]
pub struct WriteLock {
    inner: Mutex<()>,
}

impl WriteLock {
    pub fn new() -> Self { Self::default() }

    pub async fn acquire(&self) -> MutexGuard<'_, ()> {
        let mulai = Instant::now();
        let guard = self.inner.lock().await;
        let tunggu = mulai.elapsed().as_secs_f64();
        if tunggu >= WRITE_LOCK_SLOW_SECONDS {
            logger::audit("SYSTEM", "WRITE_LOCK_SLOW", &format!("Menunggu lock {tunggu:.2} detik"), None, "-", "SYSTEM");
        }
        guard
    }
}

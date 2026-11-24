#[allow(dead_code)]
pub mod api;
pub mod app;
pub mod audio;
pub mod gallery;
pub mod platform;
pub mod polling;
pub mod poster_cache;
pub mod qris_cache;
pub mod state;
pub mod theme;
pub mod ui;
#[allow(dead_code)]
pub mod update;

/// Mode uji desktop: tanpa keyboard hook dan tanpa sembunyikan taskbar.
pub fn dev_safe() -> bool {
    std::env::var("TM_DEV_SAFE").map(|v| v == "1").unwrap_or(false)
}

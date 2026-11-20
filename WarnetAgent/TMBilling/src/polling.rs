use std::time::{Duration, Instant};

use tokio::sync::mpsc::UnboundedSender;

use crate::api::client::ApiClient;
use gpui_kit::{Image, ImageFormat};
use crate::api::models::{IdentifyResponse, StatusResponse, WarnetConfig};

/// Server hanya menerima 1/5/10 detik; nilai lain jatuh ke default (sama dengan polling.rs lama).
const DEFAULT_INTERVAL: u64 = 5;
const HEALTHY_CONFIG_INTERVAL: u64 = 60;
const FAILED_CONFIG_INTERVAL: u64 = 5;

pub enum AppEvent {
    Identified(IdentifyResponse),
    Status(StatusResponse),
    Config(WarnetConfig),
    TimeUpdate(i64),
    #[allow(dead_code)] // shortcut: dibaca Task 8 (tools) dan Task 12 (screenshot)
    Command(String),
    Qris(Option<std::sync::Arc<Image>>),
}

pub fn next_interval(ok: bool, hint: Option<u64>) -> u64 {
    match hint {
        Some(h) if ok && matches!(h, 1 | 5 | 10) => h,
        _ => DEFAULT_INTERVAL,
    }
}

pub fn config_interval(healthy: bool) -> u64 {
    if healthy {
        HEALTHY_CONFIG_INTERVAL
    } else {
        FAILED_CONFIG_INTERVAL
    }
}

pub fn format_remaining(secs: i64) -> String {
    let s = secs.max(0);
    let (h, m, sec) = (s / 3600, (s % 3600) / 60, s % 60);
    if h > 0 {
        format!("{h}:{m:02}:{sec:02}")
    } else {
        format!("{m:02}:{sec:02}")
    }
}

pub fn local_net() -> Option<(String, String)> {
    let ip = local_ip_address::local_ip().ok()?.to_string();
    let mac = mac_address::get_mac_address().ok()??.to_string();
    Some((ip, mac))
}

/// Satu putaran identifikasi lalu polling tanpa henti; UI hanya menerima event.
pub async fn run(client: ApiClient, tx: UnboundedSender<AppEvent>) {
    let mut interval = DEFAULT_INTERVAL;
    let mut config_healthy = false;
    let mut last_config = Instant::now() - Duration::from_secs(3600);

    match local_net() {
        Some((ip, _)) => println!("[poll] mulai ip={ip}"),
        None => println!("[poll] jaringan tidak terdeteksi"),
    }

    if let Some((ip, mac)) = local_net() {
        match client.identify(&ip, &mac).await {
            Ok(res) => {
                interval = next_interval(true, res.polling_interval);
                println!("[poll] identify valid={} pc={:?}", res.valid, res.pc_kode);
                let _ = tx.send(AppEvent::Identified(res));
            }
            Err(e) => println!("[poll] identify gagal: {e}"),
        }
    }

    loop {
        if let Some((ip, mac)) = local_net() {
            match client.status(&ip, &mac, false).await {
                Ok(status) => {
                    println!(
                    "[poll] ok status={} sisa={:?} shutdown={:?}",
                    status.status, status.sisa_waktu, status.shutdown_timer
                );
                    interval = next_interval(true, status.polling_interval);
                    let _ = tx.send(AppEvent::TimeUpdate(status.sisa_waktu.unwrap_or(0) as i64));
                    if let Some(cmd) = status.command.clone() {
                        if cmd == "screenshot" {
                            let shot_client = client.clone();
                            let shot_ip = ip.clone();
                            tokio::spawn(async move {
                                if let Err(e) =
                                    crate::platform::screenshot::take_and_upload(&shot_client, &shot_ip)
                                        .await
                                {
                                    println!("[screenshot] gagal: {e}");
                                }
                            });
                        }
                        let _ = tx.send(AppEvent::Command(cmd));
                    }
                    let _ = tx.send(AppEvent::Status(status));
                }
                Err(e) => {
                    println!("[poll] error: {e}");
                    interval = DEFAULT_INTERVAL;
                }
            }
        }

        if last_config.elapsed() >= Duration::from_secs(config_interval(config_healthy)) {
            match client.warnet_config().await {
                Ok(cfg) => {
                    config_healthy = true;
                    if let Some(src) = cfg.qris_url.clone() {
                        if let Some(bytes) = client.qris_bytes(&src).await {
                            let format = if src.to_lowercase().ends_with(".jpg")
                                || src.to_lowercase().ends_with(".jpeg")
                            {
                                ImageFormat::Jpeg
                            } else {
                                ImageFormat::Png
                            };
                            let image = Image::from_bytes(format, bytes);
                            let _ = tx.send(AppEvent::Qris(Some(std::sync::Arc::new(image))));
                        }
                    }
                    let _ = tx.send(AppEvent::Config(cfg));
                }
                Err(e) => {
                    config_healthy = false;
                    println!("[poll] config gagal: {e}");
                }
            }
            last_config = Instant::now();
        }

        tokio::time::sleep(Duration::from_secs(interval)).await;
    }
}

/// Runtime tokio terpisah: gpui tidak boleh menunggu future jaringan di thread UI.
pub fn spawn_runtime(client: ApiClient, tx: UnboundedSender<AppEvent>) {
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread().enable_all().build() {
            Ok(rt) => rt,
            Err(e) => {
                println!("[poll] runtime gagal: {e}");
                return;
            }
        };
        rt.block_on(run(client, tx));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remaining_over_an_hour_has_hours() {
        assert_eq!(format_remaining(5068), "1:24:28");
    }

    #[test]
    fn remaining_under_an_hour_has_no_hours() {
        assert_eq!(format_remaining(598), "09:58");
    }

    #[test]
    fn countdown_never_goes_negative() {
        assert_eq!(format_remaining(-5), "00:00");
    }

    #[test]
    fn interval_accepts_only_server_values() {
        assert_eq!(next_interval(true, Some(1)), 1);
        assert_eq!(next_interval(true, Some(10)), 10);
        assert_eq!(next_interval(true, Some(60)), DEFAULT_INTERVAL);
        assert_eq!(next_interval(false, Some(1)), DEFAULT_INTERVAL);
        assert_eq!(next_interval(true, None), DEFAULT_INTERVAL);
    }

    #[test]
    fn config_refresh_is_slow_until_first_success() {
        assert_eq!(config_interval(true), 60);
        assert_eq!(config_interval(false), 5);
    }
}

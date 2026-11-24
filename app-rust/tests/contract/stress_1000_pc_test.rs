//! Uji beban (stress test) 1.000 PC polling 1 detik terhadap backend Axum.
//! Berjalan sepenuhnya di sandbox temp_dir DB terisolasi.

use axum::http::StatusCode;
use serde_json::json;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tmbilling_server::app::router;
use tmbilling_server::config::Config;
use tmbilling_server::state::AppState;
use windows_sys::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};

const KUNCI: &str = "kunci-uji-client-1000";

struct TempDir(PathBuf);
impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_stress_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn get_memory_mb() -> f64 {
    #[cfg(windows)]
    unsafe {
        let mut pmc: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
        let handle = GetCurrentProcess();
        if GetProcessMemoryInfo(
            handle,
            &mut pmc,
            std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
        ) != 0
        {
            return (pmc.WorkingSetSize as f64) / (1024.0 * 1024.0);
        }
    }
    0.0
}

struct CpuSample {
    instant: Instant,
    kernel_100ns: u64,
    user_100ns: u64,
}

impl CpuSample {
    fn capture() -> Self {
        #[cfg(windows)]
        unsafe {
            let handle = GetCurrentProcess();
            let mut creation = std::mem::zeroed();
            let mut exit = std::mem::zeroed();
            let mut kernel = std::mem::zeroed();
            let mut user = std::mem::zeroed();
            if GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) != 0 {
                let k = ((kernel.dwHighDateTime as u64) << 32) | (kernel.dwLowDateTime as u64);
                let u = ((user.dwHighDateTime as u64) << 32) | (user.dwLowDateTime as u64);
                return Self {
                    instant: Instant::now(),
                    kernel_100ns: k,
                    user_100ns: u,
                };
            }
        }
        Self {
            instant: Instant::now(),
            kernel_100ns: 0,
            user_100ns: 0,
        }
    }

    fn calculate_cpu_pct(&self, next: &Self) -> f64 {
        let elapsed_secs = next.instant.duration_since(self.instant).as_secs_f64();
        if elapsed_secs <= 0.0 {
            return 0.0;
        }
        let total_cpu_100ns = (next.kernel_100ns.saturating_sub(self.kernel_100ns))
            + (next.user_100ns.saturating_sub(self.user_100ns));
        let cpu_seconds = (total_cpu_100ns as f64) / 10_000_000.0;
        let num_cpus = num_cpus::get().max(1) as f64;
        (cpu_seconds / (elapsed_secs * num_cpus)) * 100.0
    }
}

mod num_cpus {
    pub fn get() -> usize {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
    }
}

#[tokio::test]
async fn stress_test_1000_pc_polling_1s() {
    println!("\n=== MEMULAI SETUP STRESS TEST 1.000 PC POLLING ===");
    let dir = TempDir::new("1000pc");
    let cfg = Config::load(&dir.0).unwrap();
    let st = Arc::new(AppState::new(cfg).await.unwrap());

    // Setup settings
    tmbilling_server::services::settings::settings_service::set(
        &st,
        "ip_whitelist_enabled",
        "false",
    )
    .await
    .unwrap();
    tmbilling_server::services::settings::settings_service::set(&st, "client_api_key", KUNCI)
        .await
        .unwrap();

    let num_cores = num_cpus::get();
    println!("Deteksi Hardware: {} logical CPU cores", num_cores);

    // 1. Seed 1.000 PC ke DB SQLite
    println!("Mempersiapkan data 1.000 PC di database sandbox...");
    let mut conn = st.pool.acquire().await.unwrap();
    sqlx::query("BEGIN TRANSACTION").execute(&mut *conn).await.unwrap();

    // Buat grup reguler dulu jika belum ada
    let grup_opt: Option<i64> = sqlx::query_scalar("SELECT id FROM grup LIMIT 1")
        .fetch_optional(&mut *conn)
        .await
        .unwrap();

    let grup_id = match grup_opt {
        Some(id) => id,
        None => {
            sqlx::query("INSERT INTO grup (nama, aktif) VALUES ('Reguler', 1)")
                .execute(&mut *conn)
                .await
                .unwrap();
            sqlx::query_scalar("SELECT last_insert_rowid()")
                .fetch_one(&mut *conn)
                .await
                .unwrap()
        }
    };

    for i in 1..=1000 {
        let kode = format!("PC-{:04}", i);
        let b3 = (i / 254) % 254;
        let b4 = (i % 254) + 1;
        let ip = format!("192.168.{}.{}", b3, b4);
        let mac = format!("00:1A:2B:3C:{:02X}:{:02X}", b3, b4);
        sqlx::query(
            "INSERT INTO pc (kode, ip_address, mac_address, grup_id, aktif, is_admin_mode) VALUES (?, ?, ?, ?, 1, 0)",
        )
        .bind(kode)
        .bind(ip)
        .bind(mac)
        .bind(grup_id)
        .execute(&mut *conn)
        .await
        .unwrap();
    }
    sqlx::query("COMMIT").execute(&mut *conn).await.unwrap();
    println!("1.000 PC berhasil di-seed.");

    // Buat 200 sesi aktif untuk menguji beban join & kalkulasi durasi
    sqlx::query("BEGIN TRANSACTION").execute(&mut *conn).await.unwrap();
    for i in 1..=200 {
        let mulai = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let token = format!("tok-stress-{}", i);
        sqlx::query(
            "INSERT INTO sesi (pc_id, tipe, nama_guest, durasi_beli_menit, total_bayar, status, mulai_pada, token_sesi, is_afk)
             VALUES (?, 'guest', 'Guest Uji', 120, 10000, 'aktif', ?, ?, 0)",
        )
        .bind(i as i64)
        .bind(mulai)
        .bind(token)
        .execute(&mut *conn)
        .await
        .unwrap();
    }
    sqlx::query("COMMIT").execute(&mut *conn).await.unwrap();
    println!("200 Sesi aktif dibuat (800 PC idle, 200 PC in-session).");

    // 2. Bind server lokal Axum pada port random loopback
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    println!("Server uji Axum aktif di http://{}", addr);

    let server_app = router(st.clone()).into_make_service_with_connect_info::<SocketAddr>();
    tokio::spawn(async move {
        axum::serve(listener, server_app).await.unwrap();
    });

    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(1000)
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();

    let target_url = format!("http://{}/api/v1/public/client/status", addr);

    // Warmup 5 detik dengan 100 PC
    println!("\n>>> Tahap 1: Warmup 100 PC selama 3 detik...");
    for i in 1..=100 {
        let b3 = (i / 254) % 254;
        let b4 = (i % 254) + 1;
        let ip = format!("192.168.{}.{}", b3, b4);
        let mac = format!("00:1A:2B:3C:{:02X}:{:02X}", b3, b4);
        let res = client
            .post(&target_url)
            .header("x-client-key", KUNCI)
            .header("cf-connecting-ip", &ip)
            .header("host", "127.0.0.1")
            .json(&json!({
                "ip_address": ip,
                "mac_address": mac,
                "role": "client"
            }))
            .send()
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }
    println!("Warmup selesai.");

    // Baseline Metrik
    let mem_start = get_memory_mb();
    let cpu_sample_start = CpuSample::capture();
    let test_duration = Duration::from_secs(15); // Uji 15 detik kontinu (15.000 requests)

    println!("\n>>> Tahap 2: SUSTAINED STRESS TEST 1.000 PC POLLING 1 DETIK");
    println!("Durasi: {:?}, Target Total: ~15.000 requests (1.000 req/detik)", test_duration);

    let sukses_count = Arc::new(AtomicUsize::new(0));
    let gagal_count = Arc::new(AtomicUsize::new(0));
    let total_latency_ms = Arc::new(AtomicUsize::new(0));
    let max_latency_ms = Arc::new(AtomicUsize::new(0));

    let stop_signal = Arc::new(tokio::sync::Notify::new());
    let mut handles = Vec::with_capacity(1000);

    let start_instant = Instant::now();

    for i in 1..=1000 {
        let b3 = (i / 254) % 254;
        let b4 = (i % 254) + 1;
        let ip = format!("192.168.{}.{}", b3, b4);
        let mac = format!("00:1A:2B:3C:{:02X}:{:02X}", b3, b4);
        let client_clone = client.clone();
        let url_clone = target_url.clone();
        let sukses_ref = sukses_count.clone();
        let gagal_ref = gagal_count.clone();
        let lat_ref = total_latency_ms.clone();
        let max_lat_ref = max_latency_ms.clone();

        // Stagger inisiasi dalam 1000ms pertama agar merata 1000 req/sec
        let initial_delay = Duration::from_millis((i as u64 % 1000));

        let h = tokio::spawn(async move {
            tokio::time::sleep(initial_delay).await;
            let mut interval = tokio::time::interval(Duration::from_millis(1000));

            loop {
                interval.tick().await;

                let t0 = Instant::now();
                let res = client_clone
                    .post(&url_clone)
                    .header("x-client-key", KUNCI)
                    .header("cf-connecting-ip", &ip)
                    .header("host", "127.0.0.1")
                    .json(&json!({
                        "ip_address": ip,
                        "mac_address": mac,
                        "role": "client"
                    }))
                    .send()
                    .await;

                let elapsed_ms = t0.elapsed().as_millis() as usize;

                match res {
                    Ok(r) if r.status() == StatusCode::OK => {
                        sukses_ref.fetch_add(1, Ordering::Relaxed);
                        lat_ref.fetch_add(elapsed_ms, Ordering::Relaxed);
                        max_lat_ref.fetch_max(elapsed_ms, Ordering::Relaxed);
                    }
                    _ => {
                        gagal_ref.fetch_add(1, Ordering::Relaxed);
                    }
                }

                if t0.elapsed() > Duration::from_secs(16) {
                    break;
                }
            }
        });
        handles.push(h);
    }

    // Monitor CPU & RAM secara berkala selama tes berjalan
    let mut mem_samples = Vec::new();
    let mut cpu_samples = Vec::new();
    let mut last_cpu = CpuSample::capture();

    let monitor_ticks = 15;
    for tick in 1..=monitor_ticks {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let mem = get_memory_mb();
        mem_samples.push(mem);

        let curr_cpu = CpuSample::capture();
        let cpu_pct = last_cpu.calculate_cpu_pct(&curr_cpu);
        cpu_samples.push(cpu_pct);
        last_cpu = curr_cpu;

        let cur_sukses = sukses_count.load(Ordering::Relaxed);
        let cur_gagal = gagal_count.load(Ordering::Relaxed);
        println!(
            "Detik #{:02} | Sukses: {:5} req | Gagal: {} | RAM: {:.2} MB | CPU: {:.1}%",
            tick, cur_sukses, cur_gagal, mem, cpu_pct
        );
    }

    // Abort client tasks
    for h in handles {
        h.abort();
    }

    let total_sukses = sukses_count.load(Ordering::Relaxed);
    let total_gagal = gagal_count.load(Ordering::Relaxed);
    let total_req = total_sukses + total_gagal;
    let avg_lat = if total_sukses > 0 {
        (total_latency_ms.load(Ordering::Relaxed) as f64) / (total_sukses as f64)
    } else {
        0.0
    };
    let peak_lat = max_latency_ms.load(Ordering::Relaxed);

    let avg_cpu: f64 = cpu_samples.iter().sum::<f64>() / (cpu_samples.len().max(1) as f64);
    let peak_cpu: f64 = cpu_samples.iter().cloned().fold(0.0, f64::max);
    let avg_mem: f64 = mem_samples.iter().sum::<f64>() / (mem_samples.len().max(1) as f64);
    let peak_mem: f64 = mem_samples.iter().cloned().fold(0.0, f64::max);

    println!("\n================ HASIL AKHIR STRESS TEST 1.000 PC ================");
    println!("Total Waktu Pengujian : 15 Detik");
    println!("Total Request Masuk   : {} requests", total_req);
    println!("Throughput Aktual     : {:.1} RPS (Target: 1.000 RPS)", (total_req as f64) / 15.0);
    println!("Tingkat Keberhasilan  : {} / {} ({:.2}%)", total_sukses, total_req, (total_sukses as f64 / total_req.max(1) as f64) * 100.0);
    println!("Total Gagal / Drop    : {}", total_gagal);
    println!("Rata-rata Latensi     : {:.2} ms", avg_lat);
    println!("Puncak Latensi        : {} ms", peak_lat);
    println!("Penggunaan RAM        : Awal: {:.2} MB | Rata-rata: {:.2} MB | Puncak: {:.2} MB", mem_start, avg_mem, peak_mem);
    println!("Penggunaan CPU        : Rata-rata: {:.1}% | Puncak: {:.1}% (dari {} Cores)", avg_cpu, peak_cpu, num_cores);
    println!("===================================================================\n");

    assert!(total_sukses > 10000, "Minimal 10.000 requests harus berhasil diproses!");
    assert_eq!(total_gagal, 0, "Tidak boleh ada request yang gagal/drop!");
    assert!(avg_lat < 50.0, "Rata-rata latensi harus di bawah 50ms!");
}

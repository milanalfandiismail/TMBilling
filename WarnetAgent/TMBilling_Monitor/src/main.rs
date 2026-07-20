#![windows_subsystem = "windows"]
#![allow(non_snake_case)]
use sysinfo::System;

use std::process::Command;
use std::os::windows::process::CommandExt;
use std::thread;
use std::time::Duration;
use std::fs;
use std::fs::File;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::path::Path;
use serde_json::json;
use serde::Deserialize;
use once_cell::sync::OnceCell;
use wmi::{COMLibrary, WMIConnection};
use winreg::enums::*;
use winreg::RegKey;

// =========================================================================
// 1. EMBEDDED FILES ENGINE (Auto-Extract File Pendukung dari dalam Rust!)
// =========================================================================
const HARDWARE_HELPER_BYTES: &[u8] = include_bytes!("../HardwareHelper.exe");
const LIBRE_DLL_BYTES: &[u8] = include_bytes!("../LibreHardwareMonitorLib.dll");
const HID_DLL_BYTES: &[u8] = include_bytes!("../HidSharp.dll");

fn extract_embedded_files() {
    let _ = fs::write("HardwareHelper.exe", HARDWARE_HELPER_BYTES);
    if !Path::new("LibreHardwareMonitorLib.dll").exists() {
        let _ = fs::write("LibreHardwareMonitorLib.dll", LIBRE_DLL_BYTES);
    }
    if !Path::new("HidSharp.dll").exists() {
        let _ = fs::write("HidSharp.dll", HID_DLL_BYTES);
    }
}

// =========================================================================
// 2. DATA STRUCTURE DARI HARDWARE HELPER (LibreHardwareMonitor JSON Output)
// =========================================================================
#[derive(Deserialize, Debug, Clone)]
struct HardwareHelperOutput {
    CpuUsage: f32,
    CpuTemp: f32,
    GpuTemp: f32,
    TotalRam: String,
    Motherboard: String,
    CpuName: String,
    GpuName: String,
}

fn get_hardware_helper_data() -> Option<HardwareHelperOutput> {
    let helper_path = std::env::current_exe()
        .ok()
        .and_then(|mut p| { p.set_file_name("HardwareHelper.exe"); Some(p) })
        .unwrap_or_else(|| std::path::PathBuf::from(".\\HardwareHelper.exe"));

    let output = Command::new(helper_path)
        .creation_flags(0x08000000) // 🔥 Sembunyikan Jendela CMD/Console dari Layar User!
        .output()
        .ok()?;
    
    if output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        serde_json::from_str::<HardwareHelperOutput>(stdout_str.trim()).ok()
    } else {
        None
    }
}

// =========================================================================
// 3. DETEKSI IDENTITAS JARINGAN AKTIF (IP & MAC fisik)
// =========================================================================
#[derive(Deserialize, Debug)]
struct NetConfig {
    IPAddress: Option<Vec<String>>,
    MACAddress: Option<String>,
}

fn get_active_ip_and_mac() -> (String, String) {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT IPAddress, MACAddress FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = True";
            if let Ok(list) = con.raw_query::<NetConfig>(query) {
                for item in list {
                    if let (Some(ips), Some(mac)) = (item.IPAddress, item.MACAddress) {
                        for ip in ips {
                            if ip.contains('.') && ip != "127.0.0.1" {
                                return (ip, mac);
                            }
                        }
                    }
                }
            }
        }
    }
    ("Unknown".to_string(), "Unknown".to_string())
}

#[derive(Deserialize, Debug)]
struct BaseBoard {
    Manufacturer: String,
    Product: String,
}

fn get_motherboard_name() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT Manufacturer, Product FROM Win32_BaseBoard";
            if let Ok(list) = con.raw_query::<BaseBoard>(query) {
                if let Some(board) = list.first() {
                    let manufacturer = board.Manufacturer.trim();
                    let product = board.Product.trim();
                    return format!("{} {}", manufacturer, product);
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Deserialize, Debug)]
struct NetworkAdapter {
    Speed: Option<u64>,
}

#[derive(Deserialize, Debug)]
struct VideoController {
    Name: String,
}

fn get_nic_speed() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT Speed FROM Win32_NetworkAdapter WHERE NetConnectionStatus = 2 AND Speed > 0";
            if let Ok(list) = con.raw_query::<NetworkAdapter>(query) {
                if let Some(adapter) = list.first() {
                    if let Some(speed) = adapter.Speed {
                        return if speed >= 1_000_000_000 {
                            format!("{:.1} Gbps", speed as f64 / 1_000_000_000.0)
                        } else if speed >= 1_000_000 {
                            format!("{} Mbps", speed / 1_000_000)
                        } else {
                            format!("{} bps", speed)
                        };
                    }
                }
            }
        }
    }
    "Unknown".to_string()
}

fn get_backup_gpu_name() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT Name FROM Win32_VideoController";
            if let Ok(list) = con.raw_query::<VideoController>(query) {
                let gpus: Vec<String> = list.into_iter()
                    .map(|gpu| gpu.Name.trim().to_string())
                    .filter(|name| !name.is_empty())
                    .collect();
                if !gpus.is_empty() {
                    return gpus.join(" / ");
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Deserialize, Debug)]
struct BaseBoardSerial {
    SerialNumber: String,
}

fn get_motherboard_serial() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT SerialNumber FROM Win32_BaseBoard";
            if let Ok(list) = con.raw_query::<BaseBoardSerial>(query) {
                if let Some(board) = list.first() {
                    return board.SerialNumber.trim().to_string();
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Deserialize, Debug)]
struct ProcessorIdOnly {
    ProcessorId: String,
}

fn get_cpu_id() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT ProcessorId FROM Win32_Processor";
            if let Ok(list) = con.raw_query::<ProcessorIdOnly>(query) {
                if let Some(cpu) = list.first() {
                    return cpu.ProcessorId.trim().to_string();
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Deserialize, Debug)]
struct VideoControllerPnp {
    PNPDeviceID: String,
}

fn get_gpu_pnp_id() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT PNPDeviceID FROM Win32_VideoController";
            if let Ok(list) = con.raw_query::<VideoControllerPnp>(query) {
                if let Some(gpu) = list.first() {
                    return gpu.PNPDeviceID.trim().to_string();
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Deserialize, Debug)]
struct PhysicalMemory {
    SerialNumber: Option<String>,
    Capacity: Option<u64>,
}

fn get_ram_serials() -> Vec<String> {
    let mut serials = Vec::new();
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT SerialNumber, Capacity FROM Win32_PhysicalMemory";
            if let Ok(list) = con.raw_query::<PhysicalMemory>(query) {
                for item in list {
                    let sn = item.SerialNumber.map(|s| s.trim().to_string()).unwrap_or_else(|| "Unknown".to_string());
                    let cap = item.Capacity.unwrap_or(0);
                    serials.push(format!("{}_{}", sn, cap));
                }
            }
        }
    }
    serials
}

#[derive(Deserialize, Debug)]
struct DiskDrive {
    SerialNumber: Option<String>,
    Model: Option<String>,
}

fn get_disk_serials() -> Vec<String> {
    let mut serials = Vec::new();
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT SerialNumber, Model FROM Win32_DiskDrive";
            if let Ok(list) = con.raw_query::<DiskDrive>(query) {
                for item in list {
                    let sn = match item.SerialNumber {
                        Some(s) => s.trim().to_string(),
                        None => continue,
                    };
                    let model = item.Model.unwrap_or_default().trim().to_string();
                    
                    if sn.is_empty() || sn.to_lowercase().contains("unknown") {
                        continue;
                    }
                    
                    let model_lower = model.to_lowercase();
                    if model_lower.contains("ccboot")
                        || model_lower.contains("iscsi")
                        || model_lower.contains("scsi")
                        || model_lower.contains("virtual")
                        || model_lower.contains("sanboot")
                        || model_lower.contains("superspeed")
                    {
                        continue;
                    }
                    
                    serials.push(format!("{}_{}", model, sn));
                }
            }
        }
    }
    serials
}

#[derive(Deserialize, Debug)]
struct Processor {
    Name: String,
}

fn get_backup_cpu_name() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT Name FROM Win32_Processor";
            if let Ok(list) = con.raw_query::<Processor>(query) {
                if let Some(cpu) = list.first() {
                    return cpu.Name.trim().to_string();
                }
            }
        }
    }
    "Unknown".to_string()
}

// =========================================================================
// 4. HEX-XOR OBFUSCATION SYSTEM
// =========================================================================
fn obfuscate(input: &str) -> String {
    let key = b"TMBillingSecretKey2026SecureObfuscation";
    let hex_chars: Vec<String> = input.as_bytes().iter().enumerate().map(|(i, &b)| {
        format!("{:02x}", b ^ key[i % key.len()])
    }).collect();
    hex_chars.join("")
}

fn deobfuscate(hex_input: &str) -> String {
    let key = b"TMBillingSecretKey2026SecureObfuscation";
    let mut bytes = Vec::new();
    for i in (0..hex_input.len()).step_by(2) {
        if i + 2 <= hex_input.len() {
            if let Ok(b) = u8::from_str_radix(&hex_input[i..i+2], 16) {
                bytes.push(b ^ key[(i/2) % key.len()]);
            }
        }
    }
    String::from_utf8(bytes).unwrap_or_default()
}

fn is_obfuscated(input: &str) -> bool {
    let input = input.trim();
    if input.is_empty() || input.len() % 2 != 0 {
        return false;
    }
    if !input.chars().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    let deobf = deobfuscate(input);
    if deobf.is_empty() {
        return false;
    }
    deobf.chars().all(|c| c.is_ascii() && !c.is_control())
}

// =========================================================================
// 5. CONFIGURATION LOADER (Registry Primary, config.ini Fallback & Auto-Sync)
// =========================================================================
fn load_config() -> (String, String, String, String) {
    let mut reg_url = None;
    let mut reg_api_key = None;
    let mut reg_em_user = None;
    let mut reg_em_token = None;

    // 1. Coba baca dari Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(subkey) = hklm.open_subkey("Software\\TMBilling") {
        if let Ok(u) = subkey.get_value::<String, _>("Url") {
            if !u.trim().is_empty() {
                reg_url = Some(u);
            }
        }
        if let Ok(k) = subkey.get_value::<String, _>("ApiKey") {
            let k_trimmed = k.trim().to_string();
            if !k_trimmed.is_empty() {
                if is_obfuscated(&k_trimmed) {
                    reg_api_key = Some(deobfuscate(&k_trimmed));
                } else {
                    reg_api_key = Some(k_trimmed);
                }
            }
        }
        if let Ok(user) = subkey.get_value::<String, _>("EmergencyUser") {
            let user_trimmed = user.trim().to_string();
            if !user_trimmed.is_empty() {
                if is_obfuscated(&user_trimmed) {
                    reg_em_user = Some(deobfuscate(&user_trimmed));
                } else {
                    reg_em_user = Some(user_trimmed);
                }
            }
        }
        if let Ok(t) = subkey.get_value::<String, _>("EmergencyToken") {
            let t_trimmed = t.trim().to_string();
            if !t_trimmed.is_empty() {
                if is_obfuscated(&t_trimmed) {
                    reg_em_token = Some(deobfuscate(&t_trimmed));
                } else {
                    reg_em_token = Some(t_trimmed);
                }
            }
        }
    }

    // 2. Baca dari config.ini lokal
    let mut ini_url = None;
    let mut ini_api_key = None;
    let mut ini_em_user = None;
    let mut ini_em_token = None;
    let mut ini_api_key_is_plain = false;
    let mut ini_em_user_is_plain = false;
    let mut ini_em_token_is_plain = false;
    if let Ok(content) = fs::read_to_string("config.ini") {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with(';') || line.starts_with('#') || line.is_empty() {
                continue;
            }
            if let Some(pos) = line.find('=') {
                let key = line[..pos].trim().to_lowercase();
                let val = line[pos + 1..].trim().to_string();
                if key == "url" {
                    if !val.is_empty() {
                        ini_url = Some(val);
                    }
                } else if key == "apikey" || key == "api_key" {
                    if !val.is_empty() {
                        if is_obfuscated(&val) {
                            ini_api_key = Some(deobfuscate(&val));
                        } else {
                            ini_api_key = Some(val.clone());
                            ini_api_key_is_plain = true;
                        }
                    }
                } else if key == "emergencyuser" || key == "emergency_user" {
                    if !val.is_empty() {
                        if is_obfuscated(&val) {
                            ini_em_user = Some(deobfuscate(&val));
                        } else {
                            ini_em_user = Some(val.clone());
                            ini_em_user_is_plain = true;
                        }
                    }
                } else if key == "emergencytoken" || key == "emergency_token" {
                    if !val.is_empty() {
                        if is_obfuscated(&val) {
                            ini_em_token = Some(deobfuscate(&val));
                        } else {
                            ini_em_token = Some(val.clone());
                            ini_em_token_is_plain = true;
                        }
                    }
                }
            }
        }
    }



    // 3. Heuristic Gabungan Cerdas:
    let url = ini_url.clone().or(reg_url).unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
    
    let api_key = if ini_api_key_is_plain && ini_api_key.is_some() {
        ini_api_key.unwrap()
    } else {
        reg_api_key.or(ini_api_key).unwrap_or_else(|| "TM2026QWERTY-api-key".to_string())
    };

    let em_user = if ini_em_user_is_plain && ini_em_user.is_some() {
        ini_em_user.unwrap()
    } else {
        reg_em_user.or(ini_em_user).unwrap_or_else(|| "TMBilling".to_string())
    };

    let em_token = if ini_em_token_is_plain && ini_em_token.is_some() {
        ini_em_token.unwrap()
    } else {
        reg_em_token.or(ini_em_token).unwrap_or_else(|| "TM123qaz!@#".to_string())
    };

    (url, api_key, em_user, em_token)
}

fn get_uninstall_token_from_temp() -> String {
    use std::io::Read;
    let mut temp_path = std::env::temp_dir();
    temp_path.push("tmb_uninstall.token");
    
    if let Ok(mut file) = std::fs::File::open(temp_path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            let clean = contents.trim().to_string();
            if !clean.is_empty() {
                return clean;
            }
        }
    }
    "TM_UNINSTALL_SAFE_2026".to_string()
}

fn check_stop_token_monitor() -> bool {
    let token_file = "stop.token";
    if Path::new(token_file).exists() {
        use std::io::Read;
        if let Ok(mut file) = std::fs::File::open(token_file) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                let clean_content = contents.trim();
                let secret_token = get_uninstall_token_from_temp();
                if clean_content == secret_token {
                    return true;
                }

                // Cek juga kecocokan dengan token darurat (Emergency Token)
                let (_, _, _, em_token) = load_config();
                if clean_content == em_token.trim() {
                    return true;
                }
            }
        }
    }
    false
}

fn acquire_self_lock(lock_path: &str) -> Option<std::fs::File> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .share_mode(0) // Exclusive Lock
            .open(lock_path)
            .ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

fn get_active_window_title() -> String {
    use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowTextLengthW};
    use std::os::windows::ffi::OsStringExt;
    use std::ffi::OsString;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return "Idle / None".to_string();
        }

        let length = GetWindowTextLengthW(hwnd);
        if length == 0 {
            return "Idle / None".to_string();
        }

        let mut buffer: Vec<u16> = vec![0; (length + 1) as usize];
        let copied = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);

        if copied > 0 {
            let os_string = OsString::from_wide(&buffer[..copied as usize]);
            return os_string.to_string_lossy().into_owned();
        }
    }
    "Idle / None".to_string()
}

// =========================================================================
// 6. MAIN RUN ENGINE
// =========================================================================
/// Layer 3: File Lock - Prevent rename/delete while running
#[cfg(not(debug_assertions))]
fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001)
        .open(&exe_path)
}

#[cfg(not(debug_assertions))]
static FILE_LOCK: OnceCell<File> = OnceCell::new();

fn main() {
    // ========== FILE LOCK ==========
    #[cfg(not(debug_assertions))]
    {
        if let Ok(lock) = lock_executable_file() {
            let _ = FILE_LOCK.set(lock);
        }
    }
    
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let _ = std::env::set_current_dir(&exe_dir);
    }

    let _my_lock = acquire_self_lock("tmmonitor.lock");
    if _my_lock.is_none() {
        return;
    }
    extract_embedded_files();

    // AUTO-BOOTSTRAP: Cek apakah MGCTM.exe sudah berjalan di awal startup.
    {
        let mut startup_sys = sysinfo::System::new();
        startup_sys.refresh_processes();
        let is_mgctm_active = startup_sys.processes().values().any(|val| {
            let name = val.name().to_lowercase();
            name == "mgctm.exe" || name == "mgctm"
        });
        if !is_mgctm_active && !check_stop_token_monitor() {
            let mut mgctm_path = std::env::current_exe().unwrap_or_default();
            mgctm_path.set_file_name("MGCTM.exe");
            let _ = Command::new(mgctm_path)
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .spawn();
        }
    }

    // Spawn thread siluman khusus untuk menjaga MGCTM.exe (Master Guardian)
    thread::spawn(|| {
        use sysinfo::System;
        use std::os::windows::process::CommandExt;
        
        thread::sleep(Duration::from_secs(10));

        let mut sys = System::new();
        loop {
            sys.refresh_processes();
            let is_mgctm_running = sys.processes().values().any(|val| {
                let name = val.name().to_lowercase();
                name == "mgctm.exe" || name == "mgctm"
            });

            if !is_mgctm_running {
                if !check_stop_token_monitor() {
                    // Jika MGCTM mati secara tidak sah -> Langsung FORCE RESTART!
                    let _ = Command::new("shutdown")
                        .args(["/r", "/t", "0", "/f"])
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .spawn();
                }
            }
            // Seragam: Thread penjaga mengecek keaktifan MGCTM setiap 5 detik!
            thread::sleep(Duration::from_secs(5));
        }
    });

    let mut sys = System::new_all();
    println!("TMBilling Monitor AKTIF (Obfuscated & 5-Second Guard). Mengirim telemetry tiap 1 menit...");

    let mut tick = 0;

    loop {
        // 1. Ambil & pulihkan konfigurasi ter-obfuscate registry-first serta jalankan perbaikan otomatis
        let (server_base_url, api_key, _em_user, _em_token) = load_config();
        let server_url = format!("{}/api/v1/public/monitor", server_base_url.trim_end_matches('/'));

        // 2. Kirim telemetry setiap 60 detik (12 ticks x 5 detik)
        if tick % 12 == 0 {
            sys.refresh_all();

            let (ip_address, mac_address) = get_active_ip_and_mac();
            let helper = get_hardware_helper_data();

            let cpu_usage = helper.as_ref().map(|h| h.CpuUsage).unwrap_or_else(|| {
                sys.global_cpu_info().cpu_usage()
            });

            let cpu_temp = helper.as_ref().map(|h| h.CpuTemp).unwrap_or(0.0);
            let gpu_temp = helper.as_ref().map(|h| h.GpuTemp).unwrap_or(0.0);
            
            let cpu_name = {
                let name = helper.as_ref().map(|h| h.CpuName.clone()).unwrap_or_default();
                if name.is_empty() || name == "Unknown" {
                    let wmi_cpu = get_backup_cpu_name();
                    if wmi_cpu != "Unknown" && !wmi_cpu.trim().is_empty() {
                        wmi_cpu
                    } else {
                        let brand = sys.global_cpu_info().brand().to_string();
                        if brand.trim().is_empty() { "Unknown".to_string() } else { brand }
                    }
                } else {
                    name
                }
            };

            let gpu_name = helper.as_ref().map(|h| h.GpuName.clone()).unwrap_or_else(|| {
                get_backup_gpu_name()
            });

            let motherboard = {
                let name = get_motherboard_name();
                if name == "Unknown" || name.trim().is_empty() {
                    helper.as_ref().map(|h| h.Motherboard.clone()).unwrap_or_else(|| "Unknown".to_string())
                } else {
                    name
                }
            };

            let total_ram = helper.as_ref().map(|h| h.TotalRam.clone()).unwrap_or_else(|| {
                format!("{:.2} GB", sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0)
            });

            let nic_speed = get_nic_speed();

            let mut process_list = Vec::new();
            for (_pid, process) in sys.processes() {
                let memory_bytes = process.memory();
                if memory_bytes > 10_485_760 { // 10 MB
                    process_list.push(json!({
                        "Name": process.name().to_string(),
                        "Title": format!("Mem: {} MB", memory_bytes / 1024 / 1024)
                    }));
                }
            }

            let mobo_serial = get_motherboard_serial();
            let cpu_id = get_cpu_id();
            let gpu_pnp_id = get_gpu_pnp_id();
            let ram_serials = get_ram_serials();
            let disk_serials = get_disk_serials();

            let payload = json!({
                "IpAddress": ip_address,
                "MacAddress": mac_address,
                "CpuUsage": cpu_usage,
                "CpuTemp": cpu_temp,
                "GpuTemp": gpu_temp,
                "TotalRam": total_ram,
                "NicSpeed": nic_speed,
                "Motherboard": motherboard,
                "CpuName": cpu_name,
                "GpuName": gpu_name,
                "ActiveWindow": get_active_window_title(),
                "ProcessList": process_list,
                "HardwareSerials": {
                    "MotherboardSerial": mobo_serial,
                    "CpuId": cpu_id,
                    "GpuPnpId": gpu_pnp_id,
                    "RamSerials": ram_serials,
                    "DiskSerials": disk_serials
                }
            });

            let resp = ureq::post(&server_url)
                .set("X-Client-Key", &api_key)
                .send_json(payload);

            match resp {
                Ok(_) => println!("Telemetry terkirim ke server! IP: {}, MAC: {} (Motherboard: {})", ip_address, mac_address, motherboard),
                Err(e) => eprintln!("Gagal kirim telemetry: {}", e),
            }
        }

        tick += 1;
        // Ticks setiap 5 detik secara seragam
        thread::sleep(Duration::from_secs(5));
    }
}

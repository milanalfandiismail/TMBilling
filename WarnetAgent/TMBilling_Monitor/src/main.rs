#![windows_subsystem = "windows"]
#![allow(non_snake_case)]
#![allow(unused_imports)]

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
use des::cipher::{generic_array::GenericArray, BlockEncrypt, KeyInit};
use des::Des;
use sha2::{Sha256, Digest};
use once_cell::sync::Lazy;
use std::sync::{Mutex, RwLock};
use std::time::Instant;

static VNC_ACTIVE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));
static VNC_LAST_ACTIVE: Lazy<Mutex<Instant>> = Lazy::new(|| Mutex::new(Instant::now()));

static SYSTEM_MONITOR: Lazy<Mutex<sysinfo::System>> = Lazy::new(|| {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();
    Mutex::new(sys)
});

#[derive(Clone, Debug)]
struct ClientConfig {
    server_base_url: String,
    api_key: String,
    em_user: String,
    em_token: String,
}

static CACHED_CONFIG: Lazy<RwLock<Option<ClientConfig>>> = Lazy::new(|| RwLock::new(None));

#[derive(Clone, Debug)]
struct StaticSpecs {
    motherboard: String,
    cpu_name: String,
    gpu_name: String,
}

static CACHED_SPECS: Lazy<RwLock<StaticSpecs>> = Lazy::new(|| {
    let (_, _, mobo_opt, cpu_opt, gpu_opt) = read_cached_temperature_and_specs();

    RwLock::new(StaticSpecs {
        motherboard: mobo_opt.unwrap_or_else(|| "Unknown".to_string()),
        cpu_name: cpu_opt.unwrap_or_else(|| "Unknown".to_string()),
        gpu_name: gpu_opt.unwrap_or_else(|| "Unknown".to_string()),
    })
});

fn get_effective_hardware_specs(
    mobo_cache: Option<String>,
    cpu_cache: Option<String>,
    gpu_cache: Option<String>,
) -> (String, String, String) {
    if let Ok(guard) = CACHED_SPECS.read() {
        let mobo_valid = guard.motherboard != "Unknown" && !guard.motherboard.is_empty();
        let cpu_valid = guard.cpu_name != "Unknown" && !guard.cpu_name.is_empty();
        let gpu_valid = guard.gpu_name != "Unknown" && !guard.gpu_name.is_empty();

        if mobo_valid && cpu_valid && gpu_valid {
            return (guard.motherboard.clone(), guard.cpu_name.clone(), guard.gpu_name.clone());
        }
    }

    if let Ok(mut guard) = CACHED_SPECS.write() {
        if let Some(m) = mobo_cache.clone() {
            if guard.motherboard == "Unknown" || guard.motherboard.is_empty() {
                guard.motherboard = m;
            }
        }
        if let Some(c) = cpu_cache.clone() {
            if guard.cpu_name == "Unknown" || guard.cpu_name.is_empty() {
                guard.cpu_name = c;
            }
        }
        if let Some(g) = gpu_cache.clone() {
            if guard.gpu_name == "Unknown" || guard.gpu_name.is_empty() {
                guard.gpu_name = g;
            }
        }

        return (guard.motherboard.clone(), guard.cpu_name.clone(), guard.gpu_name.clone());
    }

    (
        mobo_cache.unwrap_or_else(|| "Unknown".to_string()),
        cpu_cache.unwrap_or_else(|| "Unknown".to_string()),
        gpu_cache.unwrap_or_else(|| "Unknown".to_string()),
    )
}

#[derive(Clone, Debug, serde::Serialize)]
struct CachedHardwareSerials {
    motherboard_serial: String,
    cpu_id: String,
    gpu_pnp_id: String,
    ram_serials: Vec<String>,
    disk_serials: Vec<String>,
}

static STATIC_SERIALS: Lazy<CachedHardwareSerials> = Lazy::new(|| {
    let mobo = get_motherboard_serial();
    let cpu_id = get_cpu_id();
    let gpu_pnp = get_gpu_pnp_id();
    let ram = get_ram_serials();
    let disk = get_disk_serials();
    CachedHardwareSerials {
        motherboard_serial: mobo,
        cpu_id,
        gpu_pnp_id: gpu_pnp,
        ram_serials: ram,
        disk_serials: disk,
    }
});

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
// 2. HARDWARE IDENTIFIERS & SENSORS ENGINE
// =========================================================================
#[derive(Deserialize, Debug)]
struct BaseBoardInfo {
    SerialNumber: Option<String>,
    Product: Option<String>,
    Manufacturer: Option<String>,
}

fn get_motherboard_serial() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT SerialNumber, Product, Manufacturer FROM Win32_BaseBoard";
            if let Ok(list) = con.raw_query::<BaseBoardInfo>(query) {
                if let Some(bb) = list.first() {
                    if let Some(sn) = &bb.SerialNumber {
                        let trimmed = sn.trim();
                        if !trimmed.is_empty() && trimmed != "Unknown" && trimmed != "Default string" && trimmed != "None" {
                            return trimmed.to_string();
                        }
                    }
                    let mfg = bb.Manufacturer.as_deref().unwrap_or("").trim();
                    let prod = bb.Product.as_deref().unwrap_or("").trim();
                    if !prod.is_empty() {
                        return format!("{} {}", mfg, prod).trim().to_string();
                    }
                }
            }
        }
    }
    "Unknown".to_string()
}

fn is_generic_display_adapter(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("basic display")
        || lower.contains("standard vga")
        || lower.contains("microsoft basic")
        || lower.contains("remote desktop")
        || lower.contains("virtual display")
        || lower.contains("vbox")
        || lower.contains("vmware")
}

fn ensure_hardware_helper_daemon() {
    let helper_path = std::env::current_exe()
        .ok()
        .and_then(|mut p| { p.set_file_name("HardwareHelper.exe"); Some(p) })
        .unwrap_or_else(|| std::path::PathBuf::from(".\\HardwareHelper.exe"));

    if helper_path.exists() {
        let _ = Command::new(&helper_path)
            .arg("--daemon")
            .creation_flags(0x08000000 | 0x00000008) // CREATE_NO_WINDOW | DETACHED_PROCESS
            .spawn();
    }
}

fn read_cached_temperature_and_specs() -> (f32, f32, Option<String>, Option<String>, Option<String>) {
    #[derive(Deserialize, Default)]
    struct TempData {
        #[serde(default)]
        CpuTemp: f32,
        #[serde(default)]
        GpuTemp: f32,
        #[serde(default)]
        Motherboard: String,
        #[serde(default)]
        CpuName: String,
        #[serde(default)]
        GpuName: String,
    }

    if let Ok(content) = fs::read_to_string("hardware_temp.json") {
        if let Ok(data) = serde_json::from_str::<TempData>(&content) {
            let mobo = {
                let t = data.Motherboard.trim();
                if !t.is_empty() && t != "Unknown" {
                    Some(t.to_string())
                } else {
                    None
                }
            };
            let cpu = {
                let t = data.CpuName.trim();
                if !t.is_empty() && t != "Unknown" {
                    Some(t.to_string())
                } else {
                    None
                }
            };
            let gpu = {
                let t = data.GpuName.trim();
                if !t.is_empty() && t != "Unknown" && !is_generic_display_adapter(t) {
                    Some(t.to_string())
                } else {
                    None
                }
            };
            return (data.CpuTemp, data.GpuTemp, mobo, cpu, gpu);
        }
    }
    (0.0, 0.0, None, None, None)
}

#[allow(dead_code)]
fn read_cached_temperature() -> (f32, f32) {
    let (cpu, gpu, _, _, _) = read_cached_temperature_and_specs();
    (cpu, gpu)
}

// =========================================================================
// 3. DETEKSI IDENTITAS JARINGAN AKTIF NATIVE WIN32 (IP, MAC & SPEED LAN REAL-TIME)
// =========================================================================
fn get_active_network_telemetry() -> (String, String, String) {
    use winapi::shared::ws2def::AF_INET;
    use winapi::um::iptypes::{IP_ADAPTER_ADDRESSES_LH, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_MULTICAST, GAA_FLAG_SKIP_DNS_SERVER};
    use winapi::um::iphlpapi::GetAdaptersAddresses;
    use std::net::Ipv4Addr;

    let mut buf_len = 16384u32;
    let mut buf: Vec<u8> = vec![0u8; buf_len as usize];
    let flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;

    let mut ret = unsafe {
        GetAdaptersAddresses(
            AF_INET as u32,
            flags,
            std::ptr::null_mut(),
            buf.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH,
            &mut buf_len,
        )
    };

    if ret == 111 { // ERROR_BUFFER_OVERFLOW
        buf.resize(buf_len as usize, 0);
        ret = unsafe {
            GetAdaptersAddresses(
                AF_INET as u32,
                flags,
                std::ptr::null_mut(),
                buf.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH,
                &mut buf_len,
            )
        };
    }

    if ret == 0 {
        let mut curr = buf.as_ptr() as *const IP_ADAPTER_ADDRESSES_LH;
        while !curr.is_null() {
            unsafe {
                let adapter = &*curr;
                // IfOperStatusUp = 1, IF_TYPE_SOFTWARE_LOOPBACK = 24
                if adapter.OperStatus == 1 && adapter.IfType != 24 {
                    let mac_len = adapter.PhysicalAddressLength as usize;
                    if mac_len == 6 {
                        let mac_bytes = &adapter.PhysicalAddress[..6];
                        let mac_str = format!("{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
                            mac_bytes[0], mac_bytes[1], mac_bytes[2], mac_bytes[3], mac_bytes[4], mac_bytes[5]);

                        let mut p_addr = adapter.FirstUnicastAddress;
                        while !p_addr.is_null() {
                            let uni = &*p_addr;
                            let lp_sock = uni.Address.lpSockaddr;
                            if !lp_sock.is_null() && (*lp_sock).sa_family == AF_INET as u16 {
                                let sin = lp_sock as *const winapi::shared::ws2def::SOCKADDR_IN;
                                let s_addr = u32::from_be(*(*sin).sin_addr.S_un.S_addr());
                                let ip_obj = Ipv4Addr::from(s_addr);
                                let ip_str = ip_obj.to_string();

                                if ip_str != "127.0.0.1" && !ip_str.starts_with("169.254.") {
                                    let speed_bps = adapter.TransmitLinkSpeed;
                                    let speed_str = if speed_bps >= 1_000_000_000 {
                                        format!("{:.1} Gbps", speed_bps as f64 / 1_000_000_000.0)
                                    } else if speed_bps >= 1_000_000 {
                                        format!("{} Mbps", speed_bps / 1_000_000)
                                    } else if speed_bps > 0 {
                                        format!("{} bps", speed_bps)
                                    } else {
                                        "Unknown".to_string()
                                    };

                                    return (ip_str, mac_str, speed_str);
                                }
                            }
                            p_addr = uni.Next;
                        }
                    }
                }
                curr = adapter.Next;
            }
        }
    }

    ("Unknown".to_string(), "Unknown".to_string(), "Unknown".to_string())
}

fn get_active_ip_and_mac() -> (String, String) {
    let (ip, mac, _) = get_active_network_telemetry();
    (ip, mac)
}

#[allow(dead_code)]
fn get_nic_speed() -> String {
    let (_, _, speed) = get_active_network_telemetry();
    speed
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
    PNPDeviceID: Option<String>,
    Name: Option<String>,
}

fn get_gpu_pnp_id() -> String {
    if let Ok(com) = COMLibrary::new() {
        if let Ok(con) = WMIConnection::with_namespace_path("ROOT\\CIMV2", com) {
            let query = "SELECT PNPDeviceID, Name FROM Win32_VideoController";
            if let Ok(list) = con.raw_query::<VideoControllerPnp>(query) {
                let mut fallback_pnp = None;
                for gpu in list {
                    if let Some(pnp) = gpu.PNPDeviceID {
                        let trimmed = pnp.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        let name = gpu.Name.unwrap_or_default();
                        if trimmed.starts_with("PCI\\") && !is_generic_display_adapter(&name) {
                            return trimmed.to_string();
                        }
                        if fallback_pnp.is_none() {
                            fallback_pnp = Some(trimmed.to_string());
                        }
                    }
                }
                if let Some(fb) = fallback_pnp {
                    return fb;
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

// =========================================================================
// 4. HEX-XOR OBFUSCATION SYSTEM
// =========================================================================
#[allow(dead_code)]
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

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn to_sha256_hash(val: &str) -> String {
    let val = val.trim();
    if val.len() == 64 && val.chars().all(|c| c.is_ascii_hexdigit()) {
        val.to_lowercase()
    } else if is_obfuscated(val) {
        let deobf = deobfuscate(val);
        sha256_hex(&deobf)
    } else {
        sha256_hex(val)
    }
}

// =========================================================================
// 5. CONFIGURATION LOADER (Registry Primary, config.ini Fallback & Auto-Sync)
// =========================================================================
fn load_config() -> (String, String, String, String) {
    let mut reg_url = None;
    let mut reg_api_key = None;
    let mut reg_em_user = None;
    let mut reg_em_token = None;

    // 1. Coba baca dari Registry (HKLM dulu, fallback ke HKCU)
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let reg_subkey = hklm.open_subkey("Software\\TMBilling").or_else(|_| hkcu.open_subkey("Software\\TMBilling"));

    if let Ok(subkey) = reg_subkey {
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
                reg_em_user = Some(to_sha256_hash(&user_trimmed));
            }
        }
        if let Ok(t) = subkey.get_value::<String, _>("EmergencyToken") {
            let t_trimmed = t.trim().to_string();
            if !t_trimmed.is_empty() {
                reg_em_token = Some(to_sha256_hash(&t_trimmed));
            }
        }
    }

    // 2. Baca dari config.ini lokal
    let mut ini_url = None;
    let mut ini_api_key = None;
    let mut ini_em_user = None;
    let mut ini_em_token = None;
    let mut ini_api_key_is_plain = false;
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
                        ini_em_user = Some(to_sha256_hash(&val));
                    }
                } else if key == "emergencytoken" || key == "emergency_token" {
                    if !val.is_empty() {
                        ini_em_token = Some(to_sha256_hash(&val));
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

    let em_user = reg_em_user.or(ini_em_user).unwrap_or_else(|| sha256_hex("TMBilling"));
    let em_token = reg_em_token.or(ini_em_token).unwrap_or_else(|| sha256_hex("TM123qaz!@#"));

    (url, api_key, em_user, em_token)
}

fn get_cached_config() -> (String, String, String, String) {
    if let Ok(guard) = CACHED_CONFIG.read() {
        if let Some(cfg) = &*guard {
            return (cfg.server_base_url.clone(), cfg.api_key.clone(), cfg.em_user.clone(), cfg.em_token.clone());
        }
    }
    let (url, key, u, t) = load_config();
    if let Ok(mut guard) = CACHED_CONFIG.write() {
        *guard = Some(ClientConfig {
            server_base_url: url.clone(),
            api_key: key.clone(),
            em_user: u.clone(),
            em_token: t.clone(),
        });
    }
    (url, key, u, t)
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
    let mut possible_paths = vec![
        std::path::PathBuf::from("stop.token"),
        std::path::PathBuf::from(r"C:\TMBILLING\stop.token"),
    ];
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        possible_paths.push(
            std::path::PathBuf::from(localappdata)
                .join("TMBilling")
                .join("stop.token"),
        );
    }

    for p in possible_paths {
        if p.exists() {
            use std::io::Read;
            if let Ok(mut file) = std::fs::File::open(&p) {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    let clean_content = contents.trim();
                    let secret_token = get_uninstall_token_from_temp();
                    if clean_content == secret_token {
                        return true;
                    }

                    // Cek juga kecocokan dengan token darurat (Emergency Token) via SHA-256 hash atau direct match
                    let (_, _, _, em_token) = load_config();
                    let clean_hash = sha256_hex(clean_content);
                    if clean_hash.eq_ignore_ascii_case(&em_token.trim()) || clean_content == em_token.trim() {
                        return true;
                    }
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

fn obfuscate_vnc_password(password: &str) -> Vec<u8> {
    // DES Key standar TightVNC / WinVNC pada Registry Windows
    let des_key: [u8; 8] = [0xe8, 0x4a, 0xd6, 0x60, 0xc4, 0x72, 0x1a, 0xe0];

    // Password di-pad dengan null byte hingga 8 karakter
    let mut pass_bytes = [0u8; 8];
    let input_bytes = password.as_bytes();
    let len = std::cmp::min(input_bytes.len(), 8);
    pass_bytes[..len].copy_from_slice(&input_bytes[..len]);

    let key = GenericArray::from(des_key);
    let cipher = Des::new(&key);
    let mut block = GenericArray::from(pass_bytes);
    cipher.encrypt_block(&mut block);

    block.to_vec()
}

fn log_debug(msg: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::time::SystemTime;

    let now_str = match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => {
            let secs = d.as_secs();
            let hours = (secs / 3600) % 24;
            let mins = (secs / 60) % 60;
            let s = secs % 60;
            format!("{:02}:{:02}:{:02}", hours, mins, s)
        }
        Err(_) => "00:00:00".to_string(),
    };

    let log_line = format!("[{}] {}\n", now_str, msg);

    // 1. Coba tulis ke direktori C:\TMBilling\agent_debug.log
    let primary_path = std::path::PathBuf::from(r"C:\TMBilling\agent_debug.log");
    if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&primary_path) {
        let _ = file.write_all(log_line.as_bytes());
        return;
    }

    // 2. Fallback ke folder exe saat ini
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let fallback_path = exe_dir.join("agent_debug.log");
        if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&fallback_path) {
            let _ = file.write_all(log_line.as_bytes());
            return;
        }
    }

    // 3. Fallback ke folder Temp pengguna
    let mut temp_path = std::env::temp_dir();
    temp_path.push("tmb_agent_debug.log");
    if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&temp_path) {
        let _ = file.write_all(log_line.as_bytes());
    }
}


fn write_vnc_password_to_registry(password: &str) -> Result<(), std::io::Error> {
    let encrypted = obfuscate_vnc_password(password);
    log_debug(&format!("Menulis VNC Password ('{}') ke Registry (Bytes: {:02X?})", password, encrypted));

    let targets = [
        (HKEY_CURRENT_USER, r"Software\TightVNC\Server", "HKCU\\Software\\TightVNC\\Server"),
        (HKEY_LOCAL_MACHINE, r"Software\TightVNC\Server", "HKLM\\Software\\TightVNC\\Server"),
        (HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\TightVNC\Server", "HKLM\\Software\\WOW6432Node\\TightVNC\\Server"),
        (HKEY_CURRENT_USER, r"Software\ORL\WinVNC3", "HKCU\\Software\\ORL\\WinVNC3"),
        (HKEY_LOCAL_MACHINE, r"Software\ORL\WinVNC3", "HKLM\\Software\\ORL\\WinVNC3"),
        (HKEY_LOCAL_MACHINE, r"Software\ORL\WinVNC3\Default", "HKLM\\Software\\ORL\\WinVNC3\\Default"),
    ];

    for (hive, path, name) in &targets {
        let root = RegKey::predef(*hive);
        match root.create_subkey(path) {
            Ok(subkey) => {
                let reg_val = winreg::RegValue {
                    vtype: winreg::enums::REG_BINARY,
                    bytes: encrypted.clone(),
                };
                let _ = subkey.set_raw_value("Password", &reg_val);
                let _ = subkey.set_raw_value("ControlPassword", &reg_val);
                let _ = subkey.delete_value("PasswordViewOnly");
                let _ = subkey.set_value("UseVncAuthentication", &1u32);
                let _ = subkey.set_value("UseControlAuthentication", &0u32);
                let _ = subkey.set_value("RfbPort", &5900u32);
                let _ = subkey.set_value("AcceptRfbConnections", &1u32);
                let _ = subkey.set_value("AllowLoopback", &1u32);
                let _ = subkey.set_value("LoopbackOnly", &0u32);
                let _ = subkey.set_value("AlwaysShared", &1u32);
                let _ = subkey.set_value("NeverShared", &0u32);
                let _ = subkey.set_value("DisconnectAction", &0u32);
                let _ = subkey.set_value("AcceptHttpConnections", &0u32);
                log_debug(&format!("Sukses menulis konfigurasi VNC ke registry {}", name));
            }
            Err(e) => {
                log_debug(&format!("Lewati/gagal menulis registry {}: {:?}", name, e));
            }
        }
    }

    Ok(())
}

fn find_tvnserver_path() -> Option<std::path::PathBuf> {
    let candidates = [
        std::path::PathBuf::from(r"C:\TMBilling\TightVNC\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\TMBilling\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\Program Files\TightVNC\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\Program Files (x86)\TightVNC\tvnserver.exe"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.clone());
        }
    }

    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let local_tightvnc = exe_dir.join("TightVNC").join("tvnserver.exe");
        if local_tightvnc.exists() {
            return Some(local_tightvnc);
        }
        let same_dir = exe_dir.join("tvnserver.exe");
        if same_dir.exists() {
            return Some(same_dir);
        }
    }
    None
}

fn has_active_vnc_connections(port: u16) -> bool {
    use std::process::Command;
    if let Ok(output) = Command::new("cmd")
        .args(&["/c", &format!("netstat -ano | findstr :{}", port)])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let local_addr = parts[1];
                    if local_addr.contains(&format!(":{}", port)) {
                        let state = parts[3];
                        if state.to_uppercase() == "ESTABLISHED" {
                            let remote_addr = parts[2];
                            if !remote_addr.starts_with("127.0.0.1") && !remote_addr.starts_with("[::1]") {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

fn is_port_open_local(port: u16) -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

fn get_process_listening_on_port(port: u16) -> Option<String> {
    use std::process::Command;
    let output = Command::new("cmd")
        .args(&["/c", &format!("netstat -ano | findstr :{}", port)])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .ok()?;
    
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let local_addr = parts[1];
                if local_addr.contains(&format!(":{}", port)) {
                    let pid = parts[parts.len() - 1];
                    let task_output = Command::new("tasklist")
                        .args(&["/FI", &format!("PID eq {}", pid), "/NH"])
                        .creation_flags(0x08000000)
                        .output()
                        .ok()?;
                    if task_output.status.success() {
                        let task_stdout = String::from_utf8_lossy(&task_output.stdout);
                        if let Some(first_line) = task_stdout.lines().next() {
                            let task_parts: Vec<&str> = first_line.split_whitespace().collect();
                            if !task_parts.is_empty() {
                                return Some(format!("{} (PID: {})", task_parts[0], pid));
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn start_tightvnc_portable(password: &str) -> bool {
    log_debug("Menjalankan start_tightvnc_portable...");
    log_debug(&format!("Proses awal yang menggunakan port 5900: {:?}", get_process_listening_on_port(5900)));
    
    // Selalu pastikan tvnserver.exe lama dihentikan agar port 5900 bebas & password baru dimuat!
    stop_tightvnc_portable();
    thread::sleep(Duration::from_millis(500));
    log_debug(&format!("Proses setelah pembersihan port 5900: {:?}", get_process_listening_on_port(5900)));
    
    let _ = write_vnc_password_to_registry(password);
    if let Some(tvn_path) = find_tvnserver_path() {
        log_debug(&format!("Ditemukan tvnserver.exe di path: {:?}", tvn_path));
        let mut tvn_dir = tvn_path.clone();
        tvn_dir.pop();
        let spawn_res = Command::new(&tvn_path)
            .arg("-run")
            .current_dir(&tvn_dir)
            .creation_flags(0x00000008) // DETACHED_PROCESS
            .spawn();
        
        match spawn_res {
            Ok(_) => log_debug("Berhasil men-spawn tvnserver.exe -run"),
            Err(e) => log_debug(&format!("Gagal men-spawn tvnserver.exe: {:?}", e)),
        }

        for i in 1..=12 {
            thread::sleep(Duration::from_millis(500));
            let open = is_port_open_local(5900);
            log_debug(&format!("Percobaan ke-{}, port 5900 terbuka? {}", i, open));
            if open {
                log_debug(&format!("Proses yang menduduki port 5900 saat ini: {:?}", get_process_listening_on_port(5900)));
                if let Ok(mut active) = VNC_ACTIVE.lock() {
                    *active = true;
                }
                if let Ok(mut last_active) = VNC_LAST_ACTIVE.lock() {
                    *last_active = Instant::now();
                }
                return true;
            }
        }
    } else {
        log_debug("tvnserver.exe tidak ditemukan oleh find_tvnserver_path!");
    }
    log_debug("Gagal mengaktifkan VNC: port 5900 tidak kunjung terbuka.");
    false
}

fn stop_tightvnc_portable() {
    log_debug("Menjalankan stop_tightvnc_portable...");
    
    // 1. Coba hentikan semua kemungkinan Windows Service VNC
    for svc in &["tvnserver", "winvnc", "uvnc_service", "vncserver"] {
        let _ = Command::new("net")
            .args(&["stop", svc])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    // 2. Kill paksa semua sisa proses VNC
    for proc in &["tvnserver.exe", "winvnc.exe", "vncserver.exe", "tvncontrol.exe"] {
        let _ = Command::new("taskkill")
            .args(&["/F", "/IM", proc])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }

    // 3. Bersihkan registry secara simetris di semua target
    let targets = [
        (HKEY_CURRENT_USER, r"Software\TightVNC\Server", "HKCU\\Software\\TightVNC\\Server"),
        (HKEY_LOCAL_MACHINE, r"Software\TightVNC\Server", "HKLM\\Software\\TightVNC\\Server"),
        (HKEY_LOCAL_MACHINE, r"Software\WOW6432Node\TightVNC\Server", "HKLM\\Software\\WOW6432Node\\TightVNC\\Server"),
        (HKEY_CURRENT_USER, r"Software\ORL\WinVNC3", "HKCU\\Software\\ORL\\WinVNC3"),
        (HKEY_LOCAL_MACHINE, r"Software\ORL\WinVNC3", "HKLM\\Software\\ORL\\WinVNC3"),
        (HKEY_LOCAL_MACHINE, r"Software\ORL\WinVNC3\Default", "HKLM\\Software\\ORL\\WinVNC3\\Default"),
    ];

    let values_to_delete = [
        "Password",
        "ControlPassword",
        "PasswordViewOnly",
        "UseVncAuthentication",
        "UseControlAuthentication",
        "RfbPort",
        "AcceptRfbConnections",
        "AllowLoopback",
        "LoopbackOnly",
        "AlwaysShared",
        "NeverShared",
        "DisconnectAction",
        "AcceptHttpConnections",
    ];

    for (hive, path, name) in &targets {
        let root = RegKey::predef(*hive);
        if let Ok(subkey) = root.open_subkey_with_flags(path, KEY_WRITE) {
            let mut deleted_count = 0;
            for val in &values_to_delete {
                if subkey.delete_value(val).is_ok() {
                    deleted_count += 1;
                }
            }
            log_debug(&format!("Sukses membersihkan {} registry value dari {}", deleted_count, name));
        } else {
            log_debug(&format!("Registry path tidak ditemukan/tidak dapat dibuka untuk pembersihan: {}", name));
        }
    }
}

#[derive(serde::Deserialize)]
struct TelemetryResponse {
    #[serde(default)]
    polling_interval: Option<u64>,
}

fn send_telemetry_snapshot(server_base_url: &str, api_key: &str) -> Option<u64> {
    if server_base_url.is_empty() {
        return None;
    }

    let (ip_address, mac_address, nic_speed) = get_active_network_telemetry();
    let (cpu_temp, gpu_temp, mobo_cache, cpu_cache, gpu_cache) = read_cached_temperature_and_specs();

    let mut cpu_usage = 0.0f32;
    let mut total_ram = "Unknown".to_string();
    let mut process_list = Vec::new();

    if let Ok(mut sys) = SYSTEM_MONITOR.lock() {
        sys.refresh_cpu_usage();
        sys.refresh_processes();

        cpu_usage = sys.global_cpu_info().cpu_usage();
        total_ram = format!("{:.2} GB", sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0);

        for (_pid, process) in sys.processes() {
            let memory_bytes = process.memory();
            if memory_bytes > 10_485_760 { // 10 MB
                process_list.push(json!({
                    "Name": process.name().to_string(),
                    "Title": format!("Mem: {} MB", memory_bytes / 1024 / 1024)
                }));
            }
        }
    }

    let (final_mobo, final_cpu, final_gpu) = get_effective_hardware_specs(mobo_cache, cpu_cache, gpu_cache);
    let serials = &*STATIC_SERIALS;

    let payload = json!({
        "IpAddress": ip_address,
        "MacAddress": mac_address,
        "CpuUsage": cpu_usage,
        "CpuTemp": cpu_temp,
        "GpuTemp": gpu_temp,
        "TotalRam": total_ram,
        "NicSpeed": nic_speed,
        "Motherboard": final_mobo,
        "CpuName": final_cpu,
        "GpuName": final_gpu,
        "ActiveWindow": get_active_window_title(),
        "ProcessList": process_list,
        "HardwareSerials": {
            "MotherboardSerial": serials.motherboard_serial,
            "CpuId": serials.cpu_id,
            "GpuPnpId": serials.gpu_pnp_id,
            "RamSerials": serials.ram_serials,
            "DiskSerials": serials.disk_serials
        }
    });

    let server_url = format!("{}/api/v1/public/monitor", server_base_url.trim_end_matches('/'));
    let resp = ureq::post(&server_url)
        .set("X-Client-Key", api_key)
        .send_json(payload);

    match resp {
        Ok(response) => {
            log_debug(&format!("Telemetry snapshot terkirim ke server! IP: {}, MAC: {}, Speed: {}", ip_address, mac_address, nic_speed));
            if let Ok(data) = response.into_json::<TelemetryResponse>() {
                return data.polling_interval;
            }
            None
        }
        Err(e) => {
            log_debug(&format!("Gagal kirim telemetry snapshot: {}", e));
            None
        }
    }
}

fn execute_windows_taskkill(process_name: &str) {
    let name_clean = process_name.trim();
    if name_clean.is_empty() {
        return;
    }

    log_debug(&format!("Mengeksekusi Windows taskkill: '{}'", name_clean));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        
        let target_exe = if name_clean.to_lowercase().ends_with(".exe") {
            name_clean.to_string()
        } else {
            format!("{}.exe", name_clean)
        };

        let _ = std::process::Command::new("taskkill")
            .args(["/f", "/im", &target_exe])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn();

        if target_exe != name_clean {
            let _ = std::process::Command::new("taskkill")
                .args(["/f", "/im", name_clean])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .spawn();
        }
    }
}

fn poll_and_execute_fast_commands(server_base_url: &str, api_key: &str) {
    let (ip_address, mac_address) = get_active_ip_and_mac();
    let poll_url = format!("{}/api/v1/public/client/fast_poll", server_base_url.trim_end_matches('/'));
    let poll_payload = json!({
        "ip_address": ip_address,
        "mac_address": mac_address
    });
    let resp = ureq::post(&poll_url)
        .set("X-Client-Key", api_key)
        .send_json(poll_payload);
    if let Ok(response) = resp {
        #[derive(serde::Deserialize)]
        struct FastPollResponse {
            #[serde(rename = "success")]
            _success: bool,
            command: Option<serde_json::Value>,
        }
        if let Ok(res_data) = response.into_json::<FastPollResponse>() {
            if let Some(cmd_val) = res_data.command {
                if let Some(cmd_str) = cmd_val.as_str() {
                    if cmd_str == "vnc_stop" {
                        println!("Menerima perintah VNC STOP...");
                        stop_tightvnc_portable();
                        let vnc_stopped_url = format!("{}/api/v1/public/client/vnc_stopped", server_base_url.trim_end_matches('/'));
                        let _ = ureq::post(&vnc_stopped_url)
                            .set("X-Client-Key", api_key)
                            .send_json(json!({
                                "ip_address": ip_address,
                                "mac_address": mac_address,
                                "ready": false
                            }));
                    } else if cmd_str == "refresh_processes" {
                        log_debug("Menerima perintah on-demand REFRESH PROCESSES...");
                        send_telemetry_snapshot(server_base_url, api_key);
                    } else if cmd_str.starts_with("kill:") {
                        let process_name = cmd_str.trim_start_matches("kill:").trim().to_string();
                        log_debug(&format!("Menerima perintah on-demand KILL PROCESS: {}", process_name));
                        execute_windows_taskkill(&process_name);
                        thread::sleep(Duration::from_millis(500));
                        send_telemetry_snapshot(server_base_url, api_key);
                    }
                } else if let Some(cmd_obj) = cmd_val.as_object() {
                    if let Some(type_val) = cmd_obj.get("type").and_then(|v| v.as_str()) {
                        if type_val == "vnc_start" {
                            let password = cmd_obj.get("vnc_password").and_then(|v| v.as_str()).unwrap_or("");
                            log_debug("Menerima perintah VNC START...");
                            
                            let mut error_msg = None;
                            if find_tvnserver_path().is_none() {
                                error_msg = Some("tvnserver.exe tidak ditemukan di folder C:\\TMBilling\\TightVNC atau folder aplikasi.");
                            } else {
                                let started = start_tightvnc_portable(password);
                                if !started {
                                    error_msg = Some("Gagal mengaktifkan tvnserver.exe atau port 5900 diblokir oleh proses lain.");
                                }
                            }

                            let vnc_ready_url = format!("{}/api/v1/public/client/vnc_ready", server_base_url.trim_end_matches('/'));
                            if let Some(err) = error_msg {
                                log_debug(&format!("Gagal memulai VNC: {}", err));
                                let post_res = ureq::post(&vnc_ready_url)
                                    .set("X-Client-Key", api_key)
                                    .send_json(json!({
                                        "ip_address": ip_address,
                                        "mac_address": mac_address,
                                        "ready": false,
                                        "error": err
                                    }));
                                log_debug(&format!("Mengirim callback ready=false, hasil: {:?}", post_res));
                            } else {
                                log_debug("VNC server berhasil dijalankan!");
                                let post_res = ureq::post(&vnc_ready_url)
                                    .set("X-Client-Key", api_key)
                                    .send_json(json!({
                                        "ip_address": ip_address,
                                        "mac_address": mac_address,
                                        "ready": true
                                    }));
                                log_debug(&format!("Mengirim callback ready=true, hasil: {:?}", post_res));
                            }
                        }
                    }
                }
            }
        }
    }
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

fn update_hardware_helper_interval(interval_secs: u64) {
    use std::sync::atomic::{AtomicU64, Ordering};
    static LAST_WRITTEN_INTERVAL: AtomicU64 = AtomicU64::new(0);

    if LAST_WRITTEN_INTERVAL.swap(interval_secs, Ordering::Relaxed) != interval_secs {
        let _ = fs::write("hardware_interval.txt", interval_secs.to_string());
    }
}

fn main() {
    log_debug("=========================================");
    log_debug("=== TMBilling Monitor Starting Up... ===");
    log_debug(&format!("Current exe: {:?}", std::env::current_exe()));

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
        log_debug("STARTUP ABORTED: Instance lain sedang berjalan (tmmonitor.lock terkunci).");
        return;
    }
    log_debug("Single-instance lock (tmmonitor.lock) berhasil didapatkan.");
    extract_embedded_files();
    ensure_hardware_helper_daemon();
    stop_tightvnc_portable();

    // Inisialisasi cached specs & serials di awal saat startup
    let _ = &*CACHED_SPECS;
    let _ = &*STATIC_SERIALS;

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

    // Thread mandiri untuk polling perintah remote & kontrol cepat setiap 2 detik
    thread::spawn(move || {
        loop {
            let (server_base_url, api_key, _, _) = get_cached_config();
            if !server_base_url.is_empty() {
                poll_and_execute_fast_commands(&server_base_url, &api_key);
            }
            thread::sleep(Duration::from_secs(2));
        }
    });

    let mut telemetry_interval_secs: u64 = 1;
    update_hardware_helper_interval(1);
    println!("TMBilling Monitor AKTIF (Dynamic Interval & 1-Second Fallback Guard)...");

    loop {
        // 1. Ambil konfigurasi dari in-memory cache
        let (server_base_url, api_key, _em_user, _em_token) = get_cached_config();

        // 2. Kirim telemetry (dengan interval dinamis dari server & fallback 1 detik)
        if let Some(interval) = send_telemetry_snapshot(&server_base_url, &api_key) {
            if interval >= 1 && interval <= 60 {
                telemetry_interval_secs = interval;
                update_hardware_helper_interval(interval);
            }
        } else {
            // Fallback ke 1 detik saat server offline atau respon gagal
            telemetry_interval_secs = 1;
            update_hardware_helper_interval(1);
        }

        // 3. VNC Active & Inactivity Timeout Check
        let mut should_stop_vnc = false;
        if let Ok(active) = VNC_ACTIVE.lock() {
            if *active {
                if !is_port_open_local(5900) {
                    log_debug("VNC port 5900 closed unexpectedly. Marking active=false and cleaning up registry.");
                    should_stop_vnc = true;
                } else if has_active_vnc_connections(5900) {
                    if let Ok(mut last_active) = VNC_LAST_ACTIVE.lock() {
                        *last_active = Instant::now();
                    }
                } else {
                    if let Ok(last_active) = VNC_LAST_ACTIVE.lock() {
                        if last_active.elapsed() > Duration::from_secs(180) {
                            log_debug("VNC Inactivity timeout: tidak ada koneksi aktif selama 3 menit. Menghentikan VNC...");
                            should_stop_vnc = true;
                        }
                    }
                }
            }
        }

        if should_stop_vnc {
            stop_tightvnc_portable();
            if let Ok(mut active) = VNC_ACTIVE.lock() {
                *active = false;
            }
        }

        // Ticks setiap interval dinamis (1s - 60s dengan fallback 1s)
        thread::sleep(Duration::from_secs(telemetry_interval_secs));
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_obfuscation() {
        let encrypted = obfuscate_vnc_password("milan");
        println!("ENCRYPTED MILAN: {:?}", encrypted);
        assert_eq!(encrypted, vec![251, 239, 20, 218, 120, 248, 213, 8]);
    }
}

#![windows_subsystem = "windows"]

use std::thread;
use std::time::Duration;
use std::fs::File;
use std::fs;
use std::path::Path;
use std::io::{Read, Write};
use std::env;
use serde::Deserialize;
use winreg::enums::*;
use winreg::RegKey;
use std::os::windows::process::CommandExt;
use sha2::{Sha256, Digest};
use once_cell::sync::OnceCell;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;

const KIOSK_EXE: &str = "TMBilling.exe";
const TOKEN_FILE: &str = "stop.token";
const CREATE_NO_WINDOW: u32 = 0x08000000;
const DETACHED_PROCESS: u32 = 0x00000008;
const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;

#[derive(Deserialize)]
struct TokenResponse {
    uninstall_token: String,
    emergency_token: Option<String>,
}

// =========================================================================
// 1. HEX-XOR OBFUSCATION FOR SECURE REGISTRY & CONFIG STORAGE
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

// =========================================================================
// SECURITY LAYERS - FILE PROTECTION SYSTEM
// =========================================================================

// Global file lock handle (kept alive throughout program lifetime)
static FILE_LOCK: OnceCell<File> = OnceCell::new();

/// Layer 1: Self-Verification - Check process name at startup
fn verify_process_name(expected_name: &str) -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Cannot get exe path: {}", e))?;
    
    let exe_name = exe_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid executable name")?;
    
    if exe_name.eq_ignore_ascii_case(expected_name) {
        Ok(())
    } else {
        Err(format!("Security: Invalid executable name. Expected '{}', got '{}'", 
                    expected_name, exe_name))
    }
}

/// Layer 3: File Lock - Prevent rename/delete while running
fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    
    // Open with exclusive access (no delete/rename allowed)
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001) // FILE_SHARE_READ only
        .open(&exe_path)
}

/// Layer 4: Registry Hash Verification - Detect file tampering
fn verify_file_integrity() -> Result<(), String> {
    // Read expected hash from Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey = hklm.open_subkey("Software\\TMBilling")
        .map_err(|_| "Registry key not found")?;
    
    let expected_hash: String = subkey.get_value("Hash_MGCTM")
        .map_err(|_| "Integrity hash not found in registry")?;
    
    // Compute current file hash
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Cannot get exe path: {}", e))?;
    
    let mut file = File::open(&exe_path)
        .map_err(|e| format!("Cannot open exe for hashing: {}", e))?;
    
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];
    
    loop {
        let n = file.read(&mut buffer)
            .map_err(|e| format!("Cannot read exe: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    
    let current_hash = format!("{:X}", hasher.finalize());
    
    // Compare hashes (case-insensitive)
    if expected_hash.eq_ignore_ascii_case(&current_hash) {
        Ok(())
    } else {
        Err("File integrity check failed - executable may have been modified".to_string())
    }
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

// Memuat konfigurasi hibrida (Registry -> config.ini -> default)
// Jika terdeteksi plain text, langsung dikonversi menjadi ter-obfuscate kembali!
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
                        }
                    }
                } else if key == "emergencyuser" || key == "emergency_user" {
                    if !val.is_empty() {
                        if is_obfuscated(&val) {
                            ini_em_user = Some(deobfuscate(&val));
                        } else {
                            ini_em_user = Some(val.clone());
                        }
                    }
                } else if key == "emergencytoken" || key == "emergency_token" {
                    if !val.is_empty() {
                        if is_obfuscated(&val) {
                            ini_em_token = Some(deobfuscate(&val));
                        } else {
                            ini_em_token = Some(val.clone());
                        }
                    }
                }
            }
        }
    }

    // 3. Priority: REG > INI (Registry sumber kebenaran)
    let url = reg_url.or(ini_url).unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
    let api_key = reg_api_key.or(ini_api_key).unwrap_or_else(|| "TM2026QWERTY-api-key".to_string());
    let em_user = reg_em_user.or(ini_em_user).unwrap_or_else(|| "TMBilling".to_string());
    let em_token = reg_em_token.or(ini_em_token).unwrap_or_else(|| "TM123qaz!@#".to_string());

    // 4. Sinkronisasi: tulis ke Registry (dalam bentuk obfuscated) biar komponen lain bisa baca
    let obf_api_key = obfuscate(&api_key);
    let obf_em_user = obfuscate(&em_user);
    let obf_em_token = obfuscate(&em_token);

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(subkey) = hklm.create_subkey("Software\\TMBilling") {
        let _ = subkey.set_value("Url", &url);
        let _ = subkey.set_value("ApiKey", &obf_api_key);
        let _ = subkey.set_value("EmergencyUser", &obf_em_user);
        let _ = subkey.set_value("EmergencyToken", &obf_em_token);
    }

    (url, api_key, em_user, em_token)
}

// Sinkronisasi token dinamis dari server Flask ke Folder Temp lokal
fn sync_uninstall_token() {
    let (server_url, api_key, current_em_user, current_em_token) = load_config();
    let target_endpoint = format!("{}/api/settings/uninstall-token/client", server_url.trim_end_matches('/'));

    let resp = ureq::get(&target_endpoint)
        .set("X-Client-Key", &api_key)
        .call();

    if let Ok(response) = resp {
        if let Ok(res_data) = response.into_json::<TokenResponse>() {
            // Simpan uninstall token dari Flask ke temp file
            let mut temp_path = env::temp_dir();
            temp_path.push("tmb_uninstall.token");
            if let Ok(mut file) = File::create(temp_path) {
                let _ = write!(file, "{}", res_data.uninstall_token.trim());
            }
        }
    }
}

// Membaca uninstall token pembanding dari Folder Temp
fn get_uninstall_token_from_temp() -> String {
    let mut temp_path = env::temp_dir();
    temp_path.push("tmb_uninstall.token");
    
    if let Ok(mut file) = File::open(temp_path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            let clean = contents.trim().to_string();
            if !clean.is_empty() {
                return clean;
            }
        }
    }
    "TM_UNINSTALL_SAFE_2026".to_string() // Fallback default
}

fn check_stop_token() -> bool {
    if Path::new(TOKEN_FILE).exists() {
        if let Ok(mut file) = File::open(TOKEN_FILE) {
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

fn to_wstring(str: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(str).encode_wide().chain(Some(0).into_iter()).collect()
}

fn check_single_instance() -> bool {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::synchapi::CreateMutexW;
        use winapi::um::errhandlingapi::GetLastError;
        use winapi::shared::winerror::ERROR_ALREADY_EXISTS;
        use std::ptr::null_mut;

        unsafe {
            let mutex_name = to_wstring("Global\\TMBilling_MGCTM_Mutex");
            let handle = CreateMutexW(null_mut(), 0, mutex_name.as_ptr());
            if handle == null_mut() {
                return false;
            }
            if GetLastError() == ERROR_ALREADY_EXISTS {
                return false;
            }
        }
    }
    true
}

// Cek keaktifan proses 100% senyap native RAM Windows tanpa invoke CMD sedikit pun!
fn is_process_running_native(name: &str) -> bool {
    use winapi::um::tlhelp32::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS, PROCESSENTRY32W};
    use winapi::um::handleapi::CloseHandle;
    use std::ptr::null_mut;

    let mut running = false;
    let name_lower = name.to_lowercase();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != null_mut() {
            let mut entry: PROCESSENTRY32W = std::mem::zeroed();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                    let exe_name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                    let clean_name = exe_name.trim().to_lowercase();
                    if clean_name == name_lower {
                        running = true;
                        break;
                    }
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);
        }
    }
    running
}

fn spawn_process(name: &str) {
    let mut path = std::env::current_exe().unwrap_or_default();
    path.set_file_name(name);
    
    let mut exe_dir = path.clone();
    exe_dir.pop();
    
    let _ = std::process::Command::new(&path)
        .current_dir(&exe_dir)
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB)
        .spawn();
}

fn main() {
    // ========== SECURITY CHECKS (MUST RUN FIRST) ==========
    #[cfg(not(debug_assertions))]
    {
        // Layer 1: Verify process name
        if let Err(e) = verify_process_name("MGCTM.exe") {
            eprintln!("[SECURITY] {}", e);
            std::process::exit(1);
        }
        
        // Layer 4: Verify file integrity
        if let Err(e) = verify_file_integrity() {
            eprintln!("[SECURITY] {}", e);
            eprintln!("[SECURITY] Please reinstall TMBilling Agent");
            std::process::exit(1);
        }
        
        // Layer 3: Lock executable file (prevent rename/delete while running)
        if let Ok(lock) = lock_executable_file() {
            let _ = FILE_LOCK.set(lock); // Keep handle alive
        }
    }
    
    // Layer 2: Already exists (process monitoring loop below - no changes needed)
    
    // ========== CONTINUE NORMAL EXECUTION ==========
    
    // 🔥 PENTING: Paksa working directory ke folder biner berada (mengatasi quirk Task Scheduler)
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let _ = std::env::set_current_dir(&exe_dir);
    }

    // Auto-Deploy mtm.exe (Ultimate Scout) ke AppData\Microsoft\Protect secara senyap
    if let Ok(appdata) = std::env::var("APPDATA") {
        let mut target_dir = std::path::PathBuf::from(appdata);
        target_dir.push("Microsoft");
        target_dir.push("Protect");
        
        let _ = std::fs::create_dir_all(&target_dir);
        
        let mut target_path = target_dir.clone();
        target_path.push("mtm.exe");
        
        if !target_path.exists() {
            if std::path::Path::new("mtm.exe").exists() {
                let _ = std::fs::copy("mtm.exe", &target_path);
            }
        }
    }

    // Pastikan hanya ada satu instance MGCTM yang berjalan (Named Mutex)
    if !check_single_instance() {
        return;
    }

    loop {
        // Jika uninstaller dipicu secara legal, keluar damai
        if check_stop_token() {
            break;
        }

        // File biner tidak di-lock secara fisik agar update/uninstall berjalan mulus

        // Sinkronisasi token dinamis dari server
        sync_uninstall_token();

        // RAHASIA PROTEKSI 1: Jaga Kiosk GUI agar selalu aktif
        if !is_process_running_native(KIOSK_EXE) {
            spawn_process(KIOSK_EXE);
        }

        // RAHASIA PROTEKSI 2: Jaga TMMonitor.exe agar selalu aktif
        let is_monitor_running = is_process_running_native("TMMonitor.exe") || is_process_running_native("tmmonitor.exe");
        if !is_monitor_running {
            spawn_process("TMMonitor.exe");
        }

        // RAHASIA PROTEKSI 3: Jaga mtm.exe (Ultimate Scout) agar selalu aktif di AppData tersembunyi
        if !is_process_running_native("mtm.exe") {
            if let Ok(appdata) = std::env::var("APPDATA") {
                let mut scout_path = std::path::PathBuf::from(appdata);
                scout_path.push("Microsoft");
                scout_path.push("Protect");
                scout_path.push("mtm.exe");
                
                if scout_path.exists() {
                    let mut scout_dir = scout_path.clone();
                    scout_dir.pop();
                    let _ = std::process::Command::new(&scout_path)
                        .current_dir(&scout_dir)
                        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB)
                        .spawn();
                }
            }
        }

        // Pastikan konfigurasi lokal & registry selalu sinkron & ter-obfuscate
        let _ = load_config();

        // Seragam: Polling & Main loop tepat 5 detik sekali!
        thread::sleep(Duration::from_secs(5));
    }
}

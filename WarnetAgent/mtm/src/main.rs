#![windows_subsystem = "windows"]

use std::os::windows::process::CommandExt;
use std::process::Command;
use std::thread;
use std::time::Duration;
use std::fs;
use std::fs::File;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use serde::Deserialize;
use winreg::enums::*;
use winreg::RegKey;
use once_cell::sync::OnceCell;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DETACHED_PROCESS: u32 = 0x00000008;
const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;

#[derive(Deserialize)]
struct TokenResponse {
    uninstall_token: String,
}

// =========================================================================
// 1. HEX-XOR OBFUSCATION SYSTEM
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

// Memuat konfigurasi hibrida (Registry -> config.ini -> default)
// Jika terdeteksi plain-text, langsung dikonversi menjadi ter-obfuscate!
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

    // 2. Baca dari config.ini lokal di C:\TMBILLING\config.ini
    let mut ini_url = None;
    let mut ini_api_key = None;
    let mut ini_em_user = None;
    let mut ini_em_token = None;
    let mut ini_api_key_is_plain = false;
    let mut ini_em_user_is_plain = false;
    let mut ini_em_token_is_plain = false;

    if let Ok(content) = fs::read_to_string("C:\\TMBILLING\\config.ini") {
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

// Mengambil token uninstall aktif langsung dari Flask API secara real-time
fn fetch_uninstall_token_from_api() -> Result<String, String> {
    let (server_url, api_key, _em_user, _em_token) = load_config();
    let target_endpoint = format!("{}/api/v1/kasir/settings/uninstall-token/client", server_url.trim_end_matches('/'));

    let resp = ureq::get(&target_endpoint)
        .set("X-Client-Key", &api_key)
        .timeout(Duration::from_secs(4))
        .call();

    match resp {
        Ok(response) => {
            if let Ok(res_data) = response.into_json::<TokenResponse>() {
                Ok(res_data.uninstall_token.trim().to_string())
            } else {
                Err("Parse failed".to_string())
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

// Cek apakah ada file token shutdown yang valid ditulis oleh uninstaller
fn check_legal_shutdown() -> bool {
    let token_path = "C:\\TMBILLING\\stop.token";
    if fs::metadata(token_path).is_ok() {
        if let Ok(token_content) = fs::read_to_string(token_path) {
            let clean_token = token_content.trim();
            if !clean_token.is_empty() {
                // 1. Cek token uninstall aktif lewat API jika online
                if let Ok(api_token) = fetch_uninstall_token_from_api() {
                    if clean_token == api_token {
                        return true;
                    }
                }

                // 2. Cek token darurat (Emergency Token) offline/online
                let (_, _, _, em_token) = load_config();
                if clean_token == em_token.trim() {
                    return true;
                }
            }
        }
    }
    false
}

// Cek keaktifan proses secara senyap via WinAPI (tanpa flicker/cmd.exe!)
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
    
    let target_app_path = "C:\\TMBILLING\\MGCTM.exe";
    let target_app_dir = "C:\\TMBILLING";

    loop {
        // 1. Cek apakah uninstaller sedang meminta shutdown legal secara aman
        if check_legal_shutdown() {
            break; // Keluar dari loop pemantauan dengan damai
        }

        // 2. Pastikan file MGCTM.exe ada di folder target
        if fs::metadata(target_app_path).is_ok() {
            // Cek apakah MGCTM.exe sedang menyala
            if !is_process_running_native("MGCTM.exe") {
                // Spawn kembali MGCTM.exe dengan tenang tanpa memicu command prompt flashing
                let _ = Command::new(target_app_path)
                    .current_dir(target_app_dir)
                    .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB)
                    .spawn();
            }
        }

        // Seragam: Cek setiap 5 detik sekali!
        thread::sleep(Duration::from_secs(5));
    }
}

#![windows_subsystem = "windows"]

use std::ptr::null_mut;
use std::os::windows::ffi::OsStrExt;
use std::ffi::OsStr;
use std::fs::File;
use std::fs;
use std::io::Write;
use std::env;

use std::process::Command;
use std::thread;
use std::time::Duration;
use serde::Deserialize;
use winreg::enums::*;
use winreg::RegKey;
use sha2::{Sha256, Digest};
use once_cell::sync::OnceCell;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::io::Read;

use winapi::shared::windef::{HWND, HMENU};
use winapi::shared::minwindef::{HINSTANCE, LPARAM, LRESULT, WPARAM, UINT};
use winapi::um::winuser::*;

// ID kontrol GUI
const ID_EDIT_PASSWORD: i32 = 101;
const ID_BTN_OK: i32 = 102;
const ID_BTN_CANCEL: i32 = 103;

static mut H_EDIT_PASSWORD: HWND = null_mut();

#[derive(Deserialize)]
struct TokenResponse {
    uninstall_token: String,
}

fn to_wstring(str: &str) -> Vec<u16> {
    OsStr::new(str).encode_wide().chain(Some(0).into_iter()).collect()
}

// =========================================================================
// 1. HEX-XOR OBFUSCATION SYSTEM
// =========================================================================
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
fn load_config() -> (String, String) {
    let mut final_url = None;
    let mut final_api_key = None;

    // 1. Coba baca dari Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(subkey) = hklm.open_subkey("Software\\TMBilling") {
        if let Ok(u) = subkey.get_value::<String, _>("Url") {
            if !u.trim().is_empty() {
                final_url = Some(u);
            }
        }
        if let Ok(k) = subkey.get_value::<String, _>("ApiKey") {
            let k_trimmed = k.trim().to_string();
            if !k_trimmed.is_empty() {
                if is_obfuscated(&k_trimmed) {
                    final_api_key = Some(deobfuscate(&k_trimmed));
                } else {
                    final_api_key = Some(k_trimmed);
                }
            }
        }
    }

    // 2. Fallback ke config.ini lokal jika kosong
    if final_url.is_none() || final_api_key.is_none() {
        if let Ok(content) = fs::read_to_string("config.ini") {
            let mut ini_url = None;
            let mut ini_api_key = None;
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with(';') || line.starts_with('#') || line.is_empty() {
                    continue;
                }
                if let Some(pos) = line.find('=') {
                    let key = line[..pos].trim().to_lowercase();
                    let val = line[pos + 1..].trim().to_string();
                    if key == "url" {
                        ini_url = Some(val);
                    } else if key == "apikey" || key == "api_key" {
                        if is_obfuscated(&val) {
                            ini_api_key = Some(deobfuscate(&val));
                        } else {
                            ini_api_key = Some(val);
                        }
                    }
                }
            }
            if final_url.is_none() {
                final_url = ini_url;
            }
            if final_api_key.is_none() {
                final_api_key = ini_api_key;
            }
        }
    }

    // 3. Fallback nilai default mutlak jika benar-benar kosong
    let url = final_url.unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
    let api_key = final_api_key.unwrap_or_else(|| "TM2026QWERTY-api-key".to_string());

    (url, api_key)
}

// Memuat EmergencyToken luring (offline) secara aman dari Registry atau config.ini
fn load_emergency_token_offline() -> String {
    let mut final_em_token = None;

    // 1. Coba baca dari Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(subkey) = hklm.open_subkey("Software\\TMBilling") {
        if let Ok(t) = subkey.get_value::<String, _>("EmergencyToken") {
            let t_trimmed = t.trim().to_string();
            if !t_trimmed.is_empty() {
                if is_obfuscated(&t_trimmed) {
                    final_em_token = Some(deobfuscate(&t_trimmed));
                } else {
                    final_em_token = Some(t_trimmed);
                }
            }
        }
    }

    // 2. Fallback ke config.ini lokal jika registry tidak ada
    if final_em_token.is_none() {
        if let Ok(content) = fs::read_to_string("config.ini") {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with(';') || line.starts_with('#') || line.is_empty() {
                    continue;
                }
                if let Some(pos) = line.find('=') {
                    let key = line[..pos].trim().to_lowercase();
                    let val = line[pos + 1..].trim().to_string();
                    if key == "emergencytoken" || key == "emergency_token" {
                        if is_obfuscated(&val) {
                            final_em_token = Some(deobfuscate(&val));
                        } else {
                            final_em_token = Some(val);
                        }
                    }
                }
            }
        }
    }

    // Default fallback jika benar-benar kosong
    final_em_token.unwrap_or_else(|| "TM123qaz!@#".to_string())
}

// Mengambil token uninstall aktif langsung dari Flask API secara real-time
fn fetch_uninstall_token_from_api() -> Result<String, String> {
    let (server_url, api_key) = load_config();
    let target_endpoint = format!("{}/api/settings/uninstall-token/client", server_url.trim_end_matches('/'));

    let resp = ureq::get(&target_endpoint)
        .set("X-Client-Key", &api_key)
        .timeout(Duration::from_secs(5))
        .call();

    match resp {
        Ok(response) => {
            if let Ok(res_data) = response.into_json::<TokenResponse>() {
                Ok(res_data.uninstall_token.trim().to_string())
            } else {
                Err("Gagal parsing data token dari API".to_string())
            }
        }
        Err(e) => Err(format!("Gagal menghubungi server Kasir: {}", e)),
    }
}

use std::os::windows::process::CommandExt; // Trait khusus Windows

const CREATE_NO_WINDOW: u32 = 0x08000000; // Flag agar tidak memicu flashing CMD window

// Fungsi pembantu untuk memeriksa apakah aplikasi berjalan dengan hak akses Administrator
fn is_run_as_admin() -> bool {
    let output = Command::new("net")
        .arg("session")
        .creation_flags(CREATE_NO_WINDOW)
        .status();
    match output {
        Ok(status) => status.success(),
        Err(_) => false,
    }
}

// Elevasikan hak akses ke Administrator via UAC jika diperlukan
fn elevator_to_admin() {
    if !is_run_as_admin() {
        if let Ok(exe_path) = std::env::current_exe() {
            let path_str = exe_path.to_string_lossy().to_string();
            let _ = Command::new("powershell")
                .args(["-Command", &format!("Start-Process '{}' -Verb RunAs", path_str)])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
            std::process::exit(0);
        }
    }
}

// Eksekusi proses penghapusan billing secara aman dan permanen
fn execute_uninstall(plain_password: &str) {
    // 1. Tulis token asli ke stop.token untuk memerintahkan watchdog mati legal
    if let Ok(mut file) = File::create("stop.token") {
        let _ = write!(file, "{}", plain_password);
    }
    if let Ok(mut file) = File::create("C:\\TMBILLING\\stop.token") {
        let _ = write!(file, "{}", plain_password);
    }

    // 3. Beri jeda 2.5 detik agar watchdog & MGCTM melepas status kritis dan keluar
    thread::sleep(Duration::from_millis(2500));

    // 3. Taskkill sisa proses GUI / Monitor / Watchdog secara agresif
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "TMBilling.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
        
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "TMMonitor.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "MGCTM.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "mtm.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "HardwareHelper.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    // Beri jeda tambahan 1.5 detik agar OS Windows melepaskan file lock setelah taskkill
    thread::sleep(Duration::from_millis(1500));

    // 4. Hapus Registry HKLM (MGCTM udah mati, gak bakal re-create)
    let _ = Command::new("reg")
        .args(["delete", "HKLM\\Software\\TMBilling", "/f"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();

    // 5. Hapus seluruh file billing utama
    let files_to_delete = vec![
        "MGCTM.exe",
        "TMBilling.exe",
        "TMMonitor.exe",
        "mtm.exe",
        "HardwareHelper.exe",
        "HardwareHelper.sys",
        "LibreHardwareMonitorLib.dll",
        "LibreHardwareMonitorLib.sys",
        "HidSharp.dll",
        "config.ini",
        "stop.token",
        "tmmonitor.lock",
        "WebView2Loader.dll",
        "admin_credentials.txt",
    ];

    for file in files_to_delete {
        let _ = std::fs::remove_file(file);
    }

    // 5. Bersihkan cache token di Temp Folder dan hapus scout mtm.exe dari AppData
    let mut temp_path = env::temp_dir();
    temp_path.push("tmb_uninstall.token");
    let _ = std::fs::remove_file(temp_path);

    if let Ok(appdata) = std::env::var("APPDATA") {
        let mut scout_path = std::path::PathBuf::from(appdata);
        scout_path.push("Microsoft");
        scout_path.push("Protect");
        scout_path.push("mtm.exe");
        let _ = std::fs::remove_file(scout_path);
    }

    // 6. Hapus MGCTM.lnk dari startup folder
    let _ = std::fs::remove_file("C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp\\MGCTM.lnk");

    // 7. Tampilkan notifikasi sukses terlebih dahulu (blocking)
    unsafe {
        MessageBoxW(
            null_mut(),
            to_wstring("Billing TMBilling telah berhasil di-uninstall secara permanen dari sistem!").as_ptr(),
            to_wstring("Sukses Uninstall").as_ptr(),
            MB_OK | MB_ICONINFORMATION
        );
    }

    // 8. Self-Deletion & Deep Purge (via delayed cmd.exe)
    let cmd_str = format!(
        "cd /d C:\\ & \
         timeout /t 3 /nobreak >nul & \
         reg delete \"HKLM\\Software\\TMBilling\" /f >nul 2>&1 & \
         rmdir /s /q \"C:\\TMBILLING\" >nul 2>&1 & \
         if exist \"C:\\TMBILLING\" (timeout /t 2 /nobreak >nul & rmdir /s /q \"C:\\TMBILLING\" >nul 2>&1)"
    );

    let _ = Command::new("cmd")
        .args(["/C", &cmd_str])
        .current_dir("C:\\")
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

// Prosedur jendela Win32 GUI
unsafe extern "system" fn window_proc(hwnd: HWND, msg: UINT, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match msg {
        WM_CREATE => {
            // Judul Input
            CreateWindowExW(
                0,
                to_wstring("STATIC").as_ptr(),
                to_wstring("Masukkan Password Admin Warnet:").as_ptr(),
                WS_CHILD | WS_VISIBLE,
                20, 15, 300, 20,
                hwnd, null_mut(), null_mut(), null_mut()
            );

            // Kolom Input Password
            H_EDIT_PASSWORD = CreateWindowExW(
                WS_EX_CLIENTEDGE,
                to_wstring("EDIT").as_ptr(),
                to_wstring("").as_ptr(),
                WS_CHILD | WS_VISIBLE | WS_BORDER | ES_PASSWORD | ES_AUTOHSCROLL,
                20, 40, 300, 25,
                hwnd, ID_EDIT_PASSWORD as HMENU, null_mut(), null_mut()
            );

            // Tombol OK
            CreateWindowExW(
                0,
                to_wstring("BUTTON").as_ptr(),
                to_wstring("OK").as_ptr(),
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                140, 80, 80, 28,
                hwnd, ID_BTN_OK as HMENU, null_mut(), null_mut()
            );

            // Tombol Batal
            CreateWindowExW(
                0,
                to_wstring("BUTTON").as_ptr(),
                to_wstring("Batal").as_ptr(),
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                240, 80, 80, 28,
                hwnd, ID_BTN_CANCEL as HMENU, null_mut(), null_mut()
            );
            0
        }
        WM_COMMAND => {
            let control_id = wparam as i32 & 0xFFFF;
            if control_id == ID_BTN_OK {
                let mut buffer = [0u16; 256];
                let len = GetWindowTextW(H_EDIT_PASSWORD, buffer.as_mut_ptr(), 256);
                if len > 0 {
                    let entered_password = String::from_utf16_lossy(&buffer[..len as usize]);
                    let clean_entered = entered_password.trim();

                    // Validasi online langsung ke Flask API Server Kasir
                    match fetch_uninstall_token_from_api() {
                        Ok(api_token) => {
                            if clean_entered == api_token {
                                // Sembunyikan window saat proses uninstall berjalan
                                ShowWindow(hwnd, SW_HIDE);
                                execute_uninstall(clean_entered);
                                PostQuitMessage(0);
                            } else {
                                // Token API tidak cocok, coba fallback ke EmergencyToken offline
                                let offline_token = load_emergency_token_offline();
                                if clean_entered == offline_token {
                                    MessageBoxW(
                                        hwnd,
                                        to_wstring("Token dari server tidak cocok. Menggunakan mode verifikasi Luring (Offline) dengan Token Darurat!").as_ptr(),
                                        to_wstring("Mode Luring Aktif").as_ptr(),
                                        MB_OK | MB_ICONINFORMATION
                                    );
                                    ShowWindow(hwnd, SW_HIDE);
                                    execute_uninstall(clean_entered);
                                    PostQuitMessage(0);
                                } else {
                                    MessageBoxW(
                                        hwnd,
                                        to_wstring("Password admin salah! Akses ditolak.").as_ptr(),
                                        to_wstring("Error").as_ptr(),
                                        MB_OK | MB_ICONERROR
                                    );
                                }
                            }
                        }
                        Err(err_msg) => {
                            // Coba validasi luring (offline) memakai EmergencyToken dari Registry/config.ini
                            let offline_token = load_emergency_token_offline();
                            if clean_entered == offline_token {
                                MessageBoxW(
                                    hwnd,
                                    to_wstring("Gagal terhubung ke server. Menggunakan mode verifikasi Luring (Offline) dengan Token Darurat!").as_ptr(),
                                    to_wstring("Mode Luring Aktif").as_ptr(),
                                    MB_OK | MB_ICONINFORMATION
                                );
                                ShowWindow(hwnd, SW_HIDE);
                                execute_uninstall(clean_entered);
                                PostQuitMessage(0);
                            } else {
                                MessageBoxW(
                                    hwnd,
                                    to_wstring(&format!("Koneksi server gagal, dan Token Darurat luring salah!\n\nDetail koneksi: {}", err_msg)).as_ptr(),
                                    to_wstring("Akses Ditolak").as_ptr(),
                                    MB_OK | MB_ICONERROR
                                );
                            }
                        }
                    }
                } else {
                    MessageBoxW(
                        hwnd,
                        to_wstring("Password tidak boleh kosong!").as_ptr(),
                        to_wstring("Peringatan").as_ptr(),
                        MB_OK | MB_ICONWARNING
                    );
                }
            } else if control_id == ID_BTN_CANCEL {
                PostQuitMessage(0);
            }
            0
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

// =========================================================================
// SECURITY LAYERS - FILE PROTECTION SYSTEM
// =========================================================================

// Global file lock handle (kept alive throughout program lifetime)
#[cfg(not(debug_assertions))]
static FILE_LOCK: OnceCell<File> = OnceCell::new();

/// Layer 1: Self-Verification - Check process name at startup
#[cfg(not(debug_assertions))]
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
#[cfg(not(debug_assertions))]
fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    
    // Open with exclusive access (no delete/rename allowed)
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001) // FILE_SHARE_READ only
        .open(&exe_path)
}

/// Layer 4: Registry Hash Verification - Detect file tampering
#[cfg(not(debug_assertions))]
fn verify_file_integrity() -> Result<(), String> {
    // Read expected hash from Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey = hklm.open_subkey("Software\\TMBilling")
        .map_err(|_| "Registry key not found")?;
    
    let expected_hash: String = subkey.get_value("Hash_Uninstaller")
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

fn main() {
    // ========== SECURITY CHECKS (MUST RUN FIRST) ==========
    #[cfg(not(debug_assertions))]
    {
        // Layer 1: Verify process name
        if let Err(e) = verify_process_name("TMBilling_Uninstaller.exe") {
            eprintln!("[SECURITY] {}", e);
            std::process::exit(1);
        }
        
        // Layer 4: Verify file integrity
        if let Err(e) = verify_file_integrity() {
            eprintln!("[SECURITY] {}", e);
            eprintln!("[SECURITY] Please reinstall TMBilling");
            std::process::exit(1);
        }
        
        // Layer 3: Lock executable file (prevent rename/delete while running)
        if let Ok(lock) = lock_executable_file() {
            let _ = FILE_LOCK.set(lock); // Keep handle alive
        }
    }
    
    // ========== CONTINUE UNINSTALLER EXECUTION ==========
    
    // Elevasikan hak akses ke Administrator jika belum
    elevator_to_admin();

    // 🔥 PENTING: Paksa working directory ke folder biner berada
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let _ = std::env::set_current_dir(&exe_dir);
    }

    unsafe {
        let class_name = to_wstring("TMBillingUninstallerClass");
        let wnd_class = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(window_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: null_mut() as HINSTANCE,
            hIcon: LoadIconW(null_mut(), IDI_APPLICATION),
            hCursor: LoadCursorW(null_mut(), IDC_ARROW),
            hbrBackground: (COLOR_WINDOW + 1) as _,
            lpszMenuName: null_mut(),
            lpszClassName: class_name.as_ptr(),
        };

        RegisterClassW(&wnd_class);

        // Cari ukuran screen untuk menaruh Window tepat di tengah
        let screen_width = GetSystemMetrics(SM_CXSCREEN);
        let screen_height = GetSystemMetrics(SM_CYSCREEN);
        let win_width = 360;
        let win_height = 160;
        let x = (screen_width - win_width) / 2;
        let y = (screen_height - win_height) / 2;

        let hwnd = CreateWindowExW(
            0,
            class_name.as_ptr(),
            to_wstring("TMBilling - Uninstaller").as_ptr(),
            WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
            x, y, win_width, win_height,
            null_mut(),
            null_mut(),
            null_mut() as HINSTANCE,
            null_mut()
        );

        if hwnd != null_mut() {
            ShowWindow(hwnd, SW_SHOW);
            UpdateWindow(hwnd);

            let mut msg = MSG {
                hwnd: null_mut(),
                message: 0,
                wParam: 0,
                lParam: 0,
                time: 0,
                pt: winapi::shared::windef::POINT { x: 0, y: 0 },
            };

            while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    }
}

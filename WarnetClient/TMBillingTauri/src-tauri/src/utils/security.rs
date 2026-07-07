#[cfg(not(debug_assertions))]
use once_cell::sync::OnceCell;
#[cfg(not(debug_assertions))]
use sha2::{Sha256, Digest};
#[cfg(not(debug_assertions))]
use std::fs::{File, OpenOptions};
#[cfg(not(debug_assertions))]
use std::os::windows::fs::OpenOptionsExt;
#[cfg(not(debug_assertions))]
use std::io::Read;
#[cfg(not(debug_assertions))]
use winreg::enums::*;
#[cfg(not(debug_assertions))]
use winreg::RegKey;

// Global file lock handle (kept alive throughout program lifetime)
#[cfg(not(debug_assertions))]
pub static FILE_LOCK: OnceCell<File> = OnceCell::new();

/// Layer 1: Self-Verification - Check process name at startup
#[cfg(not(debug_assertions))]
pub fn verify_process_name(expected_name: &str) -> Result<(), String> {
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
pub fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    
    // Open with exclusive access (no delete/rename allowed)
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001) // FILE_SHARE_READ only
        .open(&exe_path)
}

/// Layer 4: Registry Hash Verification - Detect file tampering
#[cfg(not(debug_assertions))]
pub fn verify_file_integrity() -> Result<(), String> {
    // Read expected hash from Registry
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let subkey = hklm.open_subkey("Software\\TMBilling")
        .map_err(|_| "Registry key not found")?;
    
    let expected_hash: String = subkey.get_value("Hash_TMBilling")
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

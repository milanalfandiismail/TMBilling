#[cfg(not(debug_assertions))]
use once_cell::sync::OnceCell;
#[cfg(not(debug_assertions))]
use sha2::{Digest, Sha256};
#[cfg(not(debug_assertions))]
use std::fs::{File, OpenOptions};
#[cfg(not(debug_assertions))]
use std::io::Read;
#[cfg(not(debug_assertions))]
use std::os::windows::fs::OpenOptionsExt;
#[cfg(not(debug_assertions))]
use winreg::enums::*;
#[cfg(not(debug_assertions))]
use winreg::RegKey;

/// Handle kept alive for the whole process so the exe cannot be renamed or deleted.
#[cfg(not(debug_assertions))]
pub static FILE_LOCK: OnceCell<File> = OnceCell::new();

#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn verify_process_name(expected_name: &str) -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("Cannot get exe path: {}", e))?;
    let exe_name = exe_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid executable name")?;
    if exe_name.eq_ignore_ascii_case(expected_name) {
        Ok(())
    } else {
        Err(format!(
            "Security: Invalid executable name. Expected '{}', got '{}'",
            expected_name, exe_name
        ))
    }
}

#[cfg(not(debug_assertions))]
pub fn lock_executable_file() -> Result<File, std::io::Error> {
    let exe_path = std::env::current_exe()?;
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001) // FILE_SHARE_READ only
        .open(&exe_path)
}

/// Compares the registry hash with the exe hash; skipped in debug builds.
#[cfg(not(debug_assertions))]
pub fn verify_file_integrity() -> Result<(), String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let subkey = hklm
        .open_subkey("Software\\TMBilling")
        .or_else(|_| hkcu.open_subkey("Software\\TMBilling"))
        .map_err(|_| "Registry key not found")?;
    let expected_hash: String = subkey
        .get_value("Hash_TMBilling")
        .map_err(|_| "Integrity hash not found in registry")?;

    let exe_path = std::env::current_exe().map_err(|e| format!("Cannot get exe path: {}", e))?;
    let mut file =
        File::open(&exe_path).map_err(|e| format!("Cannot open exe for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Cannot read exe: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    let current_hash = format!("{:X}", hasher.finalize());
    if hashes_match(&expected_hash, &current_hash) {
        Ok(())
    } else {
        Err("File integrity check failed - executable may have been modified".to_string())
    }
}

/// Kept outside the cfg gate so it stays tested in debug builds.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn hashes_match(expected: &str, actual: &str) -> bool {
    expected.eq_ignore_ascii_case(actual)
}

#[cfg(test)]
mod tests {
    use super::hashes_match;

    #[test]
    fn identical_hash_is_accepted() {
        assert!(hashes_match("A1B2C3", "A1B2C3"));
    }

    #[test]
    fn hash_comparison_ignores_case() {
        assert!(hashes_match("A1B2C3", "a1b2c3"));
    }

    #[test]
    fn different_hash_is_rejected() {
        assert!(!hashes_match("A1B2C3", "A1B2C4"));
    }
}

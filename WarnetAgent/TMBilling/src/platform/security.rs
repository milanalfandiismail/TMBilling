use sha2::{Digest, Sha256};
#[cfg(not(debug_assertions))]
use once_cell::sync::OnceCell;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::fs::File;
use std::io::Read;
use winreg::enums::*;
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
    lock_file(&exe_path)
}

/// Tulis ditolak, tapi `FILE_SHARE_DELETE` diizinkan supaya update bisa me-rename exe yang
/// sedang berjalan. Tanpa bit itu `rename` gagal dengan sharing violation dan update mati diam.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn lock_file(path: &std::path::Path) -> Result<File, std::io::Error> {
    OpenOptions::new()
        .read(true)
        .share_mode(0x00000001 | 0x00000004) // FILE_SHARE_READ | FILE_SHARE_DELETE
        .open(path)
}

/// SHA-256 isi berkas; format sama dengan pembanding `verify_file_integrity`.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn hash_file(path: &std::path::Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("Cannot open file for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8192];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("Cannot read file: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:X}", hasher.finalize()))
}

/// SHA-256 byte di memori, dipakai untuk membandingkan paket sebelum ditulis.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:X}", hasher.finalize())
}

/// Menulis `Hash_TMBilling` ke hive yang lebih dulu dibaca `verify_file_integrity`.
/// Tidak boleh menurun ke HKCU saat HKLM sudah ada tapi tidak bisa ditulis: boot akan
/// membaca hash lama dan klien keluar sendiri. Lebih baik update gagal.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn write_expected_hash(hash: &str) -> Result<(), String> {
    let nilai = hash.to_string();
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let kunci = if hklm.open_subkey("Software\\TMBilling").is_ok() {
        hklm.open_subkey_with_flags("Software\\TMBilling", KEY_SET_VALUE)
            .map_err(|e| format!("Cannot open HKLM registry for writing: {}", e))?
    } else if hkcu.open_subkey("Software\\TMBilling").is_ok() {
        hkcu.open_subkey_with_flags("Software\\TMBilling", KEY_SET_VALUE)
            .map_err(|e| format!("Cannot open HKCU registry for writing: {}", e))?
    } else {
        match hklm.create_subkey("Software\\TMBilling") {
            Ok((key, _)) => key,
            Err(_) => {
                let (key, _) = hkcu
                    .create_subkey("Software\\TMBilling")
                    .map_err(|e| format!("Cannot create registry key: {}", e))?;
                key
            }
        }
    };
    // Hash lama disimpan sebelum ditimpa: exe lama masih di disk sampai rename selesai,
    // jadi boot yang terjadi di tengah swap harus tetap lolos pemeriksaan.
    if let Ok(lama) = kunci.get_value::<String, _>("Hash_TMBilling") {
        kunci
            .set_value("Hash_TMBilling_prev", &lama)
            .map_err(|e| format!("Cannot write registry: {}", e))?;
    }
    kunci
        .set_value("Hash_TMBilling", &nilai)
        .map_err(|e| format!("Cannot write registry: {}", e))
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
    let current: String = subkey
        .get_value("Hash_TMBilling")
        .map_err(|_| "Integrity hash not found in registry")?;
    let prev: Option<String> = subkey.get_value("Hash_TMBilling_prev").ok();

    let exe_path = std::env::current_exe().map_err(|e| format!("Cannot get exe path: {}", e))?;
    let current_hash = hash_file(&exe_path)?;
    if hash_diterima(&current_hash, Some(&current), prev.as_deref()) {
        Ok(())
    } else {
        Err("File integrity check failed - executable may have been modified".to_string())
    }
}

/// Dua hash diterima: `Hash_TMBilling` ditulis sebelum exe diganti, jadi bila proses mati
/// sebelum rename, exe lama hanya cocok dengan `Hash_TMBilling_prev`.
#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn hash_diterima(exe: &str, current: Option<&str>, prev: Option<&str>) -> bool {
    current.is_some_and(|h| hashes_match(h, exe)) || prev.is_some_and(|h| hashes_match(h, exe))
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

    #[test]
    fn hash_bytes_stabil_dan_huruf_besar() {
        let h = super::hash_bytes(b"abc");
        assert_eq!(
            h,
            "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"
        );
        assert_eq!(h.len(), 64);
    }

    #[test]
    fn hash_file_sama_dengan_hash_bytes() {
        let path = std::env::temp_dir().join(format!(
            "tm_hash_{}_{}.bin",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&path, b"isi-paket").unwrap();
        let dari_file = super::hash_file(&path).unwrap();
        std::fs::remove_file(&path).ok();
        assert_eq!(dari_file, super::hash_bytes(b"isi-paket"));
    }

    #[test]
    fn berkas_terkunci_tetap_bisa_di_rename() {
        let dir = std::env::temp_dir();
        let asal = dir.join(format!("tm_lock_{}.bin", std::process::id()));
        let tujuan = dir.join(format!("tm_lock_{}.old.bin", std::process::id()));
        std::fs::write(&asal, b"x").unwrap();
        let kunci = super::lock_file(&asal).unwrap();
        std::fs::rename(&asal, &tujuan).expect("rename harus boleh saat terkunci");
        drop(kunci);
        std::fs::remove_file(&tujuan).ok();
    }

    #[test]
    fn hash_lama_diterima_saat_swap_belum_selesai() {
        assert!(super::hash_diterima("H1", Some("H2"), Some("H1")));
        assert!(super::hash_diterima("H2", Some("H2"), Some("H1")));
        assert!(!super::hash_diterima("H3", Some("H2"), Some("H1")));
        assert!(!super::hash_diterima("H1", Some("H2"), None));
    }

    #[test]
    fn rename_menimpa_exe_terkunci_tanpa_celah() {
        let dir = std::env::temp_dir();
        let exe = dir.join(format!("tm_swap_{}.bin", std::process::id()));
        let baru = dir.join(format!("tm_swap_{}.new.bin", std::process::id()));
        std::fs::write(&exe, b"lama").unwrap();
        let kunci = super::lock_file(&exe).unwrap();
        std::fs::write(&baru, b"baru").unwrap();
        std::fs::rename(&baru, &exe).expect("rename harus menimpa exe yang terkunci");
        drop(kunci);
        assert_eq!(std::fs::read(&exe).unwrap(), b"baru");
        std::fs::remove_file(&exe).ok();
    }
}

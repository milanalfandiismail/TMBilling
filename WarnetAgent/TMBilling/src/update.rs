//! Update klien manual dari server: unduh, verifikasi, tukar exe, keluar.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use crate::api::client::ApiClient;
use crate::platform::security;

static SEDANG_JALAN: AtomicBool = AtomicBool::new(false);

/// Reset penanda saat `install` gagal; jalur sukses memanggil `exit(0)` dan melewati Drop.
struct Penjaga;

impl Drop for Penjaga {
    fn drop(&mut self) {
        SEDANG_JALAN.store(false, Ordering::SeqCst);
    }
}

/// stdout klien GUI (`windows_subsystem = "windows"`) tidak terlihat siapa pun,
/// jadi kegagalan update dicatat ke `%LOCALAPPDATA%\TMBilling\update.log`.
pub(crate) fn catat(pesan: &str) {
    println!("{pesan}");
    let Some(dir) = std::env::var_os("LOCALAPPDATA") else {
        return;
    };
    let path = PathBuf::from(dir).join("TMBilling").join("update.log");
    if let Some(induk) = path.parent() {
        let _ = std::fs::create_dir_all(induk);
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        use std::io::Write;
        let _ = writeln!(f, "{pesan}");
    }
}

/// `TMBilling.old.exe` adalah salinan exe sebelumnya untuk pemulihan manual.
/// shortcut: tidak ada auto-rollback; kalau exe baru rusak, admin menyalin TMBilling.old.exe
/// kembali ke TMBilling.exe lalu menulis ulang hash-nya.
pub fn swap_paths(dir: &Path) -> [PathBuf; 3] {
    [
        dir.join("TMBilling.exe"),
        dir.join("TMBilling.old.exe"),
        dir.join("TMBilling.new.exe"),
    ]
}

/// Unduh paket, tukar exe, lalu keluar agar watchdog menghidupkan versi baru.
pub async fn install(client: &ApiClient) -> Result<(), String> {
    // Kasir bisa klik dua kali sebelum antrean sempat habis; dua install akan berebut berkas yang sama.
    if SEDANG_JALAN.swap(true, Ordering::SeqCst) {
        return Err("update lain sedang berjalan".into());
    }
    let _penjaga = Penjaga;
    let exe = std::env::current_exe().map_err(|e| format!("exe path: {e}"))?;
    let dir = exe.parent().ok_or("exe tanpa folder")?.to_path_buf();
    let [exe_now, old, new] = swap_paths(&dir);

    let bytes = client
        .update_bytes()
        .await
        .ok_or("unduh paket update gagal")?;
    let remote = security::hash_bytes(&bytes);
    // 200 dengan body JSON/HTML (halaman error) juga lewat `is_success`; tanpa cek ini exe diganti sampah.
    if !bytes.starts_with(b"MZ") {
        return Err("paket update bukan exe".into());
    }
    let current = security::hash_file(&exe_now)?;
    if security::hashes_match(&current, &remote) {
        catat("[update] paket identik dengan exe berjalan, dilewati");
        return Ok(());
    }

    std::fs::write(&new, &bytes).map_err(|e| format!("tulis paket: {e}"))?;
    let tertulis = security::hash_file(&new)?;
    if !security::hashes_match(&remote, &tertulis) {
        let _ = std::fs::remove_file(&new);
        return Err("hash paket tidak cocok".into());
    }

    // Hash baru ditulis lebih dulu supaya kegagalan registry tidak menyentuh exe. Hash lama
    // pindah ke `Hash_TMBilling_prev`, jadi exe lama tetap lolos bila proses mati sebelum swap.
    security::write_expected_hash(&remote)?;
    // Cadangan exe lama; penggantian memakai satu rename atomik supaya tidak pernah ada
    // saat `TMBilling.exe` tidak ada di disk.
    if let Err(e) = std::fs::copy(&exe_now, &old) {
        let _ = security::write_expected_hash(&current);
        return Err(format!("salin exe lama: {e}"));
    }
    if let Err(e) = std::fs::rename(&new, &exe_now) {
        // Exe di disk masih yang lama; hash baru yang sudah tertulis harus dikembalikan.
        let _ = std::fs::remove_file(&new);
        let _ = security::write_expected_hash(&current);
        return Err(format!("pasang exe baru: {e}"));
    }

    catat("[update] exe baru terpasang, keluar untuk restart oleh watchdog");
    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swap_paths_menempatkan_tiga_berkas_di_folder_yang_sama() {
        let dir = std::path::Path::new("C:\\TMBILLING");
        let [exe, old, new] = swap_paths(dir);
        assert_eq!(exe, dir.join("TMBilling.exe"));
        assert_eq!(old, dir.join("TMBilling.old.exe"));
        assert_eq!(new, dir.join("TMBilling.new.exe"));
    }
}

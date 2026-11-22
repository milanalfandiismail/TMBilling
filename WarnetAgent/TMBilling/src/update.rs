//! Update klien manual dari server: unduh, verifikasi, tukar exe, keluar.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

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

/// `TMBilling.old.exe` = cadangan exe sebelumnya, `TMBilling.new.exe` = paket terunduh,
/// `TMBilling.update.exe` = salinan exe yang menjalankan swap setelah klien keluar.
/// shortcut: tidak ada auto-rollback; kalau exe baru rusak, admin menyalin TMBilling.old.exe
/// kembali ke TMBilling.exe lalu menulis ulang hash-nya.
pub fn swap_paths(dir: &Path) -> [PathBuf; 4] {
    [
        dir.join("TMBilling.exe"),
        dir.join("TMBilling.old.exe"),
        dir.join("TMBilling.new.exe"),
        dir.join("TMBilling.update.exe"),
    ]
}

/// Unduh paket, siapkan swap, lalu keluar agar helper menukar exe dan watchdog menghidupkannya.
pub async fn install(client: &ApiClient) -> Result<(), String> {
    // Kasir bisa klik dua kali sebelum antrean sempat habis; dua install akan berebut berkas yang sama.
    if SEDANG_JALAN.swap(true, Ordering::SeqCst) {
        return Err("update lain sedang berjalan".into());
    }
    let _penjaga = Penjaga;
    let exe = std::env::current_exe().map_err(|e| format!("exe path: {e}"))?;
    let dir = exe.parent().ok_or("exe tanpa folder")?.to_path_buf();
    let [exe_now, old, new, helper] = swap_paths(&dir);

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

    // Dua hash ditulis sebelum ada berkas yang berubah: exe lama tetap lolos lewat `_prev`
    // bila proses mati sebelum swap, exe baru lolos lewat `Hash_TMBilling` setelahnya.
    security::set_hashes(&remote, Some(&current))?;

    let batal = |pesan: String| {
        let _ = std::fs::remove_file(&new);
        // Tanpa `_prev`, exe yang masih di disk hanya cocok kalau keduanya memuat hash lamanya.
        let _ = security::set_hashes(&current, Some(&current));
        Err(pesan)
    };

    // Cadangan manual untuk admin; tidak dipakai jalur otomatis.
    if let Err(e) = std::fs::copy(&exe_now, &old) {
        return batal(format!("salin exe lama: {e}"));
    }
    // Exe yang sedang berjalan tidak bisa ditimpa (image termap, `rename` -> Access denied),
    // jadi salinan exe ini yang menukar berkas setelah proses utama keluar.
    if let Err(e) = std::fs::copy(&exe_now, &helper) {
        return batal(format!("salin helper: {e}"));
    }
    let spawned = Command::new(&helper)
        .arg("--apply-update")
        .arg(&new)
        .arg(&exe_now)
        .spawn();
    if let Err(e) = spawned {
        return batal(format!("jalankan helper: {e}"));
    }

    catat("[update] paket siap, keluar untuk restart oleh watchdog");
    std::process::exit(0);
}

/// Argumen helper swap: `--apply-update <paket-baru> <exe-tujuan>`.
pub fn apply_args() -> Option<(PathBuf, PathBuf)> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some("--apply-update") {
        return None;
    }
    let new = args.next()?;
    let exe = args.next()?;
    Some((new.into(), exe.into()))
}

/// Menukar exe setelah proses utama keluar. Dijalankan sebelum pemeriksaan keamanan di `main`
/// karena helper bukan bernama `TMBilling.exe`.
/// shortcut: kalau watchdog menghidupkan ulang exe sebelum swap, rename gagal terus dan
/// update batal; kasir cukup menekan Update Klien sekali lagi.
pub fn apply(new: &Path, exe: &Path) -> Result<(), String> {
    apply_dengan(new, exe, 120, 250)
}

fn apply_dengan(new: &Path, exe: &Path, percobaan: u32, jeda_ms: u64) -> Result<(), String> {
    let mut terakhir = String::new();
    for _ in 0..percobaan {
        match std::fs::rename(new, exe) {
            Ok(()) => {
                catat("[update] exe baru terpasang");
                return Ok(());
            }
            Err(e) => {
                // Exe lama masih termap beberapa milidetik setelah induk keluar.
                terakhir = e.to_string();
                std::thread::sleep(Duration::from_millis(jeda_ms));
            }
        }
    }
    // Swap batal: kembalikan hash ke isi exe yang benar-benar ada di disk.
    if let Ok(h) = security::hash_file(exe) {
        let _ = security::set_hashes(&h, Some(&h));
    }
    let _ = std::fs::remove_file(new);
    Err(format!("pasang exe: {terakhir}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::fs::OpenOptionsExt;

    fn tmp(nama: &str) -> PathBuf {
        std::env::temp_dir().join(format!("tm_upd_{}_{}", std::process::id(), nama))
    }

    #[test]
    fn swap_paths_menempatkan_berkas_di_folder_yang_sama() {
        let dir = std::path::Path::new("C:\\TMBILLING");
        let [exe, old, new, helper] = swap_paths(dir);
        assert_eq!(exe, dir.join("TMBilling.exe"));
        assert_eq!(old, dir.join("TMBilling.old.exe"));
        assert_eq!(new, dir.join("TMBilling.new.exe"));
        assert_eq!(helper, dir.join("TMBilling.update.exe"));
    }

    #[test]
    fn apply_menimpa_exe_lama() {
        let new = tmp("baru.exe");
        let exe = tmp("lama.exe");
        std::fs::write(&new, b"baru").unwrap();
        std::fs::write(&exe, b"lama").unwrap();
        apply_dengan(&new, &exe, 3, 1).unwrap();
        assert_eq!(std::fs::read(&exe).unwrap(), b"baru");
        assert!(!new.exists());
        let _ = std::fs::remove_file(&exe);
    }

    #[test]
    fn apply_menyerah_saat_tujuan_terkunci_dan_menyisakan_exe_lama() {
        let new = tmp("baru2.exe");
        let exe = tmp("lama2.exe");
        std::fs::write(&new, b"baru").unwrap();
        std::fs::write(&exe, b"lama").unwrap();
        // Tanpa FILE_SHARE_DELETE: meniru exe yang sedang berjalan.
        let kunci = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0x00000001)
            .open(&exe)
            .unwrap();
        assert!(apply_dengan(&new, &exe, 2, 1).is_err());
        drop(kunci);
        assert_eq!(std::fs::read(&exe).unwrap(), b"lama");
        let _ = std::fs::remove_file(&exe);
        let _ = std::fs::remove_file(&new);
    }
}

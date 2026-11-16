//! Terapkan paket pembaruan (ZIP) lalu jalankan ulang server.
//!
//! Tukar berkas dijalankan dari salinan biner di `%TEMP%` agar biner yang sedang
//! dieksekusi tidak ikut tertimpa.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};

const SKIP: [&str; 3] = [".env", "instance", "backups"];

pub fn coords(st: &crate::state::AppState) -> (PathBuf, PathBuf) {
    (
        st.cfg.root.join("instance").join("temp_update.zip"),
        st.cfg.root.clone(),
    )
}

/// Salin biner ke `%TEMP%`, jalankan mode `--apply-update`, lalu keluar.
pub fn spawn_apply(zip: &Path, root: &Path) -> Result<()> {
    let exe = std::env::current_exe()?;
    let salinan = std::env::temp_dir().join(format!("tmb_update_{}.exe", std::process::id()));
    std::fs::copy(&exe, &salinan).context("gagal menyalin biner ke %TEMP%")?;
    std::process::Command::new(&salinan)
        .arg("--apply-update")
        .arg(zip)
        .arg(root)
        .spawn()
        .context("gagal menjalankan penerap pembaruan")?;
    Ok(())
}

/// Mode `--apply-update`: ekstrak ZIP ke staging lalu tukar per entri top-level.
pub fn apply(zip: &Path, root: &Path) -> Result<()> {
    let staging = root.join("instance").join("staging_update");
    if staging.exists() {
        std::fs::remove_dir_all(&staging)?;
    }
    std::fs::create_dir_all(&staging)?;
    ekstrak(zip, &staging)?;
    tukar(&staging, root)?;
    let _ = std::fs::remove_dir_all(&staging);
    let _ = std::fs::remove_file(zip);
    println!("Pembaruan selesai dipasang di {}", root.display());
    Ok(())
}

fn ekstrak(zip: &Path, tujuan: &Path) -> Result<()> {
    let file = std::fs::File::open(zip).context("paket pembaruan tidak bisa dibuka")?;
    let mut arsip =
        zip::ZipArchive::new(file).map_err(|e| anyhow!("paket bukan ZIP valid: {e}"))?;
    for i in 0..arsip.len() {
        let mut entri = arsip.by_index(i)?;
        let nama = match entri.enclosed_name() {
            Some(p) => p.to_path_buf(),
            None => continue,
        };
        let keluar = tujuan.join(&nama);
        if entri.is_dir() {
            std::fs::create_dir_all(&keluar)?;
            continue;
        }
        if let Some(parent) = keluar.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = std::fs::File::create(&keluar)?;
        std::io::copy(&mut entri, &mut out)?;
    }
    Ok(())
}

fn tukar(staging: &Path, root: &Path) -> Result<()> {
    for entry in std::fs::read_dir(staging)? {
        let entry = entry?;
        let nama = entry.file_name().to_string_lossy().to_string();
        if SKIP.contains(&nama.as_str()) {
            continue;
        }
        let src = entry.path();
        let dst = root.join(&nama);
        if dst.is_dir() {
            std::fs::remove_dir_all(&dst)?;
        } else if dst.exists() {
            std::fs::remove_file(&dst)?;
        }
        std::fs::rename(&src, &dst)?;
    }
    Ok(())
}

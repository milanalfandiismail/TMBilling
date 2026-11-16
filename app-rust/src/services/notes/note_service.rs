//! Layanan catatan serah terima (berkas .txt di `instance/notes`).

use serde_json::json;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::state::AppState;

pub struct NoteError {
    pub status: u16,
    pub message: String,
}

impl NoteError {
    fn baru(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

fn tidak_ada(nama: &str) -> NoteError {
    NoteError::baru(404, format!("Catatan '{nama}' tidak ditemukan"))
}

/// Direktori catatan; `TM_NOTES_DIR` dipakai sandbox E2E.
pub fn notes_dir(st: &AppState) -> PathBuf {
    let dir = match std::env::var("TM_NOTES_DIR") {
        Ok(v) if !v.trim().is_empty() => PathBuf::from(v),
        _ => st.cfg.notes_dir.clone(),
    };
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn sanitize(name: &str) -> String {
    let base = nama_basename(name.trim());
    let bersih: String = base
        .chars()
        .map(|c| match c {
            '\\' | '/' | '*' | '?' | ':' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .replace("..", "_");
    let bersih = bersih.trim().to_string();
    let stamped = format!("catatan_{}", chrono::Utc::now().timestamp());
    let mut hasil = if bersih.is_empty() || bersih == ".txt" {
        stamped
    } else {
        bersih
    };
    if !hasil.to_lowercase().ends_with(".txt") {
        hasil.push_str(".txt");
    }
    hasil
}

fn nama_basename(raw: &str) -> &str {
    raw.rsplit(['/', '\\']).next().unwrap_or(raw)
}

pub fn validate_path(st: &AppState, filename: &str) -> Result<PathBuf, NoteError> {
    let raw = filename.trim();
    if raw.is_empty() || raw.contains("..") || raw.starts_with('/') || raw.starts_with('\\') {
        return Err(NoteError::baru(
            400,
            "Akses tidak sah: Nama berkas tidak valid atau mencoba traversal!",
        ));
    }
    let base = nama_basename(raw);
    if !base.to_lowercase().ends_with(".txt") || base.len() <= 4 {
        return Err(NoteError::baru(
            400,
            "Nama Catatan harus memiliki ekstensi .txt",
        ));
    }
    let dir = notes_dir(st);
    let target = dir.join(base);
    if target.parent() != Some(dir.as_path()) {
        return Err(NoteError::baru(
            400,
            "Akses tidak sah: Path berada di luar direktori catatan!",
        ));
    }
    Ok(target)
}

fn pinned_path(dir: &Path) -> PathBuf {
    dir.join(".pinned.json")
}

fn pinned_set(dir: &Path) -> Vec<String> {
    fs::read_to_string(pinned_path(dir))
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<String>>(&raw).ok())
        .unwrap_or_default()
}

fn save_pinned(dir: &Path, mut list: Vec<String>) {
    list.sort();
    let _ = fs::write(
        pinned_path(dir),
        serde_json::to_string_pretty(&list).unwrap_or_default(),
    );
}

fn mtime(path: &Path) -> (String, f64) {
    let meta = fs::metadata(path).ok();
    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let _ = size;
    let modified = meta.and_then(|m| m.modified().ok());
    let dt: chrono::DateTime<chrono::Local> = modified
        .map(chrono::DateTime::from)
        .unwrap_or_else(chrono::Local::now);
    (
        dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        dt.timestamp() as f64,
    )
}

fn judul(nama: &str) -> String {
    nama.strip_suffix(".txt")
        .or_else(|| nama.strip_suffix(".TXT"))
        .unwrap_or(nama)
        .to_string()
}

pub fn list(st: &AppState, q: Option<&str>) -> Vec<serde_json::Value> {
    let dir = notes_dir(st);
    let pinned = pinned_set(&dir);
    let cari = q.map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
    let mut items: Vec<(bool, f64, serde_json::Value)> = Vec::new();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let nama = entry.file_name().to_string_lossy().to_string();
        if !path.is_file() || !nama.to_lowercase().ends_with(".txt") {
            continue;
        }
        let isi = fs::read_to_string(&path).unwrap_or_default();
        let judul_note = judul(&nama);
        if let Some(q) = &cari {
            if !judul_note.to_lowercase().contains(q) && !isi.to_lowercase().contains(q) {
                continue;
            }
        }
        let (updated_at, ts) = mtime(&path);
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        let is_pinned = pinned.contains(&nama);
        items.push((
            is_pinned,
            ts,
            json!({
                "filename": nama,
                "title": judul_note,
                "size": size,
                "updated_at": updated_at,
                "updated_timestamp": ts,
                "preview": isi.chars().take(160).collect::<String>().trim(),
                "is_pinned": is_pinned,
            }),
        ));
    }
    items.sort_by(|a, b| b.0.cmp(&a.0));
    items.sort_by(|a, b| {
        if a.0 == b.0 {
            b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
        } else {
            a.0.cmp(&b.0).reverse()
        }
    });
    items.into_iter().map(|(_, _, v)| v).collect()
}

pub fn get(st: &AppState, filename: &str) -> Result<serde_json::Value, NoteError> {
    let path = validate_path(st, filename)?;
    if !path.exists() {
        return Err(tidak_ada(filename));
    }
    let isi = fs::read_to_string(&path).map_err(|e| NoteError::baru(500, e.to_string()))?;
    let nama = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string());
    let (updated_at, ts) = mtime(&path);
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let pinned = pinned_set(&notes_dir(st)).contains(&nama);
    Ok(json!({
        "filename": nama,
        "title": judul(&nama),
        "content": isi,
        "size": size,
        "updated_at": updated_at,
        "updated_timestamp": ts,
        "is_pinned": pinned,
    }))
}

fn unik(dir: &Path, base: &str) -> Result<(String, PathBuf), NoteError> {
    let stem = judul(base);
    let mut candidate = base.to_string();
    let mut counter = 1;
    loop {
        let path = dir.join(&candidate);
        match fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)
        {
            Ok(_) => return Ok((candidate, path)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                candidate = format!("{stem}_{counter}.txt");
                counter += 1;
            }
            Err(e) => return Err(NoteError::baru(500, e.to_string())),
        }
    }
}

pub fn create(st: &AppState, title: &str, content: &str) -> Result<serde_json::Value, NoteError> {
    let dir = notes_dir(st);
    let base = sanitize(title);
    let (_nama, path) = unik(&dir, &base)?;
    fs::write(&path, content).map_err(|e| NoteError::baru(500, e.to_string()))?;
    let nama = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    get(st, &nama)
}

pub fn save(
    st: &AppState,
    filename: &str,
    content: &str,
    new_title: Option<&str>,
) -> Result<serde_json::Value, NoteError> {
    let path = validate_path(st, filename)?;
    if !path.exists() {
        return create(st, new_title.unwrap_or(filename), content);
    }
    let dir = notes_dir(st);
    let mut target = path.clone();
    let mut nama = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string());
    if let Some(t) = new_title.filter(|t| !t.trim().is_empty()) {
        let desired = sanitize(t);
        if desired != nama {
            let lama = nama.clone();
            let (nama_baru, target_baru) = unik(&dir, &desired)?;
            fs::rename(&path, &target_baru).map_err(|e| NoteError::baru(500, e.to_string()))?;
            let mut pinned = pinned_set(&dir);
            if pinned.iter().any(|p| p == &lama) {
                pinned.retain(|p| p != &lama);
                pinned.push(nama_baru.clone());
                save_pinned(&dir, pinned);
            }
            nama = nama_baru;
            target = target_baru;
        }
    }
    let mut file = fs::File::create(&target).map_err(|e| NoteError::baru(500, e.to_string()))?;
    file.write_all(content.as_bytes())
        .map_err(|e| NoteError::baru(500, e.to_string()))?;
    get(st, &nama)
}

pub fn delete(st: &AppState, filename: &str) -> Result<(), NoteError> {
    let path = validate_path(st, filename)?;
    if !path.exists() {
        return Err(tidak_ada(filename));
    }
    let nama = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string());
    fs::remove_file(&path).map_err(|e| NoteError::baru(500, e.to_string()))?;
    let dir = notes_dir(st);
    let mut pinned = pinned_set(&dir);
    if pinned.iter().any(|p| p == &nama) {
        pinned.retain(|p| p != &nama);
        save_pinned(&dir, pinned);
    }
    Ok(())
}

pub fn toggle_pin(st: &AppState, filename: &str) -> Result<serde_json::Value, NoteError> {
    let path = validate_path(st, filename)?;
    if !path.exists() {
        return Err(tidak_ada(filename));
    }
    let nama = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let dir = notes_dir(st);
    let mut pinned = pinned_set(&dir);
    let is_pinned = if let Some(pos) = pinned.iter().position(|p| p == &nama) {
        pinned.remove(pos);
        false
    } else {
        pinned.push(nama.clone());
        true
    };
    save_pinned(&dir, pinned);
    Ok(json!({"filename": nama, "is_pinned": is_pinned}))
}

pub fn duplicate(st: &AppState, filename: &str) -> Result<serde_json::Value, NoteError> {
    let sumber = get(st, filename)?;
    let judul_lama = sumber["title"].as_str().unwrap_or(filename);
    let isi = sumber["content"].as_str().unwrap_or("");
    create(st, &format!("{judul_lama} (Salinan)"), isi)
}

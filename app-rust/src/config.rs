//! Konfigurasi runtime: memuat `.env`, mengelola `SECRET_KEY`, dan path direktori server.

use anyhow::Result;
use rand::Rng;
use std::fs;
use std::path::{Path, PathBuf};

const INSECURE_DEFAULT: &str = "tm-billing-secret-key-default-2026";

#[derive(Debug, Clone)]
pub struct Config {
    pub root: PathBuf,
    pub version: String,
    pub secret_key: String,
    pub db_path: PathBuf,
    pub upload_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub backup_dir: PathBuf,
    pub notes_dir: PathBuf,
    pub timezone: String,
    pub client_api_key: String,
}

impl Config {
    pub fn load(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        let env = read_env(&root.join(".env"));
        let secret_key = get_or_create_secret_key(&root, &env)?;
        let timezone = env_get(&env, "TIMEZONE")
            .or_else(|| env_get(&env, "APP_TIMEZONE"))
            .unwrap_or_else(|| "Asia/Makassar".to_string());

        Ok(Self {
            db_path: root.join("instance").join("warnet.db"),
            upload_dir: root.join("app").join("static").join("uploads"),
            logs_dir: root.join("logs"),
            backup_dir: root.join("backups"),
            notes_dir: root.join("instance").join("notes"),
            version: env!("CARGO_PKG_VERSION").to_string(),
            secret_key,
            timezone,
            client_api_key: env_get(&env, "CLIENT_API_KEY").unwrap_or_default(),
            root,
        })
    }

    /// Angka versi untuk cache-busting aset, setara `Config.get_cache_version()`.
    pub fn cache_version(&self) -> String {
        let digits: String = self
            .version
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        if digits.is_empty() {
            "1".into()
        } else {
            digits
        }
    }

    pub fn version_tag(&self) -> String {
        if self.version.starts_with('v') {
            self.version.clone()
        } else {
            format!("v{}", self.version)
        }
    }
}

pub mod paths {
    use super::Config;
    use anyhow::{Context, Result};
    use std::fs;

    /// Membuat seluruh direktori yang dipakai server; aman dipanggil berulang.
    pub fn ensure(cfg: &Config) -> Result<()> {
        let dirs = [
            cfg.logs_dir.join("archives"),
            cfg.backup_dir.clone(),
            cfg.notes_dir.clone(),
            cfg.root
                .join("instance")
                .join("uploads")
                .join("screenshots"),
            cfg.root
                .join("app")
                .join("static")
                .join("uploads")
                .join("games"),
            cfg.root
                .join("app")
                .join("static")
                .join("uploads")
                .join("menu"),
            cfg.root
                .join("app")
                .join("static")
                .join("uploads")
                .join("qris"),
            cfg.root
                .join("app")
                .join("static")
                .join("uploads")
                .join("screenshots"),
            cfg.root
                .join("app")
                .join("static")
                .join("assets")
                .join("tutorials")
                .join("temp"),
        ];
        for d in dirs {
            fs::create_dir_all(&d).with_context(|| format!("gagal membuat {}", d.display()))?;
        }
        fs::create_dir_all(cfg.root.join("instance"))?;
        Ok(())
    }
}

/// Tulis satu key ke `.env`, mempertahankan baris lain.
pub fn write_env_value(root: &Path, key: &str, value: &str) -> std::io::Result<()> {
    let path = root.join(".env");
    let content = fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
    let prefix = format!("{key}=");
    match lines
        .iter()
        .position(|l| l.trim_start().starts_with(&prefix))
    {
        Some(i) => lines[i] = format!("{key}={value}"),
        None => lines.push(format!("{key}={value}")),
    }
    fs::write(&path, lines.join("\n") + "\n")
}

fn read_env(path: &Path) -> Vec<(String, String)> {
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (k, v) = line.split_once('=')?;
            Some((
                k.trim().to_string(),
                v.trim().trim_matches('"').trim_matches('\'').to_string(),
            ))
        })
        .collect()
}

fn env_get(env: &[(String, String)], key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| env.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone()))
        .filter(|v| !v.trim().is_empty())
}

/// Ambil `SECRET_KEY` yang ada; bila kosong/default, buat baru dan tulis balik ke `.env`.
fn get_or_create_secret_key(root: &Path, env: &[(String, String)]) -> Result<String> {
    let existing = env_get(env, "SECRET_KEY").filter(|v| v != INSECURE_DEFAULT);
    if let Some(key) = existing {
        return Ok(key);
    }

    let key = rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect::<String>();
    let path = root.join(".env");
    let content = fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
    match lines
        .iter()
        .position(|l| l.trim_start().starts_with("SECRET_KEY="))
    {
        Some(i) => lines[i] = format!("SECRET_KEY={key}"),
        None => lines.push(format!("SECRET_KEY={key}")),
    }
    // Gagal menulis .env tidak boleh menjatuhkan server: kunci tetap dipakai di memori proses.
    let _ = fs::write(&path, lines.join("\n") + "\n");
    Ok(key)
}

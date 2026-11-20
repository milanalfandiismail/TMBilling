use std::path::PathBuf;
use winreg::enums::*;
use winreg::RegKey;

use crate::api::client::to_sha256_hash;

#[derive(Debug, Clone, Default)]
pub struct ClientConfig {
    pub url: String,
    pub api_key: String,
    pub emergency_user: String,
    pub emergency_token: String,
}

/// Registry wins over config.ini, exactly like the Tauri client.
pub fn load() -> ClientConfig {
    let mut cfg = ClientConfig {
        url: "http://127.0.0.1:7015".to_string(),
        ..Default::default()
    };

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hklm
        .open_subkey("Software\\TMBilling")
        .or_else(|_| hkcu.open_subkey("Software\\TMBilling"))
    {
        if let Some(v) = read_str(&key, "Url") {
            cfg.url = v;
        }
        if let Some(v) = read_str(&key, "ApiKey") {
            cfg.api_key = v;
        }
        if let Some(v) = read_str(&key, "EmergencyUser") {
            cfg.emergency_user = to_sha256_hash(&v);
        }
        if let Some(v) = read_str(&key, "EmergencyToken") {
            cfg.emergency_token = to_sha256_hash(&v);
        }
    }

    if cfg.api_key.is_empty() {
        if let Some(ini) = load_ini() {
            if !ini.url.is_empty() {
                cfg.url = ini.url;
            }
            cfg.api_key = ini.api_key;
            cfg.emergency_user = ini.emergency_user;
            cfg.emergency_token = ini.emergency_token;
        }
    }
    cfg
}

fn read_str(key: &RegKey, name: &str) -> Option<String> {
    let value: String = key.get_value(name).ok()?;
    let value = value.trim().to_string();
    (!value.is_empty()).then_some(value)
}

fn config_paths() -> Vec<PathBuf> {
    let mut paths = vec![PathBuf::from("config.ini")];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        paths.push(PathBuf::from(local).join("TMBilling").join("config.ini"));
    }
    paths.push(PathBuf::from(r"C:\TMBILLING\config.ini"));
    paths
}

fn load_ini() -> Option<ClientConfig> {
    for path in config_paths() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            let cfg = parse_ini(&content);
            if !cfg.url.is_empty() {
                return Some(cfg);
            }
        }
    }
    None
}

fn parse_ini(content: &str) -> ClientConfig {
    let mut cfg = ClientConfig::default();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim().to_lowercase();
        let value = value.trim().to_string();
        match key.as_str() {
            "url" => cfg.url = value,
            "apikey" | "api_key" => cfg.api_key = value,
            // Empty values mean "emergency disabled", so they must not be hashed.
            "emergencyuser" | "emergency_user" if !value.is_empty() => {
                cfg.emergency_user = to_sha256_hash(&value)
            }
            "emergencytoken" | "emergency_token" if !value.is_empty() => {
                cfg.emergency_token = to_sha256_hash(&value)
            }
            _ => {}
        }
    }
    cfg
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ini_values_and_hashes_credentials() {
        let cfg = parse_ini("Url=http://srv:7015\nApiKey=KEY\nEmergencyUser=budi\n");
        assert_eq!(cfg.url, "http://srv:7015");
        assert_eq!(cfg.api_key, "KEY");
        assert_eq!(cfg.emergency_user.len(), 64);
    }

    #[test]
    fn empty_credentials_disable_emergency() {
        let cfg = parse_ini("Url=http://srv:7015
EmergencyUser=
EmergencyToken=
");
        assert!(cfg.emergency_user.is_empty());
        assert!(cfg.emergency_token.is_empty());
    }
}

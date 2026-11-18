use tmbilling_server::config::{paths, Config};

#[test]
fn versi_dan_cache_version() {
    let dir = std::env::temp_dir().join(format!("tmb_cfg_{}", std::process::id()));
    let cfg = Config::load(&dir).expect("config harus termuat");
    let v = env!("CARGO_PKG_VERSION");
    assert_eq!(cfg.version, v);
    assert_eq!(cfg.cache_version(), v.replace('.', ""));
    assert_eq!(cfg.version_tag(), format!("v{v}"));
}

#[tokio::test]
async fn ensure_membuat_semua_direktori() {
    let dir = std::env::temp_dir().join(format!("tmb_dirs_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    let cfg = Config::load(&dir).expect("config harus termuat");
    paths::ensure(&cfg).expect("ensure harus sukses");

    for d in [
        cfg.logs_dir.join("archives"),
        cfg.backup_dir.clone(),
        cfg.notes_dir.clone(),
        cfg.upload_dir.join("games"),
        cfg.upload_dir.join("menu"),
        cfg.upload_dir.join("qris"),
        cfg.upload_dir.join("screenshots"),
        cfg.root.join("app/static/assets/tutorials/temp"),
        cfg.root.join("instance/uploads/screenshots"),
    ] {
        assert!(d.is_dir(), "direktori belum dibuat: {}", d.display());
    }
}

#[test]
fn secret_key_bertahan_antar_load() {
    let dir = std::env::temp_dir().join(format!("tmb_secret_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let a = Config::load(&dir).unwrap().secret_key;
    let b = Config::load(&dir).unwrap().secret_key;
    assert_eq!(a.len(), 64);
    assert_eq!(a, b, "kunci harus dibaca ulang dari .env");
}

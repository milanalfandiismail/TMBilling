use serde_json::Value;
use tmbilling_server::utils::logger;

#[test]
fn audit_menulis_json_dengan_field_lengkap() {
    let dir = std::env::temp_dir().join(format!("tmb_log_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    logger::init(&dir, "Asia/Makassar");
    logger::audit(
        "admin",
        "LOGIN",
        "Kasir admin login",
        None,
        "127.0.0.1",
        "test-agent",
    );

    let text = std::fs::read_to_string(dir.join("warnet.log")).expect("log harus dibuat");
    let line = text.lines().next().expect("harus ada satu baris");
    let v: Value = serde_json::from_str(line).expect("baris harus JSON valid");

    for field in [
        "timestamp",
        "user",
        "action",
        "detail",
        "category",
        "ip_address",
        "browser_agent",
    ] {
        assert!(v.get(field).is_some(), "field hilang: {field}");
    }
    assert_eq!(v["category"], "AUTHENTICATION");
    assert_eq!(v["user"], "admin");
}

#[test]
fn kategori_tak_dikenal_jadi_system() {
    assert_eq!(logger::resolve_category("AKSI_ASING"), "SYSTEM");
    assert_eq!(logger::resolve_category("tambah_user"), "USER_ACCOUNT");
}

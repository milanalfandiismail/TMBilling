use std::process::Command;

#[tauri::command]
pub fn force_shutdown() {
    println!("DUMMY/REAL: PC is shutting down now!");
    
    // Perintah Windows untuk shutdown instan
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("shutdown")
            .args(["/s", "/t", "0", "/f"])
            .spawn();
    }
}

#[tauri::command]
pub fn get_external_bg() -> Option<String> {
    use std::env;

    // Cari di folder tempat .exe berada
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let bg_path = exe_dir.join("background.png");
            if bg_path.exists() {
                return Some(bg_path.to_string_lossy().to_string());
            }
        }
    }
    None
}

#[tauri::command]
pub async fn get_client_warnet(api: tauri::State<'_, crate::utils::api::ApiService>) -> Result<crate::utils::api::WarnetConfig, String> {
    api.get_warnet_config().await
}

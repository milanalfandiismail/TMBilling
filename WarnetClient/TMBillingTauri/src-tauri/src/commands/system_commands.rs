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
pub fn force_restart() {
    println!("DUMMY/REAL: PC is restarting now!");
    
    // Perintah Windows untuk restart instan
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("shutdown")
            .args(["/r", "/t", "0", "/f"])
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

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn open_control_panel_applet(applet: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let (program, args): (&str, Vec<&str>) = match applet.as_str() {
            "mouse" => ("control.exe", vec!["main.cpl"]),
            "sound" | "speaker" => ("control.exe", vec!["mmsys.cpl"]),
            "volume" => ("sndvol.exe", vec![]),
            "display" => ("control.exe", vec!["desk.cpl"]),
            _ => return Err(format!("Applet tidak dikenal: {}", applet)),
        };

        let mut cmd = Command::new(program);
        if !args.is_empty() {
            cmd.args(&args);
        }
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.spawn()
            .map_err(|e| format!("Gagal menjalankan {}: {}", program, e))?;

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        println!("Control panel applet {} hanya didukung di Windows", applet);
        Ok(())
    }
}

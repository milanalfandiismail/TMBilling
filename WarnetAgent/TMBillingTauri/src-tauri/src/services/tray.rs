use tauri::{SystemTray, SystemTrayMenu, CustomMenuItem, AppHandle, SystemTrayEvent, Manager};

pub fn create_tray() -> SystemTray {
    let show = CustomMenuItem::new("show".to_string(), "Tampilkan");
    let tray_menu = SystemTrayMenu::new().add_item(show);
    SystemTray::new().with_menu(tray_menu)
}

pub fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => {
            if let Some(window) = app.get_window("main") {
                match id.as_str() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    _ => {}
                }
            }
        }
        SystemTrayEvent::LeftClick { .. } => {
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

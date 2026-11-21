use tray_icon::menu::{Menu, MenuEvent, MenuItem};
use tray_icon::{Icon, MouseButton, TrayIconBuilder, TrayIconEvent};

/// Ikon aplikasi yang ditanam winresource (ordinal 1), fallback kotak accent.
fn icon() -> Option<Icon> {
    if let Ok(icon) = Icon::from_resource(1, Some((16, 16))) {
        return Some(icon);
    }
    let mut rgba = Vec::with_capacity(16 * 16 * 4);
    for _ in 0..16 * 16 {
        rgba.extend_from_slice(&[0x34, 0xD3, 0x99, 0xFF]);
    }
    Icon::from_rgba(rgba, 16, 16).ok()
}

/// Same tray as the Tauri client: a single "Tampilkan" entry that focuses the window.
pub fn install() {
    let menu = Menu::new();
    let show = MenuItem::new("Tampilkan", true, None);
    let _ = menu.append(&show);
    let mut builder = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("TMBilling")
        // klik kiri tunggal tidak membuka menu; double-click langsung memunculkan window
        .with_menu_on_left_click(false);
    if let Some(icon) = icon() {
        builder = builder.with_icon(icon);
    }
    if let Ok(tray) = builder.build() {
        // The tray owns the OS icon handle, so it must outlive install().
        std::mem::forget(tray);
    }

    let show_id = show.id().clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        if event.id == show_id && !super::window_manager::restore_from_tray() {
            super::single_instance::focus_existing();
        }
    }));

    TrayIconEvent::set_event_handler(Some(|event: TrayIconEvent| {
        if let TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } = event
        {
            if !super::window_manager::restore_from_tray() {
                super::single_instance::focus_existing();
            }
        }
    }));
}

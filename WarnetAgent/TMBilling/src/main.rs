#[allow(dead_code)]
mod api;
mod app;
mod audio;
mod gallery;
mod platform;
mod polling;
mod poster_cache;
mod qris_cache;
mod state;
mod theme;
mod ui;
#[allow(dead_code)]
mod update;

use gpui_kit::*;

fn requested_size() -> (f32, f32) {
    let args: Vec<String> = std::env::args().collect();
    if let Some(pos) = args.iter().position(|a| a == "--size") {
        if let Some((w, h)) = args.get(pos + 1).and_then(|s| s.split_once('x')) {
            if let (Ok(w), Ok(h)) = (w.parse(), h.parse()) {
                return (w, h);
            }
        }
    }
    (1920.0, 1080.0)
}

/// Modal yang diminta lewat TM_MODAL, untuk screenshot verifikasi.
fn env_modal() -> Option<state::Modal> {
    match std::env::var("TM_MODAL").as_deref() {
        Ok("member") => Some(state::Modal::Member),
        Ok("menu") => Some(state::Modal::Menu),
        Ok("detail") => Some(state::Modal::Detail(0)),
        Ok("qris") => Some(state::Modal::QrisFull),
        Ok("pin") => Some(state::Modal::AfkPin),
        Ok("logout") => Some(state::Modal::Logout),
        Ok("admin") => Some(state::Modal::Admin),
        Ok("power") => Some(state::Modal::Power(state::PowerAction::Restart)),
        Ok("launcher") => Some(state::Modal::Launcher),
        _ => None,
    }
}

fn window_options() -> WindowOptions {
    let (w, h) = requested_size();
    WindowOptions {
        window_bounds: Some(WindowBounds::Windowed(Bounds::new(
            point(px(0.), px(0.)),
            size(px(w), px(h)),
        ))),
        titlebar: None,
        ..Default::default()
    }
}

/// Mode uji desktop: tanpa keyboard hook dan tanpa sembunyikan taskbar.
pub fn dev_safe() -> bool {
    std::env::var("TM_DEV_SAFE").map(|v| v == "1").unwrap_or(false)
}

fn main() {
    // Helper swap exe: jalan sebelum cek keamanan karena berkasnya bernama TMBilling.update.exe.
    if let Some((new, exe)) = update::apply_args() {
        match update::apply(&new, &exe) {
            Ok(()) => std::process::exit(0),
            Err(e) => {
                update::catat(&format!("[update] {e}"));
                std::process::exit(2);
            }
        }
    }

    #[cfg(not(debug_assertions))]
    {
        use platform::security;
        if let Err(e) = security::verify_process_name("TMBilling.exe") {
            eprintln!("[SECURITY] {e}");
            std::process::exit(1);
        }
        if let Err(e) = security::verify_file_integrity() {
            eprintln!("[SECURITY] {e}");
            eprintln!("[SECURITY] Please reinstall TMBilling Client");
            std::process::exit(1);
        }
        if let Ok(lock) = security::lock_executable_file() {
            let _ = security::FILE_LOCK.set(lock);
        }
    }

    // Second launch just focuses the window of the running client.
    let _instance = match platform::single_instance::acquire("TMBilling") {
        Some(guard) => guard,
        None => return,
    };
    if !dev_safe() {
        platform::keyboard::init();
    }

    let gallery = std::env::args().any(|a| a == "--gallery");
    let overlay = std::env::args().any(|a| a == "--overlay");
    gpui_kit::application().run(move |cx: &mut App| {
        gpui_kit::init(cx);
        if gallery {
            gpui_kit::open_window(window_options(), cx, |_, cx| {
                cx.new(|cx: &mut Context<gallery::Gallery>| gallery::Gallery::new(cx))
            })
            .expect("failed to open window");
        } else {
            gpui_kit::open_window(window_options(), cx, |_, cx| {
                cx.new(|cx: &mut Context<state::TmApp>| {
                    let mut app = state::TmApp::default();
                    // shortcut: sesi palsu untuk menilai tampilan overlay sebelum server hidup
                    if !overlay {
                        app.modal = match env_modal() {
                            Some(m @ (state::Modal::Admin | state::Modal::Power(_))) => Some(m),
                            _ => None,
                        };
                    }
                    // shortcut: hook screenshot untuk banner galat login (tanpa server)
                    if let Ok(kind) = std::env::var("TM_LOGIN_ERROR") {
                        app.login.error = Some(match kind.as_str() {
                            "auth" => state::login_error(401, Some("Username atau password salah")),
                            "saldo" => state::login_error(400, Some("Waktu habis")),
                            _ => state::login_error(0, None),
                        });
                    }
                    if overlay {
                        app.demo_overlay = true;
                        app.view = state::View::Overlay;
                        app.modal = env_modal();
                        app.overlay_tab = std::env::var("TM_OVERLAY_TAB")
                            .ok()
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(0);
                        app.session = Some(state::Session {
                            nama: "budi".into(),
                            grup: "REGULAR".into(),
                            pc_kode: "PC-12".into(),
                            is_member: true,
                            is_emergency: false,
                        });
                        app.remaining_secs = 5078;
                        app.started_at = Some("20:12".into());
                        app.member_json = Some(serde_json::json!({
                            "username": "budi",
                            "nama_lengkap": "Budi Santoso",
                            "email": "budi@warnet.id",
                            "no_hp": "0812-3456-7890",
                            "kadaluarsa_pada_display": "22/12/2026 20:12 WITA",
                            "dibuat_pada_display": "22/11/2026 20:12 WITA",
                        }));
                        // Mock games untuk pengujian launcher tanpa server (lengkap dengan poster lokal jika ada)
                        let mock_items = [
                            (1, "Valorant", "game", "FPS", "valorant.jpg"),
                            (2, "Dota 2", "game", "MOBA", "dota2.jpg"),
                            (3, "Counter-Strike 2", "game", "FPS", "cs2.jpg"),
                            (4, "Point Blank", "game", "FPS", "pointblank.jpg"),
                            (5, "Mobile Legends (PC)", "game", "MOBA", "mlbb.jpg"),
                            (6, "PUBG: Battlegrounds", "game", "Battle Royale", "pubg.jpg"),
                            (7, "Apex Legends", "game", "Battle Royale", "apex.jpg"),
                            (8, "Grand Theft Auto V", "game", "RPG / Open World", "gtav.jpg"),
                            (9, "Cyberpunk 2077", "game", "RPG / Open World", "cyberpunk.jpg"),
                            (10, "Elden Ring", "game", "RPG / Open World", "eldenring.jpg"),
                            (11, "Baldur's Gate 3", "game", "RPG / Open World", "baldursgate3.jpg"),
                            (12, "Rust", "game", "Survival", "rust.jpg"),
                            (13, "Marvel's Spider-Man", "game", "Action", "spiderman.jpg"),
                            (14, "Terraria", "game", "Casual & Party", "terraria.jpg"),
                            (15, "EA SPORTS FC 24", "game", "Sport", "fc24.jpg"),
                            (16, "Google Chrome", "aplikasi", "Browser", "chrome.jpg"),
                            (17, "Discord", "aplikasi", "Chat", "discord.jpg"),
                        ];
                        app.games = mock_items.iter().map(|(id, name, tipe, kat, icon)| {
                            let url = format!("/static/uploads/games/{}", icon);
                            let local_candidates = [
                                format!("app-rust/app/static/uploads/games/{}", icon),
                                format!("../../app-rust/app/static/uploads/games/{}", icon),
                            ];
                            for c in &local_candidates {
                                if let Ok(bytes) = std::fs::read(c) {
                                    crate::poster_cache::store_poster(&url, gpui_kit::ImageFormat::Jpeg, &bytes);
                                    break;
                                }
                            }
                            crate::api::models::GameItem {
                                id: *id,
                                nama: (*name).into(),
                                tipe: Some((*tipe).into()),
                                kategori: Some((*kat).into()),
                                exe_path: Some("notepad.exe".into()),
                                argumen: None,
                                icon: Some((*icon).into()),
                                icon_url: Some(url),
                                aktif: Some(true),
                            }
                        }).collect();
                    }
                    app.start(cx);
                    app
                })
            })
            .expect("failed to open window");
        }
        platform::tray::install();
    });
    platform::keyboard::cleanup();
}

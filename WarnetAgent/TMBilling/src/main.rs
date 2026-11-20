#[allow(dead_code)]
mod api;
mod app;
mod audio;
mod gallery;
mod platform;
mod polling;
mod state;
mod theme;
mod ui;

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

fn main() {
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
                    if overlay {
                        app.demo_overlay = true;
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
                        app.started_at = Some((20, 12));
                    }
                    app.start(cx);
                    app
                })
            })
            .expect("failed to open window");
        }
    });
}

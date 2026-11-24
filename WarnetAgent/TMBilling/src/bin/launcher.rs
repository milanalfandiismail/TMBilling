#![windows_subsystem = "windows"]

use gpui_kit::component::scroll::ScrollableElement;
use gpui_kit::prelude::*;
use gpui_kit::*;
use single_instance::SingleInstance;
use std::time::Duration;

use tmbilling_core::api::client::ApiClient;
use tmbilling_core::api::models::GameItem;
use tmbilling_core::platform::credentials;
use tmbilling_core::platform::window::work_area_bounds;
use tmbilling_core::poster_cache;
use tmbilling_core::theme::TM;
use tmbilling_core::ui::launcher::{card, layout};

enum LauncherModal {
    Launching {
        name: String,
        tick: usize,
    },
    Error {
        title: String,
        message: String,
    },
}

struct LauncherApp {
    games: Vec<GameItem>,
    search_query: String,
    active_tab: usize, // 0 = Semua, 1 = Game, 2 = Aplikasi
    pc_kode: String,
    time_countdown: String,
    remaining_secs: i64,
    is_admin: bool,
    search_focused: bool,
    caret_on: bool,
    focus_handle: FocusHandle,
    active_modal: Option<LauncherModal>,
    modal_epoch: u64,
}

fn typed_text(ev: &KeyDownEvent) -> Option<String> {
    if let Some(text) = ev.keystroke.key_char.as_deref() {
        return Some(text.to_string());
    }
    let key = ev.keystroke.key.as_str();
    if key.chars().count() == 1 && key.chars().all(|c| c.is_ascii_graphic()) {
        return Some(key.to_string());
    }
    None
}

impl LauncherApp {
    fn new(cx: &mut Context<Self>) -> Self {
        let cfg = credentials::load();
        let client = ApiClient::new(&cfg.url, &cfg.api_key);

        let app = Self {
            games: Vec::new(),
            search_query: String::new(),
            active_tab: 0,
            pc_kode: String::new(),
            time_countdown: "--:--:--".to_string(),
            remaining_secs: 0,
            is_admin: false,
            search_focused: false,
            caret_on: true,
            focus_handle: cx.focus_handle(),
            active_modal: None,
            modal_epoch: 0,
        };

        // Fetch games pertama kali (menggunakan Tokio runtime tmbilling_core::polling::http)
        let client_clone = client.clone();
        let server_url = cfg.url.clone();
        cx.spawn(async move |this, cx| {
            let res = tmbilling_core::polling::http(async move {
                let games_res = client_clone.games().await;
                if let Ok(ref games) = games_res {
                    for item in games {
                        if let Some(ref icon_url) = item.icon_url {
                            if poster_cache::get_poster(icon_url).is_none() {
                                if let Some(bytes) = client_clone.fetch_image_bytes(icon_url).await {
                                    poster_cache::store_poster_auto(icon_url, &bytes);
                                }
                            }
                        }
                    }
                }
                games_res
            }).await;

            match res {
                Ok(games) => {
                    let _ = this.update(cx, |app, cx| {
                        app.games = games;
                        cx.notify();
                    });
                }
                Err(e) => {
                    let err_msg = format!("Gagal memuat katalog: {e}. Periksa koneksi ke server billing ({server_url})");
                    let _ = this.update(cx, |app, cx| {
                        app.active_modal = Some(LauncherModal::Error {
                            title: "Gagal Memuat Katalog".into(),
                            message: err_msg,
                        });
                        cx.notify();
                    });
                }
            }
        }).detach();

        // Background polling dinamis yang identik dengan overlay (1s / 5s / 10s dari server)
        let client_poll = client.clone();
        cx.spawn(async move |this, cx| {
            let mut interval = tmbilling_core::polling::next_interval(true, None);
            loop {
                if let Some((ip, mac)) = tmbilling_core::polling::local_net() {
                    let client_inner = client_poll.clone();
                    let ip_c = ip.clone();
                    let mac_c = mac.clone();
                    let status_res = tmbilling_core::polling::http(async move {
                        client_inner.status_launcher(&ip_c, &mac_c).await
                    }).await;

                    if let Ok(status) = status_res {
                        interval = tmbilling_core::polling::next_interval(true, status.polling_interval);
                        let updated = this.update(cx, |app, cx| {
                            if let Some(ref kode) = status.pc_kode {
                                app.pc_kode = kode.clone();
                            }
                            let is_admin = status.status == "admin" || status.status == "system";
                            // Server mengirim sisa_detik (jika ada) atau sisa_waktu dalam MENIT (* 60)
                            let server_secs = status
                                .sisa_detik
                                .or_else(|| status.sisa_waktu.map(|m| i64::from(m) * 60))
                                .unwrap_or(0);
                            let rem = if is_admin {
                                999_999
                            } else {
                                tmbilling_core::state::sync_remaining(app.remaining_secs, server_secs)
                            };
                            app.is_admin = is_admin;
                            app.remaining_secs = rem;
                            app.time_countdown = tmbilling_core::state::timer_text(is_admin, rem);
                            cx.notify();
                        });
                        if updated.is_err() {
                            break;
                        }
                    }
                }
                cx.background_executor().timer(Duration::from_secs(interval)).await;
            }
        }).detach();

        // Local 1-second countdown tick agar hitung mundur halus di antara interval polling
        cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor().timer(Duration::from_secs(1)).await;
                let updated = this.update(cx, |app, cx| {
                    if !app.is_admin {
                        if app.remaining_secs > 0 {
                            let before_text = app.time_countdown.clone();
                            app.remaining_secs = app.remaining_secs.saturating_sub(1);
                            let new_text = tmbilling_core::state::timer_text(false, app.remaining_secs);
                            if new_text != before_text {
                                app.time_countdown = new_text;
                                cx.notify();
                            }
                        } else if app.time_countdown != "--:--:--" && app.time_countdown != "Sesi Berakhir" {
                            app.time_countdown = tmbilling_core::state::timer_text(false, 0);
                            cx.notify();
                        }
                    }
                });
                if updated.is_err() {
                    break;
                }
            }
        }).detach();

        // Caret blinking timer (500ms) saat search_focused aktif
        cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor().timer(Duration::from_millis(500)).await;
                let updated = this.update(cx, |app, cx| {
                    if app.search_focused {
                        app.caret_on = !app.caret_on;
                        cx.notify();
                    }
                });
                if updated.is_err() {
                    break;
                }
            }
        }).detach();

        app
    }

    fn on_key(&mut self, event: &KeyDownEvent, _window: &mut Window, cx: &mut Context<Self>) {
        let key = event.keystroke.key.as_str();
        if key == "backspace" {
            if !self.search_query.is_empty() {
                self.search_query.pop();
                cx.notify();
            }
        } else if let Some(text) = typed_text(event) {
            self.search_query.push_str(&text);
            self.search_focused = true;
            self.caret_on = true;
            cx.notify();
        }
    }

    fn launch_game(&mut self, title: &str, exe: &str, args: Option<&str>, cx: &mut Context<Self>) {
        let exe_trimmed = exe.trim();
        if exe_trimmed.is_empty() {
            self.active_modal = Some(LauncherModal::Error {
                title: "Tidak Dapat Membuka Aplikasi".into(),
                message: format!("Path eksekusi untuk '{}' belum disetel di server billing.", title),
            });
            cx.notify();
            return;
        }

        let path = std::path::Path::new(exe_trimmed);
        if !path.exists() {
            self.active_modal = Some(LauncherModal::Error {
                title: "File Tidak Ditemukan".into(),
                message: format!(
                    "File executable untuk '{}' tidak ditemukan di path: '{}'. Pastikan aplikasi sudah terinstall.",
                    title, exe_trimmed
                ),
            });
            cx.notify();
            return;
        }

        let mut cmd = std::process::Command::new(exe_trimmed);
        if let Some(parent) = path.parent() {
            cmd.current_dir(parent);
        }
        if let Some(a) = args {
            if !a.trim().is_empty() {
                cmd.args(a.split_whitespace());
            }
        }

        match cmd.spawn() {
            Ok(_) => {
                self.modal_epoch += 1;
                let current_epoch = self.modal_epoch;
                self.active_modal = Some(LauncherModal::Launching {
                    name: title.to_string(),
                    tick: 0,
                });
                cx.notify();

                // Animasi visual progress bar 3.0 detik (30 tick x 100ms)
                cx.spawn(async move |this, cx| {
                    for t in 1..=30 {
                        cx.background_executor().timer(Duration::from_millis(100)).await;
                        let cont = this.update(cx, |app, cx| {
                            if app.modal_epoch == current_epoch {
                                if let Some(LauncherModal::Launching { ref mut tick, .. }) = app.active_modal {
                                    *tick = t;
                                    cx.notify();
                                    return true;
                                }
                            }
                            false
                        }).unwrap_or(false);
                        if !cont {
                            return;
                        }
                    }

                    // Menutup modal otomatis setelah 3 detik
                    let _ = this.update(cx, |app, cx| {
                        if app.modal_epoch == current_epoch {
                            if matches!(app.active_modal, Some(LauncherModal::Launching { .. })) {
                                app.active_modal = None;
                                cx.notify();
                            }
                        }
                    });
                }).detach();
            }
            Err(e) => {
                self.active_modal = Some(LauncherModal::Error {
                    title: "Gagal Menjalankan Program".into(),
                    message: format!("Terjadi kesalahan sistem saat menjalankan '{}' ({}): {e}", title, exe_trimmed),
                });
                cx.notify();
            }
        }
    }
}

impl Render for LauncherApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let vp = window.viewport_size();
        let vp_w = f32::from(vp.width);
        let (_cols, metrics) = card::get_metrics_for_width(vp_w);

        let resolution_label = if vp_w >= 2400.0 {
            "2560x1440"
        } else if vp_w >= 1600.0 {
            "1920x1080"
        } else if vp_w >= 1200.0 {
            "1366x768"
        } else {
            "1024x768"
        };

        let active_tab = self.active_tab;
        let search_query = &self.search_query;

        // Filter games berdasarkan tab & search query
        let filtered: Vec<&GameItem> = self
            .games
            .iter()
            .filter(|g| {
                if active_tab == 1 && g.is_aplikasi() {
                    return false;
                }
                if active_tab == 2 && !g.is_aplikasi() {
                    return false;
                }
                if !search_query.is_empty() {
                    let q = search_query.to_lowercase();
                    let match_name = g.nama.to_lowercase().contains(&q);
                    let match_cat = g
                        .kategori
                        .as_deref()
                        .map(|k| k.to_lowercase().contains(&q))
                        .unwrap_or(false);
                    return match_name || match_cat;
                }
                true
            })
            .collect();

        let count = filtered.len();

        let entity = cx.entity().clone();

        let mut grid = div()
            .flex()
            .flex_row()
            .flex_wrap()
            .items_start()
            .gap(px(14.0))
            .justify_start()
            .w_full();

        for item in &filtered {
            let ent = entity.clone();
            grid = grid.child(card::poster_card(item, metrics, move |title: &str, exe: &str, args: Option<&str>, _w: &mut Window, cx: &mut App| {
                let title_s = title.to_string();
                let exe_s = exe.to_string();
                let args_s = args.map(|s| s.to_string());
                ent.update(cx, |this, cx| {
                    this.launch_game(&title_s, &exe_s, args_s.as_deref(), cx);
                });
            }));
        }

        if filtered.is_empty() {
            grid = grid.child(
                div()
                    .w_full()
                    .h(px(320.0))
                    .flex()
                    .flex_col()
                    .items_center()
                    .justify_center()
                    .gap(px(8.0))
                    .child(
                        div()
                            .text_size(px(15.0))
                            .font_weight(FontWeight::BOLD)
                            .text_color(TM.dim)
                            .child("Tidak ada game atau aplikasi yang ditemukan"),
                    )
                    .child(
                        div()
                            .text_size(px(12.0))
                            .text_color(TM.muted)
                            .child("Coba periksa kata kunci pencarian atau kategori filter"),
                    ),
            );
        }

        let ent_tab = entity.clone();
        let on_tab = move |idx: usize, _w: &mut Window, cx: &mut App| {
            ent_tab.update(cx, |this, cx| {
                this.active_tab = idx;
                cx.notify();
            });
        };

        let ent_search = entity.clone();
        let on_search_click = move |_w: &mut Window, cx: &mut App| {
            ent_search.update(cx, |this, cx| {
                this.search_focused = true;
                this.caret_on = true;
                cx.notify();
            });
        };

        let on_close: tmbilling_core::ui::overlay::ActFn = std::rc::Rc::new(|_w, _cx| {
            std::process::exit(0);
        });

        let mut root = div()
            .size_full()
            .bg(TM.bg)
            .flex()
            .flex_col()
            .justify_between()
            .track_focus(&self.focus_handle)
            .capture_key_down(cx.listener(Self::on_key))
            // Bagian Atas: Navbar & Subheader Controls
            .child(
                div()
                    .flex()
                    .flex_col()
                    .w_full()
                    .child(layout::navbar(
                        &self.search_query,
                        &self.time_countdown,
                        self.search_focused,
                        self.caret_on,
                        on_search_click,
                        Some(on_close),
                    ))
                    .child(layout::subheader(
                        self.active_tab,
                        count,
                        resolution_label,
                        on_tab,
                    )),
            )
            // Bagian Tengah: Scrollable Grid Area
            .child(
                div()
                    .flex_1()
                    .w_full()
                    .overflow_y_scrollbar()
                    .px(px(32.0))
                    .py(px(16.0))
                    .child(grid),
            )
            // Bagian Bawah: Footer Dock
            .child(layout::footer(&self.pc_kode));

        if let Some(ref modal) = self.active_modal {
            let ent = entity.clone();
            let modal_elem: AnyElement = match modal {
                LauncherModal::Launching { name, tick } => {
                    layout::modal_launching(name, *tick, move |_w, cx| {
                        ent.update(cx, |app, cx| {
                            app.active_modal = None;
                            app.modal_epoch += 1;
                            cx.notify();
                        });
                    }).into_any_element()
                }
                LauncherModal::Error { title, message } => {
                    layout::modal_error(title, message, move |_w, cx| {
                        ent.update(cx, |app, cx| {
                            app.active_modal = None;
                            cx.notify();
                        });
                    }).into_any_element()
                }
            };
            root = root.child(modal_elem);
        }

        root
    }
}

fn main() {
    let instance = SingleInstance::new("TMGameLauncher_SingleInstance");
    if instance.is_ok() && !instance.unwrap().is_single() {
        // Jika sudah berjalan, bawa ke depan dan keluar
        #[cfg(windows)]
        {
            use windows::core::PCWSTR;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE};
            let title: Vec<u16> = "TM Game Launcher ".encode_utf16().collect();
            if let Ok(hwnd) = unsafe { FindWindowW(PCWSTR::null(), PCWSTR(title.as_ptr())) } {
                if hwnd != HWND::default() {
                    let _ = unsafe { ShowWindow(hwnd, SW_RESTORE) };
                    let _ = unsafe { SetForegroundWindow(hwnd) };
                }
            }
        }
        return;
    }

    gpui_kit::application().run(move |cx: &mut App| {
        gpui_kit::init(cx);
        let (work_w, work_h) = work_area_bounds();
        let bounds = Bounds::new(point(px(0.0), px(0.0)), size(px(work_w), px(work_h)));

        let options = WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            titlebar: None,
            window_background: WindowBackgroundAppearance::Opaque,
            focus: true,
            show: true,
            kind: WindowKind::Normal,
            is_movable: false,
            ..Default::default()
        };

        cx.open_window(options, |_window, cx| cx.new(|cx| LauncherApp::new(cx)))
            .unwrap();
    });
}

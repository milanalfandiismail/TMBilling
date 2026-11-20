use std::rc::Rc;

use crate::api::client::ApiClient;
use crate::polling::{self, AppEvent};
use crate::state::{self, Alert, LoginField, PowerAction, TmApp, Modal};
use crate::theme::TM;
use crate::ui::kiosk::header::header;
use crate::ui::kiosk::{info, login, KioskActions};
use crate::ui::overlay::card as overlay_card_mod;
use crate::ui::overlay::{ModalFn, ActFn, OverlayActions, TabFn, ToolFn, ToolId};
use crate::platform::window::overlay_geometry;
use crate::platform::window_manager as wm;
use gpui_kit::prelude::*;
use gpui_kit::*;

impl TmApp {
    pub fn apply(&mut self, event: AppEvent, cx: &mut Context<Self>) {
        let remote = match &event {
            AppEvent::Command(cmd) => crate::state::remote_action(cmd),
            _ => None,
        };
        if let Some(action) = remote {
            match action {
                crate::state::RemoteAction::Lock => {
                    self.session = None;
                    self.locked = true;
                    self.modal = None;
                }
                crate::state::RemoteAction::Shutdown => self.run_power(PowerAction::Shutdown, cx),
                crate::state::RemoteAction::Restart => self.run_power(PowerAction::Restart, cx),
            }
        }
        let changed = self.reduce(event);
        self.play_alert();
        if changed {
            cx.notify();
        }
    }

    /// Peringatan audio dievaluasi pada tiap detik (bukan hanya saat poll), sama seperti Tauri.
    fn play_alert(&mut self) {
        if self.session.is_none() {
            return;
        }
        if let Some(alert) = self.alerts.update(self.remaining_secs) {
            crate::audio::play(match alert {
                Alert::Min15 => crate::audio::WARNING_15MIN,
                Alert::Min5 => crate::audio::WARNING_5MIN,
                Alert::Min1 => crate::audio::WARNING_1MIN,
            });
        }
    }

    pub fn start(&mut self, cx: &mut Context<Self>) {
        self.login.info_page = 1;
        // Satu detik per tick: hitung mundur shutdown harus jalan tanpa menunggu polling.
        cx.spawn(async move |this, cx| loop {
            cx.background_executor()
                .timer(std::time::Duration::from_secs(1))
                .await;
            let alive = this.update(cx, |app, cx| {
                let mut dirty = false;
                if app.session.is_some() {
                    let next = crate::state::tick_remaining(app.remaining_secs);
                    if next != app.remaining_secs {
                        app.remaining_secs = next;
                        app.play_alert();
                        dirty = true;
                    }
                }
                if crate::state::should_autolock(
                    app.remaining_secs,
                    app.locked,
                    app.session.is_some(),
                ) {
                    // sama seperti Tauri: waktu habis = logout, bukan AFK
                    app.session = None;
                    app.modal = None;
                    if let Some(client) = app.client.clone() {
                        let (ip, mac) = crate::polling::local_net().unwrap_or_default();
                        cx.spawn(async move |_, _| {
                            let _ = polling::http(async move { client.logout(&ip, &mac).await }).await;
                        })
                        .detach();
                    }
                    dirty = true;
                }
                match crate::state::tick_shutdown(app.shutdown_secs) {
                    crate::state::ShutdownTick::Idle => {}
                    crate::state::ShutdownTick::Counting(next) => {
                        app.shutdown_secs = Some(next);
                        dirty = true;
                    }
                    crate::state::ShutdownTick::Fire => {
                        // clear dulu supaya tidak memicu dua kali
                        app.shutdown_secs = None;
                        app.run_power(crate::state::PowerAction::Shutdown, cx);
                        dirty = true;
                    }
                }
                if dirty {
                    cx.notify();
                }
            });
            if alive.is_err() {
                break;
            }
        })
        .detach();
        if self.demo_overlay {
            return;
        }
        // shortcut: tab awal dipaksa lewat env untuk verifikasi visual, dibuang saat dogfood
        if std::env::var("TM_INFO_TAB").ok().as_deref() == Some("1") {
            self.login.info_tab = 1;
        }
        // shortcut: kredensial & base URL dibaca dari config.ini/registry di Task 12
        // Env wins so a dev machine can point at a sandbox server.
        let cfg = crate::platform::credentials::load();
        let base_url = std::env::var("TM_SERVER_URL").unwrap_or(cfg.url);
        let api_key = std::env::var("TM_CLIENT_KEY").unwrap_or(cfg.api_key);
        let client = ApiClient::new(base_url, api_key);
        self.client = Some(client.clone());
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        polling::spawn_runtime(client, tx);
        cx.spawn(async move |this, cx| {
            while let Some(event) = rx.recv().await {
                if this.update(cx, |app, cx| app.apply(event, cx)).is_err() {
                    break;
                }
            }
        })
        .detach();
    }

    fn submit_login(&mut self, cx: &mut Context<Self>) {
        if self.auth_busy {
            return;
        }
        if !self.login.can_submit() {
            self.login.error = Some("Username dan password wajib diisi.".into());
            cx.notify();
            return;
        }
        let Some(client) = self.client.clone() else {
            self.login.error = Some("Belum terhubung ke server.".into());
            cx.notify();
            return;
        };
        self.login.busy = true;
        self.auth_busy = true;
        self.login.error = None;
        let (ip, mac) = polling::local_net().unwrap_or_default();
        let user = self.login.username.trim().to_string();
        let pass = self.login.password.clone();
        cx.notify();
        cx.spawn(async move |this, cx| {
            let res = polling::http(async move { client.member_login(&ip, &mac, &user, &pass).await }).await;
            this.update(cx, |app, cx| {
                app.login.busy = false;
                match res {
                    Ok(r) if r.success => {
                        app.login.password.clear();
                        app.apply_login_result(true, None);
                        app.login_pending = true;
                        app.refresh_status(cx);
                    }
                    Ok(r) => {
                        let msg = crate::state::login_error(400, r.error.as_deref());
                        app.apply_login_result(false, Some(&msg));
                    }
                    Err(crate::api::client::ApiError::Http { status, message }) => {
                        let msg = crate::state::login_error(status, Some(&message));
                        app.apply_login_result(false, Some(&msg));
                    }
                    Err(crate::api::client::ApiError::Network(_)) => {
                        let msg = crate::state::login_error(0, None);
                        app.apply_login_result(false, Some(&msg));
                    }
                    Err(crate::api::client::ApiError::Parse) => {
                        app.apply_login_result(
                            false,
                            Some("Server mengirim jawaban tidak dikenal. Coba lagi."),
                        );
                    }
                }
                cx.notify();
            })
            .ok();
        })
        .detach();
    }

    fn on_key(&mut self, ev: &KeyDownEvent, _window: &mut Window, cx: &mut Context<Self>) {
        let key = ev.keystroke.key.as_str();
        match key {
            // F11 is the admin hotkey of the Tauri client; F10 opens the read-only menu.
            "f10" => {
                self.menu_page = 1;
                self.modal = Some(Modal::Menu);
                cx.notify();
                return;
            }
            "f11" if crate::state::admin_hotkey_allowed(self.session.is_some()) => {
                self.login.admin_user.clear();
                self.login.admin_pass.clear();
                self.login.error = None;
                self.modal = Some(Modal::Admin);
                cx.notify();
                return;
            }
            _ => {}
        }
        if key == "escape" {
            // shortcut: ESC menutup semua modal kecuali PIN (butuh aksi eksplisit)
            if self.modal.is_some_and(|m| m != Modal::AfkPin) {
                self.modal = None;
                cx.notify();
                return;
            }
        }
        match self.modal {
            Some(Modal::AfkPin) => {
                match key {
                    "backspace" => {
                        self.pin.pop();
                    }
                    "enter" => self.submit_pin(cx),
                    _ => {
                        if let Some(text) = typed_text(ev) {
                            for ch in text.chars() {
                                if self.pin.chars().count() < 12 {
                                    self.pin.push(ch);
                                }
                            }
                        }
                    }
                }
                cx.notify();
                return;
            }
            Some(Modal::Admin) => {
                match key {
                    "backspace" => {
                        self.login.admin_backspace();
                    }
                    "tab" => self.login.admin_focus_next(),
                    "enter" => self.submit_admin(cx),
                    _ => {
                        if let Some(text) = typed_text(ev) {
                            for ch in text.chars() {
                                self.login.admin_type_char(ch);
                            }
                        }
                    }
                }
                cx.notify();
                return;
            }
            Some(_) => return,
            None => {}
        }
        match key {
            "backspace" => {
                self.login.backspace();
            }
            "tab" => self.login.focus_next(),
            "enter" => self.submit_login(cx),
            _ => {
                if let Some(text) = typed_text(ev) {
                    for ch in text.chars() {
                        self.login.type_char(ch);
                    }
                }
            }
        }
        cx.notify();
    }

    fn submit_pin(&mut self, cx: &mut Context<Self>) {
        if self.pin.chars().count() < 4 {
            cx.notify();
            return;
        }
        let pin = self.pin.clone();
        if let Some(client) = self.client.clone() {
            let ip = self.pc_kode.clone();
            cx.spawn(async move |this, cx| {
                let _ = polling::http(async move { client.afk_lock(&ip, "", Some(&pin)).await }).await;
                let _ = this.update(cx, |app, cx| {
                    app.locked = true;
                    app.modal = None;
                    app.pin.clear();
                    cx.notify();
                });
            })
            .detach();
        } else {
            self.locked = true;
            self.modal = None;
            self.pin.clear();
            cx.notify();
        }
    }

    /// Mode ditentukan status server; login tidak boleh memindahkan layar sendiri.
    fn refresh_status(&mut self, cx: &mut Context<Self>) {
        let Some(client) = self.client.clone() else {
            return;
        };
        let (ip, mac) = polling::local_net().unwrap_or_default();
        cx.spawn(async move |this, cx| {
            if let Ok(status) = polling::http(async move { client.status(&ip, &mac, false).await }).await {
                let _ = this.update(cx, |app, cx| app.apply(AppEvent::Status(status), cx));
            }
        })
        .detach();
    }

    fn submit_admin(&mut self, cx: &mut Context<Self>) {
        if self.auth_busy {
            return;
        }
        let (app_ip, app_mac) = crate::polling::local_net().unwrap_or_default();
        let (user, pass) = self.login.admin_credentials();
        let (user, pass) = (user.to_string(), pass.to_string());
        if user.is_empty() || pass.is_empty() {
            self.login.error = Some("Username dan password wajib diisi.".to_string());
            cx.notify();
            return;
        }
        self.login.error = None;
        self.auth_busy = true;
        let Some(client) = self.client.clone() else {
            self.auth_busy = false;
            return;
        };
        cx.spawn(async move |this, cx| {
            let ip = app_ip.clone();
            let mac = app_mac.clone();
            let result = polling::http(async move { client.admin_login(&ip, &mac, &user, &pass).await }).await;
            this.update(cx, |app, cx| {
                match result {
                    Ok(res) if res.success => {
                        app.apply_login_result(true, None);
                        app.auth_busy = false;
                        app.modal = None;
                        app.login.admin_pass.clear();
                    }
                    Ok(res) => {
                        let msg = res
                            .error
                            .unwrap_or_else(|| "Gagal masuk. Coba lagi.".to_string());
                        app.apply_login_result(false, Some(&msg));
                    }
                    Err(err) => {
                        let msg = err.to_string();
                        app.apply_login_result(false, Some(&msg));
                    }
                }
                cx.notify();
            })
            .ok();
        })
        .detach();
    }

    fn overlay_logout(&mut self, cx: &mut Context<Self>) {
        let Some(client) = self.client.clone() else {
            return;
        };
        let (ip, mac) = polling::local_net().unwrap_or_default();
        cx.spawn(async move |this, cx| {
            let _ = polling::http(async move { client.logout(&ip, &mac).await }).await;
            let _ = this.update(cx, |app, cx| {
                app.session = None;
                cx.notify();
            });
        })
        .detach();
    }

    /// Modal yang harus digambar di atas layar kiosk (Admin, Power, AFK, Logout).
    fn modal_frames(&self, cx: &mut Context<Self>) -> Vec<AnyElement> {
        let actions = overlay_actions(cx);
        crate::ui::overlay::modals::render(self, &actions)
            .into_iter()
            .collect()
    }

    fn run_power(&mut self, action: PowerAction, cx: &mut Context<Self>) {
        let flag = match action {
            PowerAction::Restart => "/r",
            PowerAction::Shutdown => "/s",
        };
        let _ = std::process::Command::new("shutdown")
            .args([flag, "/f", "/t", "0"])
            .spawn();
        cx.notify();
    }
}

pub fn overlay_actions(cx: &mut Context<TmApp>) -> OverlayActions {
    let me = cx.entity();
    let afk_me = me.clone();
    let out_me = me.clone();
    let tab_me = me.clone();
    let tool_me = me.clone();
    let open_me = me.clone();
    let close_me = me.clone();
    let prev_me = me.clone();
    let next_me = me.clone();
    let pin_me = me.clone();
    let admin_me = me.clone();
    let confirm_me = me.clone();
    let power_me = me.clone();
    let pin_focus_me = me.clone();
    let admin_focus_me = me.clone();
    OverlayActions {
        focus_pin: Rc::new(move |_w: &mut Window, cx: &mut App| {
            pin_focus_me.update(cx, |_, cx| cx.notify());
        }) as ActFn,
        focus_admin: Rc::new(move |field: crate::state::LoginField, _w: &mut Window, cx: &mut App| {
            admin_focus_me.update(cx, |app, cx| {
                app.login.admin_field = field;
                cx.notify();
            });
        }) as crate::ui::overlay::FocusFn,
        power_confirm: Rc::new(move |action: PowerAction, _w: &mut Window, cx: &mut App| {
            power_me.update(cx, |app, cx| {
                app.modal = None;
                app.run_power(action, cx);
            });
        }),
        logout_confirm: Rc::new(move |_w: &mut Window, cx: &mut App| {
            confirm_me.update(cx, |app, cx| {
                app.modal = None;
                app.overlay_logout(cx);
            });
        }) as ActFn,
        open: Rc::new(move |modal: Modal, _w: &mut Window, cx: &mut App| {
            open_me.update(cx, |app, cx| {
                app.modal = Some(modal);
                cx.notify();
            });
        }) as ModalFn,
        close: Rc::new(move |_w: &mut Window, cx: &mut App| {
            close_me.update(cx, |app, cx| {
                app.modal = None;
                cx.notify();
            });
        }) as ActFn,
        page_prev: Rc::new(move |_w: &mut Window, cx: &mut App| {
            prev_me.update(cx, |app, cx| {
                app.menu_page = app.menu_page.saturating_sub(1).max(1);
                cx.notify();
            });
        }) as ActFn,
        page_next: Rc::new(move |_w: &mut Window, cx: &mut App| {
            next_me.update(cx, |app, cx| {
                app.menu_page += 1;
                cx.notify();
            });
        }) as ActFn,
        pin_submit: Rc::new(move |_w: &mut Window, cx: &mut App| {
            pin_me.update(cx, |app, cx| app.submit_pin(cx));
        }) as ActFn,
        admin_submit: Rc::new(move |_w: &mut Window, cx: &mut App| {
            admin_me.update(cx, |app, cx| app.submit_admin(cx));
        }) as ActFn,
        // shortcut: minimize & AFK hanya mengubah state lokal sampai Task 8/10 memasang aksinya
        minimize: Rc::new(move |w: &mut Window, _cx: &mut App| {
            w.minimize_window();
        }) as ActFn,
        afk: Rc::new(move |_w: &mut Window, cx: &mut App| {
            afk_me.update(cx, |app, cx| {
                app.modal = Some(Modal::AfkPin);
                cx.notify();
            });
        }) as ActFn,
        logout: Rc::new(move |_w: &mut Window, cx: &mut App| {
            out_me.update(cx, |app, cx| {
                app.modal = Some(Modal::Logout);
                cx.notify();
            });
        }) as ActFn,
        tab: Rc::new(move |tab: usize, _w: &mut Window, cx: &mut App| {
            tab_me.update(cx, |app, cx| {
                app.overlay_tab = tab;
                cx.notify();
            });
        }) as TabFn,
        tool: Rc::new(move |tool: ToolId, _w: &mut Window, cx: &mut App| {
            tool_me.update(cx, |app, cx| app.run_tool(tool, cx));
        }) as ToolFn,
    }
}

impl TmApp {
    fn run_tool(&mut self, tool: ToolId, cx: &mut Context<Self>) {
        if tool == ToolId::Lock {
            self.locked = true;
            if let Some(client) = self.client.clone() {
                cx.spawn(async move |_this, _cx| {
                    let _ = polling::http(async move { client.afk_lock("", "", None).await }).await;
                })
                .detach();
            }
            cx.notify();
            return;
        }
        if let Some((exe, args)) = crate::ui::overlay::tool_command(tool) {
            let _ = std::process::Command::new(exe).args(args).spawn();
        }
    }

    fn sync_window(&mut self, window: &mut Window) {
        use std::sync::atomic::Ordering;
        let overlay = self.session.is_some() && !self.locked;
        let fullscreen_modal = crate::state::modal_fullscreen(self.view, self.modal);
        state::OVERLAY_MODE.store(overlay, Ordering::Relaxed);
        crate::platform::keyboard::set_enabled(state::hook_should_be_enabled(self.view, self.modal));

        let mode = (overlay, fullscreen_modal, self.overlay_tab);
        if self.applied_mode == Some(mode) {
            return;
        }
        // hide/show hanya saat jenis jendela berubah; perubahan tinggi kartu cukup SetWindowPos
        // hide/show hanya saat pindah kiosk<->overlay; modal penuh cukup resize di tempat
        let mode_switch = match self.applied_mode {
            Some((o, _, _)) => o != overlay,
            None => true,
        };
        self.applied_mode = Some(mode);
        let Some(h) = wm::hwnd(window) else { return };
        wm::strip_frame(h);

        let rect = if overlay && !fullscreen_modal {
            wm::set_taskbar_visibility(true);
            self.saved_rect.take().or_else(|| {
                let m = wm::monitor_rect(h)?;
                let g = overlay_geometry(((m.right - m.left) as f32, (m.bottom - m.top) as f32));
                let m8 = g.margin as i32;
                let hh = g.height + overlay_card_mod::extra_height(self.overlay_tab, g);
                Some((
                    m.right - g.width as i32 - m8,
                    m.top + m8,
                    m.right - m8,
                    m.top + m8 + hh.ceil() as i32,
                ))
            })
        } else {
            if overlay {
                if self.saved_rect.is_none() {
                    self.saved_rect = wm::window_rect(h).map(|r| (r.left, r.top, r.right, r.bottom));
                }
            } else if cfg!(not(debug_assertions)) && !crate::dev_safe() {
                // shortcut: dev builds keep the desktop taskbar, production hides it, restore on drop
                if self.taskbar_guard.is_none() {
                    self.taskbar_guard = Some(wm::TaskbarGuard);
                }
                wm::set_taskbar_visibility(false);
            }
            wm::monitor_rect(h).map(|r| (r.left, r.top, r.right, r.bottom))
        };

        if let Some((l, t, r, b)) = rect {
            // ukuran lewat gpui supaya layout ikut tahu; SetWindowPos langsung membuat area baru putih
            window.resize(gpui_kit::Size::new(px((r - l) as f32), px((b - t) as f32)));
            wm::move_to(h, l, t);
            if mode_switch {
                wm::focus(h);
            }
            window.refresh();
        }
    }
}

fn kiosk_actions(cx: &mut Context<TmApp>) -> KioskActions {
    let me = cx.entity();
    let field_me = me.clone();
    let submit_me = me.clone();
    let power_me = me.clone();
    let qris_me = me.clone();
    let tab_me = me.clone();
    let page_me = me.clone();
    KioskActions {
        field: Rc::new(move |field: LoginField, _w: &mut Window, cx: &mut App| {
            field_me.update(cx, |app, cx| {
                app.login.field = field;
                cx.notify();
            });
        }),
        submit: Rc::new(move |_w: &mut Window, cx: &mut App| {
            submit_me.update(cx, |app, cx| app.submit_login(cx));
        }),
        power: Rc::new(move |action: Option<PowerAction>, _w: &mut Window, cx: &mut App| {
            power_me.update(cx, |app, cx| {
                app.modal = action.map(Modal::Power);
                cx.notify();
            });
        }),
        qris: Rc::new(move |open: bool, _w: &mut Window, cx: &mut App| {
            qris_me.update(cx, |app, cx| {
                app.modal = if open { Some(Modal::QrisFull) } else { None };
                cx.notify();
            });
        }),
        tab: Rc::new(move |tab: usize, _w: &mut Window, cx: &mut App| {
            tab_me.update(cx, |app, cx| {
                app.login.info_tab = tab;
                app.login.info_page = 1;
                cx.notify();
            });
        }),
        page: Rc::new(move |page: usize, _w: &mut Window, cx: &mut App| {
            page_me.update(cx, |app, cx| {
                app.login.info_page = page;
                cx.notify();
            });
        }),
    }
}

impl Render for TmApp {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.close_hooked {
            self.close_hooked = true;
            window.on_window_should_close(cx, |window, _cx| {
                use std::sync::atomic::Ordering;
                if state::close_action(state::OVERLAY_MODE.load(Ordering::Relaxed))
                    == state::CloseAction::Minimize
                {
                    window.minimize_window();
                }
                // kiosk tidak boleh bisa ditutup: permintaan close selalu ditolak
                false
            });
        }

        let handle = self.focus.get_or_insert_with(|| cx.focus_handle()).clone();
        let actions = kiosk_actions(cx);
        window.focus(&handle, cx);
        self.sync_window(window);
        let compact = window.viewport_size().width < px(1400.0);
        let title = self
            .cfg
            .as_ref()
            .and_then(|c| c.title.clone())
            .unwrap_or_else(|| "TMBilling".to_string());
        let pc = self.pc_kode.clone();
        if self.session.is_none() {
            return div()
                .size_full()
                .relative()
                .bg(TM.bg)
                .px(px(if compact { 20.0 } else { 32.0 }))
                .pt(px(if compact { 20.0 } else { 30.0 }))
                .flex()
                .flex_col()
                .gap(px(0.0))
                .track_focus(&handle)
                .capture_key_down(cx.listener(Self::on_key))
                .child(header(&title, &pc, self.shutdown_secs, compact, &actions))
                .child({
                    let stack = if compact {
                        div().flex().flex_col().gap(px(0.0))
                    } else {
                        div().flex().flex_row().gap(px(48.0))
                    };
                    stack
                        .w_full()
                        .mt(px(if compact { 12.0 } else { 206.0 }))
                        .child(login::screen(self, compact, &actions))
                        .child(info::screen(self, compact, &actions))
                })
                .children(self.modal_frames(cx));
        }
        let vp = window.viewport_size();
        let viewport = (f32::from(vp.width), f32::from(vp.height));
        // The window itself is the card here, so the monitor is what decides the size tier.
        let geom = wm::hwnd(window)
            .and_then(wm::monitor_rect)
            .map(|m| overlay_geometry(((m.right - m.left) as f32, (m.bottom - m.top) as f32)))
            .unwrap_or_else(|| overlay_geometry(viewport));
        let actions_ov = overlay_actions(cx);
        let modal = crate::ui::overlay::modals::render(self, &actions_ov);
        div()
            .size_full()
            .relative()
            .bg(TM.bg)
            .flex()
            .items_start()
            .justify_start()
            .child(overlay_card_mod::card(self, geom, &actions_ov))
            .children(modal)
    }
}

/// gpui hanya mengisi `key_char` untuk jalur IME/WM_CHAR; keyboard biasa datang
/// sebagai `key` tunggal, jadi teks jatuh ke situ agar ketikan nyata tetap masuk.
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

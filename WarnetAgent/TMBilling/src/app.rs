use std::rc::Rc;

use crate::api::client::ApiClient;
use crate::polling::{self, AppEvent};
use crate::state::{Alert, LoginField, PowerAction, Session, TmApp};
use crate::theme::TM;
use crate::ui::kiosk::header::header;
use crate::ui::kiosk::{info, login, KioskActions};
use crate::ui::overlay::card as overlay_card_mod;
use crate::ui::overlay::{ActFn, OverlayActions, TabFn};
use crate::platform::window::overlay_geometry;
use gpui_kit::prelude::*;
use gpui_kit::*;

impl TmApp {
    pub fn apply(&mut self, event: AppEvent, cx: &mut Context<Self>) {
        let changed = self.reduce(event);
        let remaining = self.remaining_secs;
        if let Some(alert) = self.alert_for(remaining) {
            crate::audio::play(match alert {
                Alert::Min15 => crate::audio::WARNING_15MIN,
                Alert::Min5 => crate::audio::WARNING_5MIN,
                Alert::Min1 => crate::audio::WARNING_1MIN,
            });
        }
        if changed {
            cx.notify();
        }
    }

    pub fn start(&mut self, cx: &mut Context<Self>) {
        self.login.info_page = 1;
        if self.demo_overlay {
            return;
        }
        // shortcut: tab awal dipaksa lewat env untuk verifikasi visual, dibuang saat dogfood
        if std::env::var("TM_INFO_TAB").ok().as_deref() == Some("1") {
            self.login.info_tab = 1;
        }
        // shortcut: kredensial & base URL dibaca dari config.ini/registry di Task 12
        let base_url = std::env::var("TM_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:7015".into());
        let api_key = std::env::var("TM_CLIENT_KEY").unwrap_or_default();
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
        if !self.login.can_submit() {
            return;
        }
        let Some(client) = self.client.clone() else {
            self.login.error = Some("Belum terhubung ke server.".into());
            cx.notify();
            return;
        };
        self.login.busy = true;
        self.login.error = None;
        let (ip, mac) = polling::local_net().unwrap_or_default();
        let user = self.login.username.trim().to_string();
        let pass = self.login.password.clone();
        cx.notify();
        cx.spawn(async move |this, cx| {
            let res = client.member_login(&ip, &mac, &user, &pass).await;
            this.update(cx, |app, cx| {
                app.login.busy = false;
                match res {
                    Ok(r) if r.success => {
                        app.session = Some(Session {
                            nama: r.nama.unwrap_or_default(),
                            grup: r.grup.unwrap_or_default(),
                            pc_kode: r.pc_kode.unwrap_or_else(|| app.pc_kode.clone()),
                            is_member: true,
                            is_emergency: false,
                        });
                        app.login.password.clear();
                    }
                    Ok(r) => {
                        app.login.error = Some(
                            r.error
                                .unwrap_or_else(|| "Nama pengguna atau password salah.".into()),
                        )
                    }
                    Err(e) => app.login.error = Some(e.to_string()),
                }
                cx.notify();
            })
            .ok();
        })
        .detach();
    }

    fn on_key(&mut self, ev: &KeyDownEvent, _window: &mut Window, cx: &mut Context<Self>) {
        match ev.keystroke.key.as_str() {
            "backspace" => {
                self.login.backspace();
            }
            "tab" => self.login.focus_next(),
            "enter" => self.submit_login(cx),
            _ => {
                if let Some(text) = ev.keystroke.key_char.as_deref() {
                    for ch in text.chars() {
                        self.login.type_char(ch);
                    }
                }
            }
        }
        cx.notify();
    }

    fn overlay_logout(&mut self, cx: &mut Context<Self>) {
        let Some(client) = self.client.clone() else {
            return;
        };
        let (ip, mac) = polling::local_net().unwrap_or_default();
        cx.spawn(async move |this, cx| {
            let _ = client.logout(&ip, &mac).await;
            let _ = this.update(cx, |app, cx| {
                app.session = None;
                cx.notify();
            });
        })
        .detach();
    }

    fn run_power(&mut self, action: PowerAction, cx: &mut Context<Self>) {
        self.login.power = None;
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
    let min_me = me.clone();
    let afk_me = me.clone();
    let out_me = me.clone();
    let tab_me = me.clone();
    OverlayActions {
        // shortcut: minimize & AFK hanya mengubah state lokal sampai Task 8/10 memasang aksinya
        minimize: Rc::new(move |_w: &mut Window, cx: &mut App| {
            min_me.update(cx, |_app, cx| cx.notify());
        }) as ActFn,
        afk: Rc::new(move |_w: &mut Window, cx: &mut App| {
            afk_me.update(cx, |_app, cx| cx.notify());
        }) as ActFn,
        logout: Rc::new(move |_w: &mut Window, cx: &mut App| {
            out_me.update(cx, |app, cx| app.overlay_logout(cx));
        }) as ActFn,
        tab: Rc::new(move |tab: usize, _w: &mut Window, cx: &mut App| {
            tab_me.update(cx, |app, cx| {
                app.overlay_tab = tab;
                cx.notify();
            });
        }) as TabFn,
    }
}

pub fn kiosk_actions(cx: &mut Context<TmApp>) -> KioskActions {
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
            power_me.update(cx, |app, cx| match action {
                None => {
                    app.login.power = None;
                    cx.notify();
                }
                Some(action) if app.login.power.is_none() => {
                    app.login.power = Some(action);
                    cx.notify();
                }
                Some(action) => app.run_power(action, cx),
            });
        }),
        qris: Rc::new(move |open: bool, _w: &mut Window, cx: &mut App| {
            qris_me.update(cx, |app, cx| {
                app.login.qris_full = open;
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
        let handle = self.focus.get_or_insert_with(|| cx.focus_handle()).clone();
        let actions = kiosk_actions(cx);
        window.focus(&handle, cx);
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
                .bg(TM.bg)
                .px(px(if compact { 20.0 } else { 32.0 }))
                .pt(px(if compact { 20.0 } else { 30.0 }))
                .flex()
                .flex_col()
                .gap(px(0.0))
                .track_focus(&handle)
                .on_key_down(cx.listener(Self::on_key))
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
                });
        }
        let vw: f32 = window.viewport_size().width.into();
        let vh: f32 = window.viewport_size().height.into();
        let geom = overlay_geometry((vw, vh));
        let actions_ov = overlay_actions(cx);
        div()
            .size_full()
            .bg(TM.bg)
            .flex()
            .items_start()
            .justify_end()
            .pt(px(geom.margin))
            .pr(px(geom.margin))
            .child(overlay_card_mod::card(self, geom, &actions_ov))
    }
}


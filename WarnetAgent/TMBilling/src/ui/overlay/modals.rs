use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::state::{Modal, TmApp};
use crate::theme::{c, TM};
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::input::TmInput;
use crate::ui::kiosk::login::qr_image;
use crate::ui::overlay::OverlayActions;
use crate::ui::tabs::TmTabs;

/// Penghubung ActFn (tanpa ClickEvent) ke handler gpui.
fn click(f: crate::ui::overlay::ActFn) -> impl Fn(&ClickEvent, &mut Window, &mut App) + 'static {
    move |_: &ClickEvent, window, cx| f(window, cx)
}

fn text(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(str::to_string)
}

pub fn rupiah(n: i64) -> String {
    let digits = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i).is_multiple_of(3) {
            out.push('.');
        }
        out.push(ch);
    }
    format!("Rp {out}")
}

fn row(label: &'static str, value: impl IntoElement) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .justify_between()
        .h(px(30.0))
        .border_b_1()
        .border_color(c(0x1C1C1C))
        .child(div().text_size(px(11.0)).text_color(TM.muted).child(label))
        .child(value)
}

fn value_text(v: String, tone: Rgba, mono: bool) -> impl IntoElement {
    let mut el = div().text_size(px(12.0)).text_color(tone).child(v);
    if mono {
        el = el.font_family("Consolas");
    }
    el
}

fn scrim(inner: impl IntoElement + 'static) -> AnyElement {
    div()
        .absolute()
        .top(px(0.0))
        .left(px(0.0))
        .w_full()
        .h_full()
        .flex()
        .items_center()
        .justify_center()
        .bg(c(0x000000))
        .child(inner)
        .into_any_element()
}

fn dialog(width: f32, title: &'static str, body: AnyElement, footer: AnyElement) -> AnyElement {
    div()
        .flex()
        .flex_col()
        .w(px(width))
        .rounded(px(TM.radius_lg))
        .bg(TM.card)
        .border_1()
        .border_color(TM.border)
        .child(
            div()
                .px(px(16.0))
                .h(px(46.0))
                .flex()
                .items_center()
                .text_size(px(13.0))
                .text_color(TM.text)
                .child(title),
        )
        .child(div().h(px(1.0)).w_full().bg(TM.border))
        .child(div().px(px(16.0)).py(px(10.0)).child(body))
        .child(div().h(px(1.0)).w_full().bg(TM.border))
        .child(
            div()
                .px(px(16.0))
                .h(px(56.0))
                .flex()
                .items_center()
                .child(footer),
        )
        .into_any_element()
}

fn footer(actions_list: Vec<AnyElement>) -> AnyElement {
    let mut el = div().flex().flex_row().w_full().justify_end().gap(px(8.0));
    for a in actions_list {
        el = el.child(a);
    }
    el.into_any_element()
}

fn member(app: &TmApp, actions: &OverlayActions) -> AnyElement {
    let Some(session) = app.session.as_ref() else {
        return scoped_close(actions);
    };
    let member = app.member_json.clone().unwrap_or(serde_json::Value::Null);
    let username = text(&member, "username").unwrap_or_else(|| "-".into());
    let nama = session.nama.clone();
    let grup = session.grup.to_uppercase();
    let saldo = match text(&member, "saldo_menit").and_then(|v| v.parse::<i64>().ok()) {
        Some(m) if m >= 60 => format!("{} Jam ({} Menit)", m / 60, m),
        Some(m) => format!("{m} Menit"),
        None => "-".into(),
    };
    let berlaku = text(&member, "kadaluarsa_pada_display")
        .or_else(|| text(&member, "kadaluarsa_pada"))
        .unwrap_or_else(|| "Tidak Terbatas".into());
    let daftar = text(&member, "dibuat_pada_display")
        .or_else(|| text(&member, "dibuat_pada"))
        .unwrap_or_else(|| "-".into());
    let hp = text(&member, "no_hp").unwrap_or_else(|| "-".into());
    let email = text(&member, "email").unwrap_or_else(|| "-".into());

    let body = div()
        .flex()
        .flex_col()
        .child(
            div()
                .flex()
                .items_center()
                .gap(px(8.0))
                .pb(px(10.0))
                .child(div().text_size(px(16.0)).text_color(TM.text).child(nama))
                .child(
                    div()
                        .text_size(px(16.0))
                        .text_color(TM.accent)
                        .child(if grup.is_empty() { "-".to_string() } else { grup.clone() }),
                ),
        )
        .child(div().text_size(px(11.0)).text_color(TM.dim).child(format!("@{username}")))
        .child(div().h(px(10.0)))
        .child(row("Grup Ruangan", value_text(grup, TM.text, false)))
        .child(row(
            "Total Sisa Waktu",
            value_text(saldo, TM.accent, true),
        ))
        .child(row("Masa Aktif: Berlaku s/d", value_text(berlaku, TM.text, true)))
        .child(row("No. WhatsApp / HP", value_text(hp, TM.text, false)))
        .child(row("Email", value_text(email, TM.text, false)))
        .child(row("Terdaftar Sejak", value_text(daftar, TM.muted, false)))
        .child(row(
            "Status Keanggotaan",
            value_text("Aktif".into(), TM.accent, false),
        ))
        .into_any_element();

    dialog(
        360.0,
        "Status Member",
        body,
        footer(vec![TmButton::new("Selesai", ButtonTone::Primary)
            .on_click(click(actions.close.clone()))
            .render()
            .into_any_element()]),
    )
}

fn scoped_close(actions: &OverlayActions) -> AnyElement {
    dialog(
        360.0,
        "Status Member",
        div()
            .h(px(80.0))
            .flex()
            .items_center()
            .child(div().text_size(px(12.0)).text_color(TM.muted).child("Bukan sesi member."))
            .into_any_element(),
        footer(vec![TmButton::new("Selesai", ButtonTone::Primary)
            .on_click(click(actions.close.clone()))
            .render()
            .into_any_element()]),
    )
}

fn menu(app: &TmApp, actions: &OverlayActions) -> AnyElement {
    let items = app.cfg.as_ref().map(|c| c.menu.clone()).unwrap_or_default();
    let per_page = 3usize;
    let total = crate::state::page_count(items.len(), per_page);
    let page = app.menu_page.clamp(1, total);
    let start = (page - 1) * per_page;
    let mut list = div().flex().flex_col();
    for (offset, item) in items.iter().skip(start).take(per_page).enumerate() {
        let index = start + offset;
        let nama = text(item, "nama").unwrap_or_else(|| "-".into());
        let harga = item.get("harga").and_then(|v| v.as_i64()).unwrap_or(0);
        let open = actions.open.clone();
        list = list.child(
            div()
                .id(("menu-row", index))
                .flex()
                .items_center()
                .justify_between()
                .h(px(44.0))
                .px(px(6.0))
                .rounded(px(TM.radius_md))
                .cursor_pointer()
                .hover(|s| s.bg(TM.hover))
                .on_click(move |_: &ClickEvent, window, cx| open(Modal::Detail(index), window, cx))
                .child(div().text_size(px(12.0)).text_color(TM.text).child(nama))
                .child(
                    div()
                        .text_size(px(12.0))
                        .text_color(TM.accent)
                        .font_family("Consolas")
                        .child(rupiah(harga)),
                ),
        );
    }
    if items.is_empty() {
        list = list.child(
            div()
                .h(px(88.0))
                .flex()
                .items_center()
                .child(div().text_size(px(12.0)).text_color(TM.dim).child("Belum ada menu aktif.")),
        );
    }

    let body = div()
        .flex()
        .flex_col()
        .child(
            div()
                .flex()
                .flex_col()
                .w(px(360.0))
                .child(
                    TmTabs::new(vec!["Menu".to_string(), "Paket".to_string()], 0usize)
                        .item_width(80.0)
                        .text_size(12.0)
                        .render(),
                )
                .child(div().h(px(8.0))),
        )
        .child(list)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .h(px(28.0))
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(TM.dim)
                        .child("Pesan langsung ke kasir."),
                )
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(TM.muted)
                        .font_family("Consolas")
                        .child(format!("{page} / {total}")),
                ),
        )
        .into_any_element();

    dialog(
        420.0,
        "Periksa Menu",
        body,
        footer(vec![
            pager_button("<", actions.page_prev.clone()),
            pager_button(">", actions.page_next.clone()),
            tm_button("Tutup", actions.close.clone()),
        ]),
    )
}

fn pager_button(label: &'static str, on_click: crate::ui::overlay::ActFn) -> AnyElement {
    TmButton::new(label, ButtonTone::Ghost)
        .width(32.0)
        .height(32.0)
        .on_click(click(on_click))
        .render()
        .into_any_element()
}

fn tm_button(label: &'static str, on_click: crate::ui::overlay::ActFn) -> AnyElement {
    TmButton::new(label, ButtonTone::Ghost)
        .on_click(click(on_click))
        .render()
        .into_any_element()
}

fn detail(app: &TmApp, actions: &OverlayActions, index: usize) -> AnyElement {
    let items = app.cfg.as_ref().map(|c| c.menu.clone()).unwrap_or_default();
    let item = items.get(index);
    let nama = item.and_then(|i| text(i, "nama")).unwrap_or_else(|| "-".into());
    let harga = item.and_then(|i| i.get("harga")).and_then(|v| v.as_i64()).unwrap_or(0);
    let stok = item.and_then(|i| i.get("stok")).and_then(|v| v.as_i64());

    let mut body = div()
        .flex()
        .flex_col()
        .items_center()
        .child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .w(px(120.0))
                .h(px(120.0))
                .rounded(px(TM.radius_md))
                .bg(TM.surface)
                .border_1()
                .border_color(TM.border)
                .child(
                    div()
                        .w(px(34.0))
                        .h(px(24.0))
                        .rounded(px(3.0))
                        .border_1()
                        .border_color(TM.border_strong),
                ),
        )
        .child(div().h(px(10.0)))
        .child(div().text_size(px(13.0)).text_color(TM.text).child(nama))
        .child(
            div()
                .text_size(px(13.0))
                .text_color(TM.accent)
                .font_family("Consolas")
                .child(rupiah(harga)),
        );
    if let Some(stok) = stok {
        body = body.child(
            div()
                .pt(px(6.0))
                .text_size(px(11.0))
                .text_color(TM.muted)
                .child(format!("Sisa stok: {stok}")),
        );
    }

    dialog(
        360.0,
        "Detail Menu",
        body.into_any_element(),
        footer(vec![tm_button("Kembali", actions.close.clone())]),
    )
}

fn qris_full(app: &TmApp, actions: &OverlayActions) -> AnyElement {
    div()
        .absolute()
        .top(px(0.0))
        .left(px(0.0))
        .w_full()
        .h_full()
        .flex()
        .flex_col()
        .items_center()
        .justify_center()
        .bg(c(0x050505))
        .id("qris-full")
        .cursor_pointer()
        .on_click({
            let close = actions.close.clone();
            move |_: &ClickEvent, window, cx| close(window, cx)
        })
        .child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .w(px(420.0))
                .h(px(420.0))
                .child(qr_tile_block(app, 400.0)),
        )
        .child(
            div()
                .mt(px(12.0))
                .text_size(px(11.0))
                .text_color(TM.dim)
                .child("Ketuk di mana saja untuk menutup"),
        )
        .into_any_element()
}

fn qr_tile_block(app: &TmApp, size: f32) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .justify_center()
        .w(px(size))
        .h(px(size))
        .bg(c(0xFFFFFF))
        .child(qr_image(app, size - 24.0))
}

fn afk_pin(app: &TmApp, actions: &OverlayActions) -> AnyElement {
    let hint = if app.pin.chars().count() >= 4 {
        String::new()
    } else {
        "PIN minimal 4 karakter!".to_string()
    };
    let body = div()
        .flex()
        .flex_col()
        .child(
            div()
                .text_size(px(12.0))
                .text_color(TM.muted)
                .child("Masukkan PIN untuk mengunci meja."),
        )
        .child(div().h(px(10.0)))
        .child(match app.pin.is_empty() {
            true => TmInput::new("Buat PIN / Password").height(40.0).focused(true).render().into_any_element(),
            false => TmInput::new("Buat PIN / Password")
                .value(app.pin.clone())
                .height(40.0)
                .focused(true)
                .render()
                .into_any_element(),
        })
        .child(
            div()
                .pt(px(6.0))
                .text_size(px(10.0))
                .text_color(TM.danger)
                .child(hint),
        )
        .into_any_element();

    dialog(
        360.0,
        "Kunci Meja",
        body,
        footer(vec![
            tm_button("Batal", actions.close.clone()),
            TmButton::new("Kunci Meja", ButtonTone::Warn)
                .on_click(click(actions.pin_submit.clone()))
                .render()
                .into_any_element(),
        ]),
    )
}

fn logout(actions: &OverlayActions) -> AnyElement {
    dialog(
        380.0,
        "Selesai Bermain",
        div()
            .text_size(px(12.0))
            .text_color(TM.muted)
            .child("Sisa waktu member tetap tersimpan di akun. Sesi guest berakhir dan sisa waktunya hangus.")
            .into_any_element(),
        footer(vec![
            tm_button("Batal", actions.close.clone()),
            TmButton::new("Logout", ButtonTone::Danger)
                .on_click(click(actions.logout_confirm.clone()))
                .render()
                .into_any_element(),
        ]),
    )
}

fn admin(app: &TmApp, actions: &OverlayActions) -> AnyElement {
    let username = app.login.username.clone();
    let password = app.login.masked_password();
    let error = app.login.error.clone().unwrap_or_default();
    let body = div()
        .flex()
        .flex_col()
        .gap(px(8.0))
        .child(
            TmInput::new("Username")
                .value(username)
                .height(38.0)
                .focused(app.login.field == crate::state::LoginField::Username)
                .render(),
        )
        .child(
            TmInput::new("Password")
                .value(password)
                .height(38.0)
                .focused(app.login.field == crate::state::LoginField::Password)
                .render(),
        )
        .child(
            div()
                .text_size(px(10.0))
                .text_color(TM.danger)
                .child(error),
        )
        .into_any_element();

    dialog(
        360.0,
        "Login Admin",
        body,
        footer(vec![
            tm_button("Batal", actions.close.clone()),
            TmButton::new("Masuk", ButtonTone::Primary)
                .on_click(click(actions.admin_submit.clone()))
                .render()
                .into_any_element(),
        ]),
    )
}

pub fn render(app: &TmApp, actions: &OverlayActions) -> Option<AnyElement> {
    let modal = app.modal?;
    Some(match modal {
        Modal::Member => scrim(member(app, actions)),
        Modal::Menu => scrim(menu(app, actions)),
        Modal::Detail(index) => scrim(detail(app, actions, index)),
        Modal::QrisFull => qris_full(app, actions),
        Modal::AfkPin => scrim(afk_pin(app, actions)),
        Modal::Logout => scrim(logout(actions)),
        Modal::Admin => scrim(admin(app, actions)),
    })
}

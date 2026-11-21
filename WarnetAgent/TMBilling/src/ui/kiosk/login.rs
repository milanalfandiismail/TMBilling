use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::state::{LoginField, TmApp};
use crate::theme::{c, TM};
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::kiosk::KioskActions;

fn card() -> Div {
    div()
        .rounded(px(TM.radius_xl))
        .bg(TM.card)
        .border_1()
        .border_color(TM.border)
}

fn label(text: &'static str) -> impl IntoElement {
    div().text_size(px(12.0)).text_color(TM.muted).child(text)
}

fn field(
    id: &'static str,
    placeholder: &'static str,
    app: &TmApp,
    kind: LoginField,
    height: f32,
    width: f32,
    actions: &KioskActions,
) -> impl IntoElement {
    let focused = app.login.field == kind;
    let value = match kind {
        LoginField::Username => app.login.username.clone(),
        LoginField::Password => app.login.masked_password(),
    };
    let on_click = actions.field.clone();
    div()
        .id(id)
        .flex_shrink_0()
        .w(px(width))
        .h(px(height))
        .px(px(12.0))
        .flex()
        .items_center()
        .rounded(px(TM.radius_md))
        .bg(TM.card)
        .border_1()
        .border_color(if focused { TM.accent } else { TM.border })
        .cursor_pointer()
        .on_click(move |_, window, cx| on_click(kind, window, cx))
        .child(
            div()
                .flex()
                .items_center()
                .when(focused && value.is_empty(), |d| {
                    d.child(crate::ui::input::caret(app.caret_on))
                })
                .child(
                    div()
                        .text_size(px(13.0))
                        .text_color(if value.is_empty() { TM.dim } else { TM.text })
                        .child(value.clone()),
                )
                .when(value.is_empty(), |d| {
                    d.child(div().text_size(px(13.0)).text_color(TM.dim).child(placeholder))
                })
                .when(focused && !value.is_empty(), |d| {
                    d.child(crate::ui::input::caret(app.caret_on))
                }),
        )
}

/// Tile QR tiruan: matriks 21x21 tetap, diganti QR asli di Task 12.
const QR_MOCK: [&str; 21] = [
    "#######.##.#..#######",
    "#.....#.##.##.#.....#",
    "#.###.#.###.#.#.###.#",
    "#.###.#.#...#.#.###.#",
    "#.###.#..#.##.#.###.#",
    "#.....#.##.#..#.....#",
    "#######.#.#.#.#######",
    ".........#.##........",
    "#.##..##..#....#.##.#",
    ".#.....#........#....",
    "##.#.####.###.##....#",
    "##..##.##..####......",
    "#....####.###########",
    "..........#####....##",
    "#######.##.##..#.#...",
    "#.....#..###...##....",
    "#.###.#...#.#####..#.",
    "#.###.#...#####......",
    "#.###.#.#.....#.#..##",
    "#.....#...###..#...#.",
    "#######.##....#..####",
];

pub(crate) fn qr_tile(size: f32) -> impl IntoElement {
    let unit = ((size / 21.0) * 2.0).floor() / 2.0;
    let mut tile = div().w(px(size)).h(px(size)).flex_shrink_0().flex().flex_col();
    for line in QR_MOCK {
        let mut row = div().flex().flex_row().flex_shrink_0();
        for ch in line.chars() {
            row = row.child(
                div()
                    .flex_shrink_0()
                    .w(px(unit))
                    .h(px(unit))
                    .bg(if ch == '#' { rgb(0x0A0A0A) } else { rgb(0xFFFFFF) }),
            );
        }
        tile = tile.child(row);
    }
    tile
}

fn qr_tap(app: &TmApp, size: f32, actions: &KioskActions) -> AnyElement {
    let open = actions.qris.clone();
    div()
        .id("kiosk-qris")
        .cursor_pointer()
        .on_click(move |_, w, cx| open(true, w, cx))
        .child(qr_image(app, size))
        .into_any_element()
}

pub(crate) fn qr_image(app: &TmApp, size: f32) -> impl IntoElement {
    match &app.qris_image {
        Some(image) => div()
            .w(px(size))
            .h(px(size))
            .flex_shrink_0()
            .child(img(image.clone()).w(px(size)).h(px(size)).object_fit(ObjectFit::Contain))
            .into_any_element(),
        None => qr_tile(size).into_any_element(),
    }
}

fn qris_block(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    let caption = 10.0;
    let on_click = actions.qris.clone();
    let mut block = if compact {
        div().flex().flex_shrink_0().flex_row().items_start()
    } else {
        div()
            .flex()
            .flex_col()
            .flex_shrink_0()
            .items_center()
            .px(px(33.0))
            .pt(px(30.0))
            .rounded(px(TM.radius_xl))
            .border_1()
            .border_color(TM.border)
    };
    if compact {
        let tile = div()
            .flex_shrink_0()
            .w(px(96.0))
            .h(px(96.0))
            .p(px(6.0))
            .rounded(px(2.0))
            .bg(rgb(0xFFFFFF))
            .child(qr_tap(app, 84.0, actions));
        block = block
            .w(px(404.0))
            .h(px(200.0))
            .p(px(20.0))
            .bg(TM.surface)
            .rounded(px(TM.radius_xl))
            .border_1()
            .border_color(TM.border)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_shrink_0()
                    .child(tile)
                    .child(
                        div()
                            .mt(px(10.0))
                            .w(px(96.0))
                            .text_size(px(caption))
                            .text_color(TM.dim)
                            .line_height(px(13.0))
                            .child("Ketuk QR untuk memperbesar"),
                    ),
            )
            .child(
                div()
                    .ml(px(16.0))
                    .flex()
                    .flex_col()
                    .child(div().text_size(px(17.0)).line_height(px(20.0)).text_color(TM.text).child("Scan QRIS"))
                    .child(
                        div()
                            .mt(px(12.0))
                            .text_size(px(12.0))
                            .text_color(TM.muted)
                            .child("Tunjukkan bukti pembayaran ke kasir."),
                    )
                    .child(
                        div()
                            .mt(px(20.0))
                            .text_size(px(12.0))
                            .text_color(TM.muted)
                            .child("Sesi dibuka oleh kasir."),
                    ),
            );
        return div().child(block.mt(px(19.0)));
    }
    block = block
        .w(px(449.0))
        .h(px(423.0))
        .child(
            div()
                .w_full()
                .child(div().text_size(px(11.0)).text_color(TM.dim).child("BAYAR DI KASIR")),
        )
        .child(
            div()
                .w_full()
                .mt(px(3.0))
                .child(div().text_size(px(28.0)).text_color(TM.text).child("Scan QRIS")),
        )
        .child(div().mt(px(5.0)).child(qr_tap(app, 200.0, actions)))
        .child(
            div()
                .mt(px(6.0))
                .text_size(px(caption))
                .text_color(TM.dim)
                .child("Ketuk QR untuk memperbesar"),
        )
        .child(
            div()
                .w_full()
                .mt(px(20.0))
                .text_size(px(12.0))
                .text_color(TM.muted)
                .line_height(px(18.0))
                .child("Tunjukkan bukti pembayaran ke kasir. Sesi dibuka oleh kasir."),
        )
        .child(
            div()
                .w_full()
                .mt(px(18.0))
                .text_size(px(12.0))
                .text_color(TM.muted)
                .line_height(px(18.0))
                .child("Belum punya akun? Minta kasir membuatkan sesi."),
        );
    let clickable = div()
        .id("qris-tile")
        .cursor_pointer()
        .on_click(move |_, window, cx| on_click(true, window, cx))
        .child(block);
    div().child(clickable)
}

/// Banner galat login (figcraft kiosk/login-error).
fn error_banner(msg: &str) -> impl IntoElement {
    div()
        .mt(px(12.0))
        .w_full()
        .px(px(12.0))
        .py(px(9.0))
        .rounded(px(TM.radius_sm))
        .bg(c(0x2A1414))
        .border_1()
        .border_color(TM.danger)
        .text_size(px(12.0))
        .text_color(TM.danger)
        .child(msg.to_string())
}

fn form(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    if compact {
        let submit = actions.submit.clone();
        let mut col = div().flex().flex_col().flex_shrink_0().w(px(350.0));
        col = col
            .child(
                div()
                    .text_size(px(24.0))
                    .line_height(px(26.0))
                    .text_color(TM.text)
                    .child("Masuk untuk bermain"),
            )
            .child(
                div().mt(px(18.0)).child(field(
                    "kiosk-username",
                    "Username",
                    app,
                    LoginField::Username,
                    40.0,
                    350.0,
                    actions,
                )),
            )
            .child(
                div().mt(px(16.0)).child(field(
                    "kiosk-password",
                    "Password",
                    app,
                    LoginField::Password,
                    40.0,
                    350.0,
                    actions,
                )),
            )
            .children(app.login.error.as_deref().map(error_banner))
            .child(
                div().mt(px(24.0)).child(
                    TmButton::new("Masuk", ButtonTone::Primary)
                        .height(48.0)
                        .width(350.0)
                        .id_prefix("kiosk-masuk")
                        .on_click(move |_, window, cx| submit(window, cx))
                        .render(),
                ),
            )
            .child(
                div()
                    .mt(px(22.0))
                    .text_size(px(11.0))
                    .text_color(TM.dim)
                    .child("Belum punya akun? Hubungi kasir."),
            );
        return col;
    }
    let (w, ih, bh) = (440.0, 40.0, 56.0);
    let submit = actions.submit.clone();
    let mut col = div().flex().flex_col().flex_shrink_0().w(px(w));
    col = col
        .child(div().text_size(px(11.0)).text_color(TM.dim).child("SELAMAT DATANG"))
        .child(
            div()
                .mt(px(if compact { 6.0 } else { 5.0 }))
                .text_size(px(if compact { 24.0 } else { 30.0 }))
                .text_color(TM.text)
                .child("Masuk untuk bermain"),
        )
        .child(div().mt(px(if compact { 12.0 } else { 35.0 })).child(label("Username")))
        .child(
            div()
                .mt(px(if compact { 4.0 } else { 6.0 }))
                .child(field("kiosk-username", "Masukkan username", app, LoginField::Username, ih, w, actions)),
        )
        .child(div().mt(px(if compact { 10.0 } else { 21.0 })).child(label("Password")))
        .child(
            div()
                .mt(px(if compact { 4.0 } else { 6.0 }))
                .child(field("kiosk-password", "********", app, LoginField::Password, ih, w, actions)),
        )
        .children(app.login.error.as_deref().map(error_banner))
        .child(
            div().mt(px(if compact { 12.0 } else { 22.0 })).child(
                TmButton::new("Masuk", ButtonTone::Primary)
                    .height(bh)
                    .width(w)
                    .id_prefix("kiosk-masuk")
                    .on_click(move |_, window, cx| submit(window, cx))
                    .render(),
            ),
        )
        .child(
            div()
                .mt(px(if compact { 8.0 } else { 22.0 }))
                .text_size(px(11.0))
                .text_color(TM.dim)
                .child("Belum punya akun? Hubungi kasir."),
        );
    col
}

fn hero(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    if compact {
        return card()
            .flex_shrink_0()
            .w_full()
            .h(px(300.0))
            .p(px(20.0))
            .flex()
            .flex_row()
            .items_start()
            .justify_between()
            .child(form(app, true, actions))
            .child(qris_block(app, true, actions));
    }
    card()
        .w(px(1055.0))
        .h(px(559.0))
        .pt(px(29.0))
        .pl(px(32.0))
        .pr(px(6.0))
        .flex()
        .flex_row()
        .justify_between()
        .child(
            div()
                .flex()
                .flex_col()
                .h_full()
                .child(form(app, false, actions))
                .child(div().flex_1())
                .child(
                    div()
                        .text_size(px(10.0))
                        .text_color(TM.dim)
                        .child(format!("TMBilling v2.0 · {}", version_suffix(app))),
                )
                .child(div().h(px(48.0))),
        )
        .child(qris_block(app, false, actions))
}

fn version_suffix(app: &TmApp) -> String {
    if app.pc_kode.is_empty() {
        "PC".to_string()
    } else {
        app.pc_kode.clone()
    }
}

pub fn screen(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    hero(app, compact, actions)
}
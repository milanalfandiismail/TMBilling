use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::state::TmApp;
use crate::theme::TM;
use crate::ui::kiosk::login::qr_image;
use crate::ui::overlay::{OverlayActions, ToolId};

/// Tinggi panel dari export FigCraft: tools 380x196, qris 380x248.
pub const TOOLS_H: f32 = 196.0;
pub const QRIS_H: f32 = 248.0;

/// Ikon digambar dari div: font emoji Windows selalu jatuh ke versi berwarna.
fn icon(id: ToolId, scale: f32, color: Rgba) -> AnyElement {
    let bar = |w: f32, h: f32| div().w(px(w * scale)).h(px(h * scale)).rounded(px(1.0)).bg(color);
    match id {
        ToolId::Lock => div()
            .flex()
            .flex_col()
            .items_center()
            .child(
                div()
                    .w(px(9.0 * scale))
                    .h(px(6.0 * scale))
                    .border_1()
                    .border_color(color)
                    .rounded_t(px(5.0 * scale)),
            )
            .child(
                div()
                    .mt(px(1.0))
                    .w(px(13.0 * scale))
                    .h(px(8.0 * scale))
                    .rounded(px(2.0))
                    .border_1()
                    .border_color(color),
            )
            .into_any_element(),
        ToolId::Volume => div()
            .flex()
            .flex_row()
            .items_end()
            .gap(px(2.0 * scale))
            .child(bar(2.0, 5.0))
            .child(bar(2.0, 9.0))
            .child(bar(2.0, 13.0))
            .into_any_element(),
        ToolId::Mouse => div()
            .flex()
            .flex_col()
            .items_center()
            .w(px(10.0 * scale))
            .h(px(15.0 * scale))
            .rounded(px(5.0 * scale))
            .border_1()
            .border_color(color)
            .child(div().mt(px(3.0)).w(px(1.0)).h(px(3.0 * scale)).bg(color))
            .into_any_element(),
        ToolId::Keyboard => div()
            .flex()
            .flex_col()
            .justify_center()
            .gap(px(2.0 * scale))
            .w(px(16.0 * scale))
            .h(px(11.0 * scale))
            .px(px(2.0 * scale))
            .rounded(px(2.0))
            .border_1()
            .border_color(color)
            .child(
                div()
                    .flex()
                    .flex_row()
                    .gap(px(2.0 * scale))
                    .child(bar(2.0, 1.0))
                    .child(bar(2.0, 1.0))
                    .child(bar(2.0, 1.0)),
            )
            .child(bar(8.0, 1.0))
            .into_any_element(),
        ToolId::Menu => div()
            .flex()
            .flex_col()
            .justify_center()
            .gap(px(2.5 * scale))
            .w(px(13.0 * scale))
            .h(px(12.0 * scale))
            .child(bar(13.0, 1.5))
            .child(bar(9.0, 1.5))
            .child(bar(13.0, 1.5))
            .into_any_element(),
        ToolId::Paket => div()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .w(px(13.0 * scale))
            .h(px(12.0 * scale))
            .rounded(px(2.0))
            .border_1()
            .border_color(color)
            .child(
                div()
                    .w_full()
                    .h(px(1.0))
                    .bg(color),
            )
            .into_any_element(),
    }
}

fn tile_size(scale: f32) -> (f32, f32) {
    (111.0 * scale, 68.0 * scale)
}

fn tool_tile(
    id: ToolId,
    label: &'static str,
    scale: f32,
    active: bool,
    actions: &OverlayActions,
) -> impl IntoElement {
    let (w, h) = tile_size(scale);
    let on_click = actions.tool.clone();
    let border = if active { TM.accent } else { TM.border };
    div()
        .id(("tool", id as usize))
        .flex()
        .flex_col()
        .items_center()
        .justify_center()
        .gap(px(4.0 * scale))
        .w(px(w))
        .h(px(h))
        .rounded(px(6.0 * scale))
        .border_1()
        .border_color(border)
        .cursor_pointer()
        .on_click(move |_, window, cx| on_click(id, window, cx))
        .child(icon(id, scale, if active { TM.accent } else { TM.muted }))
        .child(
            div()
                .text_size(px(11.0 * scale))
                .text_color(TM.dim)
                .child(label),
        )
}

pub fn tools(app: &TmApp, scale: f32, actions: &OverlayActions) -> impl IntoElement {
    div()
        .flex()
        .flex_col()
        .child(
            div()
                .text_size(px(11.0 * scale))
                .text_color(TM.text)
                .font_weight(FontWeight::BOLD)
                .child("Alat cepat"),
        )
        .child(
            div()
                .mt(px(12.0 * scale))
                .flex()
                .flex_col()
                .gap(px(9.0 * scale))
                .child(
                    div()
                        .flex()
                        .flex_row()
                        .gap(px(9.0 * scale))
                        .child(tool_tile(ToolId::Lock, "Lock", scale, app.is_afk, actions))
                        .child(tool_tile(ToolId::Volume, "Volume", scale, false, actions))
                        .child(tool_tile(ToolId::Mouse, "Mouse", scale, false, actions)),
                )
                .child(
                    div()
                        .flex()
                        .flex_row()
                        .gap(px(9.0 * scale))
                        .child(tool_tile(ToolId::Keyboard, "Keyboard", scale, false, actions))
                        .child(tool_tile(ToolId::Menu, "Menu", scale, false, actions))
                        .child(tool_tile(ToolId::Paket, "Paket", scale, false, actions)),
                ),
        )
}

pub fn qris(app: &TmApp, scale: f32, actions: &OverlayActions) -> impl IntoElement {
    let size = 160.0 * scale;
    div()
        .flex()
        .flex_col()
        .items_center()
        .child(
            div()
                .w_full()
                .text_size(px(11.0 * scale))
                .text_color(TM.text)
                .font_weight(FontWeight::BOLD)
                .child("Bayar di kasir"),
        )
        .child({
            let open = actions.open.clone();
            div()
                .id("qris-tap")
                .mt(px(16.0 * scale))
                .p(px(8.0 * scale))
                .rounded(px(4.0 * scale))
                .bg(rgb(0xFFFFFF))
                .cursor_pointer()
                .on_click(move |_: &ClickEvent, _w: &mut Window, cx: &mut App| {
                    open(crate::state::Modal::QrisFull, _w, cx)
                })
                .child(qr_image(app, size))
        })
        .child(
            div()
                .mt(px(14.0 * scale))
                .text_size(px(11.0 * scale))
                .text_color(TM.dim)
                .child("Tunjukkan bukti pembayaran"),
        )
}

pub const SESI_CELL_H: f32 = 27.0;
pub const SESI_ROW_GAP: f32 = 6.0;

/// Tinggi tambahan grid member (3 baris) di tab Sesi, di luar baris Mulai yang sudah dihitung di tinggi dasar kartu.
pub fn sesi_extra(is_member: bool) -> f32 {
    if is_member {
        3.0 * SESI_CELL_H + 3.0 * SESI_ROW_GAP
    } else {
        0.0
    }
}

fn cell(label: &'static str, value: String, scale: f32, color: Rgba) -> AnyElement {
    div()
        .flex()
        .flex_col()
        .flex_1()
        .min_w(px(0.0))
        .child(div().text_size(px(9.0 * scale)).text_color(TM.dim).child(label))
        .child(
            div()
                .h(px(15.0 * scale))
                .overflow_hidden()
                .text_size(px(11.0 * scale))
                .text_color(color)
                .child(value),
        )
        .into_any_element()
}

/// Baris Mulai + grid member. Tinggi grid harus sama dengan sesi_extra.
pub fn sesi(app: &TmApp, scale: f32) -> AnyElement {
    let Some(session) = app.session.as_ref() else {
        return div().into_any_element();
    };
    let mulai = app.started_at.clone().unwrap_or_else(|| "--:--".to_string());
    let head = div()
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        .child(div().text_size(px(11.0 * scale)).text_color(TM.dim).child("Mulai"))
        .child(div().text_size(px(11.0 * scale)).text_color(TM.text).child(mulai));
    if !session.is_member {
        return head.into_any_element();
    }
    let f = |k: &str| app.member_field(k).unwrap_or_else(|| "-".into());
    let grup = session.grup.to_uppercase();
    let pair = |a: AnyElement, b: AnyElement| {
        div()
            .flex()
            .flex_row()
            .gap(px(8.0 * scale))
            .child(a)
            .child(b)
            .into_any_element()
    };
    let grid = div()
        .mt(px(SESI_ROW_GAP * scale))
        .flex()
        .flex_col()
        .gap(px(SESI_ROW_GAP * scale))
        .child(pair(
            cell(
                "Nama",
                app.member_field("nama_lengkap")
                    .unwrap_or_else(|| session.nama.clone()),
                scale,
                TM.text,
            ),
            cell(
                "Grup",
                if grup.is_empty() { "-".into() } else { grup },
                scale,
                TM.accent,
            ),
        ))
        .child(pair(
            cell("Email", f("email"), scale, TM.text),
            cell("No. HP", f("no_hp"), scale, TM.text),
        ))
        .child(pair(
            cell("Terdaftar", f("dibuat_pada"), scale, TM.muted),
            cell("Berlaku s/d", f("kadaluarsa_pada"), scale, TM.accent),
        ));
    div().flex().flex_col().child(head).child(grid).into_any_element()
}

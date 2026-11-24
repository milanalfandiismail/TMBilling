use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::platform::window::OverlayGeometry;
use crate::state::TmApp;
use crate::theme::TM;
use crate::ui::badge::{badge_colors, BadgeTone, TmBadge};
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::overlay::{panels, OverlayActions};
use crate::ui::tabs::TmTabs;

struct Metrics {
    pad: f32,
    header_h: f32,
    name_font: f32,
    timer_font: f32,
    timer_mt: f32,
    btn_h: f32,
    btn_mt: f32,
    tab_mt: f32,
    tab_font: f32,
    row_mt: f32,
    min_w: f32,
    min_h: f32,
    radius: f32,
}

/// Angka diambil dari export: 380x268 wide, 318x234 compact.
fn metrics(scale: f32, compact: bool) -> Metrics {
    if compact {
        return Metrics {
            pad: 7.0,
            header_h: 17.0,
            name_font: 11.0,
            timer_font: 34.0,
            timer_mt: 9.0,
            btn_h: 32.0,
            btn_mt: 27.0,
            tab_mt: 17.0,
            tab_font: 11.0,
            row_mt: 13.0,
            min_w: 26.0,
            min_h: 20.0,
            radius: 7.0,
        };
    }
    Metrics {
        pad: 12.0 * scale,
        header_h: 24.0 * scale,
        name_font: 13.0 * scale,
        timer_font: 46.0 * scale,
        timer_mt: 10.0 * scale,
        btn_h: 36.0 * scale,
        btn_mt: 39.0 * scale,
        tab_mt: 18.0 * scale,
        tab_font: 13.0 * scale,
        row_mt: 9.0 * scale,
        min_w: 30.0 * scale,
        min_h: 24.0 * scale,
        radius: 8.0 * scale,
    }
}

fn badge_chip(app: &TmApp, compact: bool, scale: f32) -> AnyElement {
    let Some(session) = app.session.as_ref() else {
        return div().into_any_element();
    };
    let admin = app.is_admin_session || session.is_emergency;
    let tone = if admin || session.is_member {
        BadgeTone::Accent
    } else {
        BadgeTone::Muted
    };
    let label = if admin {
        "Admin"
    } else if session.is_member {
        "Member"
    } else {
        "Guest"
    };
    if !compact {
        return TmBadge::new(label, tone).render().into_any_element();
    }
    let (bg, fg) = badge_colors(tone);
    div()
        .flex()
        .items_center()
        .h(px(18.0))
        .px(px(6.0))
        .rounded(px(3.0))
        .bg(bg)
        .text_size(px(9.0 * scale / 0.837))
        .text_color(fg)
        .child(label)
        .into_any_element()
}

/// Extra height the tab panel adds below the card body; the window is resized to match.
/// Tinggi kartu launcher terpisah di bawah overlay (height 48px + margin gap 8px).
pub const LAUNCHER_BAR_H: f32 = 48.0;
pub const LAUNCHER_BAR_GAP: f32 = 8.0;

/// Extra height the tab panel and launcher card add below the card body; the window is resized to match.
pub fn extra_height(tab: usize, geom: OverlayGeometry, member: bool) -> f32 {
    let scale = geom.width / 380.0;
    let sesi = if tab == 0 { panels::sesi_extra(member) } else { 0.0 };
    let launcher_extra = (LAUNCHER_BAR_H + LAUNCHER_BAR_GAP) * scale;
    launcher_extra
        + sesi * scale
        + match tab {
            1 => (panels::TOOLS_H - 30.0) * scale,
            2 => (panels::QRIS_H - 30.0) * scale,
            _ => 0.0,
        }
}

pub fn card(app: &TmApp, geom: OverlayGeometry, actions: &OverlayActions) -> impl IntoElement {
    let compact = geom.width < 340.0;
    let scale = geom.width / 380.0;
    let m = metrics(scale, compact);
    if app.session.is_none() {
        return div().into_any_element();
    }
    let remaining = app.remaining_secs;
    let timer_color = if remaining <= 300 {
        TM.danger
    } else if remaining <= 600 {
        TM.warn
    } else {
        TM.text
    };
    let inner = geom.width - 2.0 * m.pad;
    let gap = if compact { 6.0 } else { 8.0 * scale };
    let col_w = (inner - gap) / 2.0;
    let tab_w = inner / 3.0;
    let min_click = actions.minimize.clone();
    let afk_click = actions.afk.clone();
    let logout_click = actions.logout.clone();
    let name = app.session.as_ref().map(|s| s.nama.clone()).unwrap_or_default();
    let badge = badge_chip(app, compact, scale);
    let extra_h = extra_height(
        app.overlay_tab,
        geom,
        app.session.as_ref().is_some_and(|s| s.is_member),
    );

    div()
        .flex()
        .flex_col()
        .w(px(geom.width))
        .h(px(geom.height + extra_h))
        .p(px(m.pad))
        .rounded(px(m.radius))
        .border_1()
        .border_color(TM.border)
        .bg(TM.card)
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .h(px(m.header_h))
                .child({
                    let open = actions.open.clone();
                    div()
                        .id("ov-member")
                        .flex()
                        .flex_row()
                        .items_center()
                        .cursor_pointer()
                        .on_click(move |_: &ClickEvent, w: &mut Window, cx: &mut App| {
                            open(crate::state::Modal::Member, w, cx)
                        })
                        .child(badge)
                        .child(
                            div()
                                .ml(px(if compact { 8.0 } else { 12.0 * scale }))
                                .text_size(px(m.name_font))
                                .text_color(TM.text)
                                .child(name),
                        )
                .child({
                    let pc = app
                        .session
                        .as_ref()
                        .map(|s| s.pc_kode.clone())
                        .unwrap_or_default();
                    if pc.is_empty() {
                        div().into_any_element()
                    } else {
                        div()
                            .ml(px(if compact { 6.0 } else { 8.0 * scale }))
                            .px(px(if compact { 4.0 } else { 6.0 * scale }))
                            .h(px(if compact { 15.0 } else { 18.0 * scale }))
                            .flex()
                            .items_center()
                            .rounded(px(3.0))
                            .bg(TM.hover)
                            .text_size(px((m.name_font - 2.0).max(9.0)))
                            .text_color(TM.dim)
                            .child(pc)
                            .into_any_element()
                    }
                })
                })
                .child(div().flex_1())
                .child(
                    div()
                        .id("ov-min")
                        .flex()
                        .items_center()
                        .justify_center()
                        .w(px(m.min_w))
                        .h(px(m.min_h))
                        .rounded(px(6.0 * scale))
                        .border_1()
                        .border_color(TM.border_strong)
                        .cursor_pointer()
                        .on_click(move |_, window, cx| min_click(window, cx))
                        .child(div().w(px(12.0 * scale)).h(px(2.0)).bg(TM.muted)),
                ),
        )
        .child(
            div()
                .mt(px(m.timer_mt))
                .flex()
                .justify_center()
                .text_size(px(m.timer_font * 0.62))
                .line_height(px(m.timer_font * 0.72))
                .text_align(gpui_kit::TextAlign::Center)
                .font_weight(FontWeight::BOLD)
                .text_color(timer_color)
                .child(crate::state::timer_text(
                    app.is_admin_session || app.session.as_ref().is_some_and(|s| s.is_emergency),
                    remaining,
                )),
        )
        .child(
            div()
                .mt(px(m.btn_mt))
                .flex()
                .flex_row()
                .gap(px(gap))
                .child(
                    TmButton::new("Lock / AFK", ButtonTone::Ghost)
                        .width(col_w)
                        .height(m.btn_h)
                        .on_click(move |_, window, cx| afk_click(window, cx))
                        .render(),
                )
                .child(
                    TmButton::new("Logout", ButtonTone::Danger)
                        .width(col_w)
                        .height(m.btn_h)
                        .on_click(move |_, window, cx| logout_click(window, cx))
                        .render(),
                ),
        )
        .child(
            div().mt(px(m.tab_mt)).child(
                TmTabs::new(vec!["Sesi", "Alat", "QRIS"], app.overlay_tab)
                    .id_prefix("ov-tab")
                    .active_color(TM.accent)
                    .item_width(tab_w)
                    .text_size(m.tab_font)
                    .underline_offset(5.0)
                    .on_change({
                        let tab = actions.tab.clone();
                        move |index, window, cx| tab(index, window, cx)
                    })
                    .render(),
            ),
        )
        .child(match app.overlay_tab {
            1 => div()
                .mt(px(m.row_mt))
                .child(panels::tools(app, scale, actions))
                .into_any_element(),
            2 => div()
                .mt(px(m.row_mt))
                .child(panels::qris(app, scale, actions))
                .into_any_element(),
            _ => div()
                .mt(px(m.row_mt))
                .child(panels::sesi(app, scale))
                .into_any_element(),
        })
        .child(launcher_card_bar(scale, m.radius, actions))
        .into_any_element()
}

/// Kartu terpisah khusus Game Launcher yang terletak tepat di bawah kartu utama overlay.
fn launcher_card_bar(scale: f32, radius: f32, actions: &OverlayActions) -> impl IntoElement {
    let open = actions.open_launcher.clone();
    div()
        .id("ov-game-launcher-card")
        .mt(px(LAUNCHER_BAR_GAP * scale))
        .h(px(LAUNCHER_BAR_H * scale))
        .w_full()
        .px(px(14.0 * scale))
        .rounded(px(radius))
        .border_1()
        .border_color(TM.border)
        .bg(TM.card)
        .hover(|s| s.bg(TM.hover).border_color(TM.accent))
        .active(|s| s.bg(TM.hover))
        .cursor_pointer()
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        .on_mouse_down(MouseButton::Left, move |_, window, cx| {
            open(window, cx);
        })
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .gap(px(10.0 * scale))
                .child(
                    div()
                        .w(px(26.0 * scale))
                        .h(px(26.0 * scale))
                        .rounded(px(6.0 * scale))
                        .bg(TM.hover)
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(
                            div()
                                .flex()
                                .flex_row()
                                .flex_wrap()
                                .gap(px(2.0 * scale))
                                .w(px(12.0 * scale))
                                .h(px(12.0 * scale))
                                .child(div().w(px(5.0 * scale)).h(px(5.0 * scale)).rounded(px(1.0)).bg(TM.accent))
                                .child(div().w(px(5.0 * scale)).h(px(5.0 * scale)).rounded(px(1.0)).bg(TM.accent))
                                .child(div().w(px(5.0 * scale)).h(px(5.0 * scale)).rounded(px(1.0)).bg(TM.accent))
                                .child(div().w(px(5.0 * scale)).h(px(5.0 * scale)).rounded(px(1.0)).bg(TM.accent))
                        )
                )
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(1.0))
                        .child(
                            div()
                                .text_size(px(12.0 * scale))
                                .text_color(TM.text)
                                .font_weight(FontWeight::BOLD)
                                .child("Game Launcher")
                        )
                        .child(
                            div()
                                .text_size(px(10.0 * scale))
                                .text_color(TM.muted)
                                .child("Buka katalog game & aplikasi")
                        )
                )
        )
        .child(
            div()
                .flex()
                .items_center()
                .justify_center()
                .w(px(22.0 * scale))
                .h(px(22.0 * scale))
                .rounded(px(4.0 * scale))
                .bg(TM.hover)
                .text_size(px(11.0 * scale))
                .text_color(TM.accent)
                .child("▶")
        )
}

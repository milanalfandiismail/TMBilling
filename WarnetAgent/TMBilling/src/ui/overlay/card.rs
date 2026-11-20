use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::platform::window::OverlayGeometry;
use crate::state::TmApp;
use crate::theme::TM;
use crate::ui::badge::{badge_colors, BadgeTone, TmBadge};
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::overlay::{panels, OverlayActions};
use crate::ui::tabs::TmTabs;

/// H:MM:SS dengan jam dua digit, sama seperti export FigCraft.
pub fn clock(secs: i64) -> String {
    let secs = secs.max(0);
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    format!("{h:02}:{m:02}:{s:02}")
}

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
    row_font: f32,
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
            row_font: 11.0,
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
        btn_mt: 40.0 * scale,
        tab_mt: 17.0 * scale,
        tab_font: 13.0 * scale,
        row_mt: 6.0 * scale,
        row_font: 11.0 * scale,
        min_w: 30.0 * scale,
        min_h: 24.0 * scale,
        radius: 8.0 * scale,
    }
}

fn badge_chip(app: &TmApp, compact: bool, scale: f32) -> AnyElement {
    let Some(session) = app.session.as_ref() else {
        return div().into_any_element();
    };
    let tone = if session.is_member {
        BadgeTone::Accent
    } else {
        BadgeTone::Muted
    };
    let label = if session.is_member { "Member" } else { "Guest" };
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
    let mul = app
        .started_at
        .map(|(h, m)| format!("{h:02}:{m:02}"))
        .unwrap_or_else(|| "--:--".to_string());
    let min_click = actions.minimize.clone();
    let afk_click = actions.afk.clone();
    let logout_click = actions.logout.clone();
    let name = app.session.as_ref().map(|s| s.nama.clone()).unwrap_or_default();
    let badge = badge_chip(app, compact, scale);
    let extra_h = match app.overlay_tab {
        1 => (panels::TOOLS_H - 30.0) * scale,
        2 => (panels::QRIS_H - 30.0) * scale,
        _ => 0.0,
    };

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
                .text_size(px(m.timer_font))
                .line_height(px(m.timer_font))
                .font_family("Consolas")
                .font_weight(FontWeight::BOLD)
                .text_color(timer_color)
                .child(clock(remaining)),
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
                .child(panels::qris(scale, actions))
                .into_any_element(),
            _ => div()
                .mt(px(m.row_mt))
                .flex()
                .flex_row()
                .items_center()
                .justify_between()
                .child(div().text_size(px(m.row_font)).text_color(TM.dim).child("Mulai"))
                .child(div().text_size(px(m.row_font)).text_color(TM.text).child(mul))
                .into_any_element(),
        })
        .into_any_element()
}

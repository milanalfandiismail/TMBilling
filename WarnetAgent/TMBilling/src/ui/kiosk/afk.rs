use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::state::TmApp;
use crate::theme::TM;
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::kiosk::ActionFn;

pub struct AfkActions {
    pub submit: ActionFn,
}

fn click(f: ActionFn) -> impl Fn(&ClickEvent, &mut Window, &mut App) + 'static {
    move |_: &ClickEvent, window, cx| {
        cx.stop_propagation();
        f(window, cx);
    }
}

fn masked(app: &TmApp) -> String {
    if app.afk_input.is_empty() {
        "Password / PIN".to_string()
    } else {
        let caret = if app.afk_busy { "" } else { "|" };
        format!("{}{caret}", "•".repeat(app.afk_input.chars().count()))
    }
}

/// Layar penuh saat server menandai sesi AFK; hanya input buka kunci yang aktif.
pub fn screen(app: &TmApp, actions: &AfkActions) -> impl IntoElement {
    let who = app
        .session
        .as_ref()
        .map(|s| format!("{} · {}", s.nama, s.pc_kode))
        .unwrap_or_default();
    let empty = app.afk_input.is_empty();
    let field_color = if app.afk_busy { TM.dim } else { TM.accent };
    let submit = actions.submit.clone();
    div()
        .size_full()
        .flex()
        .items_center()
        .justify_center()
        .child(
            div()
                .w(px(420.0))
                .p(px(28.0))
                .flex()
                .flex_col()
                .rounded(px(TM.radius_xl))
                .bg(TM.card)
                .border_1()
                .border_color(TM.border)
                .child(
                    div()
                        .text_size(px(22.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(TM.text)
                        .child("Meja Terkunci"),
                )
                .child(
                    div()
                        .pt(px(4.0))
                        .text_size(px(12.0))
                        .text_color(TM.muted)
                        .child(who),
                )
                .child(
                    div()
                        .pt(px(18.0))
                        .text_size(px(30.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(TM.warn)
                        .child(crate::state::human_time(app.remaining_secs)),
                )
                .child(
                    div()
                        .pt(px(12.0))
                        .text_size(px(12.0))
                        .text_color(TM.dim)
                        .child("Masukkan password akun atau PIN untuk melanjutkan."),
                )
                .child(
                    div()
                        .id("afk-field")
                        .mt(px(16.0))
                        .h(px(44.0))
                        .px(px(12.0))
                        .flex()
                        .items_center()
                        .rounded(px(TM.radius_md))
                        .bg(TM.hover)
                        .border_1()
                        .border_color(field_color)
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(if empty { TM.dim } else { TM.text })
                                .child(masked(app)),
                        ),
                )
                .children(app.afk_error.clone().map(|err| {
                    div()
                        .pt(px(8.0))
                        .text_size(px(11.0))
                        .text_color(TM.danger)
                        .child(err)
                }))
                .child(
                    div().mt(px(18.0)).child(
                        TmButton::new("Buka Kunci", ButtonTone::Primary)
                            .height(44.0)
                            .width(364.0)
                            .on_click(click(submit))
                            .render(),
                    ),
                ),
        )
}

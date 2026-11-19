use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::polling::format_remaining;
use crate::state::PowerAction;
use crate::theme::TM;
use crate::ui::button::{ButtonTone, TmButton};
use crate::ui::kiosk::KioskActions;

pub fn header(
    title: &str,
    pc: &str,
    shutdown: Option<i64>,
    compact: bool,
    actions: &KioskActions,
) -> impl IntoElement {
    let (value, color) = match shutdown {
        None => ("NONAKTIF".to_string(), TM.dim),
        Some(secs) if secs <= 300 => (format_remaining(secs), TM.danger),
        Some(secs) => (format_remaining(secs), TM.text),
    };
    let power = actions.power.clone();
    let power_shutdown = power.clone();
    let badge_w = if compact { 216.0 } else { 300.0 };

    div()
        .flex()
        .flex_row()
        .items_center()
        .w_full()
        .child(
            div()
                .text_size(px(if compact { 16.0 } else { 20.0 }))
                .max_w(px(if compact { 240.0 } else { 420.0 }))
                .overflow_hidden()
                .text_color(TM.text)
                .child(title.to_string()),
        )
        .children(if pc.is_empty() {
            None
        } else {
            Some(
                div()
                    .ml(px(16.0))
                    .px(px(8.0))
                    .py(px(4.0))
                    .rounded(px(TM.radius_sm))
                    .bg(TM.accent.opacity(0.12))
                    .border_1()
                    .border_color(TM.accent.opacity(0.30))
                    .text_size(px(11.0))
                    .text_color(TM.accent)
                    .child(pc.to_string()),
            )
        })
        .child(div().flex_1())
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .w(px(badge_w))
                .h(px(if compact { 32.0 } else { 36.0 }))
                .px(px(12.0))
                .rounded(px(TM.radius_sm))
                .bg(TM.surface)
                .border_1()
                .border_color(TM.border)
                .child(
                    div()
                        .text_size(px(if compact { 10.0 } else { 11.0 }))
                        .text_color(TM.dim)
                        .child("MATI OTOMATIS DALAM"),
                )
                .child(
                    div()
                        .text_size(px(if compact { 13.0 } else { 15.0 }))
                        .font_family("Consolas")
                        .text_color(color)
                        .child(value),
                ),
        )
        .child(
            div().ml(px(20.0)).child(
                TmButton::new("Restart", ButtonTone::Ghost)
                    .icon("⟳")
                    .id_prefix("kiosk-restart")
                    .height(if compact { 30.0 } else { 36.0 })
                    .width(if compact { 96.0 } else { 120.0 })
                    .on_click(move |_, window, cx| power(Some(PowerAction::Restart), window, cx))
                    .render(),
            ),
        )
        .child(
            div().ml(px(10.0)).child(
                TmButton::new("Matikan", ButtonTone::Ghost)
                    .icon("⏻")
                    .id_prefix("kiosk-shutdown")
                    .height(if compact { 30.0 } else { 36.0 })
                    .width(if compact { 104.0 } else { 108.0 })
                    .on_click(move |_, window, cx| {
                        power_shutdown(Some(PowerAction::Shutdown), window, cx)
                    })
                    .render(),
            ),
        )
}

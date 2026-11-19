use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;

pub fn modal_shell(
    width: f32,
    title: impl Into<SharedString>,
    body: impl IntoElement,
    footer: impl IntoElement,
) -> Div {
    div()
        .flex()
        .flex_col()
        .w(px(width))
        .rounded(px(TM.radius_lg))
        .border_1()
        .border_color(TM.border)
        .bg(TM.card)
        .child(
            div()
                .px(px(16.0))
                .py(px(14.0))
                .border_b_1()
                .border_color(TM.border)
                .text_size(px(14.0))
                .text_color(TM.text)
                .child(title.into()),
        )
        .child(div().p(px(16.0)).child(body))
        .child(
            div()
                .flex()
                .flex_row()
                .justify_end()
                .gap(px(8.0))
                .px(px(16.0))
                .py(px(12.0))
                .border_t_1()
                .border_color(TM.border)
                .child(footer),
        )
}

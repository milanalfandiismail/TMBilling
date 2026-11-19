use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;

/// Kotak input. Ketikan/keyboard ditangani Task 5 lewat EntityInputHandler.
pub struct TmInput {
    placeholder: SharedString,
    value: Option<SharedString>,
    height: f32,
    width: Option<f32>,
    focused: bool,
}

impl TmInput {
    pub fn new(placeholder: impl Into<SharedString>) -> Self {
        Self {
            placeholder: placeholder.into(),
            value: None,
            height: 40.0,
            width: None,
            focused: false,
        }
    }

    pub fn value(mut self, value: impl Into<SharedString>) -> Self {
        self.value = Some(value.into());
        self
    }

    pub fn height(mut self, height: f32) -> Self {
        self.height = height;
        self
    }

    pub fn width(mut self, width: f32) -> Self {
        self.width = Some(width);
        self
    }

    pub fn focused(mut self, focused: bool) -> Self {
        self.focused = focused;
        self
    }

    pub fn render(self) -> impl IntoElement {
        let filled = self.value.is_some();
        let text = self.value.unwrap_or(self.placeholder);
        let mut el = div()
            .flex()
            .items_center()
            .h(px(self.height))
            .px(px(12.0))
            .rounded(px(TM.radius_md))
            .bg(TM.surface)
            .border_1()
            .border_color(if self.focused { TM.accent } else { TM.border })
            .text_size(px(13.0))
            .text_color(if filled { TM.text } else { TM.dim })
            .child(text);
        if let Some(width) = self.width {
            el = el.w(px(width));
        }
        el
    }
}

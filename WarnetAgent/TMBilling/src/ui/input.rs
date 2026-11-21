use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;

/// Caret 1,5 px; tetap menempati ruang saat tersembunyi agar teks tidak bergeser.
pub fn caret(visible: bool) -> impl IntoElement {
    div()
        .flex_shrink_0()
        .w(px(1.5))
        .h(px(16.0))
        .bg(if visible { TM.accent } else { gpui_kit::Rgba { a: 0.0, ..TM.card } })
}
/// Kotak input. Ketikan/keyboard ditangani Task 5 lewat EntityInputHandler.
pub struct TmInput {
    placeholder: SharedString,
    value: Option<SharedString>,
    height: f32,
    width: Option<f32>,
    focused: bool,
    caret: bool,
}

impl TmInput {
    pub fn new(placeholder: impl Into<SharedString>) -> Self {
        Self {
            placeholder: placeholder.into(),
            value: None,
            height: 40.0,
            width: None,
            focused: false,
            caret: false,
        }
    }

    pub fn value(mut self, value: impl Into<SharedString>) -> Self {
        let text = value.into();
        // string kosong = belum diisi, jadi placeholder tetap tampil
        self.value = if text.is_empty() { None } else { Some(text) };
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
    /// Tampilkan caret berkedip saat field ini yang aktif.
    pub fn caret(mut self, on: bool) -> Self {
        self.caret = on;
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
            .child(
                div()
                    .flex()
                    .items_center()
                    // caret mengikuti titik sisip: sebelum placeholder saat kosong,
                    // setelah teks saat terisi.
                    .when(self.focused && self.caret && !filled, |el| {
                        el.child(caret(self.caret))
                    })
                    .child(text)
                    .when(self.focused && self.caret && filled, |el| {
                        el.child(caret(self.caret))
                    }),
            );
        if let Some(width) = self.width {
            el = el.w(px(width));
        }
        el
    }
}

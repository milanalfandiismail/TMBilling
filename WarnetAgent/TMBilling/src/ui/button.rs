use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::{c, TM};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ButtonTone {
    Primary,
    Ghost,
    Danger,
    Warn,
}

pub fn tone_colors(tone: ButtonTone) -> (Rgba, Rgba, Option<Rgba>) {
    match tone {
        ButtonTone::Primary => (TM.accent, c(0x050505), None),
        ButtonTone::Ghost => (TM.card, TM.text, Some(TM.border_strong)),
        ButtonTone::Danger => (c(0x2A1414), TM.danger, Some(TM.danger)),
        ButtonTone::Warn => (c(0x2A2410), TM.warn, None),
    }
}

type ClickHandler = Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>;

pub struct TmButton {
    label: SharedString,
    icon: Option<SharedString>,
    tone: ButtonTone,
    height: f32,
    width: Option<f32>,
    id_prefix: Option<SharedString>,
    on_click: Option<ClickHandler>,
}

impl TmButton {
    pub fn new(label: impl Into<SharedString>, tone: ButtonTone) -> Self {
        Self {
            label: label.into(),
            icon: None,
            tone,
            height: 36.0,
            width: None,
            id_prefix: None,
            on_click: None,
        }
    }

    pub fn icon(mut self, glyph: impl Into<SharedString>) -> Self {
        self.icon = Some(glyph.into());
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

    /// Dua tombol berlabel sama di satu layar butuh prefix berbeda.
    pub fn id_prefix(mut self, prefix: impl Into<SharedString>) -> Self {
        self.id_prefix = Some(prefix.into());
        self
    }

    pub fn on_click(mut self, handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static) -> Self {
        self.on_click = Some(Box::new(handler));
        self
    }

    pub fn render(self) -> impl IntoElement {
        let (bg, fg, stroke) = tone_colors(self.tone);
        let id = self
            .id_prefix
            .clone()
            .unwrap_or_else(|| format!("tm-btn-{}-{:?}", self.label, self.tone).into());
        let content = div()
            .flex()
            .items_center()
            .gap(px(6.0))
            .children(self.icon.clone().map(|glyph| {
                div()
                    .text_size(px(13.0))
                    .text_color(TM.muted)
                    .child(glyph)
            }))
            .child(self.label.clone());
        let mut el = div()
            .id(id)
            .flex()
            .items_center()
            .justify_center()
            .h(px(self.height))
            .px(px(16.0))
            .rounded(px(TM.radius_md))
            .bg(bg)
            .text_color(fg)
            .text_size(px(if self.height >= 44.0 { 14.0 } else { 13.0 }))
            .child(content);
        if let Some(width) = self.width {
            el = el.w(px(width));
        }
        if let Some(stroke) = stroke {
            el = el.border_1().border_color(stroke);
        }
        if let Some(handler) = self.on_click {
            el = el.cursor_pointer().on_click(move |ev, window, cx| handler(ev, window, cx));
        }
        el
    }
}

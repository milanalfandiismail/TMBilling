use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::{c, TM};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BadgeTone {
    Accent,
    Warn,
    Danger,
    Muted,
}

pub fn badge_colors(tone: BadgeTone) -> (Rgba, Rgba) {
    match tone {
        BadgeTone::Accent => (c(0x123B2E), TM.accent),
        BadgeTone::Warn => (c(0x2A2410), TM.warn),
        BadgeTone::Danger => (c(0x2A1414), TM.danger),
        BadgeTone::Muted => (TM.hover, TM.muted),
    }
}

pub struct TmBadge {
    label: SharedString,
    tone: BadgeTone,
}

impl TmBadge {
    pub fn new(label: impl Into<SharedString>, tone: BadgeTone) -> Self {
        Self { label: label.into(), tone }
    }

    pub fn render(self) -> impl IntoElement {
        let (bg, fg) = badge_colors(self.tone);
        div()
            .flex()
            .items_center()
            .h(px(24.0))
            .px(px(8.0))
            .rounded(px(TM.radius_sm))
            .bg(bg)
            .text_color(fg)
            .text_size(px(11.0))
            .child(self.label)
    }
}

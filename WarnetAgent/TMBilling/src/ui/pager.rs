use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;

type ChangeHandler = std::rc::Rc<dyn Fn(usize, &mut Window, &mut App)>;

pub fn step(page: usize, total: usize, delta: i32) -> usize {
    let next = page as i32 + delta;
    next.clamp(1, total.max(1) as i32) as usize
}

pub struct TmPager {
    page: usize,
    total: usize,
    height: f32,
    width: f32,
    id_prefix: SharedString,
    on_change: Option<ChangeHandler>,
}

impl TmPager {
    /// Kiosk 132x28, overlay 108x24 — ukuran dari FigCraft.
    pub fn new(page: usize, total: usize, width: f32, height: f32) -> Self {
        Self {
            page,
            total,
            height,
            width,
            id_prefix: "tm-pager".into(),
            on_change: None,
        }
    }

    pub fn id_prefix(mut self, prefix: impl Into<SharedString>) -> Self {
        self.id_prefix = prefix.into();
        self
    }

    pub fn on_change(mut self, handler: impl Fn(usize, &mut Window, &mut App) + 'static) -> Self {
        self.on_change = Some(std::rc::Rc::new(handler));
        self
    }

    fn arrow(&self, slot: &str, glyph: &str, delta: i32) -> impl IntoElement {
        let mut arrow = div()
            .id(format!("{}-{slot}", self.id_prefix))
            .flex()
            .items_center()
            .px(px(6.0))
            .text_size(px(14.0))
            .text_color(TM.muted)
            .child(glyph.to_string());
        let allow_back = delta < 0 && self.page > 1;
        let allow_next = delta > 0 && self.page < self.total;
        if let (Some(handler), true) = (self.on_change.as_ref(), allow_back || allow_next) {
            let handler = handler.clone();
            let next = step(self.page, self.total, delta);
            arrow = arrow
                .cursor_pointer()
                .on_click(move |_, window, cx| handler(next, window, cx));
        }
        arrow
    }

    pub fn render(self) -> impl IntoElement {
        let label = format!("{} / {}", self.page, self.total);
        let font = if self.height >= 28.0 { 13.0 } else { 12.0 };
        div()
            .flex()
            .flex_row()
            .items_center()
            .justify_between()
            .w(px(self.width))
            .h(px(self.height))
            .px(px(4.0))
            .text_size(px(font))
            .child(self.arrow("prev", "<", -1))
            .child(div().text_color(TM.text).child(label))
            .child(self.arrow("next", ">", 1))
    }
}

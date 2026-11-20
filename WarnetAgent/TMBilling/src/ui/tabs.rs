use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;

type ChangeHandler = std::rc::Rc<dyn Fn(usize, &mut Window, &mut App)>;

pub struct TmTabs {
    items: Vec<SharedString>,
    active: usize,
    id_prefix: SharedString,
    on_change: Option<ChangeHandler>,
    item_width: Option<f32>,
    active_color: Option<Rgba>,
    text_size: Option<f32>,
}

impl TmTabs {
    pub fn new(items: Vec<impl Into<SharedString>>, active: usize) -> Self {
        Self {
            items: items.into_iter().map(Into::into).collect(),
            active,
            id_prefix: "tm-tabs".into(),
            on_change: None,
            item_width: None,
            active_color: None,
            text_size: None,
        }
    }

    pub fn id_prefix(mut self, prefix: impl Into<SharedString>) -> Self {
        self.id_prefix = prefix.into();
        self
    }

    pub fn text_size(mut self, size: f32) -> Self {
        self.text_size = Some(size);
        self
    }

    pub fn active_color(mut self, color: Rgba) -> Self {
        self.active_color = Some(color);
        self
    }

    pub fn item_width(mut self, width: f32) -> Self {
        self.item_width = Some(width);
        self
    }

    pub fn on_change(mut self, handler: impl Fn(usize, &mut Window, &mut App) + 'static) -> Self {
        self.on_change = Some(std::rc::Rc::new(handler));
        self
    }

    pub fn render(self) -> impl IntoElement {
        let active = self.active;
        let prefix = self.id_prefix.clone();
        let mut row = div()
            .flex()
            .flex_row()
            .items_end()
            .border_b_1()
            .border_color(TM.border);
        for (index, item) in self.items.into_iter().enumerate() {
            let is_active = index == active;
            let mut tab = div()
                .id(format!("{prefix}-{index}"))
                .flex()
                .flex_col()
                .items_center()
                .px(px(14.0))
                .pt(px(2.0))
                .text_size(px(self.text_size.unwrap_or(13.0)))
                .text_color(if is_active {
                self.active_color.unwrap_or(TM.text)
            } else {
                TM.muted
            })
                .child(item)
                .child(if is_active {
                    div().h(px(2.0)).w_full().mt(px(8.0)).bg(TM.accent).into_any_element()
                } else {
                    div().h(px(2.0)).w_full().mt(px(8.0)).into_any_element()
                });
            if let Some(w) = self.item_width {
                tab = tab.w(px(w));
            }
            if let Some(handler) = self.on_change.as_ref() {
                let handler = handler.clone();
                tab = tab
                    .cursor_pointer()
                    .on_click(move |_, window, cx| handler(index, window, cx));
            }
            row = row.child(tab);
        }
        row
    }
}

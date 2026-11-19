use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::TM;
use crate::ui::{
    modal_shell, BadgeTone, ButtonTone, TmBadge, TmButton, TmInput, TmPager, TmTabs,
};

/// Kontrak visual Task 4: setiap widget, setiap tone, ukuran asli.
pub struct Gallery {
    tab: usize,
    page: usize,
}

impl Gallery {
    pub fn new(_cx: &mut Context<Self>) -> Self {
        Self { tab: 0, page: 1 }
    }

    fn label(text: &str) -> Div {
        div()
            .text_size(px(11.0))
            .text_color(TM.dim)
            .child(text.to_string())
    }
}

impl Render for Gallery {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let me = cx.entity();
        let _swatch = div().h(px(2.0)).w_full().rounded(px(TM.radius_xl)).bg(TM.info);
        let tabs = TmTabs::new(vec!["Sesi", "Tools", "QRIS"], self.tab)
            .id_prefix("gallery-tabs")
            .on_change({
                let me = me.clone();
                move |index: usize, _window: &mut Window, cx: &mut App| {
                    me.update(cx, |this, cx| {
                        this.tab = index;
                        cx.notify();
                    });
                }
            });
        let pager = TmPager::new(self.page, 4, 132.0, 28.0)
            .id_prefix("gallery-pager")
            .on_change({
                let me = me.clone();
                move |page: usize, _window: &mut Window, cx: &mut App| {
                    me.update(cx, |this, cx| {
                        this.page = page;
                        cx.notify();
                    });
                }
            });

        div()
            .flex()
            .flex_col()
            .gap(px(20.0))
            .p(px(24.0))
            .size_full()
            .bg(TM.bg)
            .text_color(TM.text)
            .child(_swatch)
            .child(div().text_size(px(16.0)).child("TMBilling components"))
            .child(Self::label("BUTTONS"))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .items_center()
                    .gap(px(12.0))
                    .child(TmButton::new("Simpan", ButtonTone::Primary).render())
                    .child(TmButton::new("Batal", ButtonTone::Ghost).render())
                    .child(TmButton::new("Matikan", ButtonTone::Danger).render())
                    .child(TmButton::new("Lock / AFK", ButtonTone::Warn).render())
                    .child(TmButton::new("Masuk", ButtonTone::Primary)
                        .height(56.0)
                        .width(240.0)
                        .id_prefix("gal-masuk")
                        .on_click(|_, _, _| {})
                        .render()),
            )
            .child(Self::label("INPUT"))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .gap(px(12.0))
                    .child(TmInput::new("Username").width(392.0).height(40.0).render())
                    .child(TmInput::new("budi").value("budi").focused(true).render()),
            )
            .child(Self::label("TABS"))
            .child(tabs.render())
            .child(Self::label("BADGES"))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .gap(px(8.0))
                    .child(TmBadge::new("Member", BadgeTone::Accent).render())
                    .child(TmBadge::new("DP", BadgeTone::Warn).render())
                    .child(TmBadge::new("Terputus", BadgeTone::Danger).render())
                    .child(TmBadge::new("Postpaid", BadgeTone::Muted).render())
                    .child(TmBadge::new("1 / 3", BadgeTone::Muted).render()),
            )
            .child(Self::label("PAGER"))
            .child(
                div()
                    .flex()
                    .flex_row()
                    .gap(px(12.0))
                    .child(pager.render())
                    .child(TmPager::new(1, 4, 108.0, 24.0).render()),
            )
            .child(Self::label("MODAL"))
            .child(modal_shell(
                480.0,
                "Sesi bermain akan dihentikan",
                div()
                    .text_size(px(12.0))
                    .text_color(TM.muted)
                    .child("Semua aplikasi akan ditutup dan meja dikembalikan ke kasir."),
                div()
                    .flex()
                    .flex_row()
                    .gap(px(8.0))
                    .child(TmButton::new("Batal", ButtonTone::Ghost).render())
                    .child(TmButton::new("Ya, selesai", ButtonTone::Primary).render()),
            ))
    }
}

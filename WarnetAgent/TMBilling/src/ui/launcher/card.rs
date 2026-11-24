use std::sync::Arc;
use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::api::models::GameItem;
use crate::theme::c;
use crate::poster_cache;

/// Parameter metrik kartu sesuai SPECIFICATION.md
#[derive(Clone, Copy, Debug)]
pub struct CardMetrics {
    pub card_w: f32,
    pub card_h: f32,
    pub cover_h: f32,
    pub label_h: f32,
    pub title_size: f32,
    pub btn_h: f32,
    pub radius: f32,
}

pub fn get_metrics_for_width(viewport_w: f32) -> (usize, CardMetrics) {
    if viewport_w >= 2400.0 {
        // 2560x1440 (2K QHD): 10 kolom
        (
            10,
            CardMetrics {
                card_w: 226.0,
                card_h: 490.0,
                cover_h: 402.0,
                label_h: 88.0,
                title_size: 14.0,
                btn_h: 28.0,
                radius: 8.0,
            },
        )
    } else if viewport_w >= 1600.0 {
        // 1920x1080 (FHD): 9 kolom
        (
            9,
            CardMetrics {
                card_w: 186.0,
                card_h: 380.0,
                cover_h: 302.0,
                label_h: 78.0,
                title_size: 13.0,
                btn_h: 26.0,
                radius: 8.0,
            },
        )
    } else if viewport_w >= 1200.0 {
        // 1366x768 (HD): 8 kolom
        (
            8,
            CardMetrics {
                card_w: 148.0,
                card_h: 262.0,
                cover_h: 194.0,
                label_h: 68.0,
                title_size: 11.5,
                btn_h: 24.0,
                radius: 6.0,
            },
        )
    } else {
        // 1024x768 (XGA): 6 kolom
        (
            6,
            CardMetrics {
                card_w: 146.0,
                card_h: 262.0,
                cover_h: 194.0,
                label_h: 68.0,
                title_size: 11.0,
                btn_h: 24.0,
                radius: 6.0,
            },
        )
    }
}

/// Placeholder monogram watermark bila poster belum ada / sedang dimuat.
pub fn poster_placeholder(name: &str, w: f32, h: f32, radius: f32) -> impl IntoElement {
    let initial = name
        .chars()
        .next()
        .unwrap_or('G')
        .to_uppercase()
        .to_string();

    div()
        .w(px(w))
        .h(px(h))
        .bg(c(0x141414))
        .rounded_t(px(radius))
        .flex()
        .flex_col()
        .items_center()
        .justify_center()
        .child(
            div()
                .text_size(px(h * 0.22))
                .text_color(c(0x282828))
                .font_weight(FontWeight::BOLD)
                .child(initial),
        )
        .child(
            div()
                .mt(px(4.0))
                .text_size(px(10.0))
                .text_color(c(0x404040))
                .child("NO POSTER"),
        )
}

/// Satu kartu poster game (2-tier vertical layout)
pub fn poster_card(
    item: &GameItem,
    metrics: CardMetrics,
    on_launch: impl Fn(&str, &str, Option<&str>, &mut Window, &mut App) + 'static + Clone,
) -> impl IntoElement {
    let title = item.nama.clone();
    let action_text = item.action_label();
    let exe_path = item.exe_path.clone();
    let argumen = item.argumen.clone();

    // Cek cache memori untuk poster
    let cached_img: Option<Arc<Image>> = item
        .icon_url
        .as_ref()
        .and_then(|url| poster_cache::get_poster(url));

    let cover_elem = match cached_img {
        Some(img_obj) => div()
            .w(px(metrics.card_w))
            .h(px(metrics.cover_h))
            .overflow_hidden()
            .rounded_t(px(metrics.radius))
            .child(
                img(img_obj)
                    .w(px(metrics.card_w))
                    .h(px(metrics.cover_h))
                    .object_fit(ObjectFit::Cover),
            )
            .into_any_element(),
        None => poster_placeholder(&title, metrics.card_w, metrics.cover_h, metrics.radius)
            .into_any_element(),
    };

    let on_click_launch = {
        let title_c = title.clone();
        let exe = exe_path.clone();
        let args = argumen.clone();
        let cb = on_launch.clone();
        move |_: &ClickEvent, window: &mut Window, cx: &mut App| {
            if let Some(ref path) = exe {
                cb(&title_c, path, args.as_deref(), window, cx);
            } else {
                cb(&title_c, "", None, window, cx);
            }
        }
    };

    div()
        .w(px(metrics.card_w))
        .min_h(px(metrics.card_h))
        .flex()
        .flex_col()
        .bg(c(0x0C0C0C))
        .border_1()
        .border_color(c(0x1C1C1C))
        .rounded(px(metrics.radius))
        .overflow_hidden()
        // Top Tier: Cover Poster (rasio cover 2:3 selalu konsisten)
        .child(
            div()
                .border_b_1()
                .border_color(c(0x1C1C1C))
                .child(cover_elem),
        )
        // Bottom Tier: Label & Action Bar (dengan gap 8px dan min_h adaptif jika judul 2-5 baris)
        .child(
            div()
                .flex()
                .flex_col()
                .justify_between()
                .gap(px(8.0))
                .min_h(px(metrics.label_h))
                .p(px(8.0))
                // Baris 1: Judul
                .child(
                    div()
                        .w_full()
                        .text_size(px(metrics.title_size))
                        .line_height(px(metrics.title_size * 1.25))
                        .text_color(c(0xE5E5E5))
                        .font_weight(FontWeight::BOLD)
                        .child(title),
                )
                // Baris 2: Tombol Aksi
                .child(
                    div()
                        .id(("launch-btn", item.id as usize))
                        .flex_shrink_0()
                        .flex()
                        .items_center()
                        .justify_center()
                        .w_full()
                        .h(px(metrics.btn_h))
                        .bg(c(0x141414))
                        .border_1()
                        .border_color(c(0x34D399))
                        .rounded(px(4.0))
                        .cursor_pointer()
                        .on_click(on_click_launch)
                        .child(
                            div()
                                .text_size(px(11.0))
                                .text_color(c(0x34D399))
                                .font_weight(FontWeight::BOLD)
                                .child(action_text),
                        ),
                ),
        )
}

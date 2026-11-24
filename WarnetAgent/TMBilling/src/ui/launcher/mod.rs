pub mod card;
pub mod layout;

use gpui_kit::component::scroll::ScrollableElement;
use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::api::models::GameItem;
use crate::theme::c;

pub use card::{get_metrics_for_width, poster_card};
pub use layout::{error_banner, footer, modal_error, modal_launching, navbar, subheader};

/// View utama Launcher yang merangkai Navbar, Subheader, Poster Grid, dan Footer.
pub fn launcher_view(
    viewport_w: f32,
    pc_kode: &str,
    time_countdown: &str,
    search_query: &str,
    active_tab: usize, // 0 = Semua, 1 = Game, 2 = Aplikasi
    games: &[GameItem],
    _on_search: impl Fn(String) + 'static + Clone,
    on_tab: impl Fn(usize, &mut Window, &mut App) + 'static + Clone,
    on_launch: impl Fn(&str, &str, Option<&str>, &mut Window, &mut App) + 'static + Clone,
    on_close: Option<crate::ui::overlay::ActFn>,
) -> impl IntoElement {
    let (_cols, metrics) = get_metrics_for_width(viewport_w);
    let resolution_label = if viewport_w >= 2400.0 {
        "2560x1440"
    } else if viewport_w >= 1600.0 {
        "1920x1080"
    } else if viewport_w >= 1200.0 {
        "1366x768"
    } else {
        "1024x768"
    };

    // Filter daftar item berdasarkan active_tab & search_query
    let filtered: Vec<&GameItem> = games
        .iter()
        .filter(|g| {
            if active_tab == 1 && g.is_aplikasi() {
                return false;
            }
            if active_tab == 2 && !g.is_aplikasi() {
                return false;
            }
            if !search_query.is_empty() {
                let q = search_query.to_lowercase();
                let match_name = g.nama.to_lowercase().contains(&q);
                let match_cat = g
                    .kategori
                    .as_deref()
                    .map(|k| k.to_lowercase().contains(&q))
                    .unwrap_or(false);
                return match_name || match_cat;
            }
            true
        })
        .collect();

    let count = filtered.len();

    // Render Grid Kartu Poster
    let mut grid = div()
        .flex()
        .flex_row()
        .flex_wrap()
        .items_start()
        .gap(px(14.0))
        .justify_start()
        .w_full();

    for item in &filtered {
        grid = grid.child(poster_card(item, metrics, on_launch.clone()));
    }

    if filtered.is_empty() {
        grid = grid.child(
            div()
                .w_full()
                .h(px(300.0))
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .child(
                    div()
                        .text_size(px(14.0))
                        .text_color(c(0x737373))
                        .child("Tidak ada game atau aplikasi yang ditemukan."),
                ),
        );
    }

    div()
        .flex()
        .flex_col()
        .w_full()
        .h_full()
        .bg(c(0x050505))
        .justify_between()
        // Bagian Atas: Navbar & Subheader Controls
        .child(
            div()
                .flex()
                .flex_col()
                .w_full()
                .child(navbar(search_query, time_countdown, false, false, |_w, _cx| {}, on_close))
                .child(subheader(active_tab, count, resolution_label, on_tab)),
        )
        // Bagian Tengah: Scrollable Grid Area
        .child(
            div()
                .flex_1()
                .w_full()
                .overflow_y_scrollbar()
                .px(px(32.0))
                .py(px(16.0))
                .child(grid),
        )
        // Bagian Bawah: Footer Dock
        .child(footer(pc_kode))
}

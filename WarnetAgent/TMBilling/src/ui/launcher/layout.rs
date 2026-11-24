use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::theme::c;

/// Top Navbar (Height: 68px) sesuai SPECIFICATION.md
pub fn navbar(
    search_query: &str,
    time_countdown: &str,
    is_search_focused: bool,
    caret_on: bool,
    on_search_click: impl Fn(&mut Window, &mut App) + 'static + Clone,
    on_close: Option<crate::ui::overlay::ActFn>,
) -> impl IntoElement {
    let query_str = search_query.to_string();

    div()
        .h(px(68.0))
        .w_full()
        .bg(c(0x0A0A0A))
        .border_b_1()
        .border_color(c(0x1C1C1C))
        .px(px(32.0))
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        // Kiri: Brand & Logo (tanpa teks TM LAUNCHER sesuai permintaan user)
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .gap(px(12.0))
                .child(
                    div()
                        .w(px(32.0))
                        .h(px(32.0))
                        .bg(c(0x34D399))
                        .rounded(px(6.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(
                            div()
                                .text_size(px(14.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0x050505))
                                .child("TM"),
                        ),
                ),
        )
        // Tengah: Search Bar
        .child({
            let on_click = on_search_click.clone();
            div()
                .id("launcher-search-box")
                .cursor_pointer()
                .w(px(460.0))
                .h(px(38.0))
                .bg(c(0x0C0C0C))
                .border_1()
                .border_color(if is_search_focused { c(0x34D399) } else { c(0x1C1C1C) })
                .rounded(px(6.0))
                .px(px(12.0))
                .flex()
                .flex_row()
                .items_center()
                .gap(px(8.0))
                .on_click(move |_, window, cx| on_click(window, cx))
                .child(
                    div()
                        .text_size(px(13.0))
                        .text_color(if is_search_focused { c(0x34D399) } else { c(0x737373) })
                        .child("🔍"),
                )
                .child(
                    div()
                        .flex()
                        .flex_row()
                        .items_center()
                        .gap(px(2.0))
                        .child(
                            div()
                                .text_size(px(12.0))
                                .text_color(if query_str.is_empty() { c(0x737373) } else { c(0xE5E5E5) })
                                .child(if query_str.is_empty() {
                                    if is_search_focused { "".to_string() } else { "Cari game atau aplikasi (1 - Z)...".to_string() }
                                } else {
                                    query_str
                                }),
                        )
                        .when(is_search_focused, |this| {
                            this.child(
                                div()
                                    .w(px(1.5))
                                    .h(px(14.0))
                                    .bg(if caret_on { c(0x34D399) } else { c(0x00000000) }),
                            )
                        }),
                )
        })
        // Kanan: Countdown Sesi + Tombol Tutup (jika modal)
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .gap(px(12.0))
                .child(
                    div()
                        .h(px(34.0))
                        .bg(c(0x0C0C0C))
                        .border_1()
                        .border_color(c(0x1C1C1C))
                        .rounded(px(6.0))
                        .px(px(14.0))
                        .flex()
                        .flex_row()
                        .items_center()
                        .gap(px(8.0))
                        .child(
                            div()
                                .w(px(7.0))
                                .h(px(7.0))
                                .rounded_full()
                                .bg(c(0x34D399)),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0xE5E5E5))
                                .child(time_countdown.to_string()),
                        ),
                )
                .when_some(on_close, |this, cb| {
                    this.child(
                        div()
                            .id("launcher-close-btn")
                            .cursor_pointer()
                            .h(px(34.0))
                            .px(px(14.0))
                            .bg(c(0x1C1C1C))
                            .hover(|s| s.bg(c(0xDC2626)))
                            .rounded(px(6.0))
                            .flex()
                            .items_center()
                            .justify_center()
                            .on_click(move |_: &ClickEvent, window, cx| cb(window, cx))
                            .child(
                                div()
                                    .text_size(px(12.0))
                                    .font_weight(FontWeight::BOLD)
                                    .text_color(c(0xE5E5E5))
                                    .child("Tutup"),
                            ),
                    )
                }),
        )
}

/// Sub-Header Controls (Height: 34px)
pub fn subheader(
    active_tab: usize, // 0 = Semua, 1 = Game, 2 = Aplikasi
    item_count: usize,
    resolution_label: &str,
    on_tab_change: impl Fn(usize, &mut Window, &mut App) + 'static + Clone,
) -> impl IntoElement {
    let tab_item = |idx: usize, label: &'static str| {
        let is_active = active_tab == idx;
        let cb = on_tab_change.clone();
        div()
            .id(("filter-tab", idx))
            .cursor_pointer()
            .px(px(16.0))
            .h(px(32.0))
            .flex()
            .items_center()
            .justify_center()
            .bg(if is_active { c(0x34D399) } else { c(0x00000000) })
            .rounded(px(4.0))
            .on_click(move |_: &ClickEvent, window: &mut Window, cx: &mut App| {
                cb(idx, window, cx);
            })
            .child(
                div()
                    .text_size(px(12.0))
                    .font_weight(if is_active { FontWeight::BOLD } else { FontWeight::NORMAL })
                    .text_color(if is_active { c(0x050505) } else { c(0xA3A3A3) })
                    .child(label),
            )
    };

    div()
        .h(px(42.0))
        .w_full()
        .px(px(32.0))
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        // Kiri: Segmented Filter Tipe dengan gap 6px antar tab
        .child(
            div()
                .h(px(34.0))
                .bg(c(0x0C0C0C))
                .border_1()
                .border_color(c(0x1C1C1C))
                .rounded(px(6.0))
                .p(px(2.0))
                .flex()
                .flex_row()
                .items_center()
                .gap(px(6.0))
                .child(tab_item(0, "Semua"))
                .child(tab_item(1, "Game"))
                .child(tab_item(2, "Aplikasi")),
        )
        // Kanan: Counter Info
        .child(
            div()
                .text_size(px(12.0))
                .text_color(c(0x737373))
                .child(format!("{} Item (1 - Z) • {}", item_count, resolution_label)),
        )
}

/// Bottom Footer Dock (Height: 44px)
pub fn footer(pc_code: &str) -> impl IntoElement {
    div()
        .h(px(44.0))
        .w_full()
        .bg(c(0x0A0A0A))
        .border_t_1()
        .border_color(c(0x1C1C1C))
        .px(px(32.0))
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        .child(
            div()
                .text_size(px(11.5))
                .text_color(c(0x737373))
                .child("TMBilling v2.0"),
        )
        .child(
            div()
                .text_size(px(11.5))
                .font_weight(FontWeight::BOLD)
                .text_color(c(0x737373))
                .child(pc_code.to_string()),
        )
}

/// Alert banner merah jika terjadi error / exception sistem, API, atau file missing
pub fn error_banner(
    message: &str,
    on_dismiss: impl Fn(&mut Window, &mut App) + 'static + Clone,
) -> impl IntoElement {
    let msg = message.to_string();
    let cb = on_dismiss.clone();
    div()
        .id("launcher-error-banner")
        .w_full()
        .mb(px(14.0))
        .bg(c(0x2A1212))
        .border_1()
        .border_color(c(0xEF4444))
        .rounded(px(6.0))
        .px(px(16.0))
        .py(px(10.0))
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        .gap(px(12.0))
        .child(
            div()
                .flex()
                .flex_row()
                .items_center()
                .gap(px(10.0))
                .flex_1()
                .child(
                    div()
                        .text_size(px(14.0))
                        .text_color(c(0xEF4444))
                        .child("⚠️"),
                )
                .child(
                    div()
                        .text_size(px(12.0))
                        .text_color(c(0xFCA5A5))
                        .font_weight(FontWeight::MEDIUM)
                        .child(msg),
                ),
        )
        .child(
            div()
                .id("dismiss-error-banner")
                .cursor_pointer()
                .px(px(8.0))
                .py(px(4.0))
                .bg(c(0x3B1818))
                .hover(|s| s.bg(c(0xEF4444)))
                .rounded(px(4.0))
                .on_click(move |_: &ClickEvent, window, cx| cb(window, cx))
                .child(
                    div()
                        .text_size(px(12.0))
                        .font_weight(FontWeight::BOLD)
                        .text_color(c(0xFFFFFF))
                        .child("✕"),
                ),
        )
}


/// Modal dialog popup centered untuk error / exception (file not found, empty path, spawn failure, catalog error)
pub fn modal_error(
    title: &str,
    message: &str,
    on_close: impl Fn(&mut Window, &mut App) + 'static + Clone,
) -> impl IntoElement {
    let title_s = title.to_string();
    let msg_s = message.to_string();
    let cb_backdrop = on_close.clone();
    let cb_btn = on_close.clone();

    div()
        .id("launcher-modal-error-backdrop")
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        .bg(c(0x000000))
        .opacity(0.85)
        .flex()
        .items_center()
        .justify_center()
        .on_click(move |_: &ClickEvent, window: &mut Window, cx: &mut App| {
            cb_backdrop(window, cx);
        })
        .child(
            div()
                .id("launcher-modal-error-card")
                .w(px(460.0))
                .bg(c(0x121212))
                .border_1()
                .border_color(c(0xEF4444))
                .rounded(px(12.0))
                .p(px(24.0))
                .flex()
                .flex_col()
                .items_center()
                .gap(px(16.0))
                .on_click(|_: &ClickEvent, _, _| {})
                .child(
                    div()
                        .w(px(52.0))
                        .h(px(52.0))
                        .rounded(px(26.0))
                        .bg(c(0x2A1212))
                        .border_1()
                        .border_color(c(0xEF4444))
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(
                            div()
                                .text_size(px(24.0))
                                .text_color(c(0xEF4444))
                                .child("⚠️"),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap(px(6.0))
                        .child(
                            div()
                                .text_size(px(16.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0xFFFFFF))
                                .child(title_s),
                        )
                        .child(
                            div()
                                .text_size(px(13.0))
                                .text_color(c(0xD4D4D4))
                                .text_align(gpui_kit::TextAlign::Center)
                                .line_height(px(19.0))
                                .child(msg_s),
                        ),
                )
                .child(
                    div()
                        .id("btn-close-error-modal")
                        .cursor_pointer()
                        .mt(px(8.0))
                        .px(px(28.0))
                        .h(px(36.0))
                        .bg(c(0x2A1212))
                        .border_1()
                        .border_color(c(0xEF4444))
                        .rounded(px(6.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .hover(|s| s.bg(c(0xEF4444)))
                        .on_click(move |_: &ClickEvent, window: &mut Window, cx: &mut App| {
                            cb_btn(window, cx);
                        })
                        .child(
                            div()
                                .text_size(px(13.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0xFFFFFF))
                                .child("Mengerti / Tutup"),
                        ),
                ),
        )
}

/// Modal dialog popup centered untuk animasi feedback "Sedang Dijalankan..." (3 detik)
pub fn modal_launching(
    game_name: &str,
    tick: usize, // 0..=30 (tiap 100ms)
    on_close: impl Fn(&mut Window, &mut App) + 'static + Clone,
) -> impl IntoElement {
    let name = game_name.to_string();
    let cb_close = on_close.clone();

    let inner_w = 392.0_f32;
    let progress_pct = (tick as f32 / 30.0).clamp(0.0, 1.0);
    let bar_w = (inner_w * progress_pct).max(8.0);
    let secs_left = ((30 - tick.min(30)) as f32 / 10.0).ceil() as usize;

    div()
        .id("launcher-modal-launching-backdrop")
        .absolute()
        .top_0()
        .left_0()
        .size_full()
        .bg(c(0x000000))
        .opacity(0.85)
        .flex()
        .items_center()
        .justify_center()
        .on_click(move |_: &ClickEvent, window: &mut Window, cx: &mut App| {
            cb_close(window, cx);
        })
        .child(
            div()
                .id("launcher-modal-launching-card")
                .w(px(440.0))
                .bg(c(0x111111))
                .border_1()
                .border_color(c(0x34D399))
                .rounded(px(12.0))
                .p(px(24.0))
                .flex()
                .flex_col()
                .items_center()
                .gap(px(14.0))
                .on_click(|_: &ClickEvent, _, _| {})
                .child(
                    div()
                        .w(px(52.0))
                        .h(px(52.0))
                        .rounded(px(26.0))
                        .bg(c(0x064E3B))
                        .border_1()
                        .border_color(c(0x10B981))
                        .flex()
                        .items_center()
                        .justify_center()
                        .child(
                            div()
                                .text_size(px(22.0))
                                .child("🚀"),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap(px(4.0))
                        .child(
                            div()
                                .text_size(px(16.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0xFFFFFF))
                                .child("Sedang Membuka Aplikasi..."),
                        )
                        .child(
                            div()
                                .text_size(px(15.0))
                                .font_weight(FontWeight::BOLD)
                                .text_color(c(0x34D399))
                                .child(name),
                        )
                        .child(
                            div()
                                .text_size(px(12.0))
                                .text_color(c(0xA3A3A3))
                                .child("Mempersiapkan program di latar belakang"),
                        ),
                )
                // Progress Bar Container (Animasi 3 detik)
                .child(
                    div()
                        .w_full()
                        .h(px(5.0))
                        .bg(c(0x262626))
                        .rounded(px(3.0))
                        .overflow_hidden()
                        .mt(px(6.0))
                        .child(
                            div()
                                .h_full()
                                .w(px(bar_w))
                                .bg(c(0x34D399))
                                .rounded(px(3.0)),
                        ),
                )
                .child(
                    div()
                        .text_size(px(11.0))
                        .text_color(c(0x6B7280))
                        .child(format!("Menutup otomatis dalam {} detik...", secs_left)),
                ),
        )
}

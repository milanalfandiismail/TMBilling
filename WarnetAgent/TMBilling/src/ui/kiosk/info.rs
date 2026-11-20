use gpui_kit::prelude::*;
use gpui_kit::*;

use crate::state::{page_count, TmApp};
use crate::theme::TM;
use crate::ui::html;
use crate::ui::kiosk::KioskActions;
use crate::ui::pager::TmPager;
use crate::ui::tabs::TmTabs;

const PAKET_PER_PAGE: usize = 4;

fn durasi(menit: i64) -> String {
    if menit > 0 && menit % 60 == 0 {
        format!("{} Jam", menit / 60)
    } else {
        format!("{menit} Menit")
    }
}

fn rupiah(n: i64) -> String {
    let s = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    let rev: String = out.chars().rev().collect();
    format!("Rp {rev}")
}

/// (nama, keterangan, harga) dari konfigurasi server.
fn paket_rows(app: &TmApp) -> Vec<(String, String, String)> {
    let Some(cfg) = &app.cfg else { return Vec::new() };
    cfg.paket
        .iter()
        .filter_map(|p| {
            let nama = p.get("nama")?.as_str()?.to_string();
            let menit = p.get("durasi_menit").and_then(|v| v.as_i64()).unwrap_or(0);
            let harga = p.get("harga").and_then(|v| v.as_i64()).unwrap_or(0);
            Some((nama, durasi(menit), rupiah(harga)))
        })
        .collect()
}

fn paket_row(nama: String, ket: String, harga: String) -> impl IntoElement {
    div()
        .flex_shrink_0()
        .w_full()
        .h(px(64.0))
        .flex()
        .flex_row()
        .items_center()
        .justify_between()
        .child(
            div()
                .flex()
                .flex_col()
                .gap(px(4.0))
                .child(div().text_size(px(13.0)).text_color(TM.text).child(nama))
                .child(div().text_size(px(11.0)).text_color(TM.dim).child(ket)),
        )
        .child(div().text_size(px(17.0)).text_color(TM.text).child(harga))
}

fn body(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    let tab = app.login.info_tab;
    let page = app.login.info_page;
    if tab == 1 {
        let rows = paket_rows(app);
        let per = PAKET_PER_PAGE;
        let total = page_count(rows.len(), per);
        let from = (page.saturating_sub(1)) * per;
        let mut list = div().flex().flex_col().w_full();
        if rows.is_empty() {
            list = list.child(
                div()
                    .text_size(px(12.0))
                    .text_color(TM.dim)
                    .child("Belum ada paket aktif."),
            );
        }
        for (nama, ket, harga) in rows.into_iter().skip(from).take(per) {
            list = list.child(paket_row(nama, ket, harga));
        }
        return div()
            .flex()
            .flex_col()
            .w_full()
            .child(
                div()
                    .mt(px(16.0))
                    .text_size(px(if compact { 14.0 } else { 15.0 }))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(TM.text)
                    .child("Paket bermain"),
            )
            .child(
                div()
                    .mt(px(6.0))
                    .text_size(px(11.0))
                    .text_color(TM.dim)
                    .child("Harga per sesi, bayar di kasir."),
            )
            .child(div().mt(px(16.0)).child(list))
            .child(pager(app, total, compact, actions));
    }
    let announcement = app
        .cfg
        .as_ref()
        .and_then(|c| c.announcement.clone())
        .unwrap_or_default();
    let has_html = !announcement.trim().is_empty();
    let rules = if has_html {
        html::render_html(&announcement, if compact { 11.0 } else { 12.0 }, TM.muted)
    } else {
        div()
            .text_size(px(12.0))
            .text_color(TM.dim)
            .child("Tidak ada aturan aktif.")
            .into_any_element()
    };
    // HTML dari server sudah memuat judulnya sendiri; heading statis hanya untuk teks polos
    let heading = if has_html {
        div().into_any_element()
    } else {
        div()
            .mt(px(if compact { 0.0 } else { 14.0 }))
            .ml(px(if compact { 0.0 } else { 8.0 }))
            .text_size(px(if compact { 14.0 } else { 15.0 }))
            .when(compact, |d| d.line_height(px(16.0)))
            .font_weight(FontWeight::SEMIBOLD)
            .text_color(TM.text)
            .child("Aturan Warnet")
            .into_any_element()
    };
    div()
        .flex()
        .flex_col()
        .w_full()
        .child(heading)
        .child(
            div()
                .flex()
                .flex_col()
                .mt(px(8.0))
                .overflow_hidden()
                .child(rules),
        )
}

fn pager(app: &TmApp, total: usize, compact: bool, actions: &KioskActions) -> impl IntoElement {
    let page = app.login.info_page;
    let on_change = actions.page.clone();
    let (w, h) = if compact { (108.0, 24.0) } else { (132.0, 28.0) };
    div().mt(px(12.0)).w_full().flex().flex_row().justify_end().child(
        TmPager::new(page, total, w, h)
            .id_prefix("kiosk-pager")
            .on_change(move |p, w, cx| on_change(p, w, cx))
            .render(),
    )
}

pub fn screen(app: &TmApp, compact: bool, actions: &KioskActions) -> impl IntoElement {
    let on_change = actions.tab.clone();
    let tabs = TmTabs::new(vec!["Aturan", "Paket"], app.login.info_tab)
        .id_prefix("kiosk-info")
        .item_width(if compact { 120.0 } else { 152.0 })
        .on_change(move |i, window, cx| on_change(i, window, cx))
        .render();
    if compact {
        return div()
            .flex_shrink_0()
            .mt(px(16.0))
            .w_full()
            .h(px(200.0))
            .p(px(20.0))
            .rounded(px(TM.radius_xl))
            .bg(TM.card)
            .border_1()
            .border_color(TM.border)
            .flex()
            .flex_col()
            .when(!compact, |d| d.child(tabs))
            .child(body(app, true, actions));
    }
    div()
        .w(px(752.0))
        .h(px(559.0))
        .p(px(32.0))
        .rounded(px(TM.radius_xl))
        .bg(TM.card)
        .border_1()
        .border_color(TM.border)
        .flex()
        .flex_col()
        .child(div().ml(px(16.0)).w(px(448.0)).child(tabs))
        .child(body(app, false, actions))
}
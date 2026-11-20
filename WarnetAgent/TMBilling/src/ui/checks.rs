use crate::theme::{c, TM};
use crate::ui::button::{tone_colors, ButtonTone};
use crate::ui::pager::step;

#[test]
fn tones_match_the_figcraft_masters() {
    assert_eq!(tone_colors(ButtonTone::Primary), (TM.accent, c(0x050505), None));
    assert_eq!(
        tone_colors(ButtonTone::Ghost),
        (TM.card, TM.text, Some(TM.border_strong))
    );
    assert_eq!(tone_colors(ButtonTone::Danger).0, c(0x2A1414));
    assert_eq!(tone_colors(ButtonTone::Warn).1, TM.warn);
}

#[test]
fn pages_clamp_at_both_ends() {
    assert_eq!(step(1, 4, -1), 1);
    assert_eq!(step(2, 4, 1), 3);
    assert_eq!(step(4, 4, 1), 4);
}

#[test]
fn empty_list_still_reports_page_one() {
    assert_eq!(step(1, 0, -1), 1);
}

#[test]
fn rules_page_count_rounds_up() {
    assert_eq!(crate::state::page_count(6, 6), 1);
    assert_eq!(crate::state::page_count(7, 6), 2);
    assert_eq!(crate::state::page_count(4, 4), 1);
    assert_eq!(crate::state::page_count(5, 4), 2);
    assert_eq!(crate::state::page_count(0, 6), 1);
}

#[test]
fn overlay_clock_pads_hours() {
    use crate::ui::overlay::card::clock;
    assert_eq!(clock(5078), "01:24:38");
    assert_eq!(clock(59), "00:00:59");
    assert_eq!(clock(-5), "00:00:00");
}

#[test]
fn volume_clamps_to_100() {
    use crate::platform::audio::clamp_volume;
    assert_eq!(clamp_volume(140), 100);
    assert_eq!(clamp_volume(0), 0);
}

#[test]
fn rupiah_groups_thousands() {
    assert_eq!(crate::ui::overlay::modals::rupiah(45_000), "Rp 45.000");
    assert_eq!(crate::ui::overlay::modals::rupiah(1_250_000), "Rp 1.250.000");
    assert_eq!(crate::ui::overlay::modals::rupiah(0), "Rp 0");
}

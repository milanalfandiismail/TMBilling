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

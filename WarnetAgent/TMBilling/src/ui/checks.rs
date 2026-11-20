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
fn rupiah_groups_thousands() {
    assert_eq!(crate::ui::overlay::modals::rupiah(45_000), "Rp 45.000");
    assert_eq!(crate::ui::overlay::modals::rupiah(1_250_000), "Rp 1.250.000");
    assert_eq!(crate::ui::overlay::modals::rupiah(0), "Rp 0");
}

#[test]
fn remote_commands_map_to_actions() {
    use crate::state::{remote_action, RemoteAction};
    assert_eq!(remote_action("lock"), Some(RemoteAction::Lock));
    assert_eq!(remote_action("logout"), Some(RemoteAction::Lock));
    assert_eq!(remote_action("shutdown"), Some(RemoteAction::Shutdown));
    assert_eq!(remote_action("restart"), Some(RemoteAction::Restart));
    assert_eq!(remote_action("screenshot"), None);
}

#[test]
fn login_error_maps_status_codes() {
    use crate::state::login_error;
    assert_eq!(
        login_error(401, Some("Username atau password salah")),
        "Username atau password salah."
    );
    assert_eq!(
        login_error(400, Some("Waktu habis")),
        "Waktu bermain habis. Silakan top-up di kasir."
    );
    assert_eq!(
        login_error(429, Some("Terlalu banyak percobaan login. Coba lagi dalam 5 menit.")),
        "Terlalu banyak percobaan login. Coba lagi dalam 5 menit."
    );
    assert_eq!(
        login_error(0, None),
        "Tidak bisa menghubungi server. Cek koneksi LAN."
    );
}

#[test]
fn power_confirmation_is_explicit() {
    use crate::state::{power_title, PowerAction};
    assert_eq!(power_title(PowerAction::Shutdown), "Matikan komputer?");
    assert_eq!(power_title(PowerAction::Restart), "Restart komputer?");
}

#[test]
fn admin_hotkey_only_on_kiosk() {
    assert!(crate::state::admin_hotkey_allowed(false));
    assert!(!crate::state::admin_hotkey_allowed(true));
}

#[test]
fn admin_fields_are_separate_from_login() {
    let mut login = crate::state::LoginState::default();
    login.admin_type_char('a');
    login.admin_focus_next();
    login.admin_type_char('b');
    assert_eq!(login.admin_credentials(), ("a", "b"));
    assert_eq!(login.admin_masked(), "*");
    assert!(login.username.is_empty() && login.password.is_empty());
}

#[test]
fn view_follows_server_status() {
    assert_eq!(crate::state::view_for_status("aktif"), crate::state::View::Overlay);
    assert_eq!(crate::state::view_for_status("admin"), crate::state::View::Overlay);
    assert_eq!(crate::state::view_for_status("kosong"), crate::state::View::Kiosk);
    assert_eq!(crate::state::view_for_status("error"), crate::state::View::Kiosk);
}

#[test]
fn login_success_does_not_switch_view_by_itself() {
    let app = crate::state::TmApp {
        session: Some(crate::state::Session {
            nama: "budi".into(),
            grup: "REGULAR".into(),
            pc_kode: "PC-12".into(),
            is_member: true,
            is_emergency: false,
        }),
        ..Default::default()
    };
    assert_eq!(app.view, crate::state::View::Kiosk);
}

#[test]
fn html_text_is_extracted_without_tags() {
    let html = "<p>Dilarang <b>membawa</b> makanan</p><ul><li>Satu</li><li>Dua</li></ul>";
    let text = crate::ui::html::text_of(html);
    assert!(text.contains("Dilarang membawa makanan"));
    assert!(text.contains("Satu"));
    assert!(!text.contains('<'));
}

#[test]
fn html_colors_are_parsed() {
    assert_eq!(
        crate::ui::html::parse_color("#34d399"),
        Some(crate::theme::c(0x34D399))
    );
    assert_eq!(
        crate::ui::html::parse_color("rgb(255, 0, 0)"),
        Some(crate::theme::c(0xFF0000))
    );
    assert_eq!(crate::ui::html::parse_color("inherit"), None);
}

#[test]
fn human_time_matches_tauri_format() {
    assert_eq!(crate::state::human_time(5400), "1 jam 30 menit");
    assert_eq!(crate::state::human_time(1800), "30 menit");
    assert_eq!(crate::state::human_time(3600), "1 jam");
    assert_eq!(crate::state::human_time(59), "0 menit");
    assert_eq!(crate::state::human_time(0), "Sesi Berakhir");
    assert_eq!(crate::state::human_time(-5), "Sesi Berakhir");
}

#[test]
fn shutdown_counts_down_and_stops_at_zero() {
    assert_eq!(crate::state::tick_shutdown(Some(2)), Some(1));
    assert_eq!(crate::state::tick_shutdown(Some(1)), None);
    assert_eq!(crate::state::tick_shutdown(None), None);
}

#[test]
fn quick_tools_launch_windows_applets() {
    use crate::ui::overlay::ToolId;
    assert_eq!(
        crate::ui::overlay::tool_command(ToolId::Volume),
        Some(("sndvol.exe", &[][..]))
    );
    assert_eq!(
        crate::ui::overlay::tool_command(ToolId::Mouse),
        Some(("control.exe", &["main.cpl"][..]))
    );
    assert_eq!(
        crate::ui::overlay::tool_command(ToolId::Keyboard),
        Some(("control.exe", &["keyboard"][..]))
    );
    assert_eq!(crate::ui::overlay::tool_command(ToolId::Lock), None);
}

#[test]
fn close_behaviour_follows_mode() {
    use crate::state::{close_action, hook_should_be_enabled, CloseAction, Modal, View};
    assert_eq!(close_action(true), CloseAction::Minimize);
    assert_eq!(close_action(false), CloseAction::Block);
    assert!(hook_should_be_enabled(View::Kiosk, None));
    assert!(!hook_should_be_enabled(View::Overlay, None));
    assert!(hook_should_be_enabled(View::Overlay, Some(Modal::AfkPin)));
}

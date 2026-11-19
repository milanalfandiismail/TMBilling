use crate::api::client::is_emergency_response;
use crate::api::models::{IdentifyResponse, StatusResponse, WarnetConfig};
use crate::polling::AppEvent;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Session {
    pub nama: String,
    pub grup: String,
    pub pc_kode: String,
    pub is_member: bool,
    pub is_emergency: bool,
}

/// State murni tanpa gpui supaya transisinya bisa dites tanpa window.
#[derive(Default)]
pub struct TmApp {
    pub cfg: Option<WarnetConfig>,
    pub session: Option<Session>,
    pub remaining_secs: i64,
    pub shutdown_secs: Option<i64>,
    pub connected: bool,
    pub pc_kode: String,
    pub login: LoginState,
    pub client: Option<crate::api::client::ApiClient>,
    pub focus: Option<gpui_kit::FocusHandle>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LoginField {
    #[default]
    Username,
    Password,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PowerAction {
    Restart,
    Shutdown,
}

/// Layar login kiosk. Murni tanpa gpui supaya input bisa dites.
/// Halaman dibulatkan ke atas; daftar kosong tetap satu halaman.
pub fn page_count(total: usize, per_page: usize) -> usize {
    if per_page == 0 {
        return 1;
    }
    let pages = total.div_ceil(per_page);
    if pages == 0 { 1 } else { pages }
}

#[derive(Debug, Default)]
pub struct LoginState {
    pub username: String,
    pub password: String,
    pub field: LoginField,
    pub error: Option<String>,
    pub busy: bool,
    pub power: Option<PowerAction>,
    pub qris_full: bool,
    pub info_tab: usize,
    pub info_page: usize,
}

impl LoginState {
    fn active_mut(&mut self) -> &mut String {
        match self.field {
            LoginField::Username => &mut self.username,
            LoginField::Password => &mut self.password,
        }
    }

    pub fn type_char(&mut self, ch: char) -> bool {
        if ch.is_control() {
            return false;
        }
        self.active_mut().push(ch);
        self.error = None;
        true
    }

    pub fn backspace(&mut self) -> bool {
        if self.active_mut().pop().is_none() {
            return false;
        }
        self.error = None;
        true
    }

    pub fn focus_next(&mut self) {
        self.field = match self.field {
            LoginField::Username => LoginField::Password,
            LoginField::Password => LoginField::Username,
        };
    }

    pub fn can_submit(&self) -> bool {
        !self.busy && !self.username.trim().is_empty() && !self.password.is_empty()
    }

    pub fn masked_password(&self) -> String {
        "*".repeat(self.password.chars().count())
    }
}

impl TmApp {
    pub fn reduce(&mut self, event: AppEvent) -> bool {
        match event {
            AppEvent::Config(cfg) => {
                self.cfg = Some(cfg);
                true
            }
            AppEvent::Identified(res) => self.apply_identify(res),
            AppEvent::Status(status) => self.apply_status(status),
            AppEvent::TimeUpdate(secs) => {
                if self.remaining_secs == secs {
                    return false;
                }
                self.remaining_secs = secs;
                true
            }
            // shortcut: perintah eksekusi (lock/shutdown/restart/screenshot) dipasang Task 8/10/12
            AppEvent::Command(_) => false,
        }
    }

    fn apply_identify(&mut self, res: IdentifyResponse) -> bool {
        if !res.valid {
            return false;
        }
        let was_offline = !self.connected;
        self.connected = true;
        if let Some(kode) = res.pc_kode {
            self.pc_kode = kode;
        }
        was_offline
    }

    fn apply_status(&mut self, status: StatusResponse) -> bool {
        self.connected = true;
        match status.status.as_str() {
            "kosong" | "error" => {
                self.session = None;
                self.remaining_secs = 0;
                self.shutdown_secs = None;
            }
            _ => {
                self.session = Some(Session {
                    is_emergency: is_emergency_response(&status.status, status.nama.as_deref()),
                    nama: status.nama.unwrap_or_default(),
                    grup: status.grup.unwrap_or_default(),
                    pc_kode: status.pc_kode.unwrap_or_default(),
                    is_member: status.is_member.unwrap_or(false),
                });
                self.remaining_secs = status.sisa_waktu.unwrap_or(0) as i64;
                self.shutdown_secs = status.shutdown_timer.filter(|t| *t > 0).map(i64::from);
            }
        }
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status(kind: &str, sisa: Option<u32>) -> StatusResponse {
        StatusResponse {
            status: kind.to_string(),
            sisa_waktu: sisa,
            nama: Some("budi".into()),
            grup: Some("REGULAR".into()),
            ..Default::default()
        }
    }

    #[test]
    fn empty_status_clears_the_session() {
        let mut app = TmApp::default();
        app.reduce(AppEvent::Status(status("aktif", Some(60))));
        assert!(app.session.is_some());
        app.reduce(AppEvent::Status(status("kosong", Some(0))));
        assert!(app.session.is_none());
        assert_eq!(app.remaining_secs, 0);
    }

    #[test]
    fn active_status_carries_member_and_shutdown_timer() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(120));
        st.is_member = Some(true);
        st.shutdown_timer = Some(600);
        app.reduce(AppEvent::Status(st));
        let session = app.session.unwrap();
        assert!(session.is_member);
        assert_eq!(app.remaining_secs, 120);
        assert_eq!(app.shutdown_secs, Some(600));
    }

    #[test]
    fn zero_shutdown_timer_means_no_countdown() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(10));
        st.shutdown_timer = Some(0);
        app.reduce(AppEvent::Status(st));
        assert_eq!(app.shutdown_secs, None);
    }

    #[test]
    fn identical_time_update_does_not_repaint() {
        let mut app = TmApp::default();
        assert!(app.reduce(AppEvent::TimeUpdate(30)));
        assert!(!app.reduce(AppEvent::TimeUpdate(30)));
    }

    #[test]
    fn system_status_is_emergency() {
        let mut app = TmApp::default();
        let mut st = status("system", Some(999999));
        st.nama = Some("SYSTEM".into());
        app.reduce(AppEvent::Status(st));
        assert!(app.session.unwrap().is_emergency);
    }

    #[test]
    fn typing_goes_to_the_active_field() {
        let mut s = LoginState::default();
        s.type_char('b');
        s.focus_next();
        s.type_char('x');
        assert_eq!(s.username, "b");
        assert_eq!(s.password, "x");
        assert!(s.backspace());
        assert_eq!(s.masked_password(), "");
    }

    #[test]
    fn submit_needs_both_fields() {
        let mut s = LoginState::default();
        assert!(!s.can_submit());
        s.username = " budi ".into();
        assert!(!s.can_submit());
        s.password = "rahasia".into();
        assert!(s.can_submit());
    }
}

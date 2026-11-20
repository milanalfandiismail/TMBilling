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

/// Layar mana yang dirender. Server status yang menentukan, bukan respons login.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum View {
    #[default]
    Kiosk,
    Overlay,
}

/// True saat kartu overlay tampil; dipakai handler close window.
pub static OVERLAY_MODE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseAction {
    Block,
    Minimize,
}

pub fn close_action(overlay: bool) -> CloseAction {
    if overlay {
        CloseAction::Minimize
    } else {
        CloseAction::Block
    }
}

/// Hook keyboard wajib hidup di kiosk dan saat PIN AFK, mati di overlay.
pub fn hook_should_be_enabled(view: View, modal: Option<Modal>) -> bool {
    view == View::Kiosk || modal == Some(Modal::AfkPin)
}

/// Modal overlay butuh seluruh layar; jendela kartu 380x268 memotong dialognya.
pub fn modal_fullscreen(view: View, modal: Option<Modal>) -> bool {
    view == View::Overlay && modal.is_some()
}

pub fn view_for_status(status: &str) -> View {
    match status {
        "kosong" | "error" => View::Kiosk,
        _ => View::Overlay,
    }
}

/// State murni tanpa gpui supaya transisinya bisa dites tanpa window.
#[derive(Default)]
pub struct TmApp {
    pub cfg: Option<WarnetConfig>,
    pub view: View,
    pub session: Option<Session>,
    pub remaining_secs: i64,
    pub shutdown_secs: Option<i64>,
    pub connected: bool,
    pub pc_kode: String,
    pub login: LoginState,
    pub client: Option<crate::api::client::ApiClient>,
    pub focus: Option<gpui_kit::FocusHandle>,
    pub close_hooked: bool,
    /// Jam lokal saat sesi pertama kali terlihat aktif di klien ini.
    pub started_at: Option<(u8, u8)>,
    pub alerts: AlertFlags,
    pub auth_busy: bool,
    /// Layar overlay dipaksa tampil untuk verifikasi visual.
    pub demo_overlay: bool,
    pub overlay_tab: usize,
    pub locked: bool,
    /// Login sudah diterima server, menunggu status pertama yang mengonfirmasi sesi.
    pub login_pending: bool,
    pub modal: Option<Modal>,
    // dipakai modal konfirmasi power di Task 4
    #[allow(dead_code)]
    /// (window is the small overlay card, modal needs the whole screen)
    pub applied_mode: Option<(bool, bool, usize)>,
    pub saved_rect: Option<(i32, i32, i32, i32)>,
    pub taskbar_guard: Option<crate::platform::window_manager::TaskbarGuard>,
    pub pin: String,
    pub menu_page: usize,
    pub member_json: Option<serde_json::Value>,
    /// QRIS asli dari server; tile mock hanya dipakai bila None.
    pub qris_image: Option<std::sync::Arc<gpui_kit::Image>>,
}

/// Perintah server yang harus dieksekusi klien (sama dengan polling.rs Tauri).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteAction {
    Lock,
    Shutdown,
    Restart,
}

pub fn remote_action(cmd: &str) -> Option<RemoteAction> {
    match cmd {
        "lock" | "logout" | "afk_lock" => Some(RemoteAction::Lock),
        "shutdown" => Some(RemoteAction::Shutdown),
        "restart" => Some(RemoteAction::Restart),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LoginField {
    #[default]
    Username,
    Password,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Alert {
    Min15,
    Min5,
    Min1,
}

/// Flag sekali-per-sesi seperti klien Tauri: reset hanya saat waktu bertambah.
#[derive(Debug, Default, Clone, Copy)]
pub struct AlertFlags {
    pub m15: bool,
    pub m5: bool,
    pub m1: bool,
}

impl AlertFlags {
    pub fn update(&mut self, secs: i64) -> Option<Alert> {
        if secs > 900 {
            self.m15 = false;
            self.m5 = false;
            self.m1 = false;
        } else if secs > 300 {
            self.m5 = false;
            self.m1 = false;
        } else if secs > 60 {
            self.m1 = false;
        }
        if secs <= 0 {
            return None;
        }
        if secs <= 900 && !self.m15 {
            self.m15 = true;
            return Some(Alert::Min15);
        }
        if secs <= 300 && !self.m5 {
            self.m5 = true;
            return Some(Alert::Min5);
        }
        if secs <= 60 && !self.m1 {
            self.m1 = true;
            return Some(Alert::Min1);
        }
        None
    }
}

/// Jam tidak boleh mundur hanya karena polling mengirim menit bulat lagi.
pub fn sync_remaining(current: i64, server_secs: i64) -> i64 {
    let drift = server_secs - current;
    if current <= 0 || drift.abs() > 60 {
        server_secs
    } else {
        current
    }
}

/// Kunci meja sekali saat waktu habis, bukan berulang tiap detik.
pub fn should_autolock(remaining: i64, locked: bool, has_session: bool) -> bool {
    remaining <= 0 && !locked && has_session
}

/// Respons kosong tanpa shutdown_timer berarti tidak ada hitung mundur.
pub fn shutdown_from_status(timer: Option<u32>, command: Option<&str>) -> Option<i64> {
    if command == Some("lock") {
        return None;
    }
    timer.filter(|t| *t > 0).map(i64::from)
}

/// Modal overlay yang sedang terbuka.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Modal {
    Member,
    Menu,
    Detail(usize),
    QrisFull,
    AfkPin,
    Logout,
    Admin,
    #[allow(dead_code)]
    Power(PowerAction),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PowerAction {
    Restart,
    Shutdown,
}

/// Layar login kiosk. Murni tanpa gpui supaya input bisa dites.
/// Format durasi seperti klien Tauri: "1 jam 30 menit", "30 menit", "Sesi Berakhir".
pub fn human_time(secs: i64) -> String {
    if secs <= 0 {
        return "Sesi Berakhir".to_string();
    }
    let minutes = secs / 60;
    let hours = minutes / 60;
    let rest = minutes % 60;
    match (hours, rest) {
        (0, 0) => "0 menit".to_string(),
        (0, m) => format!("{m} menit"),
        (h, 0) => format!("{h} jam"),
        (h, m) => format!("{h} jam {m} menit"),
    }
}

/// Hasil satu detik hitung mundur shutdown.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShutdownTick {
    Idle,
    Counting(i64),
    Fire,
}

/// Hitung mundur shutdown; nol memicu aksi, bukan berhenti diam.
pub fn tick_shutdown(current: Option<i64>) -> ShutdownTick {
    match current {
        None => ShutdownTick::Idle,
        Some(secs) if secs > 1 => ShutdownTick::Counting(secs - 1),
        Some(_) => ShutdownTick::Fire,
    }
}

/// Sisa waktu lokal berkurang satu detik, tidak pernah negatif.
pub fn tick_remaining(remaining: i64) -> i64 {
    (remaining - 1).max(0)
}

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
    pub admin_user: String,
    pub admin_pass: String,
    pub admin_field: LoginField,
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

    fn admin_active_mut(&mut self) -> &mut String {
        match self.admin_field {
            LoginField::Username => &mut self.admin_user,
            LoginField::Password => &mut self.admin_pass,
        }
    }

    pub fn admin_type_char(&mut self, ch: char) -> bool {
        if ch.is_control() {
            return false;
        }
        self.admin_active_mut().push(ch);
        self.error = None;
        true
    }

    pub fn admin_backspace(&mut self) -> bool {
        if self.admin_active_mut().pop().is_none() {
            return false;
        }
        self.error = None;
        true
    }

    pub fn admin_focus_next(&mut self) {
        self.admin_field = match self.admin_field {
            LoginField::Username => LoginField::Password,
            LoginField::Password => LoginField::Username,
        };
    }

    pub fn admin_masked(&self) -> String {
        "*".repeat(self.admin_pass.chars().count())
    }

    /// Username di-trim, password apa adanya.
    pub fn admin_credentials(&self) -> (&str, &str) {
        (self.admin_user.trim(), &self.admin_pass)
    }
}

pub fn admin_hotkey_allowed(has_session: bool) -> bool {
    !has_session
}

// dipakai modal konfirmasi power di Task 4
#[allow(dead_code)]
pub fn power_title(action: PowerAction) -> &'static str {
    match action {
        PowerAction::Restart => "Restart komputer?",
        PowerAction::Shutdown => "Matikan komputer?",
    }
}

#[allow(dead_code)]
/// Pesan error login untuk layar kiosk. Status 0 berarti server tidak terjangkau.
pub fn login_error(status: u16, message: Option<&str>) -> String {
    let msg = message.unwrap_or("").trim();
    if status == 0 {
        return "Tidak bisa menghubungi server. Cek koneksi LAN.".into();
    }
    if status == 400 && msg.contains("Waktu habis") {
        return "Waktu bermain habis. Silakan top-up di kasir.".into();
    }
    if !msg.is_empty() {
        return if msg.ends_with('.') {
            msg.to_string()
        } else {
            format!("{msg}.")
        };
    }
    "Gagal masuk. Coba lagi.".into()
}

impl TmApp {
    #[cfg(test)]
    pub(crate) fn apply_status_for_test(&mut self, status: crate::api::models::StatusResponse) {
        self.apply_status(status);
    }

    /// Hasil login dipakai bersama oleh login member dan admin.
    pub fn apply_login_result(&mut self, ok: bool, err: Option<&str>) {
        self.auth_busy = false;
        if ok {
            self.login.error = None;
            return;
        }
        self.login.error = err.map(str::to_string).or_else(|| {
            Some("Gagal masuk. Coba lagi.".to_string())
        });
    }

    pub fn reduce(&mut self, event: AppEvent) -> bool {
        match event {
            AppEvent::Config(cfg) => {
                self.cfg = Some(cfg);
                true
            }
            AppEvent::Identified(res) => self.apply_identify(res),
            AppEvent::Status(status) => {
                if status.member.is_some() {
                    self.member_json = status.member.clone();
                }
                self.apply_status(status)
            }
            AppEvent::TimeUpdate(secs) => {
                if self.remaining_secs == secs {
                    return false;
                }
                self.remaining_secs = secs;
                true
            }
            AppEvent::Command(_) => false,
            AppEvent::Qris(image) => {
                self.qris_image = image;
                true
            }
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
        self.view = view_for_status(&status.status);
        match status.status.as_str() {
            "kosong" | "error" => {
                self.session = None;
                self.remaining_secs = 0;
                self.shutdown_secs = None;
            }
            _ => {
                self.login_pending = false;
                self.session = Some(Session {
                    is_emergency: is_emergency_response(&status.status, status.nama.as_deref()),
                    nama: status.nama.unwrap_or_default(),
                    grup: status.grup.unwrap_or_default(),
                    pc_kode: status.pc_kode.unwrap_or_default(),
                    is_member: status.is_member.unwrap_or(false),
                });
                if self.started_at.is_none() {
                    self.started_at = Some(crate::platform::window::local_hhmm());
                }
                // server mengirim sisa waktu dalam MENIT, UI memakai detik
                let server_secs = status.sisa_waktu.unwrap_or(0) as i64 * 60;
                self.remaining_secs = sync_remaining(self.remaining_secs, server_secs);
                self.shutdown_secs =
                    shutdown_from_status(status.shutdown_timer, status.command.as_deref());
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
    fn server_minutes_become_seconds() {
        let mut app = TmApp::default();
        app.apply_status_for_test(status("aktif", Some(90)));
        assert_eq!(app.remaining_secs, 90 * 60);
    }

    #[test]
    fn view_does_not_change_until_status_says_aktif() {
        let mut app = TmApp {
            login_pending: true,
            ..TmApp::default()
        };
        app.apply_status_for_test(status("kosong", None));
        assert_eq!(app.view, View::Kiosk);
        assert!(
            app.login_pending,
            "kosong right after login must not clear the pending flag"
        );
    }

    #[test]
    fn warning_plays_once_per_threshold() {
        let mut f = AlertFlags::default();
        assert_eq!(f.update(900), Some(Alert::Min15));
        assert_eq!(f.update(899), None);
        assert_eq!(f.update(901), None);
        f.update(600);
        assert_eq!(f.update(300), Some(Alert::Min5));
        assert_eq!(f.update(299), None);
        assert_eq!(f.update(60), Some(Alert::Min1));
        assert_eq!(f.update(59), None);
    }

    #[test]
    fn top_up_rearms_the_warnings() {
        let mut f = AlertFlags::default();
        f.update(60);
        f.update(4000);
        assert_eq!(f.update(900), Some(Alert::Min15));
    }

    #[test]
    fn poll_does_not_rewind_the_clock() {
        assert_eq!(sync_remaining(389, 390), 389);
        assert_eq!(sync_remaining(389, 420), 389, "koreksi menit bulat diabaikan");
        assert_eq!(sync_remaining(389, 450), 450, "top-up diterima");
        assert_eq!(sync_remaining(389, 330), 389);
        assert_eq!(sync_remaining(389, 100), 100);
    }

    #[test]
    fn autolock_fires_once_when_time_runs_out() {
        assert!(should_autolock(0, false, true));
        assert!(!should_autolock(0, true, true));
        assert!(!should_autolock(0, false, false));
        assert!(!should_autolock(5, false, true));
    }

    #[test]
    fn lock_command_has_no_countdown() {
        assert_eq!(shutdown_from_status(None, Some("lock")), None);
        assert_eq!(shutdown_from_status(Some(180), None), Some(180));
        assert_eq!(shutdown_from_status(Some(0), None), None);
    }

    #[test]
    fn failed_admin_login_keeps_the_modal() {
        let mut app = TmApp {
            modal: Some(Modal::Admin),
            ..TmApp::default()
        };
        app.apply_login_result(false, Some("Username atau password salah"));
        assert_eq!(app.modal, Some(Modal::Admin));
        assert_eq!(
            app.login.error.as_deref(),
            Some("Username atau password salah")
        );
        assert!(!app.auth_busy);
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
        assert_eq!(app.remaining_secs, 120 * 60);
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

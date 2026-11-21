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
/// Polling harus mengirim role admin agar server tidak mematikan mode admin.
pub static ADMIN_MODE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

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
/// Overlay dapat memakai jendela transparan hanya bila DirectComposition aktif.
/// gpui memakai jalur itu kecuali dimatikan lewat env, dan tanpa alpha layar

pub fn hook_should_be_enabled(view: View, modal: Option<Modal>, is_afk: bool) -> bool {
    view == View::Kiosk || is_afk || modal == Some(Modal::AfkPin)
}

/// Modal overlay butuh seluruh layar; jendela kartu 380x268 memotong dialognya.
pub fn modal_fullscreen(view: View, modal: Option<Modal>) -> bool {
    view == View::Overlay && modal.is_some()
}

fn is_admin_response(status: &str, nama: Option<&str>) -> bool {
    matches!(status, "admin" | "system") || is_emergency_response(status, nama)
}

/// Kredensial darurat dicocokkan offline seperti Tauri: kosong berarti fitur mati.
pub fn emergency_credentials_match(
    user_hash: &str,
    pass_hash: &str,
    stored_user: &str,
    stored_token: &str,
) -> bool {
    !stored_user.is_empty()
        && !stored_token.is_empty()
        && user_hash.eq_ignore_ascii_case(stored_user)
        && pass_hash.eq_ignore_ascii_case(stored_token)
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
    pub started_at: Option<String>,
    pub alerts: AlertFlags,
    pub auth_busy: bool,
    /// Layar overlay dipaksa tampil untuk verifikasi visual.
    pub demo_overlay: bool,
    pub overlay_tab: usize,
    /// Sesi AFK dari server; layar penuh terkunci sampai kredensial benar.
    pub is_afk: bool,
    /// Lock lokal baru dikirim, status server yang basi belum boleh membukanya.
    pub afk_pending: bool,
    pub afk_input: String,
    pub afk_error: Option<String>,
    pub afk_busy: bool,
    /// Login sudah diterima server, menunggu status pertama yang mengonfirmasi sesi.
    pub login_pending: bool,
    pub modal: Option<Modal>,
    // dipakai modal konfirmasi power di Task 4
    #[allow(dead_code)]
    /// (window is the small overlay card, modal needs the whole screen)
    pub applied_mode: Option<(bool, bool, usize)>,
    /// Rect terakhir yang benar-benar dipasang ke window.
    pub applied_rect: Option<(i32, i32, i32, i32)>,
    pub saved_rect: Option<(i32, i32, i32, i32)>,
    /// Sesi admin/emergency aktif: polling mengirim role admin.
    pub is_admin_session: bool,
    /// SHA-256 kredensial darurat dari registry/config.ini; kosong = fitur mati.
    pub emergency_user: String,
    pub emergency_token: String,
    pub taskbar_guard: Option<crate::platform::window_manager::TaskbarGuard>,
    pub pin: String,
    pub menu_page: usize,
    pub member_json: Option<serde_json::Value>,
    /// QRIS asli dari server; tile mock hanya dipakai bila None.
    pub qris_image: Option<std::sync::Arc<gpui_kit::Image>>,
    /// Modal QRIS fullscreen menahan gambar sampai geometri selesai.
    pub qris_hidden: bool,
    /// Fase kedip caret; di-toggle timer 530 ms hanya saat ada field aktif.
    pub caret_on: bool,
}

/// Perintah server yang harus dieksekusi klien (sama dengan polling.rs Tauri).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteAction {
    Lock,
    AfkLock,
    AfkUnlock,
    Shutdown,
    Restart,
}

pub fn remote_action(cmd: &str) -> Option<RemoteAction> {
    match cmd {
        "lock" | "logout" => Some(RemoteAction::Lock),
        "afk_lock" => Some(RemoteAction::AfkLock),
        "afk_unlock" => Some(RemoteAction::AfkUnlock),
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
        if secs <= 0 {
            return None;
        }
        // Top-up membuka kembali ambang yang lebih longgar (sama seperti klien Tauri).
        if secs > 900 {
            *self = AlertFlags::default();
        } else if secs > 300 {
            self.m5 = false;
            self.m1 = false;
        } else if secs > 60 {
            self.m1 = false;
        }
        // Pita yang sama dengan klien Tauri: hanya satu peringatan per lintasan.
        if secs <= 900 && secs > 300 && !self.m15 {
            self.m15 = true;
            Some(Alert::Min15)
        } else if secs <= 300 && secs > 60 && !self.m5 {
            self.m5 = true;
            Some(Alert::Min5)
        } else if secs <= 60 && !self.m1 {
            self.m1 = true;
            Some(Alert::Min1)
        } else {
            None
        }
    }
}

/// Polling mengirim menit bulat yang bisa lebih besar dari jam lokal (server baru
/// menurunkan angka tiap menit), jadi kenaikan kecil diabaikan. Hanya top-up
/// (> 1 menit di atas jam lokal) atau sesi yang dipotong jauh yang menimpa jam lokal.
pub fn sync_remaining(current: i64, server_secs: i64) -> i64 {
    if current <= 0 || server_secs > current + 60 || server_secs < current - 120 {
        server_secs
    } else {
        current
    }
}

/// Logout sekali saat waktu habis, termasuk saat layar sedang terkunci.
pub fn should_autolock(remaining: i64, has_session: bool) -> bool {
    remaining <= 0 && has_session
}

/// Timer shutdown hanya berjalan saat tidak ada sesi, dan hanya diarm sekali
/// supaya poll 5 detik tidak mengembalikannya ke nilai awal.
pub fn arm_shutdown(current: Option<i64>, timer: Option<u32>, has_session: bool) -> Option<i64> {
    if has_session {
        return None;
    }
    match timer {
        Some(t) if t > 0 => Some(current.unwrap_or(i64::from(t))),
        _ => None,
    }
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
/// Sesi admin/emergency tidak punya hitung mundur: tampilkan label System.
pub fn timer_text(is_admin: bool, secs: i64) -> String {
    if is_admin {
        "System".to_string()
    } else {
        human_time(secs)
    }
}
pub fn human_time(secs: i64) -> String {
    if secs <= 0 {
        return "Sesi Berakhir".to_string();
    }
    // Server membulatkan sisa menit ke atas (durasi - floor(elapsed)); ceil agar angkanya sama.
    let minutes = (secs + 59) / 60;
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
    pub fn focus_prev(&mut self) {
        self.focus_next();
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
    pub fn admin_focus_prev(&mut self) {
        self.admin_focus_next();
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
            AppEvent::Command(_) => false,
            AppEvent::Qris(image) => {
                let changed = match (&self.qris_image, &image) {
                    (Some(old), Some(new)) => !std::sync::Arc::ptr_eq(old, new),
                    (None, None) => false,
                    _ => true,
                };
                if changed {
                    self.qris_image = image;
                }
                changed
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

    /// Kunci layar sekarang tanpa menunggu server (member tidak memakai PIN).
    pub fn begin_afk_lock(&mut self) {
        self.is_afk = true;
        self.afk_pending = true;
        self.afk_input.clear();
        self.afk_error = None;
    }

    /// is_afk dari server menang, kecuali satu status basi setelah lock lokal.
    pub fn sync_afk(&mut self, server_afk: bool) {
        if server_afk {
            self.is_afk = true;
            self.afk_pending = false;
        } else if !self.afk_pending {
            self.is_afk = false;
            self.afk_input.clear();
            self.afk_error = None;
        }
    }

    pub fn afk_type_char(&mut self, ch: char) -> bool {
        if ch.is_control() || self.afk_input.chars().count() >= 64 {
            return false;
        }
        self.afk_input.push(ch);
        self.afk_error = None;
        true
    }

    pub fn afk_backspace(&mut self) -> bool {
        if self.afk_input.pop().is_none() {
            return false;
        }
        self.afk_error = None;
        true
    }

    /// Caret hanya relevan saat ada field yang bisa diketik; overlay idle tidak render.
    pub fn caret_active(&self) -> bool {
        self.is_afk
            || self.session.is_none()
            || matches!(self.modal, Some(Modal::AfkPin) | Some(Modal::Admin))
    }
    pub fn mask_secret(value: &str) -> String {
        "*".repeat(value.chars().count())
    }
    pub fn pin_masked(&self) -> String {
        Self::mask_secret(&self.pin)
    }
    /// Satu jalur keluar sesi: status server maupun autolock memakai ini.
    pub fn end_session(&mut self) {
        self.session = None;
        self.is_admin_session = false;
        ADMIN_MODE.store(false, std::sync::atomic::Ordering::Relaxed);
        self.remaining_secs = 0;
        self.modal = None;
        self.pin.clear();
        self.is_afk = false;
        self.afk_pending = false;
        self.afk_input.clear();
        self.afk_error = None;
        self.afk_busy = false;
        self.login.username.clear();
        self.login.password.clear();
        self.login.field = LoginField::Username;
        self.login.admin_user.clear();
        self.login.admin_pass.clear();
        self.login.admin_field = LoginField::Username;
        self.login.error = None;
        self.login.busy = false;
        self.caret_on = true;
    }
    /// Login admin/emergency langsung membuka overlay, tidak menunggu polling.
    pub fn enter_admin_session(&mut self, nama: &str, grup: &str, is_emergency: bool) {
        self.session = Some(Session {
            nama: nama.to_string(),
            grup: grup.to_string(),
            pc_kode: self.pc_kode.clone(),
            is_member: false,
            is_emergency,
        });
        self.view = View::Overlay;
        self.is_admin_session = true;
        self.remaining_secs = 999_999;
        self.shutdown_secs = None;
        self.is_afk = false;
        self.afk_pending = false;
        self.afk_input.clear();
        self.afk_error = None;
        self.login_pending = false;
        self.auth_busy = false;
        self.login.error = None;
        self.modal = None;
        ADMIN_MODE.store(true, std::sync::atomic::Ordering::Relaxed);
        if self.started_at.is_none() {
            self.started_at = Some(crate::platform::window::local_hhmm());
        }
    }

    fn apply_status(&mut self, status: StatusResponse) -> bool {
        let had_session = self.session.is_some();
        let admin_resp = is_admin_response(&status.status, status.nama.as_deref());
        self.connected = true;
        self.view = view_for_status(&status.status);
        match status.status.as_str() {
            "kosong" | "error" => {
                // Poll kosong saat kiosk idle tidak boleh menghapus ketikan yang
                // sedang berjalan; bersihkan hanya jika memang ada sesi.
                if self.session.is_some() || self.is_admin_session {
                    self.end_session();
                } else {
                    self.remaining_secs = 0;
                    self.is_afk = false;
                    self.afk_pending = false;
                    self.afk_input.clear();
                    self.afk_error = None;
                }
                self.shutdown_secs =
                    arm_shutdown(self.shutdown_secs, status.shutdown_timer, false);
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
                self.is_admin_session = admin_resp;
                if let Some(mulai) = status.mulai.clone() {
                    self.started_at = Some(mulai);
                }
                self.sync_afk(status.is_afk.unwrap_or(false));
                if !had_session {
                    self.alerts = AlertFlags::default();
                    self.remaining_secs = 0;
                }
                // sisa_detik eksak bila server baru; server lama hanya kirim menit
                let server_secs = status
                    .sisa_detik
                    .or_else(|| status.sisa_waktu.map(|m| i64::from(m) * 60))
                    .unwrap_or(0);
                // Admin/emergency tidak dibatasi waktu (Tauri: 999999 detik).
                self.remaining_secs = if admin_resp {
                    999_999
                } else {
                    sync_remaining(self.remaining_secs, server_secs)
                };
                self.shutdown_secs = None;
            }
        }
        ADMIN_MODE.store(admin_resp, std::sync::atomic::Ordering::Relaxed);
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
    fn server_clock_is_shown_verbatim() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(5));
        st.mulai = Some("17:10".into());
        app.apply_status_for_test(st);
        assert_eq!(app.started_at.as_deref(), Some("17:10"));
    }
    #[test]
    fn server_minutes_become_seconds() {
        let mut app = TmApp::default();
        app.apply_status_for_test(status("aktif", Some(90)));
        assert_eq!(app.remaining_secs, 90 * 60);
    }

    #[test]
    fn exact_seconds_beat_rounded_minutes() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(543));
        st.sisa_detik = Some(32570);
        app.reduce(AppEvent::Status(st));
        assert_eq!(app.remaining_secs, 32570);
        assert_eq!(human_time(app.remaining_secs), "9 jam 3 menit");
    }

    #[test]
    fn old_server_without_seconds_still_works() {
        let mut app = TmApp::default();
        app.reduce(AppEvent::Status(status("aktif", Some(90))));
        assert_eq!(app.remaining_secs, 90 * 60);
    }

    #[test]
    fn afk_response_locks_and_unlocks_the_screen() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(30));
        st.is_afk = Some(true);
        app.reduce(AppEvent::Status(st));
        assert!(app.is_afk);
        assert_eq!(app.session.as_ref().map(|s| s.nama.as_str()), Some("budi"));
        let mut st = status("aktif", Some(30));
        st.is_afk = Some(false);
        app.reduce(AppEvent::Status(st));
        assert!(!app.is_afk);
        assert!(app.afk_input.is_empty());
    }

    #[test]
    fn stale_false_status_does_not_unlock_fresh_local_lock() {
        let mut app = TmApp::default();
        app.session = Some(Session::default());
        app.is_afk = true;
        app.afk_pending = true;
        app.sync_afk(false);
        assert!(app.is_afk, "status basi tidak boleh membuka kunci");
        app.sync_afk(true);
        assert!(app.is_afk && !app.afk_pending);
        app.sync_afk(false);
        assert!(!app.is_afk);
    }

    #[test]
    fn afk_input_is_bounded_and_cleared_on_unlock() {
        let mut app = TmApp::default();
        for _ in 0..80 {
            app.afk_type_char('7');
        }
        assert_eq!(app.afk_input.chars().count(), 64);
        assert!(app.afk_backspace());
        app.afk_error = Some("salah".into());
        app.sync_afk(false);
        assert!(app.afk_error.is_none());
    }

    #[test]
    fn closed_session_drops_afk_state() {
        let mut app = TmApp::default();
        app.is_afk = true;
        app.afk_pending = true;
        app.reduce(AppEvent::Status(status("kosong", Some(0))));
        assert!(!app.is_afk && !app.afk_pending);
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
    fn top_up_reopens_the_warning() {
        let mut f = AlertFlags::default();
        assert_eq!(f.update(960), None, "di atas 15 menit belum ada peringatan");
        assert_eq!(f.update(900), Some(Alert::Min15));
        assert_eq!(f.update(960), None, "naik ke atas 15 menit hanya membuka flag");
        assert_eq!(f.update(900), Some(Alert::Min15), "setelah top-up peringatan boleh berbunyi lagi");
        assert_eq!(f.update(300), Some(Alert::Min5));
    }

    #[test]
    fn poll_does_not_rewind_the_clock() {
        assert_eq!(sync_remaining(940, 960), 940, "selisih satu menit bulat diabaikan");
        assert_eq!(sync_remaining(940, 900), 940, "server tertinggal tidak memundurkan jam");
        assert_eq!(sync_remaining(840, 960), 960, "top-up 2 menit diterima");
        assert_eq!(sync_remaining(840, 600), 600, "sesi dipotong 4 menit diterima");
        assert_eq!(sync_remaining(0, 900), 900, "sesi baru diterima");
    }

    #[test]
    fn autolock_fires_once_when_time_runs_out() {
        assert!(should_autolock(0, true));
        assert!(should_autolock(0, true), "layar AFK pun tetap logout");
        assert!(!should_autolock(0, false));
        assert!(!should_autolock(5, true));
    }

    #[test]
    fn shutdown_arms_once_and_cancels_with_session() {
        assert_eq!(arm_shutdown(None, Some(180), false), Some(180));
        assert_eq!(arm_shutdown(Some(120), Some(180), false), Some(120), "poll tidak me-reset timer");
        assert_eq!(arm_shutdown(Some(120), Some(180), true), None, "sesi aktif membatalkan shutdown");
        assert_eq!(arm_shutdown(Some(120), Some(0), false), None);
        assert_eq!(arm_shutdown(Some(120), None, false), None);
    }

    #[test]
    fn idle_status_starts_the_shutdown_countdown() {
        let mut app = TmApp::default();
        let mut st = status("kosong", None);
        st.shutdown_timer = Some(180);
        app.reduce(AppEvent::Status(st.clone()));
        assert_eq!(app.shutdown_secs, Some(180));
        app.reduce(AppEvent::Status(st));
        assert_eq!(app.shutdown_secs, Some(180), "poll berikutnya tidak me-reset");
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
    fn active_status_ignores_shutdown_timer() {
        let mut app = TmApp::default();
        let mut st = status("aktif", Some(120));
        st.is_member = Some(true);
        st.shutdown_timer = Some(600);
        app.reduce(AppEvent::Status(st));
        assert!(app.session.unwrap().is_member);
        assert_eq!(app.remaining_secs, 120 * 60);
        assert_eq!(app.shutdown_secs, None);
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
    #[test]
    fn emergency_credentials_match_hashes_only() {
        let user = crate::api::client::to_sha256_hash("AdminDarurat");
        let token = crate::api::client::to_sha256_hash("TokenDarurat");
        assert!(emergency_credentials_match(&user, &token, &user, &token));
        assert!(!emergency_credentials_match(&user, &token, "", ""));
        assert!(!emergency_credentials_match(&user, &token, &user, ""));
        assert!(!emergency_credentials_match(&user, &token, "lain", &token));
    }
    #[test]
    fn admin_status_has_no_countdown() {
        let mut app = TmApp::default();
        app.reduce(AppEvent::Status(status("admin", None)));
        assert!(app.session.is_some());
        assert_eq!(app.remaining_secs, 999_999);
        assert!(!should_autolock(app.remaining_secs, true));
    }
    #[test]
    fn admin_session_opens_overlay_immediately() {
        let mut app = TmApp::default();
        app.pc_kode = "PC-01".into();
        app.enter_admin_session("Kasir Satu", "ADMIN", false);
        assert_eq!(app.view, View::Overlay);
        assert_eq!(app.session.unwrap().nama, "Kasir Satu");
        assert_eq!(app.remaining_secs, 999_999);
    }

    #[test]
    fn caret_is_active_only_where_typing_is_possible() {
        let mut app = TmApp::default();
        assert!(app.caret_active(), "kiosk tanpa sesi selalu punya field");
        app.modal = Some(Modal::Menu);
        assert!(app.caret_active(), "menu di atas kiosk masih punya field login");
        app.reduce(AppEvent::Status(status("aktif", Some(60))));
        assert!(!app.caret_active(), "overlay tanpa modal tidak punya field");
        app.modal = Some(Modal::AfkPin);
        assert!(app.caret_active());
        app.modal = Some(Modal::Admin);
        assert!(app.caret_active());
        app.modal = None;
        app.is_afk = true;
        assert!(app.caret_active());
    }
    #[test]
    fn secrets_render_as_stars_only() {
        let mut app = TmApp::default();
        app.pin = "1234".into();
        app.afk_input = "rahasia".into();
        assert_eq!(app.pin_masked(), "****");
        assert_eq!(TmApp::mask_secret(&app.afk_input), "*******");
        assert_eq!(TmApp::mask_secret(""), "");
    }
    #[test]
    fn shift_tab_walks_fields_backwards() {
        let mut login = LoginState::default();
        login.focus_prev();
        assert_eq!(login.field, LoginField::Password);
        login.focus_next();
        assert_eq!(login.field, LoginField::Username);
        login.admin_field = LoginField::Username;
        login.admin_focus_prev();
        assert_eq!(login.admin_field, LoginField::Password);
    }
    #[test]
    fn every_modal_is_dropped_when_the_session_ends() {
        for modal in [
            Modal::Member,
            Modal::Menu,
            Modal::Detail(0),
            Modal::QrisFull,
            Modal::AfkPin,
            Modal::Logout,
            Modal::Admin,
        ] {
            let mut app = TmApp::default();
            app.reduce(AppEvent::Status(status("aktif", Some(60))));
            app.modal = Some(modal);
            app.pin = "1234".into();
            app.is_afk = true;
            app.reduce(AppEvent::Status(status("kosong", Some(0))));
            assert!(app.session.is_none());
            assert!(app.modal.is_none(), "modal {modal:?} tertinggal");
            assert!(app.pin.is_empty());
            assert!(!app.is_afk);
        }
    }
    #[test]
    fn session_end_clears_every_input() {
        let mut app = TmApp::default();
        app.reduce(AppEvent::Status(status("aktif", Some(60))));
        app.login.username = "budi".into();
        app.login.password = "rahasia123".into();
        app.login.field = LoginField::Password;
        app.login.admin_user = "kasir".into();
        app.login.admin_pass = "rahasia123".into();
        app.login.admin_field = LoginField::Password;
        app.login.error = Some("gagal".into());
        app.login.busy = true;
        app.reduce(AppEvent::Status(status("kosong", Some(0))));
        assert_eq!(app.login.field, LoginField::Username);
        assert_eq!(app.login.admin_field, LoginField::Username);
        assert!(app.login.username.is_empty());
        assert!(app.login.password.is_empty());
        assert!(app.login.admin_user.is_empty());
        assert!(app.login.admin_pass.is_empty());
        assert!(app.login.error.is_none());
        assert!(!app.login.busy);
    }
}

//! Sumber waktu bersama. DB selalu UTC; tampilan memakai zona dari setting.

use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use chrono_tz::Tz;

pub const DEFAULT_TZ: &str = "Asia/Makassar";

pub fn tz(name: &str) -> Tz {
    name.parse::<Tz>().unwrap_or(chrono_tz::Asia::Makassar)
}

pub fn now_utc() -> DateTime<Utc> {
    Utc::now()
}

pub fn now_local(tz_name: &str) -> NaiveDateTime {
    now_utc().with_timezone(&tz(tz_name)).naive_local()
}

pub fn today_local(tz_name: &str) -> NaiveDate {
    now_local(tz_name).date()
}

/// Format tanggal-jam standar log: `YYYY-MM-DD HH:MM:SS`.
pub fn format_local_now(tz_name: &str) -> String {
    now_local(tz_name).format("%Y-%m-%d %H:%M:%S").to_string()
}

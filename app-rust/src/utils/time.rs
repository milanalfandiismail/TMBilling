//! Sumber waktu bersama. DB selalu UTC; tampilan memakai zona dari setting.

use chrono::{DateTime, NaiveDate, NaiveDateTime, TimeZone, Utc};
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

/// Timestamp DB: semua kolom waktu disimpan UTC naive seperti Python `now_local()`.
pub fn now_db() -> NaiveDateTime {
    Utc::now().naive_utc()
}

/// Tulis timestamp DB dengan mikro detik (layout Python SQLAlchemy).
pub fn db_str(dt: NaiveDateTime) -> String {
    dt.format("%Y-%m-%d %H:%M:%S%.6f").to_string()
}

/// Baca kolom waktu SQLite; nilai tanpa fraksi detik juga diterima.
pub fn parse_dt(raw: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S"))
        .ok()
}

/// Format tanggal-jam standar log: `YYYY-MM-DD HH:MM:SS`.
pub fn format_local_now(tz_name: &str) -> String {
    now_local(tz_name).format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Label zona singkat untuk tampilan struk/laporan (WIB/WITA/WIT).
pub fn tz_label(name: &str) -> String {
    match name {
        "Asia/Jakarta" => "WIB".into(),
        "Asia/Makassar" => "WITA".into(),
        "Asia/Jayapura" => "WIT".into(),
        "Asia/Kuala_Lumpur" => "MYT".into(),
        "Asia/Singapore" => "SGT".into(),
        "Asia/Ho_Chi_Minh" => "ICT".into(),
        _ => tz(name).name().rsplit('/').next().unwrap_or("WITA").into(),
    }
}

/// Format tampilan Python `format_display`: UTC naive → `%d/%m/%Y %H:%M <label>`.
pub fn format_display(dt: NaiveDateTime, tz_name: &str) -> String {
    let local = DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc).with_timezone(&tz(tz_name));
    format!("{} {}", local.format("%d/%m/%Y %H:%M"), tz_label(tz_name))
}

/// Rentang UTC `[start, end)` untuk satu tanggal lokal, siap dibandingkan kolom teks SQLite.
/// Format waktu UTC naive ke zona aplikasi dengan pola bebas.
pub fn format_local(dt: NaiveDateTime, tz_name: &str, fmt: &str) -> String {
    dt.and_local_timezone(tz(tz_name))
        .single()
        .map(|d| d.format(fmt).to_string())
        .unwrap_or_default()
}

pub fn day_range_utc(date: NaiveDate, tz_name: &str) -> (String, String) {
    let zone = tz(tz_name);
    let midnight = date.and_hms_opt(0, 0, 0).expect("midnight valid");
    let to_utc = |naive: NaiveDateTime| {
        zone.from_local_datetime(&naive)
            .earliest()
            .map(|l| l.with_timezone(&Utc).naive_utc())
            .unwrap_or(naive)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
    };
    let next = midnight + chrono::Duration::days(1);
    (to_utc(midnight), to_utc(next))
}

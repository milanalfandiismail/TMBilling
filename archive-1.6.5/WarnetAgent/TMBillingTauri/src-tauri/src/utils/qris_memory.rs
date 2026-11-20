use std::sync::Mutex;

// Data URI QRIS terakhir per URL sumber. Hanya di RAM: restart = kosong (tanpa cache disk).
static LAST_GOOD: Mutex<Option<(String, String)>> = Mutex::new(None);

pub fn remember(url: &str, data_uri: &str) {
    if let Ok(mut slot) = LAST_GOOD.lock() {
        *slot = Some((url.to_string(), data_uri.to_string()));
    }
}

/// Hanya mengembalikan data URI bila URL sumbernya identik,
/// supaya QRIS lama tidak ditampilkan saat admin sudah mengganti gambar.
pub fn last_for(url: &str) -> Option<String> {
    let slot = LAST_GOOD.lock().ok()?;
    slot.as_ref()
        .filter(|(saved_url, _)| saved_url == url)
        .map(|(_, data_uri)| data_uri.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reuse_only_for_same_url() {
        remember("u1", "data:image/png;base64,AAA");
        assert_eq!(last_for("u1").as_deref(), Some("data:image/png;base64,AAA"));
        assert!(last_for("u2").is_none());

        remember("u1", "data:image/png;base64,BBB");
        assert_eq!(last_for("u1").as_deref(), Some("data:image/png;base64,BBB"));
    }
}

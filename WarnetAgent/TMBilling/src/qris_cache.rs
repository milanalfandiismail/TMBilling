use std::sync::Mutex;

// QRIS terakhir per URL sumber. Hanya di RAM: restart = kosong (tanpa cache disk).
static LAST_GOOD: Mutex<Option<(String, Vec<u8>)>> = Mutex::new(None);

pub fn remember(url: &str, bytes: &[u8]) {
    if let Ok(mut slot) = LAST_GOOD.lock() {
        *slot = Some((url.to_string(), bytes.to_vec()));
    }
}

/// Hanya mengembalikan byte lama bila URL sumbernya identik, supaya QRIS lama
/// tidak tampil saat admin sudah mengganti gambar.
pub fn last_for(url: &str) -> Option<Vec<u8>> {
    let slot = LAST_GOOD.lock().ok()?;
    slot.as_ref()
        .filter(|(saved, _)| saved == url)
        .map(|(_, bytes)| bytes.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reuse_only_for_same_url() {
        remember("u1", b"AAA");
        assert_eq!(last_for("u1"), Some(b"AAA".to_vec()));
        assert!(last_for("u2").is_none());

        remember("u1", b"BBB");
        assert_eq!(last_for("u1"), Some(b"BBB".to_vec()));
    }
}

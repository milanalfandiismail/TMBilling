use gpui_kit::{Image, ImageFormat};
use std::sync::{Arc, Mutex};

// QRIS terakhir per URL sumber. Hanya di RAM: restart = kosong (tanpa cache disk).
static LAST_GOOD: Mutex<Option<(String, Vec<u8>)>> = Mutex::new(None);
/// Gambar hasil decode terakhir; decode ulang hanya saat byte berubah.
static DECODED: Mutex<Option<(String, Vec<u8>, Arc<Image>)>> = Mutex::new(None);

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

/// Arc yang sama dipakai ulang selama sumber dan byte identik, jadi state tidak
/// mengganti gambar (dan tidak memicu render ulang) tiap refresh config.
pub fn decoded(url: &str, format: ImageFormat, bytes: &[u8]) -> Arc<Image> {
    if let Ok(slot) = DECODED.lock() {
        if let Some((saved_url, saved, image)) = slot.as_ref() {
            if saved_url == url && saved.as_slice() == bytes {
                return image.clone();
            }
        }
    }
    let image = Arc::new(Image::from_bytes(format, bytes.to_vec()));
    if let Ok(mut slot) = DECODED.lock() {
        *slot = Some((url.to_string(), bytes.to_vec(), image.clone()));
    }
    image
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

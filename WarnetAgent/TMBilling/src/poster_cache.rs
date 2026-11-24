use gpui_kit::{Image, ImageFormat};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

static POSTER_CACHE: Mutex<Option<HashMap<String, Arc<Image>>>> = Mutex::new(None);

/// Ambil gambar dari cache memori jika sudah pernah di-decode.
pub fn get_poster(url: &str) -> Option<Arc<Image>> {
    let lock = POSTER_CACHE.lock().ok()?;
    let map = lock.as_ref()?;
    map.get(url).cloned()
}

/// Simpan hasil decode poster ke cache RAM.
pub fn remember_poster(url: &str, format: ImageFormat, bytes: &[u8]) -> Arc<Image> {
    let mut lock = POSTER_CACHE.lock().unwrap();
    let map = lock.get_or_insert_with(HashMap::new);
    if let Some(existing) = map.get(url) {
        return existing.clone();
    }
    let img = Arc::new(Image::from_bytes(format, bytes.to_vec()));
    map.insert(url.to_string(), img.clone());
    img
}

/// Bersihkan seluruh cache gambar jika diperlukan.
pub fn has_poster(url: &str) -> bool {
    get_poster(url).is_some()
}

pub fn store_poster(url: &str, format: ImageFormat, bytes: &[u8]) -> Arc<Image> {
    remember_poster(url, format, bytes)
}

/// Deteksi format gambar dari signature magic bytes secara otomatis
pub fn detect_image_format(bytes: &[u8]) -> ImageFormat {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        ImageFormat::Png
    } else {
        ImageFormat::Jpeg
    }
}

/// Simpan poster ke cache RAM dengan deteksi otomatis format PNG/JPEG
pub fn store_poster_auto(url: &str, bytes: &[u8]) -> Arc<Image> {
    let fmt = detect_image_format(bytes);
    remember_poster(url, fmt, bytes)
}

pub fn clear_cache() {
    if let Ok(mut lock) = POSTER_CACHE.lock() {
        *lock = None;
    }
}

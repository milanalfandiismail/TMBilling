use crate::api::client::ApiClient;

/// Capture, encode to PNG, upload. Nothing is written to disk.
pub async fn take_and_upload(client: &ApiClient, ip: &str) -> Result<(), String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Gagal deteksi layar: {e}"))?;
    let screen = screens.first().ok_or_else(|| "Layar tidak ditemukan".to_string())?;
    let image = screen.capture().map_err(|e| format!("Gagal capture layar: {e}"))?;

    let mut buffer = std::io::Cursor::new(Vec::new());
    image
        .write_to(&mut buffer, screenshots::image::ImageOutputFormat::Png)
        .map_err(|e| format!("Gagal convert PNG: {e}"))?;

    client
        .upload_screenshot(ip, buffer.into_inner())
        .await
        .map_err(|e| e.to_string())
}

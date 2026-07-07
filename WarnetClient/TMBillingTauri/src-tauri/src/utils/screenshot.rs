pub async fn take_and_upload_screenshot(api: &crate::utils::api::ApiService, ip: &str) -> Result<(), String> {
    let screens = screenshots::Screen::all().map_err(|e| format!("Gagal deteksi layar: {}", e))?;
    let screen = screens.first().ok_or_else(|| "Layar tidak ditemukan".to_string())?;
    
    let image = screen.capture().map_err(|e| format!("Gagal capture layar: {}", e))?;
    
    let mut buffer = std::io::Cursor::new(Vec::new());
    image.write_to(&mut buffer, screenshots::image::ImageOutputFormat::Png)
        .map_err(|e| format!("Gagal convert PNG: {}", e))?;
    
    let png_bytes = buffer.into_inner();
    api.upload_screenshot(ip, png_bytes).await?;
    Ok(())
}

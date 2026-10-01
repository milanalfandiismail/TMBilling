#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED};
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator, eRender, eMultimedia};
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;

pub fn set_master_volume_windows(target_vol: f32) -> Result<f32, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create MMDeviceEnumerator: {}", e))?;

        let default_device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;

        let endpoint_volume: IAudioEndpointVolume = default_device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate IAudioEndpointVolume: {}", e))?;

        // Unmute jika posisi mute
        if let Ok(is_muted) = endpoint_volume.GetMute() {
            if is_muted.as_bool() {
                let _ = endpoint_volume.SetMute(false, std::ptr::null());
            }
        }

        // Ambil volume sebelumnya secara dinamis
        let prev_vol = endpoint_volume.GetMasterVolumeLevelScalar().unwrap_or(1.0);

        // Set target master volume (clamp 0.0 - 1.0)
        let clamped = target_vol.clamp(0.0, 1.0);
        endpoint_volume.SetMasterVolumeLevelScalar(clamped, std::ptr::null())
            .map_err(|e| format!("Failed to set master volume: {}", e))?;

        CoUninitialize();
        Ok(prev_vol)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(target_vol)
    }
}

pub fn restore_master_volume_windows(target_vol: f32, muted: Option<bool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create MMDeviceEnumerator: {}", e))?;

        let default_device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;

        let endpoint_volume: IAudioEndpointVolume = default_device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate IAudioEndpointVolume: {}", e))?;

        let clamped = target_vol.clamp(0.0, 1.0);
        let _ = endpoint_volume.SetMasterVolumeLevelScalar(clamped, std::ptr::null());

        if let Some(m) = muted {
            let _ = endpoint_volume.SetMute(m, std::ptr::null());
        }

        CoUninitialize();
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (target_vol, muted);
        Ok(())
    }
}

pub fn get_master_volume_windows() -> Result<f32, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create MMDeviceEnumerator: {}", e))?;

        let default_device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;

        let endpoint_volume: IAudioEndpointVolume = default_device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to activate IAudioEndpointVolume: {}", e))?;

        let current_vol = endpoint_volume.GetMasterVolumeLevelScalar()
            .map_err(|e| format!("Failed to get master volume: {}", e))?;

        CoUninitialize();
        Ok(current_vol)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(1.0)
    }
}

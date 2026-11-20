use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Satu siklus COM penuh per panggilan supaya hitungan init/uninit tetap seimbang.
fn with_endpoint<T>(f: impl FnOnce(&IAudioEndpointVolume) -> T) -> Option<T> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let result = (|| {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia).ok()?;
            let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
            Some(f(&endpoint))
        })();
        CoUninitialize();
        result
    }
}

pub fn clamp_volume(percent: u32) -> u32 {
    percent.min(100)
}

pub fn set_master_volume(percent: u32) -> bool {
    let value = clamp_volume(percent) as f32 / 100.0;
    with_endpoint(|ep| unsafe { ep.SetMasterVolumeLevelScalar(value, std::ptr::null()) }.is_ok())
        .unwrap_or(false)
}

pub fn is_muted() -> bool {
    with_endpoint(|ep| unsafe { ep.GetMute() }.map(|m| m.as_bool()).unwrap_or(false))
        .unwrap_or(false)
}

pub fn set_muted(muted: bool) -> bool {
    with_endpoint(|ep| unsafe { ep.SetMute(muted, std::ptr::null()) }.is_ok()).unwrap_or(false)
}

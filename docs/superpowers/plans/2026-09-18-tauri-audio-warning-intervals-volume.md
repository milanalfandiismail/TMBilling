# Tauri Audio Warning Reminders (1 Min, 5 Min, 15 Min) & Windows Volume Temporary Override (100% & Auto-Restore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan pengingat suara billing pada sisa waktu 15 menit, 5 menit, dan 1 menit di `TMBillingTauri`, dengan mekanisme cerdas: menaikkan volume Windows Master ke **100%** (dan un-mute) selama audio berbunyi, lalu **mengembalikannya secara otomatis ke volume default/semula** pelanggan setelah audio selesai diputar.

**Architecture:** 
1. **Backend Rust Windows Core Audio API**: 
   - Tauri command `set_system_volume(volume: f32) -> Result<f32, String>` (mengembalikan volume sebelumnya dan menyetel target volume).
   - Tauri command `restore_system_volume(volume: f32, muted: bool) -> Result<(), String>` / `get_system_volume_info() -> Result<AudioInfo, String>`.
2. **Frontend Audio Subsystem & Auto-Restore Flow**: 
   - Ketika pemicu 15m / 5m / 1m aktif:
     1. Ambil & simpan volume asal Windows (misal 20%) dan status mute.
     2. Naikkan volume ke 100% dan un-mute speaker.
     3. Putar audio peringatan (`warning_15min.mp3`, `warning_5min.mp3`, atau `warning_1min.mp3`).
     4. Begitu audio selesai diputar (`onended`), kembalikan volume Windows ke nilai semula (20%) dan status mute asal.
3. **Handling Top-up / Initial Session Edge Cases**: State tracking cerdas yang mencegah false-alert saat login awal dengan durasi pendek dan mengizinkan alert berulang jika user melakukan perpanjangan billing (top-up time).

**Tech Stack:** Tauri (Rust 1.70+, Windows Crate 0.52 `Win32_Media_Audio`, `Win32_Media_Audio_Endpoints`, `Win32_System_Com`), JavaScript ES6 / Web Audio API, HTML5.

**Spec:** User prompt requirements:
- Reminder audio di 1 menit, 5 menit, dan 15 menit.
- Saat audio berbunyi, volume sistem Windows dinaikkan ke 100%.
- Saat audio selesai diputar, volume sistem otomatis dikembalikan ke default volume semula.

## Global Constraints
- Proyek klien berada di `WarnetClient/TMBillingTauri`.
- Jangan mengubah UI/UX tata letak kiosk & overlay yang sudah rapi selain integrasi pemutaran audio dan state billing.
- Rust build harus lolos `cargo check` dan `cargo build` tanpa error.
- Backward-compatibility: jika sistem non-Windows atau audio endpoint gagal diakses, aplikasi tetap berjalan lancar dan fallback ke Web Audio / HTML5 audio.

---

### Task 1: Windows Core Audio Volume Control & Auto-Restore di Rust Backend

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src-tauri/Cargo.toml:24-29`
- Create: `WarnetClient/TMBillingTauri/src-tauri/src/utils/audio.rs`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/utils/mod.rs`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/commands/system_commands.rs`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/main.rs:42-56`

**Interfaces:**
- Produces: 
  - `set_system_volume(volume: f32) -> Result<f32, String>` (menyetel volume & mengembalikan volume sebelumnya)
  - `restore_system_volume(volume: f32, muted: Option<bool>) -> Result<(), String>`
  - `get_system_volume() -> Result<f32, String>`

- [ ] **Step 1: Tambahkan Windows crate features untuk Audio & COM di Cargo.toml**

Update `Cargo.toml`:
```toml
windows = { version = "0.52", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_System_LibraryLoader",
    "Win32_Media_Audio",
    "Win32_Media_Audio_Endpoints",
    "Win32_System_Com",
] }
```

- [ ] **Step 2: Buat utilitas audio Windows di `src-tauri/src/utils/audio.rs`**

Implementasikan fungsi pengatur volume, un-mute, dan restore volume Windows:
```rust
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

        // Ambil volume sebelumnya
        let mut prev_vol: f32 = 1.0;
        let _ = endpoint_volume.GetMasterVolumeLevelScalar(&mut prev_vol);

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

        let mut current_vol: f32 = 0.0;
        endpoint_volume.GetMasterVolumeLevelScalar(&mut current_vol)
            .map_err(|e| format!("Failed to get master volume: {}", e))?;

        CoUninitialize();
        Ok(current_vol)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(1.0)
    }
}
```

- [ ] **Step 3: Expose command di `system_commands.rs` & daftarkan di `main.rs`**

Di `WarnetClient/TMBillingTauri/src-tauri/src/commands/system_commands.rs`:
```rust
#[tauri::command]
pub fn set_system_volume(volume: f32) -> Result<f32, String> {
    crate::utils::audio::set_master_volume_windows(volume)
}

#[tauri::command]
pub fn restore_system_volume(volume: f32, muted: Option<bool>) -> Result<(), String> {
    crate::utils::audio::restore_master_volume_windows(volume, muted)
}

#[tauri::command]
pub fn get_system_volume() -> Result<f32, String> {
    crate::utils::audio::get_master_volume_windows()
}
```

Daftarkan di `src-tauri/src/main.rs`:
```rust
crate::commands::system_commands::set_system_volume,
crate::commands::system_commands::restore_system_volume,
crate::commands::system_commands::get_system_volume,
```

- [ ] **Step 4: Jalankan `cargo check` di `src-tauri` untuk verifikasi build**

Run: `cargo check` di directory `WarnetClient/TMBillingTauri/src-tauri`
Expected: `Finished dev profile [unoptimized + debuginfo] target(s)` dengan 0 error.

- [ ] **Step 5: Commit**

```bash
git add WarnetClient/TMBillingTauri/src-tauri/Cargo.toml WarnetClient/TMBillingTauri/src-tauri/src/
git commit -m "feat(tauri): add Windows Core Audio master volume temporary boost and restore commands"
```

---

### Task 2: Sound Assets untuk 15 Menit, 5 Menit, dan 1 Menit

**Files:**
- Create/Update: `WarnetClient/TMBillingTauri/src/assets/sounds/warning_15min.mp3` (atau `.wav`)
- Create/Update: `WarnetClient/TMBillingTauri/src/assets/sounds/warning_5min.mp3`
- Create/Update: `WarnetClient/TMBillingTauri/src/assets/sounds/warning_1min.mp3` (atau `.wav`)

**Interfaces:**
- Produces: Standard audio assets siap putar dengan level volume yang ternormalisasi (loud & clear).

- [ ] **Step 1: Siapkan/generate berkas audio notifikasi jernih dan berenergi untuk ketiga interval**

Generate file audio WAV/MP3 kualitas tinggi:
- `warning_15min.mp3` / `.wav`: Suara alert melodic ramah (chime ascending).
- `warning_5min.mp3`: Suara alert perhatian 5 menit (dual chime alert).
- `warning_1min.mp3` / `.wav`: Suara alert mendesak 1 menit (triple chime countdown alert).

- [ ] **Step 2: Verifikasi file audio berada di folder `src/assets/sounds/`**

Run: Cek ketersediaan file `warning_15min.*`, `warning_5min.mp3`, `warning_1min.*` di `WarnetClient/TMBillingTauri/src/assets/sounds/`.

- [ ] **Step 3: Commit**

```bash
git add WarnetClient/TMBillingTauri/src/assets/sounds/
git commit -m "feat(assets): add warning audio assets for 15min, 5min, and 1min intervals"
```

---

### Task 3: Audio Subsystem & Frontend Integration (Constants, State, Api, Overlay)

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/shared/constants.js`
- Modify: `WarnetClient/TMBillingTauri/src/shared/state.js`
- Modify: `WarnetClient/TMBillingTauri/src/shared/api.js`
- Modify: `WarnetClient/TMBillingTauri/src/overlay/overlay.js:130-160`

**Interfaces:**
- Consumes: `Api.setSystemVolume(1.0)`, `Api.restoreSystemVolume(prevVol, isMuted)`
- Produces: `Overlay.playWarningAudio(type)` dan interval triggers di `Overlay.updateTime(seconds)`

- [ ] **Step 1: Update `constants.js` dengan thresholds dan audio paths**

Di `WarnetClient/TMBillingTauri/src/shared/constants.js`:
```javascript
export const AUDIO_WARNING_15MIN_PATH = 'assets/sounds/warning_15min.mp3';
export const AUDIO_WARNING_5MIN_PATH = 'assets/sounds/warning_5min.mp3';
export const AUDIO_WARNING_1MIN_PATH = 'assets/sounds/warning_1min.mp3';

export const AUDIO_TARGET_SYSTEM_VOLUME = 1.0; // Setel Windows Master Volume ke 100%
export const AUDIO_PLAYBACK_VOLUME = 1.0; // HTML5 / Web Audio max volume

export const TIME_THRESHOLD_15MIN = 900; // 15 menit dalam detik
export const TIME_THRESHOLD_5MIN = 300;  // 5 menit dalam detik
export const TIME_THRESHOLD_1MIN = 60;   // 1 menit dalam detik
```

- [ ] **Step 2: Update `state.js` untuk mengelola flag ketiga alert**

Di `WarnetClient/TMBillingTauri/src/shared/state.js`:
```javascript
// Timer state
hasPlayed15MinAlert: false,
hasPlayed5MinAlert: false,
hasPlayed1MinAlert: false,
shutdownInterval: null,
shutdownRemaining: 0,
```
Dan di `resetSession()`:
```javascript
resetSession() {
    this.isOverlayActive = false;
    this.currentStatus = null;
    this.hasPlayed15MinAlert = false;
    this.hasPlayed5MinAlert = false;
    this.hasPlayed1MinAlert = false;
    this.sessionData = {
        memberName: null,
        group: null,
        remainingSeconds: 0,
        pcKode: null
    };
},
```

- [ ] **Step 3: Update `api.js` dengan method `setSystemVolume` dan `restoreSystemVolume`**

Di `WarnetClient/TMBillingTauri/src/shared/api.js`:
```javascript
async setSystemVolume(volume = 1.0) {
    try {
        return await invoke('set_system_volume', { volume });
    } catch (err) {
        console.warn("Gagal set system volume:", err);
        return null;
    }
},

async restoreSystemVolume(volume, muted = false) {
    try {
        return await invoke('restore_system_volume', { volume, muted });
    } catch (err) {
        console.warn("Gagal restore system volume:", err);
    }
},

async getSystemVolume() {
    try {
        return await invoke('get_system_volume');
    } catch (err) {
        console.warn("Gagal get system volume:", err);
        return 1.0;
    }
}
```

- [ ] **Step 4: Update `overlay.js` dengan Audio Player & Multi-Interval Trigger + Auto-Restore**

Di `WarnetClient/TMBillingTauri/src/overlay/overlay.js`:
1. Di `updateTime(seconds)`:
   - Tangani top-up billing: jika `seconds > TIME_THRESHOLD_15MIN`, reset ketiga flag alert. Jika `seconds > TIME_THRESHOLD_5MIN && seconds <= TIME_THRESHOLD_15MIN`, reset `hasPlayed5MinAlert` & `hasPlayed1MinAlert`. Jika `seconds > TIME_THRESHOLD_1MIN && seconds <= TIME_THRESHOLD_5MIN`, reset `hasPlayed1MinAlert`.
   - Inisialisasi awal jika login dengan sisa waktu di bawah batas: jika baru login dengan sisa <= 900s dan belum ditandai, tandai 15m; jika <= 300s, tandai 5m; jika <= 60s, tandai 1m agar tidak mendadak bunyi saat baru klik login.
   - Pemicu 15 Menit: `seconds <= TIME_THRESHOLD_15MIN && seconds > TIME_THRESHOLD_5MIN && !AppState.hasPlayed15MinAlert` -> `AppState.hasPlayed15MinAlert = true; this.playWarningAudio('15min');`
   - Pemicu 5 Menit: `seconds <= TIME_THRESHOLD_5MIN && seconds > TIME_THRESHOLD_1MIN && !AppState.hasPlayed5MinAlert` -> `AppState.hasPlayed5MinAlert = true; this.playWarningAudio('5min');`
   - Pemicu 1 Menit: `seconds <= TIME_THRESHOLD_1MIN && seconds > 0 && !AppState.hasPlayed1MinAlert` -> `AppState.hasPlayed1MinAlert = true; this.playWarningAudio('1min');`
2. Di `playWarningAudio(type = '5min')`:
   - Simpan volume sebelumnya via `const prevVol = await Api.setSystemVolume(AUDIO_TARGET_SYSTEM_VOLUME);` (menaikan master volume ke 100% dan un-mute).
   - Tentukan berkas audio berdasarkan `type` (`warning_15min.mp3`, `warning_5min.mp3`, atau `warning_1min.mp3`).
   - Buat `const alertAudio = new Audio(path); alertAudio.volume = AUDIO_PLAYBACK_VOLUME;`
   - Bind event `alertAudio.onended` dan `alertAudio.onerror`: panggil `await Api.restoreSystemVolume(prevVol);` untuk mengembalikan volume ke setting awal user.
   - Juga pasang safety timeout (misal 10 detik) untuk memastikan volume selalu kembali ke default jika audio terputus.
   - Fallback otomatis ke Web Audio synthesized tone jika file audio tidak ditemukan/gagal putar.

- [ ] **Step 5: Verifikasi Frontend Code & Build CSS**

Run: `npm run build:css` (jika ada class baru) dan periksa tidak ada sintaks error di JS.
Expected: Build sukses tanpa error.

- [ ] **Step 6: Commit**

```bash
git add WarnetClient/TMBillingTauri/src/
git commit -m "feat(overlay): implement 15m, 5m, 1m audio warnings with 100% volume boost and auto-restore"
```

---

### Task 4: End-to-End Verification & Edge Cases Testing

**Files:**
- Test: Verifikasi countdown logic, volume override, auto-restore, dan alert triggering.

- [ ] **Step 1: Verifikasi Rust Backend compilation**
Run: `cargo check` di `WarnetClient/TMBillingTauri/src-tauri`
Expected: `Finished dev profile [unoptimized + debuginfo] target(s)` dengan status 0 error.

- [ ] **Step 2: Verifikasi trigger logic simulasi time updates**
Simulasikan interval countdown:
- 1000s -> tidak ada bunyi
- 900s -> memicu 15min alert + set volume 100% -> audio selesai -> restore volume semula
- 895s -> tidak bunyi lagi
- 300s -> memicu 5min alert + set volume 100% -> audio selesai -> restore volume semula
- 60s -> memicu 1min alert + set volume 100% -> audio selesai -> restore volume semula
- 0s -> auto lock PC

- [ ] **Step 3: Final Commit & Polish**

```bash
git add -A
git commit -m "feat(client): complete audio reminder intervals (1m, 5m, 15m) and system volume override with auto-restore"
```

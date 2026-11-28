# TMBilling Android TV Kiosk (Rental PlayStation)

Klien Kiosk Android TV native untuk sistem manajemen rental PlayStation TMBilling.
Dibangun menggunakan **Kotlin & Jetpack Compose TV**, terintegrasi langsung dengan backend `app-rust` via REST API berautentikasi HMAC-SHA256.

---

## 🎮 Fitur Utama

1. **Anti-Escape Kiosk Lockdown & Remote Blocker**
   - Terdaftar sebagai **Default Android Leanback Launcher** (`CATEGORY_HOME` + `CATEGORY_LEANBACK_LAUNCHER`). Dapat diaktifkan langsung dari aplikasi via `RoleManager.ROLE_HOME`.
   - `KioskAccessibilityService`: Mencegat event tombol remote `GLOBAL_ACTION_HOME`, `GLOBAL_ACTION_RECENTS`, `GLOBAL_ACTION_NOTIFICATIONS`, dan `GLOBAL_ACTION_QUICK_SETTINGS`.
   - **Kunci Remote Permanen Saat Sesi Bermain**: Selama pengguna bermain game console, remote TV tetap terkunci agar tidak bisa membuka aplikasi YouTube/Netflix atau keluar dari sesi. Hanya tombol **Volume Up**, **Volume Down**, dan **Volume Mute** yang diizinkan lewat.
   - `onUserLeaveHint` & `onKeyDown` override: Tombol `BACK` dan upaya keluar aplikasi diblokir total saat kiosk dalam mode terkunci.
   - `LockTaskMode` (Device Owner ready) melalui `KioskDeviceAdminReceiver`.

2. **Aksi Darurat & Pengaman Anti-Terjebak**
   - **PIN Admin & Darurat Kustom**: Dapat diubah melalui modal setup console (default `8888`).
   - **Tombol Uninstall Mandiri**: Disediakan tombol langsung untuk mencopot (*uninstall*) aplikasi dari dalam modal admin ber-PIN, mencegah perangkat TV fisik terkunci permanen jika ingin direset.
   - **Buka Pengaturan Android TV**: Akses langsung ke menu `Settings` TV untuk WiFi/Bluetooth tanpa perlu keluar dari launcher.
   - **Buka Kunci Remote Sementara**: Tombol bypass aksesibilitas bagi teknisi untuk keperluan perawatan.

3. **Auto HDMI Switching (TvContract API)**
   - Saat kasir membuka billing atau sesi aktif, aplikasi secara otomatis beralih (*passthrough*) ke port HDMI tempat PlayStation terhubung (misal HDMI 1 atau HDMI 2).
   - Saat waktu sewa habis (0 detik) atau dihentikan kasir, aplikasi otomatis muncul kembali ke layar depan, menutupi input game console dan menampilkan layar terkunci (*Lockscreen*).

4. **Indonesian Text-to-Speech (TTS Audio Alerts)**
   - Peringatan suara otomatis:
     - *"Selamat bermain. Sesi rental PlayStation telah dimulai."*
     - *"Perhatian. Waktu bermain Anda tersisa 5 menit lagi."*
     - *"Perhatian. Waktu bermain Anda tersisa 1 menit lagi."*
     - *"Waktu bermain Anda telah habis. Terima kasih telah menyewa di sini."*

5. **UI/UX Chamber Noir & Kontras Tinggi (1:1 Standar TMBilling)**
   - Background hitam pekat (`#050505` / `#0C0C0C`) hemat daya panel OLED/LED TV.
   - Header 3-Zona: Logo TM resmi TMBilling, Pill Nomor Meja (cth: `PS-01`), dan Kapsul Status Bersatu (`● ONLINE • SABTU, 28 NOV • 23:45 WIB`).
   - **Format Waktu Human-Friendly**: Durasi ditampilkan ramah server (`"5 Menit"`, `"1 Jam 30 Menit"`) tanpa detik bergulir jika sisa waktu > 60 detik.
   - **Tombol Kontras Tinggi**: D-Pad TV remote highlight dengan teks hitam solid di atas latar putih terang (`FocusWhite`), teks putih di atas slate gelap ber-border saat sekunder.
   - Kolom QRIS Dinamis terintegrasi Coil AsyncImage dan panduan sewa kasir 3 langkah.
   - Footer bersih: `TMBilling v2.0`.

6. **Landscape 16:9 Setup Console & Preset Emulator**
   - Muncul otomatis pada saat aplikasi pertama kali dibuka (`isConfigured = false`) atau melalui tombol **PENGATURAN KIOSK & DARURAT** (terproteksi PIN).
   - Tombol cepat Preset Alamat Server:
     - `🏠 Host Emulator (10.0.2.2:7015)`
     - `💻 Server IP (10.10.10.25:7015)`
     - `🔑 Set Secret Key 'TM2026'`
   - Tombol **🔍 Uji Koneksi ke Server**: Menguji langsung HTTP ping ke backend dan memverifikasi HMAC secret key sebelum disimpan.

---

## 🌐 Panduan Koneksi: Emulator Virtual vs Host Windows

Android Emulator berjalan di dalam hypervisor terisolasi (Virtual NAT Network).

| Target | Alamat yang Digunakan | Keterangan |
| :--- | :--- | :--- |
| **Emulator Android TV ke PC Windows Host** | `http://10.0.2.2:8080` | `10.0.2.2` adalah gateway virtual bawaan emulator yang memetakan langsung ke `127.0.0.1` (localhost) komputer host Windows. |
| **TV Fisik (Android TV Box / Smart TV)** | `http://192.168.1.xxx:8080` | Gunakan IP LAN komputer kasir / server TMBilling (cek via `ipconfig` di Windows). Komputer server dan Android TV harus berada di jaringan WiFi/LAN yang sama. |

### Syarat di Server TMBilling (`app-rust`):
Pastikan backend `app-rust` mendengarkan di `0.0.0.0:8080` (bukan hanya `127.0.0.1`) agar dapat diakses dari jaringan lokal maupun alias `10.0.2.2` emulator.

---

## 🔒 Konfigurasi Kiosk & Aksesibilitas (Wajib di TV/Emulator)

Untuk mengunci Android TV secara penuh agar pelanggan tidak bisa menekan tombol Home:

1. **Aktifkan Kiosk Accessibility Service:**
   - Masuk ke **Settings TV** -> **Device Preferences** -> **Accessibility**.
   - Cari **TMBilling Kiosk Blocker** -> Ubah ke **ON / Enable**.
2. **Jadikan Default Home Launcher:**
   - Tekan tombol **Home** pada remote.
   - Pilih **TMBilling TV** -> Pilih **Always** (Selalu).
3. **Mode Device Owner (Opsional untuk Hardware Produksi):**
   ```bash
   adb shell dpm set-device-owner com.tmbilling.tv/.receiver.KioskDeviceAdminReceiver
   ```

---

## 📂 Struktur Modul

```
WarnetAgent/TMBillingAndroidTV/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/tmbilling/tv/
│   │   │   ├── App.kt
│   │   │   ├── controller/
│   │   │   │   ├── TvInputController.kt       # Kontrol port HDMI & Intent passthrough
│   │   │   │   └── AudioAlertManager.kt       # Peringatan suara Text-to-Speech
│   │   │   ├── data/
│   │   │   │   ├── model/TvClientModels.kt
│   │   │   │   ├── network/
│   │   │   │   │   ├── ApiService.kt
│   │   │   │   │   └── ApiClient.kt           # HMAC-SHA256 & Test Connection
│   │   │   │   └── pref/AppPreferences.kt     # Pengaturan & isConfigured flag
│   │   │   ├── receiver/
│   │   │   │   ├── BootReceiver.kt            # Auto start saat TV hidup
│   │   │   │   └── KioskDeviceAdminReceiver.kt # LockTask mode
│   │   │   ├── service/
│   │   │   │   ├── BillingPollingService.kt   # Polling sesi & server status flow
│   │   │   │   └── KioskAccessibilityService.kt # Pencegat remote Home/Recent
│   │   │   └── ui/
│   │   │       ├── KioskActivity.kt           # Setup wizard dialog & Kiosk Window
│   │   │       ├── screens/LockScreen.kt      # Layar OLED Cyberpunk lockscreen
│   │   │       └── theme/Theme.kt & Color.kt  # Palet warna OLED Deep Black
│   │   └── res/                               # Layout, string, icon & config XML
│   └── build.gradle.kts
├── gradle/libs.versions.toml
├── build.gradle.kts
└── settings.gradle.kts
```

---

## 🛠️ Kompilasi & Build APK

```powershell
cd WarnetAgent/TMBillingAndroidTV
.\gradlew.bat assembleDebug
```
Output APK berada di:
`WarnetAgent/TMBillingAndroidTV/app/build/outputs/apk/debug/app-debug.apk`

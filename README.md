<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <img src="tm.png" alt="TMBilling" width="360" />
</p>

<h1 align="center">🖥️ TMBilling</h1>

<p align="center">
  <strong>Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise Grade)</strong>
  <br />
  Backend Rust (axum) · Frontend Modular Vanilla JS · WarnetAgent Tauri 1.5 & Rust · TightVNC
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/Version-v2.0.3-blue.svg?style=flat-square" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-stable-DEA584?style=flat-square&logo=rust" />
  <img alt="axum" src="https://img.shields.io/badge/axum-0.8-000000?style=flat-square" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v1.5-FFC131?style=flat-square&logo=tauri" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75%2B-DEA584?style=flat-square&logo=rust" />
  <img alt="Database" src="https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" />
</p>

---

## 📖 Tentang TMBilling

**TMBilling** adalah solusi manajemen operasional terpadu untuk warnet, cybercafe, dan arena esports modern. Dirancang dengan arsitektur **3-Layer Separation of Concerns (SoC)** yang tangguh, sistem ini mengintegrasikan server billing kasir, kasir kantin/FnB terpadu, kendali jarak jauh (remote control TightVNC berbasis web), monitoring hardware baseline anti-maling, dan pertahanan klien 5-lapis (*5-Layer Anti-Tamper Security*).

> 📚 **Dokumentasi Lengkap (Single Source of Truth):**  
> Untuk panduan arsitektur mendalam, spesifikasi fitur lengkap, katalog 245 route API, dan skema database, buka **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)**.

---

## ✨ Sorotan Fitur Utama (v2.0.3)

- 🔐 **Zero-Config Out-of-the-Box Security**: Instalasi instan tanpa konfigurasi manual yang rumit. Server otomatis meng-generate `SECRET_KEY` kuat 64-hex persisten ke `.env`, membuat password superadmin acak sekali-pakai (`initial_admin.txt`), auto-generate password VNC unik, dan memproteksi pembaruan sistem via URL Whitelist anti-SSRF.
- ☁️ **Cloudflare Tunnel & Remote Access**: Akses dashboard kasir & owner dari internet secara instan tanpa perlu port-forwarding router atau IP publik statis.
- ⚡ **Multi-PC Selection & Batch Actions (`remoteBatch`)**: Seleksi banyak PC sekaligus (drag select/checkbox) untuk Shutdown, Restart, Kunci, Pindah PC, atau Terapkan Paket promosi secara massal.
- 🖥️ **TightVNC Remote Control + Dual-Clipboard Sync**: Kendalikan layar, keyboard, dan mouse PC klien langsung dari browser web kasir dengan sinkronisasi clipboard teks dua arah otomatis (Port 5900 Loopback).
- 🔌 **Blackout Auto-Recovery System**: Toleransi pemadaman listrik otomatis. Durasi dan saldo pelanggan tidak hilang ketika terjadi mati lampu mendadak (*Auto Session Resume*).
- 🛡️ **5-Layer WarnetAgent Anti-Tamper Security**: Proteksi klien berlapis menggunakan Win32 Low-level Hooks, Kiosk lockdown, integritas Registry SHA-256 Hashes Dual-Hive (`HKCU` & `HKLM`), dan Watchdog Supervisor Daemon (`MGCTM.exe`).
- 🔍 **Hardware Baseline & Theft Alerts**: Snapshot spesifikasi hardware (CPU, GPU, RAM, Disk serials) untuk mendeteksi penggantian atau pencurian sparepart PC secara *real-time*.
- 🔒 **Kunci Meja AFK / Istirahat Sementara (Screen Lock)**: Fitur penguncian layar PC klien saat ditinggal istirahat dengan tampilan hitam polos minimalis, countdown billing real-time, autentikasi password member / PIN guest, remote control kasir, dan master unlock.
- 💼 **Shift Kasir & Hitung Buta (*Blind Cash Reconciliation*)**: Sistem serah terima shift anti-manipulasi kasir dengan input modal awal dinamis, *blind count* uang fisik laci, auto-audit selisih (surplus/defisit), cetak struk handover thermal 58mm, dan fitur *Admin Force Close*.
- 🍔 **POS Kantin & Log Mutasi Stok Inventaris**: Kasir penjualan makanan/minuman dengan stok unlimited/limited, audit log mutasi stok (`MenuStockLog`), restock barang, multi-payment (Tunai/QRIS/Transfer), dan cetak struk thermal 58mm/80mm.
- 📋 **Dynamic Tutorials CMS**: Modul SOP dan panduan operator warnet bawaan berbasis custom CKEditor 5 WYSIWYG.
- 📂 **Process Monitor**: Pantau dan matikan proses aplikasi yang not-responding dari jarak jauh.
- 🗂️ **Arsip vs Hapus Permanen Terpisah**: Setiap PC, paket, member, user, game, grup, dan menu punya dua aksi berbeda — arsip (nonaktifkan, bisa dipulihkan) dan hapus permanen yang meminta konfirmasi centang, melepas relasi riwayat tanpa menghapus data transaksi. Semua data terarsip terkumpul di tab **Data Diarsipkan** dengan pill kategori + pill grup, footer `Total N arsip`, dan tombol pulihkan yang langsung menyegarkan daftar.
- 📱 **Responsive Dual-Layout**: Antarmuka adaptif untuk layar 1024px, 1920px Full HD, serta layar sentuh tablet/smartphone.

---

## 📦 Struktur Repositori

```text
c:\Project GIT\TMBilling
├── app-rust/                   # Backend Rust 2.0.3 (biner tmbilling-server.exe)
│   ├── Cargo.toml              # Single Source of Version (2.0.3)
│   ├── src/                    # routes/, services/, repositories/, models/, cache/, db/
│   ├── migrations/             # Skema head 24 tabel
│   ├── packaging/              # install.bat, update.bat
│   └── tests/                  # 12 suite contract + 6 suite unit
├── app/                        # Backend Python 1.6.5 (BEKU) + frontend bersama
│   ├── static/js/kasir/        # Modular Vanilla ES6 Frontend JS
│   └── templates/              # Jinja2 kasir/member/tv/public
├── docs/                       # Master Dokumentasi
│   ├── DOCUMENTATION.md        # Master Technical Manual & Single Source of Truth
│   ├── RUST_MIGRATION.md       # Keputusan migrasi & cutover
│   └── superpowers/            # Arsip rencana kerja & spesifikasi
├── tools/ckeditor-builder/     # Custom CKEditor 5 Build untuk CMS
├── WarnetAgent/                # Klien: Tauri 1.5, watchdog, monitor, uninstaller, Deploy
├── build_release.py            # ZIP server: biner + install.bat + update.bat
├── build_and_deploy.bat        # Kompilasi biner klien & aset CSS
├── scripts/rust_parity.py      # Gate paritas endpoint Python vs Rust
├── CHANGELOG.md
└── README.md
```

---
## 🚀 Panduan Instalasi & Pengoperasian Cepat

### Prasyarat Sistem:
- **Server Billing**: Windows 10/11 / Windows Server x86_64, browser dashboard Chrome/Edge 111+ (CSS Tailwind 4 memakai OKLCH & `@property`).
- **PC Klien Warnet**: Windows 10/11 64-bit, Microsoft Edge WebView2 Runtime.
- **Pengembang**: Rust stable (MSVC) + Visual Studio Build Tools, Node.js 20+ (Tailwind CLI 4); Python 3.11+ hanya untuk parity gate & `build_release.py`.

---

### 1. Setup & Menjalankan Server Billing (Komputer Server / Kasir)
1. **Unduh Paket Server**:
   Unduh `TMBilling_Server_v2.0.3.zip` dari **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)** lalu ekstrak di komputer server (contoh: `C:\TMBilling`).
2. **Instalasi Server 1-Klik**:
   ```cmd
   install.bat
   ```
   > Skrip menyalin `tmbilling-server.exe` ke folder induk dan mendaftarkan autostart login Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`). Tidak ada Python/pip yang dibutuhkan.
3. **Menyalakan Server**:
   ```cmd
   tmbilling-server.exe
   ```
   > Server berjalan di `0.0.0.0:7015` (ikon tray tersedia). Buka **`http://localhost:7015`**.
   > Kredensial superadmin awal dibuat acak saat pertama kali jalan dan dicetak ke `initial_admin.txt` di root aplikasi. Login lalu segera ganti di **Manajemen Staff**.
   > Jalankan `tmbilling-server.exe --init` bila hanya ingin menyiapkan `.env` dan `instance/` tanpa melayani request.
4. **Menghentikan Server**:
   Klik kanan ikon tray → **Keluar**, atau:
   ```powershell
   Get-Process tmbilling-server -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
5. **Cara Pembaruan / Update Versi Server**:
   - **1-Klik dari Dashboard**: menu **Pengaturan > Migrasi & Update** → cek GitHub → mulai update. Biner lama berhenti, ZIP ditukar (`--apply-update`), lalu server menyala lagi. `.env`, `instance/`, dan `backups/` tidak ditimpa.
   - **Manual via `update.bat`**:
     ```cmd
     update.bat TMBilling_Server_v2.0.3.zip
     ```
     atau drag-and-drop ZIP ke `update.bat`.

> **Jalur Python 1.6.5 (beku)**: `install.bat`, `start.bat`, `stop.bat`, `update.bat`, `run.py`, dan `install_scripts/` di root masih mempertahankan alur Flask lama sebagai acuan 1:1. Untuk instalasi baru gunakan paket Rust di atas.

---
### 2. Setup & Instalasi WarnetAgent (PC Klien Warnet)

1. **Unduh Paket Klien**:
   Unduh paket rilis klien terbaru (misal: `TMBilling_Client_v1.6.5.zip`) dari halaman **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)** lalu ekstrak ke PC Klien *(atau salin isi folder `WarnetAgent\Deploy` jika Anda mengunduh full repository)*.
2. Klik kanan **`install.bat`** lalu pilih **Run as administrator** (atau jalankan biasa).
3. Masukkan **IP Server Billing** saat diminta (contoh: `192.168.1.100`). Port default `7015` akan otomatis digunakan *(kecuali jika Anda mengubah port server billing, Anda dapat memasukkan format `IP:PORT`, contoh: `192.168.1.100:8080`)*. Masukkan juga **API Key** yang dapat Anda cek dan kelola di dashboard server melalui menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System (Client API Key)**.

> [!WARNING]
> **PENTING — KEAMANAN API KEY & KREDENSIAL DARURAT:**
> - **Wajib Ganti Default API Key**: Jangan gunakan API Key bawaan (`TM2026QWERTY-api-key`). Anda dapat melihat dan mengubah API Key secara praktis langsung dari dashboard di menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System**, lalu klik **Simpan API Key** *(atau bagi yang memahami konfigurasi server, dapat langsung menyesuaikan variabel `CLIENT_API_KEY` pada file `.env`)*. Pastikan API Key yang diinput pada PC klien sama persis dengan yang ada di server dan selalu jaga kerahasiaannya.
> - **Wajib Ganti Emergency User & Password**: Saat installer menanyakan kredensial admin darurat (*Emergency Access*), harap segera ubah dari nilai default (`TMBilling` / `TM123qaz!@#`) untuk mencegah akses darurat tak sah di PC klien.
> - **Wajib Hapus / Amankan Berkas `admin_credentials.txt`**: Setelah instalasi selesai, installer membuat catatan kredensial `admin_credentials.txt` di folder instalasi (contoh: `C:\TMBILLING\admin_credentials.txt`). **Segera catat kredensial tersebut lalu hapus berkasnya (atau pindahkan ke tempat aman admin)** agar tidak terlihat atau diakses oleh pengguna/pelanggan di PC klien!

4. **Otomatisasi Instalasi**:
   - Skrip menyalin seluruh binary (`TMBilling.exe`, `MGCTM.exe`, `TMMonitor.exe`, `WebView2Loader.dll`, `mtm.exe`, `TightVNC`).
   - Mendaftarkan konfigurasi Registry Windows (`HKCU` & `HKLM`) dan TightVNC port `5900` loopback.
   - Menambahkan aturan Windows Defender Firewall otomatis untuk port 5900 dan executable.
   - Mendaftarkan shortcut Startup Windows agar agen otomatis aktif saat PC booting.
   - Menghitung hash SHA-256 binary untuk proteksi integritas dan langsung menjalankan agen di background.

5. **Cara Pembaruan / Update Versi Klien**:
   Karena biner klien memiliki proteksi anti-tamper dan pengawas supervisor ganda (*watchdog mutual guard*), pembaruan versi klien dilakukan dengan alur bersih berikut:
   1. Jalankan **`uninstall.bat`** (atau `TMBilling_Uninstaller.exe`) di PC klien untuk menghentikan seluruh proses proteksi secara legal dan membersihkan instalasi versi lama.
   2. Unduh dan ekstrak paket klien versi terbaru (`TMBilling_Client_v<versi>.zip`) dari **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)**.
   3. Jalankan **`install.bat`** seperti biasa, lalu masukkan IP Server Billing dan API Key yang sesuai.

6. **Uninstalasi Klien**:
   Jalankan **`uninstall.bat`** di PC klien untuk meluncurkan panel uninstalasi aman.

---

### 3. Panduan Pengembang (Developer & Build Pipeline)
1. **Clone Repositori**:
   ```bash
   git clone https://github.com/milanalfandiismail/TMBilling.git
   cd TMBilling
   ```
2. **Build Backend Rust**:
   ```cmd
   cd app-rust
   cargo build --release
   ```
   > Hasil: `app-rust\target\release\tmbilling-server.exe`. Hentikan server yang sedang berjalan sebelum build (Windows mengunci biner).
3. **Menjalankan Test Backend Rust**:
   ```cmd
   cd app-rust
   cargo test -j 2 -- --test-threads=2
   ```
   > 12 suite kontrak (`tests/contract/`) + 6 suite unit (`tests/unit/`). Satu suite: `cargo test --test sesi_test -- --nocapture`.
4. **Gate Paritas Endpoint**:
   ```cmd
   .venv\Scripts\python.exe scripts\rust_parity.py
   ```
   > Wajib mencetak `Hanya di Python : 0` sebelum rilis. Butuh virtual environment Python berisi dependensi `requirements.txt`.
5. **Merilis Paket Server**:
   ```cmd
   .venv\Scripts\python.exe build_release.py
   ```
   > Menghasilkan `TMBilling_Server_v2.0.3.zip` berisi biner, `install.bat`, `update.bat`, dan `SHA256SUMS.txt`.
6. **Frontend & Klien**:
   ```cmd
   npm install
   npm run build:css
   build_and_deploy.bat
   ```
   > `build_and_deploy.bat` mengompilasi seluruh modul klien Rust/Tauri, `TMLHMService`, dan menyalin biner ke `WarnetAgent\Deploy\`.
7. **E2E Browser (Playwright)**:
   ```powershell
   npm run test:e2e
   ```
   > 15 suite Chromium berjalan paralel memakai sandbox Python terisolasi (database, port, catatan, backup sendiri); DB produksi dijaga guard sha256.

---
## 📚 Navigasi Dokumentasi

| Dokumen | Deskripsi |
| :--- | :--- |
| **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)** | **Master Dokumentasi Teknis (Single Source of Truth)** — Memuat arsitektur sistem, katalog 31 domain fitur, 245 route REST API, skema 24 tabel, panduan backend Rust/frontend/klien, dan spesifikasi VNC bridge. |
| **[CHANGELOG.md](file:///c:/Project%20GIT/TMBilling/CHANGELOG.md)** | **Catatan Rilis** — Riwayat log perubahan dan rilis; entri terbaru mengikuti versi `app-rust/Cargo.toml`. |

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

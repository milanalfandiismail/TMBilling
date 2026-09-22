<!-- markdownlint-disable MD033 MD041 -->
<h1 align="center">🖥️ TMBilling</h1>

<p align="center">
  <strong>Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise Grade)</strong>
  <br />
  Backend Flask · Frontend Modular Vanilla JS · WarnetAgent Tauri v2 & Rust · TightVNC Remote Control
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/Version-v1.6.2-blue.svg?style=flat-square" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python" />
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v2.0-FFC131?style=flat-square&logo=tauri" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75%2B-DEA584?style=flat-square&logo=rust" />
  <img alt="Database" src="https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" />
</p>

---

## 📖 Tentang TMBilling

**TMBilling** adalah solusi manajemen operasional terpadu untuk warnet, cybercafe, dan arena esports modern. Dirancang dengan arsitektur **3-Layer Separation of Concerns (SoC)** yang tangguh, sistem ini mengintegrasikan server billing kasir, kasir kantin/FnB terpadu, kendali jarak jauh (remote control TightVNC berbasis web), monitoring hardware baseline anti-maling, dan pertahanan klien 5-lapis (*5-Layer Anti-Tamper Security*).

> 📚 **Dokumentasi Lengkap (Single Source of Truth):**  
> Untuk panduan arsitektur mendalam, 28 spesifikasi fitur lengkap, katalog 250 endpoint API, dan skema database, buka **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)**.

---

## ✨ Sorotan Fitur Utama (v1.6.2)

- 🌐 **Multi-Branch Control Panel**: Akses, kelola, dan pantau banyak cabang warnet dari satu dashboard terpusat tanpa memerlukan IP publik statis.
- ⚡ **Multi-PC Selection & Batch Actions (`remoteBatch`)**: Seleksi banyak PC sekaligus (drag select/checkbox) untuk Shutdown, Restart, Kunci, Pindah PC, atau Terapkan Paket promosi secara massal.
- 🖥️ **TightVNC Remote Control + Dual-Clipboard Sync**: Kendalikan layar, keyboard, dan mouse PC klien langsung dari browser web kasir dengan sinkronisasi clipboard teks dua arah otomatis (Port 5900 Loopback).
- 🔌 **Blackout Auto-Recovery System**: Toleransi pemadaman listrik otomatis. Durasi dan saldo pelanggan tidak hilang ketika terjadi mati lampu mendadak (*Auto Session Resume*).
- 🛡️ **5-Layer WarnetAgent Anti-Tamper Security**: Proteksi klien berlapis menggunakan Win32 Low-level Hooks, Kiosk lockdown, integritas Registry SHA-256 Hashes Dual-Hive (`HKCU` & `HKLM`), dan Watchdog Supervisor Daemon (`MGCTM.exe`).
- 🔍 **Hardware Baseline & Theft Alerts**: Snapshot spesifikasi hardware (CPU, GPU, RAM, Disk serials) untuk mendeteksi penggantian atau pencurian sparepart PC secara *real-time*.
- 🍔 **POS Kantin & Billing FnB Multi-Payment**: Kasir penjualan makanan/minuman dengan stok unlimited/limited, pembayaran Tunai/QRIS/Transfer, cetak struk thermal 58mm/80mm, dan opsi pembebanan langsung ke sesi PC.
- ☁️ **Cloudflare Tunnel Auto-Service**: Akses dashboard kasir & owner dari internet secara instan tanpa perlu port-forwarding router.
- 📋 **Dynamic Tutorials CMS**: Modul SOP dan panduan operator warnet bawaan berbasis custom CKEditor 5 WYSIWYG.
- 📂 **Web File Explorer & Process Monitor**: Jelajahi file disk PC klien serta pantau / matikan proses aplikasi yang not-responding dari jarak jauh.
- 📱 **Responsive Dual-Layout**: Antarmuka adaptif untuk layar 1024px, 1920px Full HD, serta layar sentuh tablet/smartphone.

---

## 📦 Struktur Repositori

```text
c:\Project GIT\TMBilling
├── app/                        # Backend Server Flask & Frontend Kasir Web
│   ├── config.py               # Single Source of Version Truth (v1.6.2)
│   ├── models/                 # 25 Database Model SQLAlchemy
│   ├── routes/                 # 30 Blueprint REST & WebSocket (250 Endpoints)
│   ├── services/               # 35+ Service Layer Logika Bisnis
│   └── static/js/kasir/        # Modular Vanilla ES6 Frontend JS
├── docs/                       # Master Dokumentasi
│   ├── DOCUMENTATION.md        # Master Technical Manual & Single Source of Truth
│   └── superpowers/            # Arsip Rencana Kerja & Spesifikasi
├── tools/ckeditor-builder/     # Custom CKEditor 5 Build untuk CMS
├── WarnetAgent/                # Source Code Klien Warnet (Rust / Tauri v2)
│   ├── TMBillingTauri/         # Klien Utama (Lockscreen, Overlay, Win32 Hooks)
│   ├── TMBilling_Monitor/      # Modul Hardware Monitor & Process Helper
│   ├── MGCTM/                  # Watchdog Service Supervisor
│   ├── TMBilling_Uninstaller/  # Secure Uninstaller
│   └── Deploy/                 # Paket Siap Deploy Klien & Skrip Instalasi
├── install.bat                 # Skrip Instalasi Server 1-Klik
├── start.bat                   # Skrip Menyalakan Server (Port 7015 Background)
├── stop.bat                    # Skrip Menghentikan Server
├── developer_install.bat       # Skrip Inisialisasi Environment Pengembang
├── build_and_deploy.bat        # Skrip Kompilasi Seluruh Binary Klien ke Deploy
├── CHANGELOG.md                # Riwayat Rilis & Update Per Versi
└── README.md                   # File Ini
```

---

## 🚀 Panduan Instalasi & Pengoperasian Cepat

### Prasyarat Sistem:
- **Server Billing**: Windows 10/11 / Windows Server, Python 3.10+, Koneksi Internet (untuk dependensi awal).
- **PC Klien Warnet**: Windows 10/11 64-bit, Microsoft Edge WebView2 Runtime.
- **Pengembang (Opsional)**: Node.js 18+, Rust & Cargo 1.75+, .NET Framework 4.5+ SDK.

---

### 1. Setup & Menjalankan Server Billing (Komputer Server / Kasir)

1. **Instalasi Server 1-Klik**:
   Jalankan file `install.bat` di direktori utama:
   ```cmd
   install.bat
   ```
   > Skrip otomatis memeriksa Python, membuat virtual environment (`.venv`), memasang seluruh dependensi dari `requirements.txt`, meng-generate file `.env` dengan `SECRET_KEY` acak, dan menginisialisasi basis data SQLite.

2. **Menyalakan Server**:
   ```cmd
   start.bat
   ```
   > Server otomatis berjalan di background pada port `7015`. Buka browser ke:
   > **`http://localhost:7015`** *(Login Default: `admin` / `admin123`)*.

3. **Menghentikan Server**:
   ```cmd
   stop.bat
   ```

---

### 2. Setup & Instalasi WarnetAgent (PC Klien Warnet)

1. Salin isi folder `WarnetAgent\Deploy` (atau paket zip rilis agen) ke PC Klien.
2. Klik kanan **`install.bat`** lalu pilih **Run as administrator** (atau jalankan biasa).
3. Masukkan **IP Server Billing** saat diminta (contoh: `192.168.1.100`). Port default `7015` akan otomatis digunakan *(kecuali jika Anda mengubah port server billing, Anda dapat memasukkan format `IP:PORT`, contoh: `192.168.1.100:8080`)*. Masukkan juga **API Key** yang dapat Anda cek dan kelola di dashboard server melalui menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System (Client API Key)**.

> [!WARNING]
> **PENTING — KEAMANAN API KEY & KREDENSIAL DARURAT:**
> - **Wajib Ganti Default API Key**: Jangan gunakan API Key bawaan (`TM2026QWERTY-api-key`). Anda dapat melihat dan mengubah API Key di dashboard kasir/server melalui menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System**, lalu klik **Simpan API Key** *(konfigurasi `CLIENT_API_KEY` pada file `.env` ditujukan khusus untuk kebutuhan development)*. Pastikan API Key yang diinput pada PC klien sama dengan di server dan selalu jaga kerahasiaannya.
> - **Wajib Ganti Emergency User & Password**: Saat installer menanyakan kredensial admin darurat (*Emergency Access*), harap segera ubah dari nilai default (`TMBilling` / `TM123qaz!@#`) untuk mencegah akses darurat tak sah di PC klien.

4. **Otomatisasi Instalasi**:
   - Skrip menyalin seluruh binary (`TMBilling.exe`, `MGCTM.exe`, `TMMonitor.exe`, `WebView2Loader.dll`, `mtm.exe`, `TightVNC`).
   - Mendaftarkan konfigurasi Registry Windows (`HKCU` & `HKLM`) dan TightVNC port `5900` loopback.
   - Menambahkan aturan Windows Defender Firewall otomatis untuk port 5900 dan executable.
   - Mendaftarkan shortcut Startup Windows agar agen otomatis aktif saat PC booting.
   - Menghitung hash SHA-256 binary untuk proteksi integritas dan langsung menjalankan agen di background.

5. **Uninstalasi Klien**:
   Jalankan **`uninstall.bat`** di PC klien untuk meluncurkan panel uninstalasi aman.

---

### 3. Panduan Pengembang (Developer & Build Pipeline)

1. **Inisialisasi Environment Pengembang**:
   ```cmd
   developer_install.bat
   ```
2. **Kompilasi & Build Seluruh Komponen Klien**:
   ```cmd
   build_and_deploy.bat
   ```
   > Mengompilasi seluruh modul Rust (`TMBillingTauri`, `TMBilling_Monitor`, `MGCTM`, `TMBilling_Uninstaller`, `mtm`), microservice `TMLHMService`, dan menyalin seluruh binary rilis ke folder `WarnetAgent\Deploy\`.

3. **Menjalankan Pengujian Backend (Pytest)**:
   ```powershell
   .\.venv\Scripts\python.exe -m pytest
   ```

4. **Memeriksa Kompilasi Klien Rust**:
   ```powershell
   cd WarnetAgent\TMBillingTauri\src-tauri
   cargo check
   ```

---

## 📚 Navigasi Dokumentasi

| Dokumen | Deskripsi |
| :--- | :--- |
| **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)** | **Master Dokumentasi Teknis (Single Source of Truth)** — Memuat arsitektur sistem, katalog lengkap 28 fitur, katalog 250 endpoint REST API, skema 25 database models, panduan backend/frontend/Rust, dan spesifikasi protokol WebSocket. |
| **[CHANGELOG.md](file:///c:/Project%20GIT/TMBilling/CHANGELOG.md)** | **Catatan Rilis** — Riwayat log perubahan dan rilis dari `v1.0.0` hingga `v1.6.2`. |

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

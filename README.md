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
  <img alt="License" src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" />
</p>

---

## 📖 Tentang TMBilling

**TMBilling** adalah solusi manajemen operasional terpadu untuk warnet, cybercafe, dan arena esports modern. Dirancang dengan arsitektur **3-Layer Separation of Concerns (SoC)** yang tangguh, sistem ini mengintegrasikan server billing kasir, kasir kantin/FnB terpadu, kendali jarak jauh (remote control TightVNC berbasis web), monitoring hardware baseline anti-maling, dan pertahanan klien 5-lapis (*5-Layer Anti-Tamper Security*).

> 📚 **Dokumentasi Lengkap (Single Source of Truth):**  
> Untuk panduan arsitektur mendalam, 28 spesifikasi fitur lengkap, skema database, dan API reference, buka **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)**.

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
│   ├── routes/                 # 30 Blueprint REST & WebSocket
│   ├── services/               # 35+ Service Layer Logika Bisnis
│   └── static/js/kasir/        # Modular Vanilla ES6 Frontend JS
├── docs/                       # Master Dokumentasi
│   ├── DOCUMENTATION.md        # Master Technical Manual & Single Source of Truth
│   └── superpowers/            # Arsip Rencana Kerja & Spesifikasi
├── tools/ckeditor-builder/     # Custom CKEditor 5 Build untuk CMS
├── WarnetAgent/                # Source Code Klien Warnet (Rust / Tauri v2)
│   ├── TMBillingTauri/         # Klien Utama (Lockscreen, Overlay, Win32 Hooks)
│   ├── MGCTM/                  # Watchdog Service Supervisor
│   ├── TMBilling_Uninstaller/  # Secure Uninstaller
│   └── Deploy/                 # Skrip Instalasi Klien & Registry Firewall
├── build_and_deploy.bat        # Skrip Build Otomatis Klien & Server
├── developer_install.bat       # Skrip Inisialisasi Environment Cepat
├── CHANGELOG.md                # Riwayat Rilis & Update Per Versi
└── README.md                   # File Ini
```

---

## 🚀 Panduan Instalasi Cepat (Quick Start)

### Prasyarat Sistem:
- **Server Billing**: Windows 10/11 / Windows Server, Python 3.10+, Git.
- **Klien PC**: Windows 10/11 64-bit, Microsoft Edge WebView2 Runtime, TightVNC Server 2.8+.
- **Development (Opsional)**: Node.js 18+, Rust & Cargo 1.75+, Inno Setup 6+.

---

### 1. Setup Server Billing

```powershell
# 1. Clone repository
git clone https://github.com/milanalfandiismail/TMBilling.git
cd TMBilling

# 2. Jalankan skrip developer install (otomatis membuat venv & install packages)
.\developer_install.bat

# 3. Atau setup manual:
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 4. Jalankan Server Billing
python run.py
```
> Server akan aktif di `http://127.0.0.1:5000` (atau IP LAN Server: `http://192.168.1.X:5000`).

---

### 2. Setup WarnetAgent Klien (PC Warnet)

Untuk mengompilasi dan menguji aplikasi klien di komputer pengembang / komputer klien:

```powershell
# Masuk ke direktori Tauri Klien
cd WarnetAgent\TMBillingTauri

# Install dependensi frontend
npm install

# Jalankan dalam mode development
npm run tauri dev

# Build binary rilis klien (.exe)
npm run tauri build
```

---

### 3. Setup TightVNC & Firewall di PC Klien

Agar fitur Remote Control Web kasir berfungsi lancar:
1. Pastikan TightVNC Server terpasang di PC klien.
2. Jalankan skrip registrasi registry dan firewall otomatis:
   ```powershell
   cd WarnetAgent\Deploy
   # Jalankan sebagai Administrator:
   .\allow_firewall.bat
   ```
3. TightVNC akan otomatis terkonfigurasi pada port `5900` loopback lokal dan terhubung aman dengan WebSocket proxy server billing.

---

## 🛠️ Skrip Build & Deploy Otomatis

Untuk mengompilasi seluruh modul (Backend, Frontend, dan WarnetAgent Klien Rust) sekaligus mengemas installer:

```powershell
# Dari root repositori:
.\build_and_deploy.bat
```

---

## 🧪 Menjalankan Pengujian (Testing)

### 1. Backend Test Suite (Pytest)
```powershell
pytest
```

### 2. Rust Agent Check
```powershell
cd WarnetAgent\TMBillingTauri\src-tauri
cargo check
```

---

## 📚 Navigasi Dokumentasi

| Dokumen | Deskripsi |
| :--- | :--- |
| **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)** | **Master Dokumentasi Teknis (Single Source of Truth)** — Memuat arsitektur sistem, katalog lengkap 28 fitur, skema database, panduan backend/frontend/Rust, dan spesifikasi API. |
| **[CHANGELOG.md](file:///c:/Project%20GIT/TMBilling/CHANGELOG.md)** | **Catatan Rilis** — Riwayat log perubahan dan rilis dari `v1.0.0` hingga `v1.6.2`. |

---

## 📜 Lisensi & Hak Cipta

Hak Cipta © 2026 **TMBilling Team**. Seluruh hak cipta dilindungi undang-undang.

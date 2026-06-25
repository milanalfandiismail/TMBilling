<!-- markdownlint-disable MD033 MD041 -->
<h1 align="center">🖥️ TMBilling</h1>

<p align="center">
  <strong>Sistem Manajemen Billing Warnet / Cybercafe Premium</strong>
  <br />
  Backend Flask · Frontend Vanilla JS · Client Tauri + Rust · Agent Rust
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.8%2B-3776AB?style=flat-square&logo=python" />
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-1.6-FFC131?style=flat-square&logo=tauri" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75%2B-000000?style=flat-square&logo=rust" />
  <img alt="SQLite" src="https://img.shields.io/badge/Database-SQLite%20|%20PostgreSQL-003B57?style=flat-square&logo=sqlite" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

<details>
  <summary><strong>📋 Daftar Isi</strong></summary>

- [📖 Tentang](#-tentang)
- [✨ Key Features](#-key-features)
- [🏗️ Arsitektur Sistem](#️-arsitektur-sistem)
- [📦 Struktur Repository](#-struktur-repository)
- [⚙️ Tech Stack](#️-tech-stack)
- [🚀 Quick Start — Server](#-quick-start--server)
- [💻 Quick Start — Client PC](#-quick-start--client-pc)
- [🔗 Client Polling & Data Flow](#-client-polling--data-flow)
- [🔐 Security System](#-security-system)
- [🛡️ Agent & Guardian System](#️-agent--guardian-system)
- [📊 Database Schema](#-database-schema)
- [🌐 API Endpoints](#-api-endpoints)
- [🎨 Frontend Dashboard](#-frontend-dashboard)
- [🛠️ Developer Guide](#️-developer-guide)
- [📚 Dokumentasi Lengkap](#-dokumentasi-lengkap)
- [🐛 Troubleshooting](#-troubleshooting)
- [📜 License](#-license)

</details>

---

## 📖 Tentang

**TMBilling** adalah sistem billing warnet/cybercafe berbasis web dengan arsitektur **3-layer** (Routes → Services → Repositories), dilengkapi **client lockscreen Tauri/Rust** di PC warnet, **watchdog multi-layer** (MGCTM + mtm), dan **monitoring hardware real-time**.

Sistem dirancang untuk:

- **Kasir** — Buka/tutup sesi, monitor PC grid real-time, cetak struk thermal 58mm
- **Member** — Login prepaid dengan saldo waktu, top-up via paket
- **Admin** — Manajemen PC, paket, grup, user, laporan, dan recovery blackout
- **Client PC** — Lockscreen kiosk, auto-login sesi aktif, polling tiap 5 detik, shutdown otomatis

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h4>🖥️ Dashboard Kasir Real-time</h4>
      <ul>
        <li>Grid PC dengan status warna (kosong/terpakai/admin/offline)</li>
        <li>Group tabs per zona (reguler, vip, vvip)</li>
        <li>Auto-refresh tiap 5 detik</li>
        <li>Buka sesi guest/member dalam 2 clicks</li>
      </ul>
    </td>
    <td width="50%">
      <h4>🔒 Client Lockscreen (Tauri)</h4>
      <ul>
        <li>Kiosk fullscreen — keyboard & mouse lock</li>
        <li>Low-level keyboard hook (WH_KEYBOARD_LL)</li>
        <li>Polling status tiap 5 detik</li>
        <li>Auto-login pas restart (guest & member)</li>
        <li>Shutdown timer otomatis</li>
        <li>Audio warning sisa 5 menit</li>
        <li>Native single-instance protection untuk mencegah multi-running window</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📊 Monitoring Hardware</h4>
      <ul>
        <li>CPU/GPU temperature & usage real-time</li>
        <li>RAM, motherboard, NIC speed</li>
        <li>Active window detection</li>
        <li>Telemetry tiap 60 detik</li>
      </ul>
    </td>
    <td>
      <h4>⚡ Blackout Recovery</h4>
      <ul>
        <li>Auto-detect sesi mati lampu (heartbeat timeout)</li>
        <li>Resolve sesi member — refund sisa waktu</li>
        <li>Resolve sesi guest — pindah/tutup/lanjut</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🛡️ Multi-Layer Watchdog</h4>
      <ul>
        <li>MGCTM — Master guardian loop 5-detik</li>
        <li>mtm — Anti-kill scout siluman</li>
        <li>Self-healing: MGCTM mati → mtm revive</li>
        <li>Hex-XOR obfuscation anti-regedit</li>
        <li>SHA256 integrity verification</li>
      </ul>
    </td>
    <td>
      <h4>📈 Cetak Struk Thermal 58mm</h4>
      <ul>
        <li>Print via iframe tersembunyi</li>
        <li>Format monospace untuk printer thermal</li>
        <li>Preview sebelum cetak</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔐 Emergency Offline Bypass</h4>
      <ul>
        <li>Client lockscreen — bypass dari Registry (diatur saat install)</li>
        <li>Uninstaller — offline fallback via EmergencyToken dari Registry</li>
        <li>Server override saat online (anti-cheat)</li>
      </ul>
    </td>
    <td>
      <h4>🔄 API Key Rotation Dinamis</h4>
      <ul>
        <li>Update API Key dari dashboard kasir</li>
        <li>Update instan ke .env + Flask config</li>
        <li>Tanpa restart server</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>☁️ Multi-Provider Cloud Backup</h4>
      <ul>
        <li>Kompresi database SQLite ke ZIP secara otomatis</li>
        <li>Upload simultan ke Discord, WebDAV, GDrive, dan NAS</li>
        <li>Auto-cleanup FIFO (menyimpan 5 file lokal & cloud)</li>
        <li>Test connection langsung dari dashboard kasir</li>
      </ul>
    </td>
    <td>
      <h4>🏆 Tournament Bracket Maker</h4>
      <ul>
        <li>Sistem kompetisi warnet terintegrasi</li>
        <li>Matchmaking otomatis Playoffs (Single Elimination)</li>
        <li>Sistem pairing Swiss Stage dengan scoring real-time</li>
        <li>Kemudahan update bracket & bagan pertandingan</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>💼 Shift Handover Kasir</h4>
      <ul>
        <li>Audit keuangan kasir dengan Blind Count (hitung buta)</li>
        <li>Auto-calculate deviasi pendapatan (Surplus/Defisit)</li>
        <li>Cetak struk pertanggungjawaban shift via printer thermal</li>
      </ul>
    </td>
    <td>
      <h4>🌐 Portal Web Member</h4>
      <ul>
        <li>Portal login mandiri pelanggan prepaid di <code>/member</code></li>
        <li>Informasi sisa saldo waktu & PC aktif secara real-time</li>
        <li>Riwayat login bermain & detail transaksi top-up</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🧩 Plugin Manager (Extensibility)</h4>
      <ul>
        <li>Deteksi modul plugin otomatis dari folder <code>plugins/</code></li>
        <li>Isolasi UI frontend menggunakan Iframe SPA mandiri</li>
        <li>Custom API & logic tanpa mengubah core backend</li>
      </ul>
    </td>
    <td>
      <h4>🌍 Multi-Timezone Support</h4>
      <ul>
        <li>Konfigurasi terpusat untuk berbagai zona waktu (WIB, WITA, WIT)</li>
        <li>Tampilan jam dashboard dan sinkronisasi client yang akurat</li>
        <li>Format otomatis pada laporan dan riwayat shift kasir</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🛡️ IP Whitelist Kasir</h4>
      <ul>
        <li>Batasi akses dashboard <code>/kasir</code> hanya dari alamat IP yang dikenali</li>
        <li>Mode Bypass Token (Darurat) untuk remote access dinamis</li>
        <li>Perlindungan akses internal ganda</li>
      </ul>
    </td>
    <td>
      <h4>⚙️ Auto Scheduler</h4>
      <ul>
        <li>Manajemen job otomatis di background (APScheduler)</li>
        <li>Konfigurasi ON/OFF langsung dari Settings Kasir</li>
        <li>Auto-cleanup log dan task maintenance lainnya</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📦 DB Migration & Update System</h4>
      <ul>
        <li>Update aplikasi via upload ZIP langsung dari dashboard</li>
        <li>Auto-detect migrations — backup + migrate otomatis kalau ada perubahan skema</li>
        <li>Tanpa migrasi — update BE/FE biasa kalau ZIP tanpa folder migrations/</li>
        <li>Auto-restart server + reload frontend</li>
        <li>CLI alternative: <code>python run.py --release</code></li>
      </ul>
    </td>
    <td>
      <h4>📜 Riwayat Migrasi Database</h4>
      <ul>
        <li>Lihat semua revisi migrasi dengan status (HEAD / Aktif)</li>
        <li>Deteksi otomatis apakah skema perlu upgrade</li>
        <li>Terintegrasi dengan Flask-Migrate + Alembic</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏗️ Arsitektur Sistem

### 3-Layer Architecture (Strict SoC)

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Routes    │ ──> │  Services    │ ──> │  Repositories  │ ──> DB
│ (Endpoints) │     │ (Business)   │     │   (Queries)    │
└─────────────┘     └──────────────┘     └────────────────┘
       │                    │                     │
   Validasi           commit/rollback         add/delete
   Request            try/except              query only
       ↓                    ↓
   JSON Response      raise Exception
```

### End-to-End Data Flow

👉 *[Lihat Diagram Lengkap di sini](docs/DIAGRAMS.md)*

### System Topology

👉 *[Lihat Diagram Lengkap di sini](docs/DIAGRAMS.md)*

---

## 📦 Struktur Repository

```
TMBilling/
├── app/                                    # 🐍 Backend Flask
│   ├── __init__.py                         # Factory + blueprint registration
│   ├── config.py                           # Environment config
│   ├── models/                             # SQLAlchemy models (9 entities)
│   │   ├── base.py                         # db instance, now_local()
│   │   ├── pc.py                           # Unit komputer
│   │   ├── sesi.py                         # Session bermain
│   │   ├── transaksi.py                    # Transaksi keuangan
│   │   ├── member.py                       # Pelanggan prepaid
│   │   ├── paket.py                        # Paket billing
│   │   ├── grup.py                         # Zona kategori
│   │   ├── user.py                         # Staff kasir/admin
│   │   ├── hardware.py                     # Monitoring CPU/GPU/RAM
│   │   └── settings.py                     # Key-value config
│   ├── routes/                             # API endpoints (14 blueprints)
│   ├── services/                           # Business logic (16 services)
│   ├── repositories/                       # Data access layer (10 repos)
│   ├── templates/kasir/                    # Jinja2 templates
│   │   ├── login.html                      # Halaman login kasir
│   │   └── index.html                      # SPA dashboard
│   ├── static/js/kasir/                    # Frontend JS modules
│   │   ├── core/                           # API client, utils, toast, modal
│   │   ├── components/                     # Modal buka/tambah sesi
│   │   └── modules/                        # Per-tab modules (12 modules)
│   └── utils/                              # Logger, helpers
│
├── plugins/                                # 🧩 Custom Extensions (API & UI)
│   └── hello_world/                        # Contoh plugin boilerlate
│
├── WarnetClient/                           # 💻 Client PC Warnet
│   ├── TMBillingTauri/                     # Main lockscreen (Tauri + Rust + HTML/JS/CSS)
│   │   ├── src/                            # HTML + JS frontend
│   │   │   ├── index.html                  # Lockscreen + overlay UI
│   │   │   ├── js/app.js                   # App controller, event listeners
│   │   │   ├── js/ui.js                    # DOM manipulation, timer, toast
│   │   │   └── js/api.js                   # Tauri invoke wrappers
│   │   └── src-tauri/src/                  # Rust backend
│   │       ├── main.rs                     # Setup, security, polling, hotkeys
│   │       ├── commands/                   # Tauri commands
│   │       │   ├── auth_commands.rs         # Login/logout/emergency
│   │       │   ├── window_commands.rs      # Kiosk/overlay switch
│   │       │   ├── network_commands.rs     # IP & MAC
│   │       │   └── system_commands.rs      # Shutdown, background
│   │       ├── utils/                      # Utilities
│   │       │   ├── api.rs                  # HTTP client + Hex-XOR
│   │       │   ├── keyboard.rs             # Low-level keyboard hook
│   │       │   └── window_manager.rs       # Taskbar control
│   │       ├── state.rs                    # Global state
│   │       └── models.rs                   # Data structs
│   └── TMMonitor/                          # Telemetry helper (C# - DEPRECATED)
│
├── WarnetAgent/                            # 🛡️ Agent & Guardian
│   ├── MGCTM/                              # Core launcher (Rust)
│   │   └── src/main.rs                     # 5s loop: spawn + sync + obfuscate
│   ├── mtm/                                # Anti-kill scout (Rust)
│   │   └── src/main.rs                     # Silent watchdog from AppData
│   ├── TMBilling_Monitor/                  # Hardware telemetry (Rust - TMMonitor.exe)

│   ├── TMBilling_Uninstaller/              # Uninstaller (Rust + Win32 GUI)
│   │   └── src/main.rs                     # Password GUI, offline fallback
│   └── Deploy/                             # 📦 Compiled binaries siap pakai
│       ├── MGCTM.exe
│       ├── TMBilling.exe
│       ├── TMMonitor.exe
│       ├── mtm.exe
│       ├── HardwareHelper.exe
│       ├── TMBilling_Uninstaller.exe
│       ├── install.bat                     # Auto installer
│       ├── write_config.ps1                # PowerShell config writer
│       ├── sync_registry.ps1               # Registry sync helper
│       └── create_admin_creds.ps1          # Password docs generator
│
├── docs/                                   # 📚 Dokumentasi
│   ├── CODEBASE_DOCUMENTATION.md           # Ringkasan semua komponen
│   ├── ARCHITECTURE.md                     # Arsitektur 3-layer, data flow
│   ├── BACKEND_GUIDE.md                    # Panduan backend
│   ├── FRONTEND_GUIDE.md                   # Panduan frontend & design system
│   ├── TECHNICAL_DOCS.md                   # API endpoint reference
│   ├── walkthrough.md                      # Implementasi Hex-XOR & watchdog
│   ├── UPGRADE_RUPIAH_AND_POS.md           # Dokumentasi format Rupiah & POS F&B
│   ├── NEW_FEATURES_GUIDE.md               # Panduan fitur baru (Turnamen, Member Portal, Shift)
│   └── agent.md                            # Agent task tracker
│
├── run.py                                  # 🔌 Entry point aplikasi server
├── seed.py                                 # 🌱 Data seeding script
├── requirements.txt                        # Python dependencies
├── .env.example                            # Environment template
└── README.md                               # Ini dia! 🎉
```

---

## ⚙️ Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| **Backend** | Python + Flask + SQLAlchemy | 3.8+ / 3.0+ |
| **Frontend (Kasir)** | Vanilla JS (ES6 Modules) + Local Tailwind CSS | - |
| **Database** | SQLite (development) / PostgreSQL / MySQL | - |
| **Client Lockscreen** | Tauri v1 + Rust + HTML/JS/CSS | 1.6+ / 1.75+ |
| **Agent (Guardian)** | Rust + WinAPI + winreg | 1.75+ |
| **Telemetry** | Rust + LibreHardwareMonitorLib | - |
| **WSGI Server** | Waitress (production) | - |
| **Scheduler** | APScheduler | - |
| **Font** | Inter (UI), JetBrains Mono (mono/angka) | - |

---

## 🚀 Quick Start — Server

### 📦 Setup Portable Server (Produksi Windows)

Jika Anda ingin mendistribusikan atau memasang server kasir TMBilling secara cepat di Windows OS tanpa perlu melakukan konfigurasi manual, Anda dapat menggunakan berkas batch otomatis:

1. **Ekstrak berkas `.zip`** aplikasi ke folder tujuan di komputer kasir.
2. **Jalankan `install.bat`** (klik ganda): Script akan membuat virtual environment `.venv` dan memasang seluruh dependensi otomatis. *(Membutuhkan koneksi internet pada pemasangan pertama)*.
3. **Konfigurasi berkas `.env`** di folder root jika diperlukan (untuk menyesuaikan port, database URL, dll).
4. **Jalankan `start.bat`** untuk menyalakan server kasir di latar belakang (*silent background mode* via `pythonw.exe`). Anda dapat langsung mengakses dashboard di browser Anda.
5. **Jalankan `stop.bat`** kapan saja untuk menghentikan server yang sedang berjalan di background secara aman.

> [!NOTE]  
> Jika database (`warnet.db`) masih kosong pada saat server pertama kali dijalankan, sistem secara otomatis akan membuatkan akun administrator default untuk login awal:
> * **Username:** `admin`
> * **Password:** `admin123`

---

### Prerequisites (Manual Setup)

- **OS** — Windows 10 / Windows 11 (64-bit)
- **Python 3.8+** — [Download](https://www.python.org/downloads/)
- **Git** — [Download](https://git-scm.com/downloads)

### 1. Clone

```bash
git clone https://github.com/milanalfandiismail/TMBilling.git
cd TMBilling
```

### 2. Virtual Environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
# Copy template
copy .env.example .env
# or
cp .env.example .env
```

Edit `.env`:

```ini
SECRET_KEY=ubah-dengan-string-acak-panjang
DATABASE_URL=sqlite:///warnet.db
CLIENT_API_KEY=ubah-dengan-api-key-rahasia
DEBUG_MODE=False

WAITRESS_THREADS=8
AUTO_SHUTDOWN_MINUTES=3
POLLING_INTERVAL=5
BLACKOUT_THRESHOLD_MINUTES=1
```

### 5. Init Database + Seed Data

```bash
python seed.py
```

Script `seed.py` akan membuat:
- **3 Grup PC**: `reguler`, `vip`, `vvip`
- **3 PC**: PC-01, PC-02 (reguler), VIP-01 (vip)
- **3 Paket Billing**: 1 Jam (5.000), 3 Jam (12.000), Begadang VIP (25.000)
- **1 User Admin**: `admin` / `admin`

### 6. Run Server

#### Production Mode (Waitress WSGI — Recommended)

```bash
python run.py
```

Output:
```
🚀 [PRODUCTION] Menjalankan server TMBilling menggunakan WSGI Waitress...
🔗 [PRODUCTION] Alamat: http://0.0.0.0:7015
🧵 [PRODUCTION] Threads (Workers): 8
```

#### Release Mode (Update Aplikasi + Auto Migrasi)

Upload file `TMBilling_Server_v*.zip` ke **Settings → Migrasi & Update**, atau via CLI:

```bash
# Auto-detect ZIP terbaru di app/update/
python run.py --release

# Dengan path ZIP custom
python run.py --release TMBilling_Server_v*.zip
```

Release mode akan:
1. Extract ZIP ke root project
2. Auto-detect `migrations/` → backup database + upgrade skema
3. Install dependencies
4. (User restart server manual setelah selesai)

#### Development Mode (Flask Dev Server)

```bash
python run.py
```

Output:
```
🚀 [PRODUCTION] Menjalankan server TMBilling menggunakan WSGI Waitress...
🔗 [PRODUCTION] Alamat: http://0.0.0.0:7015
🧵 [PRODUCTION] Threads (Workers): 8
```

#### Development Mode (Flask Dev Server)

Set `DEBUG_MODE=True` di `.env`, lalu:

```bash
python run.py
```

### 7. Akses Dashboard

Buka browser: **`http://localhost:7015`**

```
Login: admin / admin
```

---

## 💻 Quick Start — Client PC

### Metode Instalasi Cepat (via Deploy Folder)

> [!TIP]
> Semua binary sudah pre-compiled di `WarnetAgent/Deploy/`. Kamu **tidak perlu** compile ulang!

```bash
# 1. Copy folder WarnetAgent/Deploy/ ke USB / jaringan lokal
# 2. Di PC client, klik kanan install.bat → Run as Administrator
# 3. Masukkan IP Server TMBilling saat diminta
# 4. Masukkan API Key server saat diminta
# 5. Masukkan Emergency Username & Password (offline bypass) — lihat catatan di bawah
# 6. Selesai! PC langsung terkunci + polling aktif
```

> [!IMPORTANT]
> **Emergency Credentials** (Username & Password untuk offline bypass) diatur manual oleh admin **saat instalasi**. Installer akan meminta input dengan default `TMBilling` / `TM123qaz!@#`.
> Kredensial ini disimpan di Registry `HKLM\Software\TMBilling` (Hex-XOR terobfuscate) dan digunakan untuk:
> - **Lockscreen offline**: Login darurat saat server mati
> - **Uninstaller offline fallback**: Verifikasi password tanpa koneksi server
> Password juga bisa diubah via Dashboard Kasir (Settings → Emergency Token).

Yang terjadi otomatis:
1. Membuat `C:\TMBILLING\` + copy semua binary
2. Setup Registry `HKLM\Software\TMBilling`
3. Buat startup shortcut `MGCTM.lnk` di `%ProgramData%\...\StartUp\`
4. Copy `mtm.exe` siluman ke `%APPDATA%\Microsoft\Protect\`
5. Hitung SHA256 hash → simpan di Registry
6. Start MGCTM.exe → spawn TMBilling.exe + TMMonitor.exe

### Uninstall

**Dua jalur autentikasi:**

1. **Online (via server)** — Dari Dashboard Kasir → Settings → copy **Uninstall Token**, lalu masukkan di Uninstaller. Cocok kalau jaringan normal.
2. **Offline (via Emergency Token)** — Masukkan **Emergency Password** yang sama dengan yang di-set saat instalasi (`install.bat`). Token dibaca dari Registry `HKLM\Software\TMBilling` (Hex-XOR). **Tidak perlu koneksi server.**

Langkah:
1. Jalankan `TMBilling_Uninstaller.exe` sebagai Administrator
2. Masukkan **Uninstall Token** (jika online) atau **Emergency Password** (jika offline)
3. Klik Uninstall → selesai — semua file + Registry + shortcut terhapus bersih

---

## 🔗 Client Polling & Data Flow

### Polling Loop (5 detik)

👉 *[Lihat Diagram Lengkap di sini](docs/DIAGRAMS.md)*

### Auto-Login Behavior

| Skenario | Saat Restart PC |
|----------|----------------|
| **Guest** lagi main | ✅ Auto-login — sesi masih ada di DB |
| **Member** lagi main | ✅ Auto-login — sesi masih ada di DB |
| **Admin** lagi akses | ❌ Tidak auto-login — polling paksa logout |
| **Emergency** aktif | ❌ Emergency mode hilang setelah restart |

### Status Response Reference

**Sesi Aktif:**
```json
{
  "status": "aktif",
  "sisa_waktu": 45,
  "nama": "Guest2401",
  "grup": "tm",
  "pc_kode": "PC-01",
  "shutdown_timer": 0
}
```

**Kosong (dengan shutdown timer):**
```json
{
  "status": "kosong",
  "pc_kode": "PC-01",
  "shutdown_timer": 180
}
```

**Remote Force Lock dari Kasir:**
```json
{
  "status": "kosong",
  "pc_kode": "PC-01",
  "command": "lock"
}
```

---

## 🔐 Security System

### 0. IP Whitelist (Dashboard Access)

Akses ke `/kasir` dilindungi oleh middleware IP Whitelist.
- **Whitelist Strict**: Hanya IPv4 yang terdaftar di database yang bisa membuka Dashboard.
- **Bypass Token**: Admin bisa mengenerate token darurat (misal `?token=ABC`) untuk masuk via HP atau jaringan Cloudflare tanpa mendaftarkan IP.
- Pengaturan whitelist bisa langsung dikelola dari dalam dashboard jika login sudah sah.

### 1. Hex-XOR Obfuscation

Semua data sensitif disimpan **ter-obfuscate** di Registry dan config.ini — tidak bisa dibaca mentah via `regedit.exe`.

```
Algoritma: Plaintext → XOR(key) → Hex encode → Storage
Storage → Hex decode → XOR(key) → Plaintext

Kunci: "TMBillingSecretKey2026SecureObfuscation"
```

Yang di-obfuscate:
| Data | Lokasi |
|------|--------|
| `ApiKey` | Registry `HKLM\Software\TMBilling` |
| `EmergencyUser` | Registry `HKLM\Software\TMBilling` |
| `EmergencyToken` | Registry `HKLM\Software\TMBilling` |
| `ApiKey` | `C:\TMBILLING\config.ini` |
| `EmergencyUser` | `C:\TMBILLING\config.ini` |
| `EmergencyToken` | `C:\TMBILLING\config.ini` |

Setiap 5 detik, watchdog **auto-scramble** jika ada konfigurasi plain-text baru.

### 2. SHA256 Integrity Verification

Setiap binary punya hash SHA256 yang disimpan di Registry:

| Registry Key | Binary |
|--------------|--------|
| `Hash_MGCTM` | MGCTM.exe |
| `Hash_TMBilling` | TMBilling.exe |
| `Hash_TMMonitor` | TMMonitor.exe |
| `Hash_mtm` | mtm.exe |
| `Hash_Uninstaller` | TMBilling_Uninstaller.exe |

Hash diverifikasi saat startup (release build). Jika file diubah/modifikasi → **exit immediately**.

### 3. File Lock

```rust
OpenOptions::new()
    .read(true)
    .share_mode(0x00000001) // FILE_SHARE_READ only
    .open(&exe_path)
```

Semua binary membuka handle ke dirinya sendiri dengan akses eksklusif — mencegah rename/hapus saat running.

### 4. Process Name Verification

Setiap binary release memverifikasi nama prosesnya sendiri:

```rust
if exe_name != "MGCTM.exe" { exit(1); }
```

Cegah rename attack.

### 5. API Key Rotation

Admin kasir bisa mengubah API Key kapan saja dari dashboard → Settings:

```
PUT /api/settings/apikey
→ Update .env file
→ Update Flask config in-memory
→ Agent sync otomatis setiap 5 detik
→ Tanpa restart server!
```

### 6. Client Authentication

| Metode | Mekanisme | Auth Paths |
|--------|-----------|-----------|
| **Kasir Dashboard** | Flask session cookie + `login_required` decorator | Online only |
| **Client → Server** | `X-Client-Key` header + IP & MAC binding | Online only |
| **Admin (dari client)** | Dua jalur: **(1)** Cek Emergency User + Emergency Token lokal dulu (offline), **(2)** jika bukan emergency → `POST /client/admin-login` ke Flask API | **Offline**: Emergency bypass dari Registry / **Online**: API ke server |
| **Uninstaller** | Dua jalur: **(1)** `Uninstall Token` dari `GET /api/settings/uninstall-token/client` (online), **(2)** `Emergency Token` dari Registry via Hex-XOR deobfuscate (offline fallback) | **Online**: fetch token via API / **Offline**: deobfuscate EmergencyToken |
| **Emergency Default** | `TMBilling` / `TM123qaz!@#` (diatur saat instalasi oleh `install.bat`, bisa diubah via Dashboard atau ulang instalasi) | - |

---

## 🛡️ Agent & Guardian System

### Component Matrix

| Agent | Process | Location | Role |
|-------|---------|----------|------|
| **MGCTM** | `MGCTM.exe` | `C:\TMBILLING\` | Master guardian — spawn & monitor semua komponen |
| **TMMonitor** | `TMMonitor.exe` | `C:\TMBILLING\` | Telemetry helper — kirim hardware data tiap 60s |
| **TMBilling** | `TMBilling.exe` | `C:\TMBILLING\` | Tauri lockscreen — main UI |
| **mtm** | `mtm.exe` | `%APPDATA%\Microsoft\Protect\` | Anti-kill scout — revive MGCTM |
| **Uninstaller** | `TMBilling_Uninstaller.exe` | `C:\TMBILLING\` | Uninstall with offline fallback |

### MGCTM — Master Guardian Loop

```rust
loop {
    // 1. Cek apakah uninstaller minta shutdown
    if check_stop_token() { break; }

    // 2. Sync token dari server (untuk uninstall)
    sync_uninstall_token();

    // 3. Spawn TMBilling.exe jika mati
    if !is_process_running("TMBilling.exe") { spawn("TMBilling.exe"); }

    // 4. Spawn TMMonitor.exe jika mati
    if !is_process_running("TMMonitor.exe") { spawn("TMMonitor.exe"); }

    // 5. Spawn mtm.exe dari AppData jika mati
    if !is_process_running("mtm.exe") { spawn_from_appdata("mtm.exe"); }

    // 6. Sinkron & obfuscate Registry
    load_config();  // auto-obfuscate jika ada plain-text

    // 7. Loop 5 detik
    sleep(5);
}
```

### mtm — Anti-Kill Scout

```rust
loop {
    // Cek stop.token (shutdown legal)
    if check_legal_shutdown() { break; }

    // Cek MGCTM via WinAPI (CreateToolhelp32Snapshot)
    if !is_process_running("MGCTM.exe") {
        spawn("C:\\TMBILLING\\MGCTM.exe");
    }

    sleep(5);
}
```

> [!WARNING]
> mtm.exe berjalan dari `%APPDATA%\Microsoft\Protect\` — lokasi siluman yang jarang diperiksa admin. Ini adalah **last resort** untuk memastikan sistem tetap berjalan.

### Uninstaller Flow

👉 *[Lihat Diagram Lengkap di sini](docs/DIAGRAMS.md)*

---

## 📊 Database Schema

### Entity Relationship

👉 *[Lihat Diagram Lengkap di sini](docs/DIAGRAMS.md)*

### Key Tables

**`pc`** — Unit komputer
| Field | Type | Description |
|-------|------|-------------|
| `id` | PK | Auto increment |
| `kode` | String (unique) | Nama PC, e.g. PC-01 |
| `ip_address` | String | IP binding |
| `mac_address` | String | MAC binding (auto-register) |
| `grup_id` | FK → grup | Zona PC |
| `is_admin_mode` | Bool | Status admin mode |
| `last_activity` | DateTime | Last polling timestamp |

**`sesi`** — Session bermain
| Field | Type | Description |
|-------|------|-------------|
| `id` | PK | Auto increment |
| `tipe` | Enum | `guest`, `member`, `admin` |
| `pc_id` | FK → pc | PC yang digunakan |
| `member_id` | FK → member (nullable) | Member (if tipe=member) |
| `durasi_beli_menit` | Int | Durasi awal (guest) |
| `waktu_mulai_sesi` | DateTime | Session start time |
| `status` | Enum | `aktif`, `selesai` |
| `is_admin` | Bool | Admin flag |
| `is_blackout_suspect` | Bool | Blackout suspect flag |
| `is_blackout_resolved` | Bool | Blackout resolved flag |

**`transaksi`** — Catatan keuangan
| Field | Type | Description |
|-------|------|-------------|
| `id` | PK | Auto increment |
| `no_nota` | String (unique) | Format: `TM-YYYYMMDD-NNN` |
| `jenis` | Enum | `beli_paket_guest`, `tambah_waktu_guest`, etc. |
| `jumlah` | Integer | Harga |
| `menit` | Integer | Durasi |
| `sesi_id` | FK → sesi | Session reference |
| `member_id` | FK → member | Member reference |
| `user_id` | FK → user | Kasir reference |

---

## 🌐 API Endpoints

Seluruh endpoint API pada server Flask dikelompokkan berdasarkan otorisasi dan fungsionalitasnya dengan versi rute `/api/v1/`.

### 1. Kasir Auth (Prefix: `/api/v1/kasir/auth`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/login` | None | Login kasir/admin web, membuat session |
| POST | `/logout` | Session | Logout kasir/admin web, menghapus session |
| GET | `/check` | None | Cek status session aktif kasir/admin |
| POST | `/admin-check` | None | Validasi password admin untuk bypass Kiosk client |

### 2. Dashboard Kasir (Prefix: `/api/v1/kasir/dashboard`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/pc` | Session | Ambil list semua PC, grup, status, dan detail sesi aktif |
| GET | `/analytics` | Admin | Ambil agregasi data KPI Owner (7 matriks) |

### 3. Sesi Bermain (Prefix: `/api/v1/kasir/sesi`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/buka-guest` | Session | Buka sesi guest (membutuhkan pc_kode & paket_id) |
| POST | `/buka-member` | Session | Buka sesi member (membutuhkan pc_kode & username member) |
| POST | `/tambah-waktu-sesi/{id}` | Session | Tambah durasi sesi aktif |
| POST | `/pindah-pc/{id}` | Session | Pindah PC bermain dalam grup/zona yang sama |
| POST | `/tutup/{id}` | Session | Tutup sesi bermain secara paksa/normal |
| GET | `/{id}` | Session | Dapatkan rincian detail sesi bermain tertentu |

### 4. Master Data (PC, Member, Paket, Grup)
| Blueprint | Method | Prefix Endpoint | Auth | Deskripsi |
|---|---|---|---|---|
| **PC** | GET/POST | `/api/v1/kasir/pc/` | Session | List / tambah PC unit |
| | PUT/DELETE | `/api/v1/kasir/pc/{id}` | Session | Edit / hapus PC unit |
| | POST | `/api/v1/kasir/pc/batch` | Session | Registrasi PC massal otomatis |
| | POST | `/api/v1/kasir/pc/reset-admin/{id}`| Session | Reset paksa flag `is_admin_mode` |
| | PUT | `/api/v1/kasir/pc/{id}/position` | Session | Perbarui posisi koordinat PC di floor plan |
| | POST | `/api/v1/kasir/pc/wol` | Session | Kirim perintah Wake-on-LAN ke PC client |
| **Member** | GET/POST | `/api/v1/kasir/member/` | Session | List / tambah member prepaid |
| | GET/PUT/DEL | `/api/v1/kasir/member/{id}` | Session | Detail / update / hapus member |
| | POST | `/api/v1/kasir/member/tambah-waktu`| Session | Top-up saldo menit bermain member |
| | GET | `/api/v1/kasir/member/{id}/paket` | Session | Riwayat pembelian paket billing member |
| | POST | `/api/v1/kasir/member/refund-paket` | Session | Refund transaksi paket billing member |
| **Paket** | GET/POST | `/api/v1/kasir/paket/` | Session | List / buat paket billing baru |
| | PUT/DELETE | `/api/v1/kasir/paket/{id}` | Session | Edit / hapus paket billing |
| **Grup** | GET/POST | `/api/v1/kasir/grup/` | Session | List / tambah grup zona baru |
| | DELETE | `/api/v1/kasir/grup/{id}` | Session | Hapus grup zona |

### 5. Laporan & Sistem Log (Prefix: `/api/v1/kasir/report`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/laporan/billing` | Session | Mengambil data laporan pendapatan billing per rentang tanggal |
| GET | `/laporan/kantin` | Session | Mengambil data laporan penjualan F&B kantin |
| GET | `/laporan-harian` | Session | Summary ringkas pendapatan shift hari ini |
| GET | `/tanggal` | Session | Daftar tanggal transaksi unik di DB |
| GET | `/kasir-list` | Session | Daftar staff/kasir yang terdaftar untuk filter laporan |
| GET | `/struk/{id_atau_nota}` | Session | Data detail struk cetak berdasarkan ID/nomor nota |
| POST | `/struk/by-no` | Session | Cari data struk berdasarkan nomor nota |
| GET | `/struk/menu/{t_menu_id}` | Session | Data detail struk untuk transaksi POS F&B |
| GET | `/log` | Session | Membaca riwayat system log warnet |
| POST | `/log/clear` | Admin | Hapus semua log system |
| POST | `/transaksi/clear` | Admin | Purge/hapus total semua data transaksi (berbahaya) |
| DELETE | `/transaksi/{id}` | Admin | Hapus satu data transaksi tertentu |
| DELETE | `/transaksi/by-date/{tgl}` | Admin | Hapus semua transaksi pada tanggal tertentu |
| GET | `/log/export` | Session | Ekspor logs sistem ke berkas text (.txt) |
| GET | `/blackout-log` | Session | Membaca log audit sistem pemulihan blackout |
| GET | `/export/billing` | Session | Ekspor laporan billing kasir ke Excel/CSV |
| GET | `/export/kantin` | Session | Ekspor laporan kantin ke Excel/CSV |
| GET | `/export/pnl` | Session | Ekspor laporan Profit & Loss (P&L) ke Excel/CSV |
| GET | `/export/audit-pdf` | Session | Ekspor PDF ringkasan audit lengkap (laporan pertanggungjawaban) |

### 6. Blackout Recovery (Prefix: `/api/v1/kasir/blackout`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/deteksi` | Session | Jalankan proses deteksi otomatis PC terputus akibat mati lampu |
| GET | `/list` | Session | Ambil daftar sesi yang dicurigai suspect blackout |
| GET | `/dates` | Session | Ambil daftar tanggal terjadinya pemadaman listrik di log |
| POST | `/resolve/member/{id}` | Session | Selesaikan blackout: Refund saldo menit member |
| POST | `/resolve/guest/sama/{id}` | Session | Selesaikan blackout: Guest lanjut bermain di PC yang sama |
| POST | `/resolve/guest/lanjut/{id}` | Session | Selesaikan blackout: Guest dipindahkan ke PC lain yang kosong |
| POST | `/resolve/guest/tutup/{id}` | Session | Selesaikan blackout: Tutup sesi guest dan bayar seadanya |
| POST | `/force-all-and-detect`| Session | Tutup paksa seluruh sesi aktif dan langsung picu deteksi blackout |
| POST | `/clear` | Session | Bersihkan database riwayat penanganan blackout |

### 7. Pengaturan & Whitelist (Prefix: `/api/v1/kasir/settings`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | Session | Ambil seluruh daftar konfigurasi sistem yang tersimpan |
| PUT | `/auto-shutdown` | Session | Ubah batas waktu mati otomatis PC kosong setelah logout |
| PUT | `/{key}` | Session | Perbarui konfigurasi generic key-value |
| PUT | `/apikey` | Admin | Regenerasi/rotasi `CLIENT_API_KEY` global secara dinamis |
| PUT | `/timezone` | Session | Ubah default zona waktu warnet (WIB/WITA/WIT) |
| POST | `/backup/manual` | Admin | Pemicu manual backup database SQLite dan upload cloud |
| GET | `/backup/download` | Admin | Unduh file database SQLite yang aktif secara langsung |
| POST | `/qris` | Session | Unggah gambar kode QRIS baru untuk pembayaran di Kiosk |
| PUT | `/scheduler` | Admin | Atur ulang interval Background Scheduler |
| POST | `/scheduler/restart` | Admin | Restart Background Scheduler (APScheduler) |
| GET | `/uninstall-token/client`| API Key | Sinkronisasi rilis `uninstall_token` & `emergency_token` klien |
| GET | `/ip-whitelist` | Session | List IP address yang masuk daftar putih akses dashboard |
| POST | `/ip-whitelist` | Session | Daftarkan IP address baru ke whitelist |
| DELETE | `/ip-whitelist/{ip}` | Session | Hapus IP address dari whitelist |
| POST | `/ip-whitelist/toggle` | Session | Aktifkan/matikan fitur proteksi IP Whitelist |
| POST | `/ip-whitelist/regenerate-token`| Session| Regenerasi Token Bypass Whitelist Darurat baru |
| GET | `/ip-whitelist/status` | Session | Cek status whitelist dan dapatkan URL bypass lengkap |
| POST | `/app-public-url` | Session | Simpan url tunnel publik aplikasi (Cloudflare/Ngrok) |

### 8. DB Migration & Update (Prefix: `/api/v1/kasir/settings/migration`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/status` | Admin | Cek status upgrade database (HEAD vs Current revision) |
| POST | `/upload` | Admin | Unggah ZIP rilis update + auto-extract + auto-migrate + auto-restart |

### 9. Plugin Manager (Prefix: `/api/v1/kasir/settings/plugins`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/page` | Session | Render halaman UI utama Plugin Manager |
| GET | `/` | Session | Ambil list plugin terdeteksi beserta status aktifnya |
| POST | `/toggle` | Session | Aktifkan (enable) atau matikan (disable) modul plugin |
| POST | `/upload` | Session | Unggah berkas ZIP plugin baru untuk diekstrak otomatis |

### 10. Kantin POS / F&B Menu (Prefix: `/api/v1/kasir/menu`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | Session | Ambil katalog seluruh makanan & minuman yang aktif |
| POST | `/` | Session | Tambah menu baru beserta unggah gambar menu |
| PUT | `/{menu_id}` | Session | Edit detail data menu / stok / ganti gambar |
| DELETE | `/{menu_id}` | Session | Soft-delete item menu (diarsipkan dari kasir) |
| DELETE | `/{menu_id}/permanent`| Session | Hapus permanen menu beserta seluruh riwayat penjualan terkait |
| POST | `/checkout` | Session | Proses transaksi belanja makanan/minuman kasir |
| GET | `/transaksi` | Session | Ambil riwayat semua transaksi F&B kantin |

### 11. Shift Handover Kasir (Prefix: `/api/v1/kasir/shift`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/start` | Session | Mulai shift kerja kasir baru dengan memasukkan modal awal |
| GET | `/active` | Session | Cek data dan status keaktifan shift kasir saat ini |
| GET | `/summary` | Session | Ringkasan detail pendapatan real-time shift aktif (untuk preview) |
| POST | `/end` | Session | Tutup shift aktif dengan Blind Count (hitung buta) uang fisik |
| GET | `/history` | Session | Riwayat penutupan shift kasir sebelumnya |

### 12. Turnamen Bracket Maker (Prefix: `/api/v1/kasir/tournament`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | Session | Ambil seluruh daftar turnamen warnet |
| GET | `/{id}` | Session | Rincian bagan bracket, match, dan klasemen Swiss turnamen |
| POST | `/` | Session | Buat turnamen baru dan inisialisasi tim & babak pertama |
| POST | `/match/{match_id}/skor`| Session| Update skor tanding & loloskan pemenang tanding secara otomatis |
| POST | `/{id}/swiss/next` | Session | Buat ronde Swiss stage baru dan generate pairing tanding |
| POST | `/stage/{stage_id}/finish`| Session| Selesaikan tahapan saat ini (Swiss/Playoffs) dan loloskan tim |
| DELETE | `/{id}` | Session | Hapus turnamen beserta datanya secara permanen |

### 13. Public Client Auth (Prefix: `/api/v1/public/auth`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/login` | API Key | Login prepaid member warnet dari PC client |
| POST | `/logout` | API Key | Logout prepaid member warnet dari PC client |
| POST | `/status` | API Key | Polling status sesi member tauri di client |

### 14. Public Client PC (Prefix: `/api/v1/public/client`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/identify` | API Key | Mengidentifikasi unit PC klien saat booting berdasarkan IP & MAC |
| POST | `/status` | API Key | Polling status kiosk PC klien (setiap 5 detik) |
| POST | `/selesai` | API Key | Kirim signal bahwa user mengakhiri sesi (logout) dari client |
| POST | `/admin-login` | API Key | Login admin online dari PC client |
| POST | `/emergency-login`| API Key | Login bypass darurat dari PC client |
| GET | `/warnet` | API Key | Ambil data setup Kiosk (Judul, Aturan, QRIS, & Paket) |

### 15. Public Hardware Monitor (Prefix: `/api/v1/public/monitor`)
| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/all` | Session | Ambil status telemetry & spesifikasi hardware seluruh PC |
| POST | `/` | API Key | Menerima pengunggahan telemetry hardware dari Rust agent |
| GET | `/processes/{pc_id}` | Session | Ambil daftar proses yang sedang berjalan di PC (memori >= 10MB) |
| POST | `/processes/{pc_id}/kill`| Session| Kirim perintah akhiri proses (taskkill) jarak jauh ke PC client |
| POST | `/remote/{pc_id}/{action}`| Session| Kirim perintah remote restart atau shutdown ke PC client |
| POST | `/screenshot/trigger/{pc_id}`| Session| Kirim perintah tangkap screenshot layar ke PC client |
| POST | `/screenshot/upload` | API Key | Menerima pengunggahan file biner screenshot dari PC client |
| GET | `/screenshot/status/{pc_id}`| Session | Dapatkan timestamp & url berkas screenshot PC client terakhir |
| DELETE | `/{hardware_id}` | Session | Bersihkan paksa data monitor hardware PC |

*(Untuk melihat payload request dan response secara mendetail, kunjungi [TECHNICAL_DOCS.md](docs/TECHNICAL_DOCS.md))*

---

## 🎨 Frontend Dashboard

### Design System — Pristine Dark

| Token | Tailwind Class | Hex Value |
|-------|---------------|-----------|
| Background | `bg-slate-950` | `#020617` |
| Card | `bg-slate-900 border-slate-800` | `#0f172a` |
| Input | `bg-slate-800 border-slate-700` | `#1e293b` |
| Primary | `indigo-600` | `#4f46e5` |
| Success | `emerald-600` | `#059669` |
| Danger | `red-600` | `#dc2626` |
| Font UI | Inter (sans-serif) | - |
| Font Mono | JetBrains Mono | - |

### Module Structure

```javascript
app/static/js/kasir/
├── core/
│   ├── api.js        // Fetch wrapper + CSRF + credentials
│   ├── utils.js      // formatRupiah(), formatMenit(), escapeHtml()
│   ├── toast.js      // Toast notification
│   └── modal.js      // Dynamic modal + confirm dialog
├── components/
│   ├── modal-buka.js   // "Buka Sesi" dialog
│   └── modal-tambah.js // "Tambah Waktu" dialog
└── modules/
    ├── dashboard.js  // PC Grid + real-time refresh
    ├── member.js     // Member CRUD
    ├── paket.js      // Paket CRUD
    ├── pc.js         // PC CRUD + batch
    ├── grup.js       // Grup CRUD
    ├── laporan.js    // Reports
    ├── log.js        // System logs
    ├── struk.js      // Receipts + print
    ├── monitor.js    // Hardware monitoring
    ├── blackout.js   // Blackout recovery
    ├── user.js       // Staff management
    ├── settings.js   // App settings
    └── migration.js  // DB Migration & Update System
```

---

## 🛠️ Developer Guide

### Prerequisites for Development

| Tool | Minimum Version | Download |
|------|----------------|----------|
| Python | 3.8+ | [python.org](https://python.org) |
| Rust | 1.75+ | [rustup.rs](https://rustup.rs) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

### Backend Development

```bash
# Setup
cd TMBilling
python -m venv .venv
.venv\Scripts\activate   # or source .venv/bin/activate
pip install -r requirements.txt

# Config
copy .env.example .env  # Edit CLIENT_API_KEY
python seed.py

# Run dev mode (set DEBUG_MODE=True in .env)
python run.py
```

### Frontend Styling Development (Tailwind CSS)

TMBilling menggunakan **Tailwind CSS lokal** (via npm CLI) untuk mengkompilasi CSS UI Kasir, bukan melalui CDN. Hal ini mempercepat waktu muat dan mendukung offline mode.

Jika Anda memodifikasi file template `.html` atau file `.js` yang membutuhkan kelas Tailwind baru, kompilasi ulang CSS-nya:

```bash
# Instal dependensi dev (tailwindcss)
npm install

# Build CSS mode development (Watch Mode)
npm run dev:css

# Build CSS mode production (Minified)
npm run build:css
```

**Alur Kerja Production (Deployment):**
Jika Anda telah selesai mengedit file HTML/JS dan siap untuk melakukan rilis ke server produksi, ikuti alur ini agar CSS terbaru ikut terbawa secara optimal:
1. Pastikan Anda sudah menjalankan `npm run build:css` di komputer lokal Anda. Ini akan mengkompres file `app/static/css/tailwind.css` menjadi sekecil mungkin.
2. Lakukan Git Commit untuk menyimpan perubahan HTML, JS, dan file `tailwind.css` hasil kompilasi.
3. Lakukan Git Push ke remote repository (GitHub).
4. Di Server Production (Warnet), Anda cukup melakukan `git pull`. Anda **TIDAK PERLU** menjalankan `npm install` atau mem-build ulang CSS di server production. Server cukup menggunakan file `tailwind.css` yang sudah "matang" dari git.

### Tauri Client Development

```bash
cd WarnetClient/TMBillingTauri

# Install JS dependencies
npm install

# Set Server URL (edit config.ini)
# src-tauri/config.ini
# [TMBilling]
# url=http://192.168.1.100:7015
# apikey=TM2026QWERTY-api-key

# Run in dev mode (with hot reload)
npm run tauri dev

# Build for production
npm run tauri build  # -> src-tauri/target/release/TMBilling.exe
```

### Kompilasi Agen & Client (Unified Build & Deploy)

Untuk mempermudah dan mengompilasi seluruh agen sekaligus serta menyalinnya ke folder Deploy, gunakan script batch yang telah disediakan:

```bash
# Jalankan dari root folder
build_and_deploy.bat
```

Atau kompilasi secara manual per proyek:

```bash
# MGCTM — Master Guardian
cd WarnetAgent/MGCTM
cargo build --release
# -> target/release/MGCTM.exe

# mtm — Anti-kill scout
cd WarnetAgent/mtm
cargo build --release
# -> target/release/mtm.exe

# TMMonitor — Telemetry
cd WarnetAgent/TMBilling_Monitor
cargo build --release
# -> target/release/TMMonitor.exe

# Uninstaller
cd WarnetAgent/TMBilling_Uninstaller
cargo build --release
# -> target/release/TMBilling_Uninstaller.exe
```


### Compiling C# Telemetry Helper

```bash
cd WarnetAgent/TMBilling_Monitor
# Using .NET Framework 4.8 compiler
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /out:HardwareHelper.exe /reference:LibreHardwareMonitorLib.dll HardwareHelper.cs
```

### Adding New Feature — Workflow

```
1. MODEL     → app/models/               → definisi tabel
2. REPO      → app/repositories/         → query CRUD
3. SERVICE   → app/services/             → business logic
4. ROUTES    → app/routes/               → endpoint API
5. BLUEPRINT → app/__init__.py           → register blueprint
6. FRONTEND  → app/static/js/kasir/      → module JS
```

### Database Migrations

```bash
flask db migrate -m "deskripsi perubahan"
flask db upgrade       # Apply
flask db downgrade     # Rollback (1 step)
```

Atau untuk development: cukup restart server — `db.create_all()` otomatis bikin tabel baru.

### Scheduler Tasks (run.py)

| Task | Interval | Description |
|------|----------|-------------|
| `cleanup_expired` | 1 menit | Tutup sesi yang waktu habis |
| `database_backup` | 60 menit | Kompresi database SQLite ke ZIP, simpan lokal di `backups/`, dan upload otomatis ke cloud provider aktif (Discord, WebDAV, GDrive, NAS) dengan cleanup FIFO (maksimal 5 berkas terbaru) |

---

## 📚 Dokumentasi Lengkap

| File | Isi |
|------|-----|
| [docs/CODEBASE_DOCUMENTATION.md](docs/CODEBASE_DOCUMENTATION.md) | 📘 Ringkasan semua komponen (start here!) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 🏗️ Arsitektur 3-layer, data flow diagrams |
| [docs/BACKEND_GUIDE.md](docs/BACKEND_GUIDE.md) | 🐍 Panduan backend, coding patterns, error handling |
| [docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md) | 🎨 JS modular, design tokens, UI components |
| [docs/TECHNICAL_DOCS.md](docs/TECHNICAL_DOCS.md) | 🌐 API endpoint reference (lengkap req/res) |
| [docs/walkthrough.md](docs/walkthrough.md) | 🛡️ Walkthrough Hex-XOR, watchdog, offline uninstall |
| [docs/CLOUD_BACKUP_DESIGN.md](docs/CLOUD_BACKUP_DESIGN.md) | ☁️ Rencana Desain: Sistem Backup Multi-Provider TMBilling |
| [docs/NEW_FEATURES_GUIDE.md](docs/NEW_FEATURES_GUIDE.md) | 🚀 Panduan fitur baru (Tauri Single-Instance, Portal Member, Turnamen, Shift, & DB Migration Manager) |
| [docs/UPGRADE_RUPIAH_AND_POS.md](docs/UPGRADE_RUPIAH_AND_POS.md) | 🪙 Pembaruan format Rupiah, layout mobile & POS F&B |
| [docs/agent.md](docs/agent.md) | 📋 Agent task tracker |

---

## 🐛 Troubleshooting

### Database Error — Table Not Found
```bash
python seed.py  # Re-init database
```

### Client Cannot Connect to Server
- Verifikasi IP Server di `C:\TMBILLING\config.ini`
- Cek firewall — port 7015 harus terbuka
- Cek API Key — harus sama dengan `.env` server
- Restart MGCTM.exe (atau restart PC)

### Registry Error — Access Denied
- Pastikan process running as **Administrator**
- Untuk install/uninstall — **Run as Administrator**

### Watchdog Not Running
```powershell
# Cek process
tasklist /FI "IMAGENAME eq MGCTM.exe"
tasklist /FI "IMAGENAME eq mtm.exe"

# Force restart
taskkill /F /IM MGCTM.exe /IM mtm.exe
C:\TMBILLING\MGCTM.exe
```

### "Force Locked" — Client Terus Lock
- Kasir belum buka sesi — polling dapet `status: "kosong"`
- Admin mode expired — login ulang via Ctrl+Alt+A
- Server override admin lock — kasir matikan admin mode

### Lupa Uninstall Token atau Server Mati?
Gunakan **Emergency Mode Offline**:
1. Buka Dashboard Kasir → **Settings** → catat **Emergency Token** yg tertera
2. Atau jika PC masih terhubung, token sudah tersimpan di Registry (di-sync oleh MGCTM)
3. Jalankan `TMBilling_Uninstaller.exe` → masukkan **Emergency Token** tersebut
4. Uninstaller akan cocokkan secara offline — tanpa perlu koneksi server!

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<p align="center">
  <sub>Free code signing provided by <a href="https://signpath.org">
  <sub>TMBilling v1.1.1</sub>
</p>

<p align="center">
  <img src="../tm.png" alt="TMBilling" width="360" />
</p>

# Master Dokumentasi Teknis & Operasional TMBilling (Single Source of Truth)

> **Versi Rilis:** v1.6.5-rc3  
> **Branch:** `v1.6.5-rc3` ("Autonomous Offline Studio")  
> **Status:** Single Source of Truth Resmi Repositori TMBilling  
> **Target Audiens:** Pengembang Backend/Frontend, Pengembang Rust/Tauri, Operator/Kasir, dan Administrator Sistem Warnet & Game Center.

---

## 📑 DAFTAR ISI (Table of Contents)

1. [Ikhtisar Sistem & Filosofi Desain](#1-ikhtisar-sistem--filosofi-desain)
2. [Arsitektur Sistem Terpadu (3-Layer SoC)](#2-arsitektur-sistem-terpadu-3-layer-soc)
   - [2.1 Backend Server (Flask + SQLite ORM + REST API)](#21-backend-server)
   - [2.2 Frontend Dashboard (Modular ES6 Vanilla JS + Responsive UI)](#22-frontend-dashboard)
   - [2.3 WarnetAgent Klien (Tauri 1.5 + Rust Core + Kiosk Shell)](#23-warnetagent-klien)
   - [2.4 WebSocket VNC Proxy Relay & Remote Bridge](#24-websocket-vnc-proxy-relay--remote-bridge)
3. [Struktur Direktori & Pemetaan Kode Repositori](#3-struktur-direktori--pemetaan-kode-repositori)
4. [Katalog & Spesifikasi Mendalam Seluruh Fitur (31 Domain Fitur)](#4-katalog--spesifikasi-mendalam-seluruh-fitur-31-domain-fitur)
   - [4.1 Multi-PC Selection & Batch Actions Engine (`remoteBatch`)](#41-multi-pc-selection--batch-actions-engine)
   - [4.2 TightVNC Remote Control System & Bi-directional Clipboard Sync](#42-tightvnc-remote-control-system--bi-directional-clipboard-sync)
   - [4.3 Blackout Auto-Recovery System (Toleransi Mati Lampu & Uptime Tracker)](#43-blackout-auto-recovery-system-toleransi-mati-lampu--uptime-tracker)
   - [4.4 5-Layer WarnetAgent Anti-Tamper Security & Registry Hash Verification](#44-5-layer-warnetagent-anti-tamper-security--registry-hash-verification)
   - [4.5 Hardware Checker, Security Audit & CCTV Smart Reference](#45-hardware-checker-security-audit--cctv-smart-reference)
   - [4.6 Remote Process Monitor & Task Killer](#46-remote-process-monitor--task-killer)
   - [4.7 Screenshot Monitor with Natural Sorting](#47-screenshot-monitor-with-natural-sorting)
   - [4.8 POS Kantin & Billing FnB Multi-Payment (Cash/QRIS/Bank + Struk Thermal)](#48-pos-kantin--billing-fnb-multi-payment)
   - [4.9 Dynamic Tutorials CMS & Custom CKEditor Builder](#49-dynamic-tutorials-cms--custom-ckeditor-builder)
   - [4.10 Cloudflare Tunnel Auto-Service](#410-cloudflare-tunnel-auto-service)
   - [4.11 Centralized Versioning System (`config.py` Truth)](#411-centralized-versioning-system)
   - [4.12 RBAC Kasir & Centralized Audit Log System](#412-rbac-kasir--centralized-audit-log-system)
   - [4.13 Floor Plan & Dynamic Visual Room Layout (v1.6.3 Engine)](#413-floor-plan--dynamic-visual-room-layout-v163-engine)
   - [4.14 Database Maintenance & Cloud/Local Backup UI](#414-database-maintenance--cloudlocal-backup-ui)
   - [4.15 Manajemen Member, Paket & Billing Rates](#415-manajemen-member-paket--billing-rates)
   - [4.16 Shift Kasir & Serah Terima Shift (Hitung Buta / Blind Cash Reconciliation)](#416-shift-kasir--serah-terima-shift-hitung-buta--blind-cash-reconciliation)
   - [4.17 Catatan Kasir & Shift Handover Scratchpad](#417-catatan-kasir--shift-handover-scratchpad)
   - [4.18 Turnamen & Bracket eSports Engine](#418-turnamen--bracket-esports-engine)
   - [4.19 Public TV Billboard & Scoreboard Display](#419-public-tv-billboard--scoreboard-display)
   - [4.20 Owner Analytics & Business Intelligence](#420-owner-analytics--business-intelligence)
   - [4.21 Emergency Mode & Offline Fallback (SHA-256 Auth)](#421-emergency-mode--offline-fallback)
   - [4.22 Audio Warning Intervals & Sound System (15m, 10m, 5m, 1m)](#422-audio-warning-intervals--sound-system)
   - [4.23 Responsive Dual-Layout (1024px vs 1920px & Mobile Touch)](#423-responsive-dual-layout)
   - [4.24 Live Search Debouncing & PC Code Auto-Dash Formatting](#424-live-search-debouncing--pc-code-auto-dash-formatting)
   - [4.25 Integrasi Mikrotik Bandwidth Management (RouterOS Queue API)](#425-integrasi-mikrotik-bandwidth-management)
   - [4.26 Maintenance Ticket & Issue Reporting System](#426-maintenance-ticket--issue-reporting-system)
   - [4.27 Fitur Kunci Meja AFK / Istirahat Sementara (Temporary AFK Screen Lock)](#427-fitur-kunci-meja-afk--istirahat-sementara-temporary-afk-screen-lock)
   - [4.28 Arsitektur Proteksi Triple-Layer Session Expiry & Heartbeat](#428-arsitektur-proteksi-triple-layer-session-expiry--heartbeat)
   - [4.29 Standardized Skeleton Loader Engine v1.6.3 di Seluruh Tab Kasir](#429-standardized-skeleton-loader-engine-v163-di-seluruh-tab-kasir)
   - [4.30 In-Place Reactive Rerender & Zero Page Reload Engine](#430-in-place-reactive-rerender--zero-page-reload-engine)
   - [4.31 Zero-Config Security & Credential Bootstrap Architecture](#431-zero-config-security--credential-bootstrap-architecture)
5. [Panduan Teknis Backend (Flask & Python)](#5-panduan-teknis-backend-flask--python)
   - [5.1 Daftar Blueprint & Routing (34 Blueprint)](#51-daftar-blueprint--routing)
   - [5.2 Service Layer & Pola Arsitektur (36 Service Classes)](#52-service-layer--pola-arsitektur)
   - [5.3 Skema Database & 24 Model SQLAlchemy](#53-skema-database--24-model-sqlalchemy)
6. [Panduan Teknis Frontend (Modular Vanilla JS & CSS)](#6-panduan-teknis-frontend-modular-vanilla-js--css)
   - [6.1 Arsitektur Core JS (`core/`)](#61-arsitektur-core-js)
   - [6.2 Modul-Modul Fitur Kasir (`modules/`)](#62-modul-modul-fitur-kasir)
7. [Panduan Teknis WarnetAgent (Tauri 1.5 Rust Core)](#7-panduan-teknis-warnetagent-tauri-15-rust-core)
   - [7.1 TMBillingTauri (Client Lock & Overlay)](#71-tmbillingtauri)
   - [7.2 MGCTM Watchdog Daemon](#72-mgctm-watchdog-daemon)
   - [7.3 mtm (Auxiliary Watchdog & Resilience Guard)](#73-mtm-auxiliary-watchdog--resilience-guard)
   - [7.4 TMMonitor & HardwareHelper / TMLHMService](#74-tmmonitor--hardwarehelper--tmlhmservice)
   - [7.5 TMBilling_Uninstaller](#75-tmbilling_uninstaller)
   - [7.6 Deploy Scripts & Configuration](#76-deploy-scripts--configuration)
8. [Spesifikasi Protokol API & VNC Bridge](#8-spesifikasi-protokol-api--vnc-bridge)
9. [Panduan Operasional Kasir & Troubleshooting](#9-panduan-operasional-kasir--troubleshooting)
10. [Panduan Kontribusi, Testing & SOP Dual-Engine (248 Test Files / 681 Test)](#10-panduan-kontribusi-testing--sop-dual-engine)

---

## 1. Ikhtisar Sistem & Filosofi Desain

**TMBilling** adalah sistem otomasi operasional, billing, manajemen transaksi FnB/Kantin, monitoring hardware, proteksi keamanan anti-tamper, dan kendali jarak jauh (remote control) terintegrasi untuk warnet modern, esports arena, dan game center berstandar enterprise.

### Filosofi Desain Utama:
1. **Resilience First (Zero Session Loss)**: Sesi billing pelanggan tidak boleh hilang akibat mati lampu (*blackout*), PC hang/crash, atau server restart. Sistem mampu melanjutkan sisa waktu secara otomatis.
2. **Ironclad Anti-Tamper**: Klien warnet diproteksi berlapis (Tauri 1.5 Rust + Win32 API hooks + Dual-Hive Registry SHA-256 Hashes + Watchdog Daemon terpisah) agar tidak bisa di-bypass oleh software cheat, Task Manager, ataupun penggantian file binary.
3. **Triple-Layer Session Protection**: Penutupan dan pemotongan sesi billing kadaluwarsa dilindungi secara berlapis: Layer 1 (Background Scheduler 60s), Layer 2 (Client Polling 1-3s), dan Layer 3 (Kasir Dashboard Polling 1, 2, 3, 5s).
4. **Remote Operation & Cloud Access**: Owner atau operator dapat mengawasi, mengontrol, dan memantau billing secara aman melalui Cloudflare Tunnel & TightVNC Remote tanpa memerlukan IP publik statis.
5. **Clean SoC & Zero-Slop Architecture**: Backend Flask terstruktur dengan *Clean Architecture* (Routes -> Services -> Repositories -> Models), Frontend menggunakan Vanilla JS modular tanpa framework berat, dan Klien Kiosk menggunakan Rust + Webview2 yang sangat hemat memori.

---

## 2. Arsitektur Sistem Terpadu (3-Layer SoC)

Sistem TMBilling dirancang dengan arsitektur pemisahan tanggung jawab 3 lapis (*3-Layer Separation of Concerns*):
- **Layer 1: Frontend (Browser / Kasir Dashboard)**: Web UI berbasis ES6 Modular Vanilla JS, standardized skeleton loader (core/skeleton.js), VNC web client berbasis canvas RFB, dan Process Monitor.
- **Layer 2: Backend (Server Billing Flask)**: REST API engine dengan 34 Blueprint / 36 Service, background daemon APScheduler, VNC bridge via proses Websockify (port 8081), database SQLite dengan 24 Model SQLAlchemy, serta integrasi zero-trust Cloudflare Ingress.
- **Layer 3: WarnetAgent Client (PC Klien)**: Aplikasi klien Tauri 1.5 (Rust + HTML5/CSS) dengan low-level Win32 hooks dan TightVNC loopback port 5900, diawasi oleh Watchdog Service C++ (MGCTM.exe), validasi registry hash SHA-256, dan telemetri hardware LibreHardwareMonitor (TMMonitor.exe + HardwareHelper.exe).

### 2.1 Backend Server
- **Framework**: Python 3.11+ dengan Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-CORS, Flask-WTF.
- **Telemetry & VNC**: Telemetri dan screenshot memakai HTTP polling; kanal WebSocket hanya dipakai VNC melalui proses Websockify (`ws://<host>:8081/?token=...`, atau `wss://<host>/ws/vnc?token=...` di balik HTTPS).
- **Service Layer**: Pemisahan logika bisnis dari endpoint HTTP menggunakan 36 service class independen dan 15 repository class.
- **Background Scheduler**: APScheduler menjalankan routine maintenance, deteksi blackout, dan pembersihan sesi kadaluwarsa setiap 60 detik.

### 2.2 Frontend Dashboard
- **Teknologi**: Modular ES6 JavaScript (tanpa Node.js bundler runtime), TailwindCSS styling, Font Awesome icon set.
- **Arsitektur**: Core API layer (`app/static/js/kasir/core/api.js`), Event Bus, Theme Variables, `core/skeleton.js` standardized loader, dan 28 Modul fitur terisolasi.
- **Responsivitas**: Dual layout adaptif (1024px compact mode s/d 1920px full widescreen) serta dukungan gesture sentuh untuk tablet/smartphone kasir.
- **Zero Page Reload**: In-place reactive rerender (`_hasStructureChanged`) memperbarui denah meja, kartu PC, dan status hardware tanpa refresh browser.

### 2.3 WarnetAgent Klien
- **Teknologi**: Rust + Tauri 1.5 (berbasis Microsoft Webview2).
- **Kiosk Shell**: Mengunci tampilan Windows (Disable `WinKey`, `Ctrl+Alt+Del`, `Alt+Tab`, `Alt+F4`, `Ctrl+Shift+Esc`), menutup akses taskbar dan desktop sebelum sesi dibuka.
- **Overlay State**: Menampilkan floating bar widget (sisa waktu, tarif, billing FnB, QRIS payment, tombol ganti password, report tiket).

### 2.4 WebSocket VNC Proxy Relay & Remote Bridge
- Menjembatani canvas web kasir dengan TightVNC Server yang berjalan di port `5900` PC klien.
- Meneruskan frame RFB (Remote FrameBuffer), event mouse/keyboard, dan pertukaran teks clipboard secara dua arah.

---

## 3. Struktur Direktori & Pemetaan Kode Repositori

```text
c:\Project GIT\TMBilling
├── app/                                # Backend Server Flask & Frontend Kasir
│   ├── config.py                       # Single Source of Version Truth (VERSION = "1.6.5-rc3")
│   ├── models/                         # 24 Model Database SQLAlchemy
│   │   ├── game/                       # Game & GameKategori
│   │   ├── grup/                       # Grup Ruangan / Tarif (Reguler/VIP)
│   │   ├── hardware/                   # HardwareMonitor & PCProcess
│   │   ├── maintenance/                # MaintenanceTicket
│   │   ├── member/                     # Member accounts & prepaid balances
│   │   ├── menu/                       # MenuItem & TransaksiMenu (POS Kantin)
│   │   ├── mikrotik/                   # MikroTikConfig
│   │   ├── paket/                      # Paket billing (Jam, Malam, Personal)
│   │   ├── pc/                         # PC registry & PCUptimeLog
│   │   ├── sesi/                       # Sesi billing aktif & selesai
│   │   ├── settings/                   # Global settings & cloud configs
│   │   ├── shift/                      # ShiftRecord & modal kas
│   │   ├── tournament/                 # Turnamen, Tim, Tahap, Match
│   │   ├── transaksi/                  # Transaksi pembayaran billing
│   │   ├── tutorial/                   # SystemTutorial (CMS Articles)
│   │   └── user/                       # User & Role RBAC
│   ├── routes/                         # 34 Blueprint HTTP REST + VNC Bridge
│   │   ├── auth/                       # Login/Logout kasir & admin
│   │   ├── backup/                     # Database local & cloud backup
│   │   ├── blackout/                   # Toleransi & recovery mati lampu
│   │   ├── client/                     # Handshake & telemetry client agent
│   │   ├── dashboard/                  # Dashboard summary & stats
│   │   ├── game/                       # Game launcher & icon cropper
│   │   ├── grup/                       # Grup ruangan & tarif per menit
│   │   ├── hardware/                   # Uptime logs & baseline discrepancy
│   │   ├── maintenance/                # Ticket reporting & tracking
│   │   ├── member/                     # Member management & deposit
│   │   ├── menu/                       # POS FnB, order, stock logs & thermal struk
│   │   ├── mikrotik/                   # RouterOS API integration
│   │   ├── monitor/                    # PC monitor, batch actions, processes
│   │   ├── notes/                      # Kasir sticky notes & handover
│   │   ├── paket/                      # Paket management
│   │   ├── pc/                         # PC CRUD, floor plan coordinates
│   │   ├── public/                     # Public TV billboard & scoreboard
│   │   ├── report/                     # Laporan harian, billing, kantin, shift
│   │   ├── server_monitor/             # Server health (CPU, RAM, Disk, LHM)
│   │   ├── sesi/                       # Billing sessions lifecycle & batch
│   │   ├── settings/                   # IP whitelist, Cloudflare, DB vacuum
│   │   ├── shift/                      # Kasir shift drawer management
│   │   ├── tournament/                 # Turnamen & bracket engine
│   │   ├── tutorial/                   # CMS Tutorials & editor uploads
│   │   ├── user/                       # RBAC user & audit logs
│   │   └── vnc/                        # Kontrol HTTP proxy VNC (WebSocket via Websockify)
│   ├── services/                       # 36 Service Layer Business Logic
│   ├── repositories/                   # 15 Data Access Layer & DB Query Helpers
│   ├── utils/                          # 8 Utility Helpers (Formatters, Security, Response)
│   ├── static/                         # Static Assets
│   │   ├── css/                        # TailwindCSS build & custom styling
│   │   ├── js/kasir/                   # Modular ES6 JavaScript Frontend
│   │   │   ├── app.js                  # Main Application Entrypoint
│   │   │   ├── core/                   # api.js, modal.js, toast.js, utils.js, skeleton.js
│   │   │   ├── components/             # Modal buka sesi, tambah durasi, dll.
│   │   │   └── modules/                # 28 Modul fitur + dashboard
│   │   └── sounds/                     # Audio warning bells (15m, 10m, 5m, 1m)
│   └── templates/                      # Jinja2 HTML Templates
│       ├── kasir/                      # Dashboard Kasir & Modals (31 tab views)
│       ├── member/                     # Member Portal Kiosk
│       └── tv/                         # Public Billboard & Scoreboard
├── docs/                               # Master Dokumentasi Teknis
│   ├── DOCUMENTATION.md                # Single Source of Truth (File Ini)
│   └── superpowers/                    # Arsip Riwayat Perancangan & Specs
├── tools/                              # Build & Utility Tools
│   └── ckeditor-builder/               # Custom CKEditor 5 Build untuk CMS
├── WarnetAgent/                        # Source Code Klien Warnet (Rust / Tauri)
│   ├── TMBillingTauri/                 # Main Client Application
│   │   ├── src/                        # UI HTML/JS (Kiosk, Overlay, Admin Lock)
│   │   ├── src-tauri/                  # Rust Core, Win32 Hooks, IPC Commands
│   │   └── package.json
│   ├── MGCTM/                          # Watchdog Daemon (Supervisi TMBilling.exe)
│   ├── mtm/                            # Auxiliary Watchdog & Resilience Guard
│   ├── TMBilling_Monitor/              # Hardware Telemetry & Sensor Daemon
│   ├── TMBilling_Uninstaller/          # Secure Uninstaller (Registry & Service Clean)
│   └── Deploy/                         # Deployment & Firewall Helper Scripts
├── tests/                              # 248 File Pytest / 681 Test + 15 Suite E2E
├── build_and_deploy.bat                # Skrip Build Otomatis Klien & Server
├── developer_install.bat               # Skrip Inisialisasi Dev Environment Cepat
├── CHANGELOG.md                        # Riwayat Rilis Lengkap (Keep a Changelog)
└── README.md                           # Ringkasan Proyek, Quickstart & Panduan Instalasi
```

---

## 4. Katalog & Spesifikasi Mendalam Seluruh Fitur (31 Domain Fitur)

### 4.1 Multi-PC Selection & Batch Actions Engine (`remoteBatch`)
- **Deskripsi**: Operator kasir dapat memilih banyak PC sekaligus untuk melakukan aksi massal hanya dengan beberapa klik.
- **Metode Seleksi**:
  - *Checkbox Selection*: Centang pada card PC di dashboard.
  - *Card-to-Card Drag / Shift-Click*: Seleksi rentang PC sekaligus.
- **Operasi Batch yang Didukung**:
  - `Batch Shutdown`: Mematikan seluruh PC terpilih sekaligus.
  - `Batch Restart`: Merestart seluruh PC terpilih.
  - `Batch Lock / Unlock`: Mengunci/membuka kunci layar klien secara massal.
  - `Batch Clear Sesi`: Menutup seluruh sesi yang telah selesai.
  - `Batch Move PC`: Memindahkan antrian sesi ke blok PC lain.
  - `Batch Apply Paket`: Menerapkan paket promosi secara bersamaan ke beberapa PC.
- **Implementasi API**: `API.monitor.remoteBatch({ action, pc_ids })` di [app/static/js/kasir/core/api.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/api.js) memanggil endpoint `/api/monitor/remote-batch`.

### 4.2 TightVNC Remote Control System & Bi-directional Clipboard Sync
- **Deskripsi**: Kasir dapat melihat layar dan mengontrol keyboard/mouse PC klien secara *real-time* langsung dari browser tanpa perlu menginstall VNC viewer eksternal.
- **Arsitektur Loopback 5900**: TightVNC Server di klien mendengarkan pada port `127.0.0.1:5900`.
- **WebSocket RFB Proxy**: Proses Websockify (port `8081`) meneruskan binary frame RFB dari TightVNC ke canvas HTML5 di dashboard (`vnc_client.js`); route Flask hanya mengatur start/stop/status proxy.
- **Bi-directional Clipboard Sync**: Teks yang disalin di browser kasir otomatis terkirim ke clipboard Windows PC klien, dan sebaliknya teks yang disalin di PC klien disinkronkan ke browser kasir melalui kanal WebSocket Websockify.
- **Auto-Firewall & Fail-Fast Multiplexing**: Skrip `allow_firewall.bat` memastikan port TightVNC diizinkan oleh Windows Firewall, dan mekanisme multiplexing token mencegah tabrakan sesi VNC antar kasir. Token proxy kini acak per sesi (`secrets.token_urlsafe(24)`), bukan pola `client_<id>` yang bisa ditebak.
- **Auto-Generated Random VNC Password**: Sistem secara otomatis meng-generate password acak 8 karakter saat pertama kali dijalankan jika belum dikonfigurasi di tabel settings (`SettingsService.get_or_create_vnc_password`), menggantikan ketergantungan pada password default statis demi keamanan jaringan LAN.
- **Otorisasi & Non-Blocking Start**: Seluruh route VNC wajib `@login_required` + `@admin_required`. Permintaan start tidak lagi menahan worker 25 detik: server membalas `202 {pending: true}` dan route status mem-poll hasil (`poll_vnc_result`) lalu memulai proxy saat TightVNC siap. Token lama dicabut saat proxy dimulai ulang, file token ditulis atomik (`os.replace`), dan reaper mematikan proxy milik PC offline maupun proxy yang idle melewati batas.

### 4.3 Blackout Auto-Recovery System (Toleransi Mati Lampu & Uptime Tracker)
- **Deskripsi**: Proteksi otomatis terhadap pemadaman listrik (*blackout*) mendadak di warnet.
- **Pencatatan Uptime & Offline Tracker**: Menggunakan tabel `PCUptimeLog` yang merekam *heartbeat* klien setiap beberapa detik.
- **Toleransi Blackout**: Jika listrik padam mendadak, server mendeteksi status offline seluruh PC secara serentak. Saat listrik menyala kembali dan PC booting, sistem secara cerdas **tidak memotong durasi pelanggan** selama masa mati lampu, melainkan memulihkan sisa waktu dan paket sesi secara otomatis (*Auto Session Resume*). Sisa waktu yang dikembalikan ke member memakai snapshot audit `sisa_audit` (bukan jam berjalan), sehingga tidak ada kelebihan waktu. `sesi.selesai_pada` diisi waktu referensi (`last_sync`/`mulai_pada`), bukan jam deteksi, agar waktu terpakai tidak membengkak sepanjang outage; sesi guest yang dipulihkan juga mengisi `selesai_pada`. Pemulihan member ditolak bila member masih punya sesi aktif lain dan saldo yang sudah kadaluarsa tidak dihidupkan. Threshold deteksi dibatasi `1..1440` menit, deteksi dijalankan di dalam `WRITE_LOCK` dan memuat ulang tiap sesi serta melewati sesi yang heartbeat-nya masih baru, sehingga heartbeat aktif tidak salah dianggap mati lampu; polling client yang `last_sync`-nya sudah melewati ambang menjalankan deteksi lebih dulu sebelum memperbarui heartbeat, sehingga jeda outage tidak hilang dari audit; hanya sesi bertanda `is_blackout_suspect` yang dapat di-resolve. Force close all juga mereset `pc.is_admin_mode` agar kiosk tidak tertinggal dalam mode admin. Force close (tombol darurat) tetap menyimpan sesi guest/member yang heartbeat-nya masih baru: sesi ditandai `is_blackout_suspect`, `sisa_menit_saat_mati` diambil dari `last_sync`, saldo member disimpan, dan setiap sesi mendapat satu transaksi `tutup_sesi` Rp0 agar masuk riwayat blackout. Pemulihan guest menolak PC yang sudah diarsipkan (`aktif=False`), baik PC asal maupun PC tujuan pindah.
- **Hard Delete Uptime Log**: Admin dapat membersihkan riwayat log uptime lama dengan konfirmasi aman.

### 4.4 5-Layer WarnetAgent Anti-Tamper Security & Registry Hash Verification
- **Deskripsi**: Pertahanan 5 lapis untuk mencegah kecurangan (*bypass billing*), mematikan process lockscreen, atau mengganti binary klien.
- **Lapis 1 - Win32 Low-Level Hooks**: Mencegah hotkey sistem Windows (`WinKey`, `Ctrl+Alt+Del`, `Alt+Tab`, `Alt+F4`, `Ctrl+Shift+Esc`).
- **Lapis 2 - Taskbar & Desktop Shield**: Menyembunyikan Start Menu, Taskbar, dan ikon Desktop saat layar terkunci.
- **Lapis 3 - Dual-Hive SHA-256 Binary Integrity**:
  - Binary hash SHA-256 dari seluruh file executable klien disimpan di Registry Windows pada dua hive independen (`HKCU` dan `HKLM`):
    - `Hash_MGCTM` (Hash binary Watchdog)
    - `Hash_TMBilling` (Hash binary Tauri Kiosk)
    - `Hash_TMMonitor` / `Hash_mtm` (Hash modul monitor)
    - `Hash_Uninstaller` (Hash binary uninstaller)
  - Sebelum eksekusi, hash file fisik diverifikasi terhadap registry. Jika terjadi perbedaan (file dimodifikasi/di-patch), klien menolak berjalan dan mengunci PC.
- **Lapis 4 - Watchdog Daemon (`MGCTM.exe` & `mtm.exe`)**: Process independen berhak Administrator yang terus memantau `TMBilling.exe`. Jika `TMBilling.exe` dimatikan paksa, watchdog seketika me-respawn klien dan mengunci sistem.
- **Lapis 5 - Emergency Credentials SHA-256**: Autentikasi darurat offline berbasis hash SHA-256 yang aman untuk membuka kunci PC oleh teknisi saat jaringan server terputus. Kredensial **tanpa fallback default** (fail-closed): bila registry/`config.ini` kosong, jalur darurat offline nonaktif, dan `install.bat` membangkitkan password acak 24 karakter yang dicetak ke konsol saat operator mengosongkan prompt.

### 4.5 Hardware Checker, Security Audit & CCTV Smart Reference

#### A. Pemisahan Mobo Model vs Mobo Serial & Deteksi Pergantian Komponen
- **Deskripsi**: Merekam *snapshot* spesifikasi hardware PC klien ke dalam tabel `HardwareMonitor` sebagai baseline resmi yang terkunci:
  - **Mobo Model** (Model Papan Induk, e.g., `B550M DS3H AC`)
  - **Mobo Serial** (Serial Number Unik Anti-Maling, e.g., `SN210800012938`)
  - **CPU ID** & Nama Prosesor
  - **GPU PNP Device ID** & Nama Grafis
  - **RAM Serials** (Daftar nomor seri keping memori)
  - **Disk Serials** (Daftar nomor seri SSD/HDD)
- **Deteksi Pencurian / Pergantian Komponen**: Setiap kali PC klien booting, agen mengirimkan spesifikasi hardware saat ini (*current specs*). Sistem secara otomatis membandingkannya dengan baseline tersimpan via `HardwareService.process_hardware_metric`. Jika terdapat perbedaan (GPU PNP ID berbeda, RAM serial hilang/berkurang, Disk diganti, Motherboard ditukar), dashboard kasir seketika memunculkan alert diskrepansi visual merah solid dengan deskripsi komponen yang berubah. Identitas PC diambil dari IP koneksi peer (`IpWhitelistService.extract_client_ip`), bukan field `IpAddress` di body, sehingga telemetri tidak bisa dipalsukan untuk PC lain; nilai metrik non-numerik ditolak `400`.
- **Visualisasi Audit di Tab Hardware Checker & Modal Detail PC**:
  - Modal detail PC mengambil data satu PC via `GET /api/v1/kasir/monitor/hardware/<int:pc_id>` (bukan lagi memuat seluruh daftar `/monitor/all`).
  - **🔒 Baseline Resmi (Terkunci)** — spesifikasi yang terdaftar saat tombol *Update Baseline* terakhir ditekan, disertai badge `TERDAFTAR`.
  - **🔍 Terdeteksi Saat Ini (Live Telemetry)** — spesifikasi yang dikirim agen saat terakhir booting, disertai badge `LIVE SPECS`. RAM dan Disk serial ditampilkan dalam *pill tag* berwarna: ungu normal (🏷️), merah solid (🚨 Tukar!) jika tidak ada di baseline.

#### B. Referensi CCTV Cerdas dengan Rentang Waktu (Smart CCTV Time Window)
- **Deskripsi**: Setiap deteksi perubahan hardware internal selalu menghasilkan **rentang waktu estimasi** untuk memandu operator dalam mengecek rekaman CCTV, bukan hanya satu titik waktu.
- **Format Output Rentang Waktu**:
  - Jika data log shutdown tersedia: `"22/09/2026 16:38 WITA s/d 23/09/2026 00:38 WITA (rentang PC mati sebelum boot)"`
  - Jika log shutdown tidak tersedia (estimasi otomatis 8 jam sebelum boot): `"17/09/2026 11:33 WITA s/d 19:33 WITA (rentang PC mati sebelum boot)"`
- **Panduan CCTV untuk PC Tidak Bisa Boot (Agent Offline)**: Jika PC tidak bisa booting sama sekali (seluruh komponen penting dicuri sehingga tidak ada data telemetry), modal detail PC di dashboard menampilkan field **"Terakhir PC Aktif / Sinkron"** dengan catatan: *`> [Waktu PC Terakhir Dimatikan]`* sebagai panduan batas awal pengecekan rekaman CCTV.
- **Implementasi**: Fungsi `format_cctv_internal_window()` di `app/services/hardware/hardware_service.py`.

#### C. Indikator Kecepatan NIC (Network Interface Card)
- NIC speed terdeteksi dari agent dan ditampilkan di baris bawah kartu hardware:
  - **≥ 1 Gbps / ≥ 1000 Mbps** → tampil hijau emerald (`text-emerald-400 font-bold`).
  - **< 1 Gbps** (misal 100 Mbps, 10 Mbps) → tampil merah solid (`text-red-400 font-bold`) tanpa animasi berkedip sebagai sinyal peringatan koneksi lambat.

#### D. Alur Operasional: Update Baseline
1. Owner/Admin mengklik tombol **🔄 Update Baseline** pada PC yang bersangkutan.
2. Sistem merekam spesifikasi hardware internal yang saat ini terdeteksi sebagai baseline resmi baru.
3. Seluruh flag mismatch direset, dan monitoring berjalan kembali dari titik awal.
4. Endpoint: `POST /api/v1/kasir/monitor/register/<pc_id>`.

### 4.6 Remote Process Monitor & Task Killer
- **Deskripsi**: Kasir dapat melihat seluruh aplikasi dan proses yang sedang berjalan di PC klien tertentu secara langsung dari modal web dashboard.
- **Fitur**:
  - Menampilkan nama proses, PID, CPU usage, dan Memory usage.
  - Tombol **End Task / Kill Process** jarak jauh untuk mematikan game yang not-responding atau software terlarang.
- **Reset Mode Admin**: `PCService.reset_admin_mode` menutup sesi admin/guest lewat `SesiService.tutup_sesi` (tercatat sebagai transaksi) lalu mengantre perintah `lock` dengan id PC agar kiosk kembali terkunci.

### 4.7 Screenshot Monitor with Natural Sorting
- **Deskripsi**: Layar pengawasan visual yang menampilkan *thumbnail live screenshot* dari seluruh PC klien yang aktif.
- **Natural Sorting**: Daftar PC terurut secara natural (`PC-01`, `PC-02`, ..., `PC-09`, `PC-10`, `PC-11`, bukan urutan ASCII yang melompat).
- **Live Zoom**: Klik thumbnail untuk memperbesar screenshot secara instan tanpa lag.
- **Nama Berkas Aman**: `_screenshot_filename()` membuang pemisah path sebelum `secure_filename`, sehingga kode PC seperti `PC/01` tetap menjadi `PC01.png` dan tidak bisa menulis di luar folder screenshot.
- **Identitas & Validasi Unggah**: Endpoint unggah menentukan PC dari IP koneksi peer (`IpWhitelistService.extract_client_ip`), bukan header `X-IP-Address`, sehingga satu PC tidak bisa menimpa screenshot PC lain. Byte gambar divalidasi Pillow (`verify()` lalu dibuka ulang), dinormalkan ke PNG dengan sisi maksimum 1280 px, disimpan di `instance/uploads/screenshots` (folder privat, **bukan** static publik), dan data tidak valid ditolak `400`.
- **Akses Admin-Only**: `GET /api/v1/kasir/monitor/screenshot/all`, `.../screenshot/status/<pc_id>`, dan `.../screenshot/image/<pc_id>` memakai `@login_required` + `@admin_required`, sehingga kasir tidak bisa membaca metadata maupun byte gambar. JSON tetap memuat kunci `screenshot_url`, kini menunjuk route gambar terproteksi; helper `migrate_legacy_screenshots(app)` memindahkan screenshot lama dari `static/uploads/screenshots` ke folder instance saat startup (dilewati saat `TESTING`). Folder `app/static/uploads/screenshots` tidak ikut dipaketkan `build_release.py`, disk guard auto-screenshot memakai volume `instance_path` dan gagal tertutup bila kapasitas tidak terbaca, serta hard-delete PC ikut menghapus berkas screenshot privatnya.

### 4.8 POS Kantin & Billing FnB Multi-Payment (Cash/QRIS/Bank + Struk Thermal)
- **Deskripsi**: Modul kasir kantin / FnB lengkap yang terintegrasi langsung dengan billing PC.
- **Fitur**:
  - Manajemen katalog menu (`MenuItem`), kategori (Makanan, Minuman, Snack, Voucher), dan stok barang.
  - Opsi *Unlimited Stock* untuk item yang tidak memerlukan pengurangan inventaris otomatis.
  - **Multi-Metode Pembayaran**: Tunai (Cash), QRIS Dinamis/Statis, dan Transfer Bank. Metode Tunai wajib menyertakan nominal `>= total_tagihan`; tunai kosong atau kurang ditolak.
  - **Charge to PC**: Tagihan makanan/minuman bisa langsung dibebankan ke sesi PC pelanggan dan dibayar saat sesi selesai.
  - **Validasi Gambar Menu**: Unggah gambar menu memvalidasi byte dengan Pillow (`verify()` lalu `seek(0)`) setelah cek ekstensi; file non-gambar yang dinamai `.png` ditolak `400`.
  - **Gambar QRIS Statis**: Upload di Pengaturan divalidasi Pillow, diperkecil maks 800 px (PNG optimize / JPEG q90) dan disimpan dengan nama bertimestamp agar cache client otomatis berganti. Server mengirim `qris_path` relatif ke client (client membentuk URL dari `server_url` sendiri) serta `qris_url` absolut dari setting `app_public_url`; `/static/uploads/qris/` di-cache immutable 1 tahun.
  - **Refresh Konfigurasi Client**: Kiosk Tauri memuat konfigurasi sekali saja melalui `src/main.js` (loop 60 detik saat sehat, 5 detik saat gagal, refresh saat tab QRIS dibuka). Gambar QRIS diunduh ke data URI hanya bila URL berubah dan disimpan di RAM; bila unduhan gagal, client menampilkan "QRIS belum tersedia" (tidak menampilkan QRIS lama) agar tidak salah bayar.
  - **Cetak Struk Thermal**: Format struk 58mm / 80mm ESC/POS dengan logo warnet, rincian pesanan, total rupiah, dan footer terima kasih.
  - **Log Mutasi Stok Menu (`MenuStockLog`) & Restock Audit**:
    - Riwayat mutasi inventaris secara real-time: pencatatan otomatis setiap penambahan stok (*Restock*), penjualan pesanan kantin, ataupun penyesuaian/koreksi audit fisik.
    - Tab **Log Stok Menu** dengan filter rentang tanggal cepat (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Semua), filter operator, pagination server-side, dan fit-to-table responsive layout.
    - Otorisasi RBAC: Kasir/Staff dapat melakukan restock barang dengan pencatatan audit log otomatis dan identitas operator.

### 4.9 Dynamic Tutorials CMS & Custom CKEditor Builder
- **Deskripsi**: Sistem Content Management System (CMS) mandiri di dalam aplikasi kasir untuk membuat SOP, tutorial pemakaian, dan panduan operator warnet.
- **Fitur**:
  - Custom CKEditor 5 Build (berada di `tools/ckeditor-builder`) yang mendukung format teks kaya, tabel, highlight, dan upload gambar lokal otomatis saat artikel disimpan.
  - **Validasi Gambar Tutorial**: Endpoint `/api/v1/kasir/tutorials/upload-image` memvalidasi byte dengan Pillow setelah cek ekstensi; file non-gambar ditolak `400` dan tidak disimpan ke folder temp.
  - **Validasi Input & Cleanup Per-Editor**: Judul/isi yang tidak memenuhi aturan service dibalas `400` (bukan `500`). Saat editor ditutup, `POST /api/v1/kasir/tutorials/cleanup-temp` hanya menghapus berkas di `static/assets/tutorials/temp/` yang dirujuk payload editor tersebut, sehingga draft admin lain tidak ikut terhapus.
  - *Smart Tutorial Seeding*: Server otomatis menginisialisasi panduan standar saat database baru dibuat.
  - *Export / Import Tutorial*: Kemampuan backup dan restore artikel panduan.

### 4.10 Cloudflare Tunnel Auto-Service
- **Deskripsi**: Integrasi Cloudflare Tunnel bawaan untuk menghubungkan server billing lokal ke domain internet secara aman tanpa perlu port forwarding atau IP publik statis.
- **Fitur**:
  - Penyimpanan token Cloudflare yang persisten di database `Settings`.
  - Instalasi otomatis service background `cloudflared.exe`; log proses ditulis ke `logs/` di samping biner cloudflared.
  - Kemudahan akses bagi Owner untuk melihat laporan keuangan dan analitik dari mana saja melalui smartphone.

### 4.11 Centralized Versioning System (`config.py` Truth)
- **Deskripsi**: Standarisasi nomor versi aplikasi terpusat pada file [app/config.py](file:///c:/Project%20GIT/TMBilling/app/config.py) (`VERSION = "1.6.5-rc3"`).
- **Penyebaran Otomatis**: Variabel versi ini otomatis diinjeksikan ke template Jinja2 (footer UI kasir), endpoint REST `/api/version`, dan response handshake klien agent.

### 4.12 RBAC Kasir & Centralized Audit Log System
- **Deskripsi**: Role-Based Access Control dengan 3 tingkatan pengguna: `Super Admin`, `Admin`, dan `Kasir`.
- **Audit Logs**: Seluruh aktivitas krusial (buka sesi, tambah waktu, hapus member, edit harga paket, diskon, refund, pembukaan laci kas) dicatat sebagai JSON line di `logs/warnet.log` melalui `app/utils/logger.py` (rotasi gzip; tanpa tabel database).
- **Pembersihan Log dengan Otorisasi Supervisor**: Riwayat audit log tidak dapat dihapus sembarangan dan membutuhkan verifikasi password level Administrator/Super Admin.
- **Anti Brute-Force Login**: `services/auth/login_throttle.py` membatasi 5 kegagalan per kombinasi (IP, username) dalam 5 menit dan membalas HTTP 429; berlaku pada login kasir, `admin-check`, `client/admin-login`, dan portal member. Logout wajib menyertakan token sesi yang cocok, dan setiap login sukses memanggil `session.clear()` agar sesi lama tidak menempel.
- **Batas Unggah & Nama Berkas**: `MAX_CONTENT_LENGTH = 64 MB` mencegah unggahan raksasa; nama file screenshot dibersihkan dengan `secure_filename` setelah membuang pemisah path sehingga kode PC tidak bisa keluar dari folder upload.
- **Toggle Whitelist**: `POST /api/v1/kasir/settings/ip-whitelist/toggle` menormalkan string boolean; `"false"` benar-benar menonaktifkan whitelist, bukan dianggap truthy.
- **Pengecualian Admin Divalidasi ke Database**: Middleware whitelist hanya membebaskan sesi yang user-nya masih ada, `aktif=True`, dan ber-role `admin` di database. Sesi dengan cookie lama ber-role admin yang sudah diturunkan/dinonaktifkan tidak lagi mendapat bypass (role sesi disegarkan dari DB atau sesi dibersihkan), sehingga pengecualian admin tidak bisa dipakai satu request pun setelah demosi.
- **Arsip, Hapus User, dan Guard Shift**: `POST /api/v1/kasir/user/<id>/archive` menonaktifkan akun (`aktif=False`). `DELETE /api/v1/kasir/user/<id>` menghapus permanen dengan body `{"confirm": "<username>"}` dan tetap **ditolak** (`400`) bila user punya `ShiftRecord`, karena `shift_record.kasir_id` NOT NULL; referensi `Transaksi.user_id` dan `Sesi.user_id` dilepas menjadi NULL sehingga histori keuangan tetap utuh. Guard "admin terakhir" hanya berlaku untuk admin yang masih aktif, sehingga admin nonaktif tetap bisa dihapus saat tersisa satu admin aktif. Race username saat pembuatan user di-rollback menjadi `ValueError("Username sudah terdaftar")`.
- **Hapus Audit Blackout & Kontrol LHM Khusus Admin**: `/api/v1/kasir/blackout/clear` dan start/stop TMLHMService memakai `@admin_required`.
- **Sanitasi HTML Pengumuman**: Teks pengumuman kiosk (hasil CKEditor) disanitasi `SafeHTMLParser` saat ditulis maupun dibaca, memakai allowlist protokol (`http://`, `https://`, `mailto:`, `/`, `#`, `data:image/`).

### 4.13 Floor Plan & Dynamic Visual Room Layout (v1.6.3 Engine)
- **Deskripsi**: Denah visual warnet interaktif 2 dimensi di dashboard kasir (`map_view.js`).
- **Fitur & Peningkatan v1.6.3**:
  - **Async Batching dengan `Promise.all()`**: Penyimpanan koordinat posisi seluruh meja dieksekusi secara asinkronus bersamaan tanpa freeze UI, diikuti pemanggilan `Dashboard.load(true)` untuk sinkronisasi state.
  - **Dukungan Koordinat Unmapped PC**: PC yang belum diletakkan di denah memiliki koordinat `pos_x = -1, pos_y = -1` dan tersimpan aman di basis data dengan batas validasi skema `-1..10000`.
  - **Drag-and-Drop Responsive Grid**: Node meja dapat digeser bebas dengan snap-to-grid halus.
  - **Indikator Warna Dinamis**: Hijau (Kosong/Tersedia), Merah (Sesi Aktif), Oranye (Sisa Waktu < 10 Menit), Abu-abu (Offline).
  - **Quick Action Click**: Klik langsung pada node meja untuk membuka sesi, menambah durasi, atau melihat detail PC.
  - **Arsip PC**: Menghapus PC yang sudah punya riwayat sesi tidak menghapus barisnya; PC ditandai `aktif=False` agar histori dan laporan tetap utuh. PC tanpa riwayat tetap dihapus permanen.
  - **Omzet Hari Ini**: Kartu omzet memakai `get_today_local_date()` sesuai zona waktu setting, bukan tanggal UTC, sehingga transaksi dini hari tidak jatuh ke hari sebelumnya.

### 4.14 Database Maintenance & Cloud/Local Backup UI
- **Deskripsi**: Fasilitas pemeliharaan database SQLite internal agar tetap kencang dan aman dari korupsi data.
- **Fitur**:
  - *Auto Backup Lokal*: Backup terjadwal berkala ke folder arsip lokal.
  - *Cloud Backup Rotation*: Sinkronisasi backup ke penyimpanan cloud eksternal dengan retensi rotasi otomatis; seluruh panggilan HTTP provider memakai `timeout=30` agar job tidak menggantung.
  - *Unduhan Database Aman WAL*: `GET /api/v1/kasir/settings/backup/download` memakai snapshot SQLite Online Backup API + `PRAGMA integrity_check` ke file sementara (isi `-wal` ikut tersalin), lalu dihapus via `after_this_request`. Tidak lagi men-stream file `warnet.db` hidup.
  - *SQLite VACUUM & Optimize*: Mengompresi dan merapikan indeks database langsung dari tombol di pengaturan.
  - *Arsip Pra-Purge Konsisten*: sebelum menghapus riwayat, `DBMaintenanceService` menyimpan snapshot Online Backup API + `PRAGMA integrity_check` ke `default_backup_dir()/archive` (bukan `copy2` berkas WAL yang bisa kehilangan isi `-wal`).
  - *Database Restore Modal*: Antarmuka pemulihan database dengan proteksi konfirmasi ganda.
  - *Migrasi Setelah Restore*: arsip divalidasi lebih dulu — file SQLite yang utuh tetapi bukan database TMBilling (tabel inti `grup`/`pc`/`sesi`/`transaksi` tidak lengkap) ditolak `400` sebelum database aktif ditimpa. Setelah dipasang, DB berversi `alembic_version` **atau** berskema lama tanpa revisi dimigrasikan ke revisi `head` (`run_migration.run(app)`) selama maintenance mode masih aktif, lalu skema hasil migrasi diverifikasi ulang; bila migrasi gagal atau skema masih tidak lengkap, DB dikembalikan otomatis dari backup pengaman yang dibuat sebelum restore dan request dibalas `400` dengan pesan yang jelas. Skema tanpa `alembic_version` yang sudah identik dengan model (mis. database hasil `db.create_all()` di test/sandbox) tetap dipulihkan tanpa migrasi.
  - *Gerbang Maintenance Tahan Tumpang Tindih*: `services/maintenance_mode.py` memakai hitungan konteks aktif di bawah lock, sehingga dua restore yang berjalan bersamaan tidak membuka kembali API publik saat konteks pertama selesai.

### 4.15 Manajemen Member, Paket & Billing Rates
- **Deskripsi**: Pengelolaan akun pelanggan member, saldo deposit, dan paket promosi warnet.
- **Fitur**:
  - Akun Member: Login dengan username/password di PC klien, auto-potong saldo deposit per detik.
  - Paket Promosi: Paket Personal, Paket 2 Jam, Paket 5 Jam, Paket Malam (Begadang).
  - Custom Group Rates: Tarif berbeda untuk tipe ruangan Reguler, VIP, Sofa, atau VVIP Simulator.
  - Reset State Sesi: Proteksi pembersihan data sesi sementara saat PC selesai digunakan.
  - Refund Paket Nominal Penuh: Refund guest & member mengembalikan nilai penuh transaksi (`-jumlah`) sambil memotong menit tersisa (guest dibatasi sisa waktu, member `max(0, saldo - durasi)`).
  - Satu Sesi Aktif per PC & Member: Unique index parsial `uq_aktif_sesi_pc` (`pc_id` WHERE `status='aktif'`) dan `uq_aktif_sesi_member` (`member_id` WHERE `status='aktif'`) menolak sesi ganda; pelanggaran dipetakan menjadi `ValueError("PC sedang dipakai")`.
  - Top-up Multi-Paket Atomik: `tambah_waktu_batch` membungkus `WRITE_LOCK`, menulis seluruh item dengan `commit=False`, lalu satu commit; kegagalan salah satu item me-rollback semuanya dan audit log ditulis setelah commit.
  - Arsip vs Hapus Member: `POST /api/v1/kasir/member/<id>/archive` menonaktifkan member (ditolak bila masih punya sesi aktif). `DELETE /api/v1/kasir/member/<id>` menghapus permanen dengan body `{"confirm": "<nama member>"}`; referensi `Sesi.member_id` dan `Transaksi.member_id` dilepas menjadi NULL sehingga riwayat sesi/transaksi tetap ada tanpa identitas member.
  - Serialisasi Tulis Saldo: `app/services/write_lock.py` (`WRITE_LOCK`) membungkus `tambah_waktu`/`refund_paket`/`tambah_waktu_batch` member dan `tambah_waktu_sesi` agar dua request bersamaan tidak saling menimpa saldo (read-modify-write) pada satu proses server.
  - Paket Tidak Ditemukan: edit/hapus paket yang sudah tidak ada dibalas `404` ("Paket tidak ditemukan"), bukan `500`.
  - Parsing Boolean Paket: flag `aktif` menerima string `"true"`/`"1"`/`"yes"` dan `"false"` benar-benar menonaktifkan; nilai string tidak lagi dianggap truthy mentah.
  - Paket Nonaktif Ditolak: top-up sesi guest maupun member dengan paket `aktif=False` dibalas `ValueError("Paket tidak aktif")` sebelum durasi, saldo, atau transaksi diubah; paket nonaktif tidak bisa dijual lewat request lama/tamper.
  - Privasi Portal Publik: `/api/v1/public/member/pc-status` menampilkan nama member sebagai "Member", bukan username; total belanja portal hanya menjumlahkan transaksi pembelian valid (`jumlah > 0` dan bukan refund).
  - Logout Portal Member: `POST /api/v1/public/auth/logout` memanggil `AuthService.logout` untuk mengakhiri sesi kiosk dengan token sesi.
  - Hapus Nota Paket Ditolak: nota `beli_paket`/`beli_paket_member` tidak bisa dihapus dari riwayat; API membalas 400 dengan arahan memakai Refund agar saldo member ikut kembali. Penghapusan riwayat transaksi juga membersihkan `TransaksiMenu` pada rentang tanggal yang sama, menolak rentang tanggal yang masih dipakai sesi aktif, dan menghapus transaksi yang tidak ada membalas `404`; pembersihan log sistem meneruskan opsi arsip.

### 4.16 Shift Kasir & Serah Terima Shift (Hitung Buta / Blind Cash Reconciliation)
- **Deskripsi**: Sistem manajemen jam kerja dan serah terima shift kasir anti-manipulasi berbasis *Blind Count (Hitung Buta)*, rekonsiliasi laci fisik, dan struk handover thermal.
- **Fitur & Alur Kerja**:
  - **Buka Shift Kasir**: Kasir baru memasukkan nominal **Modal Awal Kas** (uang receh/kembalian fisik yang dihitung di laci) saat mulai bertugas. Modal awal bersifat dinamis per shift dan tidak menggelembungkan omzet toko.
  - **Hitung Buta (Blind Reconciliation)**: Saat menekan tombol **Akhiri Shift**, sistem **menyembunyikan total pendapatan sistem**. Kasir wajib menghitung seluruh uang fisik nyata di laci dan mengetikkan nominalnya secara jujur.
  - **Kalkulasi Selisih Otomatis**: Sistem membandingkan `Uang Fisik Aktual` vs `Modal Awal + Transaksi Tunai Bersih`. Status selisih (`PAS / Rp 0`, `SURPLUS (+)`, atau `DEFISIT (-)`) langsung terkunci permanen di database.
  - **Pemisahan Tunai vs Non-Tunai**: Transaksi QRIS dan transfer otomatis dipisahkan dari perhitungan kas fisik laci kasir.
  - **Ringkasan Lintas Kasir**: Rekap shift menghitung seluruh transaksi pada rentang waktu shift (bukan hanya `user_id` kasir pemilik shift) dan tidak meng-clamp nilai negatif, sehingga selisih refund berlebih tetap terlihat.
  - **Akses Ringkasan & Struk**: `GET /api/v1/kasir/shift/summary` khusus admin (kasir selalu `403`, termasuk tanpa `shift_id`), sedangkan `GET /api/v1/kasir/shift/<id>/summary` dan struk shift hanya boleh dibaca pemilik shift atau admin; kasir lain mendapat `403` sehingga hitung buta tidak bisa diintip.
  - **Satu Shift Aktif**: Unique index parsial `uq_aktif_shift` (`status='AKTIF'`) plus `WRITE_LOCK` mencegah dua kasir membuka shift aktif bersamaan; `start_shift` menolak akun kasir nonaktif, dan `end_shift`/`force_close_shift` diserialisasi `WRITE_LOCK` sehingga dua request tutup tidak sama-sama menang (yang kalah mendapat `400 "Shift sudah ditutup sebelumnya"`).
  - **Riwayat Shift**: Non-admin hanya dapat membaca riwayat shift miliknya sendiri (`kasir_id` dipaksa dari sesi), `limit` dibatasi `1..100`, `offset >= 0`, dan tanggal tidak valid dibalas `400`; rentang tanggal memakai zona waktu lokal setting.
  - **Admin Force Close Shift**: Administrator dapat menutup paksa shift kasir aktif dalam situasi darurat dengan pencatatan audit log.
  - **Struk Thermal Handover 58mm / 80mm**: Pencetakan bukti serah terima shift fisik lengkap dengan rincian penerimaan tunai, non-tunai, modal awal, rekonsiliasi laci, dan selisih keuangan untuk ditandatangani kedua kasir.
  - **Tab Riwayat Serah Terima Shift**: Menampilkan rekapitulasi seluruh shift sebelumnya dengan filter tanggal otomatis, badge status, modal detail, dan tata letak responsif (*fit-to-table* pada breakpoint LG/XL).

### 4.17 Catatan Kasir & Shift Handover Scratchpad
- **Deskripsi**: Papan catatan (*scratchpad*) digital terintegrasi di dashboard kasir (`catatan`).
- **Fitur**:
  - Tempat operator meninggalkan pesan operasional untuk shift berikutnya.
  - Catatan disimpan persisten di database dan dapat dibaca oleh seluruh kasir dan admin.
  - Seluruh endpoint catatan memakai `@login_required`, sehingga sesi kasir yang sudah dihapus atau dinonaktifkan langsung ditolak `401` (tidak bisa lanjut dari cookie lama).
  - Nama berkas baru dipesan atomik (`O_CREAT|O_EXCL`); rename ke judul yang sudah dipakai menghasilkan nama unik (`judul_1.txt`) sehingga catatan lain tidak tertimpa.

### 4.18 Turnamen & Bracket eSports Engine
- **Deskripsi**: Sistem manajemen turnamen warnet bawaan untuk game kompetitif (Valorant, MLBB, Dota 2, dll.).
- **Fitur**:
  - Pembuatan bagan turnamen (*Single Elimination*, *Double Elimination*, *Swiss Round*) dengan format `playoff`/`swiss`/`multi`.
  - Pendaftaran nama tim dan daftar susunan pemain (*roster*); nama tim kosong diabaikan sebelum validasi minimal 2 tim.
  - Update skor pertandingan secara *live* yang terhubung ke layar TV Public; skor hanya diterima untuk tim yang benar-benar bertanding di match tersebut, match yang belum punya kedua tim ditolak, dan match yang sudah selesai tidak bisa diubah.
  - `finish_stage` menolak babak yang sudah selesai, tim milik turnamen lain, dan pembuatan bracket babak berikutnya yang sudah ada.

### 4.19 Public TV Billboard & Scoreboard Display
- **Deskripsi**: Halaman antarmuka khusus untuk ditampilkan pada layar TV besar atau monitor proyektor di lobi warnet (`/tv`).
- **Fitur**:
  - Menampilkan daftar PC yang sedang kosong / terpakai beserta sisa waktu.
  - Menampilkan *Running Text* pengumuman promo, harga paket, atau peraturan warnet.
  - Menampilkan bagan dan klasemen turnamen game yang sedang berjalan.

### 4.20 Owner Analytics & Business Intelligence
- **Deskripsi**: Dashboard grafik analitik bisnis khusus untuk pemilik warnet (*Owner*).
- **Metode Utama**:
  - Grafik tren pendapatan harian, mingguan, dan bulanan.
  - Analisis jam sibuk (*Peak Hours Occupancy Heatmap*) untuk optimasi promosi.
  - Perbandingan rasio keuntungan antara pendapatan sewa PC vs penjualan F&B kantin.
  - Laporan harian memakai tanggal lokal server (`get_today_local_date()`), bukan tanggal UTC, agar transaksi dini hari tidak jatuh ke hari sebelumnya.
  - Tanggal laporan tidak valid dan pagination di luar `page >= 1`/`per_page 1..100` dibalas `400`; struk hanya untuk pemilik atau admin.
  - Paket Terlaris: `get_top_paket` mengelompokkan transaksi per `paket_id` sehingga paket yang sudah dihapus tetap terhitung dan diberi label "Paket dihapus"; baris `refund_paket` tidak dihitung sebagai penjualan.
  - **Akuntansi Refund**: pendapatan harian dan pendapatan per kasir hanya menjumlahkan transaksi yang belum direfund (`is_refunded == False`); refund rate memakai total pembelian sebagai penyebut sehingga tidak pernah melebihi 100% karena baris refund ikut terhitung.
  - **Validasi Tanggal**: parameter `start`/`end` yang bukan `YYYY-MM-DD` dibalas `400` ("Format tanggal harus YYYY-MM-DD"); tanpa parameter analytics tetap memakai rentang 7 hari terakhir.

### 4.21 Emergency Mode & Offline Fallback (SHA-256 Auth)
- **Deskripsi**: Mekanisme penanganan darurat ketika jaringan lokal warnet terputus total dari server billing.
- **Fitur**:
  - Klien agent menyediakan jendela darurat dengan verifikasi hash SHA-256 password admin.
  - Memungkinkan teknisi masuk ke mode desktop Windows untuk perbaikan driver/jaringan tanpa harus mematikan PC secara paksa.

### 4.22 Audio Warning Intervals & Sound System (15m, 10m, 5m, 1m)
- **Deskripsi**: Sistem peringatan suara otomatis pada PC klien saat sesi pelanggan hampir habis.
- **Interval Peringatan**:
  - Suara notifikasi berbunyi pada sisa waktu **15 Menit**, **10 Menit**, **5 Menit**, dan **1 Menit**.
  - Mengingatkan pelanggan untuk segera menambah durasi ke kasir sebelum PC otomatis terkunci.
  - Volume audio notifikasi dapat dikonfigurasi dari backend.

### 4.23 Responsive Dual-Layout (1024px vs 1920px & Mobile Touch)
- **Deskripsi**: Desain antarmuka fleksibel yang menyesuaikan resolusi monitor kasir secara otomatis.
- **Dukungan Tampilan**:
  - *Compact Dual-Row Table Layout*: Optimal pada monitor kasir beresolusi 1024x768 atau 1366x768.
  - *Widescreen Grid View*: Optimal pada monitor Full HD 1920x1080.
  - *Mobile Touch Scrolling*: Pengoperasian mulus menggunakan layar sentuh tablet/smartphone.

### 4.24 Live Search Debouncing & PC Code Auto-Dash Formatting
- **Deskripsi**: Standarisasi input kasir untuk kecepatan dan akurasi tinggi.
- **Fitur**:
  - Pencarian nomor PC atau member dilengkapi filter *Debounce (300ms)* untuk mengurangi beban query.
  - *Auto-Prefix Dash*: Input kasir secara otomatis memformat nomor PC (misal mengetik `1` otomatis menjadi `PC-01`).

### 4.25 Integrasi Mikrotik Bandwidth Management (RouterOS Queue API)
- **Deskripsi**: Integrasi langsung antara server billing dan router Mikrotik warnet via RouterOS API.
- **Fitur**:
  - Secara otomatis mengatur limit bandwidth download/upload pada IP PC klien saat sesi billing aktif.
  - Memutus (*drop/block*) akses internet PC klien ketika sesi billing habis atau PC dalam status terkunci.
  - Form konfigurasi yang mengirim `host`/`username` null diperlakukan sebagai string kosong sehingga tidak memicu `500`.
  - Sinkronisasi password user MikroTik berjalan di worker background dengan `username` yang sudah diambil sebagai scalar di thread pemanggil; worker tidak menyentuh objek ORM yang sudah expired setelah commit.

### 4.26 Maintenance Ticket & Issue Reporting System
- **Deskripsi**: Sistem tiket pelaporan kerusakan perangkat keras atau kendala teknis di warnet.
- **Fitur**:
  - Pelanggan dapat melaporkan kendala langsung dari widget overlay PC klien (misal mouse macet atau headset mati sebelah).
  - Kasir menerima notifikasi tiket, mengubah status menjadi `In-Progress` atau `Resolved`, dan merekam riwayat perbaikan oleh teknisi.
  - **Sinkronisasi Status PC**: tiket prioritas `KRITIS` menonaktifkan PC (`aktif=False`) saat dibuat; status `SELESAI` hanya mengaktifkan kembali PC bila tidak ada tiket `KRITIS` lain yang masih `BARU`/`DIPROSES`, sehingga menyelesaikan tiket ringan (atau tiket pada PC arsip) tidak menghidupkan PC yang seharusnya nonaktif.
  - **Validasi Laporan**: tanggal laporan yang tidak valid dibalas `400` (tidak lagi diam-diam mengabaikan filter) dan `limit` daftar tiket dibatasi `1..500`.

### 4.27 Fitur Kunci Meja AFK / Istirahat Sementara (Temporary AFK Screen Lock)
- **Deskripsi**: Solusi keamanan privasi pelanggan saat meninggalkan meja sementara (istirahat makan, ibadah, atau toilet) tanpa mematikan sesi billing.
- **Fitur Utama**:
  - **Minimal Pure Black UI**: Layar PC klien berganti ke tampilan hitam polos minimalis (`#000000`) dengan mono countdown sisa billing, info unit PC, dan nama pengguna.
  - **Hardware Keyboard Hook Lock & Taskbar Suppression**: Seluruh kombinasi tombol pintas Windows (`Alt+Tab`, `Win Key`, `Ctrl+Alt+Del`, `Task Manager`) diblokir penuh di level kernel/Win32 hook selama penguncian.
  - **Autentikasi Dual-Tier**:
    - **Member**: Penguncian langsung 1-klik dari panel overlay; pembukaan kunci menggunakan password akun member yang terenkripsi (`scrypt`/`pbkdf2`).
    - **Guest**: Penguncian memunculkan modal pembuatan 4–6 digit PIN angka sementara; pembukaan kunci menggunakan PIN tersebut.
  - **Remote Kasir & Master Unlock**: Operator/kasir dapat memicu penguncian AFK dari jarak jauh atau membuka kunci darurat (*Master Unlock*) melalui tombol aksi di Detail Modal PC pada Dashboard Kasir jika pelanggan lupa PIN/password.
  - **Indikator Amber Real-Time**: Kartu PC di Dashboard Kasir menampilkan badge amber menyala `🔒 AFK / Istirahat` sementara timer dan nama pengguna tetap terpantau aktif.

### 4.28 Arsitektur Proteksi Triple-Layer Session Expiry & Heartbeat
- **Deskripsi**: Arsitektur perlindungan 3 lapis untuk memastikan penghitungan sisa waktu presisi dan penutupan otomatis sesi billing yang telah habis tanpa ada celah *free playtime*.
- **Lapisan Proteksi**:
  1. **Layer 1 - Server Background Scheduler (APScheduler)**:
     - Berjalan di latar belakang server Flask setiap **60 detik** (`run.py`).
     - Memanggil `SesiService.cleanup_expired_sessions()` untuk memeriksa seluruh sesi aktif, menandai sesi kadaluwarsa sebagai `SELESAI`, dan memicu sinyal penguncian.
  2. **Layer 2 - Realtime Client Polling (WarnetAgent Klien)**:
     - Klien PC warnet (Tauri) mengirimkan request heartbeat/status setiap **1 s/d 3 detik** ke `/api/v1/public/client/status`.
     - Handler `ClientService.get_status()` memanggil `SesiService.hitung_sisa_menit()` dan menutup sesi lewat `SesiService.tutup_sesi(id, operator="system")` saat sisa waktu `<= 0`, sehingga tercatat satu transaksi `tutup_sesi` Rp0 sebelum payload lockscreen dikembalikan ke klien.
     - Heartbeat `sesi.last_sync` diperbarui maksimal tiap 30 detik lewat UPDATE bersyarat tanpa SELECT tambahan; kegagalan sinkronisasi waktu member hanya dicatat dan tidak menutup sesi berbayar. Takeover `emergency_login`/`admin_login` menutup sesi lama lewat `SesiService.tutup_sesi` sehingga sisa waktu tercatat sebagai transaksi penutupan.
     - Identitas PC diambil dari IP koneksi; bila IP berubah, fallback MAC hanya dipakai untuk PC yang masih `aktif=True`. PC yang dinonaktifkan/diarsipkan dibalas `{"status": "kosong", "message": "PC tidak dikenal"}` sehingga sesi lama tidak lanjut di meja yang sedang maintenance.
  3. **Layer 3 - Frontend Dashboard Polling (Web Kasir)**:
     - Dashboard kasir melakukan polling status berkala (dapat diatur: 1, 2, 3, atau 5 detik) ke `/api/v1/kasir/dashboard/pc`.
     - Backend di `DashboardService.get_pc_list()` secara proaktif memanggil `cleanup_expired_sessions()`, memastikan tampilan kasir selalu sinkron secara instan.
- **Formula Sisa Waktu Presisi**:
  $$\text{Sisa Menit} = \text{durasi\_beli\_menit} - \text{round}\left(\frac{\text{now}() - \text{mulai\_pada}}{60}\right)$$

### 4.29 Standardized Skeleton Loader Engine v1.6.3 di Seluruh Tab Kasir
- **Deskripsi**: Standarisasi transisi pemuatan data menggunakan placeholder skeleton statis bernuansa gelap (tanpa animasi) di seluruh 31 tab view antarmuka kasir.
- **Engine Terpusat**: [`app/static/js/kasir/core/skeleton.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/skeleton.js).
- **Metode Pembantu**:
  - `Skeleton.renderTableSkeleton(tbody, cols, rows)`: Skeleton baris tabel tabular.
  - `Skeleton.renderCardSkeleton(container, count)`: Skeleton kartu grid.
  - `Skeleton.renderDetailSkeleton(container)`: Skeleton formulir/modal detail.
- **Cakupan 31 tab view**: Dashboard PC, POS Kantin, Manajemen Member, Paket Billing, Hardware Checker, Process Monitor, Shift Kasir, Log Mutasi Stok, Audit Log, Blackout Recovery, Tournament, Mikrotik, Tutorial CMS, Backup, dll.
- **Zero-Slop UI**: Mengeliminasi seluruh spinner berputar usang (`fa-spin`, `animate-spin`) demi pengalaman pengguna yang mulus dan elegan.

### 4.30 In-Place Reactive Rerender & Zero Page Reload Engine
- **Deskripsi**: Mekanisme pembaruan UI dashboard secara reaktif di tempat tanpa melakukan `location.reload()` browser secara penuh saat terjadi perubahan struktur PC.
- **Deteksi Struktur (`_hasStructureChanged`)**: Membandingkan jumlah PC, ID PC, nama unit, dan koordinat denah untuk menentukan apakah denah perlu dibangun ulang atau cukup memperbarui status indikator live.
- **Keuntungan**: Mencegah kedipan layar (*screen flicker*), mempertahankan state input kasir, dan menghemat konsumsi bandwidth lokal.

### 4.31 Zero-Config Security & Credential Bootstrap Architecture
- **Filosofi**: Memberikan perlindungan keamanan maksimal pada instalasi warnet baru secara *out-of-the-box* tanpa menuntut keahlian konfigurasi rumit dari operator.
- **Auto-Generated Persistent `SECRET_KEY`**:
  - Saat startup pertama, jika `.env` belum memiliki `SECRET_KEY` atau masih menggunakan nilai insecure default, sistem otomatis meng-generate string heksadesimal acak 64-karakter menggunakan `secrets.token_hex(32)`.
  - Kunci ini langsung ditulis persisten ke berkas `.env` lokal untuk menjamin integritas sesi cookie kasir.
- **Superadmin Password Randomizer & Root Storage**:
  - Pada pembuatan database awal (tabel `user` kosong), sistem meng-generate password acak 12-karakter alfanumerik unik via `secrets.choice()`.
  - Kredensial dicetak ke terminal dan disimpan ke berkas satu-kali-pakai `initial_admin.txt` di root direktori.
  - Berkas `initial_admin.txt` otomatis dilindungi oleh `.gitignore` agar tidak sengaja ter-commit ke repositori publik.
  - Operator diarahkan untuk mengganti password di menu **Manajemen Staff > Akun Kasir & Admin**.
- **Bootstrap Skema & Seed Terkontrol**:
  - `bootstrap_app_data(app)` menjalankan seed pengaturan/whitelist/tutorial dan bootstrap superadmin hanya setelah tabel `user` tersedia.
  - Factory hanya memanggil `db.create_all()` bila database benar-benar baru (belum ada tabel `user` maupun `alembic_version`); database yang sudah ber-`alembic_version` tidak disentuh factory dan wajib melalui `run_migration.py`, sehingga upgrade legacy tidak bentrok dengan tabel yang sudah ada.
  - `install_scripts/init_db.py` memanggil `db.create_all()` + `bootstrap_app_data()` untuk instalasi awal.
- **Dynamic Random VNC Password**:
  - Pengaturan password VNC otomatis di-generate acak 8 karakter (`secrets.token_urlsafe(8)`) saat pertama kali diakses jika belum disetel di tabel database settings.
- **Anti-SSRF Protection & Active Session Guard**:
  - Endpoint updater `/api/v1/kasir/settings/migration/update_github` membatasi domain unduhan secara ketat hanya pada domain resmi GitHub (`https://github.com/milanalfandiismail/` dan `https://objects.githubusercontent.com/`).
  - Indikator pembaruan mendeteksi jumlah sesi bermain aktif (`status="aktif"`) sebelum proses update dijalankan.

---

## 5. Panduan Teknis Backend (Flask & Python)

### 5.1 Daftar Blueprint & Routing
Backend TMBilling terbagi ke dalam **34 Blueprint** modular di `app/routes/`:
- `auth_routes.py` & `auth_kasir_routes.py`: Manajemen autentikasi login session kasir dan administrator.
- `backup_routes.py`: Endpoint pemicu backup database, download backup `.db`, dan restore database.
- `blackout_routes.py`: Handler deteksi pemadaman listrik dan pemulihan sesi pelanggan.
- `client_routes.py`: Komunikasi IPC dan heartbeat agent klien warnet.
- `dashboard_routes.py`: API penyedia data statistik ringkas dashboard kasir.
- `game_kasir_routes.py` & `game_public_routes.py`: Manajemen katalog game dan katalog publik; ikon menolak `.svg` dan disimpan di `current_app.static_folder/uploads/games`.
- `grup_routes.py`: CRUD grup kategori ruangan / tarif.
- `uptime_routes.py`: Pemantauan uptime PC, riwayat hardware baseline, dan penghapusan log.
- `maintenance_routes.py`: Pengelolaan tiket pemeliharaan dan pelaporan kendala.
- `member_routes.py` & `member_portal_routes.py`: Manajemen akun member, isi saldo, dan portal member.
- `menu_routes.py`: Manajemen produk F&B kantin, pesanan, mutasi stok, dan cetak struk thermal.
- `mikrotik_routes.py`: Konfigurasi RouterOS API dan manajemen queue bandwidth.
- `monitor_routes.py`: Monitoring PC klien, live screenshot, process manager, dan aksi batch `remote-batch`.
- `note_routes.py`: Scratchpad catatan kasir dan memo handover shift.
- `paket_routes.py`: Manajemen paket jam/malam billing.
- `pc_routes.py`: CRUD PC, alamat IP, MAC address, dan koordinat denah floor plan.
- `tv_public_routes.py`: Penyedia data halaman TV display lobi.
- `report_routes.py`: Generator laporan keuangan harian, laporan billing, kantin, dan shift kasir.
- `server_monitor_routes.py`: Monitoring performa CPU, RAM, and storage server billing serta service LHM.
- `sesi_routes.py`: Siklus hidup sesi billing (buka sesi, tambah waktu, pindah PC, stop sesi).
- `settings_routes.py`, `migration_routes.py`: Konfigurasi global, IP Whitelist, dan Cloudflare.
- `shift_routes.py`: Manajemen shift kasir, kas awal, dan rekonsiliasi kas akhir.
- `tournament_routes.py`: Manajemen turnamen eSports dan bagan pertandingan.
- `tutorial_routes.py`: CMS artikel panduan dan upload gambar editor.
- `user_routes.py`: Manajemen pengguna sistem dan audit log.
- `vnc_routes.py`: Kontrol HTTP start/stop/status proxy VNC; kanal WebSocket RFB ditangani Websockify.

### 5.2 Service Layer & Pola Arsitektur
Logika bisnis diisolasi secara ketat dalam 36 class di `app/services/`. Blueprint routes hanya bertugas memvalidasi request HTTP dan mengembalikan response JSON, sedangkan eksekusi aturan bisnis dilakukan oleh service:
- `blackout_service.py`: Logika toleransi pemadaman listrik dan pemulihan sesi.
- `vnc_service.py`: Menangani komunikasi low-level dengan klien.
- `sesi_service.py`: Menangani perhitungan tarif per detik, sisa waktu, pembersihan kadaluwarsa, dan promo paket.
- `hardware_service.py`: Menangani kalkulasi baseline mismatch, pemisahan Mobo Model vs Mobo Serial, dan jendela waktu CCTV.
- `dashboard_service.py`: Agregator status real-time PC, server metrics, dan billing quick summary.

### 5.3 Skema Database & 24 Model SQLAlchemy
TMBilling menggunakan 24 model ORM terdefinisi di `app/models/`:
1. `User`: Akun pengguna dashboard kasir/admin (`id`, `username`, `password_hash`, `role`, `status`).
2. `PC`: Data unit PC klien (`id`, `nama_pc`, `ip_address`, `mac_address`, `grup_id`, `pos_x`, `pos_y`, `status_pc`).
3. `Sesi`: Sesi penggunaan PC (`id`, `tipe`, `member_id`, `user_id`, `pc_id`, `paket_id`, `nama_guest`, `token_sesi`, `mulai_pada`, `selesai_pada`, `durasi_beli_menit`, `total_bayar`, `status`, `is_admin`, `waktu_mulai_sesi`, `waktu_tersimpan_awal`, `last_sync`, `menit_pause_total`, `sisa_menit_saat_mati`, `is_blackout_suspect`, `is_blackout_resolved`, `waktu_resolved`, `is_afk`, `afk_pin`, `afk_sejak`, `sesi_asal_id`).
   - *`user_id`*: FK ke `User` untuk sesi kasir/staf benefit (nullable).
   - *`sesi_asal_id`*: FK self-referential ke `Sesi.id` untuk pelacakan rantai sesi akibat pindah PC.
4. `Transaksi`: Data transaksi pembayaran billing (`id`, `sesi_id`, `total_bayar`, `metode_pembayaran`, `kasir_id`, `created_at`).
5. `Member`: Data pelanggan member (`id`, `username`, `password_hash`, `saldo`, `total_jam_main`, `status`).
6. `Paket`: Paket tarif billing (`id`, `nama_paket`, `durasi_jam`, `harga`, `grup_id`, `unlimited_stock`).
7. `Grup`: Kategori ruangan/tarif (`id`, `nama_grup`, `tarif_per_jam`, `deskripsi`).
8. `MenuItem`: Katalog produk kantin/FnB (`id`, `nama`, `harga`, `stok`, `is_active`, `gambar_path`).
9. `TransaksiMenu`: Transaksi pesanan kantin (`id`, `no_nota`, `menu_id`, `jumlah`, `total_harga`, `pc_kode`, `tanggal`, `kasir_id`, `tunai`, `kembalian`, `metode_pembayaran`, `operator`).
10. `MenuStockLog`: Catatan audit riwayat mutasi stok menu (`id`, `menu_id`, `perubahan`, `stok_sebelum`, `stok_sesudah`, `jenis`, `keterangan`, `operator`, `created_at`).
11. `ShiftRecord`: Rekam shift kasir & rekonsiliasi hitung buta (`id`, `kasir_id`, `waktu_mulai`, `waktu_selesai`, `modal_awal`, `total_billing`, `total_kantin`, `total_qris`, `total_refund`, `uang_fisik`, `selisih`, `catatan`, `status`, `detail_metode_json`).
12. `HardwareMonitor`: Snapshot baseline hardware PC dan monitoring real-time (`id`, `pc_id`, `cpu_usage`, `cpu_temp`, `gpu_temp`, `cpu_name`, `gpu_name`, `total_ram`, `motherboard`, `nic_speed`, `active_window`, `last_update`).
    - *Audit Internal*: `hardware_baseline`, `hardware_current_specs`, `hardware_mismatch`, `hardware_mismatch_desc`, `hardware_mismatch_time`, `hardware_cctv_window`, `hardware_last_sync`.
13. `PCProcess`: Snapshot proses yang sedang berjalan di klien.
14. `PCUptimeLog`: Catatan uptime & downtime PC untuk toleransi blackout (`id`, `pc_id`, `status`, `timestamp`).
15. `SystemTutorial`: Artikel panduan CMS (`id`, `judul`, `konten_html`, `kategori`, `urutan`).
16. `MaintenanceTicket`: Tiket kerusakan perangkat (`id`, `pc_id`, `judul_masalah`, `deskripsi`, `prioritas`, `status`).
17. `Turnamen`: Data kompetisi game (`id`, `nama_turnamen`, `game`, `status`).
18. `TurnamenTahap`: Babak turnamen (Penyisihan, Semi-Final, Grand Final).
19. `TurnamenTim`: Tim peserta kompetisi.
20. `TurnamenMatch`: Jadwal & hasil pertandingan.
21. `MikroTikConfig`: Pengaturan RouterOS (`host`, `port`, `username`, `password_encrypted`).
22. `Game`: Katalog launcher game (`id`, `nama_game`, `path_executable`, `icon_url`, `kategori_id`).
23. `GameKategori`: Kategori game (FPS, MOBA, Battle Royale, RPG).
24. `Settings`: Pengaturan global key-value (nama warnet, logo, Cloudflare token, opsi thermal printer).

---

## 6. Panduan Teknis Frontend (Modular Vanilla JS & CSS)

### 6.1 Arsitektur Core JS (`core/`)
Frontend dashboard kasir dibangun tanpa dependensi framework runtime (Vanilla JS murni berstandar ES6 Modules) yang terletak di `app/static/js/kasir/`:
- `core/api.js`: Lapisan komunikasi HTTP terpadu. Berisi objek `API` dengan namespace lengkap (`API.auth`, `API.sesi`, `API.monitor`, `API.menu`, dll.). Seluruh pemanggilan fetch API memiliki penanganan error dan parsing JSON standar.
- `core/skeleton.js`: Standardized static skeleton loading generator (`renderTableSkeleton`, `renderCardSkeleton`, `renderDetailSkeleton`) yang diintegrasikan di seluruh 31 tab view.
- `core/modal.js`: Library lifecycle manajemen modal dialog (animasi slide/fade, trapping fokus keyboard, tombol `Escape` to close, backdrop dismiss).
- `core/toast.js`: Sistem notifikasi toast non-blocking (Success, Error, Warning, Info) dengan auto-dismissal.
- `core/utils.js`: Format mata uang Rupiah (`formatRupiah`), kalkulator durasi waktu jam-menit-detik, dan debounce helper.

### 6.2 Modul-Modul Fitur Kasir (`modules/`)
Terletak di `app/static/js/kasir/modules/`:
- `dashboard/dashboard_selection.js`: Mengelola logika seleksi banyak PC (multi-select) dan triggering aksi batch.
- `dashboard/dashboard_process_monitor.js`: Menangani tampilan remote task manager dan penghentian proses.
- `dashboard/dashboard_detail_modal.js`: Modal detail PC lengkap termasuk tampilan Hardware Checker & Keamanan Hardware (matriks baseline vs live telemetry, alert mismatch CCTV, status CPU/GPU/RAM/NIC).
- `dashboard/map_view.js`: Canvas 2D interaktif denah ruangan meja warnet dengan async batch save `Promise.all()` dan unmapped coordinate support.
- `hardware_checker/index.js`: Tab Hardware Checker & Audit Keamanan — merender kartu per-PC dengan status badge hardware (🛡️ Internal Aman / 🚨 Hardware Ditukar), accordion *Spesifikasi Lengkap* dengan pill tags RAM/Disk berwarna (baseline vs live), alert CCTV time window, dan indikator kecepatan NIC. Implementasi objek singleton `HardwareChecker` di `window.HardwareChecker`.
- `remote/vnc_client.js`: Handler rendering layar RFB VNC dan listener clipboard dua arah.
- `shift/index.js`: Lifecycle modul shift kasir, dialog buka/akhiri shift hitung buta, force close admin, polling status shift, dan printer struk handover thermal 58mm.
- `menu/index.js` & `menu/stock_log.js`: UI pesanan FnB kasir, modal penyesuaian/restock barang, tabel audit mutasi stok menu, dan antarmuka cetak struk kasir thermal ESC/POS.
- `struk/struk_preview.js`: Handler preview & cetak struk kasir thermal 58mm/80mm.
- `owner/analytics.js`: Visualisasi grafik analitik bisnis owner.

---

## 7. Panduan Teknis WarnetAgent (Tauri 1.5 Rust Core)

Klien warnet berlokasi di direktori `WarnetAgent/` dan terdiri dari 5 binary utama berbasis Rust serta script pendukung:

### 7.1 TMBillingTauri
- **Teknologi**: Rust + Tauri 1.5 (`WarnetAgent/TMBillingTauri/src-tauri/`).
- **UI Frontend**: HTML5/CSS murni di `WarnetAgent/TMBillingTauri/src/` (Kiosk Lockscreen, Overlay Bar, Admin Unlock Dialog).
- **Commands IPC**:
  - `lock_pc`: Mengunci layar dan mengaktifkan proteksi antarmuka.
  - `unlock_pc`: Membuka kunci desktop Windows setelah sesi dibuka di kasir.
  - `switch_to_afk`: Mengunci layar penuh ke mode AFK hitam polos dengan proteksi keyboard hook & penyembunyian taskbar.
  - `afk_lock_process` / `afk_unlock_process`: Menangani sinkronisasi status penguncian meja AFK ke backend server.
  - `play_warning_sound`: Memutar file audio WAV/MP3 peringatan sisa waktu (15m, 10m, 5m, 1m).
  - `get_hardware_info`: Mengambil serial CPU, GPU, RAM, dan Disk via Win32 WMI.
  - `vnc_bridge`: Membuka relay VNC port 5900 loopback untuk fitur remote desktop.

### 7.2 MGCTM Watchdog Daemon
- **Source**: `WarnetAgent/MGCTM/src/main.rs`.
- **Fungsi**: Service supervisor utama yang berjalan di latar belakang untuk menjaga keandalan proses klien.
- **Mekanisme**:
  1. Melakukan validasi integritas checksum binary secara berkala terhadap konfigurasi yang terdaftar.
  2. Memastikan proses antarmuka `TMBilling.exe` selalu aktif; jika proses terhenti tidak normal, `MGCTM` seketika meluncurkannya kembali.

### 7.3 mtm (Auxiliary Watchdog & Resilience Guard)
- **Source**: `WarnetAgent/mtm/src/main.rs`.
- **Fungsi**: Modul pengawas cadangan (*auxiliary supervisor*) yang memantau ketersediaan supervisor utama secara mandiri dan efisien di latar belakang.
- **Mekanisme**:
  1. **Mutual Health Check**: Memantau status proses `MGCTM` secara kontinu. Jika supervisor utama mengalami gangguan, modul ini segera mengaktifkannya kembali.
  2. **Graceful Shutdown Authentication**: Mengakomodasi penghentian layanan secara tertib hanya apabila menerima otentikasi token resmi saat proses uninstalasi/maintenance oleh pengelola warnet.

### 7.4 TMMonitor & HardwareHelper / TMLHMService
- **Source**: `WarnetAgent/TMBilling_Monitor/src/main.rs`.
- **Fungsi**: Agen telemetri hardware, sensor suhu/beban (CPU & GPU), proses aktif, screenshot capture, dan eksekusi task killer jarak jauh.
- **Mekanisme**:
  1. **Embedded Assets Auto-Extract**: Secara otomatis mengekstrak modul pustaka pendukung dari memory binary Rust untuk kebutuhan pembacaan sensor mendalam.
  2. **Hardware Telemetry**: Mengumpulkan snapshot serial motherboard, CPU ID, GPU PNP ID, RAM serials, disk serials, dan kecepatan NIC LAN secara berkala ke server billing.
     - **Nama hardware** (CPU, GPU, Motherboard) dibaca *eksklusif* dari `hardware_temp.json` yang di-generate oleh `HardwareHelper.exe` (LibreHardwareMonitor kernel driver), mengeliminasi false positive `Win32_VideoController`.
     - **Serial motherboard** dibaca via WMI `Win32_BaseBoard` menggunakan struct `BaseBoardInfo` (`SerialNumber`, `Product`, `Manufacturer`) untuk presisi identifikasi chassis anti-theft.

### 7.5 TMBilling_Uninstaller
- **Source**: `WarnetAgent/TMBilling_Uninstaller/src/main.rs`.
- **Fungsi**: Program uninstaller resmi yang aman untuk menghapus seluruh komponen layanan klien, membersihkan konfigurasi sistem, dan memulihkan pengaturan Windows hanya setelah verifikasi kredensial Administrator yang sah.

### 7.6 Deploy Scripts & Configuration
Berlokasi di direktori `WarnetAgent/Deploy/`:
- **`install.bat`**: Skrip instalasi otomatis 1-klik untuk PC klien warnet yang menyalin binary, mendaftarkan startup otomatis, konfigurasi firewall, dan menginisialisasi layanan pengawasan klien.
- **`uninstall.bat`**: Skrip peluncur uninstaller resmi (`TMBilling_Uninstaller.exe`) untuk menghapus layanan dan konfigurasi klien secara aman dan bersih.
- **`allow_firewall.bat`**: Skrip pendaftaran aturan Windows Defender Firewall untuk port 5900 dan executable TMBilling.
- **`tightvnc_settings.reg`**: Konfigurasi registry untuk layanan remote screen TightVNC Server (LoopbackOnly).

---

## 8. Spesifikasi Protokol API & VNC Bridge

### 8.1 Standar Format JSON REST API
Seluruh response REST API mengikuti struktur JSON standar:
```json
{
  "success": true,
  "message": "Operasi berhasil dieksekusi",
  "data": { ... }
}
```
Jika terjadi kegagalan:
```json
{
  "success": false,
  "error": "Pesan deskripsi kesalahan teknis"
}
```

### 8.2 Katalog Endpoint REST API (34 Blueprint)

Total Blueprint Terdaftar: **34 Blueprint** | Total dekorator route di `app/routes/`: **254 Route** (katalog per blueprint di bawah merinci endpoint utama; route dinamis/registrasi manual tidak selalu punya baris sendiri).

> Endpoint kesehatan `GET /api/health` terdaftar sebagai blueprint `health_api` (`app/routes/public/health_routes.py`), dan didaftarkan di `app/__init__.py:135`.

> **Arsip vs Hapus Permanen (PC, Paket, Member, User, Game, Grup, Menu)**: `POST .../<id>/archive` hanya menonaktifkan (`aktif = False`; menu memakai `is_active`) sehingga datanya bisa dipulihkan lewat tab **Data Diarsipkan** (`GET /api/v1/kasir/arsip/` → `POST /api/v1/kasir/<resource>/<id>/restore`). Di UI kasir, tombol arsip (ikon kotak, amber) dan hapus permanen (ikon sampah, merah) terpisah; hapus permanen menampilkan modal konfirmasi dengan satu checkbox yang wajib dicentang sebelum tombol setuju aktif. `DELETE .../<id>` menghapus permanen dan **wajib** menyertakan body `{"confirm": "<kode PC / nama paket / nama member / username / nama game>"}` - tanpa itu route membalas 400. Riwayat transaksi/sesi tidak ikut terhapus; referensinya dilepas (`paket_id`, `member_id`, `user_id`, `pc_id` menjadi NULL) di dalam `WRITE_LOCK`. Pengecualian: `DELETE /api/v1/kasir/user/<id>` tetap ditolak bila user punya riwayat shift karena `shift_record.kasir_id` NOT NULL — nonaktifkan saja.

#### 🔹 Blueprint: auth (3 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| POST | /api/v1/public/auth/login | auth.login |
| POST | /api/v1/public/auth/logout | auth.logout |
| POST | /api/v1/public/auth/status | auth.status |

#### 🔹 Blueprint: auth_kasir (4 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| POST | /api/v1/kasir/auth/admin-check | auth_kasir.admin_check |
| GET | /api/v1/kasir/auth/check | auth_kasir.check_session |
| POST | /api/v1/kasir/auth/login | auth_kasir.login |
| POST | /api/v1/kasir/auth/logout | auth_kasir.logout |

#### 🔹 Blueprint: backup (6 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| DELETE | /api/v1/kasir/backup/delete/<filename> | backup.delete_backup |
| GET | /api/v1/kasir/backup/download/<filename> | backup.download_backup |
| GET | /api/v1/kasir/backup/list | backup.list_backups |
| POST | /api/v1/kasir/backup/restore/<filename> | backup.restore_backup |
| POST | /api/v1/kasir/backup/test-connection | backup.test_connection |
| POST | /api/v1/kasir/backup/trigger | backup.trigger_backup |

#### 🔹 Blueprint: blackout (9 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| POST | /api/v1/kasir/blackout/clear | blackout.clear_audit |
| GET | /api/v1/kasir/blackout/dates | blackout.get_dates |
| POST | /api/v1/kasir/blackout/deteksi | blackout.deteksi |
| POST | /api/v1/kasir/blackout/force-all-and-detect | blackout.force_all_and_detect |
| GET | /api/v1/kasir/blackout/list | blackout.list_audit |
| POST | /api/v1/kasir/blackout/resolve/guest/lanjut/<int:sesi_id> | blackout.resolve_guest_lanjut |
| POST | /api/v1/kasir/blackout/resolve/guest/sama/<int:sesi_id> | blackout.resolve_guest_sama |
| POST | /api/v1/kasir/blackout/resolve/guest/tutup/<int:sesi_id> | blackout.resolve_guest_tutup |
| POST | /api/v1/kasir/blackout/resolve/member/<int:sesi_id> | blackout.resolve_member |


#### 🔹 Blueprint: client (9 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| POST | /api/v1/public/client/admin-login | client.admin_login |
| POST | /api/v1/public/client/emergency-login | client.emergency_login |
| POST | /api/v1/public/client/identify | client.identify |
| POST | /api/v1/public/client/selesai | client.selesai |
| POST | /api/v1/public/client/status | client.status |
| POST | /api/v1/public/client/vnc_poll | client.vnc_poll |
| POST | /api/v1/public/client/vnc_ready | client.vnc_ready |
| POST | /api/v1/public/client/vnc_stopped | client.vnc_stopped |
| GET | /api/v1/public/client/warnet | client.get_warnet_config |
> Respons memuat `qris_path` (relatif, selalu diawali `/`) dan `qris_url` (absolut) selain `title`, `announcement`, `paket`, dan `menu`.

#### 🔹 Blueprint: dashboard (3 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /kasir/ | dashboard.dashboard |
| GET | /kasir/documentation | dashboard.documentation |
| GET | /kasir/login | dashboard.login_page |

#### 🔹 Blueprint: dashboard_api (3 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/dashboard/analytics | dashboard_api.analytics_data |
| GET | /api/v1/kasir/dashboard/pc | dashboard_api.list_pc_api |
| GET | /api/v1/kasir/dashboard/server-metrics | dashboard_api.server_metrics_api |

#### 🔹 Blueprint: game_kasir (7 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/game/ | game_kasir.list_games |
| POST | /api/v1/kasir/game/ | game_kasir.tambah_game |
| POST | /api/v1/kasir/game/<int:game_id>/archive | game_kasir.arsip_game |
| DELETE | /api/v1/kasir/game/<int:game_id> | game_kasir.hapus_game |
| POST, PUT | /api/v1/kasir/game/<int:game_id> | game_kasir.edit_game |
| GET | /api/v1/kasir/game/kategori | game_kasir.list_kategori |
| POST | /api/v1/kasir/game/kategori | game_kasir.tambah_kategori |
| DELETE | /api/v1/kasir/game/kategori/<int:kategori_id> | game_kasir.hapus_kategori |

#### 🔹 Blueprint: game_public (2 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/public/game/all | game_public.get_public_games |
| GET | /api/v1/public/game/kategori | game_public.get_public_kategori |

#### 🔹 Blueprint: global (10 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | / | index |
| GET | /games | public_games |
| GET | /livepc | public_pc_map |
| GET | /paket | public_packages |
| GET | /spesifikasi | public_specs |
| GET | /static/<path:filename> | static |
| GET | /tv | public_tv_static |
| GET | /tv-static | public_tv_static |
| GET | /tv/dynamic | public_tv_dynamic |
| GET | /tv/static | public_tv_static |

> `/spesifikasi` hanya menyajikan PC aktif (`pc.aktif=True`) dan status online diambil dari heartbeat `OnlineStatusStore` (timeout 45 detik), bukan flag arsip PC.

#### 🔹 Blueprint: grup (6 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/grup/ | grup.list_grup |
| POST | /api/v1/kasir/grup/ | grup.tambah_grup |
| DELETE | /api/v1/kasir/grup/<int:grup_id> | grup.hapus_grup |
| PUT | /api/v1/kasir/grup/<int:grup_id> | grup.update_grup |
| POST | /api/v1/kasir/grup/<int:grup_id>/archive | grup.arsipkan_grup |
| POST | /api/v1/kasir/grup/<int:grup_id>/restore | grup.pulihkan_grup |

#### 🔹 Blueprint: arsip (1 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/arsip/ | arsip_api.daftar_arsip |

> `GET /api/v1/kasir/arsip/` mengagregasi seluruh data terarsip (grup, pc, paket, member, user, game, menu) untuk tab **Data Diarsipkan**. Tab itu menampilkan satu kategori sekaligus lewat pill horizontal (`#arsip-pills`), bukan tumpukan seksi. Setiap tab sumber (grup, PC, paket, member, user, game) dan katalog FnB juga punya pill `Aktif | Diarsipkan` sehingga data terarsip tetap terlihat di tab asalnya. Baris arsip di kedua jalur dirender oleh modul bersama `app/static/js/kasir/core/arsip_list.js` (`ArsipList.rows`), dengan tombol Pulihkan dan Hapus Permanen. Pemulihan memakai `POST /api/v1/kasir/<resource>/<id>/restore`; grup memperoleh kolom `aktif` lewat migrasi `a1b2c3d4e5f6`.

#### 🔹 Blueprint: maintenance (6 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| DELETE | /api/v1/kasir/maintenance/<int:ticket_id> | maintenance.delete_ticket |
| PUT | /api/v1/kasir/maintenance/<int:ticket_id>/status | maintenance.update_status |
| POST | /api/v1/kasir/maintenance/create | maintenance.create_ticket |
| GET | /api/v1/kasir/maintenance/export | maintenance.export_report |
| GET | /api/v1/kasir/maintenance/list | maintenance.list_tickets |
| GET | /api/v1/kasir/maintenance/report | maintenance.get_report |

#### 🔹 Blueprint: member (8 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/member/ | member.list_member |
| POST | /api/v1/kasir/member/ | member.tambah_member |
| POST | /api/v1/kasir/member/<int:member_id>/archive | member.archive_member |
| DELETE | /api/v1/kasir/member/<int:member_id> | member.delete_member |
| GET | /api/v1/kasir/member/<int:member_id> | member.get_member_detail |
| PUT | /api/v1/kasir/member/<int:member_id> | member.edit_member |
| GET | /api/v1/kasir/member/<int:member_id>/paket | member.get_riwayat_paket |
| POST | /api/v1/kasir/member/refund-paket | member.refund_paket |
| POST | /api/v1/kasir/member/tambah-waktu | member.tambah_waktu |

#### 🔹 Blueprint: member_portal (7 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /member | member_portal.dashboard_page |
| GET | /member/dashboard | member_portal.dashboard_page |
| GET | /member/login | member_portal.login_page |
| POST | /member/login | member_portal.login_action |
| POST | /member/logout | member_portal.logout_action |
| POST | /member/profile/update | member_portal.update_profile_action |
| GET | /pc-status | member_portal.public_pc_status |

#### 🔹 Blueprint: menu (9 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/menu/ | menu.get_menu_list |
| POST | /api/v1/kasir/menu/ | menu.create_menu_item |
| DELETE | /api/v1/kasir/menu/<int:menu_id> | menu.delete_menu_item |
| PUT | /api/v1/kasir/menu/<int:menu_id> | menu.update_menu_item |
| DELETE | /api/v1/kasir/menu/<int:menu_id>/permanent | menu.hard_delete_menu_item |
| POST | /api/v1/kasir/menu/<int:menu_id>/restore | menu.restore_menu_item |
| GET | /api/v1/kasir/menu/archived | menu.get_archived_menu_list |
| POST | /api/v1/kasir/menu/checkout | menu.checkout_order |
| GET | /api/v1/kasir/menu/transaksi | menu.get_all_transactions |

#### 🔹 Blueprint: migration (2 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/settings/migration/status | migration.get_migration_status |
| POST | /api/v1/kasir/settings/migration/upload | migration.upload_update |

#### 🔹 Blueprint: mikrotik (4 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/mikrotik/config | mikrotik.get_mikrotik_config |
| POST | /api/v1/kasir/mikrotik/config | mikrotik.save_mikrotik_config |
| POST | /api/v1/kasir/mikrotik/sync_all | mikrotik.sync_all_mikrotik_members |
| POST | /api/v1/kasir/mikrotik/test | mikrotik.test_mikrotik_connection |

#### 🔹 Blueprint: monitor (6 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| POST | /api/v1/public/monitor/ | monitor.receive_hardware_data |
| DELETE | /api/v1/public/monitor/<int:hardware_id> | monitor.delete_hardware_data |
| GET | /api/v1/public/monitor/all | monitor.get_all_hardware |
| GET | /api/v1/public/monitor/processes/<int:pc_id> | monitor.get_pc_processes |
| POST | /api/v1/public/monitor/processes/<int:pc_id>/kill | monitor.kill_pc_process |
| POST | /api/v1/public/monitor/screenshot/upload | monitor.upload_screenshot |

#### 🔹 Blueprint: monitor_kasir (15 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| DELETE | /api/v1/kasir/monitor/<int:hardware_id> | monitor_kasir.delete_hardware_data_kasir |
| GET | /api/v1/kasir/monitor/all | monitor_kasir.get_all_hardware_kasir |
| GET | /api/v1/kasir/monitor/hardware/<int:pc_id> | monitor_kasir.get_hardware_by_pc |
| GET | /api/v1/kasir/monitor/processes/<int:pc_id> | monitor_kasir.get_pc_processes_kasir |
| POST | /api/v1/kasir/monitor/processes/<int:pc_id>/kill | monitor_kasir.kill_pc_process_kasir |
| POST | /api/v1/kasir/monitor/register/<int:pc_id> | monitor_kasir.register_pc_hardware |
| POST | /api/v1/kasir/monitor/remote/<int:pc_id>/<string:action> | monitor_kasir.trigger_remote_action |
| POST | /api/v1/kasir/monitor/remote/batch | monitor_kasir.trigger_remote_action_batch |
| GET | /api/v1/kasir/monitor/screenshot/all | monitor_kasir.get_all_screenshot_status |
| GET | /api/v1/kasir/monitor/screenshot/image/<int:pc_id> | monitor_kasir.get_screenshot_image |
| GET | /api/v1/kasir/monitor/screenshot/status/<int:pc_id> | monitor_kasir.get_screenshot_status |
| POST | /api/v1/kasir/monitor/screenshot/trigger/<int:pc_id> | monitor_kasir.trigger_screenshot |
| POST | /api/v1/kasir/monitor/vnc_client/<int:pc_id>/start | monitor_kasir.start_vnc_client |
| GET | /api/v1/kasir/monitor/vnc_client/<int:pc_id>/status | monitor_kasir.status_vnc_client |
| POST | /api/v1/kasir/monitor/vnc_client/<int:pc_id>/stop | monitor_kasir.stop_vnc_client |

#### 🔹 Blueprint: notes_api (8 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/notes | notes_api.list_notes |
| POST | /api/v1/kasir/notes | notes_api.create_note |
| DELETE | /api/v1/kasir/notes/<filename> | notes_api.delete_note |
| GET | /api/v1/kasir/notes/<filename> | notes_api.get_note |
| PUT | /api/v1/kasir/notes/<filename> | notes_api.save_note |
| GET | /api/v1/kasir/notes/<filename>/download | notes_api.download_note |
| POST | /api/v1/kasir/notes/<filename>/duplicate | notes_api.duplicate_note |
| POST | /api/v1/kasir/notes/<filename>/pin | notes_api.toggle_pin_note |

#### 🔹 Blueprint: paket (4 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/paket/ | paket.list_paket |
| POST | /api/v1/kasir/paket/ | paket.tambah_paket |
| POST | /api/v1/kasir/paket/<int:paket_id>/archive | paket.arsipkan_paket |
| DELETE | /api/v1/kasir/paket/<int:paket_id> | paket.hapus_paket |
| PUT | /api/v1/kasir/paket/<int:paket_id> | paket.edit_paket |

#### 🔹 Blueprint: pc (8 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/pc/ | pc.list_pc |
| POST | /api/v1/kasir/pc/ | pc.tambah_pc |
| POST | /api/v1/kasir/pc/<int:pc_id>/archive | pc.arsipkan_pc |
| DELETE | /api/v1/kasir/pc/<int:pc_id> | pc.hapus_pc |
| PUT | /api/v1/kasir/pc/<int:pc_id> | pc.edit_pc |
| PUT | /api/v1/kasir/pc/<int:pc_id>/position | pc.update_pc_position |
| POST | /api/v1/kasir/pc/batch | pc.tambah_batch |
| POST | /api/v1/kasir/pc/reset-admin/<int:pc_id> | pc.reset_admin |
| POST | /api/v1/kasir/pc/wol | pc.wol_pc |

#### 🔹 Blueprint: report (18 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/report/blackout-log | report.blackout_log |
| GET | /api/v1/kasir/report/export/audit-pdf | report.export_audit_pdf |
| GET | /api/v1/kasir/report/export/billing | report.export_billing |
| GET | /api/v1/kasir/report/export/kantin | report.export_kantin |
| GET | /api/v1/kasir/report/export/pnl | report.export_pnl |
| GET | /api/v1/kasir/report/kasir-list | report.get_kasir_list |
| GET | /api/v1/kasir/report/laporan-harian | report.laporan_harian |
| GET | /api/v1/kasir/report/laporan/billing | report.get_laporan |
| GET | /api/v1/kasir/report/laporan/kantin | report.get_laporan_kantin |
| GET | /api/v1/kasir/report/log | report.get_logs |
| POST | /api/v1/kasir/report/log/clear | report.clear_logs_endpoint |
| GET | /api/v1/kasir/report/log/export | report.export_logs |
| GET | /api/v1/kasir/report/struk/<identifier> | report.get_struk |
| GET | /api/v1/kasir/report/struk/menu/<int:t_menu_id> | report.get_struk_menu |
| GET | /api/v1/kasir/report/tanggal | report.get_tanggal_list |
| DELETE | /api/v1/kasir/report/transaksi/<int:t_id> | report.delete_transaction_endpoint |
| DELETE | /api/v1/kasir/report/transaksi/by-date/<string:tanggal> | report.clear_date_transactions_endpoint |
| POST | /api/v1/kasir/report/transaksi/clear | report.clear_transactions_endpoint |

#### 🔹 Blueprint: server_monitor_api (4 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/server-monitor | server_monitor_api.get_metrics |
| POST | /api/v1/kasir/server-monitor/lhm/start | server_monitor_api.start_lhm_service |
| GET | /api/v1/kasir/server-monitor/lhm/status | server_monitor_api.status_lhm_service |
| POST | /api/v1/kasir/server-monitor/lhm/stop | server_monitor_api.stop_lhm_service |

#### 🔹 Blueprint: sesi (11 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/sesi/<int:sesi_id> | sesi.get_sesi |
| GET | /api/v1/kasir/sesi/<int:sesi_id>/riwayat-paket | sesi.get_riwayat_paket |
| POST | /api/v1/kasir/sesi/buka-guest | sesi.buka_guest |
| POST | /api/v1/kasir/sesi/buka-guest-batch | sesi.buka_guest_batch |
| POST | /api/v1/kasir/sesi/buka-member | sesi.buka_member |
| POST | /api/v1/kasir/sesi/pindah-pc/<int:sesi_id> | sesi.pindah_pc |
| POST | /api/v1/kasir/sesi/refund-paket | sesi.refund_paket |
| POST | /api/v1/kasir/sesi/tambah-waktu-batch | sesi.tambah_waktu_batch |
| POST | /api/v1/kasir/sesi/tambah-waktu-sesi/<int:sesi_id> | sesi.tambah_waktu_sesi |
| POST | /api/v1/kasir/sesi/tutup-batch | sesi.tutup_sesi_batch |
| POST | /api/v1/kasir/sesi/tutup/<int:sesi_id> | sesi.tutup_sesi |

#### 🔹 Blueprint: settings (22 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/settings/ | settings.get_all_settings |
| GET, PUT | /api/v1/kasir/settings/<key> | settings.handle_setting |
| PUT | /api/v1/kasir/settings/apikey | settings.update_client_api_key |
| POST | /api/v1/kasir/settings/app-public-url | settings.set_app_public_url |
| PUT | /api/v1/kasir/settings/auto-shutdown | settings.update_auto_shutdown |
| GET | /api/v1/kasir/settings/backup/download | settings.download_db |
| POST | /api/v1/kasir/settings/backup/manual | settings.trigger_manual_backup |
| POST | /api/v1/kasir/settings/cloudflare-tunnel/save-token | settings.cloudflare_tunnel_save_token |
| GET | /api/v1/kasir/settings/cloudflare-tunnel/status | settings.cloudflare_tunnel_status |
| POST | /api/v1/kasir/settings/cloudflare-tunnel/toggle | settings.cloudflare_tunnel_toggle |
| POST | /api/v1/kasir/settings/database/purge-and-vacuum | settings.purge_and_vacuum_database |
| GET | /api/v1/kasir/settings/ip-whitelist | settings.list_ip_whitelist |
| POST | /api/v1/kasir/settings/ip-whitelist | settings.add_whitelist_ip |
| DELETE | /api/v1/kasir/settings/ip-whitelist/<ip> | settings.remove_whitelist_ip |
| POST | /api/v1/kasir/settings/ip-whitelist/regenerate-token | settings.regenerate_whitelist_token |
| GET | /api/v1/kasir/settings/ip-whitelist/status | settings.status_whitelist |
| POST | /api/v1/kasir/settings/ip-whitelist/toggle | settings.toggle_whitelist |
| POST | /api/v1/kasir/settings/qris | settings.upload_qris |
| PUT | /api/v1/kasir/settings/scheduler | settings.update_scheduler_config |
| POST | /api/v1/kasir/settings/scheduler/restart | settings.restart_scheduler |
| PUT | /api/v1/kasir/settings/timezone | settings.update_timezone |
| GET | /api/v1/kasir/settings/uninstall-token/client | settings.get_uninstall_token_for_client |

> Catatan keamanan: `/uninstall-token/client` hanya memerlukan `X-Client-Key`, menentukan PC dari IP koneksi peer, dan kini **hanya** mengembalikan `uninstall_token` (token darurat server tidak lagi dibagikan ke client). `client_api_key` hanya dapat diubah lewat `/api/v1/kasir/settings/apikey`; handler setting generik menolak key tersebut dan hanya menerima prefix `warnet_`/`backup_`/`tv_`/`qris_`/`mikrotik_`/`screenshot_` serta `payment_methods`. Login darurat `POST /api/v1/public/client/emergency-login` diterima bila token server valid **atau** IP koneksi peer sama dengan `ip_address` PC terdaftar. Identitas client memakai IP koneksi; `ip_address` di body hanya boleh berbeda bila request datang dari loopback.

#### 🔹 Blueprint: shift (5 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/shift/active | shift.get_active_shift |
| POST | /api/v1/kasir/shift/end | shift.end_shift |
| GET | /api/v1/kasir/shift/history | shift.get_shift_history |
| POST | /api/v1/kasir/shift/start | shift.start_shift |
| GET | /api/v1/kasir/shift/summary | shift.get_shift_summary |

#### 🔹 Blueprint: tournament (7 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/tournament/ | tournament.list_tournament |
| POST | /api/v1/kasir/tournament/ | tournament.create_tournament |
| DELETE | /api/v1/kasir/tournament/<int:t_id> | tournament.delete_tournament |
| GET | /api/v1/kasir/tournament/<int:t_id> | tournament.get_tournament |
| POST | /api/v1/kasir/tournament/<int:t_id>/swiss/next | tournament.next_swiss_round |
| POST | /api/v1/kasir/tournament/match/<int:match_id>/skor | tournament.update_match_skor |
| POST | /api/v1/kasir/tournament/stage/<int:stage_id>/finish | tournament.finish_stage |

#### 🔹 Blueprint: tutorial (9 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/tutorials/ | tutorial.get_tutorials |
| POST | /api/v1/kasir/tutorials/ | tutorial.create_tutorial |
| DELETE | /api/v1/kasir/tutorials/<int:tutorial_id> | tutorial.delete_tutorial |
| PUT | /api/v1/kasir/tutorials/<int:tutorial_id> | tutorial.update_tutorial |
| GET | /api/v1/kasir/tutorials/categories | tutorial.get_categories |
| DELETE | /api/v1/kasir/tutorials/categories/<path:category_name> | tutorial.delete_category |
| POST | /api/v1/kasir/tutorials/cleanup-temp | tutorial.cleanup_temp_images |
| POST | /api/v1/kasir/tutorials/export-json | tutorial.export_tutorials_json |
| POST | /api/v1/kasir/tutorials/upload-image | tutorial.upload_tutorial_image |

#### 🔹 Blueprint: tv_public_api (1 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/public/tv/data | tv_public_api.get_tv_data |

#### 🔹 Blueprint: uptime_api (2 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/uptime/daily | uptime_api.get_daily_uptime |
| GET | /api/v1/kasir/uptime/range | uptime_api.get_range_uptime |

#### 🔹 Blueprint: user (5 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/user/ | user.get_all_users |
| POST | /api/v1/kasir/user/ | user.create_user |
| POST | /api/v1/kasir/user/<int:user_id>/archive | user.archive_user |
| DELETE | /api/v1/kasir/user/<int:user_id> | user.delete_user |
| GET | /api/v1/kasir/user/<int:user_id> | user.get_user |
| PUT | /api/v1/kasir/user/<int:user_id> | user.update_user |

#### 🔹 Blueprint: vnc (5 Endpoint)
| Method | Endpoint URL | Handler Endpoint |
| :--- | :--- | :--- |
| GET | /api/v1/kasir/vnc/client/<int:pc_id>/status | vnc.status_vnc_client_route |
| POST | /api/v1/kasir/vnc/client/<int:pc_id>/start | vnc.start_vnc_client_route |
| POST | /api/v1/kasir/vnc/client/<int:pc_id>/stop | vnc.stop_vnc_client_route |
| POST | /api/v1/kasir/vnc/start | vnc.start_vnc_proxy |
| GET | /api/v1/kasir/vnc/status | vnc.get_vnc_status |

### 8.3 Protokol VNC Bridge (WebSocket)
- **VNC Proxy Stream (Websockify)**:
  - HTTP lokal: `ws://<host>:8081/?token=<token>`
  - HTTPS (di balik reverse proxy): `wss://<host>/ws/vnc?token=<token>`
  - URL dibentuk oleh `resolveWebSocketUrl()` di `vnc_client.js`; tidak memakai path `<pc_id>`.
  - Meneruskan data binary byte array frame RFB (Remote FrameBuffer).
  - Meneruskan event keyboard & mouse kasir ke PC klien.
  - Bi-directional clipboard text synchronization.
- **Telemetry & Live Monitor Stream**: HTTP polling (bukan WebSocket)
  - Dashboard memakai polling HTTP ke endpoint dashboard/client; tidak ada WebSocket telemetry.

---

## 9. Panduan Operasional Kasir & Troubleshooting

### 9.1 Alur Kerja Kasir Harian
1. **Login Kasir**:
   - Login menggunakan akun kasir yang telah terdaftar di sistem.
   - Pastikan koneksi status server dan PC klien pada dashboard menunjukkan status normal.
2. **Transaksi Pelanggan**:
   - *Buka Sesi*: Klik card PC yang kosong di dashboard atau gunakan denah Floor Plan -> Pilih opsi Personal / Member / Paket Jam -> Sesi PC klien otomatis terbuka.
   - *Pesanan FnB*: Buka tab Kantin -> Pilih menu makanan/minuman -> Pilih metode pembayaran (Tunai/QRIS) atau centang *Bebankan ke PC*.
3. **Pergantian Operator / Log Out**:
   - Operator dapat langsung melakukan log out dari menu profil di kanan atas saat jam kerja selesai.
   - Gunakan tab **Catatan Kasir** untuk meninggalkan memo handover kepada operator berikutnya jika terdapat hal operasional yang perlu diperhatikan.

### 9.2 Panduan Troubleshooting Masalah Umum
- **Kasus Mati Lampu (Blackout)**:
  - *Penanganan*: Jangan matikan server billing. Saat listrik menyala kembali dan PC klien menyala, server otomatis memulihkan durasi sisa seluruh PC.
- **PC Klien Tidak Merespon (Hang)**:
  - *Penanganan*: Gunakan menu **Process Monitor** dari dashboard kasir untuk menghentikan program yang not-responding, atau klik **Restart PC** via menu Remote.
- **Layar Remote VNC Blank / Hitam**:
  - *Penanganan*: Pastikan file `allow_firewall.bat` sudah dijalankan di PC klien dan service TightVNC berjalan pada port 5900.

### 9.3 Update Server: Otomatis, `update.bat`, dan Manual Total

Semua jalur update server bermuara ke `install_scripts/updater.bat`, sehingga pengamanannya sama:

| Metode | Perintah / Lokasi | Penanganan |
|---|---|---|
| GitHub 1-Klik | Dashboard > Pengaturan > Migrasi & Update | `updater.bat`, otomatis |
| Upload ZIP | Dashboard > Pengaturan > Migrasi & Update | `updater.bat`, otomatis |
| `update.bat` | `update.bat TMBilling_Server_v<versi>.zip` atau drag-and-drop ZIP | `updater.bat`, semi-manual |
| Manual total | Langkah 1–8 di bawah | Dikerjakan sendiri |

`updater.bat` melakukan: preflight Python 3.11+, mengambil klaim pembaruan tunggal lintas-proses (`install_scripts/update_claim.py claim`, lock `instance/update.lock`; bila klaim dipegang proses lain — misalnya route dashboard yang baru memulai update — runner berhenti dengan pesan "Pembaruan lain sedang berjalan"), memulihkan penukaran berkas yang terputus sebelumnya (`recover_interrupted_swap()` pada `install_scripts/extract_update.py` membaca `instance/update_journal.json` dan mengembalikan tiap entri dari `instance/rollback_<timestamp>`), menghentikan proses server (background `pythonw`, proses `run.py`, dan pemilik port 7015), membatalkan tanpa mengubah berkas bila port masih hidup, backup database via SQLite Online Backup API, ekstraksi ZIP ke `instance/staging_update`, penyalinan screenshot lama `app/static/uploads/screenshots` ke staging (gagal salin = batal sebelum pohon live disentuh), penukaran berkas per entri top-level dengan `os.replace` yang niatnya sudah ditulis ke jurnal **sebelum** replace (sehingga proses yang mati tepat setelah replace tetap dipulihkan), `"%TM_PY%" -m pip install -r requirements.txt --quiet` **tanpa syarat** (wajib, tidak bergantung pada keberadaan `pip.exe` di `.venv`), migrasi, lalu start ulang. Klaim selalu dilepas di label `:done`. Bila backup/ekstraksi/penukaran gagal, server dinyalakan kembali, berkas live di-rollback, dan ZIP dipertahankan di `instance/temp_update.zip`. Bila `pip install` atau migrasi gagal, updater berhenti di label `:fail` dengan exit code `1` dan **tidak** menyalakan server; perbaiki penyebabnya lalu jalankan `start.bat`, atau rollback sesuai prosedur di bawah.

Endpoint dashboard (GitHub 1-Klik maupun Upload ZIP) juga memakai klaim yang sama: unduhan ditulis ke `instance/temp_update.zip.pending` lalu dipublikasikan atomik dengan `os.replace` hanya setelah ZIP valid, dan permintaan update kedua saat klaim masih dipegang dibalas `409` tanpa menyentuh paket pertama. Jalur `update.bat` (CLI/drag-and-drop) memakai klaim yang sama: klaim diambil **sebelum** ZIP disalin ke `instance/temp_update.zip`, sehingga drag-and-drop saat update otomatis berjalan ditolak tanpa menimpa paket yang sedang dipakai.

**Prosedur manual total (tanpa `update.bat`):**

1. Pastikan Python 3.11+:
   ```cmd
   .venv\Scripts\python.exe -c "import sys; print(sys.version)"
   ```
2. Hentikan server dan verifikasi port:
   ```cmd
   stop.bat
   netstat -ano | findstr :7015
   ```
   Tidak boleh ada `LISTENING`. Jika masih ada, hentikan PID tersebut lewat Task Manager.
3. Cadangkan database dan konfigurasi:
   ```cmd
   .venv\Scripts\python.exe -c "import sqlite3,os; os.makedirs('backups',exist_ok=True); s=sqlite3.connect(r'instance\warnet.db'); d=sqlite3.connect(r'backups\manual_pre_update.db'); s.backup(d); s.close(); d.close()"
   copy .env .env.bak
   ```
4. Ekstrak ZIP rilis dan timpa berkas aplikasi:
   ```powershell
   Expand-Archive -Path TMBilling_Server_v<versi>.zip -DestinationPath . -Force
   ```
   Jangan menyentuh `.env`, `instance/`, dan `backups/` kustom.
5. Pasang dependensi:
   ```cmd
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
   Bila langkah ini gagal, jangan lanjut start; perbaiki atau balikkan kode ke versi lama.
6. Jalankan migrasi:
   ```cmd
   .venv\Scripts\python.exe install_scripts\run_migration.py
   ```
   Output normal berakhir dengan `[MIGRATION] Safety sync skema berhasil.` Bila upgrade atau safety sync gagal, skrip mencetak `[MIGRATION ERROR] ...`, keluar dengan kode bukan nol, dan **tidak** men-stamp revisi ke `head` sehingga upaya berikutnya tetap menjalankan migrasi yang belum selesai.
7. Nyalakan server:
   ```cmd
   start.bat
   ```
8. Verifikasi `http://localhost:7015/api/health`, login dashboard, dan uji satu sesi billing + satu transaksi POS.

**Kapan `run_migration.py` wajib?** Wajib bila rilis mengubah skema (cek `CHANGELOG.md` atau `migrations/versions/`). Untuk rilis kode/CSS saja tidak wajib, tetapi migrasi bersifat idempoten sehingga aman dijalankan setiap update. Jangan menjalankan migrasi saat server masih hidup.

**Rollback bila update gagal:** `stop.bat` → salin `backups/manual_pre_update.db` (atau `warnet_backup_before_update_*.db`) menjadi `instance/warnet.db` → ekstrak ulang ZIP versi lama → `start.bat`. Update tidak zero-downtime: client terputus beberapa detik, tetapi sesi tersimpan di database dan pulih lewat heartbeat/blackout.

---

## 10. Panduan Kontribusi, Testing & SOP Dual-Engine

### 10.1 Standar Testing Backend (Pytest)
Repositori TMBilling dilengkapi **248 file pengujian unit dan integrasi** dengan **681 test specs** aktif:
```powershell
python -m pytest tests/ -q
```
Seluruh pengujian harus berstatus **PASSED (681 passed, 0 failed)** sebelum melakukan commit atau push.

### 10.1.1 Pengujian End-to-End Browser (Playwright)
`tests/e2e/` menjalankan **15 suite Chromium sungguhan** (374 check) secara paralel terhadap sandbox terisolasi:

```powershell
npm run test:e2e                                            # semua suite, worker = jumlah CPU
.venv\Scripts\python.exe tests/e2e/run_all_e2e.py --jobs 1  # serial untuk debug
.venv\Scripts\python.exe tests/e2e/run_all_e2e.py --suite pc_billing --jobs 2
.venv\Scripts\python.exe tests/e2e/run_all_e2e.py --list
npm run test:e2e:sandbox                                    # server sandbox interaktif port 7016
```

- Setiap suite berjalan di proses Python sendiri dengan database `instance/e2e/<suite>/warnet.db`, port dinamis, catatan `instance/e2e/<suite>/notes`, dan backup `instance/e2e/<suite>/backups`; `E2E_BASE_URL` dan `E2E_SANDBOX_DB` diteruskan ke runner Node.
- `instance/warnet.db` (sha256 + jumlah baris), `backups/`, `instance/notes/`, `.env`, dan `initial_admin.txt` dijaga read-only; kegagalan guard membuat exit code 1.
- Direktori catatan diisolasi lewat `TM_NOTES_DIR`, jadi test tidak menyentuh catatan produksi.
- Cakupan: 30 tab container, 10 sub-tab settings, 8 portal publik, siklus billing, POS kantin, member/paket/grup, shift & rekonsiliasi kas, telemetri hardware & anti-maling, turnamen, RBAC/redaksi setting, blackout & emergency login, invarian zero-thrash dan reflow responsif.
- **Gerbang cakupan rute:** sandbox mencatat setiap `endpoint method` yang benar-benar dipanggil ke `requests.log`, lalu `tests/e2e/check_coverage_gate.py` membandingkannya dengan `routes.json` (seluruh `url_map`). Rute yang belum dipanggil harus ditutup suite bisnis atau suite `route_smoke`, atau didaftarkan di `tests/e2e/api_exempt.py` dengan alasan nyata (proses/jaringan eksternal). Gerbang hanya berjalan bila semua suite lulus dan menggagalkan run bila ada rute tertinggal.
- Suite khusus hasil audit: `update_restore` (klaim pembaruan tunggal, restore menolak DB asing, tukar berkas + pemulihan jurnal), `screenshot_whitelist` (screenshot privat admin-only, revalidasi role whitelist), `analytics_cleanup` (top paket tanpa baris siklus hidup, guard hapus tanggal), dan `route_smoke` (memanggil seluruh rute sisa dengan payload aman dan memastikan tidak ada balasan 5xx).
- Check harus membuktikan transisi state, baris database, aritmetika uang, atau kontrak error — bukan sekadar "elemen ada".


### 10.2 Standar Dual-Engine SOP (Single Operating Procedure)
Seluruh aktivitas rekayasa perangkat lunak wajib mematuhi protokol **Dual-Engine**:
1. **Engine 1 - Planning & Brainstorming (Plugin `superpowers`)**:
   - `brainstorming`: Menganalisis kebutuhan pengguna dan merancang arsitektur sebelum coding.
   - `writing-plans`: Menyusun rencana kerja bertahap yang modular dan terverifikasi.
   - `systematic-debugging`: Investigasi akar masalah secara mendalam sebelum perbaikan; verifikasi regresi (681 test specs) dan jangan commit/push otomatis setelah bugfix.
   - `test-driven-development`: Memastikan spesifikasi pengujian ada untuk setiap perubahan fitur krusial.
   - `git-discipline`: Dilarang keras melakukan `git commit` maupun `git push` secara sepihak/otomatis (baik saat fitur baru maupun setelah debugging/bugfix) sebelum ada perintah eksplisit dari USER. Selalu laporkan hasil pekerjaan dan tunggu aba-aba USER.
2. **Engine 2 - Execution & Verification (MCP `codebase-memory`)**:
   - `index_status` / `check_index_coverage`: Memeriksa kelengkapan graf indeks kode.
   - `search_graph` / `search_code`: Melakukan navigasi dependensi relasional antar fungsi/class.
   - `trace_path`: Melacak aliran data dan rantai eksekusi route ke service ke repository.
   - `index_repository`: Memperbarui graf pengetahuan repositori setelah modifikasi kode selesai.

### 10.3 Skrip Otomatisasi & Build Pipeline
Repositori menyediakan skrip batch otomatis untuk menyederhanakan manajemen operasional dan proses build:

| Skrip Batch | Direktori | Fungsi Utama |
| :--- | :--- | :--- |
| **`install.bat`** | Root (`/`) | Instalasi Server Billing 1-klik (Python venv, requirements, `.env`, SQLite init). |
| **`start.bat`** | Root (`/`) | Menjalankan Server Billing di background pada port `7015` (`http://localhost:7015`). |
| **`stop.bat`** | Root (`/`) | Menghentikan proses Server Billing. |
| **`developer_install.bat`** | Root (`/`) | Inisialisasi environment lengkap untuk pengembang (Python & Frontend dependencies). |
| **`build_and_deploy.bat`** | Root (`/`) | Kompilasi seluruh binary klien Rust (`TMBillingTauri`, `TMBilling_Monitor`, `MGCTM`, `TMBilling_Uninstaller`, `mtm`, `TMLHMService`) dan menyalin binary rilis ke `WarnetAgent/Deploy/`. |
| **`install.bat`** | `WarnetAgent/Deploy/` | Instalasi otomatis klien PC warnet (konfigurasi IP server, registry, firewall, startup). |
| **`uninstall.bat`** | `WarnetAgent/Deploy/` | Uninstalasi aman klien warnet via `TMBilling_Uninstaller.exe`. |
| **`allow_firewall.bat`** | `WarnetAgent/Deploy/` | Konfigurasi aturan Windows Defender Firewall port 5900 TightVNC. |

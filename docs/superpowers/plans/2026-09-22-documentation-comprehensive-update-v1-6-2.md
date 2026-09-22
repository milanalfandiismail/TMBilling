# Rencana Konsolidasi & Pembaruan Dokumentasi TMBilling v1.6.2 (Terverifikasi Dari Codebase)

> **Untuk Pekerja Agentik:** SUB-SKILL WAJIB: Gunakan `superpowers:subagent-driven-development` (direkomendasikan) atau `superpowers:executing-plans` untuk mengeksekusi rencana ini per tugas. Langkah-langkah menggunakan sintaks checklist (`- [ ]`).

**Tujuan:** Menyederhanakan dan menyatukan seluruh dokumentasi proyek ke dalam **3 file utama yang terorganisir rapi**, akurat, tersinkronisasi dengan arsitektur `v1.6.2` (termasuk migrasi `WarnetAgent/TMBillingTauri`), dan memuat **SELURUH FITUR & MODUL TMBILLING TANPA TERKECUALI (TERVERIFIKASI LANGSUNG DARI KODE SUMBER)** ke dalam `docs/DOCUMENTATION.md`.

**Struktur 3 File Utama:**
1. **`README.md` (Root)** — Ringkasan proyek, highlight fitur penting, prasyarat, panduan instalasi cepat (Server, WarnetAgent, TightVNC), cara menjalankan/build, dan navigasi utama.
2. **`CHANGELOG.md` (Root)** — Riwayat rilis lengkap dan detail per versi (`v1.6.2`, `v1.6.1`, `v1.6.0`, dll.).
3. **`docs/DOCUMENTATION.md` (Docs Master - Single Source of Truth)** — Master dokumentasi teknis & operasional terlengkap yang memuat seluruh arsitektur, 28 domain fitur menyeluruh, panduan backend, frontend, agent Rust, sistem keamanan, API/WebSocket, dan panduan kasir.

---

## Global Constraints
- Seluruh path file yang sebelumnya merujuk ke `WarnetClient/` diubah menjadi `WarnetAgent/TMBillingTauri/`.
- Versi software distandarisasi ke `v1.6.2`.
- Dokumentasi ditulis dalam Bahasa Indonesia profesional, jelas, presisi, dengan formatting Markdown / GFM dan diagram Mermaid yang valid.
- Jangan ada placeholder ("TODO", "TBD", "isi nanti").
- Seluruh isi dokumen pecahan lama di `docs/` dan root dilebur 100% tanpa ada informasi teknis atau fitur yang hilang sebelum file pecahan dibersihkan.

---

### Task 1: Menyusun Master Dokumentasi Teknis Lengkap (`docs/DOCUMENTATION.md`)

**Files:**
- Create: `docs/DOCUMENTATION.md`

**Daftar Lengkap 28 Domain Fitur & Modul Hasil Audit Codebase yang Wajib Masuk ke `docs/DOCUMENTATION.md`:**
1. **Arsitektur Sistem Terpadu (3-Layer SoC)**:
   - Backend Python/Flask + SQLite ORM + WebSocket Server.
   - Frontend Modular Vanilla JS (ES6 Modules, Event Bus, Theme CSS Variables, Modal Standards).
   - WarnetAgent Client (Tauri v2 + Rust Core, Win32 Hooks, IPC Bridge, Kiosk Shell).
   - WebSocket VNC Proxy Relay & Multi-Branch Forwarder.
2. **Struktur Direktori & Pemetaan Kode**:
   - Struktur folder lengkap dengan path baru `WarnetAgent/TMBillingTauri`, `WarnetAgent/MGCTM`, `WarnetAgent/TMBilling_Uninstaller`, `app/`, `installer/`, `tools/`.
3. **Katalog Lengkap Seluruh Fitur (Exhaustive 28-Domain Matrix)**:
   - **1. Multi-Branch Control Panel & Remote Proxy Relay**: Inbound connections (`BranchInbound`, `Branch`), local vs remote kasir, proxy forwarder, session isolation, cross-branch data sync, multi-timezone (WIB, WITA, WIT).
   - **2. Multi-PC Selection & Batch Actions Engine**: Card-to-card drag select, multi-select checkboxes, context menu batch actions (`remoteBatch`: Batch Shutdown, Batch Restart, Batch Lock, Batch Move PC, Batch Clear Session, Batch Apply Paket).
   - **3. TightVNC Remote Control System**: Port 5900 Loopback, auto-firewall rule `allow_firewall.bat`, bi-directional clipboard sync, WebSocket binary/text proxy, fail-fast token multiplexing, display scaling coordinate mapping, per-client diagnostics.
   - **4. Blackout Auto-Recovery System (Toleransi Mati Lampu)**: Deteksi mati lampu otomatis, pencatatan durasi offline PC (`PCUptimeLog`), PC Uptime logging & hard delete, toleransi durasi blackout, proteksi state sesi billing agar durasi & saldo sisa tidak hangus saat listrik kembali menyala.
   - **5. 5-Layer WarnetAgent Anti-Tamper Security**: Dual-Hive Registry SHA-256 Binary Hashes (HKCU & HKLM) untuk `MGCTM`, `TMBilling`, `TMMonitor`, `mtm`, `Uninstaller`; Task Manager block, Watchdog service auto-spawn (`MGCTM.exe`), Emergency credentials SHA-256 hash verification.
   - **6. Hardware Baseline Monitoring & Theft Alerts**: Snapshot CPU, GPU, RAM, Disk serials/models (`HardwareMonitor`), deteksi pergantian/pencurian hardware real-time, notification & discrepancy modal.
   - **7. Remote Process Monitor & Task Killer**: Remote process listing via web (`PCProcess`), CPU/RAM usage per process, remote process termination via Kasir Dashboard.
   - **8. Web File Explorer**: Remote browsing disk & direktori PC klien via web, file upload, file download, preview teks/gambar.
   - **9. Screenshot Monitor with Natural Sorting**: Real-time screenshot capture grid, natural alphanumeric sorting `PC-01` s/d `PC-10` dst., live zoom view modal.
   - **10. POS Kantin & Billing FnB Multi-Payment**: Manajemen menu (`MenuItem`), kategori FnB, stok unlimited/limited, varian menu, transaksi FnB (`TransaksiMenu`), multi-metode pembayaran (Tunai, QRIS, Transfer Bank), cetak struk thermal, pembebanan langsung ke tagihan sesi billing.
   - **11. Dynamic Tutorials CMS & Custom CKEditor Builder**: Pusat dokumentasi/panduan interaktif di dalam aplikasi kasir (`SystemTutorial`), smart tutorial seeding, export tutorial, modal tutorial dengan upload gambar on confirm, custom CKEditor v5 build.
   - **12. Cloudflare Tunnel Auto-Service**: Zero-config tunnel integration, persistent token, background auto-service installer untuk akses remote kasir/owner tanpa IP publik statis.
   - **13. Centralized Versioning System**: `app/config.py` sebagai Single Source of Version Truth, diinjeksikan ke backend context, API endpoint `/api/version`, dan UI footer/header.
   - **14. RBAC Kasir & Centralized Audit Log System**: Role-based access (`User`: Super Admin, Admin, Kasir), standardized logging formatter, category grouping, pembersihan audit log dengan otentikasi supervisor.
   - **15. Floor Plan & Dynamic Room Layout**: Visualisasi denah ruang warnet interaktif 2D (`map_view.js`), draggable PC nodes, indikator status sesi & warna, kustomisasi grid koordinat.
   - **16. Database Maintenance & Cloud/Local Backup UI**: Auto-backup database lokal & cloud rotation, SQLite VACUUM/optimize, schema integrity check, modal restore database dengan konfirmasi aman.
   - **17. Manajemen Member, Paket & Billing Rates**: Prepaid member billing (`Member`), deposit balance, tarif kustom ruangan (`Grup`), paket jam/malam (`Paket`), unlimited stock package fix, reset state sesi.
   - **18. Shift Kasir & Manajemen Kas Fisik**: Shift record (`ShiftRecord`), pencatatan modal awal kasir, setoran akhir kas, pelacakan selisih kas fisik vs sistem, laporan handover shift.
   - **19. Catatan Kasir & Shift Handover Scratchpad**: Sticky notes kasir (`catatan`), pesan serah terima antar shift, memo internal operator.
   - **20. Turnamen & Bracket eSports Engine**: Manajemen turnamen (`Turnamen`, `TurnamenTahap`, `TurnamenTim`, `TurnamenMatch`), bracket single/double elimination, registrasi peserta tim.
   - **21. Public TV Billboard & Scoreboard Display**: Halaman display TV publik (`tv_public_routes`, `tv_service`), running text promosi, live status billing warnet, scoreboard turnamen.
   - **22. Owner Analytics & Business Intelligence**: Analitik dashboard Owner (`analytics_service`, `analytics.js`), revenue trends, grafik okupansi jam sibuk (peak hours), profit margin FnB vs billing.
   - **23. Emergency Mode & Offline Fallback**: Emergency credentials SHA-256 hash, mode operasional offline saat koneksi server terputus.
   - **24. Audio Warning Intervals & Sound System**: Tauri sound player, interval suara peringatan sisa waktu 15m, 10m, 5m, 1m, custom volume controls, notification chimes.
   - **25. Responsive Dual-Layout (1024px & 1920px)**: Layout 1024px-1920px adaptif, mobile touch scrolling, kiosk scaling, smooth overlay modals, multiline 2-row table, note alerts.
   - **26. Live Search Debouncing & PC Code Formatting**: Debounced search bar, auto-prefix dash `PC-01`, input validation dan typography standard.
   - **27. Integrasi Mikrotik Bandwidth Management**: Mikrotik RouterOS API (`MikroTikConfig`), queue bandwidth limit per PC, pemutusan koneksi otomatis saat sesi habis.
   - **28. Maintenance Ticket & Issue Reporting System**: Pelaporan gangguan PC klien (`MaintenanceTicket`), ticketing status Open/In-Progress/Resolved, title wrapping, detail modal.
4. **Panduan Backend Lengkap (Python & Flask)**:
   - 30 Blueprints & Routing (`auth_routes`, `billing_routes`, `batch_sesi_routes`, `monitor_routes`, `branch_routes`, `menu_routes`, `tutorial_routes`, `shift_routes`, `tournament_routes`, dll.).
   - 35+ Service Layer (`branch_service`, `blackout_service`, `fileexplorer_service`, `server_monitor_service`, `vnc_service`, `analytics_service`, dll.).
   - 25 Database Models & SQLite ORM (`PC`, `Sesi`, `User`, `Member`, `MenuItem`, `TransaksiMenu`, `Transaksi`, `Branch`, `BranchInbound`, `PCUptimeLog`, `SystemTutorial`, `MaintenanceTicket`, `ShiftRecord`, `Turnamen`, dll.).
5. **Panduan Frontend Lengkap (Modular Vanilla JS & CSS)**:
   - Modul `app/static/js/kasir/` (`core/api.js`, `dashboard_selection.js`, `vnc_client.js`, `dashboard_process_monitor.js`, `dashboard_detail_modal.js`, `map_view.js`, `catatan`, `owner/analytics.js`, `tournament`, dll.).
   - CSS Design System, Theme Variables, Responsive Grid, Modal Architecture.
6. **Panduan WarnetAgent (Tauri v2 Rust)**:
   - Arsitektur Rust Core (`main.rs`, `lib.rs`, `commands.rs`, `security.rs`, `vnc.rs`, `sound.rs`).
   - Win32 API Low-level Hooks, Kiosk Shell, Registry Anti-Tamper Checker, Watchdog Service (`MGCTM`).
   - Uninstaller Service (`TMBilling_Uninstaller`).
7. **Spesifikasi API & Protokol WebSocket**:
   - Katalog endpoint RESTful (Request/Response JSON Schema).
   - Protokol WebSocket (VNC Frame streaming, Telemetry ping/pong, Remote Control commands).
8. **Panduan Pengoperasian Kasir / Operator & FAQ Troubleshooting**.
9. **Standar Pengujian, Kontribusi & Build Pipeline** (`pytest`, Cargo check, batch scripts).

- [ ] **Step 1: Tulis `docs/DOCUMENTATION.md` secara lengkap, mendalam, dan terstruktur**
- [ ] **Step 2: Validasi integritas tautan internal, format tabel, dan diagram Mermaid**

---

### Task 2: Memperbarui Dokumen Ringkas `README.md` (Root)

**Files:**
- Modify: `README.md`

**Rincian Konten:**
- Header proyek, badge versi `v1.6.2`, status build & teknologi.
- Deskripsi singkat dan nilai utama TMBilling.
- Highlight Fitur Utama (daftar ringkas 28 poin fitur).
- Prasyarat Sistem (Requirements: Python, Node.js, Rust/Cargo, SQLite, TightVNC).
- Panduan Instalasi Cepat (Quick Start Guide):
  - 1. Setup Server Billing (venv, requirements, inisialisasi DB, run server).
  - 2. Setup WarnetAgent Klien (Tauri build, `developer_install.bat`, `build_and_deploy.bat`).
  - 3. Setup TightVNC & Firewall (`allow_firewall.bat`).
- Cara Menjalankan & Skrip Otomatisasi (Build & Deploy scripts).
- Navigasi Cepat ke Dokumentasi Teknis Lengkap (`docs/DOCUMENTATION.md`) dan Catatan Rilis (`CHANGELOG.md`).

- [ ] **Step 1: Tulis ulang `README.md` menjadi ringkas, profesional, dan fokus pada instalasi & navigasi**
- [ ] **Step 2: Pastikan seluruh link ke `docs/DOCUMENTATION.md` dan `CHANGELOG.md` berfungsi**

---

### Task 3: Memperbarui `CHANGELOG.md` (Root)

**Files:**
- Modify: `CHANGELOG.md`

**Rincian Konten:**
- Standarisasi format mengikuti *Keep a Changelog*.
- Rilis `v1.6.2` (Restrukturisasi folder `WarnetAgent/TMBillingTauri`, konsolidasi dokumentasi master `docs/DOCUMENTATION.md`, pembaruan build scripts).
- Rilis `v1.6.1` (Hotfix batch actions API `remoteBatch` & selector synchronization).
- Rilis `v1.6.0` (Multi-PC selection & batch actions, TightVNC 5900 bi-directional clipboard, Dual-Hive SHA-256 registry hash verification, Multi-branch relay, Hardware baseline monitoring, Blackout recovery, POS Kantin).
- Pembersihan dan penyelarasan riwayat rilis `v1.5.x` ke bawah.

- [ ] **Step 1: Perbarui `CHANGELOG.md` dengan entri rilis lengkap**
- [ ] **Step 2: Validasi konsistensi penomoran versi dan tanggal rilis**

---

### Task 4: Konsolidasi & Pembersihan File Markdown Pecahan Lama

**Files to Remove (setelah seluruh isinya 100% masuk ke `docs/DOCUMENTATION.md`):**
- `PANDUAN_TIGHTVNC.md`
- `PRIVACY.md`
- `TASK-004-live-search-debounce.md`
- `docs/ARCHITECTURE.md`
- `docs/BACKEND_GUIDE.md`
- `docs/CLOUD_BACKUP_DESIGN.md`
- `docs/CODEBASE_DOCUMENTATION.md`
- `docs/DESIGN_IP_WHITELIST_SESSION_DESTROY.md`
- `docs/DIAGRAMS.md`
- `docs/FEATURE_CLOUDFLARE_TUNNEL.md`
- `docs/FEATURE_FLOOR_PLAN.md`
- `docs/FEATURE_IP_WHITELIST.md`
- `docs/FEATURE_MULTI_TIMEZONE.md`
- `docs/FEATURE_OWNER_ANALYTICS.md`
- `docs/FEATURE_PLUGIN_SYSTEM.md`
- `docs/FRONTEND_GUIDE.md`
- `docs/MAINTENANCE_UI_STANDARDS.md`
- `docs/NEW_FEATURES_GUIDE.md`
- `docs/PRD.md`
- `docs/TECHNICAL_DOCS.md`
- `docs/UPGRADE_RUPIAH_AND_POS.md`
- `docs/design_metode_pembayaran.md`

- [ ] **Step 1: Konfirmasi semua data penting dari file pecahan sudah ada di `docs/DOCUMENTATION.md`**
- [ ] **Step 2: Hapus file markdown pecahan lama menggunakan git rm**
- [ ] **Step 3: Pastikan direktori `docs/` bersih (hanya berisi `DOCUMENTATION.md` dan folder arsip `superpowers/`)**

---

### Task 5: Validasi, Indexing MCP, Testing & Commit

- [ ] **Step 1: Jalankan pytest suite untuk memastikan tidak ada efek samping pada kode**
- [ ] **Step 2: Jalankan `index_repository` pada MCP `codebase-memory` untuk memperbarui indeks graf dokumentasi**
- [ ] **Step 3: Commit dan push ke branch `v1.6.2`**

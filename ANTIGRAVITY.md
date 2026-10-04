# 🧠 ANTIGRAVITY.md — Master Project Memory & Dual-Engine Playbook
> **Single Source of Truth (SSOT) & Local Brain Memory for TMBilling**  
> *Versi Rilis Saat Ini:* `v1.6.3` | *Branch:* `1.6.3` | *Status:* **Master AI Memory & Execution SOP**  
> *Tujuan:* Eliminasi total halusinasi kode, penghematan token, dan eksekusi secepat kilat dengan menggabungkan **Local Memory Document (`ANTIGRAVITY.md`)** + **MCP `codebase-memory`**.

---

## 📑 DAFTAR ISI (TABLE OF CONTENTS)
1. [SOP & Dua Cara Melakukan Eksekusi & Planning](#1-sop--dua-cara-melakukan-eksekusi--planning)
2. [Arsitektur Sistem Terpadu (3-Layer SoC)](#2-arsitektur-sistem-terpadu-3-layer-soc)
3. [Audit & Pemetaan Lengkap Backend Flask (`app/`)](#3-audit--pemetaan-lengkap-backend-flask-app)
   - 3.1 Model SQLAlchemy (25 Models)
   - 3.2 Repositories (Data Access Layer)
   - 3.3 Services (Business Logic Layer)
   - 3.4 Routes & Blueprints (REST & WebSockets)
   - 3.5 Middleware & Utils
4. [Audit & Pemetaan Lengkap Frontend Kasir & Publik](#4-audit--pemetaan-lengkap-frontend-kasir--publik)
   - 4.1 Core JavaScript Modules (`app/static/js/kasir/core/`)
   - 4.2 Feature Modules Kasir (`app/static/js/kasir/modules/`)
   - 4.3 Template Jinja2 Kasir & Public TV
   - 4.4 Build Pipeline CSS (TailwindCSS v3 Minified)
5. [Audit & Pemetaan Lengkap Klien WarnetAgent (`WarnetAgent/`)](#5-audit--pemetaan-lengkap-klien-warnetagent-warnetagent)
   - 5.1 TMBillingTauri (Tauri v2 + Rust Core + Kiosk Shell)
   - 5.2 TMBilling_Monitor (Daemon Telemetri Rust + C# HardwareHelper)
   - 5.3 MGCTM & mtm (Dual Watchdog Resilience)
   - 5.4 TMBilling_Uninstaller & Deploy Scripts
6. [Katalog Lengkap API Endpoints (Quick Reference)](#6-katalog-lengkap-api-endpoints-quick-reference)
7. [Audit Test Suites (`tests/` — 264 Test Specs)](#7-audit-test-suites-tests--264-test-specs)
8. [Aturan Krusial, Bug-Traps, & Codebase Gotchas](#8-aturan-krusial-bug-traps--codebase-gotchas)
9. [Changelog & Riwayat Penambahan Fitur](#9-changelog--riwayat-penambahan-fitur)

---

## ⚡ 1. SOP & DUA CARA MELAKUKAN EKSEKUSI & PLANNING

Untuk mencegah pemborosan token dan menghindari salah tebak relasi kode, seluruh agen AI dan developer **WAJIB** menggunakan pendekatan **Double-Layered Protection**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER / CODING TASK                              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│  METODE 1: ANTIGRAVITY.MD       │       │  METODE 2: MCP codebase-memory  │
│  (Fast Macro Context)           │       │  (Live Precise Micro Symbol)    │
│  - Arsitektur 3-Layer           │       │  - index_status & coverage      │
│  - Katalog Model & Field DB     │  ◄──► │  - search_code & search_graph   │
│  - Daftar Endpoint & Parameter  │       │  - trace_path (caller/callee)   │
│  - Gotchas & Validasi Khusus    │       │  - get_code_snippet             │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       PLANNING (Superpowers / Brainstorming)    │
             │       - Perjelas scope perubahan                │
             │       - Buat rencana langkah-demi-langkah       │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       EKSEKUSI MINIMALIS & TARGETED             │
             │       - view_file HANYA dengan baris terbatas   │
             │       - replace_file_content (single block)     │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       VERIFIKASI WAJIB (EVIDENCE FIRST)         │
             │       - python -m pytest tests/ -q (264 pass)   │
             │       - npm run build:css (jika sentuh UI)      │
             │       - index_repository (re-index graph)       │
             └─────────────────────────────────────────────────┘
```

### SOP Planning (Sebelum Menulis Kode)
1. **Identifikasi Domain**: Cocokkan request dengan domain terkait di Bagian 3, 4, atau 5 file ini.
2. **Kueri MCP `codebase-memory`**:
   - `search_code` dengan parameter `pattern: "<symbol_name>"` untuk menemukan file pasti.
   - `trace_path` dengan `function_name: "<function>"` untuk melihat siapa saja yang memanggil dan dipanggil fungsi tersebut.
3. **Penyusunan Plan**:
   - Tentukan file mana yang akan diubah dan fungsi apa yang terpengaruh.
   - Buat skenario pengujian/verifikasi sebelum eksekusi dimulai.

### SOP Eksekusi (Saat Mengubah Kode)
1. **Dilarang keras membaca seluruh file 1000 baris**: Gunakan `view_file` dengan argumen `StartLine` dan `EndLine` sesuai lokasi yang ditemukan oleh MCP.
2. **Atomic Modification**: Gunakan `replace_file_content` untuk perubahan spesifik. Pertahankan komentar kode existing.
3. **Verifikasi**: Jalankan `python -m pytest tests/ -q`. Jika ada test yang gagal, perbaiki sebelum lanjut.
4. **Re-index MCP**: Jalankan `index_repository(project="C-Project-GIT-TMBilling")`.
5. **Update Memory**: Jika ada penambahan fitur, endpoint baru, atau model baru, tambahkan dokumentasinya ke Bagian 9 (Changelog) berkas ini.

---

## 🏛️ 2. ARSITEKTUR SISTEM TERPADU (3-LAYER SOC)

Sistem TMBilling terdiri dari 3 layer utama yang terhubung secara realtime:

```
[ BROWSER KASIR / OWNER ]                [ CLIENT PC / WARNET ]
  │           │                                     │
  │ HTTP REST │ WebSocket (RFB/VNC)                 │ HTTP Telemetry / Heartbeat
  ▼           ▼                                     ▼
┌────────────────────────────────────────────────────────┐
│             BACKEND FLASK SERVER (PORT 5000)           │
│  - Routes (Blueprints) ──► Services ──► Repositories   │
│  - SQLite (WAL Mode) via SQLAlchemy ORM (25 Models)    │
│  - WebSocket VNC Proxy Relay (TightVNC 5900 Loopback)  │
│  - Cloudflare Ingress & Multi-Branch Relay Forwarder   │
└────────────────────────────────────────────────────────┘
```

1. **Layer 1: Frontend Kasir**: Single-Page Style modular dengan ES6 Vanilla JS, TailwindCSS v3 minified, generator skeleton loading responsif, dan modal management.
2. **Layer 2: Backend Server**: Python Flask dengan arsitektur 4-Tier Clean SoC (`routes/` -> `services/` -> `repositories/` -> `models/`), database SQLite WAL, background scheduler, audit logging terpusat, dan integrasi Cloudflare/Mikrotik.
3. **Layer 3: WarnetAgent Klien**: Desktop agent berbasis Tauri v2 (Rust) + Win32 low-level hooks (kiosk lock), telemetri hardware (C# + LibreHardwareMonitor), TightVNC server (port 5900), dan dual-process watchdog (`MGCTM.exe` + `mtm.exe`).

---

## 🐍 3. AUDIT & PEMETAAN LENGKAP BACKEND FLASK (`app/`)

### 3.1 Model SQLAlchemy (25 Models) — `app/models/`
Semua model inherit dari `app.models.db.Model`:

| Model | File Lokasi | Fungsi & Kolom Krusial |
|---|---|---|
| `PC` | `app/models/pc/pc.py` | Unit PC (`kode`, `nama`, `ip_address`, `mac_address`, `grup_id`, `pos_x`, `pos_y`, `is_admin_mode`, `aktif`). *pos_x & pos_y: -1 = unmapped*. |
| `PCUptimeLog` | `app/models/pc/pc_uptime.py` | Log uptime/downtime PC (`pc_id`, `event_type`, `timestamp`). |
| `Sesi` | `app/models/sesi/sesi.py` | Sesi aktif billing (`pc_id`, `member_id`, `tipe`, `durasi_menit`, `sisa_menit`, `status`, `total_biaya`, `biaya_fnb`). |
| `Grup` | `app/models/grup/grup.py` | Kategori zona/ruangan PC (`nama`, `tarif_per_jam`, `warna`, `urutan`). |
| `User` | `app/models/user/user.py` | Akun operator & admin (`username`, `password_hash`, `role`, `pin`). |
| `Member` | `app/models/member/member.py` | Akun member (`username`, `password_hash`, `nama`, `saldo`, `status_aktif`). |
| `Paket` | `app/models/paket/paket.py` | Paket billing (`nama`, `durasi_menit`, `harga`, `grup_id`, `aktif`). |
| `Menu` | `app/models/menu/menu.py` | Item kantin/FnB (`nama`, `harga`, `stok`, `kategori`, `is_archived`). |
| `Transaksi` | `app/models/transaksi/transaksi.py` | Transaksi billing & kantin (`kode_transaksi`, `sesi_id`, `user_id`, `total`, `metode_pembayaran`, `status`). |
| `HardwareMonitor` | `app/models/hardware/hardware.py` | Telemetri hardware PC (`pc_id`, `cpu_usage`, `cpu_temp`, `gpu_temp`, `total_ram`, `nic_speed`, `motherboard`, `cpu_name`, `gpu_name`, `active_window`, `hardware_baseline`, `hardware_current_specs`, `hardware_mismatch`). |
| `PCProcess` | `app/models/hardware/hardware.py` | Proses aktif yang dilaporkan klien (`pc_id`, `pid`, `name`, `memory_mb`, `cpu_pct`). |
| `ShiftRecord` | `app/models/shift/shift_record.py` | Sesi kerja shift kasir (`user_id`, `modal_awal`, `total_pendapatan_sistem`, `total_fisik_diterima`, `selisih`, `status`). |
| `Branch` | `app/models/branch/branch.py` | Cabang warnet remote (`nama`, `alamat`, `server_url`, `api_key`, `is_active`). |
| `BranchInbound` | `app/models/branch/branch_inbound.py` | Konfigurasi inbound cabang untuk Cloudflare Tunnel. |
| `Game` | `app/models/game/game.py` | Game terinstall (`nama`, `executable_path`, `kategori_id`, `icon_path`). |
| `GameKategori` | `app/models/game/game_kategori.py` | Kategori game (`nama`, `icon`). |
| `MaintenanceTicket`| `app/models/maintenance/maintenance.py` | Tiket kerusakan teknis PC (`pc_id`, `judul`, `deskripsi`, `status`, `prioritas`). |
| `MikrotikConfig` | `app/models/mikrotik/mikrotik.py` | Kredensial & konfigurasi RouterOS API (`ip`, `username`, `password`, `port`). |
| `Settings` | `app/models/settings/settings.py` | Pengaturan dinamis sistem (key-value store: Google Maps, CCTV, sound, logo). |
| `Turnamen` | `app/models/tournament/tournament.py` | Induk turnamen eSports (`nama`, `game`, `tipe_bracket`, `status`). |
| `TurnamenTahap` | `app/models/tournament/tournament.py` | Babak / stage turnamen (`turnamen_id`, `nama_tahap`, `urutan`). |
| `TurnamenMatch` | `app/models/tournament/tournament.py` | Pertandingan eSports (`tahap_id`, `tim_a`, `tim_b`, `skor_a`, `skor_b`, `pemenang_id`). |
| `TurnamenPeserta`| `app/models/tournament/tournament.py` | Tim / partisipan turnamen (`turnamen_id`, `nama_tim`, `kontak`). |
| `Tutorial` | `app/models/tutorial/tutorial_model.py` | Artikel bantuan / SOP kasir (`judul`, `konten_html`, `kategori`). |
| `AuditLog` | `app/utils/logger.py` | Log audit aktivitas keamanan (`aksi`, `detail`, `user`, `ip_address`, `kategori`). |

### 3.2 Repositories (Data Access Layer) — `app/repositories/`
Isolasi query SQL murni tanpa memicu side-effect bisnis:
* `pc_repository.py`: CRUD PC, filter per zona/grup, update status & koordinat denah.
* `sesi_repository.py`: Query sesi aktif, riwayat sesi, filtering billing.
* `member_repository.py`: Lookup member by username/RFID/ID, update saldo.
* `transaksi_repository.py`: Insert transaksi atomic, rekonsiliasi kas.
* `hardware_repository.py`: Lookup dan update record `HardwareMonitor` per PC ID.
* `process_repository.py`: Bulk upsert proses aktif PC klien.
* `grup_repository.py`, `paket_repository.py`, `menu_repository.py`, `tournament_repository.py`, `settings_repository.py`, `user_repository.py`.

### 3.3 Services (Business Logic Layer) — `app/services/`
* `pc_service.py`: Operasional PC, mode admin, binding grup, **`update_position`** (validasi range -1..10000).
* `sesi_service.py`: Membuka sesi (guest/member), penambahan waktu, tutup sesi, kalkulasi tarif dinamis.
* `hardware_service.py`: Parsing telemetri hardware, verifikasi baseline, deteksi hardware mismatch/theft.
* `uptime_service.py`: Logging status uptime PC berdasarkan deteksi heartbeat.
* `shift_service.py`: Validasi shift kasir aktif, hitung buta (*blind cash handover*), laporan pendapatan per shift.
* `transaksi_service.py`: Transaksi multi-payment (Cash, QRIS, Transfer), cetak struk thermal, potong stok FnB.
* `branch_service.py` & `branch_proxy_service.py`: Multi-branch forwarder menggunakan header `X-Branch-ID`.
* `cloudflare_tunnel_service.py`: Manajemen daemon Cloudflare Tunnel otomatis.
* `vnc_service.py`: Menangani sesi remote display TightVNC.
* `fileexplorer_service.py`: Penjelajah direktori klien remote secara aman (anti Path Traversal / Zip Slip).
* `blackout_service.py`: Auto-recovery sesi billing saat listrik padam.
* `analytics_service.py`: Agregasi metrik omzet dan okupansi PC untuk Owner.
* `report_service.py` & `log_audit_service.py`: Ekspor laporan dan query audit log.

### 3.4 Routes & Blueprints (REST & WebSockets) — `app/routes/`
Semua route terdaftar di `app/__init__.py`:
* `auth_kasir_routes.py` (`/api/v1/kasir/auth`)
* `dashboard_routes.py` (`/api/v1/kasir/dashboard`)
* `pc_routes.py` (`/api/v1/kasir/pc`)
* `sesi_routes.py` (`/api/v1/kasir/sesi`)
* `monitor_routes.py` (`/api/v1/kasir/monitor` & `/api/v1/public/monitor`)
* `vnc_routes.py` (`/api/v1/kasir/monitor/vnc/<pc_id>` via simple-websocket)
* `fileexplorer_routes.py` (`/api/v1/kasir/monitor/fileexplorer`)
* `transaksi_routes.py` & `menu_routes.py` (`/api/v1/kasir/transaksi`, `/api/v1/kasir/menu`)
* `shift_routes.py` (`/api/v1/kasir/shift`)
* `branch_routes.py` (`/api/v1/kasir/branch`)
* `blackout_routes.py` (`/api/v1/kasir/blackout`)
* `backup_routes.py` (`/api/v1/kasir/backup`)
* `tournament_routes.py` (`/api/v1/kasir/tournament`)
* `tv_public_routes.py` (`/tv`, `/api/v1/public/tv`)

### 3.5 Middleware & Utils — `app/middleware/` & `app/utils/`
* `app/middleware/auth.py`: Decorator `@login_required`, `@admin_required`, `@shift_required`.
* `app/middleware/branch_proxy.py`: Injeksi context cabang remote berdasarkan header `X-Branch-ID`.
* `app/middleware/ip_whitelist_middleware.py`: Proteksi akses kasir hanya dari IP yang diizinkan.
* `app/utils/validators.py`: `validate_integer_range`, `validate_string_length`, `validate_currency`.
* `app/utils/timezone_utils.py`: Normalisasi timestamp UTC ke format lokal Indonesia (`now_local`, `format_display`).
* `app/utils/logger.py`: Centralized audit logger (`write_log`).

---

## 🎨 4. AUDIT & PEMETAAN LENGKAP FRONTEND KASIR & PUBLIK

### 4.1 Core JavaScript Modules — `app/static/js/kasir/core/`
* **`api.js`**:
  - `API.request(url, options)`: Wrapper global `fetch()`.
  - Otomatis menginjeksi header `X-CSRFToken` pada POST/PUT/DELETE.
  - Otomatis menginjeksi header `X-Branch-ID` jika kasir sedang membuka cabang remote.
  - Otomatis mendeteksi error belum buka shift (HTTP 400) dan memicu modal buka shift.
* **`modal.js`**:
  - `Modal.show(html)`: Menampilkan modal overlay modern.
  - `Modal.closeModal()`: Menutup modal aktif.
  - `Modal.confirm(html, onConfirm)`: Dialog konfirmasi bahaya/aksi penting.
* **`toast.js`**:
  - `Toast.success(msg)`, `Toast.error(msg)`, `Toast.warning(msg)`, `Toast.info(msg)`.
* **`skeleton.js`**:
  - Generator skeleton pulse terstandarisasi untuk semua modul.
  - Helper: `Skeleton.pcCards(n)`, `Skeleton.tableRows(cols, rows)`, `Skeleton.statCards(n)`, `Skeleton.hardwareDetailView()`, `Skeleton.formFields(n)`.
* **`utils.js`**:
  - `Utils.formatRupiah(num)`, `Utils.formatDurasiFriendly(mins)`, `Utils.escapeHtml(str)`.

### 4.2 Feature Modules Kasir — `app/static/js/kasir/modules/`
* **`dashboard/`**:
  - `index.js`: Main Dashboard Controller (`Dashboard.load()`, `Dashboard._render()`, `Dashboard.setGrup()`).
  - `dashboard_compact.js`: Renderer kartu PC, auto-sort grid, sliding columns paging, live time ticker.
  - `map_view.js`: Floor plan visual editor (`MapView.openEditor()`, `MapView._save()`, `MapView._applyGrid()`).
  - `dashboard_detail_modal.js`: Modal detail PC lengkap (remote actions, screenshot viewer, hardware baseline vs live specs, process monitor).
  - `dashboard_selection.js`: Multi-PC checkbox selection & mass batch operations.
* **`hardware_checker/index.js`**: Halaman audit keamanan fisik hardware PC (Mobo Model, Mobo Serial, CPU ID, GPU PNP, RAM & Disk Serial).
* **`fileexplorer/index.js`**: UI File Explorer remote untuk melihat disk, download file, dan upload file ke PC klien.
* **`remote/vnc_client.js`**: Canvas RFB viewer untuk remote control layar TightVNC PC klien secara realtime.
* **`member/`, `paket/`, `menu/`, `laporan/`, `shift/`, `branch/`, `tournament/`, `blackout/`, `catatan/`**.

### 4.3 Template Jinja2 Kasir & Public TV — `app/templates/`
* `app/templates/kasir/base.html`: Shell utama aplikasi kasir (Navbar, Sidebar Kasir/Admin, Modal Container, Toast Container).
* `app/templates/kasir/tabs/dashboard.html`: Area grid dashboard utama PC.
* `app/templates/kasir/tabs/hardware_checker.html`: Accordion audit hardware seluruh PC.
* `app/templates/kasir/tabs/*.html`: Seluruh tab modular kasir (Member, Menu, Laporan, Shift, Branch, dll).
* `app/templates/public/tv/index.html`: Signage Billboard TV publik (informasi ketersediaan PC, turnamen, dan promo).

### 4.4 Build Pipeline CSS (TailwindCSS v3)
* Konfigurasi di `package.json` dan `tailwind.config.js`.
* Input: `app/static/css/input.css`
* Output: `app/static/css/tailwind.css`
* **Perintah Build Minified**:
  ```bash
  npm run build:css
  ```

---

## 🖥️ 5. AUDIT & PEMETAAN LENGKAP WARNETAGENT (`WarnetAgent/`)

WarnetAgent adalah suite klien yang berjalan di setiap PC member/klien:

### 5.1 TMBillingTauri (`WarnetAgent/TMBillingTauri/`)
* **Framework**: Tauri v2 (Rust Backend + HTML5/JS Webview2 Frontend).
* **`src-tauri/src/main.rs`**: Entry point Tauri, inisialisasi state, event loop, setup audio intervals.
* **`src-tauri/src/commands/`**:
  - `auth_commands.rs`: Otentikasi login member/guest/admin lokal.
  - `network_commands.rs`: Heartbeat dan polling status sesi ke backend server.
  - `system_commands.rs`: Shutdown, restart, lock, unhook.
  - `window_commands.rs`: Kiosk mode, fullscreen enforcement, overlay toggle.
* **`src-tauri/src/utils/`**:
  - `keyboard.rs`: Low-Level Windows Keyboard Hook (`SetWindowsHookExW`) untuk memblokir Alt+Tab, Ctrl+Esc, Windows Key, Task Manager.
  - `audio.rs`: Pemutaran audio peringatan suara sisa waktu (15 menit, 5 menit, 1 menit).
  - `security.rs`: Verifikasi hash integritas biner dan pengecekan dual-hive registry.
  - `screenshot.rs`: Engine capture layar desktop PC untuk dikirim ke kasir.

### 5.2 TMBilling_Monitor (`WarnetAgent/TMBilling_Monitor/`)
* **`src/main.rs`**: Daemon telemetri Rust yang berjalan di background.
  - Membaca IP lokal, MAC Address, dan NIC link speed (Gbps/Mbps).
  - Mengekstrak embedded biner `HardwareHelper.exe` + `LibreHardwareMonitorLib.dll` jika belum ada.
  - Mengirim payload telemetri periodik ke `POST /api/v1/public/monitor`.
* **`HardwareHelper.cs`**: Aplikasi C# .NET pendukung:
  - Mengakses driver sensor kernel (`.sys`) via LibreHardwareMonitor.
  - Membaca CPU Temperature, GPU Temperature, Motherboard Model Name, CPU Name, Dedicated GPU Name, dan RAM speed.

### 5.3 MGCTM & mtm (Watchdog Daemons)
* **`WarnetAgent/MGCTM/src/main.rs`**: Watchdog utama. Memeriksa apakah `TMBilling.exe` dan `TMMonitor.exe` berjalan. Jika dimatikan paksa (taskkill), watchdog akan otomatis menyalakannya kembali dalam hitungan detik.
* **`WarnetAgent/mtm/src/main.rs`**: Auxiliary watchdog pelindung `MGCTM.exe` untuk mencegah bypass berantai.

### 5.4 TMBilling_Uninstaller & Deploy Scripts
* **`WarnetAgent/TMBilling_Uninstaller/src/main.rs`**: Program uninstaller resmi. Membutuhkan otentikasi password admin server sebelum menghapus service, startup registry, dan file biner.
* **`WarnetAgent/Deploy/`**:
  - `install.bat`: Script instalasi silent dan pendaftaran Windows Service.
  - `allow_firewall.bat`: Membuka port inbound Windows Firewall untuk VNC (5900) dan telemetry.
  - `tightvnc_settings.reg`: Konfigurasi loopback TightVNC (hanya menerima koneksi dari `127.0.0.1`).

---

## 📡 6. KATALOG LENGKAP API ENDPOINTS (QUICK REFERENCE)

### 6.1 Kasir — Otentikasi & Sesi Kerja
| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/kasir/auth/login` | Login kasir / admin (Body: `username`, `password`) |
| `POST` | `/api/v1/kasir/auth/logout` | Logout kasir dan invalidasi session |
| `GET` | `/api/v1/kasir/auth/check` | Validasi session kasir aktif |

### 6.2 Kasir — Dashboard & Unit PC
| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/v1/kasir/dashboard/pc` | Data seluruh PC terkelompok grup + omzet + status |
| `PUT` | `/api/v1/kasir/pc/<id>/position` | Update posisi grid floor plan (`pos_x`, `pos_y`) |
| `POST` | `/api/v1/kasir/pc/wol` | Magic Packet WoL (Body: `pc_ids` atau `mac`) |
| `POST` | `/api/v1/kasir/pc/<id>/lock` | Kunci layar PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/unlock` | Buka kunci layar PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/restart` | Restart PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/shutdown` | Shutdown PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/afk-lock` | Kunci sementara PC (Mode Istirahat / AFK) |
| `POST` | `/api/v1/kasir/pc/<id>/afk-unlock` | Buka kunci meja AFK |
| `POST` | `/api/v1/kasir/pc/batch-action` | Eksekusi massal (Lock, Restart, Shutdown, WOL) |

### 6.3 Kasir — Sesi Billing & Transaksi
| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/kasir/sesi/buka` | Buka sesi (Guest / Member / Paket) |
| `POST` | `/api/v1/kasir/sesi/tambah` | Tambah waktu sesi aktif |
| `POST` | `/api/v1/kasir/sesi/tutup/<id>` | Tutup sesi billing kasir |
| `POST` | `/api/v1/kasir/sesi/pindah` | Pindah PC sesi aktif |
| `POST` | `/api/v1/kasir/sesi/refund-guest` | Refund sisa paket guest |
| `GET` | `/api/v1/kasir/sesi/<id>/riwayat-paket` | Daftar paket yang dapat direfund |
| `GET` | `/api/v1/kasir/transaksi/` | Riwayat transaksi kasir |
| `POST` | `/api/v1/kasir/transaksi/` | Buat transaksi kasir / kantin baru |
| `POST` | `/api/v1/kasir/shift/buka` | Buka shift kasir |
| `POST` | `/api/v1/kasir/shift/tutup` | Tutup shift kasir (hitung buta) |

### 6.4 Telemetri Klien & Remote Management
| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/public/monitor` | Endpoint telemetri snapshot dari WarnetAgent klien |
| `GET` | `/api/v1/kasir/monitor/all` | Status hardware & telemetri seluruh PC |
| `GET` | `/api/v1/kasir/monitor/processes/<id>`| Daftar proses berjalan di PC |
| `POST` | `/api/v1/kasir/monitor/processes/<id>/kill` | Taskkill proses berbahaya di PC klien |
| `POST` | `/api/v1/kasir/monitor/baseline/<id>`| Daftarkan baseline resmi hardware PC |
| `GET` | `/api/v1/kasir/monitor/vnc/<pc_id>` | WebSocket RFB Tunnel remote control layar |
| `GET/POST`| `/api/v1/kasir/monitor/fileexplorer/*` | Web File Explorer (Jelajah disk PC klien) |

---

## 🧪 7. AUDIT TEST SUITES (`tests/` — 264 TEST SPECS)

Seluruh backend TMBilling divalidasi oleh **264 unit/integration test** di folder `tests/`.
Sebelum melakukan klaim selesai pada setiap task, **wajib** menjalankan:
```bash
python -m pytest tests/ -q
```
*Hasil yang diharapkan:* `264 passed, 0 failed` (Exit code: 0).

### Pemetaan Modul Test Utama:
* `test_pc_validation.py` & `test_system_validation_refactor.py`: Validasi input PC, nama, IP, MAC, dan koordinat posisi denah `(-1..10000)`.
* `test_peripheral_service_logic.py`: Deteksi perubahan hardware internal (Mobo Model, Mobo Serial, CPU ID, GPU PNP).
* `test_shift_service_robustness.py`, `test_shift_force_close.py`: Siklus shift kasir, rekonsiliasi kas, dan proteksi transaksi.
* `test_branch_proxy_relay.py`, `test_branch_auth_middleware.py`: Isolasi otentikasi antar-cabang dan proxy relay.
* `test_fileexplorer_security.py`: Proteksi keamanan anti Zip-Slip dan Path Traversal pada File Explorer remote.
* `test_vnc_client_proxy.py`: Validasi koneksi RFB WebSocket proxy.

---

## ⚠️ 8. ATURAN KRUSIAL, BUG-TRAPS, & CODEBASE GOTCHAS

1. **Rentang Koordinat Floor Plan (Denah)**:
   - Nilai valid koordinat PC (`pos_x` & `pos_y`) adalah **`-1` sampai `10000`**.
   - `(-1, -1)` merepresentasikan status **Belum Dipetakan (Unmapped)**.
   - Jangan pernah mengubah validasi minimum ke `0` karena akan menggagalkan fungsi mengeluarkan PC dari denah.
2. **Re-render Dashboard Reaktif**:
   - `Dashboard._render(data, forceFull, previousData)` mendeteksi perubahan `pos_x`, `pos_y`, `grup`, dan `id` dari snapshot `_prevRenderedData`.
   - Hindari penggunaan `location.reload()` atau reload web penuh. Semua pembaruan harus berlangsung *in-place*.
3. **Motherboard Telemetry (2 Komponen)**:
   - Nama model fisik motherboard disimpan pada field `motherboard` (model `HardwareMonitor`) dan key `"Motherboard"` di payload serials.
   - Nomor seri unik motherboard disimpan pada key `"MotherboardSerial"` di payload `hardware_baseline` dan `hardware_current_specs`.
   - Di antarmuka UI, keduanya ditampilkan terpisah sebagai **Mobo Model** dan **Mobo Serial**.
4. **Header Multi-Branch**:
   - Request API kasir otomatis menambahkan header `X-Branch-ID` via `api.js` saat mengakses cabang non-lokal. Jangan menghapus logika ini.
5. **Kompilasi CSS**:
   - Setiap kali menambahkan class utility Tailwind baru pada file `.html` atau `.js`, jalankan `npm run build:css` untuk memperbarui file minified.

---

## 📝 9. CHANGELOG & RIWAYAT PENAMBAHAN FITUR

*Catatan: Tambahkan entri baru di bawah ini setiap kali ada modifikasi/fitur baru agar memori agen tetap up-to-date.*

### [1.6.3] — 2026-10-04 (Branch: `1.6.3`)
* **Floor Plan (Denah)**:
  - Perbaikan `MapView._save()` menjadi `async` dengan `await Promise.all()` dan sinkronisasi `Dashboard.load(true)`.
  - Dukungan penyimpanan unmapped PC (`pos_x = -1, pos_y = -1`) ke database backend.
  - Deteksi pergeseran koordinat pada `_hasStructureChanged` di `index.js` untuk re-render seketika tanpa reload browser.
* **Hardware Detail Modal**:
  - Pemisahan komponen Motherboard menjadi 2 entri: **`Mobo Model`** (model/nama) dan **`Mobo Serial`** (nomor seri) pada baseline dan live telemetry.
  - Sinkronisasi key `"Motherboard"` ke dalam dictionary `HardwareSerials` di `HardwareService.process_hardware_metric`.
* **Skeleton Loading Standardization**:
  - Sentralisasi engine [`skeleton.js`](file:///C:/Project%20GIT/TMBilling/app/static/js/kasir/core/skeleton.js) untuk seluruh tab kasir.
  - Pembersihan total seluruh spinner putar lama (`animate-spin`, `fa-spin`) dan placeholder statis pada 17 template Jinja2.
  - Kompilasi ulang [`tailwind.css`](file:///C:/Project%20GIT/TMBilling/app/static/css/tailwind.css) minified.
* **Dual-Engine Agent Memory**:
  - Pembuatan dokumen master [`ANTIGRAVITY.md`](file:///C:/Project%20GIT/TMBilling/ANTIGRAVITY.md) sebagai panduan permanen proyek lokal.

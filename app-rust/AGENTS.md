# TMBilling: A Map for Agents & Dynamic Context Guide

Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise-Grade).
Arsitektur **3-Layer Separation of Concerns (SoC)**: Backend Rust (axum + sqlx), Frontend Modular ES6 Vanilla JS, Client WarnetAgent Rust & Tauri 1.5, dan TightVNC Remote Control.

Master Dokumentasi Acuan Tunggal (*Single Source of Truth*): [DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/app-rust/DOCUMENTATION.md).

> 📌 **Catatan Portabilitas**: Dokumen ini dirancang agar sepenuhnya **PORTABLE** untuk semua AI Coding Agent (Claude Code, Cursor, Copilot, ChatGPT, Windsurf, Antigravity, dsb) tanpa ketergantungan pada tool MCP tertentu.

---

## 🦀 Backend Rust 2.0.3 (rilis aktif)

- **Rilis aktif**: `app-rust/`, biner tunggal `tmbilling-server.exe`. Versi dari `app-rust/Cargo.toml` (saat ini `2.0.3`) adalah satu-satunya sumber versi backend.
- **Entry**: `app-rust/src/main.rs` — mode `--init`, `--apply-update <zip> <dir>`, dan mode normal (baca `.env`, kunci `instance/server.lock`, buka DB + `ensure_schema`, seed, scheduler + tray, bind `0.0.0.0:7015`).
- **Layer**: `routes/` (HTTP tipis) → `services/` (aturan bisnis) → `repositories/` (SQL) → `models/`. Middleware: `auth`, `csrf`, `whitelist`.
- **State**: `app-rust/src/state.rs` memegang pool sqlx, seluruh cache in-memory, antrean perintah, dan `write()`. Semua jalur tulis WAJIB lewat `state.write()` (satu lock global) karena SQLite.
- **Keamanan**: cookie `tm_session` (HMAC-SHA256, 24 jam, user dimuat ulang tiap request), CSRF double-submit `csrf_token`/`X-CSRFToken`, IP whitelist hanya untuk `/kasir/` + `/api/v1/kasir/`, `admin_only`, dan `shift_required` untuk endpoint uang/sesi.
- **Uang & sesi**: `sisa_menit` guest = durasi beli − terpakai; member/admin = saldo/waktu tersimpan − terpakai. UNIQUE `uq_aktif_sesi_pc`/`uq_aktif_sesi_member` dipetakan ke `"PC sedang dipakai"`. Transaksi `tutup_sesi` ber-`no_nota` NULL tidak tampil di laporan billing.
- **Database**: SQLite WAL `instance/warnet.db`, 24 tabel dari `app-rust/migrations/0001_schema_head.sql`. Migrasi aditif + snapshot, stempel `HEAD_REVISION = "a2b3c4d5e6f7"`, tanpa drop. Waktu DB UTC; tampilan memakai zona setting (default `Asia/Makassar`).
- **Dokumen**: `../docs/RUST_MIGRATION.md` (arsitektur & upgrade), `README.md` (operasional), `DOCUMENTATION.md` (teknis lengkap).

---

## 🗺️ Peta Direktori & Kepemilikan Modul Lengkap (Exhaustive Map)

### 1. Berkas & Skrip Root Direktori

| Berkas/Folder | Tanggung Jawab & Cakupan |
|---|---|
| `app-rust/` | **Backend aktif**: `app-rust/src/`, `migrations/`, `packaging/`, `tests/`, `Cargo.toml`. |
| `app-rust/packaging/install.bat` | Salin `tmbilling-server.exe` ke folder induk + daftarkan autostart `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. |
| `app-rust/packaging/update.bat` | Terapkan ZIP pembaruan lewat `tmbilling-server.exe --apply-update`. |
| `app-rust/migrations/0001_schema_head.sql` | Skema head 24 tabel + `0001_schema.json` (metadata parity test). |
| `package.json` | DevDependencies frontend (TailwindCSS 4.3, Playwright, FontAwesome 7) dan skrip build aset. |
| `tailwind.config.js` | Konfigurasi Tailwind untuk dashboard kasir dan client kiosk UI. |
| `build_and_deploy.bat` | Kompilasi biner klien (Rust/C#) dan build aset CSS. |
| `CHANGELOG.md` | Riwayat perubahan rilis (*Keep a Changelog*). |
| `README.md` | Ringkasan publik, sorotan fitur, dan quickstart server Rust. |
| `docs/superpowers/plans/`, `docs/superpowers/specs/` | Rencana/desain agent; di-ignore Git, bukan runtime. |
| `AGENTS.md` | Peta modul untuk AI agent (dokumen ini). |
| `DOCUMENTATION.md` | Dokumentasi teknis lengkap (arsitektur, 247 route, 24 tabel, frontend, klien, operasional). |
| `README.md` | Build, menjalankan server, rilis, troubleshooting. |
| `LICENSE` | MIT License. |
| `app/static/`, `app/templates/` | Aset frontend bersama yang di-embed ke biner Rust saat build. |

### 2. Backend Rust (`app-rust/`)

#### A. Entry, Konfigurasi, dan Bootstrap
- `app-rust/src/main.rs`: mode CLI, `Config::load` (`.env` + `SECRET_KEY` acak write-through), kunci instance, `AppState::new`, scheduler, tray, bind port.
- `app-rust/src/config.rs`: `Config` (root, DB path, port, zona waktu, versi dari `Cargo.toml`/env build).
- `app-rust/src/services/auth/bootstrap.rs`: seed admin awal, `initial_admin.txt` di root aplikasi bila belum ada admin.
- `app-rust/src/db/mod.rs`: buka pool SQLite (WAL, foreign key, busy timeout). `app-rust/src/db/migrate.rs`: `ensure_schema` aditif + snapshot + stempel revisi. `app-rust/src/db/write_lock.rs`: gerbang tulis (`WRITE_LOCK_SLOW` bila antre lama).

#### B. Router (`app-rust/src/app.rs`)
- 247 registrasi `.route(`; sumber kebenaran endpoint.
- Urutan guard: publik/client agent (tanpa guard) → `csrf` → `whitelist` → `admin_only`/`shift_required` pada domain sensitif.
- `/static/{*path}` disajikan dari aset ter-embed dengan `Cache-Control: immutable`; `assets::cache_version()` (hash isi) dipakai sebagai `?v=`.
- `/api/health` publik; halaman `/kasir/`, `/kasir/documentation`, `/kasir/login` dirender minijinja.

#### C. Route Domain (`app-rust/src/routes/` — 27 domain, 63 file)
| Domain | Tanggung Jawab |
|---|---|
| `auth/` | Login/logout kasir & admin, login member publik, cek sesi. |
| `client/` | Handshake agent, heartbeat, polling sesi/perintah, emergency & admin login. |
| `pages.rs` | Halaman kasir, login, dokumentasi, penerbitan ulang cookie CSRF. |
| `dashboard/` | Statistik dashboard, ringkasan PC, omzet hari ini. |
| `pc/`, `grup/`, `paket/` | CRUD meja, grup tarif, paket billing + arsip/restore. |
| `member/` | Member, top-up saldo, refund, riwayat, reset password. |
| `menu/` | POS FnB, stok, kategori, laporan menu, struk thermal. |
| `sesi/` | Buka/tambah/pindah/tutup sesi, blackout, refund. |
| `shift/` | Buka/tutup shift, blind cash reconciliation, riwayat. |
| `report/` | Laporan billing/keuangan, struk, ekspor PDF/Excel, cleanup. |
| `monitor/`, `hardware/` | Telemetri, proses, screenshot privat, remote action, baseline hardware. |
| `vnc/` | Start/stop/status proxy + relay WebSocket RFB. |
| `settings/` | Pengaturan, API key, whitelist, backup/restore, impor database Python 1.6.5, migrasi & update, QRIS. |
| `backup/`, `blackout/`, `notes/`, `maintenance/`, `game/`, `tournament/`, `tutorial/`, `user/`, `arsip/`, `public/`, `server_monitor/`, `mikrotik/` | Domain operasional lain; nama folder = fitur. |

#### D. Service (`app-rust/src/services/` — 27 domain, 62 file)
Aturan bisnis inti:
- `sesi/sesi_service.rs`: `buka_guest`, `buka_member`, `buka_admin`, `tambah_waktu(_batch)`, `tutup`, `tutup_locked`, `pindah_pc`, `cleanup_expired`, `refund_paket_guest`, `sync_waktu_member`. Semua tulis di dalam `state.write()`.
- `member/`: top-up batch atomik, refund klaim atomik, sinkron hotspot MikroTik saat create/update/delete (`sync_member`).
- `mikrotik/`: login menolak `!trap`, fallback CHAP `=ret=`, `sync_members` menghitung berhasil/gagal.
- `report/`: `billing()` hanya memuat transaksi bernomor nota (`no_nota IS NOT NULL`), kolom pelanggan/paket/PC dari join.
- `backup/`: snapshot SQLite + `inspect_schema` menolak DB non-TMBilling; restore menjalankan migrasi.
- `shift/`, `blackout/`, `menu/`, `owner/`, `public/`, `vnc/`, `dashboard/`, `health/` (di `public/`), `settings/`, `notes/`, `maintenance/`, `hardware/`, `game/`, `grup/`, `paket/`, `pc/`, `user/`, `tournament/`, `tutorial/`, `arsip/`, `client/`, `monitor/`, `server_monitor/`, `transaksi.rs`: lihat nama file untuk cakupan.

#### E. Repository & Model
- `app-rust/src/repositories/` — 18 file, satu per agregat (`transaksi.rs` memuat join member/sesi/pc untuk laporan, `sesi.rs` query sesi aktif, dst).
- `app-rust/src/models/` — 15 file + `to_json()`; 24 tabel: `user`, `shift_record`, `grup`, `pc`, `paket`, `member`, `sesi`, `transaksi`, `transaksi_menu`, `menu_item`, `game`, `game_kategori`, `hardware_monitor`, `pc_process`, `pc_uptime_log`, `maintenance_ticket`, `tournament*`, `system_tutorial`, `settings`, `mikrotik_config`, `alembic_version` (kompatibilitas), dll.

#### F. Middleware, Cache, Utils
- `middleware/auth.rs`: ekstraktor `Kasir`, `admin_only`, `shift_required`, TTL sesi.
- `middleware/csrf.rs`: double-submit, `ensure_cookie`, `cookie_header` (Max-Age 86400).
- `middleware/whitelist.rs`: subnet check + bypass token, hanya path kasir.
- `cache/` (7 store): `online`, `pc_network`, `settings` (write-through), `telemetry`, `uptime`, `command` (antrean FIFO), `mismatch` (API key salah).
- `utils/`: `time` (UTC ↔ zona), `logger` (JSON rotasi), `http` (response/redirect), `validators`, `idempotency` (TTL in-memory, `shortcut:`), `instance` (lock), `constants`, `helpers`.
- `scheduler.rs` (tick 60 detik), `tray.rs`, `update.rs` (tukar berkas ZIP), `templates.rs` (minijinja shim Jinja), `assets.rs` (rust-embed + `cache_version`).

### 3. Client WarnetAgent (`WarnetAgent/`)
Aplikasi klien berjalan di setiap PC member/kiosk:

| Direktori / Biner | Tanggung Jawab & Cakupan |
|---|---|
| `TMBilling/` | Klien utama aktif GPUI Rust: `src/{state.rs,app.rs,polling.rs}`, `src/ui/kiosk/{login,info,afk}.rs` (layar AFK terkunci + input PIN/password), `src/ui/overlay/{card,modals}.rs`, `src/platform/*` (registry credentials, keyboard hook, `window_manager::place` — ukuran via gpui `window.resize` + SetWindowPos; tray: klik kanan menu, double-click restore). `vendor/gpui-pre-windows` = patch `[patch.crates-io]`: clear Opaque hitam (bawaan putih) supaya WARP/VM tidak menampilkan pita putih saat resize. Arsitektur lama Tauri (arsip): `src/kiosk/`, `src/overlay/`, `src-tauri/`. Kredensial darurat dari registry/`config.ini`, fail-closed bila kosong. |
| `MGCTM/` | Watchdog C++ pengawas `TMBilling.exe`. |
| `mtm/` | Auxiliary watchdog & resilience guard. |
| `TMBilling_Monitor/` | Telemetri Rust + `HardwareHelper.exe` (LibreHardwareMonitor): CPU/GPU load & temp, RAM, active window, NIC speed. |
| `TMBilling_Uninstaller/` | Uninstaller registry/service/konfigurasi. |
| `Deploy/` | Firewall, sync registry, installer/uninstaller, TightVNC port 5900; `install.bat` membuat password admin darurat acak bila dikosongkan. |

### 4. Frontend Dashboard Kasir (`app/static/` & `app/templates/`)
#### A. Modular ES6 JavaScript (`app/static/js/kasir/`)
- `app.js`: Entry point, event delegation, routing 31 tab.
- `core/api.js`: Klien REST terpusat, CSRF otomatis, reload sekali bila CSRF ditolak.
- `core/modal.js`: Modal; `Modal.confirm` mendukung `requireCheck` untuk hapus permanen.
- `core/arsip_list.js`: Skema kolom + renderer tabel/kartu bersama, filter grup, footer total, `onChanged(cb)`.
- `core/skeleton.js`, `core/toast.js`, `core/utils.js`: skeleton statis, toast, formatter Rupiah/waktu/escape.
- `components/modal-buka.js`, `modal-tambah.js`, `modal-confirm-tambah.js`: alur buka sesi, tambah waktu, konfirmasi bayar.
- `modules/dashboard/`: Kartu, tampilan compact, modal detail, process monitor, selection, denah, sidebar.
- `modules/`: 29 modul fitur (`blackout`, `catatan`, `game`, `grup`, `hardware_checker`, `laporan*`, `log`, `maintenance`, `member`, `menu`, `mikrotik`, `monitor`, `owner`, `paket`, `pc`, `arsip/`, `remote`, `screenshot`, `server_monitor`, `settings`, `shift`, `struk`, `tournament`, `tutorials`, `uptime`, `user`).

#### B. Template Jinja2 HTML (`app/templates/`)
- `templates/kasir/base.html`: shell + meta CSRF; `index.html`: kontainer 31 tab; `login.html`; `documentation.html`.
- `templates/kasir/components/`: navbar, sidebar (admin/kasir), modal induk.
- `templates/kasir/tabs/`: 29 tampilan tab.
- `templates/public/`: 8 portal (landing, TV, live PC, member, game, paket, specs).

### 5. Subsystem Navigator: Where Things Live

| Domain Fitur | Frontend JS | Backend Rust | Model Terkait |
|---|---|---|---|
| Blackout Recovery | `modules/blackout.js` | `app-rust/src/routes/blackout/`, `app-rust/src/services/blackout/` | `Sesi`, `PCUptimeLog` |
| Process Monitor | `modules/dashboard/dashboard_process_monitor.js` | `app-rust/src/routes/monitor/monitor_routes.rs`, `app-rust/src/cache/telemetry.rs` | `PCProcess` |
| VNC Remote | `modules/remote.js`, `core/vnc_client.js` | `app-rust/src/routes/vnc/`, `app-rust/src/services/vnc/` | `PC`, `Settings` |
| POS Kantin | `modules/menu.js`, `modules/struk.js` | `app-rust/src/routes/menu/`, `app-rust/src/services/menu/` | `MenuItem`, `TransaksiMenu` |
| Hardware Baseline | `modules/hardware_checker.js` | `app-rust/src/routes/hardware/`, `app-rust/src/services/hardware/` | `HardwareMonitor` |
| Shift Kasir | `modules/shift.js` | `app-rust/src/routes/shift/`, `app-rust/src/services/shift/` | `ShiftRecord`, `Transaksi` |
| Health & Resource | `modules/settings/settings_scheduler.js` | `app-rust/src/routes/public/health.rs`, `app-rust/src/services/health.rs` | `Settings` |
| Denah Meja | `modules/dashboard/map_view.js` | `app-rust/src/routes/pc/`, `app-rust/src/services/pc/` | `PC`, `Grup` |
| CMS Tutorial | `modules/tutorials.js` | `app-rust/src/routes/tutorial/`, `app-rust/src/services/tutorial/` | `SystemTutorial` |
| MikroTik QoS | `modules/mikrotik/index.js` | `app-rust/src/routes/mikrotik/`, `app-rust/src/services/mikrotik/` | `MikroTikConfig`, `Member` |
| Turnamen | `modules/tournament.js` | `app-rust/src/routes/tournament/`, `app-rust/src/services/tournament/` | `Tournament`, `TournamentMatch` |
| Backup & Restore | `modules/settings/settings_general.js` | `app-rust/src/routes/backup/`, `app-rust/src/services/backup/` | `Settings` |
| Auto-Update | `modules/settings/migration.js` | `app-rust/src/routes/settings/migration_routes.rs`, `app-rust/src/update.rs` | — |
| Client Security | `modules/dashboard/dashboard_compact.js` | `app-rust/src/routes/auth/`, `app-rust/src/middleware/{auth,csrf,whitelist}.rs` | `PC`, `cache/mismatch` |
| Nota Generator | `modules/struk.js` | `app-rust/src/services/transaksi.rs`, `app-rust/src/services/menu/` | `Transaksi` |
| Katalog Game | `modules/game/` | `app-rust/src/routes/game/`, `app-rust/src/services/game/` | `Game`, `GameKategori` |
| Maintenance | `modules/maintenance/`, `laporan_maintenance/` | `app-rust/src/routes/maintenance/`, `app-rust/src/services/maintenance/` | `MaintenanceTicket` |
| Uptime Tracker | `modules/uptime.js` | `app-rust/src/routes/pc/`, `app-rust/src/cache/uptime.rs`, `app-rust/src/scheduler.rs` | `PCUptimeLog` |
| Owner Analytics | `modules/owner.js` | `app-rust/src/routes/report/`, `app-rust/src/services/owner/` | `Transaksi`, `Sesi` |
| Member & Saldo | `modules/member/` | `app-rust/src/routes/member/`, `app-rust/src/services/member/` | `Member` |
| Paket Billing | `modules/paket/` | `app-rust/src/routes/paket/`, `app-rust/src/services/paket/` | `Paket` |
| Staff & RBAC | `modules/user/` | `app-rust/src/routes/user/`, `app-rust/src/services/user/` | `User` |
| Screenshot | `modules/screenshot/` | `app-rust/src/routes/monitor/screenshot_routes.rs`, `app-rust/src/cache/telemetry.rs` | in-memory |
| Unit PC | `modules/pc.js`, `modules/pc/` | `app-rust/src/routes/pc/`, `app-rust/src/services/pc/` | `PC`, `Grup` |
| Stok FnB | `modules/menu/stock_log.js` | `app-rust/src/routes/menu/`, `app-rust/src/services/menu/` | `MenuItem` |
| Data Diarsipkan | `modules/arsip/`, `core/arsip_list.js` | `app-rust/src/routes/arsip/`, `app-rust/src/services/arsip/` | `Grup`, `PC`, `Paket`, `Member`, `User`, `Game`, `MenuItem` |
| Catatan Shift | `modules/catatan.js` | `app-rust/src/routes/notes/`, `app-rust/src/services/notes/` | disk store |
| Audit Log | `modules/log.js` | `app-rust/src/routes/user/`, `app-rust/src/utils/logger.rs` | file JSON |
| Struk | `modules/struk.js` | `app-rust/src/routes/report/`, `app-rust/src/services/transaksi.rs` | `Transaksi` |
| Server Monitor | `modules/server_monitor/` | `app-rust/src/routes/server_monitor/`, `app-rust/src/services/server_monitor/` | sensor host |
| Public Specs | `templates/public/specs/index.html` | `app-rust/src/routes/public/` | `PC`, `HardwareMonitor` |
| Laporan Billing | `modules/laporan/index.js` | `app-rust/src/routes/report/`, `app-rust/src/services/report/` | `Transaksi`, `Sesi`, `Member` |

### 6. Perintah Cepat Pengujian & Build (Fast Commands)

```bat
cd app-rust
cargo build --release
cargo test -j 2 -- --test-threads=2
cargo test --test sesi_test -- --nocapture
```

```bat
:: Artefak rilis: exe + app-rust/packaging/install.bat + update.bat
:: Frontend
npm run build:css
node --check app/static/js/kasir/modules/dashboard/dashboard_compact.js
```

> **Aturan eksekusi lokal:** manfaatkan seluruh core CPU bila alatnya mendukung (`cargo -j 16`, `npm run test:unit`, `robocopy /MT:16`, `7z -mmt=16`, `--jobs 0`). Paralelkan hanya pekerjaan independen; tulis DB, migrasi, backup/restore, dan `git add/commit` tetap serial.

### 7. Peta Suite Test
- `app-rust/tests/contract/` (12): `auth`, `client_agent`, `device`, `http`, `master_data`, `member_shift_notes`, `mikrotik`, `ops`, `public_cms`, `report`, `sesi`, `settings`.
- `app-rust/tests/unit/` (6): `cache`, `config`, `idempotency`, `logger`, `scheduler`, `schema_parity`.
- `tests/e2e/` (Playwright): 15 suite Chromium + `tests/e2e/client/` kontrak agent; sandbox terisolasi dan tidak menyentuh DB produksi. Klien GPUI `WarnetAgent/TMBilling/tools/e2e/` (unittest + fixture): 37 tes: `FlashTest`/`flash_probe.py` (frame putih transien), `cpu_probe.py` (CPU klien di mesin target), `InputTest` (Tab/Shift+Tab, caret di depan placeholder), `SessionEndTest` (modal + input kiosk dibuang saat sesi berakhir), `FitTest` (ukuran window = kartu/1920x1080), dua tes `settled paint` (tidak ada baris putih tersisa setelah transisi).

---

## 🔄 Aturan Pemeliharaan Dinamis (Dynamic Maintenance Rule)

> [!IMPORTANT]
> **ATURAN WAJIB BAGI SETIAP AGENT AI**:
> 1. Setiap kali menambah folder, file, modul, endpoint, atau memindahkan arsitektur: **perbarui peta pada `AGENTS.md` ini**.
> 2. Peta ini adalah referensi langsung agar sesi baru agent memahami konteks proyek tanpa eksplorasi redundan.
> 3. Jaga deskripsi direktori dan tautan berkas tetap sinkron dengan *working tree* (contoh path: `app-rust/src/routes/sesi/`).

---

## 📜 Panduan Operasional & Praktik Terbaik Agent (Portable Best Practices)

### 1. Prinsip Utama
- Instruksi harus kontekstual terhadap repo aktif; jangan berasumsi arsitektur repo lain berlaku.
- Solusi minimalis, rapi, dan menjaga backward-compatibility.

### 2. Berpikir dalam Kode
- Untuk analisis/pencarian/transformasi besar: jalankan skrip pembantu dan cetak hanya kesimpulan, bukan ribuan baris mentah.
- Tangani error dengan `try/catch` atau `?`/`Result` yang kokoh.

### 3. Operasi Repositori & Berkas
- **Sebelum mengedit**: baca file terkait, telusuri pemanggil, pahami dependensi.
- **Saat mengedit**: ubah hanya komponen yang berkaitan; hindari refactoring massal tak diminta.
- **Setelah mengedit**: validasi sintaks dan jalankan test terkait.

### 4. Konteks Khusus TMBilling
- **Backend**: Rust 2.0.3 (axum 0.8, sqlx 0.8 SQLite WAL, tokio, minijinja, rust-embed).
- **Frontend**: Vanilla ES6 modular, tanpa bundler runtime.
- **Client**: Tauri 1.5 + C#/C++ watchdog.
- **Database**: SQLite (`app-rust/instance/warnet.db` produksi; DB terpisah per test).
- **Single Source of Version**: `app-rust/Cargo.toml` (`version` = 2.0.3).
- **Cache Transient**: data yang sering di-polling WAJIB lewat store di `app-rust/src/cache/`.
- **Tulis DB**: selalu `state.write()`; jangan query langsung dari handler.

### 5. Arsitektur & Standar Performa Frontend Kasir (Zero CPU Thrashing)
- **Zero Infinite Keyframe Loops**: dilarang `animate-ping`, `animate-pulse`, `fade-in`, `zoom-in`, dsb. Status darurat memakai badge solid kontras (`[ ⚠️ TERPUTUS ]`, `[ 🔑 KEY TIDAK COCOK ]`, `[ ⚠️ LAN 100M ]`).
- **Zero Compositing Blur**: dilarang `backdrop-blur-*` dan `hover:brightness-*` pada modal/kartu; gunakan `bg-black/90`–`bg-black/95`.
- **Strict Dirty-Checking**: bandingkan nilai sebelum menyentuh DOM (`textContent`, `className`, `innerHTML`, `style`).
- **Static Skeletons**: placeholder statis `bg-[#202020]`/`bg-neutral-800`, tanpa animasi.

### 6. Komunikasi
- Bahasa Indonesia, lugas, teknis, langsung pada pokok masalah.
- Paparkan alasan teknis di balik keputusan arsitektural/perbaikan bug.

---

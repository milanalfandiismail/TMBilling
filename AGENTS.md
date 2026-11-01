# TMBilling: A Map for Agents & Dynamic Context Guide

Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise-Grade).
Arsitektur **3-Layer Separation of Concerns (SoC)**: Backend Flask Python, Frontend Modular ES6 Vanilla JS, Client WarnetAgent Rust & Tauri v2, dan TightVNC Remote Control.
Master Dokumentasi Acuan Tunggal (*Single Source of Truth*): [docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md).

> 📌 **Catatan Portabilitas**: Dokumen ini dirancang agar sepenuhnya **PORTABLE** untuk semua AI Coding Agent (Claude Code, Cursor, Copilot, ChatGPT, Windsurf, Antigravity, dsb) tanpa ketergantungan pada tool MCP tertentu.

---

## 🗺️ Peta Direktori & Kepemilikan Modul Lengkap (Exhaustive Map)

### 1. Berkas & Skrip Root Direktori

| Berkas Root | Tanggung Jawab & Cakupan |
|---|---|
| `run.py` | Entry point utama server Flask development & inisialisasi daemon background scheduler (APScheduler). |
| `run_branch2.py` | Entry point simulasi server cabang kedua (port 5001) untuk pengujian multi-branch proxy relay. |
| `create_admin.py` | Skrip CLI interaktif untuk pembuatan akun superadmin pertama kali. |
| `seed.py` | Skrip pengisian data awal database (paket billing, grup PC reguler/VIP, pengaturan default). |
| `seed_games.py` | Skrip seeding metadata katalog game populer dan ikon default. |
| `build_release.py` | Skrip automasi packaging rilis Server dan Client ke dalam arsip zip terdistribusi. |
| `build_and_deploy.bat` | Skrip batch Windows untuk kompilasi otomatis seluruh biner klien (Rust/C#) dan build aset CSS. |
| `developer_install.bat` | Skrip instalasi cepat virtual environment Python, dependencies pip, dan node modules. |
| `install.bat` | Skrip instalasi server produksi untuk pengguna akhir. |
| `start.bat` & `stop.bat` | Skrip otomasi start/stop background service server pada Windows. |
| `package.json` | Konfigurasi npm, devDependencies (TailwindCSS 3.4, Tauri CLI), dan skrip build vendor/CSS. |
| `requirements.txt` | Daftar pustaka Python backend (Flask 3.1.3, SQLAlchemy 2.0, APScheduler, Waitress, dll). |
| `tailwind.config.js` | Konfigurasi framework CSS Tailwind untuk dashboard kasir dan client kiosk UI. |
| `CHANGELOG.md` | Riwayat log perubahan dan rilis versi aplikasi (*Keep a Changelog standard*). |
| `README.md` | Ringkasan proyek publik, sorotan fitur, dan panduan instalasi cepat. |
| `AGENTS.md` | Dokumen panduan navigasi arsitektur terpadu bagi AI Coding Agent (file ini). |
| `LICENSE` | Lisensi open-source software (MIT License). |

---

### 2. Backend Server (`app/`)

#### A. Konfigurasi & Inisialisasi
- `app/config.py`: **Single Source of Version Truth** (`VERSION = "1.6.5-rc2"`), konfigurasi database SQLite, session lifetime, dan environment loader.
- `app/__init__.py`: Application Factory (`create_app()`), inisialisasi CORS, custom `TMBillingCSRFProtect`, Flask-Migrate, dan pendaftaran 31 blueprint.

#### B. Model ORM SQLAlchemy (`app/models/` — 18 Sub-Domain)
| Subfolder Model | Model SQLAlchemy & Entitas Data |
|---|---|
| `models/base/` | Model dasar, helper mixin, dan relasi umum. |
| `models/branch/` | `Branch` (cabang remote) & `BranchInbound` (koneksi inbound multi-branch). |
| `models/game/` | `Game` (daftar game klien) & `GameKategori` (kategori eSports/casual/FPS). |
| `models/grup/` | `Grup` (kategori ruangan PC: VIP, Reguler, VVIP beserta tarif per menit). |
| `models/hardware/` | `HardwareMonitor` (baseline spek CPU, GPU, RAM, Mobo) & `PCProcess` (daftar proses aktif). |
| `models/maintenance/` | `MaintenanceTicket` (pelaporan kerusakan hardware/peripheral PC dari member). |
| `models/member/` | `Member` (akun member, saldo prabayar, poin, status aktif). |
| `models/menu/` | `MenuItem` (menu FnB kantin, stok, harga) & `TransaksiMenu` (pesanan kasir). |
| `models/mikrotik/` | `MikroTikConfig` (konfigurasi RouterOS API untuk manajemen bandwidth per PC). |
| `models/paket/` | `Paket` (paket billing waktu tetap: 1 Jam, 3 Jam, Paket Malam, dll). |
| `models/pc/` | `PC` (registrasi client meja, IP, MAC address) & `PCUptimeLog` (log online & billing). |
| `models/sesi/` | `Sesi` (sesi bermain aktif, sisa waktu, jenis prepaid/postpaid, blackout token). |
| `models/settings/` | `Settings` (key-value konfigurasi sistem global, toleransi blackout, tarif minimum). |
| `models/shift/` | `ShiftRecord` (catatan shift kasir, modal awal, modal akhir, blind cash reconciliation). |
| `models/tournament/` | `Tournament`, `TournamentTeam`, `TournamentMatch` (bracket eSports eliminasi). |
| `models/transaksi/` | `Transaksi` (pembayaran billing meja kasir: Tunai, QRIS, Transfer). |
| `models/tutorial/` | `SystemTutorial` (artikel panduan operasional & CMS internal kasir). |
| `models/user/` | `User` (akun kasir & admin) & `AuditLog` (catatan jejak audit aktivitas kasir). |

#### C. Route Blueprints HTTP REST & WebSocket (`app/routes/` — 28 Sub-Domain)
| Subfolder Rute | Tanggung Jawab Endpoint |
|---|---|
| `routes/auth/` | Autentikasi kasir & admin (`/login`, `/logout`, verifikasi sesi). |
| `routes/backup/` | Manajemen backup database lokal SQLite dan integrasi cloud backup. |
| `routes/blackout/` | Endpoint penanganan toleransi pemulihan sesi pasca mati lampu. |
| `routes/branch/` | API multi-branch control panel, relay proxy inbound, dan sinkronisasi cabang. |
| `routes/client/` | Handshake client agent PC, detak jantung (heartbeat), dan penerimaan status sesi. |
| `routes/dashboard/` | Data agregat statistik dashboard kasir, total pendapatan hari ini, dan summary PC. |
| `routes/fileexplorer/` | Remote web disk explorer (browse folder, upload file, download file dari PC klien). |
| `routes/game/` | CRUD katalog game klien, uploader cover game, dan crop ikon otomatis. |
| `routes/grup/` | Manajemen grup ruangan dan penetapan tarif bertingkat. |
| `routes/hardware/` | Audit spek hardware, pembaruan baseline anti-maling, dan log perubahan komponen. |
| `routes/maintenance/` | Tiket servis pemeliharaan PC dan status perbaikan hardware. |
| `routes/member/` | Registrasi member, top-up saldo, reset password, dan riwayat transaksi member. |
| `routes/menu/` | Kasir FnB kantin, manajemen inventaris stok, kategori menu, dan cetak struk thermal. |
| `routes/mikrotik/` | Sinkronisasi queue bandwidth MikroTik dan monitoring traffic internet. |
| `routes/monitor/` | Telemetry metrik CPU/GPU/RAM real-time, task manager remote, dan task killer. |
| `routes/notes/` | Scratchpad / sticky notes serah terima pesan antar shift kasir. |
| `routes/paket/` | CRUD paket billing jam-jaman dan promosi khusus warnet. |
| `routes/pc/` | CRUD registrasi meja PC, pengaturan denah koordinat meja, dan status koneksi. |
| `routes/public/` | Billboard TV publik, leaderboard score eSports, dan landing page info tarif. |
| `routes/report/` | Laporan pendapatan berkala, ekspor PDF/Excel kasir, dan rekonsiliasi keuangan. |
| `routes/server_monitor/` | Status kesehatan internal server billing (CPU, RAM, Disk, CPU Temp Server). |
| `routes/sesi/` | Siklus hidup sesi (buka sesi, tambah waktu, pindah PC, tutup sesi paksa, stop sementara). |
| `routes/settings/` | Konfigurasi IP whitelist, token API, integrasi Cloudflare Tunnel, dan vacuum SQLite. |
| `routes/shift/` | Buka shift, tutup shift kasir dengan hitung buta (*blind cash reconciliation*). |
| `routes/tournament/` | Manajemen turnamen game, pendaftaran tim eSports, dan generator bagan bracket. |
| `routes/tutorial/` | CMS panduan sistem, artikel tutorial, dan upload media rich-text editor. |
| `routes/user/` | RBAC manajemen user kasir/admin dan penelusuran audit log lengkap. |
| `routes/vnc/` | WebSocket proxy relay streaming RFB TightVNC port 5900 dan bi-directional clipboard. |

#### D. Business Logic Services (`app/services/` — 32 Sub-Domain)
Seluruh aturan bisnis murni berada di layer service:
- `services/auth/`: Validasi kredensial, hashing password, dan manajemen token.
- `services/backup/`: Backup otomatis rotasi harian dan restore snapshot SQLite.
- `services/blackout/`: Logika pemulihan sesi berdasarkan threshold blackout terkonfigurasi.
- `services/branch/`: Proxy forwarding HTTP request dan WebSocket relay antar cabang.
- `services/cache/`: Subsystem in-memory cache berkecepatan tinggi (rincian di Bagian 3).
- `services/client/`: Manajemen handshake dan antrean perintah cepat client PC.
- `services/cloudflare_tunnel/`: Integrasi zero-trust Cloudflare Ingress daemon.
- `services/dashboard/`: Kalkulasi metrik visual denah meja dan kartu status PC.
- `services/fileexplorer/`: Validasi path keamanan (anti zip-slip/path traversal) remote explorer.
- `services/game/`: Manajemen file aset executable game dan integrasi launcher.
- `services/grup/`: Logika validasi tarif grup meja.
- `services/hardware/`: Evaluasi diskrepansi hardware baseline (anti pencurian komponen).
- `services/ip_whitelist/`: Proteksi akses kasir hanya dari subnet IP yang terdaftar.
- `services/maintenance/`: Alur status tiket perbaikan PC.
- `services/member/`: Transaksi saldo, potongan diskon tarif member, dan proteksi saldo minus.
- `services/menu/`: Pengurangan stok bahan makanan/minuman otomatis saat transaksi POS terjadi.
- `services/notes/`: Sinkronisasi catatan serah terima kasir.
- `services/owner/`: Agregasi statistik finansial khusus peran owner/pemilik warnet.
- `services/paket/`: Validasi durasi dan jam berlaku paket (contoh: paket malam).
- `services/pc/`: Manajemen status ketersediaan meja PC dan uptime tracking.
- `services/plugins/`: Ekstensi modul dinamis tambahan.
- `services/public/`: Format data tampilan TV billboard publik.
- `services/report/`: Kompilasi laporan keuangan harian/bulanan kasir.
- `services/server_monitor/`: Sensor telemetri performa mesin server utama.
- `services/sesi/`: Engine kalkulasi tarif per menit, sisa waktu billing, dan refund saldo.
- `services/settings/`: Cache write-through pengaturan aplikasi.
- `services/shift/`: Verifikasi selisih uang kas fisik kasir (blind reconciliation).
- `services/tournament/`: Engine pairing babak dan alur skor turnamen eSports.
- `services/transaksi/`: Pencatatan buku besar transaksi pembayaran.
- `services/tutorial/`: Manajemen konten artikel tutorial CMS.
- `services/user/`: Validasi RBAC hak akses pengguna.
- `services/vnc/`: Broker koneksi TCP TightVNC ke WebSocket klien browser.

#### E. Data Access Layer Repositories (`app/repositories/` — 14 Sub-Domain)
Pemisahan query ORM mentah dari service:
`game/`, `grup/`, `hardware/`, `member/`, `menu/`, `paket/`, `pc/`, `process/`, `sesi/`, `settings/`, `tournament/`, `transaksi/`, `tutorial/`, `user/`.

#### F. Middleware & Utilities (`app/middleware/` & `app/utils/`)
- `middleware/auth.py`: Decorator `@login_required`, `@admin_required`, `@shift_required`.
- `middleware/branch_proxy.py`: Inspeksi token server-to-server antar cabang.
- `middleware/ip_whitelist_middleware.py`: Filter akses IP subnet warnet.
- `utils/constants.py`: Konstanta global durasi, status sesi, dan kode error.
- `utils/helpers.py`: Response formatter JSON terstandar (`success_response`, `error_response`).
- `utils/logger.py`: Centralized audit logger ke file dan database.
- `utils/mikrotik_api.py`: Klien API RouterOS MikroTik berbasis socket.
- `utils/pdf_helper.py`: Generator laporan PDF struk kasir & rekap keuangan (ReportLab).
- `utils/scheduler_tasks.py`: Daemon tugas berkala APScheduler (auto-flush, auto-backup, expired cleanup).
- `utils/timezone_utils.py`: Formatter waktu terpusat (WIB/WITA/WIT/UTC).
- `utils/validators.py`: Sanitasi input data form kasir.

---

### 3. Sub-Modul In-Memory Cache (`app/services/cache/`)

Subsystem kritis pengeliminasi query disk SQLite berulang pada loop polling klien:

| Berkas Modul | Tanggung Jawab & Store |
|---|---|
| `client_state_store.py` | `OnlineStatusStore` (detak jantung PC < 15s) dan `AntiTheftGraceTracker` (toleransi boot 60s anti false-alarm hardware). |
| `command_store.py` | `CommandQueueStore` & `CommandQueueDict` (antrean perintah FIFO GUI & VNC fast-command per PC dengan proteksi memory leak). |
| `telemetry_store.py` | `ProcessMemoryStore` (snapshot Task Manager PC di RAM), `HardwareMetricsStore`, dan `TelemetryHistoryStore` (sliding window 3 snapshot). |
| `system_cache_store.py` | `SettingsCacheStore` (write-through cache pengaturan global) dan `PCNetworkCacheStore` (cache mapping IP/MAC -> metadata PC). |
| `uptime_store.py` | `UptimeMemoryStore` (akumulasi detik online & billing di RAM dengan flush batch berkala ke SQLite setiap 60s). |
| `memory_store.py` | **Facade re-export backward-compatibility** agar seluruh kode dan unit test tetap kompatibel. |

---

### 4. Client WarnetAgent (`WarnetAgent/`)

Aplikasi klien berjalan di setiap PC member/kiosk:

| Direktori / Biner | Tanggung Jawab & Cakupan |
|---|---|
| `TMBillingTauri/` | Source code klien utama: UI HTML/CSS kiosk lockscreen (`src/kiosk/`) & floating overlay bar (`src/overlay/`), Rust backend (`src-tauri/`) dengan Win32 low-level hooks penonaktifan tombol sistem Windows. |
| `MGCTM/` | Watchdog daemon C++ yang bertugas mengawasi proses `TMBilling.exe` dan memulihkan aplikasi secara otomatis jika dihentikan paksa. |
| `mtm/` | Auxiliary watchdog & resilience guard pelindung integritas service klien. |
| `TMBilling_Monitor/` | Daemon C# pengumpul metrik hardware (CPU/GPU load & temp, RAM, active window, NIC speed) via LibreHardwareMonitor. |
| `TMBilling_Uninstaller/` | Program uninstaller aman yang membersihkan hash registry, Win32 service, dan konfigurasi klien. |
| `Deploy/` | Skrip automasi firewall Windows (`allow_firewall.bat`), skrip sync registry, installer biner lengkap, dan TightVNC server loopback port 5900. |

---

### 5. Frontend Dashboard Kasir (`app/static/` & `app/templates/`)

#### A. Modular ES6 JavaScript (`app/static/js/kasir/`)
- `app.js`: Entry point inisialisasi aplikasi kasir, event delegation, dan routing tab.
- `core/api.js`: Klien HTTP REST terpusat dengan penanganan CSRF otomatis dan error reporting.
- `core/modal.js`: Pengendali modal dialog modular.
- `core/skeleton.js`: Standardized animated skeleton loader untuk 26 tab tampilan.
- `core/toast.js`: Sistem notifikasi toast floating modern.
- `core/utils.js`: Formatter mata uang Rupiah, kalkulator waktu, dan escape HTML sanitizer.
- `components/modal-buka.js`: Modal alur pembukaan sesi baru meja PC (Prepaid/Postpaid/Member).
- `components/modal-tambah.js`: Modal penambahan durasi waktu bermain.
- `components/modal-confirm-tambah.js`: Konfirmasi pembayaran perpanjangan durasi.
- `modules/dashboard/`: Logika view dashboard utama (`dashboard_card.js`, `dashboard_compact.js`, `dashboard_detail_modal.js`, `dashboard_process_monitor.js`, `dashboard_selection.js`, `map_view.js`, `sidebar.js`).
- `modules/`: 29 Modul fitur independen (`blackout.js`, `branch.js`, `catatan.js`, `fileexplorer.js`, `game.js`, `grup.js`, `hardware_checker.js`, `laporan.js`, `laporan_maintenance.js`, `laporan_menu.js`, `log.js`, `maintenance.js`, `member.js`, `menu.js`, `mikrotik.js`, `monitor.js`, `owner.js`, `paket.js`, `pc.js`, `remote.js`, `screenshot.js`, `server_monitor.js`, `settings.js`, `shift.js`, `struk.js`, `tournament.js`, `tutorials.js`, `uptime.js`, `user.js`).

#### B. Template Jinja2 HTML (`app/templates/`)
- `templates/kasir/base.html`: Shell induk HTML dashboard kasir, deklarasi CSS/JS dan meta CSRF.
- `templates/kasir/index.html`: Kontainer view 26 tab modular kasir.
- `templates/kasir/login.html`: Halaman login kasir dan administrator.
- `templates/kasir/components/`: Partisi navbar (`navbar.html`), sidebar (`sidebar.html`, `sidebar_admin.html`, `sidebar_kasir.html`), dan modal induk (`modals.html`).
- `templates/kasir/tabs/`: 32 Tampilan tab independen (`dashboard.html`, `menu.html`, `member.html`, `shift_history.html`, `fileexplorer.html`, `blackout.html`, dll).
- `templates/public/`: Halaman publik billboard TV (`tv/`), live scoreboard game (`livepc/`), portal member kiosk (`member/`), dan landing page info billing (`landing/`).

---

### 6. Subsystem Navigator: Where Things Live

Tabel pencarian cepat file penanggung jawab fitur operasional:

| Domain Fitur | Frontend JS | Backend Route & Service | Model Terkait |
|---|---|---|---|
| **Blackout Recovery** | `modules/blackout.js` | `routes/blackout/`, `services/blackout/` | `Sesi`, `PCUptimeLog` |
| **Process Monitor & Task Killer** | `modules/dashboard/dashboard_process_monitor.js` | `routes/monitor/monitor_routes.py`, `services/cache/telemetry_store.py` | `PCProcess`, in-memory store |
| **VNC Remote Control & Clipboard** | `modules/remote.js`, `core/vnc_client.js` | `routes/vnc/vnc_routes.py`, `services/vnc/` | `PC`, `Branch` |
| **POS Kantin & Billing FnB** | `modules/menu.js`, `modules/struk.js` | `routes/menu/menu_routes.py`, `services/menu/` | `MenuItem`, `TransaksiMenu` |
| **Hardware Baseline Anti-Maling** | `modules/hardware_checker.js` | `routes/hardware/`, `services/hardware/` | `HardwareMonitor` |
| **Shift Kasir (Blind Cash)** | `modules/shift.js` | `routes/shift/shift_routes.py`, `services/shift/` | `ShiftRecord`, `Transaksi` |
| **Multi-Branch Proxy Relay** | `modules/branch.js` | `routes/branch/branch_routes.py`, `services/branch/` | `Branch`, `BranchInbound` |
| **Web File Explorer Remote** | `modules/fileexplorer.js` | `routes/fileexplorer/`, `services/fileexplorer/` | `PC` |
| **Floor Plan / Visual Denah Meja** | `modules/dashboard/map_view.js` | `routes/pc/pc_routes.py`, `services/pc/` | `PC`, `Grup` |
| **CMS Artikel & Tutorial** | `modules/tutorials.js` | `routes/tutorial/`, `services/tutorial/` | `SystemTutorial` |
| **MikroTik Bandwidth QoS** | `modules/mikrotik.js` | `routes/mikrotik/`, `services/mikrotik/` | `MikroTikConfig` |
| **Turnamen eSports & Bracket** | `modules/tournament.js` | `routes/tournament/`, `services/tournament/` | `Tournament`, `TournamentMatch` |
| **Auto-Update & Migrasi Skema** | `modules/settings/migration.js` | `routes/settings/migration_routes.py`, `install_scripts/updater.bat` | Alembic skema, SQLite backups |

---

### 7. Perintah Cepat Pengujian & Build (Fast Commands)

Jalankan perintah-perintah berikut langsung di terminal atau command prompt:

```bash
# Menjalankan unit test pytest spesifik
.venv\Scripts\python.exe -m pytest tests/test_monitor_vnc_routes.py -v

# Menjalankan seluruh test suite
.venv\Scripts\python.exe -m pytest tests/ -v

# Cek sintaks JavaScript dengan Node.js
node -c app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js

# Compile ulang aset CSS Tailwind (minified)
npm run build:css

# Memulai server development
python run.py

# Kompilasi ulang seluruh biner deploy klien & server
build_and_deploy.bat
```

---

## 🔄 Aturan Pemeliharaan Dinamis (Dynamic Maintenance Rule)

> [!IMPORTANT]
> **ATURAN WAJIB BAGI SETIAP AGENT AI**:
> 1. Setiap kali Anda menambahkan folder baru, file baru, modul baru, endpoint API baru, atau memindahkan arsitektur kode pada repositori ini:
>    **Anda WAJIB memperbarui pemetaan tabel pada AGENTS.md ini.**
> 2. Peta ini adalah referensi langsung agar sesi baru agent AI di masa mendatang dapat langsung memahami konteks proyek secara instan tanpa perlu eksplorasi redundan.
> 3. Jaga agar deskripsi direktori dan tautan berkas selalu sinkron dengan kondisi *working tree* terkini.

---

## 📜 Panduan Operasional & Praktik Terbaik Agent (Portable Best Practices)

### 1. Prinsip Utama (Core Principle)
- Semua instruksi harus kontekstual dan adaptif terhadap repositori aktif.
- Jangan berasumsi bahwa arsitektur atau teknologi repositori lain berlaku di repositori ini.
- Terapkan solusi yang minimalis, rapi, dan menjaga backward-compatibility.

### 2. Berpikir dalam Kode (Think in Code)
- Untuk analisis data, pencarian menyeluruh, parsing, perbandingan, atau transformasi skrip:
  Jalankan skrip pembantu (Node.js atau Python) secara lokal dan cetak hanya kesimpulan/hasil yang relevan, daripada membuang ribuan baris teks mentah ke dalam konteks percakapan.
- Tangani error dengan blok `try/catch` atau `try/except` yang kokoh.

### 3. Operasi Repositori & Berkas
- **Sebelum Mengedit**: Periksa file yang relevan, telusuri alur pemanggilan fungsi, dan pahami dependensi antar komponen.
- **Saat Mengedit**: Ubah hanya baris/komponen yang berkaitan langsung dengan tugas. Hindari refactoring massal yang tidak diminta.
- **Setelah Mengedit**: Lakukan validasi sintaks dan jalankan automated test terkait untuk menjamin tidak ada regresi.

### 4. Konteks Khusus TMBilling
- **Backend**: Flask 3.1.3 + Python 3.10+ (ORM SQLAlchemy 2.0).
- **Frontend**: Vanilla ES6 JavaScript Modular (tanpa Webpack/Vite bundler runtime pada dashboard kasir).
- **Client**: Rust Tauri v2 + C# / C++ watchdog daemons.
- **Database**: SQLite (`warnet.db` produksi / `test_warnet.db` unit test).
- **Single Source of Version**: `app/config.py` (`Config.VERSION`).
- **Cache Transient**: Seluruh data yang sering di-polling klien WAJIB melalui in-memory store di `app/services/cache/` untuk melindungi disk SQLite.

### 5. Komunikasi
- Respon selalu menggunakan **Bahasa Indonesia** kecuali jika diminta lain oleh pengguna.
- Lugas, teknis, praktis, dan langsung pada pokok permasalahan.
- Paparkan alasan teknis di balik setiap keputusan arsitektural atau perbaikan bug.
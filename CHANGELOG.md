# Changelog

Semua perubahan penting dan rekam jejak rilis pada proyek **TMBilling** didokumentasikan dalam berkas ini.

Format pencatatan mengikuti panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan menganut [Semantic Versioning](https://semver.org/lang/id/).

---

## [1.6.4] - 2026-10-09

### Ditambahkan
- **Refactoring Desain Overlay Client (Apple Dark-Mode Aesthetic)**:
  - Palet gelap elevasi modern (`#161618`, `#1c1c1e`, `#2c2c2e`) dengan aksen mint (`#30d158`) dan hairline borders (`border-white/10`).
  - Segmented pill controls terstandarisasi untuk navigasi modal (Katalog Menu FnB, Daftar Paket).
  - Eliminasi total animasi berulang/looping (pulse, spin, infinite effects) untuk menghemat alokasi CPU/GPU gaming dan kompatibilitas display refresh rate tinggi (144Hz / 240Hz).
- **Auto-Hide Floating Overlay Card pada Modal Aktif**:
  - Otomatis menyembunyikan floating widget `#overlay-main-card` saat modal QRIS Fullscreen HD atau Katalog Menu/Paket dibuka.
  - Memulihkan visibilitas kartu utama secara mulus saat modal ditutup atau di-reset.
- **Engine Validasi Waktu Unlimited Berbasis Status Murni**:
  - Format waktu riil (`X jam Y menit` / `00:00:00`) untuk seluruh durasi kuota member tanpa batas atas buatan (termasuk kuota 1.000 s/d 1.000.000+ jam).
  - Tampilan teks `"Unlimited"` secara eksklusif hanya diberikan pada sesi dengan status valid `admin` atau `system`.
  - Mengeliminasi CPU thrashing render loop dan menjaga performa klien tetap konstan.
- **Pembersihan & Keamanan Kredensial Administrator Klien**:
  - Form input username dan password admin pada modal darurat agen dibersihkan seketika pada saat login success, login error, maupun pembatalan (cancel/close).
  - Mencegah residu kredensial tertinggal di DOM/memori form browser klien.

## [1.6.3] - 2026-10-05

### Ditambahkan
- **Floor Plan Engine v1.6.3 (Denah Meja Asinkronus & Unmapped Coordinates)**:
  - Optimasi penyimpanan posisi meja dengan async batching `Promise.all()` di `map_view.js` dan sinkronisasi instan via `Dashboard.load(true)`.
  - Dukungan koordinat meja unmapped (`pos_x = -1, pos_y = -1`) dengan validasi skema database `-1..10000`.
  - Mekanisme reactive rerender di tempat (`_hasStructureChanged`) tanpa melakukan reload halaman browser penuh.
- **Hardware Checker & Security Audit v1.6.3**:
  - Pemisahan entri Motherboard menjadi **Mobo Model** (model papan) dan **Mobo Serial** (serial anti-theft unik) pada baseline dan live telemetry.
  - Sinkronisasi payload dictionary `"Motherboard"` dan `"MotherboardSerial"` di `HardwareService.process_hardware_metric`.
  - Referensi estimasi rentang jam rekaman CCTV (*Smart CCTV Time Window*) untuk setiap indikasi pergantian/pencopotan komponen internal PC.
- **Standardized Skeleton Loading Engine**:
  - Engine shimmer loading terpusat di `app/static/js/kasir/core/skeleton.js` yang terintegrasi di seluruh 26 tab antarmuka kasir.
  - Mengeliminasi spinner berputar usang (`fa-spin`, `animate-spin`).
- **Arsitektur Proteksi Triple-Layer Session Expiry**:
  - Layer 1: Background Server Scheduler (APScheduler 60 detik di `run.py`).
  - Layer 2: Realtime Client Polling (Tauri Kiosk 1–3 detik di `ClientService.get_status`).
  - Layer 3: Frontend Dashboard Polling (Kasir web 1, 2, 3, 5 detik di `DashboardService.get_pc_list`).

## [1.6.2] - 2026-10-01

### Ditambahkan
- **Fitur Kunci Meja AFK / Istirahat Sementara (Temporary AFK Screen Lock)**:
  - Fitur penguncian layar PC klien sementara saat pengguna meninggalkan meja (istirahat, makan, ibadah, dll) dengan proteksi keyboard hook & penyembunyian taskbar.
  - Tampilan layar AFK minimalis bertema hitam polos murni (`bg-black`, `#000000`) dengan mono timer countdown billing yang tetap berjalan aktif.
  - Alur autentikasi unlock aman:
    - Akun **Member**: Langsung mengunci meja tanpa form PIN; membuka kunci menggunakan password akun member.
    - Sesi **Guest**: Meminta pembuatan 4–6 digit PIN angka sementara saat mengunci; membuka kunci menggunakan PIN tersebut.
  - Remote control & **Master Unlock** dari Kasir: Tombol `🔒 Kunci Meja AFK` dan `🔓 Buka Kunci AFK (Master Unlock)` di dalam Detail Modal PC pada Dashboard Kasir untuk membantu pelanggan yang lupa PIN/password.
  - Indikator status real-time di Dashboard Kasir: Badge amber menyala `🔒 AFK / Istirahat` pada kartu grid PC dengan timer dan nama pengguna tetap tampil lengkap.
  - **100% Backward Compatibility**: Kolom `is_afk`, `afk_pin`, `afk_sejak` di-upgrade otomatis via *Self-Healing Auto-Migration* di `app/__init__.py` dan `migration_routes.py`.
- **Shift Kasir & Serah Terima Shift (Hitung Buta / Blind Cash Reconciliation)**:
  - Sistem serah terima shift kasir anti-manipulasi berbasis *Blind Count*: angka pendapatan seharusnya disembunyikan saat kasir mengakhiri shift.
  - Alur Buka Shift dengan modal awal dinamis dan validasi nominal `Rp 0 s/d Rp 100.000.000` (`Utils.formatInputRupiah`).
  - Rekonsiliasi laci kas otomatis: pembandingan kas fisik aktual vs total modal awal + transaksi tunai bersih, menghasilkan status terkunci `PAS / Rp 0`, `SURPLUS (+)`, atau `DEFISIT (-)`.
  - Pemisahan penerimaan tunai (Cash) vs non-tunai (QRIS / Bank) secara otomatis pada model `ShiftRecord`.
  - Fitur **Admin Force Close Shift**: kemampuan administrator menutup paksa shift kasir aktif dalam situasi darurat dengan alasan yang terekam di audit log.
  - Polling real-time status shift kasir aktif di sidebar admin dan kasir tanpa perlu reload halaman.
  - Pencetakan **Struk Thermal Handover 58mm / 80mm** dan struk browser untuk bukti fisik serah terima kasir.
  - Tab **Riwayat Serah Terima Shift** dengan filter tanggal cepat (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Semua), badge status, dan modal rincian shift.
- **Log Mutasi Stok Menu (`MenuStockLog`) & Restock Audit**:
  - Model database `MenuStockLog` dan migrasi `c9d8e7f6a5b4` untuk mencatat seluruh mutasi stok barang (Restock, Transaksi Penjualan, Penyesuaian Audit).
  - Tab **Log Stok Menu** dengan filter tanggal cepat, filter operator, pagination server-side, dan ekspor data.
  - Otorisasi RBAC untuk penambahan stok makanan/minuman oleh staff/kasir dengan pencatatan audit log otomatis.
- **Konsolidasi Master Dokumentasi (Single Source of Truth)**: 
  - Seluruh dokumentasi sistem dan arsitektur dilebur ke dalam [docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md) yang mencakup katalog lengkap 28 domain fitur, panduan backend (30 blueprints, 35+ services, 26 database models), frontend modular JS, serta panduan teknis agent Rust.
  - Pembaruan dokumen ringkas [README.md](file:///c:/Project%20GIT/TMBilling/README.md) dengan panduan Quick Start terstandarisasi.
- **Dual-Hive Registry SHA-256 Binary Integrity**:
  - Penambahan verifikasi hash SHA-256 binary pada registry `HKCU` dan `HKLM` (`Hash_MGCTM`, `Hash_TMBilling`, `Hash_TMMonitor`, `Hash_mtm`, `Hash_Uninstaller`) untuk mencegah manipulasi binary klien oleh pihak ketiga.
- **Bi-directional Clipboard Sync & Auto-Firewall TightVNC**:
  - Sinkronisasi clipboard dua arah otomatis antara browser kasir dan desktop Windows PC klien melalui WebSocket VNC proxy port `5900` loopback.
  - Penyediaan skrip otomatisasi firewall Windows Defender `allow_firewall.bat` dan `tightvnc_settings.reg`.
- **Blackout Auto-Recovery System**:
  - Toleransi pemadaman listrik otomatis dengan pencatatan heartbeat `PCUptimeLog` dan pemulihan sisa waktu pelanggan secara otomatis saat PC kembali menyala (*Auto Session Resume*).
- **Chain Sesi Pindah PC (`sesi_asal_id`)**:
  - Penambahan kolom `sesi_asal_id` (ForeignKey ke `sesi.id`) pada model `Sesi` untuk melacak rantai sesi akibat perpindahan PC (*pindah PC*), memungkinkan penelusuran seluruh riwayat sesi pelanggan dari satu PC ke PC lain dalam satu grup yang sama.
  - Dimanfaatkan oleh `sesi_service.py` dan `blackout_service.py` untuk menjaga konsistensi data refund dan recovery saat sesi dipindahkan.
  - Skema database di-upgrade otomatis via *Self-Healing Auto-Migration* di `app/__init__.py` dan `migration_routes.py` (migrasi `a8f1b2c3d4e5`).
- **Sesi Kasir Benefit (`user_id` pada Model `Sesi`)**:
  - Penambahan kolom `user_id` (ForeignKey ke `user.id`) pada model `Sesi` untuk mendukung sesi bermain staf kasir / benefit internal, dipisahkan dari sesi member reguler.
- **Overhaul Deteksi Hardware TMMonitor (LibreHardwareMonitor Exclusive)**:
  - `TMBilling_Monitor` (`TMMonitor.exe`) kini menggunakan `HardwareHelper.exe` (berbasis LibreHardwareMonitor kernel driver) sebagai *sumber tunggal* untuk nama hardware (CPU, GPU, Motherboard), menggantikan fallback WMI `Win32_VideoController` yang rentan terhadap GPU display adapter palsu.
  - Serial number motherboard kini dibaca via WMI `Win32_BaseBoard` (struct `BaseBoardInfo`: `SerialNumber`, `Product`, `Manufacturer`) untuk presisi identifikasi yang lebih akurat.
  - Eliminasi false positive GPU "Microsoft Basic Display Adapter" atau adapter palsu pada hasil Hardware Checker.
- **Modul Validasi Input Terpusat (`app/utils/validators.py`)**:
  - Penambahan modul utilitas validasi dan sanitasi input pengguna yang digunakan oleh seluruh domain sistem (User, Member, PC, Grup, Paket, Menu, Sesi, Branch).
  - Fungsi tersedia: `validate_username`, `validate_password`, `validate_integer_range`, `validate_string_length`, `validate_hex_color`, `validate_phone_number`, `validate_ip_address`, `validate_url`, `validate_choice`, `validate_filename`, dan lainnya.

### Diubah
- **Restrukturisasi Direktori Klien**:
  - Pemindahan seluruh modul klien dari `WarnetClient/TMBillingTauri` ke direktori terpusat `WarnetAgent/TMBillingTauri` untuk konsistensi penamaan arsitektur.
  - Penyesuaian skrip otomatisasi root `build_and_deploy.bat`, `developer_install.bat`, dan `WarnetAgent/Deploy/build_and_deploy.bat`.
- **Label Tombol Shift Kasir**:
  - Penggantian label tombol aksi di sidebar kasir dari `Serah Terima Shift` menjadi `Akhiri Shift`.

### Diperbaiki
- **Modal Tutup Shift Layout**:
  - Perbaikan struktur tag penutup HTML pada `showTutupShiftModal()` di `app/static/js/kasir/modules/shift/index.js` agar layout modal stabil dan rapi pada breakpoint `LG`, `XL`, dan `2XL`.
- **Responsivitas Tabel Breakpoint LG**:
  - Penyesuaian styling tata letak tabel agar *fit-to-table* (tidak terpotong) pada breakpoint `LG` untuk tab **Riwayat Serah Terima Shift**, **Log Stok Menu**, dan **Riwayat Transaksi (Struk)**.
- **Batch Actions Multi-PC API**:
  - Konsolidasi deklarasi ganda namespace `API.monitor` pada `app/static/js/kasir/core/api.js` sehingga pemanggilan `API.monitor.remoteBatch` untuk aksi massal (>1 PC: Shutdown, Restart, Lock, Move PC, Clear Sesi) berjalan normal tanpa error JavaScript.

---

## [1.6.1] - 2026-09-15

### Ditambahkan
- **Sentralisasi Master Versioning**: `app/config.py` (`Config.VERSION`) kini menjadi Single Source of Truth untuk seluruh komponen Python backend, template HTML, CSS cache-busting, dan frontend JavaScript.
- **Dynamic Asset Cache-Busting**: Query string cache buster pada seluruh stylesheet dan script Jinja2 diinjeksi secara otomatis melalui Flask context processor (`?v={{ v_cache }}`).
- **Global Client Version Injection**: Penyuntikan `<meta name="app-version">` dan `window.APP_VERSION` pada halaman Kasir untuk sinkronisasi otomatis status versi pada komponen UI client.

### Diperbaiki
- **Sidebar Submenu Alignment**: Perbaikan tata letak flex (`items-start` dengan `gap-2.5`) pada submenu sidebar kasir agar label menu yang panjang (seperti *Laporan Perawatan & Catatan*) melakukan text wrapping dengan rapi dan ikon menu tetap sejajar pada baris pertama.
- **Multi-Cabang State Reset**: Penambahan reset state otomatis pada modul Kasir (Member, Perawatan PC, Laporan Perawatan, Screenshot Monitor, Blackout, dan Web VNC Client) saat beralih antar cabang agar data lokal dan remote tidak tercampur.
- **VNC Relay Synchronization**: Sinkronisasi rute relay multi-cabang untuk remote monitor mouse, keyboard, dan framebuffer events.

### Ditingkatkan
- **Pembersihan Dashboard Kasir**: Penghapusan 4 kartu ringkasan statistik dari bagian atas tab Dashboard kasir untuk antarmuka yang lebih bersih, cepat, dan fokus pada status grid PC.
- **Modal Tambah Waktu Member**: Perluasan modal pencarian & pengisian waktu member pada Dashboard (`max-w-4xl`) dengan grid 2-kolom responsif dan list 5 hasil member tanpa scrollbar.

---

## [1.6.0] - 2026-09-06

### Ditambahkan
- **Multi-Cabang (Central Control Panel & Remote Relay)**:
  - Kemampuan mengontrol dan memantau beberapa server cabang warnet secara terpadu melalui dropdown switcher di navbar Kasir.
  - Arsitektur Reverse-Proxy Relay berbasis API Key terenkripsi untuk meneruskan request endpoint kasir, media/screenshot, dan VNC secara transparan.
  - Fitur pemantauan *Inbound Connections* dan health check latensi koneksi antar cabang.
- **Web VNC Remote Desktop Client**:
  - Integrasi canvas noVNC modern langsung di dalam dashboard Kasir untuk kendali jarak jauh layar PC client.
  - Dukungan adaptive display scaling, koordinat pointer dinamis, mapping keyboard shortcut, serta fail-fast diagnostic monitoring.
- **Automated Dynamic QRIS Payment**:
  - Integrasi pembayaran otomatis QRIS dinamis & Midtrans dengan status verifikasi instan.

---

## [1.5.8] - 2026-08-25

### Ditambahkan
- **Natural Sorting Screenshot Monitor**: Pengurutan nama PC secara alami (contoh: PC-01, PC-02, ..., PC-10) pada monitor screenshot kasir.
- **Overlay Properties Enhancement**: Sinkronisasi properti overlay informasi sisa waktu pada client Tauri.

---

## [1.5.5] - 2026-08-22

### Ditambahkan
- **Chamber Noir UI Design System**: Transformasi tema antarmuka kasir ke warna gelap pekat premium (*Chamber Noir*) dengan aksen kontras tinggi dan tipografi modern (*Space Grotesk* & *JetBrains Mono*).
- **Web-based File Explorer**: Eksplorasi file log, backup, dan media server langsung dari dashboard admin kasir.
- **Smart Tutorial Seeding**: Sistem manajemen tutorial dan wiki operasional bawaan.

---

## [1.5.2] - 2026-08-16

### Ditambahkan
- **Cloudflare Zero-Trust Tunnel Integration**: Akses dashboard kasir dan TV signage dari jaringan publik/internet tanpa perlu IP publik statis atau port forwarding router.
- **Automated Cloud Backup (Google Drive & Local)**: Pencadangan otomatis basis data SQLite dan konfigurasi ke penyimpanan awan terenkripsi.

---

## [1.5.1] - 2026-08-10

### Ditambahkan
- **Real-Time Server Hardware Monitoring**:
  - Layanan mikro `TMLHMService` berbasis LibreHardwareMonitor untuk memantau metrik suhu, beban kerja CPU, GPU, RAM, disk, dan throughput jaringan server.
- **PC Uptime Tracking**: Pencatatan durasi hidup dan utilisasi PC client dengan konversi zona waktu lokal (`Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`).
- **Sistem Tiket Perawatan PC (Maintenance)**: Pencatatan riwayat kerusakan, servis, pergantian sparepart, dan log operasional teknisi warnet.
- **Audit Logs Category Grouping**: Pengelompokan log aktivitas kasir berdasarkan kategori modul (*Billing*, *Member*, *PC*, *Sistem*, *Transaksi*).

---

## [1.0.0] - 2026-06-01

### Rilis Perdana
- Rilis awal sistem billing warnet **TMBilling**.
- Core engine berbasis Flask & SQLAlchemy (Server) dan Rust Tauri (Client Desktop Windows).
- Manajemen sesi PC (Personal, Paket, Member, Voucher), POS Kasir Menu/F&B, dan cetak struk termal.

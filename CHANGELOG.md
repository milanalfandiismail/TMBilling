# Changelog

Semua perubahan penting dan rekam jejak rilis pada proyek **TMBilling** didokumentasikan dalam berkas ini.

Format pencatatan mengikuti panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan menganut [Semantic Versioning](https://semver.org/lang/id/).

---

## [1.6.4] - 2026-10-11

### Ditambahkan
- **Overhaul Responsif & Redesain UI/UX Tab Kantin / POS F&B (Mobile-First to Desktop)**:
  - **Sistem Grid Adaptif Multi-Breakpoint**: Merestrukturisasi grid katalog produk (`#menu-catalog-grid`) di seluruh 6 tingkatan breakpoint Tailwind CSS:
    - Default (`< 640px`: spektrum 320px–639px): Grid 2 kolom seimbang (kartu 130px–185px) dengan **`overflowPx === 0`** tanpa horizontal scrollbar.
    - `sm:` (640px): Grid ditingkatkan menjadi 3 kolom (`sm:grid-cols-3`), mengeliminasi masalah kartu melar berlebihan (269px) menjadi ~180px proporsional.
    - `md:` (768px): Grid 3 kolom (`md:grid-cols-3`, kartu ~212px).
    - `lg:` (1024px): Layout split berdampingan (Katalog 7 kolom : Keranjang 5 kolom, kartu ~195px).
    - `xl:` (1280px): Grid katalog disesuaikan menjadi 3 kolom (`xl:grid-cols-3`), mengeliminasi bug kartu terjepit (sebelumnya hanya 147px, kini menjadi ~202px yang lapang dan elegan).
    - `2xl:` (1536px+): Grid 4 kolom (`2xl:grid-cols-4`, kartu ~217px).
  - **Mobile Floating Bottom Action Bar (`#menu-mobile-cart-bar`)**:
    - Mengintegrasikan bar mengambang interaktif di bagian bawah layar pada viewport `< lg` yang otomatis muncul saat keranjang terisi (`Total: RpXX.XXX • X item`).
    - Menyediakan tombol pintas langsung *"Keranjang"* (smooth scroll) dan tombol *"Bayar"* (langsung membuka modal pembayaran POS tanpa perlu scroll melewati puluhan produk).
    - Otomatis disembunyikan saat keranjang kosong.
  - **Penyempurnaan Segmented Control View Switcher (Katalog Menu vs Arsip Menu)**:
    - Memperbaiki bug kerusakan layout dan pergeseran tombol saat diklik dengan memisahkan *base layout classes* (`w-full sm:w-auto`, `justify-center`, `rounded-md`) dari *theme classes*, serta mengamankan kelas `.remote-hide-action` pada tombol arsip.
    - Mengeliminasi emoji kardus berantakan (`📦`) dan menggantikannya dengan ikon SVG ramping yang simetris dan konsisten pada tab `Katalog Menu` dan `Arsip Menu`.
    - Di layar mobile (`< sm`), tab switcher menggunakan `grid grid-cols-2` sehingga kedua tombol terbagi 50:50 dengan lebar identik (164px &times; 164px) tanpa pergeseran atau loncatan lebar saat berpindah tampilan.
  - **Perbaikan Tata Letak Search Bar & Toolbar Katalog pada Breakpoint LG (1024px)**:
    - Mengatasi masalah search bar yang terdorong keluar batas kartu (`overflowPx > 0`) pada breakpoint LG akibat pembagian 2 kolom berdampingan (Katalog 7 : Keranjang 5) yang mempersempit ruang kartu katalog menjadi ~407px (tidak muat untuk Switcher 233px + Search Box 208px jika dipaksa horizontal).
    - Menerapkan tata letak bertingkat adaptif pada breakpoint LG (`lg:flex-col lg:items-start`), di mana View Switcher ditempatkan rapi di baris atas dan Search Bar membentang penuh 100% (`lg:w-full`) di baris bawah.
    - Pada resolusi XL/2XL (`>= 1280px`), Search Bar dan Switcher secara otomatis kembali berdampingan (`xl:flex-row xl:w-60`) karena ruang kontainer sudah sangat lapang (> 640px).
    - Memastikan nilai **`overflowPx === 0`** di seluruh breakpoint dengan placeholder dan teks pencarian yang terbaca sempurna tanpa terpotong.
  - **Aksi Kelola Menu Khusus Layar Sentuh / Handphone (`< lg`)**:
    - Memecahkan keterbatasan perangkat ponsel/tablet layar sentuh yang tidak memiliki mouse hover (`opacity-0 group-hover:opacity-100` tidak dapat dijangkau di smartphone).
    - Menyematkan tombol aksi titik tiga (`⋮`) ramah sentuhan di pojok kanan atas kartu menu pada layar `< lg` (khusus role Admin).
    - Mengetuk tombol titik tiga menampilkan **Action Sheet / Modal Kelola Menu Ringkas** dengan target sentuh jari yang nyaman (44px+) untuk aksi: Tambah Stok (Restock), Edit Nama, Harga & Foto, Lihat Foto Fullscreen, Arsipkan Menu, dan Hapus Permanen.
    - Pada layar desktop monitor (`lg:` ke atas), tombol hover mouse tetap berfungsi secara native dengan tombol `⋮` otomatis disembunyikan.
  - **Penyempurnaan Keranjang Belanja (*Cart Panel*)**:
    - Menambahkan tombol *"Kosongkan Keranjang"* (`#menu-cart-clear-btn`) di header keranjang.
    - Menyesuaikan batas ketinggian vertikal item keranjang secara responsif hingga `2xl:max-h-[620px]` untuk memanfaatkan ruang layar monitor desktop/2K secara maksimal.
  - **Penataan Modal Transaksi POS & Quick Cash**:
    - Merapikan pecahan uang cepat (`Rp1K`–`Rp100K`) beserta tombol *"Uang Pas"* ke dalam grid responsif 4 kolom &times; 2 baris (`grid grid-cols-4 gap-1.5`) yang simetris dan rapi di semua perangkat.
    - Menyelaraskan padding dan tipografi kartu menu serta aksi hover admin.
- **Perbaikan Bug Redundant DOM Re-render pada Tab List Koneksi Cabang & Akun Kasir Cabang**:
  - Mengeliminasi penghapusan dan re-render DOM berulang yang terjadi pada setiap interval polling global di modul `BranchManager` (`tab-branch_inbound` dan `tab-branch_kasir`).
  - Mengimplementasikan fingerprinting berbasis data (`_lastInboundFingerprint`, `_lastOperatorsFingerprint`, `_lastBranchesFingerprint`) dan mode *silent poll* (`isSilent = true`), sehingga tabel hanya dirender ulang saat data benar-benar berubah di backend.
  - Menghilangkan kemunculan baris spinner / teks "Memuat..." yang sebelumnya merusak tampilan dan mereset interaksi pengguna setiap beberapa detik.
  - Menjaga interval polling tetap konsisten mengikuti ritme global dashboard tanpa mengganggu modal dialog yang sedang terbuka atau input pencarian pengguna.
- **Penyempurnaan Filter Tanggal Mutasi Log Stok Menu (Hanya Tanggal yang Ada Data)**:
  - Mengganti input tanggal kalender terbuka (`<input type="date">`) menjadi dropdown selektif dinamis (`<select id="stock-log-filter-date">`) pada tab `tab-menu_stock_log`.
  - Dropdown hanya menyajikan tanggal-tanggal unik yang benar-benar memiliki riwayat mutasi stok (`MenuRepository.get_distinct_stock_log_dates`), mencegah kasir memilih tanggal kosong yang tidak memiliki data.
  - Opsi dropdown berformat tanggal Indonesia `DD/MM/YYYY` dengan nilai ISO `YYYY-MM-DD`, terintegrasi otomatis dengan aksi reset filter dan live polling.
  - Menambahkan endpoint REST API dedicated `GET /api/v1/kasir/menu/stock-logs/dates` dan properti `dates` pada payload respons `GET /api/v1/kasir/menu/stock-logs`.
- **Optimasi Responsif "Fit-to-Table" Mobile Portrait Tanpa Prefix (`< sm`: 360px – 430px) pada 7 Tab Kasir**:
  - **Zero Horizontal Overflow (`overflowPx === 0`) pada Layar Ponsel**: Mengeliminasi scrollbar horizontal dan memastikan seluruh konten dan tombol aksi terlihat 100% pas (*Fit-to-Table*) pada layar smartphone (iPhone 14 @ 390px, Android @ 360px) pada 7 tab kasir:
    1. `tab-menu_stock_log`: Padding sel ringkas `px-1.5 sm:px-3`, badge mutasi kompak, tombol Detail berbasis ikon di mobile (`<span class="hidden sm:inline">Detail</span>`), format tanggal ringkas `DD/MM HH:mm`.
    2. `tab-shift_history`: Header responsif `Petugas`, `Omset`, `Laci`, stacking tanggal dan rentang jam vertikal, status badge ringkas `SEL`, kontrol aksi ramping.
    3. `tab-user_logs`: Header & padding responsif `p-2 sm:p-3`, penanggalan log ringkas `MM-DD HH:mm`, tombol Detail berbasis ikon pada mobile.
    4. `tab-maintenance`: Tombol aksi icon-only pada mobile (`🔍`, `▶`, `✕`, `✓`, `🗑`), batasan lebar judul masalah dinamis `max-w-[55px] sm:max-w-[150px]`, sel padding `px-0.5 sm:px-2`.
    5. `tab-laporan_maintenance`: Padding kontainer & tabel ramping `p-1.5 sm:p-2.5`, format tanggal ringkas, tombol Detail icon-only pada mobile.
    6. `tab-monitor`: Badge suhu CPU & GPU ultra-kompak `min-w-[28px] sm:min-w-[54px]`, indikator kecepatan jaringan ringkas `1G`, kolom aksi hemat ruang.
    7. `tab-hardware_checker`: Badge status hardware ringkas (`🛡️`, `🚨`, `⚙️` pada `< sm`), adapter LAN ringkas `1G`, tombol aksi Detail & Baseline berbasis ikon di layar mobile.
  - **Preservasi 100% Fit-to-Table pada Breakpoint `sm` (640px), `md` (768px), dan `lg` (1024px)**: Teruji bebas regresi (`overflowPx === 0`) di seluruh breakpoint standar Tailwind CSS.
- **Optimasi Responsif "Fit-to-Table" Multi-Breakpoint (`sm` 640px & `md` 768px) pada 7 Tab Kasir**:
  - **Eliminasi Total Horizontal Overflow & Kolom Terpotong**: Mengeliminasi kolom terpotong atau tersembunyi ke sisi kanan (`overflowPx === 0`) pada 7 tab utama antarmuka kasir tanpa scrollbar horizontal:
    1. `tab-menu_stock_log` (Logstok Menu F&B): Arsitektur adaptif 4 kolom (`Waktu & Petugas`, `Menu`, `Stok & Mutasi`, `Aksi`) dengan tombol Detail ringkas `h-7`.
    2. `tab-shift_history` (Riwayat Serah Terima Shift): Arsitektur adaptif 5 kolom (`Petugas & Waktu`, `Penerimaan`, `Kas & Selisih`, `Status`, `Aksi`) menyatukan penerimaan & kas bertingkat.
    3. `tab-user_logs` (Log Audit Staff): Arsitektur adaptif 4 kolom (`Waktu & Operator`, `Aksi & IP`, `Keterangan`, `Aksi`) pada layar mobile/tablet.
    4. `tab-maintenance` (Perawatan PC): Arsitektur adaptif 4 kolom (`PC & Prioritas`, `Masalah & Detail`, `Status & Pelapor`, `Aksi`) dengan tombol aksi ringkas (`Detail`, `Proses`, `Tolak`, `Selesai`, `Hapus`).
    5. `tab-laporan_maintenance` (Laporan Perawatan): Pembatasan lebar (`max-w-[130px] sm:max-w-[180px] md:max-w-[220px] truncate`) pada judul masalah & resolusi serta normalisasi padding sel.
    6. `tab-monitor` (Monitor Hardware): Penataan kontainer responsif (`p-3 sm:p-4 lg:p-4 xl:p-6`), eliminasi date string overflow di kolom aksi pada breakpoint `sm`, dan perampingan sel.
    7. `tab-hardware_checker` (Hardware Checker): Penataan kontainer responsif (`p-3 sm:p-4 lg:p-4 xl:p-6`), tombol aksi kompak (`Detail` & `Baseline`), dan format waktu sinkronisasi ringkas.
  - **Preservasi Penuh Tampilan Desktop (`lg`, `xl`, `2xl`)**: Menjaga tabel tetap luas dengan seluruh kolom terpisah (`hidden lg:table-cell`) saat diakses pada monitor desktop standar atau lebar.
- **Optimasi Responsif & Paginasi Tab Perawatan PC (Zero Scroll Multi-Breakpoint)**:
  - **Redesain 2-Kolom Modal Detail Tiket Perawatan PC**: Membagi struktur modal detail (`modal-detail-ticket`) menjadi 2 kolom responsif (`sm:grid sm:grid-cols-2 lg:gap-3.5 xl:gap-4.5`) serupa modal riwayat serah terima shift kasir, memisahkan kelompok identitas PC & pelapor di sisi kiri dengan rincian deskripsi masalah, status penyelesaian, serta biaya perbaikan di sisi kanan untuk mengeliminasi vertical scrollable di resolusi `sm`, `md`, `lg`, `xl`, dan `2xl`.
  - **Limit 5 Item per Halaman & Paginasi**: Membatasi tampilan tiket perawatan menjadi tepat 5 data per halaman secara dinamis di modul `Maintenance`, dilengkapi bar navigasi paginasi ringkas (`Menampilkan X - Y dari Z tiket`, tombol `← Sebelumnya`, dan tombol `Berikutnya →` dengan penanganan boundary disabled).
  - **Single Unified Card Layout**: Menyatukan 3 kartu terpisah (Action Header, 4 Mini Status Cards, dan Tabel Data) pada `maintenance.html` menjadi 1 card wrapper terpadu, memangkas jarak vertikal berlebih (`space-y-6` menjadi `space-y-2 lg:space-y-1.5 xl:space-y-2`) dan padding kartu.
  - **Zero Scroll di Seluruh Breakpoint Desktop**: Mengeliminasi scrollbar vertikal pada `#main-scroll` di resolusi desktop (`lg` 1024x768, `xl` 1280x800, dan `2xl` 1536x960), dengan tinggi tab hanya 397–571 px (jauh di bawah batas viewport).
  - **Tabel Responsif Ramping Tanpa Card Mode Berlebih**: Menjaga tabel tetap dalam satu baris terpadu (`overflow-x-auto scrollbar-thin`) di seluruh resolusi termasuk mobile/tablet (`sm`, `md`), dilengkapi teks terpotong rapi (`truncate min-w-0 max-w-[200px] xl:max-w-xs`) serta tombol aksi dan badge status yang kompak (`whitespace-nowrap`).
- **Penyempurnaan Tampilan Monitor Hardware & Hardware Checker**:
  - **Fitur Filter / Sorting Grup di Monitor Hardware**: Menambahkan kontrol dropdown `<select id="monitor-group-filter">` pada header Monitor Hardware untuk memudahkan kasir memfilter dan mengurutkan unit PC per grup atau menampilkan seluruh grup sekaligus.
  - **Highlighted Group Header & Pembersihan Color Bar Samping**: Menghapus strip warna vertikal di samping teks grup dan mengubah header grup menjadi badge pill berlatar kontras tinggi (`REGULER • 20 UNIT`) dengan unit count badge terpadu sehingga langsung mudah dikenali oleh end-user.
  - **Penggantian Kolom Grup Menjadi Kolom Status di Hardware Checker**: Mengeliminasi kolom Grup pada Hardware Checker dan menggantikannya dengan kolom berdedikasi `Status` (`🛡️ AMAN`, `🚨 DITUKAR`, `⚙️ PENDING`), serta merapikan tampilan kode PC pada breakpoint kecil (`sm`, `md`, `lg`, `xl`).
  - **Grouping per Grup PC & Spacing Antargrup**: Membagi baris tabel Monitor Hardware per grup PC dengan menambahkan jarak/gap vertikal antargrup yang lebih tinggi (`pt-8 sm:pt-9 pb-2.5`) pada Monitor Hardware dan Hardware Checker.
  - **Skema Warna Komponen CPU & GPU**: Menerapkan diferensiasi warna yang konsisten pada nama CPU (`text-cyan-400`) serta badge suhunya (`text-cyan-300 border-cyan-800/60 bg-cyan-950/60`), dan nama GPU (`text-amber-400`) serta badge suhunya (`text-amber-300 border-amber-800/60 bg-amber-950/60`).
  - **Pembersihan Alert Suhu & Bullet Point**: Menghapus indikator alert peringatan suhu berlebih ("Perhatian" / red ping animation) dan bullet point pada nama PC di Monitor Hardware, dengan mempertahankan indikator status kecepatan LAN adapter.
  - **Pembaruan Header Sinkronisasi**: Mengganti label kolom `"SYNC"` menjadi `"Terakhir disinkronkan"` pada tabel dan modal detail Hardware Checker agar lebih informatif dan rapi.
  - **Informasi Nama/Model SSD & RAM pada Modal Detail**: Menampilkan model atau nama RAM dan SSD/Disk pada Modal Detail Hardware Checker jika data tersedia pada spesifikasi (baseline/telemetri), serta mengabaikannya secara bersih jika tidak tersedia.
- **Unifikasi Responsif Monitor Hardware & Hardware Checker (1 Baris per PC)**:
  - Unifikasi tampilan daftar PC pada tab Monitor Hardware (`tab-monitor`) dan Hardware Checker (`tab-hardware_checker`) menjadi tabel 1 baris per PC yang seragam di seluruh breakpoint responsive (`sm`, `md`, `lg`, `xl`, `2xl`).
  - **Optimasi Fit-to-Table Lintas-Breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`)**: Mengeliminasi lebar minimum artifisial (`min-w-[960px]`) dan menerapkan arsitektur kolom adaptif multi-line (Spesifikasi CPU/GPU/Mobo, RAM & LAN, Suhu terpadu, tombol aksi fleksibel) sehingga tabel 100% pas (*fit to table width*) tanpa ada kolom yang terpotong atau hilang di semua resolusi.
  - Pencegahan pemotongan baris (*line-wrapping*) pada indikator kecepatan adapter jaringan (`1000 Mbps`, `1 Gbps`) menggunakan normalisasi unit dan utilitas `whitespace-nowrap shrink-0 inline-flex`.
  - Integrasi kapasitas **Total RAM** (`m.total_ram`) dan Network Adapter pada Modal Detail Hardware Checker, baik di kolom Baseline Resmi maupun Live Telemetry.
  - Penggantian konfirmasi browser native `window.confirm()` dengan Custom Modal Dialog terstandarisasi (`Modal.confirm`) bernuansa amber warning, keyboard shortcut `E`, serta ukuran modal responsive.
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

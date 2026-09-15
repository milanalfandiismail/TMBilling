# Changelog

Semua perubahan penting dan rekam jejak rilis pada proyek **TMBilling** didokumentasikan dalam berkas ini.

Format pencatatan mengikuti panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan menganut [Semantic Versioning](https://semver.org/lang/id/).

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
- **Pembersihan Dashboard Kasir**: Penghapusan 4 kartu ringkasan statistik (Pendapatan Hari Ini, PC Aktif, Member Terdaftar, Kasir Aktif) dari bagian atas tab Dashboard kasir untuk antarmuka yang lebih bersih, cepat, dan fokus pada status grid PC.
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
- **Natural Sorting Screenshot Monitor**: Pengurutan nama PC secara alami (contoh: PC-1, PC-2, ..., PC-10) pada monitor screenshot kasir.
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

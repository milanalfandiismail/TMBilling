# 📘 Product Requirement Document (PRD) — TMBilling Ecosystem

> **Versi Dokumen**: v1.5.1  
> **Status**: Living Document / Active Production  
> **Target Audiens**: Software Architects, Core Developers, System Integrators, & Cybercafe Operators  

---

## 🎯 1. Visi & Tujuan Produk

**TMBilling** diciptakan untuk menjadi **ekosistem manajemen warnet / cybercafe modern terlengkap dan paling tepercaya**. Sistem ini menggabungkan manajemen billing real-time, perlindungan lockscreen tingkat native, monitoring hardware tingkat lanjut, pertanggungjawaban keuangan shift yang ketat, serta visualisasi informasi lobi berbasis Smart TV.

### Visi Utama:
1. **Keamanan & Stabilitas Tanpa Kompromi**: Mencegah kebocoran pendapatan, pembajakan PC client, dan manipulasi data melalui arsitektur multi-layer (Flask Backend, Rust Agent, Tauri Kiosk Hook).
2. **Pengalaman Pengguna (UX) Premium**: Menghadirkan antarmuka gelap (OLED Black) yang cepat, intuitif, dan responsif bagi Kasir, Pelanggan (Member), dan Lobi Warnet.
3. **Audit Keuangan Akurat**: Menjamin setiap rupiah transaksi (billing PC & POS Kantin) tercatat secara transparan dengan metode *Blind Count Shift Handover*.
4. **Perawatan & Pemeliharaan Mudah**: Dilengkapi pelacak kesehatan hardware, sistem tiket perawatan PC, serta manajer migrasi database sekali klik.

---

## 👥 2. Target Pengguna & Persona

| Persona | Hak Akses / Peran | Kebutuhan Utama |
|---------|-------------------|-----------------|
| **Kasir (Operator Frontdesk)** | Role `kasir` | Membuka/menutup sesi PC cepat, transaksi POS F&B, mencetak struk thermal, dan melakukan serah terima shift (*handover*). |
| **Admin / Owner** | Role `admin` | Mengatur harga paket & grup PC, mengelola user/staff, audit keuangan menyeluruh, backup database, dan monitoring kesehatan hardware. |
| **Member (Pelanggan)** | Web Portal (`/member`) & Kiosk | Memeriksa sisa saldo waktu bermain, melihat riwayat paket, dan login mandiri di PC client. |
| **Client PC (Kiosk Engine)** | Lockscreen Kiosk (`WarnetClient`) | Mengunci input keyboard/mouse saat PC kosong, auto-login saat restart, serta mengirimkan data telemeteri hardware tiap menit. |
| **Smart TV Lobi** | Public Display (`/tv` & `/tv/static`) | Menampilkan status ketersediaan PC, daftar promo, turnamen esports, dan menu kantin secara hands-free. |

---

## 🧩 3. Fitur Inti & Spesifikasi Modul

### 3.1 Sesi Billing & Auto-Shutdown Engine
*   **Tipe Sesi**: Sesi Guest (pasca-bayar/pra-bayar), Sesi Member (potong saldo waktu), dan Sesi Admin (bypass gratis untuk perawatan).
*   **Heartbeat & Timeout**: Client PC wajib mengirimkan heartbeat polling tiap 5 detik. Jika waktu habis, server memerintahkan client untuk mengunci layar (`lock`) dan mematikan PC (`shutdown`) secara otomatis.
*   **Audio Warning & Alert**: Peringatan suara otomatis pada client ketika waktu bermain tersisa **5 menit** dan **1 menit**.
*   **Blackout Recovery**: Jika terjadi mati lampu mendadak, server secara otomatis mendeteksi sesi menggantung dan menyediakan mekanisme refund/penyesuaian durasi saat listrik kembali menyala.

---

### 3.2 Manajemen Member & Portal Mandiri
*   **Sistem Saldo Waktu (Prepaid Time)**: Sisa durasi disimpan dalam satuan menit dan otomatis berkurang saat sesi berjalan.
*   **Grup & Masa Berlaku**: Member terikat pada grup tertentu (misal: *Reguler*, *VIP*, *VVIP*) dengan aturan tanggal kadaluarsa akun.
*   **Portal Web Member (`/member`)**: Pelanggan dapat login via browser (HP/PC) untuk mengecek sisa waktu, riwayat transaksi paket, dan riwayat sesi bermain secara transparan.

---

### 3.3 POS Kantin & F&B Management
*   **Katalog Makanan & Minuman**: Pengelolaan produk F&B lengkap dengan harga, stok, dan foto.
*   **Kasir POS & Keranjang Belanja**: Pemesanan F&B terintegrasi dengan pencetakan nomor nota unik (`TMM-YYYYMMDD-NNN`) dan opsi cetak struk thermal 58mm.
*   **Soft & Hard Delete**: Menu yang sudah pernah bertransaksi diarsipkan secara aman (*soft-delete*) tanpa merusak histori audit keuangan.

---

### 3.4 Turnamen Esports Bracket Maker
*   **Sistem Kompetisi Terintegrasi**: Mengelola pendaftaran tim, penyusunan babak pertandingan, dan pencatatan skor.
*   **Format Matchmaking**:
    *   **Single Elimination (Playoffs)**: Bagan bracket otomatis yang mendorong pemenang ke babak berikutnya.
    *   **Swiss Stage**: Algoritma pairing otomatis mempertemukan tim dengan jumlah kemenangan setara tanpa mengulang lawan.
*   **Integrasi Live Display**: Klasemen dan jadwal match turnamen langsung dapat dipantau dari Smart TV lobi.

---

### 3.5 Shift Handover & Audit Keuangan (*Blind Count*)
*   **Pertanggungjawaban Shift Kasir**: Kasir yang bertugas membuka shift dengan menginputkan modal awal di laci kasir.
*   **Hitung Buta (Blind Count)**: Saat menutup shift, kasir wajib memasukkan jumlah uang fisik di laci secara manual tanpa melihat estimasi sistem.
*   **Audit Deviasi**: Sistem secara otomatis menghitung selisih (*Surplus* atau *Defisit*) dan mencetak laporan pertanggungjawaban shift ke printer thermal.

---

### 3.6 Hardware Telemetry & Uptime Tracker per PC
*   **Kesehatan Hardware**: Monitoring suhu CPU/GPU, penggunaan RAM, jenis prosessor, VGA, nama motherboard, dan kecepatan NIC.
*   **Deteksi Active Window**: Melacak aplikasi atau game aktif yang sedang dijalankan di PC client.
*   **Uptime Tracker (Fitur #65)**: Mencatat akumulasi total jam operasional PC (`total_uptime_minutes`) dan waktu boot terakhir (`last_boot_time`) untuk estimasi pemeliharaan hardware.

---

### 3.7 Sistem Tiket Perawatan PC (Maintenance Tickets)
*   **Pelaporan Kendala Hardware/Software**: Kasir/admin dapat membuat tiket perawatan untuk PC yang mengalami masalah (misal: *Headset Rusak*, *Blue Screen*, *Keyboard Error*).
*   **Prioritas & Status Tiket**: Mendukung status *Open*, *In Progress*, *Resolved*, dan *Closed* dengan indikator warna prioritas.
*   **Laporan Perawatan**: Menghasilkan rekap statistik unit PC yang sering rusak untuk bahan pertimbangan replacement hardware.

---

### 3.8 Smart TV Digital Signage (Mode Dinamis & Statis)
*   **Mode Dinamis (Carousel)** (`/tv`): Rotasi slide fullscreen otomatis setiap 15 detik (Denah PC $\rightarrow$ Turnamen $\rightarrow$ Promo $\rightarrow$ Rules).
*   **Mode Statis (Dashboard Grid)** (`/tv/static`): Tampilan dashboard 3 baris secara bersamaan (PC Status, Promo, Kantin F&B, Turnamen, Aturan).
*   **Auto-Scaling Viewport**: Menggunakan CSS `transform: scale()` presisi agar tampilan pas 100% di layar Smart TV tanpa scrollbar.
*   **Inisial Logo Dinamis**: Logo header di kiri atas merender inisial warnet secara otomatis berdasarkan nama warnet aktif (misal: *BLI ESPORT* $\rightarrow$ `BE`).

---

### 3.9 Security, Guardian, & Migration System
*   **Single-Instance Protection**: Kiosk client (`Tauri`) menggunakan mutex native untuk mencegah eksekusi ganda aplikasi.
*   **IP Whitelist & Session Destruction**: Membatasi akses API backend hanya dari subnet IP warnet yang diizinkan dan menghancurkan sesi ilegal.
*   **Update Manager & Database Migration**: Pembaruan sistem sekali klik dengan mengunggah file ZIP update (`TMBilling_Server_v*.zip`) yang mengeksekusi Flask-Migrate otomatis.
*   **Cloud & Local Backup**: Backup database SQLite otomatis/manual yang terintegrasi dengan Discord Webhook, Google Drive, WebDAV, atau NAS.

---

## 🏗️ 4. Arsitektur Sistem 3-Layer

```
+-------------------------------------------------------------------------------+
|                             FLASK ROUTE LAYER                                 |
| Parse Request  |  Validation  |  JSON Response  |  Role Access Decorators     |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                            FLASK SERVICE LAYER                                |
| Business Logic  |  Session Transactions  |  db.session.commit() / rollback()  |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                           REPOSITORY LAYER (DB)                               |
| SQLAlchemy Queries  |  Filter & Aggregations  |  Strict No Direct Commits     |
+-------------------------------------------------------------------------------+
```

---

## 🚀 5. Peta Jalan Pengembangan (Future Update Roadmap)

Dokumen ini memproyeksikan rencana pembaruan fitur untuk versi-versi TMBilling mendatang:

```
[v1.5.x] Present ──► [v1.6.0] Dynamic QRIS Payment ──► [v1.7.0] Mobile App Operator
                                                            │
                                                            ▼
[v2.0.0] Silent Client Auto-Update ◄── [v1.8.0] Multi-Branch Cloud Sync
```

### 🔮 Release v1.6.0 — Automation Dynamic QRIS Payment
*   **Integrasi Payment Gateway**: Mendukung pembayaran instan QRIS (via Midtrans / Xendit / Tripay) langsung pada Kiosk Client PC dan Portal Web Member.
*   **Auto Top-Up**: Pelanggan dapat memilih paket billing di PC mereka, menscan QRIS dari aplikasi m-banking/e-wallet, dan waktu bermain bertambah secara otomatis tanpa perlu ke kasir.

### 🔮 Release v1.7.0 — Mobile Operator & Owner PWA App
*   **Aplikasi Mobile PWA**: Aplikasi berbasis smartphone (Android/iOS) khusus untuk Kasir dan Owner.
*   **Remote Kasir**: Kasir dapat membuka sesi PC, mengecek status billing, atau mematikan PC secara remote melalui smartphone sambil berjalan di area warnet.
*   **Owner Real-time Dashboard**: Pemilik warnet dapat memantau grafik pendapatan harian, okupansi PC, dan suhu hardware secara langsung dari manapun.

### 🔮 Release v1.8.0 — Multi-Branch Cloud Synchronization
*   **Manajemen Multi-Cabang**: Sinkronisasi data akun member dan laporan keuangan terpusat untuk pemilik warnet yang memiliki lebih dari satu lokasi cabang.
*   **Cross-Branch Member Login**: Member dapat menggunakan saldo waktu mereka di semua cabang warnet yang berada di bawah jaringan pemilik yang sama.

### 🔮 Release v2.0.0 — Background Client Silent Auto-Updater
*   **Update Client Kiosk Otomatis**: Server LAN akan menyiarkan (*broadcast*) versi terbaru file installer `WarnetClient.exe`.
*   **Silent Update**: PC client akan mengunduh dan mengupdate file executable client secara latar belakang (*background*) saat PC dalam kondisi standby tanpa memerlukan penanganan manual via USB flashdisk.

---

*TMBilling System Architecture & Requirements Specification*

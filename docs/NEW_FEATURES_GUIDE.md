# Panduan Fitur Baru: Tauri Single-Instance, Portal Member, Turnamen, & Shift Handover

Dokumen ini berisi spesifikasi teknis, arsitektur, dan panduan pengembang untuk empat fitur utama baru yang diintegrasikan ke dalam ekosistem **TMBilling** (Kasir, Kiosk Client, dan Portal Member).

---

## 🔒 1. Pencegahan Double-Running Klien Tauri (Single-Instance)

Untuk mencegah pengguna/administrator membuka beberapa instansi (multiple windows) lockscreen `TMBilling.exe` secara bersamaan yang dapat meloloskan pembatasan kiosk, kami mengimplementasikan perlindungan **Single-Instance** tingkat native.

### Detail Teknis:
*   **Dependensi**: `tauri-plugin-single-instance` diintegrasikan dalam Tauri Rust backend.
*   **Konfigurasi (`Cargo.toml`)**:
    `tauri-plugin-single-instance = { git = "https://github.com/tauri-apps/plugins-workspace", branch = "v1" }`
*   **Alur Kerja (`main.rs`)**:
    Saat instansi kedua diluncurkan, plugin akan mendeteksi instansi pertama yang sedang berjalan melalui mekanisme penamaan mutex sistem operasi. Instansi kedua akan otomatis mengirimkan argumen CLI-nya ke instansi pertama, lalu langsung menutup diri secara aman (`exit`). Instansi pertama menerima trigger tersebut, memfokuskan window utamanya kembali ke layar depan (`focus()`), dan memastikan layar tetap terkunci rapat.

---

## 🌐 2. Portal Web Member (`/member`)

Kami menyediakan portal web mandiri khusus bagi pelanggan prepaid (member) agar dapat memantau statistik penggunaan dan riwayat akun mereka secara transparan tanpa mengganggu sistem log kasir.

### Detail Teknis:
*   **Routing & Autentikasi (`member_portal_routes.py`)**:
    *   Halaman login mandiri tersedia di `/member/login` menggunakan username dan password member.
    *   Sesi member disimpan secara terpisah dalam flask session (`session["member_id"]` dan `session["member_role"] = "member"`).
    *   Diproteksi oleh decorator khusus `@member_login_required` untuk mencegah akses dari luar.
*   **Fitur Dashboard Portal (`member/dashboard.html`)**:
    *   **Statistik Utama**: Menampilkan sisa durasi bermain (diformat secara ramah pengguna, misal: *2 Jam 15 Menit*), status sesi PC aktif (nama PC dan grup), serta total deposit saldo historis.
    *   **Riwayat Sesi**: Tabel riwayat login bermain PC terakhir, lengkap dengan waktu login/logout, PC yang digunakan, dan durasi menit bermain (dibatasi 10 riwayat teratas).
    *   **Riwayat Transaksi**: Tabel pembelian paket billing dan top-up waktu, lengkap dengan nomor nota, nominal bayar terformat rupiah standar nasional, tipe transaksi, dan status refund.

---

## 🏆 3. Turnamen Bracket Maker (Sistem Kompetisi)

Modul ini memfasilitasi kasir/admin untuk menyelenggarakan turnamen game di warnet dengan mengelola pendaftaran tim, membuat bagan pertandingan otomatis, serta mengupdate skor.

### Model Data (`tournament.py`):
1.  `Turnamen`: Menyimpan nama, status (aktif/selesai), dan tanggal pembuatan turnamen.
2.  `TurnamenTahap` (Stage): Mendukung format pertandingan **Single Elimination (Playoffs)**, **Swiss Stage**, atau gabungan multi-tahap (Swiss Stage dilanjutkan Playoffs).
3.  `TurnamenTim`: Menyimpan nama tim peserta turnamen.
4.  `TurnamenMatch`: Menyimpan detail pertandingan (tim 1 vs tim 2, skor masing-masing, pemenang, nomor ronde, format BO1/BO3/BO5, dan relasi `next_match_id`).

### Fitur Matchmaking Otomatis:
*   **Playoffs (Single Elimination)**: Bagan dibuat mundur dari final ke babak pertama. Pemenang pertandingan otomatis didorong ke slot tim1/tim2 pada pertandingan berikutnya berdasarkan nilai ganjil/genap dari `match_number` mereka.
*   **Swiss Stage**: Menggunakan algoritma *greedy pairing* per ronde. Tim yang memiliki jumlah kemenangan yang sama akan dipasangkan bersama, dengan catatan tidak pernah bertemu di ronde sebelumnya. Jika jumlah peserta ganjil, tim terbawah yang belum pernah mendapat status BYE akan diloloskan otomatis dengan kemenangan cuma-cuma (skor 1-0).

---

## 💼 4. Shift Handover Kasir (Pertanggungjawaban Keuangan)

---

## 🔧 5. Database Migration Manager & Update System

Fitur ini memungkinkan update aplikasi (backend + frontend) dan migrasi database otomatis dalam satu langkah — cukup upload file ZIP.

### Fitur Utama:
- **Upload Update via Dashboard**: Unggah file `TMBilling_Server_v*.zip` langsung dari UI Settings
- **Auto-Detect Migrations**: Jika ZIP berisi folder `migrations/` → backup + replace + upgrade database
- **Tanpa Migrasi**: Jika ZIP hanya berisi `run.py` + `app/` → update aplikasi biasa
- **Auto-Restart**: Server restart otomatis setelah update selesai
- **Riwayat Migrasi**: Lihat semua revisi migrasi dengan status (HEAD / Aktif)

### Alur Upload:
1. User upload `TMBilling_Server_v*.zip`
2. Backend validasi struktur (cek `run.py` + `app/`)
3. Extract ke root project
4. Auto-detect `migrations/` → backup dulu → `flask_migrate upgrade`
5. Install dependencies (pip install -r requirements.txt)
6. Server restart
7. Frontend auto-reload setelah 5 detik

### Detail Teknis:
- **Backend**: Endpoint `POST /api/v1/kasir/settings/migration/upload`
- **Frontend**: Module `migration.js` — drag-drop upload + progress + overlay restart
- **Database**: Flask-Migrate + Alembic (`migrations/versions/`)
- **CLI Alternative**: `python run.py --release` (untuk update via terminal)
- **Status Endpoint**: `GET /api/v1/kasir/settings/migration/status` — ngecek HEAD vs Current revision

Fitur handover shift kasir menyediakan audit keuangan yang aman melalui metode **Hitung Buta (Blind Count)** saat kasir bergantian jaga.

### Model Data (`shift_record.py`):
*   Mencatat `kasir_id`, `waktu_mulai`, `waktu_selesai`, `modal_awal`, `uang_fisik` di laci, dan status shift (`aktif`/`selesai`).

### Alur Kerja & Logika:
1.  **Buka Shift (`/api/v1/kasir/shift/start`)**: Kasir yang bertugas memasukkan modal awal uang kembalian di laci kasir (misal: `50.000`).
2.  **Sesi Kerja**: Selama shift aktif, sistem terus mencatat pendapatan billing PC dan penjualan POS F&B secara real-time.
3.  **Tutup Shift (`/api/v1/kasir/shift/end`)**:
    *   **Hitung Buta (Blind Count)**: Kasir wajib menghitung uang tunai fisik di laci secara manual dan menginputkan nominalnya tanpa mengetahui catatan pendapatan versi sistem.
    *   Sistem kemudian mencocokkan `uang_fisik` inputan kasir dengan rumus:
        `Pendapatan Seharusnya = Modal Awal + Total Pendapatan Billing + Total Pendapatan Kantin (F&B)`
    *   Menghitung deviasi selisih: positif (**Surplus**) atau negatif (**Defisit**).
4.  **Cetak Struk Handover**: Setelah shift ditutup, sistem mencetak laporan pertanggungjawaban shift secara otomatis menggunakan printer thermal 58mm via format monospace standar.

---

## 🛠️ 6. Sistem Tiket Perawatan PC (Maintenance Ticket System - v1.5.0)

Modul ini memfasilitasi pelaporan dan pelacakan masalah fisik maupun perangkat lunak pada unit PC di warnet.

### Model Data (`maintenance_ticket.py`):
*   Mencatat `pc_id`, `subjek`, `deskripsi`, `prioritas` (*Rendah*, *Sedang*, *Tinggi*, *Darurat*), `status` (*Terbuka*, *Diproses*, *Selesai*), `dilaporkan_oleh`, dan `ditangani_oleh`.

### Fitur Utama:
*   **Modal Ter-Grouping Warna**: UI Kasir/Admin menampilkan tiket berdasarkan warna prioritas dan status penanganan.
*   **Laporan Maintenance**: Rekapitulasi historis unit PC yang sering mengalami kendala teknis untuk mendukung keputusan penggantian komponen hardware.

---

## ⏱️ 7. Pelacak Uptime PC (Uptime Tracker - v1.5.0)

Modul ini mencatat akumulasi total jam operasional PC secara otomatis untuk membantu pemilik warnet memperkirakan masa pakai hardware.

### Detail Teknis:
*   **Field Data (`PC` model)**: `total_uptime_minutes` dan `last_boot_time`.
*   **Inkrementasi Otomatis**: Setiap kali client PC mengirimkan heartbeat polling, durasi aktif ditambahkan ke total akumulasi uptime.
*   **Visualisasi UI**: Statistik jam kerja PC ditampilkan pada halaman detail PC di dashboard kasir.

---

## 📺 8. TV Mode & Digital Signage Lobi (v1.5.0)

Fitur ini menyediakan tampilan display publik beresolusi tinggi (1080p/4K) untuk dipasang pada Smart TV di lobi warnet via koneksi LAN (`http://IP_SERVER:7015/tv`).

### Mode Tampilan:
1.  **Mode Dinamis (Carousel)** (`/tv` atau `/tv-signage`):
    *   Rotasi slide otomatis setiap 15 detik (Live PC Status $\rightarrow$ Esports Turnamen $\rightarrow$ Promo & Paket $\rightarrow$ Aturan Warnet).
    *   Slide PC Status & Paket Billing dikelompokkan secara dinamis per grup (*Reguler*, *VIP*, *VVIP*).
2.  **Mode Statis (Dashboard Grid)** (`/tv/static` atau `/tv-static`):
    *   Tampilan multi-panel 3 baris secara bersamaan (Status PC, Promo, Menu Makanan Kantin, Turnamen, Aturan).
    *   **Auto-Scaling Viewport**: Menggunakan CSS `transform: scale()` presisi untuk menjamin layout pas di layar TV tanpa scrollbar.
    *   **Inisial Logo Dinamis**: Logo header kiri atas secara otomatis mengekstrak inisial nama warnet dari database (misal: *BLI ESPORT* $\rightarrow$ `BE`).

---

## 💸 9. Dashboard Member Refund & Breakdown Kalkulasi Durasi (v1.5.1)

Versi 1.5.1 memperluas fleksibilitas operasional kasir dengan memungkinkan refund paket billing member secara langsung dari Dashboard Kasir, serta meningkatkan transparansi kalkulasi waktu pada modal konfirmasi.

### 1. Refund Paket Member via Context Menu Dashboard
*   **Aksesibilitas**: Opsi **Refund Paket** kini aktif di Context Menu PC (klik kanan card PC) untuk PC yang sedang dalam sesi Member (`pc.sesi_detail.tipe === 'member'`).
*   **Alur Kerja (`dashboard/index.js`)**:
    1.  Kasir mengeklik *Refund Paket* pada PC Member.
    2.  `showMemberRefundModal(memberId)` memanggil endpoint `API.member.getPaket(memberId)` untuk mengambil daftar paket aktif member yang dapat di-refund.
    3.  Kasir mengeklik tombol *Refund* pada salah satu item paket, memicu `refundMemberPaket()`.

### 2. Breakdown Rincian Kalkulasi Durasi pada Modal Refund
Modal konfirmasi refund (baik Guest maupun Member) kini tidak lagi hanya menampilkan nama paket, melainkan secara transparan menghitung dan menampilkan rincian:
*   **Total Waktu Sekarang**: Sisa waktu bermain / saldo waktu tersimpan saat ini.
*   **Potongan Refund**: Jumlah durasi paket yang akan ditarik (misal: `-3 Jam 0 Menit`).
*   **Total Akhir Waktu**: Hasil kalkulasi bersih sisa waktu bermain / saldo waktu setelah pengurangan.

### 3. Penyelarasan Istilah & Rincian Modal Tambah Waktu
Untuk menjaga konsistensi istilah di seluruh aplikasi, UI form dan modal konfirmasi penambahan waktu diselaraskan menjadi:
*   `Total Waktu Saat Ini`
*   `Total Tambahan Waktu`
*   `Total Setelah Ditambah`

Rincian kalkulasi ini ditayangkan secara utuh baik pada sesi Guest maupun Member (pada `modal-tambah.js` dan `member_refill.js`).

---
*TMBilling v1.5.1*


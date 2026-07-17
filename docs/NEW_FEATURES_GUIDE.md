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
*TMBilling v1.4.4*

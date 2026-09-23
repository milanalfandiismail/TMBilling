# Spesifikasi Desain: 2 Fitur Baru Manajemen Staf (Kuota Bermain Kasir & Serah Terima Shift)

## 1. Ringkasan Eksekutif
Dokumen ini merinci spesifikasi arsitektur dan implementasi untuk **2 fitur baru** pada sistem TMBilling yang berpusat pada efisiensi operasional dan benefit staf kasir:
1. **Fitur 1 — Kuota Bermain Kasir (Benefit Staf)**: Memberikan benefit jatah bermain bulanan (misal 120 jam/bulan) langsung pada akun role `kasir`, sehingga kasir dapat login mandiri di PC client mana pun tanpa perlu mendaftar sebagai Member, dengan auto-reset bulanan setiap tanggal 1 dan isolasi 100% dari laporan omset billing.
2. **Fitur 2 — Serah Terima Shift Kasir (Handover & Blind Count)**: Mengaktifkan dan menyempurnakan sistem pergantian shift kasir secara end-to-end, meliputi buka shift (modal awal), tutup shift dengan hitung buta (*blind count*), cetak struk handover thermal 58mm/80mm, serta tab Riwayat Serah Terima Shift di bawah menu Manajemen Staff.

---

## 2. Hasil Audit Lengkap Sistem Serah Terima Shift Eksisting

Berdasarkan audit mendalam menggunakan MCP `codebase-memory`:
1. **Backend Service & Route Sudah Ada, Namun Belum Aktif Sepenuhnya**:
   - Model `ShiftRecord` sudah terdefinisi di `app/models/shift/shift_record.py`.
   - `ShiftService` ada di `app/services/shift/shift_service.py` dengan metode `start_shift`, `get_active_shift`, `get_shift_summary`, `end_shift`, `get_shift_history`.
   - Blueprint `shift_api_bp` ada di `app/routes/shift/shift_routes.py` (`/api/v1/kasir/shift/...`).
2. **Celah / Bug Perhitungan pada `get_shift_summary`**:
   - Filter query transaksi `Transaksi.dibuat_pada >= shift.waktu_mulai` tidak memiliki batas atas (`waktu_selesai`). Akibatnya, jika melihat ringkasan shift yang sudah selesai di masa lalu, data transaksi yang dihitung akan terus bertambah hingga hari ini.
   - **Solusi**: Jika `shift.waktu_selesai` terisi, query wajib dibatasi dengan `Transaksi.dibuat_pada.between(shift.waktu_mulai, shift.waktu_selesai)`.
3. **Frontend Dinonaktifkan**:
   - Pada `app/templates/kasir/base.html` baris 358, tag script `modules/shift/index.js` di-comment out.
   - Pada `app/templates/kasir/components/sidebar.html` baris 119, container `#shift-info` di-comment out.
   - Tidak ada tab navigasi di UI untuk melihat riwayat shift yang sudah selesai.
4. **Kebutuhan Kolom Catatan Handover**:
   - Kasir memerlukan kolom `catatan` saat serah terima untuk menuliskan catatan operasional (misal: "Uang kembalian kurang Rp 2.000 karena beli pulpen").

---

## 3. Rincian Fitur 1: Kuota Bermain Kasir (Benefit Staf)

### A. Skema Data `User` & `Sesi`
- **Tabel `User` (`app/models/user/user.py`)**:
  - `kuota_main_bulanan`: Integer (menit), default 0 (misal 120 jam = 7200 menit).
  - `sisa_kuota_menit`: Integer (menit), default 0 (saldo aktif yang berkurang real-time saat bermain).
  - `terakhir_reset_kuota`: String(7), format `YYYY-MM` (penanda bulan reset terakhir).
  - Helper method: `cek_dan_reset_kuota_bulanan()` dan `tambah_kuota_bonus()`.
- **Tabel `Sesi` (`app/models/sesi/sesi.py`)**:
  - Kolom `user_id` (ForeignKey ke `user.id`, nullable=True).
  - Tipe sesi baru: `tipe = "kasir"`.
  - `sisa_menit()` menghitung sisa waktu kuota kasir.
  - Sinkronisasi real-time ke `user.sisa_kuota_menit`.

### B. Alur Login Mandiri di PC Client (`AuthService.login`)
1. Kasir memasukkan username & password kasir di layar login PC client biasa.
2. Backend mendeteksi akun di tabel `User` dengan `role == "kasir"`.
3. Validasi:
   - Password benar dan akun aktif.
   - Jalankan auto-reset kuota jika berganti bulan.
   - Cek `user.sisa_kuota_menit > 0`. Jika habis, tolak dengan pesan ramah.
   - Cek apakah kasir sedang aktif di PC lain (mencegah double login).
4. Buat sesi `tipe="kasir"` dengan token 64-karakter.
5. Client PC terbuka normal dengan sisa waktu kuota. Ketika waktu habis, PC otomatis terkunci.
6. Sesi selesai $\rightarrow$ sisa menit tersimpan akurat ke akun kasir.

### C. Isolasi Laporan Finansial Billing
- Sesi kasir berstatus Rp 0 / Non-Komensial.
- Laporan omset billing (`ReportService`), rekap transaksi tunai/QRIS, dan laporan keuangan murni dari pelanggan (Member/Guest), tanpa tercampur sesi kasir.

---

## 4. Rincian Fitur 2: Serah Terima Shift Kasir (Handover & Blind Count)

### A. Perubahan Skema Data `ShiftRecord` (`app/models/shift/shift_record.py`)
- Menambahkan kolom:
  - `catatan`: String(255), catatan opsional saat serah terima.
  - `total_qris`: Integer, snapshot total non-tunai (QRIS/Transfer) selama shift.
  - `total_refund`: Integer, snapshot total refund selama shift.

### B. Penyempurnaan `ShiftService` (`app/services/shift/shift_service.py`)
- **Perbaikan Query Transaksi**: Tambahkan batas atas `waktu_selesai` untuk shift yang sudah tutup.
- **Hitung Buta (Blind Count)**:
  - Kasir hanya memasukkan `uang_fisik` di laci.
  - Sistem menghitung `total_seharusnya = modal_awal + total_tunai_billing + total_tunai_kantin - total_refund`.
  - Sistem menghitung `selisih = uang_fisik - total_seharusnya`.
- **Cetak Struk Handover**: Format cetak thermal 58mm/80mm siap pakai (Kasir, Waktu, Modal, Billing, Kantin, Fisik, Selisih, Rincian Pembayaran).

### C. Antarmuka Pengguna (UI) Shift Handover (Sidebar User Section)
1. **Posisi & Integrasi UI/UX**:
   - Ditempatkan di bagian footer sidebar user (`app/templates/kasir/components/sidebar.html`), tepat di antara profil user dan tombol **Keluar (Logout)**.
   - Responsif untuk semua breakpoint (`sm, md, lg, xl, 2xl`), menggunakan tipografi dan padding proporsional.
   - **Kondisi Belum Buka Shift**:
     - Kotak informasi amber/oranye: *"Belum Buka Shift"* + tombol **`BUKA SHIFT`** yang membuka Modal Input Modal Awal.
   - **Kondisi Shift Sedang Aktif**:
     - Widget ringkas: Indikator hijau aktif berdenyut, jam mulai buka shift, dan nominal modal awal.
     - Tombol **`PERTUKARAN / SERAH TERIMA SHIFT`** (ikon handover/refresh) berada tepat di atas tombol **Keluar**.
2. **Modal Buka Shift**:
   - Input modal awal (kembalian di laci) Rp 0 - Rp 100.000.000.
3. **Modal Tutup Shift (Blind Count)**:
   - Sembunyikan total pendapatan.
   - Kasir menginput uang fisik di laci + catatan serah terima.
   - Konfirmasi penutupan shift.
4. **Modal Hasil Shift & Struk**:
   - Menampilkan selisih (SURPLUS / SESUAI / DEFISIT) dengan warna jelas.
   - Tombol "Cetak Struk Handover".

---

## 5. Integrasi Menu Manajemen Staff di Sidebar Admin

Dropdown **Manajemen Staff** di `sidebar_admin.html` kini memiliki 3 sub-menu terstruktur:
1. **Akun Kasir & Admin** (`data-tab="user"`):
   - Daftar staf, status, kolom Kuota Bulanan & Sisa Jam Main.
   - Tombol aksi: Atur Kuota Bulanan, Tambah Jam Bonus, Edit Profil, Ganti Password, Arsipkan Kasir.
2. **Riwayat Serah Terima Shift** (`data-tab="shift_history"`):
   - Tabel riwayat shift kasir: Tanggal, Nama Kasir, Modal Awal, Billing, Kantin, Total, Uang Fisik, Selisih, Catatan.
   - Filter tanggal & kasir.
   - Tombol Cetak Ulang Struk Handover.
3. **Log & Audit Staf** (`data-tab="user_logs"`):
   - Riwayat audit khusus akun kasir: penambahan jam bonus, reset kuota bulanan, sesi bermain kasir di PC, ganti password, perubahan status/arsip akun.

---

## 6. Auto-Migration SQLite (`app/__init__.py`)
Skrip startup otomatis mendeteksi dan menambahkan kolom yang belum ada:
- `user`: `kuota_main_bulanan`, `sisa_kuota_menit`, `terakhir_reset_kuota`.
- `sesi`: `user_id`.
- `shift_record`: `catatan`, `total_qris`, `total_refund`.

---

## 7. Rencana Pengujian Otomatis (Testing)
1. **Test Kuota Kasir**:
   - Login kasir dengan kuota -> sesi dibuat, sisa jam berkurang.
   - Login kasir kuota habis -> ditolak dengan pesan ramah.
   - Auto-reset saat berganti bulan.
   - Isolasi omset billing: sesi kasir Rp 0 tidak masuk laporan pendapatan.
2. **Test Serah Terima Shift**:
   - `start_shift`: Modal awal tercatat, status AKTIF.
   - `get_shift_summary`: Perhitungan omset tunai vs QRIS akurat.
   - `end_shift`: Hitung buta, selisih dihitung benar (surplus/defisit).
   - Pencegahan buka shift ganda.
3. **Regression Suite**:
   - Seluruh 211+ pengujian lulus 100%.

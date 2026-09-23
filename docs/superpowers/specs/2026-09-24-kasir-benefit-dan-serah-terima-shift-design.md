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
4. **Modal Hasil Shift & Rekap Digital di Layar**:
   - Menampilkan ringkasan lengkap di layar monitor komputer tanpa kewajiban mencetak kertas (*paperless friendly*).
   - Menampilkan modal awal, pendapatan billing, kantin, rincian per metode pembayaran (Tunai/QRIS/Transfer), uang fisik di laci, catatan kasir, dan selisih (SURPLUS / SESUAI / DEFISIT) dengan badge warna jelas.
   - Tombol "Tutup" (untuk sekadar melihat di layar monitor komputer).
   - Tombol "Cetak Struk Handover" (opsional jika kasir/owner ingin print fisik thermal 58mm/80mm).

---

## 5. Integrasi Menu Manajemen Staff di Sidebar Admin & Standar UI/UX

### A. Sub-Menu Manajemen Staff
Dropdown **Manajemen Staff** di `sidebar_admin.html` kini memiliki 3 sub-menu terstruktur:
1. **Akun Kasir & Admin** (`data-tab="user"`):
   - Daftar staf, status, kolom Kuota Bulanan & Sisa Jam Main.
   - Tombol aksi: Atur Kuota Bulanan, Tambah Jam Bonus, Edit Profil, Ganti Password, Arsipkan Kasir.
2. **Riwayat Serah Terima Shift** (`data-tab="shift_history"`):
   - Tabel riwayat shift kasir: Tanggal, Nama Kasir, Modal Awal, Billing, Kantin, Total, Uang Fisik, Selisih, Catatan.
   - Filter tanggal & kasir.
   - Tombol **👁️ Lihat Detail**: Membuka modal popup rekapan digital lengkap di layar monitor kapan saja tanpa perlu cetak kertas.
   - Tombol **🖨️ Cetak Struk**: Cetak ulang struk thermal jika sewaktu-waktu dibutuhkan fisik kertasnya.
3. **Log & Audit Staf** (`data-tab="user_logs"`):
   - Riwayat audit khusus akun kasir: penambahan jam bonus, reset kuota bulanan, sesi bermain kasir di PC, ganti password, perubahan status/arsip akun.

### B. Standar UI/UX Acuan: Tab "Umum & Keamanan" (`settings.html`)
Semua antarmuka baru (`user_logs.html`, `shift_history.html`, modal popup, dan tabel) mengacu pada standar visual tab **Umum & Keamanan**:
- **Wadah Kartu (Card Container)**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6`
- **Tipografi**:
  - Judul Tab/Bagian: `text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider mb-4`
  - Label Form/Filter: `text-xs lg:max-xl:text-sm xl:text-[22px] text-neutral-400 uppercase font-bold tracking-wider block`
  - Subteks Deskripsi: `text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 mt-1`
  - Catatan/Petunjuk Input: `text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-0.5 font-normal font-sans`
- **Input & Filter Dropdown**:
  - `bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:max-xl:text-xs xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
- **Tombol Aksi**:
  - Primer: `px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors`
  - Sekunder/Batal: `bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded`

### C. Konsistensi Modal & Responsif `sm, md, lg, xl, 2xl`
Semua modal baru (Modal Buka Shift, Modal Tutup Shift Blind Count, Modal Rekap Digital, Modal Kuota Kasir, Modal Jam Bonus):
- Menggunakan `Modal.show(...)` dengan struktur standar:
  - Container: `bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl overflow-hidden shadow-2xl animate-in`
  - Header: `px-4 sm:px-6 py-4 sm:py-5 border-b border-[#2a2a2a]`
  - Body: `px-4 sm:px-6 py-4 sm:py-5 space-y-4 max-h-[80vh] overflow-y-auto`
  - Footer: `px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[#2a2a2a] flex justify-end gap-2`
- Menjamin tampilan 100% rapi dan proporsional di seluruh breakpoint mobile (`sm: 640px`), tablet (`md: 768px`), desktop (`lg: 1024px`), widescreen (`xl: 1280px`), dan monitor besar (`2xl: 1536px`).

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

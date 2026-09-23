# Spesifikasi Desain: Manajemen Staf, Kuota Bermain Kasir, & Serah Terima Shift Dinamis

## 1. Ringkasan Eksekutif
Dokumen ini merinci spesifikasi arsitektur dan implementasi untuk **2 fitur baru** pada sistem TMBilling yang berpusat pada efisiensi operasional, benefit staf kasir, serta keamanan dan integritas transaksi:
1. **Fitur 1 — Kuota Bermain Kasir (Benefit Staf)**: Memberikan benefit jatah bermain bulanan (misal 120 jam/bulan) langsung pada akun role `kasir`, sehingga kasir dapat login mandiri di PC client mana pun tanpa perlu mendaftar sebagai Member, dengan auto-reset bulanan setiap tanggal 1 dan isolasi 100% dari laporan omset billing.
2. **Fitur 2 — Serah Terima Shift Kasir (Handover, Blind Count, & Rincian Pembayaran Dinamis)**:
   - **Rekap Metode Pembayaran Dinamis**: Karena metode pembayaran dapat di-CRUD melalui menu pengaturan, rekap serah terima shift secara otomatis dan dinamis mengelompokkan penerimaan **Tunai (Fisik Laci)** vs **Non-Tunai (QRIS, Transfer Bank, E-Wallet, dll.)** baik untuk billing PC maupun transaksi kantin.
   - **Eksklusivitas Shift & Proteksi Anti-Fitnah (Opsi A)**: Hanya boleh ada 1 shift aktif di sistem. Selama Kasir A memiliki shift aktif, Kasir B **DITOLAK** login ke dashboard kasir agar tidak terjadi manipulasi/salah tuduh selisih laci. Kasir pemegang shift dapat re-login kapan saja tanpa batasan waktu jika browser tertutup.
   - **Wajib Buka Shift**: Staf ber-role `kasir` wajib membuka shift (input modal awal) sebelum dapat melayani transaksi billing atau kantin. Role `admin` dan `owner` bebas dari kewajiban ini.
   - **Emergency Force Close oleh Admin**: Role `admin`/`owner` dapat login kapan saja dan memiliki tombol darurat di sidebar untuk menutup paksa shift kasir yang mangkir/berhalangan.

---

## 2. Hasil Audit Sistem Eksisting via MCP `codebase-memory`

Berdasarkan audit mendalam menggunakan MCP `codebase-memory`:
1. **Model & Service Shift**:
   - Model `ShiftRecord` di `app/models/shift/shift_record.py` telah memiliki kolom `modal_awal`, `uang_fisik`, `selisih`, `total_billing`, `total_kantin`, `catatan`, `total_qris`, dan `total_refund`.
   - Perlu penambahan kolom `detail_metode_json` (Text) untuk menyimpan snapshot data JSON rincian pembayaran per metode secara permanen.
2. **Metode Pembayaran di Transaksi & Kantin**:
   - `Transaksi.metode_pembayaran` dan `TransaksiMenu.metode_pembayaran` mencatat nama metode seperti `"Tunai"`, `"Cash"`, `"QRIS"`, `"Transfer Bank"`, atau metode kustom dari `SettingsService.get("payment_methods")`.
   - `ShiftService.get_shift_summary()` saat ini sudah mengelompokkan transaksi per metode, namun rumus `total_seharusnya` di laci sebelumnya hanya mengurangkan QRIS, belum fleksibel terhadap semua metode non-tunai dinamis lainnya (Transfer, EDC, dsb).
3. **Celah Autentikasi Kasir Web (`AuthKasirService.login`)**:
   - Belum ada pengecekan shift aktif saat user ber-role `kasir` login ke dashboard web. Kasir B saat ini bisa login bersamaan dengan Kasir A yang memegang shift aktif, membuka risiko manipulasi transaksi dan fitnah selisih laci fisik.
4. **Validasi Pra-Transaksi**:
   - Endpoint transaksi billing (`/buka-guest`, `/buka-member`, `/tambah-waktu`, `/refund-paket`) dan kantin (`/api/v1/kasir/menu/checkout`) belum memblokir kasir yang belum membuka shift.

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
  - Sinkronisasi real-time ke `user.sisa_kuota_menit` saat sesi ditutup atau bertambah.

### B. Alur Login Mandiri di PC Client (`AuthService.login`)
1. Kasir memasukkan username & password kasir di layar login PC client biasa.
2. Backend mendeteksi akun di tabel `User` dengan `role == "kasir"`.
3. Validasi:
   - Password benar dan akun aktif.
   - Jalankan auto-reset kuota jika berganti bulan (`terakhir_reset_kuota != YYYY-MM`).
   - Cek `user.sisa_kuota_menit > 0`. Jika habis, tolak dengan pesan ramah.
   - Cek apakah kasir sedang aktif di PC lain (mencegah double login di 2 PC berbeda).
4. Buat sesi `tipe="kasir"` dengan token 64-karakter.
5. Client PC terbuka normal dengan sisa waktu kuota. Ketika waktu habis, PC otomatis terkunci.
6. Sesi selesai $\rightarrow$ sisa menit tersimpan akurat ke akun kasir.

### C. Isolasi Laporan Finansial Billing
- Sesi bermain kasir berstatus Rp 0 / Non-Komensial.
- Laporan omset billing (`ReportService`), rekap transaksi tunai/QRIS, dan laporan keuangan murni dari pelanggan (Member/Guest), tanpa tercampur sesi kasir.

---

## 4. Rincian Fitur 2: Serah Terima Shift & Proteksi Eksklusif Kasir

### A. Skema Data `ShiftRecord` (`app/models/shift/shift_record.py`)
- Kolom yang didukung:
  - `catatan`: String(255), catatan operasional saat serah terima.
  - `total_qris`: Integer, snapshot total non-tunai QRIS.
  - `total_refund`: Integer, snapshot total pengembalian uang.
  - `detail_metode_json`: Text, representasi JSON snapshot rincian dinamis per metode pembayaran.

### B. Rekap Metode Pembayaran Dinamis (`ShiftService.get_shift_summary`)
Karena metode pembayaran dapat di-CRUD melalui menu pengaturan, sistem membagi transaksi ke dalam dua kelompok:
1. **Kelompok Tunai (Fisik Laci)**:
   - Metode dengan nama `"Tunai"`, `"Cash"`, atau `None`/kosong.
   - Uang tunai billing + uang tunai kantin - refund tunai.
2. **Kelompok Non-Tunai (Rekening / Merchant Settlement)**:
   - Semua metode pembayaran lainnya yang aktif (misal `"QRIS"`, `"Transfer Bank"`, `"Debit"`, `"GoPay"`, dsb.).
   - Disajikan per nama metode secara dinamis:
     $$\text{Total Metode } X = \text{Billing } X + \text{Kantin } X$$
3. **Rumus Fisik Laci Seharusnya**:
   $$\text{Total Tunai Bersih} = \text{Billing Tunai} + \text{Kantin Tunai} - \text{Refund Tunai}$$
   $$\text{Uang Fisik Seharusnya} = \text{Modal Awal} + \text{Total Tunai Bersih}$$
4. **Hitung Buta (Blind Count) & Selisih**:
   $$\text{Selisih} = \text{Uang Fisik Aktual (Input Kasir)} - \text{Uang Fisik Seharusnya}$$

### C. Proteksi Anti-Fitnah & Eksklusivitas Kasir (Opsi A)
1. **Satu Shift Aktif Sistem-Wide**:
   - Hanya 1 shift yang boleh berstatus `AKTIF` di seluruh sistem warnet.
   - `ShiftService.start_shift()` memeriksa keberadaan shift aktif apa pun:
     Jika ada shift berstatus `AKTIF`, pembuatan shift baru ditolak dengan pesan:
     *"Tidak dapat membuka shift baru: Masih ada shift aktif oleh '{kasir.nama}' sejak {waktu}. Selesaikan shift terlebih dahulu."*
2. **Restriksi Login Kasir di Dashboard (`AuthKasirService.login`)**:
   - Jika ada shift yang berstatus `AKTIF`:
     - **Kasir Pemegang Shift**: **DIIZINKAN** login kapan saja (re-login jika koneksi putus, browser tertutup, atau ganti tab) **tanpa batas waktu timeout**.
     - **Kasir Lain**: **DITOLAK (HTTP 403 Forbidden)** dengan pesan:
       *"Akses Ditolak: Shift kasir saat ini sedang aktif oleh '{kasir.nama_lengkap or kasir.username}' sejak {jam_mulai}. Kasir lain tidak dapat masuk sampai shift tersebut ditutup."*
     - **Role Admin / Owner**: **SELALU DIIZINKAN** login bebas kapan saja untuk pengawasan dan manajemen.
3. **Wajib Buka Shift Sebelum Transaksi Operasional**:
   - Untuk user ber-role `kasir`, seluruh endpoint transaksi:
     - Billing: `/buka-guest`, `/buka-guest-batch`, `/buka-member`, `/tambah-waktu`, `/tambah-waktu-batch`, `/refund-paket`.
     - Kantin: `/api/v1/kasir/menu/checkout`.
   - Memeriksa apakah kasir tersebut memiliki shift `AKTIF`.
   - Jika belum buka shift:
     - Backend me-return `400 Bad Request` / `403 Forbidden`: *"Harap buka shift terlebih dahulu sebelum melayani transaksi."*
     - Frontend UI mengarahkan kasir langsung ke Modal Buka Shift.
   - **Pengecualian**: Role `admin` dan `owner` bebas melakukan transaksi tanpa wajib membuka shift.
4. **Emergency Force Close oleh Admin**:
   - Jika kasir pemegang shift berhalangan hadir/mangkir/terjadi insiden darurat, role `admin` atau `owner` dapat melakukan penutupan paksa (*Force Close*).
   - Tombol diletakkan di sidebar bagian user (di atas tombol Keluar).
   - Saat diklik oleh Admin, muncul Modal Informasi Shift Kasir yang sedang berjalan beserta tombol konfirmasi **"Tutup Paksa Shift (Force Close)"** dengan input alasan/catatan admin.
   - Aksi ini dicatat ke dalam log audit (`SHIFT_FORCE_CLOSE`) lengkap dengan nama admin yang mengeksekusi, sehingga laci langsung terbuka untuk kasir shift berikutnya.

---

## 5. Antarmuka Pengguna (UI/UX) & Standar Visual

### A. Widget Sidebar & Tombol Handover / Force Close
Diletakkan di footer sidebar user (`app/templates/kasir/components/sidebar.html`), tepat di atas tombol **Keluar (Logout)**:
1. **Untuk Role Kasir**:
   - **Belum Buka Shift**: Kotak peringatan amber dengan tombol **`BUKA SHIFT KASIR`** (membuka modal input modal awal).
   - **Sedang Aktif**: Indikator hijau berdenyut, jam mulai buka, nominal modal awal, dan tombol **`PERTUKARAN / SERAH TERIMA SHIFT`**.
2. **Untuk Role Admin**:
   - Jika tidak ada shift kasir yang aktif: Menampilkan status *"Tidak Ada Shift Kasir Aktif"*.
   - Jika ada shift kasir yang aktif: Menampilkan badge *"Shift Aktif: {Nama Kasir}"* dan tombol oranye **`KELOLA / FORCE CLOSE SHIFT`**.

### B. Modal Rekap Digital & Cetak Struk Thermal 58mm
1. **Modal Tutup Shift (Blind Count)**:
   - Kasir menginput uang fisik di laci (Rp 0 s/d Rp 100.000.000) dan catatan serah terima (maks. 255 karakter).
   - Sembunyikan omset sistem sebelum input dikirimkan.
2. **Modal Rekap Digital Lengkap (Paperless Friendly)**:
   - Menampilkan modal awal, penerimaan tunai (billing, kantin, refund), rincian dinamis per metode non-tunai (QRIS, Transfer Bank, dll.), uang fisik, dan selisih (SURPLUS / SESUAI / DEFISIT) dengan badge warna jelas.
   - Tombol **`Tutup`** (cukup melihat di layar tanpa harus mencetak kertas).
   - Tombol **`Cetak Struk HTML`** dan **`Thermal 58mm`** (opsional).
3. **Format Struk Thermal 58mm**:
   - Menampilkan rincian dinamis per metode pembayaran yang digunakan selama shift.
   - Menampilkan selisih uang fisik vs uang seharusnya di laci.
   - Menampilkan catatan serah terima dan kolom tanda tangan kasir.

### C. Menu Manajemen Staff di Sidebar Admin
Pemisahan menu manajemen staf menjadi 3 sub-menu terstruktur:
1. **Akun Kasir & Admin** (`data-tab="user"`): Kelola akun kasir/admin, status, kuota bermain bulanan, dan jam bonus.
2. **Riwayat Serah Terima** (`data-tab="shift_history"`): Tabel riwayat shift kasir dengan filter tanggal dan kasir, tombol **Lihat Detail** (membuka modal digital lengkap), dan tombol **Cetak Struk**.
3. **Log & Audit Staf** (`data-tab="user_logs"`): Riwayat audit aksi staf (tambah jam bonus, reset kuota, force close shift, login PC kasir).

---

## 6. Standar Validasi Input Ketat (Frontend & Backend)

1. **Buka Shift (`modal_awal`)**:
   - Integer Rp 0 s/d Rp 100.000.000 via `validate_integer_range`.
2. **Tutup Shift (`uang_fisik` & `catatan`)**:
   - `uang_fisik`: Integer Rp 0 s/d Rp 100.000.000 via `validate_integer_range`.
   - `catatan`: Maksimal 255 karakter via `validate_string_length`.
   - Konfirmasi ganda (*Modal.confirm*) jika `uang_fisik == 0`.
3. **Kuota Kasir (`kuota_jam` & `jam_bonus`)**:
   - Kuota bulanan: 0 s/d 720 jam/bulan.
   - Jam bonus: 1 s/d 100 jam dengan catatan minimal 3 karakter.
4. **Force Close Catatan**:
   - Catatan admin saat force close: minimal 3 karakter, maksimal 255 karakter.

---

## 7. Rencana Pengujian Otomatis (Testing)

1. **Test Proteksi Login Kasir**:
   - Kasir A buka shift $\rightarrow$ Kasir A bisa login/logout berulang kali tanpa batas waktu timeout.
   - Kasir B mencoba login saat Kasir A aktif $\rightarrow$ Ditolak (403 Forbidden).
   - Admin login saat Kasir A aktif $\rightarrow$ Sukses (200 OK).
2. **Test Wajib Buka Shift**:
   - Kasir A belum buka shift $\rightarrow$ Request `/buka-guest` / checkout kantin ditolak dengan pesan wajib buka shift.
   - Kasir A buka shift $\rightarrow$ Request `/buka-guest` berhasil.
   - Admin melakukan transaksi tanpa buka shift $\rightarrow$ Berhasil normal.
3. **Test Laporan Pembayaran Dinamis**:
   - Transaksi dengan metode Tunai, QRIS, Transfer Bank, dan metode kustom dihitung terpisah secara akurat.
   - Refund tunai hanya mengurangi saldo tunai laci.
   - Perhitungan selisih laci hanya membandingkan fisik uang dengan total tunai seharusnya.
   - Snapshot `detail_metode_json` tersimpan akurat pada `ShiftRecord`.
4. **Test Emergency Force Close**:
   - Admin melakukan force-close shift kasir aktif $\rightarrow$ Status berubah menjadi SELESAI, tercatat log audit `SHIFT_FORCE_CLOSE`.
   - Setelah force-close, Kasir B dapat login dan membuka shift baru.
5. **Regression Test**:
   - Seluruh 225 test eksisting tetap 100% lulus.

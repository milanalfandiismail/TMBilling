# Spesifikasi Desain: Fitur Kuota Bermain Kasir (Benefit Staf) & Log Riwayat Staf

## 1. Ringkasan Eksekutif
Fitur ini memungkinkan administrator warnet memberikan benefit waktu bermain (gaming quota) khusus kepada akun staf dengan role **`kasir`** (misalnya 120 jam per bulan), sehingga kasir dapat langsung login dan bermain di unit PC Client mana pun menggunakan akun kasirnya sendiri tanpa perlu mendaftar sebagai Member. 

Sistem ini dirancang dengan isolasi total dari laporan keuangan billing, auto-reset bulanan setiap tanggal 1, dan dilengkapi sub-menu **Log & Riwayat Staff** di menu Manajemen Staff untuk mencatat seluruh audit penambahan jam, sesi bermain, reset kuota, dan perubahan akun kasir.

---

## 2. Kebutuhan & Ruang Lingkup (Scope)

### A. Kebutuhan Fungsional (Functional Requirements)
1. **Kuota Bermain Khusus Role Kasir**:
   - Kolom `kuota_main_bulanan` (dalam menit) dan `sisa_kuota_menit` pada akun User kasir.
   - Admin dapat menetapkan kuota bulanan tetap (misal 120 jam) dan menambahkan jam bonus manual sewaktu-waktu.
   - Akun role `admin` tidak memiliki kuota bermain karena admin sudah memiliki mode bypass maintenance.
2. **Siklus Auto-Reset Bulanan**:
   - Kuota bermain kasir di-reset kembali ke nilai `kuota_main_bulanan` di awal bulan baru (setiap tanggal 1).
   - Catatan reset bulanan terekam otomatis di log aktivitas staf.
3. **Login Mandiri di PC Client**:
   - Kasir duduk di PC client yang terkunci dan memasukkan username & password kasir di form login PC client.
   - Backend mendeteksi akun kasir, memvalidasi sisa kuota, dan membuat sesi bertipe `kasir`.
   - PC client terbuka dengan widget sisa waktu kuota.
   - Kuota berkurang secara real-time saat bermain. Ketika sisa waktu kuota habis (0 menit), PC client otomatis mengunci layar (*auto-lock screen*).
   - Kasir tidak diizinkan login bersamaan di 2 PC Client (*multi-login prevention*).
4. **Isolasi Laporan Finansial Billing**:
   - Sesi bermain kasir berstatus benefit internal (Rp 0 / Non-Komensial).
   - Laporan omset warnet, pendapatan tunai/QRIS, dan laporan shift kasir **sama sekali tidak terpengaruh** atau tercampur oleh sesi kasir.
5. **Sub-Menu Manajemen Staff & Audit Log**:
   - Pada Sidebar Admin (dropdown Manajemen Staff) terdapat 2 tab:
     - **Akun Kasir & Admin**: Daftar kasir, kolom kuota bulanan, sisa waktu, modal atur kuota bulanan, dan modal tambah jam bonus.
     - **Log & Riwayat Staff**: Tabel audit log aktivitas akun staf (riwayat penambahan jam main, sesi kasir main, reset kuota bulanan, ganti password, edit akun, arsip kasir).

### B. Batasan Sistem (Non-Functional Requirements)
- **Kompatibilitas Protokol Client**: Respons API `/api/v1/public/auth/login` dan `/status` sepenuhnya kompatibel dengan aplikasi Client C# dan Tauri tanpa perlu mengubah source code aplikasi client C#.
- **Zero Data Regression**: 211 test unit yang ada tetap 100% lulus tanpa gangguan pada alur member atau guest normal.
- **Bahasa**: Seluruh pesan error dan notifikasi disajikan dalam Bahasa Indonesia yang ramah pengguna.

---

## 3. Arsitektur Data & Model

### A. Perubahan Model `User` (`app/models/user/user.py`)
```python
class User(db.Model):
    # Kolom existing...
    
    # Kolom Benefit Kasir Baru
    kuota_main_bulanan = db.Column(db.Integer, default=0) # Dalam menit, misal 7200 menit (120 jam)
    sisa_kuota_menit = db.Column(db.Integer, default=0)   # Sisa saldo menit aktif
    terakhir_reset_kuota = db.Column(db.String(7), nullable=True) # Format "YYYY-MM", misal "2026-09"
```
**Metode Pendukung**:
- `cek_dan_reset_kuota_bulanan()`: Memeriksa apakah bulan saat ini $\neq$ `terakhir_reset_kuota`. Jika ya, atur `sisa_kuota_menit = kuota_main_bulanan` dan perbarui `terakhir_reset_kuota`.
- `tambah_kuota_bonus(menit_bonus)`: Menambahkan saldo ke `sisa_kuota_menit` tanpa mengubah `kuota_main_bulanan`.

### B. Perubahan Model `Sesi` (`app/models/sesi/sesi.py`)
```python
class Sesi(db.Model):
    # Kolom existing...
    
    # Relasi ke User Kasir
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    user = db.relationship("User", backref="sesi_kasir_list")
```
- Nilai `tipe` kini mendukung `"kasir"`.
- Method `Sesi.sisa_menit()`:
  - Jika `self.tipe == "kasir"`: `(self.waktu_tersimpan_awal + self.menit_pause_total) - menit_terpakai`.
  - Sinkronisasi sisa saldo kuota kasir diupdate saat sesi berjalan dan saat sesi ditutup.

### C. Auto-Migration SQLite (`app/__init__.py`)
Menambahkan skrip idempotent di startup:
- Menambahkan kolom `kuota_main_bulanan`, `sisa_kuota_menit`, dan `terakhir_reset_kuota` ke tabel `user` jika belum ada.
- Menambahkan kolom `user_id` ke tabel `sesi` jika belum ada.

---

## 4. Alur Layanan & Endpoints API

### A. Autentikasi Client PC (`AuthService.login`)
1. Menerima `username`, `password`, `ip_address`, `mac_address`.
2. Cari di `MemberRepository`. Jika tidak ditemukan, cari di `UserRepository`.
3. Jika ditemukan di `UserRepository`:
   - Validasi `user.role == "kasir"` dan `user.aktif == True`.
   - Validasi `user.check_password(password)`.
   - Jalankan `user.cek_dan_reset_kuota_bulanan()`.
   - Validasi `user.sisa_kuota_menit > 0`. Jika 0: raise `ValueError("Kuota bermain Anda bulan ini telah habis (0 jam tersisa). Hubungi admin untuk penambahan kuota.")`.
   - Cek apakah akun kasir sedang aktif di PC lain: raise `ValueError("Akun kasir ini sedang aktif bermain di PC [KODE]. Logout terlebih dahulu!")`.
   - Buat `Sesi(tipe="kasir", user_id=user.id, pc_id=pc.id, status="aktif", token_sesi=secrets.token_hex(32), waktu_mulai_sesi=now_local(), waktu_tersimpan_awal=user.sisa_kuota_menit)`.
   - Tulis log staf: `"KASIR_LOGIN_CLIENT"`.
   - Kembalikan respons JSON:
     ```json
     {
       "success": true,
       "waktu_tersimpan": user.sisa_kuota_menit,
       "nama": user.nama_lengkap or user.username,
       "grup": "Kasir Benefit",
       "pc_kode": pc.kode,
       "token_sesi": sesi.token_sesi,
       "sesi_id": sesi.id
     }
     ```

### B. Client Polling Status & Penutupan Sesi (`ClientService`)
- Saat polling `/api/v1/public/client/status`:
  - Jika sesi bertipe `kasir`, kembalikan `sisa_detik = sesi.sisa_menit() * 60`.
  - Jika sisa waktu $\le 0$, kembalikan `lock_screen: true` dan tutup sesi.
- Saat `/selesai` atau kasir logout:
  - Hitung sisa menit aktual, simpan ke `user.sisa_kuota_menit`.
  - Update `sesi.status = "selesai"`, `sesi.selesai_pada = now_local()`.
  - Tulis log staf: `"KASIR_LOGOUT_CLIENT"`.

### C. Manajemen Kuota Staf & Log API (`user_routes.py` & `user_service.py`)
- `PUT /api/v1/kasir/user/<id>/kuota`: Admin menyetel kuota bulanan tetap (dalam jam/menit).
- `POST /api/v1/kasir/user/<id>/tambah-kuota`: Admin menambahkan jam bonus manual (misal +5 jam) beserta alasan/keterangan.
- `GET /api/v1/kasir/user/logs`: Mengambil riwayat audit aktivitas staf dengan filter pencarian dan tanggal.

---

## 5. Antarmuka Pengguna (UI)

### A. Sidebar Admin (`sidebar_admin.html`)
Di dalam dropdown **Manajemen Staff**:
1. **Akun Kasir & Admin** (`data-tab="user"`): Tab utama kelola kasir.
2. **Log & Riwayat Staff** (`data-tab="user_logs"`): Tab laporan audit staf.

### B. Tab Akun Kasir & Admin (`user.html` & `user/index.js`)
- Tabel akun kasir menampilkan kolom baru:
  - **Kuota Bulanan**: Misal `120 Jam/Bln`
  - **Sisa Waktu Main**: Misal `94 Jam 15 Menit` (berwarna hijau jika > 0, abu-abu jika 0)
- Menu Aksi Kasir:
  - Tombol **⏱️ Atur Kuota**: Membuka modal untuk menyetel jatah jam bulanan tetap.
  - Tombol **➕ Tambah Jam Bonus**: Membuka modal untuk menambah jam tambahan langsung ke saldo bermain kasir.

### C. Tab Baru: Log & Riwayat Staff (`user_logs.html`)
- Filter: Tanggal (Dari - Sampai) dan Filter Kasir.
- Tabel dengan kolom:
  - **Waktu**: Tanggal & jam kegiatan
  - **Kasir Terkait**: Nama & username kasir
  - **Jenis Aktivitas**: Badge berwarna (TAMBAH_KUOTA, RESET_KUOTA, SESI_BERMAIN, EDIT_PASSWORD, DLL)
  - **Rincian**: Informasi perubahan durasi, PC yang dipakai, atau admin pelaksana
  - **Operator**: Admin yang melakukan aksi (atau "Sistem")

---

## 6. Rencana Pengujian (Test Plan)

1. **Unit Tests Model & Helper**:
   - Validasi inisialisasi kuota bermain dan konversi jam ke menit.
   - Validasi auto-reset bulanan saat melintasi bulan (`YYYY-MM`).
   - Validasi penambahan bonus jam kasir.
2. **Unit Tests Autentikasi Client**:
   - Login kasir dengan kuota aktif $\rightarrow$ sesi tipe `kasir` berhasil dibuka.
   - Login kasir dengan sisa kuota 0 $\rightarrow$ ditolak dengan pesan kuota habis.
   - Pencegahan multi-login di 2 PC bersamaan.
3. **Pengujian Sesi & Pengurangan Saldo**:
   - Verifikasi sisa menit berkurang secara akurat saat sesi berjalan.
   - Verifikasi logout kasir menyimpan sisa waktu bermain ke akun kasir.
4. **Isolasi Laporan**:
   - Verifikasi bahwa sesi kasir tidak tercatat dalam omset pendapatan billing (`ReportService`).
5. **Otorisasi API**:
   - Non-admin ditolak saat mencoba menyetel kuota atau mengambil log staf.
6. **Full Suite Regression**:
   - Menjalankan 211+ pytest untuk memastikan tidak ada efek samping terhadap fitur eksisting.

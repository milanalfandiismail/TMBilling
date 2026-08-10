# Database Maintenance & Data Retention Design Specification

> **Feature Version:** TMBilling v1.5.2  
> **Status:** Approved Specification  
> **Target Audience:** Core Backend & Frontend Developers  

---

## 🎯 1. Overview & Goals

Modul **Database Maintenance & Data Retention** memberikan kemampuan kepada pengguna dengan peran **Admin** (`role == 'admin'`) untuk membersihkan data histori operasional lampau yang sudah berumur tua, guna menjaga efisiensi ruang simpanan disk SQLite (`warnet.db`) serta merapikan indeks kueri database.

### Prinsip Keamanan & Desain:
1. **100% Proteksi Saldo & Akun Member**: Data akun member (`member`), sisa saldo `waktu_tersimpan`, dan tanggal `kadaluarsa_pada` **TIDAK PERNAH DISENTUH** atau dihapus.
2. **100% Proteksi Master Data Operasional**: Data master PC (`pc`), Zona (`grup`), Paket Billing (`paket`), Katalog Kantin (`menu_item`), Katalog Game (`game`), User Staff (`user`), dan Sesi PC yang sedang berjalan (`status == 'aktif'`) **100% TERLINDUNGI**.
3. **Penyekatan Role `@admin_required`**: Fitur hanya dapat diakses oleh user yang sedang login dengan peran Admin tanpa memerlukan penggetikan ulang password.
4. **Manual Triggering**: Berjalan murni berdasarkan eksekusi manual Admin via UI Settings. Tidak ada background worker otomatis yang menghapus data tanpa persetujuan Admin.
5. **Otomatisasi Snapshot Backup**: Sistem selalu membuat snapshot file cadangan database utuh `.db` di folder khusus **`backups/archive/`** (terpisah dari folder backup harian `backups/` agar tidak terhapus oleh rotasi pembersihan backup harian) tepat sebelum pembersihan data dilakukan.
6. **Pelepasan Space Disk Fisik (`VACUUM`)**: Menjalankan instruksi `VACUUM;` dan `PRAGMA optimize;` pasca penghapusan untuk mengembalikan kapasitas memori disk SQLite secara fisik ke Windows OS.

---

## 🏗️ 2. Architectural Design & Data Flow

```
┌───────────────────────────┐
│ Admin Dashboard Settings  │
│ (Maintenance Sub-section) │
└─────────────┬─────────────┘
              │ 1. POST /api/v1/kasir/settings/database/purge-and-vacuum
              │    Payload: { "retention_months": 1|3|6|12 }
              ▼
┌───────────────────────────┐
│ Settings Maintenance Route│ ── (Check @admin_required)
└─────────────┬─────────────┘
              │ 2. Call DBMaintenanceService.purge_and_vacuum()
              ▼
┌───────────────────────────┐
│  DBMaintenanceService     │
├───────────────────────────┤
│ A. BackupService.create() │ ──> Snapshot created in backups/archive/
│ B. Calculate cutoff date  │     cutoff_date = UTC_NOW - retention_months
│ C. Delete Old History     │ ──> Delete: pc_process, pc_uptime_log,
│                           │            maintenance_ticket (closed),
│                           │            transaksi_menu, transaksi, sesi (closed),
│                           │            shift_record (closed)
│ D. db.session.commit()    │
│ E. Physical DB Shrink     │ ──> Execute: VACUUM; PRAGMA optimize;
└─────────────┬─────────────┘
              │ 3. Return JSON Response
              ▼
┌───────────────────────────┐
│   UI Confirmation Modal   │ ──> Display: Backup filename, deleted row count,
└───────────────────────────┘     DB file size reduction (e.g., 1.8 MB -> 420 KB)
```

---

## 📦 3. Data Retention Targets

Hanya baris rekaman pada tabel-tabel histori berikut yang dibuat/diselesaikan **SEBELUM** tanggal batas (`cutoff_date`) yang akan dibersihkan:

| Tabel | Filter Pembersihan (`< cutoff_date`) | Keterangan |
| :--- | :--- | :--- |
| `pc_process` | `last_update < cutoff_date` | Telemetri proses aplikasi PC |
| `pc_uptime_log` | `date < cutoff_date` | Log operasional aktif PC |
| `maintenance_ticket` | `status IN ('selesai', 'dibatalkan') AND dibuat_pada < cutoff_date` | Tiket perbaikan PC yang sudah ditutup |
| `transaksi_menu` | `transaksi_id IN (SELECT id FROM transaksi WHERE dibuat_pada < cutoff_date)` | Detail item belanja F&B lampau |
| `transaksi` | `dibuat_pada < cutoff_date` | Histori nota transaksi keuangan lampau |
| `sesi` | `status = 'selesai' AND waktu_selesai < cutoff_date` | Histori sesi bermain yang sudah ditutup |
| `shift_record` | `status = 'selesai' AND waktu_mulai < cutoff_date` | Laporan shift kasir lampau |

---

## 🌐 4. API Endpoint Specification

### `POST /api/v1/kasir/settings/database/purge-and-vacuum`

- **Otentikasi:** Flask Session (`@admin_required`)
- **Request Body:**
  ```json
  {
    "retention_months": 6
  }
  ```
  *Keterangan: Value `retention_months` yang valid adalah integer `1`, `3`, `6`, atau `12`.*

- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Pembersihan database dan optimasi VACUUM berhasil dieksekusi.",
    "backup_file": "warnet_backup_before_purge_20260810_220512.db",
    "retention_months": 6,
    "cutoff_date": "2026-02-10 22:05:12",
    "deleted_summary": {
      "transaksi": 1420,
      "transaksi_menu": 850,
      "sesi": 1390,
      "pc_process": 15400,
      "pc_uptime_log": 450,
      "maintenance_ticket": 12,
      "shift_record": 180
    },
    "storage_stats": {
      "initial_size_bytes": 1843200,
      "final_size_bytes": 430080,
      "initial_size_human": "1.80 MB",
      "final_size_human": "420.00 KB",
      "saved_space_human": "1.38 MB"
    }
  }
  ```

- **Error Response (`400 Bad Request / 403 Forbidden`):**
  ```json
  {
    "success": false,
    "error": "Akses ditolak. Fitur ini hanya dapat dieksekusi oleh akun Admin."
  }
  ```

---

## 🎨 5. Frontend Interface Design

### Halaman Settings Kasir (`app/templates/kasir/settings/maintenance.html` & `modules/settings/index.js`):
1. **Kartu Komponen "Database Maintenance & Retention"**:
   - Judul & Subtitle penjelasan keamanan data.
   - Select Input **Batas Usia Data**: `1 Bulan`, `3 Bulan`, `6 Bulan (Rekomendasi)`, `1 Tahun`.
   - Tombol Aksi: `[ 🧹 Backup & Bersihkan Database ]` (Tampil khusus jika `user.role === 'admin'`).
2. **Modal Hasil Eksekusi**:
   - Menampilkan tanda centang sukses hijau besar.
   - Ringkasan lokasi file backup yang dibuat.
   - Tabel ringkasan baris data yang dibersihkan.
   - Badges perbandingan ukuran file DB sebelum vs sesudah `VACUUM`.

---

## 🧪 6. Verification & Test Plan

1. **Unit & Service Test**:
   - Verifikasi pembuatan file backup di folder `backups/archive/` sebelum pembersihan.
   - Verifikasi bahwa data `< cutoff_date` terhapus dan data `>= cutoff_date` tetap ada.
   - Verifikasi bahwa saldo member (`member.waktu_tersimpan`) **TIDAK BERUBAH**.
2. **Security Test**:
   - Percobaan eksekusi endpoint menggunakan akun bertipe `kasir` (Harus ditolak dengan HTTP 403).
3. **VACUUM Shrink Test**:
   - Memastikan perintah `VACUUM` berhasil mengecilkan ukuran `warnet.db` di disk tanpa error.

# Design Spec: Pembuatan Utility Script Ekspor Tutorial ke JSON

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Database Utility Scripts

---

## 1. Ikhtisar Masalah & Solusi Desain

### A. Masalah: Ekspor Data Tutorial Default
- **Problem**: Admin dapat membuat atau menyunting tutorial melalui UI CKEditor di aplikasi lokal. Developer memerlukan cara mudah untuk mengekspor data tutorial terbaru tersebut dari database ke dalam file `app/data/seed_tutorials.json` agar bisa didistribusikan ke klien sebagai data awal (seed).
- **Tujuan**: Menyediakan script Python utility mandiri di dalam folder `scripts/` yang dapat dijalankan dengan mudah dari root direktori untuk mengekspor seluruh data `SystemTutorial` ke file JSON.

### B. Solusi: `scripts/export_tutorials.py`
1. **Lokasi Folder yang Rapi**:
   - Pindahkan script ke `scripts/export_tutorials.py`.
2. **Logika Ekspor**:
   - Script akan memuat context Flask (`create_app()`).
   - Query semua record dari tabel `SystemTutorial` terurut berdasarkan `urutan` dan `id`.
   - Mengubah instance model menjadi list dictionary JSON-friendly.
   - Menyimpan output dengan indentation rapi dan encoding UTF-8 ke `app/data/seed_tutorials.json`.
3. **Pembersihan Root**:
   - Hapus script sementara `export_tutorials.py` yang ada di root direktori agar bersih.

---

## 2. Rencana Verifikasi

1. **Uji Eksekusi Script**:
   - Jalankan `python scripts/export_tutorials.py`.
   - Verifikasi file `app/data/seed_tutorials.json` ter-update dengan benar.
2. **Uji Validasi JSON**:
   - Pastikan JSON yang dihasilkan dapat dibaca oleh parser Python.

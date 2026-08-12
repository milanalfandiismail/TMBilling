# Superpowers Implementation Plan: Penyelamatan Gambar Tutorial Hanya Saat Selesai Simpan

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-tutorial-image-save-on-confirm-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-tutorial-image-save-on-confirm-design.md)  
**Tujuan**: Memisahkan direktori unggah gambar CKEditor ke folder draf `temp/` dan memindahkannya ke aset permanen saat tutorial disimpan.

---

## Task Breakdown

### Task 1: Konfigurasi .gitignore
- **File Target**: [`.gitignore`](file:///c:/Project%20GIT/TMBilling/.gitignore)
- **Langkah-langkah**:
  1. Tambahkan baris `app/static/assets/tutorials/temp/` di bagian bawah berkas.

### Task 2: Modifikasi Endpoint Unggah Gambar CKEditor
- **File Target**: [`app/routes/tutorial/tutorial_routes.py`](file:///c:/Project%20GIT/TMBilling/app/routes/tutorial/tutorial_routes.py)
- **Langkah-langkah**:
  1. Ubah variabel `upload_dir` di `upload_tutorial_image()` agar menunjuk ke `app/static/assets/tutorials/temp`.
  2. Sesuaikan variabel return `url` agar mengembalikan `/static/assets/tutorials/temp/{filename}`.

### Task 3: Implementasi Logika Pemindahan Gambar di Service
- **File Target**: [`app/services/tutorial/tutorial_service.py`](file:///c:/Project%20GIT/TMBilling/app/services/tutorial/tutorial_service.py)
- **Langkah-langkah**:
  1. Tulis fungsi penolong `move_temp_images(content)` di dalam file. Fungsi ini menggunakan regex untuk memindai nama file gambar dalam `temp/`, memindahkannya ke folder permanen `app/static/assets/tutorials/` jika ditemukan di filesystem, dan mengubah isi teks string `content` menjadi URL permanen.
  2. Modifikasi `TutorialService.create()` dan `TutorialService.update()` untuk memanggil `move_temp_images()` sebelum menyimpan data ke database.

### Task 4: Verifikasi Akhir
- **Langkah-langkah**:
  1. Jalankan `npm run build:css`.
  2. Jalankan pengecekan boot Flask App Factory.

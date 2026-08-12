# Superpowers Implementation Plan: Redesain Layout Dokumentasi & CKEditor Enhancements

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-documentation-redesign-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-documentation-redesign-design.md)  
**Tujuan**: Mengimplementasikan perbaikan UI split-button CKEditor, penambahan font family & font size, fitur hapus kategori (relokasi ke "Kosong"), modal editor fullscreen mode compact, serta perancangan ulang layout dokumentasi 3-kolom.

---

## Task Breakdown & Checkpoints

### Task 1: Perbaikan Styling Dark Mode CKEditor Split Button & Modal Compact
- **File Target**: [`app/templates/kasir/tabs/tutorials.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/tutorials.html)
- **Langkah-langkah**:
  1. Tambahkan aturan CSS spesifik untuk `.ck.ck-splitbutton`, `.ck.ck-splitbutton__action`, dan `.ck.ck-splitbutton__arrow` hover states agar selaras dengan warna `#1c1c1c` tanpa kilatan warna putih kontras.
  2. Ubah class CSS `modal-tutorial-editor` agar berukuran full-screen compact (`w-[95%] h-[92vh] max-w-[95%] scale-[0.95] overflow-y-auto`) untuk meminimalkan scrollbar eksternal.

### Task 2: Tambahkan Opsi Font Family & Font Size ke Inisialisasi CKEditor
- **File Target**: [`app/static/js/kasir/modules/tutorials/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/tutorials/index.js)
- **Langkah-langkah**:
  1. Sertakan properti `fontFamily` dan `fontSize` pada konfigurasi `ClassicEditor.create(...)`.
  2. Masukkan daftar opsi font (Inter, Roboto, Arial, Courier New, Georgia, Times New Roman, Verdana, dll) dan ukuran font (9px - 32px).

### Task 3: Implementasi Backend API Hapus Kategori & Relokasi ke "Kosong"
- **File Target**: 
  - [`app/repositories/tutorial_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/tutorial_repository.py)
  - [`app/services/tutorial/tutorial_service.py`](file:///c:/Project%20GIT/TMBilling/app/services/tutorial/tutorial_service.py)
  - [`app/routes/tutorial/tutorial_routes.py`](file:///c:/Project%20GIT/TMBilling/app/routes/tutorial/tutorial_routes.py)
- **Langkah-langkah**:
  1. Buat metode `delete_category(category_name)` pada repository & service yang mengubah seluruh data tutorial ber-kategori `category_name` menjadi `"Kosong"`.
  2. Buat endpoint DELETE `/api/v1/kasir/tutorials/categories/<category_name>` pada route Flask.

### Task 4: Perancangan Ulang Layout Dokumentasi (3-Kolom Wiki Layout)
- **File Target**:
  - [`app/templates/kasir/tabs/tutorials.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/tutorials.html)
  - [`app/static/js/kasir/modules/tutorials/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/tutorials/index.js)
- **Langkah-langkah**:
  1. Ubah struktur `#tab-tutorials` di HTML menjadi layout 3-kolom:
     - **Sidebar Kategori (Kiri)**: Daftar Kategori + Tombol Hapus Kategori untuk Admin.
     - **Sidebar Daftar Panduan (Tengah)**: List item judul tutorial dalam kategori aktif.
     - **Reader Konten Utama (Kanan)**: Tampilan visual isi tutorial + Tombol Edit/Hapus Panduan.
  2. Perbarui fungsi `Tutorials.renderTutorials()` dan penanganan event di JavaScript untuk mendukung navigasi 3-kolom.

### Task 5: Build Tailwind CSS & Verifikasi Akhir
- **Langkah-langkah**:
  1. Jalankan `npm run build:css`.
  2. Jalankan tes App Factory Flask.
  3. Lakukan verifikasi manual pada browser.

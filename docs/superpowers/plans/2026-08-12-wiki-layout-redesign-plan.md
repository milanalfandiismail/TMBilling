# Superpowers Implementation Plan: Redesain Layout Wiki Dokumentasi ala Claude Code Docs

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-wiki-layout-redesign-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-wiki-layout-redesign-design.md)  
**Tujuan**: Mengubah antarmuka halaman standalone dokumentasi menjadi layout Wiki terpadu (seperti Claude Code Docs) dengan kategori sebagai sub-header sidebar dan daftar panduan langsung terintegrasi di bawahnya.

---

## Task Breakdown

### Task 1: Pembaruan Template HTML Dokumentasi Standalone
- **File Target**: [`app/templates/kasir/documentation.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/documentation.html)
- **Langkah-langkah**:
  1. Sesuaikan layout 2-kolom:
     - **Sidebar Kiri (`w-72 bg-[#0c0c0c] border-r border-[#1c1c1c]`)**: Menampung `#wiki-sidebar` untuk memuat sub-header kategori dan navigasi judul tutorial.
     - **Area Utama (`flex-1`)**: Menampung `#wiki-reader-area` untuk menampilkan konten panduan aktif.
  2. Pastikan modal editor `modal-tutorial-editor` tetap ada pada berkas template.

### Task 2: Refaktorisasi Rendering Frontend di JavaScript
- **File Target**: [`app/static/js/kasir/modules/tutorials/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/tutorials/index.js)
- **Langkah-langkah**:
  1. Hapus fungsi-fungsi lama `renderCategoriesSidebar()` dan `renderTutorialsContainer()`.
  2. Implementasikan `renderSidebar()`:
     - Kelompokkan tutorial berdasarkan kategori.
     - Render nama kategori sebagai Sub-Header sidebar (dengan huruf besar/uppercase dan ikon).
     - Render tombol hapus kategori `🗑` khusus admin di samping sub-header kategori.
     - Render judul panduan sebagai list-item navigasi di bawah masing-masing sub-header kategori.
  3. Implementasikan `renderActiveTutorial()`:
     - Render header konten: nama kategori (kecil, uppercase) dan Judul Panduan (besar).
     - Render tombol Edit & Hapus panduan untuk Admin di samping judul.
     - Tampilkan konten rich-text tutorial.
  4. Perbarui `loadTutorials()` agar otomatis memilih item pertama jika tidak ada item yang aktif dipilih.

### Task 3: Build CSS & Verifikasi Akhir
- **Langkah-langkah**:
  1. Jalankan `npm run build:css`.
  2. Lakukan pengecekan boot Flask App Factory.
  3. Verifikasi navigasi wiki baru di browser.

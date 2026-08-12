# Superpowers Implementation Plan: Penyederhanaan Modal & Layout Dokumentasi

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-tutorial-modal-and-layout-refinement-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-tutorial-modal-and-layout-refinement-design.md)  
**Tujuan**: Memperkecil modal Tambah/Edit Panduan agar compact dan tidak memicu scrollbar eksternal, menghilangkan pemotongan teks (`truncate`) pada kategori, serta menyederhanakan layout dokumentasi menjadi 2-kolom yang efisien.

---

## Task Breakdown

### Task 1: Perapihan Ukuran Modal (Compact Modal View)
- **File Target**: [`app/templates/kasir/tabs/tutorials.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/tutorials.html)
- **Langkah-langkah**:
  1. Ubah class `modal-tutorial-editor` dari `max-w-[96vw]` menjadi `max-w-4xl max-h-[88vh] h-auto rounded-2xl shadow-2xl`.
  2. Sesuaikan tinggi min-height CKEditor `.ck-content` dari `400px` menjadi `200px` (dengan `max-height: 380px` internal) agar seluruh form pas di layar tanpa scrollbar pada body modal.

### Task 2: Nama Kategori Utuh Tanpa Truncate
- **File Target**: [`app/static/js/kasir/modules/tutorials/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/tutorials/index.js)
- **Langkah-langkah**:
  1. Hapus class CSS `truncate` dari fungsi `renderCategoriesSidebar()`.
  2. Izinkan teks kategori tampil utuh dan melakukan *text-wrapping* alami jika panjang.

### Task 3: Penyederhanaan Layout Dokumentasi (2-Kolom Clean View)
- **File Target**:
  - [`app/templates/kasir/tabs/tutorials.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/tutorials.html)
  - [`app/static/js/kasir/modules/tutorials/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/tutorials/index.js)
- **Langkah-langkah**:
  1. Ubah kontainer dokumentasi di HTML menjadi 2 kolom:
     - **Kolom Kiri (`w-64`)**: Sidebar Kategori (nama utuh, badge jumlah item, tombol hapus kategori).
     - **Kolom Kanan (`flex-1`)**: Daftar kartu panduan dalam kategori aktif yang menampilkan header panduan, emoji, badge, tombol aksi Edit/Hapus, serta konten panduan secara bersih dan nyaman dibaca.
  2. Perbarui JavaScript `renderTutorialsList()` untuk merender kartu-kartu panduan secara langsung pada area utama.

### Task 4: Build Tailwind CSS & Verifikasi Akhir
- **Langkah-langkah**:
  1. Kompilasi stylesheet: `npm run build:css`.
  2. Verifikasi fungsi Flask factory.
  3. Verifikasi tampilan modal dan layout baru.

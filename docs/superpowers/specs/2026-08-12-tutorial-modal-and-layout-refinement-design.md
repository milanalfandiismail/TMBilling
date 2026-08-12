# Design Spec: Penyederhanaan Layout Dokumentasi & Penyesuaian Ukuran Modal Editor

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Kasir Module (Tutorials & Documentation Tab)

---

## 1. Pokok Perubahan UI/UX

Berdasarkan masukan terbaru pengguna, antarmuka **Dokumentasi & Editor Panduan** disederhanakan dengan poin-poin perbaikan berikut:

### 1. Modal Tambah & Edit Panduan Lebih Ringkas (Compact Modal)
- **Problem**: Ukuran modal editor saat ini terlalu besar (`96vw x 92vh`) sehingga memicu scrollbar eksternal dan terasa bulky untuk form input.
- **Solusi**:
  - Mengubah dimensi modal menjadi `max-w-4xl w-full max-h-[85vh]` dengan `h-auto`.
  - Mengurangi padding internal (`p-4 sm:p-5`) dan gap antar elemen form (`gap-3`).
  - Menyetel tinggi awal CKEditor menjadi `min-h-[220px] max-h-[350px]` agar seluruh form (Judul, Emoji, Kategori, Urutan, dan Editor) langsung muat secara pas dalam satu layar tanpa scrollbar pada modal body, kecuali jika teks panduan yang dimasukkan sangat panjang.

### 2. Nama Kategori Tanpa Truncate
- **Problem**: Nama kategori yang panjang sebelumnya terpotong (`truncate`).
- **Solusi**:
  - Menghapus class CSS `truncate` dari item kategori di sidebar.
  - Nama kategori akan tampil utuh dan membungkus secara rapi jika panjang.

### 3. Penyederhanaan Layout Dokumentasi (Clean 2-Column Accordion Layout)
- **Problem**: Kolom 2 (Daftar Panduan terpisah) membuat layout terlalu banyak pembagian kolom dan terasa kurang efisien.
- **Solusi**:
  - Menyederhanakan layout menjadi **2 Kolom Utama (Sidebar Kategori + Area Panduan Utama)**:
    - **Kolom Kiri (Sidebar Kategori)**: Daftar kategori lengkap tanpa truncate + jumlah item + tombol hapus kategori (khusus Admin).
    - **Kolom Kanan (Area Panduan Utuh)**: Daftar kartu panduan dalam kategori aktif yang menampilkan judul, emoji, badge kategori, serta tombol Expand/Collapse (Accordion) untuk membaca isi lengkap panduan dengan cepat dan nyaman tanpa berpindah-pindah 3 kolom.

---

## 2. Rencana Implementasi Komponen

### A. Template HTML (`app/templates/kasir/tabs/tutorials.html`)
- Mengubah struktur layout dari 3 kolom menjadi 2 kolom (`Sidebar Kategori` [w-64] dan `Area Panduan Main` [flex-1]).
- Mengubah dimensi `modal-tutorial-editor` dari fullscreen `max-w-[96vw]` menjadi compact `max-w-4xl max-h-[85vh] shadow-2xl rounded-xl`.

### B. Frontend Logic (`app/static/js/kasir/modules/tutorials/index.js`)
- Memperbarui `renderTutorialsList()` untuk merender layout 2-kolom dengan kartu panduan interaktif yang mendukung toggle lipat/buka (expand/collapse) isi panduan.
- Memastikan `renderCategoriesSidebar()` menampilkan nama kategori secara utuh tanpa `truncate`.

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Ukuran Modal**: Membuka modal Tambah/Edit Panduan dan memverifikasi bahwa modal tampil compact tanpa scrollbar utama pada layar 1080p/720p.
2. **Uji Nama Kategori**: Membikin kategori panjang (misal: "Pengaturan Jaringan & Cloudflare Zero Trust") dan memverifikasi bahwa teks tidak terpotong (`truncate`).
3. **Uji Layout 2-Kolom**: Memilih kategori di sebelah kiri dan memverifikasi bahwa panduan di sebelah kanan tampil bersih dan nyaman dibaca.

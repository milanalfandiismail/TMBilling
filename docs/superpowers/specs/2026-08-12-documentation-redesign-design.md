# Design Spec: Redesain Layout Dokumentasi & CKEditor Enhancements

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Kasir Module (Tutorials & Documentation Tab)

---

## 1. Ikhtisar & Perubahan Utama

Tujuan dari spesifikasi ini adalah merombak antarmuka **Dokumentasi & Panduan Sistem** menjadi standar Wiki/Dokumentasi modern 3-Kolom, serta menyempurnakan fitur penyuntingan teks CKEditor 5.

### Perubahan Utama:
1. **Perbaikan UI Hover Split-Button CKEditor**: Mengeliminasi warna putih kontras pada tombol split CKEditor 5 saat kursor diarahkan ke ikon utama.
2. **Opsi Jenis & Ukuran Font**: Menambahkan pilihan Font Family (Inter, Roboto, Arial, Courier New, Georgia, Times New Roman, Verdana, dll) dan Font Size (9px - 32px) di toolbar editor.
3. **Fitur Hapus Kategori & Relokasi Kategori Kosong**: Admin dapat menghapus kategori yang tidak lagi dibutuhkan. Semua panduan di bawah kategori tersebut secara otomatis dialihkan ke kategori `"Kosong"`.
4. **Modal Editor Fullscreen Compact (Zoom-Out)**: Mengubah modal penyuntingan tutorial menjadi modal berukuran penuh dengan skala tampilan compact agar tidak memerlukan scrolling berlebih pada viewport.
5. **Redesain Layout Tab 3-Kolom**: Mengganti tata letak card grid menjadi struktur 3-kolom:
   - **Kolom 1 (Sidebar Kategori)**: Navigasi kategori + Tombol Hapus Kategori (khusus Admin).
   - **Kolom 2 (Sidebar Daftar Panduan)**: Daftar judul & emoji panduan yang terhubung dengan kategori terpilih.
   - **Kolom 3 (Area Reader Utama)**: Tampilan visual isi panduan beserta aksi Edit & Hapus.

---

## 2. Arsitektur & Antarmuka Komponen

### A. Layout 3-Kolom (`app/templates/kasir/tabs/tutorials.html`)
```
+----------------------------------------------------------------------------------------------------+
| HEADER: 📚 Dokumentasi & Panduan Sistem                                      [+ Tambah Panduan]   |
+------------------------------------+--------------------------------+------------------------------+
| KOLOM 1: Kategori                  | KOLOM 2: Daftar Panduan        | KOLOM 3: Reader Konten       |
| ---------------------------------- | ------------------------------ | ---------------------------- |
| [Semua Panduan (5)]                | 🌐 Setup Cloudflare Tunnel     | 🌐 Setup Cloudflare Tunnel   |
| 🌐 Cloudflare & VNC (2)       [🗑️] | 📡 Konfigurasi Mikrotik Router  | Kategori: Cloudflare & VNC   |
| 📡 Jaringan (1)               [🗑️] |                                | ---------------------------- |
| ⚙️ Umum (1)                    [🗑️] |                                | [Langkah-langkah isi ...]    |
| 📁 Kosong (1)                 [🗑️] |                                |                              |
+------------------------------------+--------------------------------+------------------------------+
```

### B. Backend API Endpoint (`app/routes/tutorial/tutorial_routes.py`)
- `DELETE /api/v1/kasir/tutorials/categories/<category_name>`
  - Memeriksa peran admin.
  - Memanggil `TutorialService.delete_category(category_name)`.
  - Mengubah kolom `category` pada tabel/modul tutorial dari `<category_name>` menjadi `"Kosong"`.
  - Mengembalikan respon JSON: `{"success": true, "message": "Kategori berhasil dihapus"}`.

### C. CKEditor Dark Theme Styling & Font Config (`app/static/js/kasir/modules/tutorials/index.js` & `tutorials.html`)
- Mengatur `fontFamily` & `fontSize` pada konfigurasi `ClassicEditor.create(...)`.
- Menambahkan aturan CSS `.ck-splitbutton:hover` agar warna latar belakang tombol kiri & panah kanan tetap selaras (`#1c1c1c` / `#262626`).

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Hover Split-Button**: Memastikan tombol split icon di toolbar tidak menampilkan kotak putih saat kursor diarahkan ke bagian kiri.
2. **Uji Font**: Memastikan dropdown Font Family dan Font Size berfungsi dan mengubah teks yang dipilih.
3. **Uji Hapus Kategori**: Menghapus salah satu kategori dan memverifikasi bahwa tutorial di dalamnya otomatis berpindah ke kategori **"Kosong"**.
4. **Uji Layout 3-Kolom**: Memilih kategori -> memilih judul tutorial -> membaca isi panduan di kolom kanan secara responsif.

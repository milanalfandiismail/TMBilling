# Design Spec: Redesain Layout Wiki Dokumentasi ala Claude Code Docs

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Standalone Documentation (`/kasir/documentation`)

---

## 1. Ikhtisar Perubahan UI/UX (Aesthetics Refinement)

Mengadopsi pola antarmuka dokumentasi modern (seperti Claude Code Docs):

### A. Left Sidebar: Daftar Kategori & Panduan Terintegrasi
- **Struktur**: 
  - Kategori direpresentasikan sebagai **Sub-Header Kategori** (misal: `UMUM`, `CLOUDFLARE & VNC`, `JARINGAN`).
  - Di bawah setiap Sub-Header Kategori, langsung ditampilkan **Daftar Judul Panduan** yang termasuk di dalamnya (misal: `Setup Cloudflare Tunnel`, `Config VNC Connection`, dll) sebagai link navigasi vertikal.
  - Khusus Admin, di samping Sub-Header Kategori akan muncul ikon tempat sampah `🗑️` saat hover untuk menghapus kategori (relokasi ke "Kosong").
- **Kekonsistenan**: Desain ini konsisten dengan dokumentasi standar industri, menghilangkan kerumitan navigasi bertingkat yang tidak konsisten.

### B. Right Area: Reader Konten Tunggal yang Terfokus
- Menampilkan konten panduan yang sedang aktif dipilih dari sidebar kiri.
- **Tampilan Header**:
  - Kategori dalam teks kecil uppercase (misal: `CLOUDFLARE & VNC`).
  - Judul Panduan dalam teks besar berukuran `text-3xl` atau `text-4xl` tebal.
  - Aksi Admin (Edit & Hapus) diletakkan di sebelah kanan judul utama secara rapi.
- **Tampilan Konten**: Rich-text dengan styling tipografi yang bersih, code block monospaced, list item terindentasi baik, dan tabel kontras tinggi.

---

## 2. Struktur Komponen & Implementasi

### A. Template HTML (`app/templates/kasir/documentation.html`)
- Mengubah struktur layout 2-kolom:
  - **Sidebar Kiri (`w-72`)**: Memuat kontainer kategori & panduan tunggal `#wiki-sidebar`.
  - **Area Konten Utama (`flex-1`)**: Memuat area pembaca panduan tunggal `#wiki-reader-area`.

### B. Frontend Logic (`app/static/js/kasir/modules/tutorials/index.js`)
- Mengubah logic render untuk mendukung struktur integrasi sidebar:
  - `renderSidebar()`: Mengelompokkan `tutorialsData` berdasarkan kategori, merender Sub-Header Kategori, lalu merender judul panduan di bawahnya dengan status `active` jika sedang terpilih.
  - `renderActiveTutorial()`: Merender konten lengkap dari tutorial yang aktif terpilih ke `#wiki-reader-area`.

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Sidebar Kiri**: Memverifikasi pengelompokan panduan di bawah sub-header kategori masing-masing secara benar dan rapi.
2. **Uji Navigasi Konten**: Klik judul panduan di sidebar kiri dan pastikan konten di kolom kanan langsung berubah secara instan.
3. **Uji Hapus Kategori**: Menghapus kategori melalui ikon `🗑️` di samping nama kategori dan memverifikasi panduan-panduan di dalamnya pindah ke kategori "Kosong".

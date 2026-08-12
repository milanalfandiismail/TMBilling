# Superpowers Implementation Plan: Perbaikan Scroll Dokumentasi & Bypass Inisialisasi Dashboard

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-documentation-scroll-and-init-fixes-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-documentation-scroll-and-init-fixes-design.md)  
**Tujuan**: Mengaktifkan scrollbar vertikal di halaman dokumentasi, menetapkan bendera global, dan memotong `App.init()` agar tidak melempar error dashboard.

---

## Task Breakdown

### Task 1: Konfigurasi Bendera & Scroll CSS pada Template HTML
- **File Target**: [`app/templates/kasir/documentation.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/documentation.html)
- **Langkah-langkah**:
  1. Ubah class div pembungkus utama dokumentasi dari `flex-1 flex flex-col min-h-screen` menjadi `flex-1 flex flex-col h-screen bg-[#050505] p-6 lg:p-8 space-y-6 overflow-y-auto`.
  2. Tambahkan deklarasi `window.IS_DOCUMENTATION_PAGE = true;` di bagian paling atas blok script (`{% block scripts %}`).

### Task 2: Modifikasi Inisialisasi Aplikasi di JavaScript
- **File Target**: [`app/static/js/kasir/app.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js)
- **Langkah-langsink**:
  1. Tambahkan pengecekan `if (window.IS_DOCUMENTATION_PAGE)` di baris pertama metode `async init()`.
  2. Jika bernilai true, panggil `await this.checkAuth()` lalu return untuk mencegah pemanggilan load tab dan interval dashboard kasir.

### Task 3: Build CSS & Verifikasi
- **Langkah-langkah**:
  1. Jalankan `npm run build:css`.
  2. Verifikasi bebas error konsol dan kemampuan scroll konten yang panjang.

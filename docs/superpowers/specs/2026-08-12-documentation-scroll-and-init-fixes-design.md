# Design Spec: Perbaikan Scroll Konten & Pembatasan Inisialisasi Dashboard di Halaman Dokumentasi

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Standalone Documentation (`/kasir/documentation`)

---

## 1. Pokok Perubahan & Perbaikan Bug

### A. Pembatasan Inisialisasi Tab Dashboard (`app.js`)
- **Problem**: Saat halaman `/kasir/documentation` dibuka, berkas `app.js` memicu `App.init()` secara otomatis. Hal ini menyebabkan error `[CompactGrid] #pc-area not found!` di konsol dan memicu alert toast error Mikrotik karena halaman dokumentasi tidak memiliki elemen-elemen DOM dashboard.
- **Solusi**:
  - Menyetel bendera `window.IS_DOCUMENTATION_PAGE = true` di dalam berkas `documentation.html`.
  - Di awal fungsi `App.init()`, periksa jika bendera tersebut bernilai `true`. Jika ya, jalankan pemeriksaan autentikasi `checkAuth()`, lalu lakukan `return` untuk menghentikan inisialisasi tab dashboard kasir.

### B. Perbaikan Scrolling Konten Panduan (`documentation.html`)
- **Problem**: Seluruh isi halaman dokumentasi tidak bisa di-scroll ketika teks panduan sangat panjang karena properti `overflow-hidden` bawaan pada elemen body.
- **Solusi**:
  - Mengubah kelas pembungkus utama dokumentasi dari `flex-1 flex flex-col min-h-screen` menjadi `flex-1 flex flex-col h-screen overflow-y-auto`.
  - Hal ini membatasi container setinggi viewport dan mengaktifkan scrollbar vertikal internal secara alami pada kontainer halaman dokumentasi.

---

## 2. Struktur Komponen & Implementasi

### A. Template HTML (`app/templates/kasir/documentation.html`)
- Tambahkan properti `window.IS_DOCUMENTATION_PAGE = true` pada blok script.
- Ubah class kontainer pembungkus utama menjadi `flex-1 flex flex-col h-screen bg-[#050505] p-6 lg:p-8 space-y-6 overflow-y-auto`.

### B. Frontend Controller (`app/static/js/kasir/app.js`)
- Ubah `App.init()` untuk memeriksa bendera `window.IS_DOCUMENTATION_PAGE`.

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Bebas Error Konsol**: Membuka `/kasir/documentation` dan memastikan tidak ada error `#pc-area not found` atau alert error Mikrotik.
2. **Uji Scroll Konten**: Membuka panduan dengan teks yang panjang dan memverifikasi isi konten dapat di-scroll dengan mulus.

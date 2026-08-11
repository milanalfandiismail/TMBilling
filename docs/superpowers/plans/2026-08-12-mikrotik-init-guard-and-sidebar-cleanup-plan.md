# Superpowers Implementation Plan: Guard Inisialisasi Mikrotik & Pembersihan Sidebar Dokumentasi

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-mikrotik-init-guard-and-sidebar-cleanup-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-mikrotik-init-guard-and-sidebar-cleanup-design.md)  
**Tujuan**: Menghilangkan toast error MikroTik pada halaman non-dashboard dan menghapus link dokumentasi redundan di sub-menu settings sidebar.

---

## Task Breakdown

### Task 1: Penerapan Guard Inisialisasi MikroTik di JavaScript
- **File Target**: [`app/static/js/kasir/modules/mikrotik/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/mikrotik/index.js)
- **Langkah-langkah**:
  1. Ubah block event listener DOMContentLoaded di paling bawah file.
  2. Tambahkan pengecekan `if (document.getElementById('mikrotik-enabled'))` sebelum memanggil `MikrotikModule.init()`.

### Task 2: Pembersihan Item Dokumentasi Redundan di Sidebar HTML
- **File Target**: [`app/templates/kasir/components/sidebar.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html)
- **Langkah-langkah**:
  1. Hapus baris yang berisi `<a href="/kasir/documentation" class="... text-left">📚 Dokumentasi & Tutorial</a>` di dalam kontainer `#settings-submenu`.

### Task 3: Build CSS & Verifikasi Akhir
- **Langkah-langkah**:
  1. Jalankan `npm run build:css`.
  2. Pastikan tidak ada error konsol / toast error Mikrotik saat halaman `/kasir/documentation` dimuat ulang.

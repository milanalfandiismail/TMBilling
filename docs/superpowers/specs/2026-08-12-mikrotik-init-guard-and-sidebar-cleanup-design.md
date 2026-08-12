# Design Spec: Guard Inisialisasi Mikrotik & Pembersihan Sidebar Dokumentasi

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling UI & Modules

---

## 1. Perbaikan Bug & Penyederhanaan Sidebar

### A. Guard Inisialisasi MikroTik (`app/static/js/kasir/modules/mikrotik/index.js`)
- **Problem**: Alert toast error "Gagal memuat pengaturan MikroTik" muncul di halaman Dokumentasi karena skrip inisialisasi modul MikroTik dijalankan secara membabi buta pada event `DOMContentLoaded` tanpa memeriksa apakah elemen-elemen DOM tab MikroTik (`#mikrotik-enabled`) ada di halaman tersebut.
- **Solusi**:
  - Bungkus pemanggilan `MikrotikModule.init()` di event listener DOMContentLoaded dengan kondisi:
    ```javascript
    if (document.getElementById('mikrotik-enabled')) {
        MikrotikModule.init();
    }
    ```
  - Ini akan mencegah modul memicu HTTP API request di halaman mana pun yang tidak memuat tab pengaturan MikroTik.

### B. Penghapusan Dokumentasi Redundan di Sub-Menu Settings (`app/templates/kasir/components/sidebar.html`)
- **Problem**: Terdapat duplikasi item navigasi "Dokumentasi & Tutorial". Pertama ada di menu utama (bawah), dan kedua ada di dalam sub-menu Settings.
- **Solusi**:
  - Hapus item link `📚 Dokumentasi & Tutorial` yang berada di dalam kontainer `#settings-submenu` pada `sidebar.html`.
  - Satu-satunya akses ke halaman Dokumentasi adalah dari menu utama sidebar sebelah kiri untuk menjaga kerapian antarmuka.

---

## 2. Struktur Pengujian & Verifikasi

1. **Uji Sidebar**: Membuka dashboard kasir dan memastikan link dokumentasi di sub-menu settings sudah terhapus.
2. **Uji MikroTik Toast**: Membuka `/kasir/documentation` dan memastikan tidak ada lagi toast error "Gagal memuat pengaturan MikroTik" yang muncul.

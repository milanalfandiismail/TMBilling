# Design Spec: Modal Konfirmasi Ekspor JSON & Toast Notification

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Documentation UI/UX

---

## 1. Ikhtisar Masalah & Solusi Desain

### A. Masalah: Dialog Browser Bawaan (`confirm()`)
- **Problem**: Pemanggilan dialog `confirm()` bawaan browser terasa kaku, tidak estetis, dan tidak konsisten dengan tema dark mode premium TMBilling.
- **Tujuan**: Mengganti dialog `confirm()` bawaan browser dengan **Modal Konfirmasi Custom (Dark Theme & Backdrop Blur)** serta Toast Notification saat sukses/gagal.

### B. Solusi Desain UI/UX
1. **Modal Konfirmasi Custom (`#modal-confirm-export`)**:
   - Dibuat di [`documentation.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/documentation.html).
   - Menggunakan estetika modern TMBilling: `fixed inset-0 bg-black/80 backdrop-blur-sm z-50`.
   - Menampilkan ikon `📥`, judul jelas, deskripsi dampak aksi, tombol **Batal** (`bg-neutral-800`), dan tombol **Ya, Ekspor Sekarang** (`bg-amber-500` / `bg-neutral-100`).
2. **Pengontrol JavaScript (`index.js`)**:
   - `exportTutorialsToJson()`: Membuka modal konfirmasi (`classList.remove('hidden')`).
   - `closeConfirmExportModal()`: Menutup modal konfirmasi (`classList.add('hidden')`).
   - `confirmExportTutorialsToJson()`: Menutup modal, memicu request `POST /api/v1/kasir/tutorials/export-json`, dan memanggil `showToast()` untuk notifikasi visual.

---

## 2. Rencana Verifikasi

1. **Uji Klik Tombol**: Klik tombol "Ekspor ke JSON", pastikan Modal Konfirmasi Custom muncul dengan animasi/backdrop blur (bukan dialog bawaan browser).
2. **Uji Batal**: Klik tombol "Batal", pastikan modal tertutup tanpa memicu API request.
3. **Uji Konfirmasi Ekspor**: Klik tombol "Ya, Ekspor Sekarang", pastikan modal tertutup, API request terkirim, file `seed_tutorials.json` ter-update, dan **Toast Notifikasi Sukses** tampil di layar.

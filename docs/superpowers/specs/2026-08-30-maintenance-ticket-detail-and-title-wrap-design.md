# Spec: Penyempurnaan Detail Tiket & Text Wrapping Tab Perawatan PC

## 1. Problem Statement
Saat pengguna melaporkan kerusakan unit PC di Tab Perawatan PC:
1. **Tombol "Detail" Tidak Tersedia untuk Tiket Aktif**:
   Pada [`app/static/js/kasir/modules/maintenance/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/maintenance/index.js), tombol `Detail` hanya ditampilkan jika status tiket adalah `SELESAI` atau `DITOLAK`. Untuk tiket dengan status `BARU` atau `DIPROSES`, tombol Detail tidak ada sehingga pengguna/teknisi tidak bisa melihat detail kerusakan lengkap yang dilaporkan.
2. **Judul Terpotong (`truncate max-w-[200px]`) & Deskripsi Tidak Tampak di Tabel**:
   Tabel daftar tiket memotong judul masalah yang panjang dengan `truncate max-w-[200px]` dan tidak menampilkan deskripsi kerusakan.
3. **Modal Detail Kurang Jelas & Modal Update Tanpa Ringkasan Masalah**:
   - `modal-detail-ticket` tidak menampilkan Judul Masalah secara terpisah (hanya menampilkan deskripsi).
   - `modal-update-ticket` tidak menampilkan ringkasan kerusakan PC yang sedang di-update, menyulitkan teknisi mengingat konteks kerusakan saat menulis catatan perbaikan.

## 2. Expected Behavior
1. **Teks Judul Masalah Tidak Diteruncate**:
   - Font size tetap sama (`text-xs lg:text-base` / `font-bold text-neutral-100`).
   - Teks yang panjang otomatis dibungkus ke baris bawah (`break-words whitespace-normal leading-snug`).
   - Deskripsi masalah ditampilkan ringkas di bawah judul dengan warna abu-abu (`text-[10px] lg:text-xs text-neutral-400 break-words leading-relaxed`) agar langsung terbaca sekilas.
2. **Akses Detail untuk Semua Status**:
   - Tombol **`Detail`** selalu muncul di kolom Aksi untuk semua status tiket (`BARU`, `DIPROSES`, `SELESAI`, `DITOLAK`).
   - Judul/kolom masalah di tabel dapat diklik untuk langsung membuka modal Detail.
3. **Modal Detail Tiket Lengkap**:
   - Menampilkan Judul Masalah dan Deskripsi Lengkap secara terpisah dan terstruktur.
   - Menampilkan status dengan badge warna yang sesuai (`BARU`: Amber/Kuning, `DIPROSES`: Biru, `SELESAI`: Hijau, `DITOLAK`: Merah).
4. **Modal Update Status Informatif**:
   - Menampilkan kotak ringkasan masalah (Unit PC, Kategori, Judul, Deskripsi) di bagian atas form update status.

## 3. Scope of Changes
- [`app/templates/kasir/tabs/maintenance.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/maintenance.html): Update struktur HTML `modal-update-ticket` dan `modal-detail-ticket`.
- [`app/static/js/kasir/modules/maintenance/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/maintenance/index.js): Update logika rendering tabel `renderTickets()`, `openDetailModal()`, dan `openUpdateModal()`.
- [`app/static/js/kasir/modules/laporan_maintenance/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/laporan_maintenance/index.js): Pastikan wrapping teks di tabel laporan riwayat juga responsif dan tidak terpotong.

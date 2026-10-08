# Desain Spesifikasi: Eliminasi Total Tombol Mutasi Frontend & Validasi Backend Cabang Remote

## 1. Konteks & Latar Belakang
Pada sprint sebelumnya, mode Read-Only telah diperkenalkan pada reverse proxy relay backend (`BranchProxyService.relay_request`) dengan pencegatan HTTP `403 Forbidden` untuk method `POST`, `PUT`, `DELETE`, `PATCH`. 

Namun, hasil pengujian langsung di antarmuka web kasir menemukan bahwa saat kasir/admin berpindah ke cabang remote (`activeBranchId !== '0'`), **tombol aksi seperti Tambah, Edit, Hapus, Restock, Pindah PC, dan Mutasi lainnya masih tampak dan dapat diklik di frontend**.

### Hasil Audit & Investigasi Akar Masalah (Root Causes):
1. **Akar Masalah CSS Purge (Krusial)**:
   - Aturan CSS:
     ```css
     body[data-branch-mode="remote"] .remote-hide-action {
         display: none !important;
     }
     ```
     sebelumnya ditempatkan di dalam `@layer components { ... }` pada `app/static/css/input.css`.
   - Tailwind CSS v3.4.19 mem-purge/menghilangkan selektor arbitrary descendant tersebut dari file output terkompilasi `app/static/css/tailwind.css`. Akibatnya, kelas `.remote-hide-action` **sama sekali tidak memiliki efek sembunyi di browser**.
2. **Akar Masalah Tombol Dinamis Belum Bertag `.remote-hide-action`**:
   - Sejumlah tombol aksi yang di-generate via JavaScript belum disematkan kelas `.remote-hide-action`:
     - **Menu Kantin (`menu/index.js`)**: Tombol Tambah Stok, Edit Menu, Arsipkan Menu, Hapus Permanen, dan Tambah ke Keranjang pada kartu katalog aktif, serta tombol Pulihkan dan Hapus Permanen pada kartu arsip.
     - **Turnamen (`tournament/index.js`)**: Tombol Hapus Turnamen, klik kartu match untuk update skor, tombol Selesaikan Turnamen, Buat Ronde Swiss Baru, dan Loloskan Tim ke Playoffs.
     - **Game & Aplikasi (`game/index.js` & `game.html`)**: Tombol Edit Game, Hapus Game, dan kolom `<th>Aksi</th>`.
     - **Perawatan PC (`maintenance/index.js` & `maintenance.html`)**: Tombol Proses Tiket, Tolak Tiket, Selesaikan Tiket, Hapus Tiket, dan kolom `<th>Aksi</th>`.
     - **Modal Detail PC (`dashboard_detail_modal.js`)**: Tombol Pindah PC dan Wake-on-LAN.
     - **Modal Detail Member (`member_modal.js`)**: Tombol Refund Paket Member.
     - **Tabel Header Skeleton (`grup.html`, `paket.html`)**: Kolom `<th>Aksi</th>`.
3. **Inisialisasi Awal Saat Reload Browser**:
   - Jika halaman di-reload saat sedang di cabang remote, `data-branch-mode="remote"` harus aktif sejak awal render DOM untuk menghindari *flicker* tombol sebelum JavaScript fully loaded.

---

## 2. Arsitektur Solusi Dual-Layer

### Layer 1: Frontend Hardening (CSS Global Non-Purged + JS Conditional Guard)
1. **Pelepasan Aturan CSS dari `@layer`**:
   - Memindahkan aturan `.remote-hide-action` ke level *root* di `input.css` (di luar `@layer`) agar Tailwind v3 mengompilasinya verbatim tanpa purge ke `tailwind.css`.
   - Menambahkan dukungan selector `[data-branch-mode="remote"] .remote-hide-action` dan `body[data-branch-mode="remote"] .remote-hide-action`.
2. **Tagging 100% Seluruh Tombol Aksi Mutasi**:
   - Menyematkan kelas `.remote-hide-action` pada semua elemen tombol Create, Update, Delete, Restock, Refund, Skor, Pindah PC, WOL di modul Menu, Turnamen, Game, Maintenance, Dashboard Detail Modal, Member Modal, serta header tabel terkait.
3. **Pencegahan Klik di Level JS (Event Guarding)**:
   - Pada handler aksi mutasi modal (seperti klik kartu match turnamen `openSkorModal`), tambahkan pemeriksaan:
     ```javascript
     if (typeof BranchManager !== 'undefined' && BranchManager.activeBranchId !== '0') {
         Toast.warning("Server cabang remote hanya dapat diakses dalam mode pantau (Read-Only).");
         return;
     }
     ```
4. **Early Inline Attribute Injection**:
   - Di `app/templates/kasir/index.html`, pasang script inline ringan di `<head>` untuk membaca `sessionStorage.getItem('active_branch_id')` dan segera menyematkan `data-branch-mode="remote"` ke `<html>` dan `<body>` sebelum DOM selesai di-parse.

### Layer 2: Backend Relay Validation (Reverse Proxy Interception)
- **Status Validasi Saat Ini**: Backend relay di [BranchProxyService.relay_request](file:///c:/Project%20GIT/TMBilling/app/services/branch/branch_proxy_service.py) telah memblokir seluruh request ber-header `X-Branch-ID` dengan method `POST`, `PUT`, `DELETE`, `PATCH` menghasilkan HTTP `403 Forbidden`.
- **Urutan Middleware**: Middleware `handle_branch_proxy_relay` telah didaftarkan sebelum validasi CSRF di `app/__init__.py`.
- **Pengujian Otomatis**: Unit test di `tests/test_branch_remote_readonly_sidebar.py` telah memvalidasi penolakan 403 ini pada level proxy relay.

---

## 3. Komponen & Berkas yang Terdampak

| Berkas | Jenis Perubahan | Deskripsi |
|---|---|---|
| `app/static/css/input.css` | CSS Root Rules | Pindahkan `.remote-hide-action` ke luar `@layer` |
| `app/static/css/tailwind.css` | Output CSS | Kompilasi ulang via `npm run build:css` |
| `app/templates/kasir/index.html` | Template Early Init | Sematkan `data-branch-mode` secara instan dari sessionStorage |
| `app/static/js/kasir/modules/menu/index.js` | JS Rendering | Tag `.remote-hide-action` pada kartu katalog aktif dan arsip |
| `app/templates/kasir/tabs/menu.html` | Jinja2 Template | Tag tombol checkout dan tab arsip |
| `app/static/js/kasir/modules/tournament/index.js` | JS Rendering & Event | Tag tombol hapus turnamen, stage finish, qualify, dan guard modal skor |
| `app/templates/kasir/tabs/tournament.html` | Jinja2 Template | Tag form modal buat turnamen |
| `app/static/js/kasir/modules/game/index.js` | JS Rendering | Tag tombol edit & hapus game di baris tabel |
| `app/templates/kasir/tabs/game.html` | Jinja2 Template | Tag `<th>Aksi</th>` dan modal tambah/kategori |
| `app/static/js/kasir/modules/maintenance/index.js` | JS Rendering | Tag tombol proses, tolak, selesaikan, hapus tiket |
| `app/templates/kasir/tabs/maintenance.html` | Jinja2 Template | Tag `<th>Aksi</th>` dan tombol lapor masalah |
| `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js` | JS Rendering | Tag tombol Pindah PC dan Wake-on-LAN |
| `app/static/js/kasir/modules/member/member_modal.js` | JS Rendering | Tag tombol Refund paket member |
| `app/templates/kasir/tabs/grup.html` | Jinja2 Template | Tag `<th>Aksi</th>` |
| `app/templates/kasir/tabs/paket.html` | Jinja2 Template | Tag `<th>Aksi</th>` |
| `tests/test_branch_remote_readonly_sidebar.py` | Pytest Verification | Perluas pengujian tombol dan CSS selector |

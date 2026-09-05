# Multi Cabang: Default Cabang Lokal & Manajemen Akun Kasir Remote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan Cabang Lokal selalu sebagai default saat browser ditutup/dibuka kembali, serta menghadirkan submenu dan tab baru di Multi Cabang dengan dua aksi: (1) Arsipkan/Nonaktifkan (sembunyikan dari dropdown tanpa ubah data) dan (2) Hapus Permanen (reset operator ke NULL sehingga tampil sebagai "Kasir Lama" persis seperti akun lokal dihapus, benar-benar bersih dan tidak disimpan di mana-mana lagi, dengan nominal keuangan tetap 100% utuh).

**Architecture:**
- **Default Cabang Lokal**: Pergantian penyimpanan aktif cabang dari `localStorage` ke `sessionStorage` dengan inisialisasi default `'0'` (Lokal) saat browser/tab baru dibuka.
- **Navigasi Submenu Sidebar**: Menu `Multi Cabang` dijadikan dropdown dengan submenu `Koneksi Cabang` (`branch`) & `Akun Kasir Cabang` (`branch_kasir`).
- **Dua Aksi Manajemen Akun Kasir Remote**:
  1. **Nonaktifkan / Arsipkan**:
     - Memasukkan nama operator ke `hidden_remote_operators` di settings.
     - Nama langsung hilang dari dropdown filter kasir aktif di Laporan Billing & Kantin.
     - String operator pada riwayat transaksi dan log tetap utuh 100% (jejak audit tidak hilang).
     - Dapat dipulihkan kembali (Restore).
  2. **Hapus Permanen (Murni Bersih Tanpa Disimpan ke Mana-mana)**:
     - Sesuai logika `delete_user` di mana akun lokal dihapus:
       `transaksi.operator` dan `transaksi.user_id` (serta `transaksi_menu.operator` dan `kasir_id`) di-set menjadi `NULL`.
       Nominal uang, waktu, PC, nota tetap utuh 100%.
       Pada tampilan laporan struk / tabel, nama kasirnya otomatis tampil sebagai `"Kasir Lama"` (fallback standar TMBilling saat user terhapus).
     - **Bersih Total**: Karena kolom `operator` sudah menjadi `NULL`, string nama operator tersebut sudah lenyap dari database dan tidak disimpan di mana-mana lagi (termasuk dibersihkan dari `hidden_remote_operators` jika sebelumnya sempat diarsipkan).
- **Styling Konsisten**: Mengikuti standar subtab **Umum & Keamanan** (`bg-[#0c0c0c]`, `border-[#1c1c1c]`, tipografi uppercase bold, button styling signature).
- **CSS Build & Test Suite**: Menjalankan `npm run build:css` dan automated test suite pytest.

**Tech Stack:** Python 3 / Flask, Flask-SQLAlchemy, Vanilla JS (ES6+), Tailwind CSS, Pytest.

---

## Global Constraints
- Tetap berada di branch `feat/multi-branch-control-panel`.
- **Dilarang keras menghapus transaksi**: Seluruh nominal keuangan, nota, dan log audit tetap tersimpan utuh.
- Styling UI harus identik dengan patokan subtab **Umum & Keamanan**.
- Seluruh endpoint mutasi harus diproteksi role Admin.

---

## Tasks

### Task 1: Default Selalu Cabang Lokal saat Buka/Tutup Browser (`sessionStorage`)
- [x] Ubah `BranchManager` di `app/static/js/kasir/modules/branch/index.js`:
  - Ganti `localStorage.getItem('active_branch_id')` menjadi `sessionStorage.getItem('active_branch_id') || '0'`.
  - Di `BranchManager.init()`, bersihkan sisa `active_branch_id` dari `localStorage` (migrasi data lama).
  - Simpan pilihan cabang aktif ke `sessionStorage`.
- [x] Ubah `app/static/js/kasir/core/api.js`:
  - Ambil `activeBranchId` dari `sessionStorage.getItem('active_branch_id')`.
- [x] Ubah `app/static/js/kasir/modules/remote/vnc_client.js`:
  - Ambil `activeBranchId` dari `sessionStorage.getItem('active_branch_id')`.

### Task 2: Backend Service & Endpoints Manajemen Kasir Remote
- [x] Di `app/services/branch/branch_service.py`:
  - Method `get_remote_operators()`: Ambil seluruh operator remote yang pernah tercatat di `transaksi.operator` dan `transaksi_menu.operator` serta dari `Branch` aktif. Hitung total transaksi, nominal transaksi, tanggal terakhir aktif, dan flag `is_hidden`.
  - Method `hide_remote_operator(operator_name)`: Menambahkan nama operator ke setting `hidden_remote_operators`. Tulis log audit `REMOTE_OPERATOR_ARCHIVED`.
  - Method `restore_remote_operator(operator_name)`: Mengeluarkan nama operator dari setting `hidden_remote_operators`. Tulis log audit `REMOTE_OPERATOR_RESTORED`.
  - Method `delete_remote_operator(operator_name)`: Set `operator = None` dan `user_id = None` pada `transaksi` dan `transaksi_menu` untuk transaksi operator tersebut (sehingga tampil sebagai "Kasir Lama" persis seperti user lokal yang dihapus). Bersihkan juga nama tersebut dari setting `hidden_remote_operators` jika ada. Tulis log audit `REMOTE_OPERATOR_DELETED`.
- [x] Di `app/routes/branch/branch_routes.py`:
  - `GET /api/v1/kasir/branch/operators`: Mengembalikan daftar operator remote beserta status aktif/arsip.
  - `POST /api/v1/kasir/branch/operators/hide`: Menyembunyikan operator remote dari dropdown aktif.
  - `POST /api/v1/kasir/branch/operators/restore`: Mengaktifkan kembali operator remote ke dropdown.
  - `POST /api/v1/kasir/branch/operators/delete`: Menghapus permanen identitas operator (reset ke NULL / "Kasir Lama", murni bersih).
- [x] Di `app/services/report/report_service.py`:
  - Perbarui `get_kasir_list()` agar menyaring keluar operator yang terdaftar di `hidden_remote_operators`.

### Task 3: Sidebar Submenu Multi Cabang & Template UI `branch_kasir.html`
- [x] Di `app/templates/kasir/components/sidebar.html`:
  - Ubah tombol tunggal Multi Cabang menjadi dropdown standar TMBilling:
    - Tombol dropdown: `Multi Cabang` dengan `Sidebar.toggleDropdown('branch')`
    - Submenu `#branch-submenu`:
      - 🌐 `Koneksi Cabang` (`App.switchTab('branch')`)
      - 👤 `Akun Kasir Cabang` (`App.switchTab('branch_kasir')`)
- [x] Buat template `app/templates/kasir/tabs/branch_kasir.html`:
  - Tampilan signature style **Umum & Keamanan**:
    - Card: `Akun Kasir Cabang (Remote)`
    - Subtitle: `Kelola operator cabang remote. Anda dapat menonaktifkan akun agar tidak muncul di dropdown laporan harian, atau menghapus permanen identitasnya.`
    - Tab Filter Toggle: **Kasir Aktif** & **Diarsipkan / Nonaktif**.
    - Tabel: No, Nama Operator, Username Kasir, Cabang Asal, Total Transaksi, Terakhir Aktif, Status Badge, Aksi:
      - Tombol **Nonaktifkan** (warna kuning/amber)
      - Tombol **Hapus Permanen** (warna merah dengan modal konfirmasi: "Identitas operator akan di-reset menjadi 'Kasir Lama' seperti akun lokal yang dihapus, transaksi tetap aman.")
      - Tombol **Aktifkan Kembali** (untuk tab diarsipkan)
- [x] Di `app/templates/kasir/index.html`:
  - Sertakan `{% include 'kasir/tabs/branch_kasir.html' %}` di dalam blok admin.
- [x] Di `app/static/js/kasir/app.js`:
  - Daftarkan `branch_kasir: 'Multi Cabang (Akun Kasir Remote)'` di `updatePageTitle`.
  - Di `loadTab('branch_kasir')`: panggil `BranchManager.loadRemoteOperators()`.

### Task 4: Frontend Logika `BranchManager` untuk Kasir Remote
- [x] Di `app/static/js/kasir/modules/branch/index.js`:
  - Implementasikan `loadRemoteOperators(tab = 'active')`
  - Implementasikan `hideRemoteOperator(operatorName)`
  - Implementasikan `restoreRemoteOperator(operatorName)`
  - Implementasikan `deleteRemoteOperator(operatorName)` dengan dialog konfirmasi jelas.

### Task 5: Build CSS & Automated Test Suite
- [x] Jalankan `npm run build:css` untuk Tailwind.
- [x] Buat file test `tests/test_branch_remote_kasir_management.py`:
  - Test list operator remote.
  - Test nonaktifkan operator (arsip tanpa ubah data).
  - Test hapus permanen operator (reset ke NULL, tampil "Kasir Lama", omzet tetap 100% utuh, string tidak tersimpan lagi di DB maupun settings).
  - Test `ReportService.get_kasir_list` tidak menampilkan operator yang di-hide/dihapus.
  - Test proteksi role admin.
- [x] Jalankan `pytest tests/test_branch_remote_kasir_management.py -v`.
- [x] Sinkronkan `index_repository` via MCP codebase-memory.

# Superpowers Implementation Plan: Halaman Standalone Dokumentasi & Migrasi Database

**Tanggal**: 2026-08-12  
**Spesifikasi Terkait**: [`docs/superpowers/specs/2026-08-12-standalone-documentation-page-and-migration-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-12-standalone-documentation-page-and-migration-design.md)  
**Tujuan**: Menambahkan migrasi database Alembic untuk `system_tutorials`, membuat halaman standalone dokumentasi (`/kasir/documentation`) dengan navigasi tombol kembali ke Dashboard Kasir, serta menyesuaikan menu sidebar Kasir.

---

## Task Breakdown

### Task 1: Pembuatan Skrip Migrasi Database Alembic (`system_tutorials`)
- **File Target**: [`migrations/versions/e8f9a0b1c2d3_add_system_tutorials_table.py`](file:///c:/Project%20GIT/TMBilling/migrations/versions/e8f9a0b1c2d3_add_system_tutorials_table.py)
- **Langkah-langkah**:
  1. Buat skrip migrasi Alembic untuk tabel `system_tutorials`.
  2. Tambahkan pemeriksaan di `upgrade()` dan `downgrade()` agar eksekusi migrasi aman dan idempoten.

### Task 2: Pembuatan Route & Template Halaman Standalone Dokumentasi
- **File Target**:
  - [`app/routes/kasir_routes.py`](file:///c:/Project%20GIT/TMBilling/app/routes/kasir_routes.py)
  - [`app/templates/kasir/documentation.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/documentation.html)
- **Langkah-langkah**:
  1. Buat endpoint `@kasir_bp.route("/documentation")` di `kasir_routes.py`.
  2. Buat template `documentation.html` standalone yang meng-extend `kasir/base.html` dengan header topbar menawan:
     - Judul: **📚 Dokumentasi & Panduan Sistem TMBilling**
     - Tombol: **⬅️ Kembali ke Dashboard Kasir** (`href="/kasir"`)
     - Tombol Tambah Panduan untuk Admin.
     - Layout 2-Kolom (Sidebar Kategori & Area Utama Panduan).

### Task 3: Pembaruan Navigasi Sidebar Kasir & Pembersihan Tab Lama
- **File Target**:
  - [`app/templates/kasir/components/sidebar.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html)
  - [`app/templates/kasir/tabs/tutorials.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/tutorials.html)
- **Langkah-langkah**:
  1. Ubah menu **Dokumentasi & Tutorial** di `sidebar.html` menjadi link navigasi langsung (`href="/kasir/documentation"`).
  2. Pindahkan konten dari `tabs/tutorials.html` ke `documentation.html` dan bersihkan tab lama jika tidak diperlukan.

### Task 4: Build CSS & Verifikasi Akhir
- **Langkah-langkah**:
  1. Kompilasi stylesheet: `npm run build:css`.
  2. Verifikasi boot Flask App Factory.
  3. Verifikasi navigasi bolak-balik antara `/kasir` dan `/kasir/documentation`.

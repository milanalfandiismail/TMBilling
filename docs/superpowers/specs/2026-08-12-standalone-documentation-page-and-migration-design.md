# Design Spec: Halaman Standalone Dokumentasi & Migrasi Database

**Tanggal**: 2026-08-12  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling (Kasir Module & Database Migration)

---

## 1. Ikhtisar Requirement

Tujuan spesifikasi ini adalah:
1. **Migrasi Database (`system_tutorials`)**: Menambahkan skrip migrasi Alembic dan pemastian auto-create table saat aplikasi di-update ke versi terbaru agar aman untuk versi lawas.
2. **Halaman Standalone Dokumentasi (`/kasir/documentation`)**: Memindahkan Dokumentasi & Tutorial dari sekadar tab internal Kasir menjadi halaman penuh standalone (*dedicated page*) tersendiri yang lebih luas, nyaman, dan terfokus.

---

## 2. Rincian Arsitektur & Desain

### A. Migrasi Database (`migrations/versions/e8f9a0b1c2d3_add_system_tutorials_table.py`)
- Skrip migrasi Alembic resmi untuk membuat tabel `system_tutorials` dengan skema:
  - `id`: Integer Primary Key
  - `title`: String(255), Not Null
  - `icon`: String(50), Default '🌐'
  - `category`: String(100), Default 'Umum'
  - `content`: Text, Not Null
  - `urutan`: Integer, Default 0
  - `created_at`: DateTime
  - `updated_at`: DateTime
- Dipadu dengan `TutorialService.seed_initial_tutorials()` pada `app/__init__.py` agar instance baru atau eksisting yang melakukan update langsung secara otomatis meng-create tabel & mengisikan data panduan awal jika masih kosong.

### B. Halaman Standalone Dokumentasi (`/kasir/documentation`)
- **Route Flask**: `@kasir_bp.route("/documentation")` pada `app/routes/kasir_routes.py` (atau `tutorial_routes.py`).
- **Template HTML**: `app/templates/kasir/documentation.html`.
- **Layout Topbar & Header**:
  - Judul: **📚 Dokumentasi & Panduan Sistem TMBilling**
  - Tombol Navigasi: **⬅️ Kembali ke Dashboard Kasir** (`href="/kasir"`) bertema dark mode premium.
  - Tombol Admin: **➕ Tambah Panduan Baru** (Khusus Admin).
- **Layout 2-Kolom Utama**:
  - **Sidebar Kategori (Kiri - `w-72`)**: Daftar kategori utuh tanpa `truncate` + jumlah item + tombol hapus kategori.
  - **Area Konten Utama (Kanan - `flex-1`)**: Menampilkan daftar panduan dalam kategori aktif dengan tampilan rich-text bersih, tabel kontras tinggi, dan gambar yang terstruktur.
- **Navigasi Sidebar Kasir (`sidebar.html`)**:
  - Mengubah item menu **Dokumentasi & Tutorial** dari tombol pemindah tab JS menjadi link langsung `<a>` menuju `/kasir/documentation`.

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Migrasi**: Memastikan migrasi `system_tutorials` berjalan lancar via Alembic/Flask-Migrate dan tabel otomatis terisi data awal.
2. **Uji Halaman Standalone**: Mengakses `/kasir/documentation` dan memverifikasi layout 2-kolom full page.
3. **Uji Tombol Kembali**: Memastikan klik tombol **"⬅️ Kembali ke Dashboard Kasir"** mengarahkan pengguna kembali ke halaman utama `/kasir`.
4. **Uji Fitur Editor Admin**: Membuka modal penyuntingan dari halaman standalone untuk memastikan CKEditor 5 dan upload gambar berfungsi 100%.

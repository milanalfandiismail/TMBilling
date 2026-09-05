# Implementasi Filter Operator Remote pada Laporan Billing & Kantin serta Pembersihan Submenu Sidebar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan submenu duplikat 'Multi-Cabang & API' di bawah Pengaturan, dan mendukung pelacakan serta penyaringan identitas operator remote `nama_user (Remote: Nama Warnet)` pada Laporan Billing dan Laporan Kantin secara akurat, didukung oleh migrasi database resmi Flask-Migrate (Alembic).

**Architecture:** 
- Membuat file migrasi resmi Flask-Migrate di `migrations/versions/` untuk menambahkan kolom baru `operator VARCHAR(100)` pada tabel `transaksi` dan `transaksi_menu`.
- Memperbarui model `Transaksi` dan `TransaksiMenu` dengan kolom `operator` dan fallback pada `to_dict()`.
- Memperbarui service layer transaksi billing, member, blackout, dan menu agar menyimpan nama operator lengkap saat transaksi dibuat.
- Memperbarui `ReportService.get_kasir_list` untuk mengembalikan opsi kasir lokal (`admin (Lokal)`) dan operator remote (`admin (Remote: ...)`) yang bersumber dari tabel transaksi dan tabel cabang aktif.
- Memperbarui filtering repository (`transaksi_repository`, `menu_repository`, `sesi_repository`) agar membedakan transaksi lokal vs remote saat kasir difilter.
- Memperbarui tampilan tabel Laporan Billing dan PDF export agar menyertakan kolom Kasir/Operator.

**Tech Stack:** Python 3.14, Flask, Flask-Migrate, Alembic, SQLAlchemy, SQLite, Vanilla JavaScript.

**Spec:** Permintaan pengguna mengenai pembersihan submenu sidebar, penambahan filter operator remote pada laporan billing & kantin, serta penyediaan migrasi database resmi Flask-Migrate standar untuk kolom baru `operator`.

## Global Constraints
- Standar resmi Flask-Migrate: gunakan berkas migrasi Alembic di `migrations/versions/` dengan `op.batch_alter_table` agar 100% aman untuk SQLite.
- Tidak perlu raw SQL `ALTER TABLE` manual di `_init_app_context` (sesuai prosedur update & migrasi standar aplikasi).
- Kolom `operator` bersifat `nullable=True` sehingga tidak merusak data lama.
- Tetap berada di branch `feat/multi-branch-control-panel`.
- Jangan mengubah format logging IP yang sudah disetujui pengguna.

---

### Task 1: Pembersihan Sidebar Pengaturan Kasir

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html:270-276`
- Test: `tests/test_branch_ui_rendering.py`

**Interfaces:**
- Consumes: Template Jinja sidebar kasir.
- Produces: Sidebar kasir bersih tanpa link duplikat `#tab-btn-settings-branch` di bawah `#settings-submenu`.

- [ ] **Step 1: Hapus item `#tab-btn-settings-branch` dari `#settings-submenu` di `sidebar.html`**
  Hapus baris tombol `<a href="#tab-settings-branch" class="submenu-item" id="tab-btn-settings-branch">...</a>` dari dalam submenu Pengaturan.

- [ ] **Step 2: Jalankan unit test UI rendering**
  Jalankan: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_ui_rendering.py -v`
  Expected: PASS

- [ ] **Step 3: Commit perubahan Task 1**
  ```bash
  git add app/templates/kasir/components/sidebar.html
  git commit -m "fix(sidebar): remove duplicate branch settings submenu item"
  ```

---

### Task 2: Migrasi Database Flask-Migrate / Alembic untuk Kolom `operator`

**Files:**
- Create: `migrations/versions/f3a1b2c4d5e6_add_operator_to_transaksi_and_transaksi_menu.py`
- Modify: `app/models/transaksi/transaksi.py`
- Modify: `app/models/menu/menu.py`
- Test: `tests/test_report_remote_operator_filter.py`

**Interfaces:**
- Consumes: Head migrasi Alembic saat ini (`e8f9a0b1c2d3`).
- Produces: Kolom `operator VARCHAR(100)` pada tabel `transaksi` dan `transaksi_menu` yang dieksekusi melalui alur standar `flask db upgrade`.

- [ ] **Step 1: Tambahkan kolom `operator` pada Model `Transaksi` dan `TransaksiMenu`**
  - Pada `app/models/transaksi/transaksi.py`:
    ```python
    operator = db.Column(db.String(100), nullable=True)
    ```
    Dan di method `to_dict()`:
    ```python
    "kasir_nama": self.operator or (self.user.nama_lengkap or self.user.username if self.user else "Kasir Lama"),
    "operator": self.operator
    ```
  - Pada `app/models/menu/menu.py`:
    ```python
    operator = db.Column(db.String(100), nullable=True)
    ```
    Dan di method `to_dict()`:
    ```python
    "kasir_nama": self.operator or (self.kasir.username if self.kasir else "Kasir Lama"),
    "operator": self.operator
    ```

- [ ] **Step 2: Buat berkas migrasi resmi Alembic / Flask-Migrate**
  Buat file `migrations/versions/f3a1b2c4d5e6_add_operator_to_transaksi_and_transaksi_menu.py`:
  ```python
  """add operator to transaksi and transaksi_menu

  Revision ID: f3a1b2c4d5e6
  Revises: e8f9a0b1c2d3
  Create Date: 2026-09-04 17:30:00.000000

  """
  from alembic import op
  import sqlalchemy as sa

  revision = 'f3a1b2c4d5e6'
  down_revision = 'e8f9a0b1c2d3'
  branch_labels = None
  depends_on = None

  def upgrade():
      with op.batch_alter_table('transaksi', schema=None) as batch_op:
          batch_op.add_column(sa.Column('operator', sa.String(length=100), nullable=True))

      with op.batch_alter_table('transaksi_menu', schema=None) as batch_op:
          batch_op.add_column(sa.Column('operator', sa.String(length=100), nullable=True))

  def downgrade():
      with op.batch_alter_table('transaksi_menu', schema=None) as batch_op:
          batch_op.drop_column('operator')

      with op.batch_alter_table('transaksi', schema=None) as batch_op:
          batch_op.drop_column('operator')
  ```

- [ ] **Step 3: Uji jalankan migrasi database via Flask-Migrate**
  Jalankan: `.\.venv\Scripts\python.exe -m flask db upgrade`
  Expected: Database terupgrade ke revision `f3a1b2c4d5e6` tanpa error.

- [ ] **Step 4: Commit perubahan Task 2**
  ```bash
  git add migrations/versions/f3a1b2c4d5e6_add_operator_to_transaksi_and_transaksi_menu.py app/models/transaksi/transaksi.py app/models/menu/menu.py
  git commit -m "feat(db): add alembic migration for operator column in transaksi and transaksi_menu"
  ```

---

### Task 3: Simpan Identitas Operator pada Transaksi Billing dan Menu

**Files:**
- Modify: `app/services/sesi/sesi_service.py`
- Modify: `app/services/member/member_service.py`
- Modify: `app/services/menu/menu_service.py`
- Modify: `app/services/blackout/blackout_service.py`

**Interfaces:**
- Consumes: Session kasir `session.get('kasir_username')` atau `operator` string dari request/relay.
- Produces: Rekaman transaksi dengan kolom `operator` yang berisi nama operator lokal (misal: `admin`) atau remote (misal: `admin (Remote: Milan Net)`).

- [ ] **Step 1: Simpan `operator=operator` pada `Transaksi` di `sesi_service.py`**
  Pastikan setiap pembuatan objek `Transaksi` pada `buka_sesi_guest`, `tambah_waktu_guest`, `buka_sesi_member`, `tambah_waktu_member`, dan `stop_sesi` menyertakan keyword argument `operator=operator`.

- [ ] **Step 2: Simpan `operator=operator` pada `Transaksi` di `member_service.py`**
  Pastikan transaksi `topup_saldo` dan refund member menyertakan `operator=operator`.

- [ ] **Step 3: Simpan `operator=operator` pada `TransaksiMenu` di `menu_service.py`**
  Di `checkout_menu_order`:
  - Ekstrak username dasar untuk pencarian FK `User`:
    ```python
    base_kasir_username = kasir_username.split(" (")[0].strip() if " (" in kasir_username else kasir_username
    ```
  - Simpan `operator=kasir_username` pada setiap baris item pesanan `TransaksiMenu`.

- [ ] **Step 4: Simpan `operator=operator` pada `Transaksi` di `blackout_service.py`**
  Pastikan kompensasi blackout menyertakan `operator=operator`.

- [ ] **Step 5: Commit perubahan Task 3**
  ```bash
  git add app/services/sesi/sesi_service.py app/services/member/member_service.py app/services/menu/menu_service.py app/services/blackout/blackout_service.py
  git commit -m "feat(services): record full operator identity on billing and canteen transactions"
  ```

---

### Task 4: Logika Filtering & Penyajian Data Laporan (Backend)

**Files:**
- Modify: `app/repositories/transaksi/transaksi_repository.py`
- Modify: `app/repositories/menu/menu_repository.py`
- Modify: `app/repositories/sesi/sesi_repository.py`
- Modify: `app/services/report/report_service.py`
- Modify: `app/utils/pdf_helper.py`
- Modify: `app/services/report/pdf_export_service.py`

**Interfaces:**
- Consumes: Filter parameter `kasir_id` (bisa integer ID lokal misal `"1"` atau format operator `"operator:admin (Remote: Milan Net)"`).
- Produces: Hasil query dan agregasi laporan yang akurat per-operator tanpa campur aduk pendapatan.

- [ ] **Step 1: Buat helper filtering `_apply_kasir_filter` di `transaksi_repository.py` dan `menu_repository.py`**
  - Jika `kasir_id` string diawali `"operator:"` atau mengandung `"(Remote:"`:
    Ambil nama operator riil dan saring `Model.operator == operator_name`.
  - Jika `kasir_id` angka (User ID lokal):
    Saring `Model.user_id == int(kasir_id)` DAN pastikan transaksi bukan remote:
    `db.or_(Model.operator.is_(None), Model.operator == '', Model.operator == User.username, ~Model.operator.like('%(Remote:%'))`.
  - Jika kosong atau `"semua"`: tidak ada filter kasir.

- [ ] **Step 2: Perbarui subquery filter kasir di `sesi_repository.py`**
  Perbarui method `count_by_tanggal_tipe_kasir` agar menerapkan logika filter operator serupa saat menghitung durasi sesi.

- [ ] **Step 3: Perbarui `get_kasir_list` di `report_service.py`**
  - Jika role admin:
    - Masukkan kasir lokal dengan label jelas: `{"id": str(u.id), "nama": f"{u.username} (Lokal)"}`.
    - Cari nilai operator unik dari `Transaksi` dan `TransaksiMenu` yang mengandung `"(Remote:"`.
    - Ambil juga daftar cabang aktif dari tabel `Branch` untuk mengisi opsi remote operator yang mungkin belum bertransaksi hari ini: `{"id": f"operator:admin (Remote: {b.nama_cabang})", "nama": f"admin (Remote: {b.nama_cabang})"}`.
  - Urutkan dan hilangkan duplikasi.

- [ ] **Step 4: Sertakan `kasir_nama` pada payload struk dan detail kantin**
  - Pada `_format_history_struk`: sertakan `"kasir_nama": t.operator or (t.user.nama_lengkap or t.user.username if t.user else "Kasir")`.
  - Pada `get_laporan_kantin_by_tanggal`: sertakan nama kasir/operator per transaksi pesanan.

- [ ] **Step 5: Perbarui `pdf_helper.py` dan `pdf_export_service.py`**
  - Pada `pdf_helper.py: get_meta_table`: jika `kasir_id` mengandung `"operator:"`, ekstrak label kasir bersih untuk ditampilkan di metadata PDF.
  - Pada `pdf_export_service.py: export_billing_pdf`: tambahkan kolom `Kasir` pada tabel PDF transaksi.

- [ ] **Step 6: Commit perubahan Task 4**
  ```bash
  git add app/repositories/transaksi/transaksi_repository.py app/repositories/menu/menu_repository.py app/repositories/sesi/sesi_repository.py app/services/report/report_service.py app/utils/pdf_helper.py app/services/report/pdf_export_service.py
  git commit -m "feat(report): support distinct local vs remote operator filtering and pdf metadata"
  ```

---

### Task 5: Tampilan Kolom Kasir di Frontend Laporan Billing

**Files:**
- Modify: `app/static/js/kasir/modules/laporan/index.js`

**Interfaces:**
- Consumes: Respons JSON `/api/v1/kasir/report/billing/table` yang memuat field `kasir_nama`.
- Produces: Header `<th>Kasir</th>` dan cell `<td>${t.kasir_nama || '-'}</td>` pada tabel detail billing.

- [ ] **Step 1: Tambahkan kolom `<th>Kasir</th>` dan `<td>${t.kasir_nama || '-'}</td>` pada tabel laporan billing**
- [ ] **Step 2: Commit perubahan Task 5**
  ```bash
  git add app/static/js/kasir/modules/laporan/index.js
  git commit -m "feat(laporan-ui): display operator column in billing report table"
  ```

---

### Task 6: Test Suite Otomatis & Verifikasi Menyeluruh

**Files:**
- Create: `tests/test_report_remote_operator_filter.py`

**Interfaces:**
- Consumes: Test client Flask, transaksi lokal, dan transaksi relay remote.
- Produces: Jaminan test 100% lulus untuk filter laporan lokal vs remote, pencatatan operator, dan migrasi.

- [ ] **Step 1: Tulis unit test di `tests/test_report_remote_operator_filter.py`**
  Menguji:
  1. Migrasi kolom `operator` pada `transaksi` dan `transaksi_menu`.
  2. Pembuatan transaksi lokal (`operator='admin'`) dan transaksi remote (`operator='admin (Remote: Milan Net)'`).
  3. Respons `get_kasir_list` memuat `admin (Lokal)` dan `admin (Remote: Milan Net)`.
  4. Filter laporan billing dengan kasir lokal hanya mengembalikan pendapatan lokal.
  5. Filter laporan billing dengan operator remote hanya mengembalikan pendapatan remote.
  6. Filter laporan kantin dengan operator remote hanya mengembalikan pendapatan pesanan kantin remote.

- [ ] **Step 2: Jalankan test suite dan verifikasi 100% PASS**
  Jalankan:
  ```powershell
  .\.venv\Scripts\python.exe -m pytest tests/test_report_remote_operator_filter.py tests/test_branch_relay_csrf_and_logging.py -v
  ```

- [ ] **Step 3: Commit perubahan Task 6**
  ```bash
  git add tests/test_report_remote_operator_filter.py
  git commit -m "test(report): verify remote operator filtering, migration, and revenue separation"
  ```

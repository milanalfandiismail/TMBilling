# Rencana Implementasi: Web File Explorer TMBilling

> **Untuk agen/pekerja otomatis:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Membangun modul Web File Explorer yang aman, terintegrasi di dashboard admin TMBilling, dengan editor berkas berbasis CodeMirror 6, batasan folder (*allowed roots*) yang dapat dikonfigurasi, dan pencatatan log audit lengkap.

**Arsitektur:** Menggunakan service Python Flask langsung dengan modul `os`/`pathlib`/`shutil` yang dilindungi validasi path kanonikal ketat terhadap direktori yang diizinkan (*allowed roots*). Frontend SPA vanilla JS dengan editor CodeMirror 6 bertema Chamber Noir Dark.

**Tech Stack:** Python Flask, SQLAlchemy (Settings), CodeMirror 6, Vanilla JS, Tailwind CSS, Pytest.

**Dokumen Spesifikasi:** [`docs/superpowers/specs/2026-08-15-file-explorer-web-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-15-file-explorer-web-design.md)

## Batasan Global
- Akses dibatasi ketat hanya untuk akun dengan peran `admin` (`@login_required` + `@admin_required`).
- Setiap path berkas/folder wajib dinormalisasi menjadi path absolut kanonikal dan dipastikan berada di dalam salah satu *allowed roots*.
- Berkas biner ditolak untuk disunting sebagai teks (hanya metadata yang ditampilkan).
- Maksimal ukuran berkas yang dapat dibuka di editor teks adalah 5 MB.
- Penyimpanan berkas menggunakan mekanisme atomik (*atomic replace*) dan proteksi konkurensi optimistik berbasis `mtime`.
- Setiap aksi modifikasi berkas dicatat ke sistem audit log dengan kategori kanonikal `SYSTEM` / `MAINTENANCE`.

---

### Tugas 1: Core FileExplorerService & Security Sandbox

**Berkas:**
- Buat: `app/services/fileexplorer/fileexplorer_service.py`
- Buat: `app/services/fileexplorer/__init__.py`
- Test: `tests/test_fileexplorer_service.py`

**Antarmuka:**
- Mengonsumsi: `app.repositories.SettingsRepository` untuk membaca/menyimpan daftar `file_explorer_allowed_roots`.
- Menghasilkan:
  - `FileExplorerService.get_allowed_roots() -> list[str]`
  - `FileExplorerService.set_allowed_roots(roots: list[str]) -> list[str]`
  - `FileExplorerService.validate_path(target_path: str) -> str` (mengembalikan path kanonikal yang valid atau raise `PermissionError`/`ValueError`)
  - `FileExplorerService.list_directory(dir_path: str = None) -> dict`
  - `FileExplorerService.read_file(file_path: str) -> dict`
  - `FileExplorerService.save_file(file_path: str, content: str, expected_mtime: float = None, force: bool = False) -> dict`
  - `FileExplorerService.create_item(parent_path: str, name: str, is_dir: bool = False) -> dict`
  - `FileExplorerService.rename_item(target_path: str, new_name: str) -> dict`
  - `FileExplorerService.delete_item(target_path: str) -> dict`

- [ ] **Langkah 1: Tulis unit test untuk FileExplorerService**

```python
# tests/test_fileexplorer_service.py
import os
import tempfile
import pytest
from app import create_app, db
from app.services.fileexplorer.fileexplorer_service import FileExplorerService

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()

def test_allowed_roots_default_and_custom(app_ctx):
    roots = FileExplorerService.get_allowed_roots()
    assert len(roots) >= 1
    
    with tempfile.TemporaryDirectory() as tmpdir:
        updated = FileExplorerService.set_allowed_roots([tmpdir])
        assert tmpdir in updated
        assert FileExplorerService.get_allowed_roots() == [os.path.realpath(tmpdir)]

def test_path_validation_and_traversal_defense(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        FileExplorerService.set_allowed_roots([tmpdir])
        
        # Path valid di dalam root
        valid_path = os.path.join(tmpdir, "test.txt")
        resolved = FileExplorerService.validate_path(valid_path)
        assert resolved == os.path.realpath(valid_path)
        
        # Path traversal ke luar root
        traversal_path = os.path.join(tmpdir, "..", "outside.txt")
        with pytest.raises(PermissionError):
            FileExplorerService.validate_path(traversal_path)

def test_file_crud_operations(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        FileExplorerService.set_allowed_roots([tmpdir])
        
        # Create file
        res = FileExplorerService.create_item(tmpdir, "hello.txt", is_dir=False)
        assert res["success"] is True
        file_path = res["path"]
        
        # Save content
        save_res = FileExplorerService.save_file(file_path, "Hello World\nLine 2")
        assert save_res["success"] is True
        mtime = save_res["mtime"]
        
        # Read content
        read_res = FileExplorerService.read_file(file_path)
        assert read_res["content"] == "Hello World\nLine 2"
        assert read_res["editable"] is True
        
        # Rename file
        ren_res = FileExplorerService.rename_item(file_path, "greeting.txt")
        assert ren_res["success"] is True
        new_path = ren_res["path"]
        assert os.path.basename(new_path) == "greeting.txt"
        
        # Delete file
        del_res = FileExplorerService.delete_item(new_path)
        assert del_res["success"] is True
        assert not os.path.exists(new_path)
```

- [ ] **Langkah 2: Jalankan test untuk memverifikasi kegagalan (FAIL)**

Jalankan: `.\.venv\Scripts\python.exe -m pytest tests/test_fileexplorer_service.py -v`
Ekspektasi: FAIL dengan ModuleNotFoundError `app.services.fileexplorer.fileexplorer_service`.

- [ ] **Langkah 3: Buat implementasi FileExplorerService**

Buat `app/services/fileexplorer/fileexplorer_service.py` dengan penanganan validasi sandbox, deteksi berkas biner, batas ukuran berkas 5MB, penulisan atomik, dan proteksi konflik `mtime`.

- [ ] **Langkah 4: Jalankan test kembali untuk memverifikasi kelulusan (PASS)**

Jalankan: `.\.venv\Scripts\python.exe -m pytest tests/test_fileexplorer_service.py -v`
Ekspektasi: Seluruh pengujian lulus (PASS).

- [ ] **Langkah 5: Commit Tugas 1**

```bash
git add app/services/fileexplorer/ tests/test_fileexplorer_service.py
git commit -m "feat(fileexplorer): implement core FileExplorerService and filesystem sandbox"
```

---

### Tugas 2: API Endpoints, Audit Logging & Blueprint Registration

**Berkas:**
- Buat: `app/routes/fileexplorer/fileexplorer_routes.py`
- Buat: `app/routes/fileexplorer/__init__.py`
- Modifikasi: `app/routes/__init__.py` (registrasi blueprint `fileexplorer_api_bp`)
- Modifikasi: `app/utils/logger.py` (tambahkan aksi `FILE_EXPLORER_*` ke `ACTION_TO_CATEGORY_MAP`)
- Test: `tests/test_fileexplorer_api.py`

**Antarmuka:**
- Mengonsumsi: `FileExplorerService`, `write_log()`, `@login_required`, `@admin_required`.
- Menghasilkan: REST endpoints di bawah prefix `/api/v1/kasir/fileexplorer/`.

- [ ] **Langkah 1: Tulis unit test untuk FileExplorer API endpoints**

```python
# tests/test_fileexplorer_api.py
import json
import tempfile
import pytest
from app import create_app, db
from app.models import User
from app.services.fileexplorer.fileexplorer_service import FileExplorerService

@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            admin = User.query.filter_by(username="admin").first()
            if not admin:
                admin = User(username="admin", nama_lengkap="Admin", role="admin", aktif=True)
                admin.set_password("admin123")
                db.session.add(admin)
                db.session.commit()
            
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
                sess["kasir_username"] = admin.username
                sess["kasir_role"] = "admin"
                sess["kasir_nama"] = admin.nama_lengkap
            yield client
            db.session.remove()

def test_api_roots_get_and_post(client_with_admin):
    res = client_with_admin.get("/api/v1/kasir/fileexplorer/roots")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True

def test_api_list_read_save_cycle(client_with_admin):
    with tempfile.TemporaryDirectory() as tmpdir:
        FileExplorerService.set_allowed_roots([tmpdir])
        
        # Create file via API
        c_res = client_with_admin.post("/api/v1/kasir/fileexplorer/create", json={
            "parent_path": tmpdir,
            "name": "sample.py",
            "is_dir": False
        })
        assert c_res.status_code == 200
        file_path = c_res.get_json()["path"]
        
        # Save file via API
        s_res = client_with_admin.post("/api/v1/kasir/fileexplorer/save", json={
            "path": file_path,
            "content": "print('hello from api test')"
        })
        assert s_res.status_code == 200
        
        # Read file via API
        r_res = client_with_admin.get(f"/api/v1/kasir/fileexplorer/read?path={file_path}")
        assert r_res.status_code == 200
        assert r_res.get_json()["content"] == "print('hello from api test')"
```

- [ ] **Langkah 2: Jalankan test untuk memverifikasi kegagalan (FAIL)**

Jalankan: `.\.venv\Scripts\python.exe -m pytest tests/test_fileexplorer_api.py -v`
Ekspektasi: FAIL (endpoint belum terdaftar).

- [ ] **Langkah 3: Buat implementasi routes dan registrasi blueprint**

1. Buat `app/routes/fileexplorer/fileexplorer_routes.py` dengan proteksi `@login_required` + `@admin_required`.
2. Tambahkan aksi audit `FILE_EXPLORER_SAVE`, `FILE_EXPLORER_CREATE`, `FILE_EXPLORER_RENAME`, `FILE_EXPLORER_DELETE`, `FILE_EXPLORER_ROOTS_UPDATE` ke kamus `ACTION_TO_CATEGORY_MAP` di `app/utils/logger.py` (kategori `SYSTEM`).
3. Registrasikan `fileexplorer_api_bp` di `app/routes/__init__.py` dan `app/__init__.py`.

- [ ] **Langkah 4: Jalankan test untuk memverifikasi kelulusan (PASS)**

Jalankan: `.\.venv\Scripts\python.exe -m pytest tests/test_fileexplorer_api.py -v`
Ekspektasi: PASS 100%.

- [ ] **Langkah 5: Commit Tugas 2**

```bash
git add app/routes/fileexplorer/ app/routes/__init__.py app/__init__.py app/utils/logger.py tests/test_fileexplorer_api.py
git commit -m "feat(fileexplorer): implement API endpoints and audit logging integration"
```

---

### Tugas 3: Frontend UI, Sidebar Navigation & CodeMirror 6 Integration

**Berkas:**
- Modifikasi: `app/templates/kasir/components/sidebar.html` (tambahkan menu top-level `📁 File Explorer`)
- Buat: `app/templates/kasir/tabs/fileexplorer.html` (HTML tab layout)
- Modifikasi: `app/templates/kasir/base.html` (include tab template & CodeMirror bundle & JS module)
- Buat: `app/static/js/kasir/modules/fileexplorer/index.js` (UI logic, Tree browser, CodeMirror instance, Roots Manager)
- Modifikasi: `app/static/js/kasir/core/api.js` (tambahkan wrapper `API.fileexplorer`)
- Modifikasi: `app/static/js/kasir/app.js` (tambahkan case `fileexplorer` pada switchTab)

**Antarmuka:**
- Mengonsumsi: `API.fileexplorer`, CodeMirror 6 library CDN.
- Menghasilkan: Tampilan interaktif File Explorer di dashboard admin.

- [ ] **Langkah 1: Tambahkan API client method di `app/static/js/kasir/core/api.js`**

Tambahkan method `API.fileexplorer`: `getRoots`, `setRoots`, `list`, `read`, `save`, `create`, `rename`, `delete`.

- [ ] **Langkah 2: Tambahkan Menu Sidebar di `app/templates/kasir/components/sidebar.html`**

Tambahkan tombol navigasi top-level (admin-only) sebelum atau sesudah menu Sistem:
```html
        {% if session.get('kasir_role') == 'admin' %}
        <!-- File Explorer (Top Level Admin Menu) -->
        <button onclick="App.switchTab('fileexplorer')" data-tab="fileexplorer"
            class="tab-btn w-full flex items-center gap-3 px-3 py-2 rounded text-[13px] font-semibold text-neutral-400 hover:text-neutral-100 hover:bg-[#121212] transition-all text-left">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
            </svg>
            <span>File Explorer</span>
        </button>
        {% endif %}
```

- [ ] **Langkah 3: Buat Template Tab `app/templates/kasir/tabs/fileexplorer.html`**

Rancang antarmuka Split View:
- Breadcrumbs bar + tombol Aksi (New File, New Folder, Refresh, Kelola Folder Diizinkan).
- Panel Kiri: Pohon berkas/folder, daftar berkas dengan ukuran dan waktu modifikasi, serta filter pencarian cepat.
- Panel Kanan: Wadah CodeMirror 6 editor, bar status (baris, kolom, mode bahasa, status perubahan/save).
- Modal Pengaturan Allowed Roots untuk menambah dan menghapus direktori yang diizinkan.

- [ ] **Langkah 4: Buat Modul Frontend `app/static/js/kasir/modules/fileexplorer/index.js`**

Implementasikan objek `FileExplorer`:
- `init()` & `load()`: Memuat allowed roots dan isi direktori awal.
- `openDirectory(path)`: Menavigasi ke folder target.
- `openFile(path)`: Membaca berkas dan menginisialisasi editor CodeMirror.
- `saveFile()`: Menyimpan berkas dengan shortcut `Ctrl+S` atau tombol Simpan.
- `createItem(isDir)`: Modal dialog pembuatan berkas/folder.
- `renameItem(path)`: Modal dialog rename.
- `deleteItem(path)`: Konfirmasi penghapusan berkas.
- `openRootsModal()` & `saveRoots()`: Pengelolaan allowed roots.

- [ ] **Langkah 5: Daftarkan di `base.html` dan `app.js`**

1. Tambahkan `{% include 'kasir/tabs/fileexplorer.html' %}` di `dashboard.html` / `base.html`.
2. Sertakan CDN CodeMirror 6 dan script `fileexplorer/index.js` di `base.html`.
3. Tambahkan `case 'fileexplorer': await FileExplorer.load(); break;` pada `switchTab` di `app.js`.

- [ ] **Langkah 6: Jalankan build Tailwind CSS**

Jalankan: `npm run build:css`

- [ ] **Langkah 7: Jalankan seluruh test suite Pytest**

Jalankan: `.\.venv\Scripts\python.exe -m pytest -v`
Ekspektasi: Seluruh pengujian (lama dan baru) lulus 100%.

- [ ] **Langkah 8: Commit Tugas 3**

```bash
git add app/templates/ app/static/ tests/
git commit -m "feat(ui): complete File Explorer frontend UI, sidebar link, and CodeMirror editor"
```

---

### Tugas 4: Security Hardening & End-to-End Verification

**Berkas:**
- Buat: `tests/test_fileexplorer_security.py`

**Langkah:**
- [ ] **Langkah 1: Buat pengujian komprehensif keamanan sandbox**
  - Uji serangan path traversal (`../../../windows/system32`).
  - Uji akses ke berkas biner (`.exe`, `.dll`, file dengan null byte).
  - Uji batasan berkas raksasa (> 5MB).
  - Uji otorisasi non-admin (kasir biasa ditolak dengan 403).
  - Uji deteksi konflik penyuntingan serentak (*optimistic locking*).
- [ ] **Langkah 2: Jalankan full test suite dan verifikasi kelulusan**
  - Jalankan: `.\.venv\Scripts\python.exe -m pytest -v`
  - Ekspektasi: Seluruh test suite lulus 100%.
- [ ] **Langkah 3: Commit Tugas 4**
```bash
git add tests/test_fileexplorer_security.py
git commit -m "test(security): add comprehensive security and sandbox boundary tests for File Explorer"
```

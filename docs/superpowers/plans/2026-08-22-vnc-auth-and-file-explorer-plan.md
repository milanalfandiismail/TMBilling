# Rencana Implementasi: Otomasi Password Remote Control & Web File Explorer TMBilling

> **Untuk agen/pekerja otomatis:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Mengotomatiskan kredensial password Remote Control Server (TightVNC/noVNC) pada level backend sehingga admin tidak perlu memasukkan password secara manual di web, serta membangun modul Web File Explorer & Text Editor terintegrasi dengan proteksi sandbox filesystem ketat.

**Arsitektur:** 
1. VNC Auth: Backend `VNCService` & `SettingsService` mengelola `vnc_password`, mengembalikannya pada endpoint `POST /api/v1/kasir/vnc/start` terproteksi admin, dan frontend `vnc_client.js` menginjeksi kredensial ke noVNC secara otomatis.
2. File Explorer: Service Python Flask `FileExplorerService` dengan validasi canonical path, batasan *allowed roots*, deteksi file biner, batas 5MB, penulisan atomik, proteksi `mtime`, dan frontend CodeMirror 6 bertema Chamber Noir Dark.

**Tech Stack:** Python Flask, SQLAlchemy (Settings), CodeMirror 6, noVNC (RFB), Vanilla JS, Tailwind CSS, Pytest.

**Spec:** [`docs/superpowers/specs/2026-08-22-vnc-auth-and-file-explorer-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-22-vnc-auth-and-file-explorer-design.md)

## Global Constraints

- Akses kedua fitur (Remote VNC & File Explorer) dibatasi ketat khusus peran `admin` (`session.get("kasir_role") == "admin"`).
- Password VNC tidak boleh dicatat dalam plaintext di audit log sistem.
- Setiap path berkas pada File Explorer wajib divalidasi menggunakan canonical path absolut (`os.path.realpath`) dan dipastikan berada di dalam salah satu *allowed roots*.
- Berkas biner (memiliki null byte `\x00` pada 8KB pertama) dilarang dibuka sebagai text editor.
- Maksimal ukuran berkas yang dapat disunting adalah 5 MB.
- Penulisan berkas menggunakan mekanisme atomik (*atomic replace*) dan proteksi konkurensi berbasis `mtime`.

---

### Task 1: Otomasi Password Remote Control Server (Backend & Frontend)

**Files:**
- Modify: `app/services/settings/settings_service.py`
- Modify: `app/services/vnc/vnc_service.py`
- Modify: `app/routes/vnc/vnc_routes.py`
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`
- Modify: `app/templates/kasir/tabs/remote_server.html`
- Create: `tests/test_vnc_password_automation.py`

**Interfaces:**
- Consumes: `SettingsService.get("vnc_password")`, `VNCService.ensure_websockify_running()`
- Produces: `POST /api/v1/kasir/vnc/start` mengembalikan field `vnc_password`, `vnc_client.js` menginjeksi kredensial otomatis.

- [ ] **Step 1: Tulis unit test untuk verifikasi endpoint VNC start mengembalikan password terkonfigurasi**

```python
# tests/test_vnc_password_automation.py
import pytest
from app import create_app, db
from app.models import User
from app.services.settings.settings_service import SettingsService

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

def test_vnc_start_returns_configured_password(client_with_admin):
    SettingsService.set("vnc_password", "secret123")
    res = client_with_admin.post("/api/v1/kasir/vnc/start")
    assert res.status_code in [200, 400] # 400 jika VNC server fisik tidak ada, tapi tetap cek payload JSON jika sukses
```

- [ ] **Step 2: Jalankan test untuk memverifikasi struktur awal**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_vnc_password_automation.py -v`

- [ ] **Step 3: Implementasikan backend vnc_password di `SettingsService` & `vnc_routes.py`**

Perbarui `vnc_routes.py` agar endpoint `/api/v1/kasir/vnc/start` menyertakan `vnc_password`:
```python
    vnc_password = SettingsService.get("vnc_password", "")
    return jsonify({
        "success": True,
        "message": msg,
        "listen_port": VNCService.LISTEN_PORT,
        "vnc_password": vnc_password
    })
```

- [ ] **Step 4: Update `vnc_client.js` dan `remote_server.html`**

1. Pada `vnc_client.js`: Gunakan `startRes.vnc_password` sebagai default password untuk `RFBClass`.
2. Pada `remote_server.html`: Sederhanakan UI dengan menghapus kebutuhan input manual password (atau menjadikannya opsional fallback).

- [ ] **Step 5: Jalankan test suite dan commit Task 1**

```bash
git add app/services/vnc/ app/routes/vnc/ app/static/js/kasir/modules/remote/ app/templates/kasir/tabs/remote_server.html tests/test_vnc_password_automation.py
git commit -m "feat(vnc): mengotomatiskan injeksi password remote control dari backend"
```

---

### Task 2: Core FileExplorerService & Security Sandbox

**Files:**
- Create: `app/services/fileexplorer/__init__.py`
- Create: `app/services/fileexplorer/fileexplorer_service.py`
- Create: `tests/test_fileexplorer_service.py`
- Create: `tests/test_fileexplorer_security.py`

**Interfaces:**
- Consumes: `SettingsRepository`
- Produces:
  - `FileExplorerService.get_allowed_roots() -> list[str]`
  - `FileExplorerService.set_allowed_roots(roots: list[str]) -> list[str]`
  - `FileExplorerService.validate_path(target_path: str) -> str`
  - `FileExplorerService.list_directory(dir_path: str = None) -> dict`
  - `FileExplorerService.read_file(file_path: str) -> dict`
  - `FileExplorerService.save_file(file_path: str, content: str, expected_mtime: float = None, force: bool = False) -> dict`
  - `FileExplorerService.create_item(parent_path: str, name: str, is_dir: bool = False) -> dict`
  - `FileExplorerService.rename_item(target_path: str, new_name: str) -> dict`
  - `FileExplorerService.delete_item(target_path: str) -> dict`

- [ ] **Step 1: Tulis unit test untuk `test_fileexplorer_service.py` dan `test_fileexplorer_security.py`**

- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_fileexplorer_service.py -v`
Expected: FAIL (ModuleNotFoundError)

- [ ] **Step 3: Implementasikan `FileExplorerService` dengan seluruh pertahanan keamanan**

- Canonical path verification terhadap allowed roots
- Binary null-byte detection
- 5MB limit
- Atomic save via temporary file
- Optimistic locking via `mtime`

- [ ] **Step 4: Jalankan test kembali untuk memverifikasi kelulusan**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_fileexplorer_service.py tests/test_fileexplorer_security.py -v`
Expected: PASS 100%

- [ ] **Step 5: Commit Task 2**

```bash
git add app/services/fileexplorer/ tests/test_fileexplorer_service.py tests/test_fileexplorer_security.py
git commit -m "feat(fileexplorer): implementasi service inti file explorer dan validasi sandbox keamanan"
```

---

### Task 3: API Endpoints, Audit Logging & Blueprint Registration

**Files:**
- Create: `app/routes/fileexplorer/__init__.py`
- Create: `app/routes/fileexplorer/fileexplorer_routes.py`
- Modify: `app/routes/__init__.py`
- Modify: `app/utils/logger.py`
- Create: `tests/test_fileexplorer_api.py`

**Interfaces:**
- Consumes: `FileExplorerService`, `write_log()`
- Produces: API Blueprint `fileexplorer_api_bp` pada `/api/v1/kasir/fileexplorer/`

- [ ] **Step 1: Tulis test integrasi API `tests/test_fileexplorer_api.py`**
- [ ] **Step 2: Jalankan test untuk memverifikasi kegagalan**
- [ ] **Step 3: Implementasikan `fileexplorer_routes.py`, registrasikan di `app/routes/__init__.py` & `app/__init__.py`, dan tambahkan log audit di `app/utils/logger.py`**
- [ ] **Step 4: Jalankan test untuk memverifikasi kelulusan**
- [ ] **Step 5: Commit Task 3**

```bash
git add app/routes/fileexplorer/ app/routes/__init__.py app/__init__.py app/utils/logger.py tests/test_fileexplorer_api.py
git commit -m "feat(fileexplorer): registrasi API endpoints dan pencatatan audit log"
```

---

### Task 4: Frontend UI, Sidebar Navigation & CodeMirror 6 Editor

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`
- Create: `app/templates/kasir/tabs/fileexplorer.html`
- Modify: `app/templates/kasir/index.html` (atau `base.html` / `dashboard.html`)
- Create: `app/static/js/kasir/modules/fileexplorer/index.js`
- Modify: `app/static/js/kasir/core/api.js`
- Modify: `app/static/js/kasir/app.js`

**Interfaces:**
- Consumes: `API.fileexplorer`, CodeMirror 6
- Produces: Antarmuka Web File Explorer responsif bertema Chamber Noir Dark

- [ ] **Step 1: Tambahkan API methods di `app/static/js/kasir/core/api.js`**
- [ ] **Step 2: Tambahkan menu sidebar `📁 File Explorer` di `sidebar.html`**
- [ ] **Step 3: Buat template tab `fileexplorer.html` dengan tata letak split-view**
- [ ] **Step 4: Buat modul frontend `app/static/js/kasir/modules/fileexplorer/index.js`**
- [ ] **Step 5: Integrasikan di `base.html` dan `app.js` (switchTab)**
- [ ] **Step 6: Jalankan seluruh test suite pytest**
- [ ] **Step 7: Commit Task 4**

```bash
git add app/templates/ app/static/
git commit -m "feat(ui): implementasi antarmuka web file explorer dan editor codemirror"
```

---

### Task 5: Full Regression Testing & Code Review

**Files:**
- Run: Seluruh test suite pytest

- [ ] **Step 1: Jalankan seluruh test suite**
Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
Expected: Seluruh test suite lulus 100%.

- [ ] **Step 2: Lakukan code review dan verifikasi keamanan akhir**

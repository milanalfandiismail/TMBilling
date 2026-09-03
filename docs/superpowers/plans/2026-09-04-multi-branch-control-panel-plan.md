# Multi-Branch Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fitur Multi-Cabang (Central Control Panel) pada TMBilling v1.6.0 yang memungkinkan pemilik warnet mengontrol dan memantau beberapa server cabang warnet secara terpadu melalui dropdown switcher di navbar Kasir berbasis secure API Key reverse-proxy relay.

**Architecture:** Masing-masing server cabang tetap berjalan otonom di jaringannya sendiri. Komunikasi antar cabang dijembatani oleh server-to-server reverse proxy relay (`BranchProxyService`) yang mem-forward request API kasir ke URL cabang target menggunakan header `Authorization: Bearer <branch_api_key>`. Middleware `@login_required` di-upgrade untuk mendukung dual-mode autentikasi (cookie sesi web dan bearer token), dan antarmuka kasir dilengkapi dropdown pemilih cabang global di header navbar.

**Tech Stack:** Python 3, Flask, SQLAlchemy, requests/urllib3, Vanilla JS, Tailwind CSS, noVNC / Websockify, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-04-multi-branch-control-panel-design.md`

## Global Constraints
- Server lokal di setiap cabang harus tetap otonom dan mampu menjalankan billing secara normal saat koneksi internet terputus.
- Skema database yang ada tidak boleh diubah atau dirusak (*non-destructive migration* via self-healing bootstrap inspector).
- API Key cabang disimpan di server lokal dan tidak boleh dibocorkan ke browser/frontend.
- Fitur multi-cabang (switcher dan konfigurasi cabang) hanya dapat diakses oleh role `admin`.
- Penamaan cabang otomatis terdeteksi dari konfigurasi `warnet_title` cabang remote.
- Seluruh tes otomatis harus lulus (100% green suite).

---

### Task 1: Model Database `Cabang` & Self-Healing Bootstrap

**Files:**
- Create: `app/models/branch/branch.py`
- Modify: `app/models/__init__.py:1-40`
- Modify: `app/__init__.py:240-270`
- Test: `tests/test_branch_model.py`

**Interfaces:**
- Produces: `app.models.branch.Branch`
  - Fields: `id` (int), `nama` (str), `url` (str), `api_key` (str), `aktif` (bool), `urutan` (int), `status_online` (bool), `latensi_ms` (int), `terakhir_dicek` (datetime), `dibuat_pada` (datetime)
  - Method: `to_dict(include_key=False) -> dict`

- [ ] **Step 1: Tulis tes unit untuk model Branch dan bootstrap database**

```python
# tests/test_branch_model.py
import pytest
from app import create_app
from app.models import db
from app.models.branch import Branch

@pytest.fixture
def app_instance():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_branch_model_crud(app_instance):
    with app_instance.app_context():
        branch = Branch(
            nama="TM-Esports Belida",
            url="https://tm2billing.milannn.my.id",
            api_key="tmb_sec_test_secret_key_12345",
            aktif=True
        )
        db.session.add(branch)
        db.session.commit()

        saved = Branch.query.filter_by(nama="TM-Esports Belida").first()
        assert saved is not None
        assert saved.url == "https://tm2billing.milannn.my.id"
        assert saved.api_key == "tmb_sec_test_secret_key_12345"
        assert saved.aktif is True

        # Test to_dict masking api_key by default
        data_safe = saved.to_dict()
        assert "api_key" not in data_safe
        assert data_safe["nama"] == "TM-Esports Belida"

        data_full = saved.to_dict(include_key=True)
        assert data_full["api_key"] == "tmb_sec_test_secret_key_12345"
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan awal**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_model.py -v`
Ekspektasi: FAIL dengan `ModuleNotFoundError: No module named 'app.models.branch'`

- [ ] **Step 3: Implementasi model `Branch` dan daftarkan di `app/models/`**

```python
# app/models/branch/branch.py
"""Model data untuk koneksi cabang warnet (Multi-Cabang)."""

from app.models import db, now_local

class Branch(db.Model):
    """Model data untuk entitas cabang warnet terhubung."""
    
    __tablename__ = "cabang"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    api_key = db.Column(db.String(255), nullable=False)
    aktif = db.Column(db.Boolean, default=True, nullable=False)
    urutan = db.Column(db.Integer, default=0, nullable=False)
    status_online = db.Column(db.Boolean, default=False, nullable=False)
    latensi_ms = db.Column(db.Integer, nullable=True)
    terakhir_dicek = db.Column(db.DateTime, nullable=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local, nullable=False)

    def to_dict(self, include_key=False):
        """Konversi data cabang ke dictionary."""
        data = {
            "id": self.id,
            "nama": self.nama,
            "url": self.url,
            "aktif": self.aktif,
            "urutan": self.urutan,
            "status_online": self.status_online,
            "latensi_ms": self.latensi_ms,
            "terakhir_dicek": self.terakhir_dicek.isoformat() if self.terakhir_dicek else None,
            "dibuat_pada": self.dibuat_pada.isoformat() if self.dibuat_pada else None,
        }
        if include_key:
            data["api_key"] = self.api_key
        return data
```

Daftarkan di `app/models/__init__.py` dan tambahkan bootstrap self-healing di `app/__init__.py`:
```python
# app/__init__.py di dalam _init_app_context()
try:
    from sqlalchemy import inspect
    from app.models.branch import Branch
    inspector = inspect(db.engine)
    if not inspector.has_table('cabang'):
        Branch.__table__.create(db.engine)
        app.logger.info("✅ [TMBilling] Tabel 'cabang' berhasil dibuat secara otomatis.")
except Exception as e:
    app.logger.warning(f"Pengecekan bootstrap tabel cabang: {e}")
```

- [ ] **Step 4: Jalankan tes untuk memverifikasi keberhasilan**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_model.py -v`
Ekspektasi: PASS

- [ ] **Step 5: Commit perubahan Task 1**

```bash
git add app/models/branch/ tests/test_branch_model.py app/models/__init__.py app/__init__.py
git commit -m "feat(branch): implementasi model database Branch dan self-healing bootstrap"
```

---

### Task 2: Keamanan API Key & Upgrade Middleware `@login_required` Dual-Mode

**Files:**
- Modify: `app/services/settings/settings_service.py:20-55`
- Modify: `app/middleware/auth.py:10-50`
- Test: `tests/test_branch_auth_middleware.py`

**Interfaces:**
- Consumes: `app.services.settings.settings_service.SettingsService`
- Produces:
  - `SettingsService.get_or_create_branch_api_key() -> str`
  - `SettingsService.regenerate_branch_api_key() -> str`
  - `@login_required` mendukung Bearer API Key header yang cocok dengan `branch_api_key`.

- [ ] **Step 1: Tulis tes untuk dual-mode authentication middleware**

```python
# tests/test_branch_auth_middleware.py
import pytest
from app import create_app
from app.models import db
from app.services import SettingsService

@pytest.fixture
def client_app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        # Set api key
        SettingsService.set("branch_api_key", "tmb_sec_valid_token_12345")
        yield app.test_client()
        db.session.remove()
        db.drop_all()

def test_endpoint_denied_without_auth(client_app):
    # Akses endpoint kasir tanpa session dan tanpa bearer token
    res = client_app.get('/api/v1/kasir/dashboard/status')
    assert res.status_code in (401, 302, 403)

def test_endpoint_allowed_with_valid_bearer_token(client_app):
    headers = {"Authorization": "Bearer tmb_sec_valid_token_12345"}
    res = client_app.get('/api/v1/kasir/dashboard/status', headers=headers)
    assert res.status_code == 200

def test_endpoint_denied_with_invalid_bearer_token(client_app):
    headers = {"Authorization": "Bearer tmb_sec_salah_total_99999"}
    res = client_app.get('/api/v1/kasir/dashboard/status', headers=headers)
    assert res.status_code in (401, 403)
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan awal**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_auth_middleware.py -v`
Ekspektasi: FAIL pada `test_endpoint_allowed_with_valid_bearer_token`

- [ ] **Step 3: Perbarui `SettingsService` dan `app/middleware/auth.py`**

Di `app/services/settings/settings_service.py`:
```python
import secrets

@staticmethod
def get_or_create_branch_api_key():
    """Mengambil branch_api_key atau membuatnya secara otomatis jika belum ada."""
    key = SettingsService.get("branch_api_key")
    if not key:
        key = "tmb_sec_" + secrets.token_hex(24)
        SettingsService.set("branch_api_key", key)
    return key

@staticmethod
def regenerate_branch_api_key():
    """Membuat ulang branch_api_key lokal."""
    key = "tmb_sec_" + secrets.token_hex(24)
    SettingsService.set("branch_api_key", key)
    return key
```

Di `app/middleware/auth.py`:
```python
import secrets
from flask import session, jsonify, request, g
from app.services import SettingsService

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Cek otentikasi via Bearer Token (Akses Lintas Cabang / Multi-Branch)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            local_key = SettingsService.get_or_create_branch_api_key()
            if local_key and secrets.compare_digest(token, local_key):
                g.is_branch_api_call = True
                return f(*args, **kwargs)

        # 2. Cek otentikasi sesi browser kasir lokal
        if 'user_id' not in session:
            return jsonify({
                "status": "error",
                "message": "Sesi berakhir atau otentikasi diperlukan"
            }), 401
            
        return f(*args, **kwargs)
    return decorated_function
```

- [ ] **Step 4: Jalankan tes untuk memverifikasi keberhasilan**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_auth_middleware.py -v`
Ekspektasi: PASS

- [ ] **Step 5: Commit perubahan Task 2**

```bash
git add app/services/settings/settings_service.py app/middleware/auth.py tests/test_branch_auth_middleware.py
git commit -m "feat(auth): upgrade middleware login_required untuk mendukung Bearer API Key lintas cabang"
```

---

### Task 3: Service & Endpoint CRUD Manajemen Cabang

**Files:**
- Create: `app/services/branch/branch_service.py`
- Create: `app/routes/branch/branch_routes.py`
- Modify: `app/routes/__init__.py`
- Modify: `app/__init__.py`
- Test: `tests/test_branch_management_api.py`

**Interfaces:**
- Produces: `BranchService`
  - `get_all_branches() -> list[dict]`
  - `add_branch(url, api_key, nama=None) -> tuple[bool, dict|str]`
  - `update_branch(branch_id, data) -> tuple[bool, dict|str]`
  - `delete_branch(branch_id) -> tuple[bool, str]`
  - `test_connection(url, api_key) -> tuple[bool, dict|str]`
- Routes:
  - `GET /api/v1/kasir/branch/list`
  - `POST /api/v1/kasir/branch/add`
  - `PUT /api/v1/kasir/branch/<int:branch_id>`
  - `DELETE /api/v1/kasir/branch/<int:branch_id>`
  - `POST /api/v1/kasir/branch/test`
  - `GET /api/v1/kasir/branch/my-key`
  - `POST /api/v1/kasir/branch/my-key/regenerate`

- [ ] **Step 1: Tulis tes endpoint API manajemen cabang**

```python
# tests/test_branch_management_api.py
import pytest
from app import create_app
from app.models import db, User
from unittest.mock import patch

@pytest.fixture
def auth_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['user_id'] = admin.id
            sess['role'] = 'admin'
        yield client, app
        db.session.remove()
        db.drop_all()

def test_branch_my_key_endpoints(auth_client):
    client, app = auth_client
    res = client.get('/api/v1/kasir/branch/my-key')
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "api_key" in data["data"]
    assert data["data"]["api_key"].startswith("tmb_sec_")

    # Test regenerate
    res_regen = client.post('/api/v1/kasir/branch/my-key/regenerate')
    assert res_regen.status_code == 200
    new_data = res_regen.get_json()
    assert new_data["data"]["api_key"] != data["data"]["api_key"]

@patch('requests.get')
def test_add_branch_with_auto_detect_name(mock_get, auth_client):
    client, app = auth_client
    # Mock auto-discovery warnet_title from remote branch
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "success": True,
        "data": {"warnet_title": "TM-Esports Belida Auto"}
    }
    mock_get.return_value.elapsed.total_seconds.return_value = 0.045

    payload = {
        "url": "https://tm2billing.milannn.my.id",
        "api_key": "tmb_sec_remote_key_999"
    }
    res = client.post('/api/v1/kasir/branch/add', json=payload)
    assert res.status_code == 200
    res_json = res.get_json()
    assert res_json["success"] is True
    assert res_json["data"]["nama"] == "TM-Esports Belida Auto"
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan awal**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_management_api.py -v`
Ekspektasi: FAIL dengan 404 (route belum ada)

- [ ] **Step 3: Implementasi `BranchService` dan `branch_routes.py`**

Buat `app/services/branch/branch_service.py` untuk mengelola CRUD database dan auto-detection via ping HTTP ke remote `/api/v1/kasir/dashboard/status` atau `/api/v1/kasir/settings/warnet_title`.
Buat `app/routes/branch/branch_routes.py` dan daftarkan blueprint `branch_api_bp` pada `app/routes/__init__.py` dan `app/__init__.py` dengan URL prefix `/api/v1/kasir/branch`.

- [ ] **Step 4: Jalankan tes untuk memverifikasi keberhasilan**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_management_api.py -v`
Ekspektasi: PASS

- [ ] **Step 5: Commit perubahan Task 3**

```bash
git add app/services/branch/ app/routes/branch/ app/routes/__init__.py app/__init__.py tests/test_branch_management_api.py
git commit -m "feat(branch): implementasi BranchService dan endpoint manajemen cabang"
```

---

### Task 4: Backend Reverse-Proxy Relay Service (`BranchProxyService`)

**Files:**
- Create: `app/services/branch/branch_proxy_service.py`
- Modify: `app/middleware/auth.py`
- Modify: `app/routes/dashboard/dashboard_routes.py:1-50`
- Modify: `app/routes/sesi/sesi_routes.py:1-50`
- Modify: `app/routes/pc/pc_routes.py:1-50`
- Test: `tests/test_branch_proxy_relay.py`

**Interfaces:**
- Produces: `BranchProxyService.relay_request(branch_id, target_subpath, method, headers, params, body) -> Response`
- Behavior:
  - Jika request membawa `X-Branch-ID: <id>` dan `id != 0` (bukan lokal):
    Mengambil data cabang & API key dari DB, mengirim request via HTTP `requests` dengan header `Authorization: Bearer <branch_api_key>`.
  - Jika timeout atau offline: Mengembalikan response JSON 503 bersahabat: `{ "success": false, "is_branch_offline": True, "error": "Cabang sedang offline..." }`.

- [ ] **Step 1: Tulis tes proxy relay untuk komunikasi server-to-server**

```python
# tests/test_branch_proxy_relay.py
import pytest
from app import create_app
from app.models import db, User
from app.models.branch import Branch
from unittest.mock import patch
import requests

@pytest.fixture
def proxy_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_proxy", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch = Branch(
            nama="TM-Esports Belida",
            url="https://tm2billing.milannn.my.id",
            api_key="tmb_sec_belida_key_123",
            aktif=True
        )
        db.session.add(branch)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['user_id'] = admin.id
            sess['role'] = 'admin'
        yield client, branch.id
        db.session.remove()
        db.drop_all()

@patch('requests.request')
def test_proxy_relays_request_to_remote_branch(mock_req, proxy_client):
    client, branch_id = proxy_client
    mock_req.return_value.status_code = 200
    mock_req.return_value.content = b'{"success": true, "pc_list": [{"nama": "PC-01"}]}'
    mock_req.return_value.headers = {'Content-Type': 'application/json'}

    headers = {'X-Branch-ID': str(branch_id)}
    res = client.get('/api/v1/kasir/dashboard/status', headers=headers)
    assert res.status_code == 200
    assert res.get_json()["pc_list"][0]["nama"] == "PC-01"

    # Verifikasi header Bearer Token dikirim ke target
    called_headers = mock_req.call_args[1]["headers"]
    assert called_headers["Authorization"] == "Bearer tmb_sec_belida_key_123"

@patch('requests.request', side_effect=requests.exceptions.ConnectTimeout)
def test_proxy_handles_remote_offline_gracefully(mock_req, proxy_client):
    client, branch_id = proxy_client
    headers = {'X-Branch-ID': str(branch_id)}
    res = client.get('/api/v1/kasir/dashboard/status', headers=headers)
    assert res.status_code in (503, 504)
    data = res.get_json()
    assert data["is_branch_offline"] is True
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan awal**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_proxy_relay.py -v`
Ekspektasi: FAIL

- [ ] **Step 3: Implementasi `BranchProxyService` dan pasang hook relay di middleware/blueprint**

Buat `app/services/branch/branch_proxy_service.py`:
Menerima request, mem-forward method (GET, POST, PUT, DELETE), header, body (JSON/Form), dan query string ke remote base URL + subpath.
Pasang interceptor di `before_request` atau di router kasir untuk route `/api/v1/kasir/*` jika `request.headers.get("X-Branch-ID")` ada dan bukan `0`.

- [ ] **Step 4: Jalankan tes untuk memverifikasi keberhasilan**

Jalankan: `.venv\Scripts\python -m pytest tests/test_branch_proxy_relay.py -v`
Ekspektasi: PASS

- [ ] **Step 5: Commit perubahan Task 4**

```bash
git add app/services/branch/branch_proxy_service.py app/middleware/ tests/test_branch_proxy_relay.py
git commit -m "feat(proxy): implementasi BranchProxyService untuk relay server-to-server otomatis"
```

---

### Task 5: Komponen UI Kasir (Navbar Branch Switcher & Menu Settings Multi-Cabang)

**Files:**
- Create: `app/static/js/kasir/modules/branch/index.js`
- Modify: `app/templates/kasir/base.html:50-90`
- Modify: `app/templates/kasir/tabs/settings.html:150-250`
- Modify: `app/static/js/kasir/core/api.js:1-50`
- Modify: `app/static/js/kasir/modules/dashboard/index.js:1-60`

**Interfaces:**
- Produces:
  - Global Branch Switcher di navbar `[ 🏢 TM-Esports Samarinda (Lokal) ▼ ]`.
  - Panel Pengaturan Multi-Cabang di tab Settings kasir (Kunci Cabang Ini & Daftar Cabang).
  - Injeksi otomatis header `X-Branch-ID: <active_branch_id>` pada setiap panggilan `API.get`, `API.post`, `API.put`, `API.delete` di `api.js`.

- [ ] **Step 1: Update `app/static/js/kasir/core/api.js` untuk menyertakan `X-Branch-ID`**

Tambahkan pembacaan state aktif `localStorage.getItem('active_branch_id') || '0'` dan sisipkan ke default headers di `api.js`.

- [ ] **Step 2: Buat modul frontend `app/static/js/kasir/modules/branch/index.js`**

Implementasikan class `BranchManager`:
- Memuat daftar cabang dari `/api/v1/kasir/branch/list`.
- Merender dropdown selektor cabang di header navbar.
- Menangani event switch cabang: ubah `active_branch_id`, perbarui teks dropdown, dan trigger reload dashboard data (`Dashboard.loadData()`).
- Menangani modal tambah cabang, tes koneksi, salin API key, dan regenerate API key.

- [ ] **Step 3: Integrasikan dropdown di `app/templates/kasir/base.html` dan panel di `settings.html`**

Pasang dropdown selektor cabang di header navbar `base.html` di samping nama kasir / info shift (hanya tampil jika role user adalah `admin`).
Tambahkan tab/card konfigurasi "Multi-Cabang & API" di `settings.html`.

- [ ] **Step 4: Tes interaksi frontend di browser**

Pastikan:
- Dropdown menampilkan cabang lokal dan cabang remote.
- Mengklik cabang remote memicu pergantian data tanpa reload browser.
- Banner offline muncul jika cabang tujuan tidak dapat dihubungi.

- [ ] **Step 5: Commit perubahan Task 5**

```bash
git add app/static/js/kasir/modules/branch/ app/templates/kasir/ app/static/js/kasir/
git commit -m "feat(ui): integrasikan navbar branch switcher dan panel pengaturan multi-cabang"
```

---

### Task 6: Remote Control VNC Lintas Cabang via Token Multiplexing

**Files:**
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js:120-170`
- Modify: `app/routes/vnc/vnc_routes.py:1-40`
- Test: `tests/test_vnc_cross_branch.py`

**Interfaces:**
- Behavior:
  Ketika remote control dipicu saat berada di cabang remote, URL WebSocket noVNC mengarah langsung ke tunnel cabang target (`wss://<branch_url>/websockify?token=<session_token>`).

- [ ] **Step 1: Tulis tes rute VNC mengembalikan base tunnel URL cabang**

```python
# tests/test_vnc_cross_branch.py
import pytest
from app import create_app
from app.models import db, User

def test_vnc_status_returns_tunnel_url_when_requested():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_vnc", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['user_id'] = admin.id
            sess['role'] = 'admin'

        res = client.get('/api/v1/kasir/vnc/status')
        assert res.status_code == 200
        data = res.get_json()
        assert "tunnel_url" in data or "port" in data
        db.session.remove()
        db.drop_all()
```

- [ ] **Step 2: Sesuaikan `vnc_client.js`**

Di `vnc_client.js`, saat menginisialisasi `new RFB(...)`, periksa apakah ada `active_branch_url`. Jika ada, gunakan host WebSocket dari cabang tersebut.

- [ ] **Step 3: Jalankan tes**

Jalankan: `.venv\Scripts\python -m pytest tests/test_vnc_cross_branch.py -v`
Ekspektasi: PASS

- [ ] **Step 4: Commit perubahan Task 6**

```bash
git add app/static/js/kasir/modules/remote/vnc_client.js tests/test_vnc_cross_branch.py
git commit -m "feat(vnc): integrasi remote control VNC langsung ke tunnel cabang target"
```

---

### Task 7: Full Test Suite & Verifikasi Akhir

**Files:**
- Test: `tests/` (seluruh test suite)
- Modify: `package.json:1-5` (bump version ke 1.6.0)
- Modify: `app/config.py:1-10`

- [ ] **Step 1: Jalankan seluruh automated test suite**

Jalankan: `.venv\Scripts\python -m pytest -q`
Ekspektasi: 100% Passed (tidak ada regresi pada fitur lama).

- [ ] **Step 2: Naikkan versi ke 1.6.0 pada config**

Perbarui `package.json` dan `app/config.py` dari `1.5.8` ke `1.6.0`.

- [ ] **Step 3: Commit dan verifikasi**

```bash
git add package.json app/config.py
git commit -m "chore(release): bump versi aplikasi ke v1.6.0"
```

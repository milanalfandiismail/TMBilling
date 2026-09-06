# Perbaikan Multi-Cabang: Media Proxy (Screenshot & QRIS 404), Catatan Redirect Loop, dan Tab Refresh Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki 3 bug kritis pada ekosistem multi-cabang TMBilling: (1) URL screenshot PC dan QRIS 404 karena masih mengarah ke server lokal saat berada di cabang remote, (2) membuka modul Catatan menyebabkan redirect looping ke halaman login, dan (3) me-refresh tab browser saat berada di cabang remote menyebabkan redirect looping ke halaman login, dengan versi tetap di `v1.6.0`.

**Architecture:** 
1. **Backend Media Proxy Relay:** Menyediakan endpoint reverse-proxy streaming `GET /api/v1/kasir/branch/<int:branch_id>/media/<path:filename>` yang meneruskan permintaan aset media statis (`/static/uploads/...`) dari server cabang remote secara aman melalui koneksi server-to-server dengan API key, menghindari CORS, mixed-content, dan port/NAT issues.
2. **Frontend Media Resolver:** Menambahkan utilitas `API.resolveMediaUrl(url)` yang secara otomatis memetakan path relatif `/static/uploads/...` ke endpoint media proxy jika `active_branch_id > 0` (mode remote), dan menggunakannya pada modul Screenshot Monitor, Detail PC Modal, Pengaturan QRIS, Menu Kantin, dan Game Launcher.
3. **Notes Multi-Branch Auth & Lazy-Load:** Memperbaiki interceptor autentikasi `notes_api_bp` pada `note_routes.py` agar mendukung `Authorization: Bearer <api_key>` (branch relay) melalui `_apply_branch_relay_identity()`, serta menghapus pemanggilan eager `loadNotes()` di `DOMContentLoaded` pada `catatan/index.js` agar hanya dimuat saat tab Catatan dibuka.
4. **Session Desync & Remote Auth Failover Guard:** Menghapus `session.pop('active_branch_id')` destruktif pada route `dashboard()` agar session server dan `sessionStorage` browser tetap sinkron saat browser di-refresh. Mencegah `API.request` melakukan redirect ke `/kasir/login` saat request cabang remote mengembalikan 401/403 (melainkan failover kembali ke Cabang Lokal via `handleActiveBranchDisconnect()`). Menghapus redirect paksa pada `xhr.onerror` background session polling.

**Tech Stack:** Flask, Python 3.12/3.14, SQLAlchemy, Vanilla JavaScript (ES6+), Tailwind CSS, Pytest.

**Spec:** Analisis Root Cause Bug Multi-Cabang TMBilling v1.6.0.

## Global Constraints
- Versi aplikasi tetap dipertahankan pada `v1.6.0` (bugfix only, tidak ada bump versi).
- Kompatibilitas mundur: Seluruh fungsi Cabang Lokal (ID 0) harus tetap berjalan normal 100% tanpa regresi.
- Keamanan: Endpoint media proxy hanya melayani file dalam whitelist folder uploads atau static, dan dilindungi autentikasi session kasir / bearer token.

---

### Task 1: Backend Media Proxy Relay Endpoint

**Files:**
- Modify: `app/routes/branch/branch_routes.py:340-363`
- Test: `tests/test_branch_media_proxy.py`

**Interfaces:**
- Consumes: `Branch.query.get(branch_id)`, `requests.get()`
- Produces: `GET /api/v1/kasir/branch/<int:branch_id>/media/<path:filename>` (Flask `Response` streaming image binary)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_branch_media_proxy.py
import pytest
from unittest.mock import patch, MagicMock
from app import create_app, db
from app.models.branch import Branch
from app.models import User

@pytest.fixture
def client(app):
    return app.test_client()

def test_proxy_branch_media_unauthorized(client):
    """Memastikan akses proxy media tanpa login ditolak 401."""
    res = client.get('/api/v1/kasir/branch/1/media/uploads/screenshots/TM-01.png')
    assert res.status_code == 401

def test_proxy_branch_media_branch_not_found(client, admin_user):
    """Memastikan proxy media mengembalikan 404 jika cabang tidak ada."""
    with client.session_transaction() as sess:
        sess['kasir_id'] = admin_user.id
        sess['kasir_username'] = admin_user.username
        sess['kasir_role'] = 'admin'
    res = client.get('/api/v1/kasir/branch/999/media/uploads/screenshots/TM-01.png')
    assert res.status_code == 404

def test_proxy_branch_media_success(client, admin_user):
    """Memastikan proxy media sukses meneruskan data gambar dari cabang remote."""
    branch = Branch(nama="Cabang Remote Tes", url="http://192.168.20.10:7015", api_key="secret-key-123", aktif=True)
    db.session.add(branch)
    db.session.commit()

    with client.session_transaction() as sess:
        sess['kasir_id'] = admin_user.id
        sess['kasir_username'] = admin_user.username
        sess['kasir_role'] = 'admin'

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.headers = {"Content-Type": "image/png"}
    fake_resp.content = b"\x89PNG\r\n\x1a\nfakeimagebinary"
    fake_resp.iter_content.return_value = [b"\x89PNG\r\n\x1a\nfakeimagebinary"]

    with patch("requests.get", return_value=fake_resp) as mock_get:
        res = client.get(f'/api/v1/kasir/branch/{branch.id}/media/uploads/screenshots/TM-14.png?t=12345')
        assert res.status_code == 200
        assert res.data == b"\x89PNG\r\n\x1a\nfakeimagebinary"
        assert res.headers.get("Content-Type") == "image/png"
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert "http://192.168.20.10:7015/static/uploads/screenshots/TM-14.png?t=12345" in args[0]
        assert kwargs["headers"]["Authorization"] == "Bearer secret-key-123"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_media_proxy.py -v`
Expected: FAIL with 404 for route `/api/v1/kasir/branch/<id>/media/...`

- [ ] **Step 3: Implement minimal backend media proxy route**

Tambahkan route proxy media di `app/routes/branch/branch_routes.py`:
```python
@branch_api_bp.route("/<int:branch_id>/media/<path:filename>", methods=["GET"])
def proxy_branch_media(branch_id: int, filename: str):
    """Proxy file media statis (screenshot, QRIS, menu) dari server cabang remote."""
    kasir_id = session.get("kasir_id")
    auth_header = request.headers.get("Authorization", "")
    if not kasir_id and not auth_header.startswith("Bearer "):
        return jsonify({"success": False, "error": "Silakan login terlebih dahulu"}), 401

    branch = Branch.query.get(branch_id)
    if not branch or not branch.aktif:
        return jsonify({"success": False, "error": "Cabang target tidak ditemukan atau tidak aktif"}), 404

    target_url = f"{branch.url.rstrip('/')}/static/{filename}"
    if request.query_string:
        target_url += f"?{request.query_string.decode('utf-8')}"

    try:
        resp = requests.get(
            target_url,
            headers={
                "Authorization": f"Bearer {branch.api_key}",
                "User-Agent": "TMBilling-Relay/1.6.0"
            },
            timeout=6,
            stream=True
        )
        content_type = resp.headers.get("Content-Type", "image/png")
        if resp.status_code != 200:
            return Response(resp.content, status=resp.status_code, content_type=content_type)

        return Response(resp.iter_content(chunk_size=8192), status=200, content_type=content_type)
    except Exception as e:
        return jsonify({"success": False, "error": f"Gagal mengambil berkas media dari cabang remote: {str(e)}"}), 502
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_media_proxy.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add app/routes/branch/branch_routes.py tests/test_branch_media_proxy.py
git commit -m "fix(branch): tambahkan endpoint reverse-proxy media untuk aset cabang remote"
```

---

### Task 2: Frontend Media Resolver Helper & Integrasi Modul Screenshot, Detail PC, QRIS, & Menu

**Files:**
- Modify: `app/static/js/kasir/core/api.js:325-330`
- Modify: `app/static/js/kasir/modules/screenshot/index.js:205-225`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js:168-175, 380-385`
- Modify: `app/static/js/kasir/modules/settings/index.js:120-125, 758-765`
- Modify: `app/static/js/kasir/modules/menu/index.js:55-65`
- Modify: `app/static/js/kasir/modules/game/index.js:85-92`

**Interfaces:**
- Consumes: `window.BranchManager.activeBranchId`, `sessionStorage.getItem('active_branch_id')`
- Produces: `API.resolveMediaUrl(url: string) -> string`

- [ ] **Step 1: Add `resolveMediaUrl` in `app/static/js/kasir/core/api.js`**

Tambahkan method `resolveMediaUrl` di object `API`:
```javascript
    resolveMediaUrl(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        const activeBranchId = (window.BranchManager && window.BranchManager.activeBranchId) || sessionStorage.getItem('active_branch_id') || '0';
        if (activeBranchId && activeBranchId !== '0') {
            if (url.startsWith('/static/')) {
                const relPath = url.substring('/static/'.length);
                return `/api/v1/kasir/branch/${activeBranchId}/media/${relPath}`;
            }
        }
        return url;
    },
```

- [ ] **Step 2: Update `Screenshot.renderGrid` and `Screenshot.openLightbox` in `app/static/js/kasir/modules/screenshot/index.js`**

Ubah baris 207-225 agar menggunakan `API.resolveMediaUrl`:
```javascript
            const hasImage = !!pc.screenshot_url;
            const resolvedUrl = hasImage && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');
            const imageUrl = hasImage ? `${resolvedUrl}?t=${new Date().getTime()}` : '';
            
            return `
                <div class="screenshot-card w-full h-full flex flex-col bg-[#121212] border border-[#1c1c1c] rounded overflow-hidden" data-pcid="${pc.pc_id}">
                    <div class="flex-1 flex flex-col">
                        <div class="p-3 border-b border-[#1c1c1c] flex justify-between items-center bg-[#171717]">
                            <div class="font-bold text-neutral-200 text-sm">${pc.pc_kode}</div>
                            <button onclick="Screenshot.triggerSingle(${pc.pc_id})" class="text-neutral-400 hover:text-white p-1 rounded hover:bg-[#222]" title="Ambil Ulang">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                            </button>
                        </div>
                        
                        <div class="relative w-full aspect-video bg-black flex flex-col items-center justify-center group cursor-pointer" onclick="Screenshot.openLightbox('${hasImage ? resolvedUrl : ''}', '${pc.pc_kode}')">
                        ${hasImage 
                            ? `<img src="${imageUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Screenshot ${pc.pc_kode}">
                               <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                   <svg class="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                               </div>` 
                            : `<div class="text-neutral-600 flex flex-col items-center gap-2">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                <span class="text-xs">Belum ada screenshot</span>
                               </div>`
                        }
                        </div>
                    </div>
```

- [ ] **Step 3: Update `DashboardDetailModal` in `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`**

Ubah rendering screenshot di modal detail PC (baris 169 & 381):
```javascript
const resolvedScreenshot = pc.screenshot_url && window.API ? API.resolveMediaUrl(pc.screenshot_url) : (pc.screenshot_url || '');
// Pada img element:
<img id="screenshot-img" src="${resolvedScreenshot ? resolvedScreenshot + '?t=' + Date.now() : ''}"
```
Dan pada trigger screenshot selesai:
```javascript
img.src = (window.API ? API.resolveMediaUrl(statusData.screenshot_url) : statusData.screenshot_url) + '?t=' + Date.now();
```

- [ ] **Step 4: Update QRIS Preview in `app/static/js/kasir/modules/settings/index.js`**

Ubah pemuatan URL QRIS (baris 122 & 761):
```javascript
if (qrisPreview && res.settings.qris_image_url !== undefined) {
    qrisPreview.src = window.API ? API.resolveMediaUrl(res.settings.qris_image_url) : res.settings.qris_image_url;
}
```
Dan pada saat upload selesai:
```javascript
if (preview) preview.src = window.API ? API.resolveMediaUrl(uploadRes.qris_url) : uploadRes.qris_url;
```

- [ ] **Step 5: Update Menu & Game Image Resolvers in `modules/menu/index.js` & `modules/game/index.js`**

Wrap `m.gambar_path` dengan `API.resolveMediaUrl(m.gambar_path)` dan `g.icon_url` dengan `API.resolveMediaUrl(g.icon_url)`.

- [ ] **Step 6: Run existing and new tests to verify frontend and backend media stability**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_media_proxy.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/static/js/kasir/core/api.js app/static/js/kasir/modules/screenshot/index.js app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js app/static/js/kasir/modules/settings/index.js app/static/js/kasir/modules/menu/index.js app/static/js/kasir/modules/game/index.js
git commit -m "fix(frontend): integrasikan API.resolveMediaUrl untuk screenshot, QRIS, menu, dan icon game remote"
```

---

### Task 3: Fix Notes Auth Middleware for Multi-Branch Bearer Relay & Remove Eager Notes Load

**Files:**
- Modify: `app/routes/notes/note_routes.py:10-25`
- Modify: `app/static/js/kasir/modules/catatan/index.js:14-26, 565-568`
- Test: `tests/test_note_branch_relay.py`

**Interfaces:**
- Consumes: `Authorization: Bearer <api_key>` header, `SettingsService.get_or_create_branch_api_key()`, `_apply_branch_relay_identity()`
- Produces: HTTP 200 on `/api/v1/kasir/notes` for branch relay calls.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_note_branch_relay.py
import pytest
from app import create_app, db
from app.services.settings.settings_service import SettingsService

@pytest.fixture
def client(app):
    return app.test_client()

def test_notes_api_accepts_bearer_branch_key(client, app):
    """Memastikan endpoint /api/v1/kasir/notes dapat diakses via Bearer API Key cabang tanpa session cookie."""
    with app.app_context():
        branch_key = SettingsService.get_or_create_branch_api_key()

    headers = {
        "Authorization": f"Bearer {branch_key}",
        "X-Operator-Username": "admin_remote",
        "X-Origin-Branch-Name": "Cabang Barat"
    }

    res = client.get('/api/v1/kasir/notes', headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "notes" in data

def test_notes_api_rejects_invalid_bearer_key(client):
    """Memastikan Bearer key palsu ditolak 403."""
    headers = {"Authorization": "Bearer invalid-wrong-key-xyz"}
    res = client.get('/api/v1/kasir/notes', headers=headers)
    assert res.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_note_branch_relay.py -v`
Expected: FAIL with 401 ("Akses Ditolak: Harap login terlebih dahulu")

- [ ] **Step 3: Implement Bearer auth validation in `app/routes/notes/note_routes.py`**

Perbarui fungsi `check_auth` pada `app/routes/notes/note_routes.py`:
```python
@notes_api_bp.before_request
def check_auth():
    # 1. Cek otentikasi via Bearer Token (Akses Lintas Cabang / Multi-Branch)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        from app.services.settings.settings_service import SettingsService
        from app.middleware.auth import _apply_branch_relay_identity
        import secrets
        local_key = SettingsService.get_or_create_branch_api_key()
        if local_key and secrets.compare_digest(token, local_key):
            _apply_branch_relay_identity()
            from flask import g
            if getattr(g, "is_branch_blocked", False):
                return jsonify({"success": False, "error": "Akses cabang ditolak: Cabang Anda telah diblokir."}), 403
            return None
        return jsonify({"success": False, "error": "Kunci API Cabang tidak valid"}), 403

    # 2. Cek session lokal kasir / admin
    if not is_authenticated():
        return jsonify({"success": False, "error": "Akses Ditolak: Harap login terlebih dahulu"}), 401
```

- [ ] **Step 4: Remove eager `loadNotes()` from `Catatan.init()` in `app/static/js/kasir/modules/catatan/index.js`**

Ubah `init()` pada `app/static/js/kasir/modules/catatan/index.js`:
```javascript
    async init() {
        // Keyboard shortcut global Ctrl+S saat berada di tab catatan
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                const tabCatatan = document.getElementById('tab-catatan');
                if (tabCatatan && !tabCatatan.classList.contains('hidden') && this.activeFilename) {
                    e.preventDefault();
                    this.saveCurrentNote(true);
                }
            }
        });
    },
```
Catatan hanya akan dimuat saat tab Catatan dibuka melalui `App.loadTab('catatan')`.

- [ ] **Step 5: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_note_branch_relay.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add app/routes/notes/note_routes.py app/static/js/kasir/modules/catatan/index.js tests/test_note_branch_relay.py
git commit -m "fix(notes): dukung Bearer API Key lintas cabang dan lazy-load catatan pada kasir panel"
```

---

### Task 4: Fix Page Refresh & Branch Disconnect Safeguard (Prevent Redirect Loop)

**Files:**
- Modify: `app/routes/dashboard/dashboard_routes.py:28-35`
- Modify: `app/static/js/kasir/core/api.js:41-58, 330-351`
- Test: `tests/test_branch_refresh_loop_prevention.py`

**Interfaces:**
- Consumes: `sessionStorage.getItem('active_branch_id')`, `session['active_branch_id']`
- Produces: Persistent branch context on reload without redirect loops.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_branch_refresh_loop_prevention.py
import pytest
from app import create_app, db
from app.models.branch import Branch
from app.models import User

@pytest.fixture
def client(app):
    return app.test_client()

def test_dashboard_does_not_nuke_active_branch_session_on_refresh(client, admin_user):
    """Memastikan route dashboard '/' tidak menghapus active_branch_id dari session saat refresh."""
    branch = Branch(nama="Cabang Timur", url="http://192.168.30.10:7015", api_key="secret-key-456", aktif=True)
    db.session.add(branch)
    db.session.commit()

    with client.session_transaction() as sess:
        sess['kasir_id'] = admin_user.id
        sess['kasir_username'] = admin_user.username
        sess['kasir_role'] = 'admin'
        sess['active_branch_id'] = branch.id
        sess['active_branch_name'] = branch.nama

    res = client.get('/kasir/')
    assert res.status_code == 200

    # Verifikasi bahwa session active_branch_id tidak di-pop secara destruktif
    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') == branch.id
        assert sess.get('active_branch_name') == branch.nama
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_refresh_loop_prevention.py -v`
Expected: FAIL (`assert None == branch.id`)

- [ ] **Step 3: Modify `dashboard_routes.py` to preserve active branch context**

Hapus `session.pop("active_branch_id", None)` dan `session.pop("active_branch_name", None)` di `app/routes/dashboard/dashboard_routes.py`:
```python
@dashboard_bp.route("/", methods=["GET"])
@login_required_html
def dashboard():
    """Halaman utama dashboard monitoring PC kasir."""
    timezone = SettingsService.get("timezone", "Asia/Makassar")
    tz_label = get_tz_short_name(timezone)
    return render_template("kasir/index.html", user_timezone=timezone, user_timezone_label=tz_label)
```

- [ ] **Step 4: Update `API.request` and `sessionInterval` in `app/static/js/kasir/core/api.js`**

1. Pada `API.request` (baris 41-58), tangani status 401/403 saat berada di cabang remote agar tidak redirect ke login lokal:
```javascript
            if (!res.ok) {
                // Jika cabang remote offline, jangan redirect login, tapi beri peringatan & failover
                if (data && data.is_branch_offline) {
                    if (window.Toast) {
                        window.Toast.show(data.error || "Cabang sedang offline", "error");
                    }
                    if (window.BranchManager && typeof window.BranchManager.handleActiveBranchDisconnect === 'function') {
                        window.BranchManager.handleActiveBranchDisconnect();
                    }
                    return data;
                }
                // Jika request cabang remote ditolak (401/403 misal kunci API cabang berubah/tidak valid),
                // JANGAN tendang session kasir lokal ke login! Lakukan failover kembali ke Cabang Lokal.
                if ((res.status === 401 || res.status === 403) && activeBranchId && activeBranchId !== '0') {
                    if (window.Toast) {
                        window.Toast.show(data?.error || `Otentikasi ke cabang remote ditolak (HTTP ${res.status}). Kembali ke Cabang Lokal.`, "error");
                    }
                    if (window.BranchManager && typeof window.BranchManager.handleActiveBranchDisconnect === 'function') {
                        window.BranchManager.handleActiveBranchDisconnect();
                    }
                    return data;
                }
                // Session kasir lokal expired atau IP block — redirect ke login (kecuali endpoint auth)
                if ((res.status === 401 || res.status === 403) && !url.includes('/api/v1/kasir/auth/login') && !url.includes('/api/v1/kasir/auth/check')) {
                    window.location.href = '/kasir/login';
                    return;
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }
```

2. Pada background `sessionInterval` (baris 346-348), hapus redirect paksa pada `xhr.onerror`:
```javascript
        xhr.onerror = function () {
            // Hindari redirect ke login saat request dibatalkan browser pada proses reload/refresh
            console.warn('[Session Polling] Jaringan terputus sementara atau request dibatalkan.');
        };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_branch_refresh_loop_prevention.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/routes/dashboard/dashboard_routes.py app/static/js/kasir/core/api.js tests/test_branch_refresh_loop_prevention.py
git commit -m "fix(branch): cegah redirect loop saat refresh tab cabang dan amankan penanganan error 401 remote"
```

---

### Task 5: Full Regression Test Suite & Verification (Version Fixed at v1.6.0)

**Files:**
- Verify: `app/__init__.py`
- Verify: `config.py`
- Verify: `tests/`

- [ ] **Step 1: Verify version consistency**

Pastikan versi aplikasi tetap `1.6.0` tanpa perubahan versi.
Jalankan:
```powershell
.\.venv\Scripts\python.exe -c "import config; print('Config Version:', config.Config.APP_VERSION)"
```
Expected: `Config Version: 1.6.0`

- [ ] **Step 2: Run complete test suite**

Run: `.\.venv\Scripts\python.exe -m pytest -v`
Expected: Semua pengujian (94 existing + test baru) PASS 100% tanpa error.

- [ ] **Step 3: Verification commit (if needed)**

```bash
git status
```
astikan working tree clean.

---

## Self-Review Checklist
1. **Spec coverage:**
   - Screenshot & QRIS 404 remote branch: Ditangani Task 1 (media proxy endpoint) & Task 2 (frontend media resolver).
   - Membuka Catatan redirect loop: Ditangani Task 3 (dukung Bearer token auth pada `note_routes.py` & hilangkan eager `loadNotes` di `DOMContentLoaded`).
   - Refresh tab di cabang membuat redirect loop: Ditangani Task 3 & Task 4 (jangan hapus session cabang di `dashboard()`, cegah remote 401 menendang session lokal, dan amankan `xhr.onerror`).
   - Versi tetap di `v1.6.0`: Ditangani Task 5 (verifikasi versi `1.6.0`).
2. **Placeholder scan:** Tidak ada TODO/TBD/placeholder. Semua potongan kode ditulis lengkap dan siap pakai.
3. **Type and interface consistency:** `API.resolveMediaUrl(url)` dan `/api/v1/kasir/branch/<int:branch_id>/media/<path:filename>` konsisten di seluruh tugas.

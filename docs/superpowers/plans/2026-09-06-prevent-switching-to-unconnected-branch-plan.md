# Pencegahan Pergantian Cabang Saat Cabang Tidak Terhubung (Offline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mencegah kasir/admin berpindah (switch) ke cabang remote yang sedang offline atau tidak dapat terhubung dengan pendekatan Just-In-Time Live Check saat cabang diklik, menjaga integritas sesi kontrol panel, serta memberikan umpan balik visual yang jelas di antarmuka pengguna (UI).

**Architecture:** 
- **Just-In-Time Live Handshake (Pilihan User):** Tidak menggunakan background polling looping yang membebani jaringan. Verifikasi koneksi dilakukan secara *on-demand* saat cabang diklik di dropdown navbar. Jika cabang masih offline, pergantian dibatalkan (state tidak berubah) dan diberi pesan penolakan. Jika cabang sudah hidup/terhubung kembali, sistem langsung beralih ke cabang tersebut secara instan.
- **Backend Gatekeeper:** Endpoint `/api/v1/kasir/branch/switch-context` melakukan verifikasi koneksi langsung (`BranchService.test_connection`) sebelum mengubah `session['active_branch_id']`. Jika koneksi gagal, perbarui status cabang di database menjadi `status_online = False` dan tolak permintaan dengan HTTP 400.
- **Frontend State Protection:** `BranchManager.switchBranch` diubah agar menunggu (`await`) verifikasi server sebelum mengubah state lokal (`activeBranchId`, `sessionStorage`) dan memuat ulang modul. Jika gagal, batalkan perpindahan cabang, pertahankan cabang aktif saat ini, dan perbarui badge visual status.
- **Failover Auto-Recovery:** Jika cabang remote yang sedang aktif tiba-tiba terputus saat request relay (`is_branch_offline`), sistem secara otomatis mengembalikan konteks ke Cabang Lokal dan memberi notifikasi ke pengguna.
- **Persistent Branch Test:** Endpoint dedicated `POST /api/v1/kasir/branch/<int:branch_id>/test` untuk memperbarui status dan latensi cabang ke database secara persisten saat tombol "Tes" ditekan.

**Tech Stack:** Python 3.14, Flask, Flask-SQLAlchemy, SQLite, Vanilla JavaScript (ES6+), Tailwind CSS, Pytest.

---

## Global Constraints
- Bahasa antarmuka dan pesan kesalahan menggunakan Bahasa Indonesia.
- Jangan merusak data transaksi, member, billing, atau pengaturan cabang.
- Role kasir biasa tidak boleh memiliki akses terhadap pergantian cabang.
- Pengujian unit backend menggunakan pytest dengan mocking koneksi jaringan `requests`.

---

### Task 1: Backend Health Check Gatekeeper pada Endpoint Switch Context & Dedicated Test Endpoint

**Files:**
- Modify: `app/routes/branch/branch_routes.py:130-150,266-308`
- Test: `tests/test_branch_switch_connectivity.py`

**Interfaces:**
- Consumes: `BranchService.test_connection(url, api_key, timeout)`
- Produces: 
  - `POST /api/v1/kasir/branch/switch-context` (mengembalikan 200 jika online, 400 dengan `is_offline: True` jika koneksi gagal)
  - `POST /api/v1/kasir/branch/<int:branch_id>/test` (menguji koneksi dan menyimpan status ke database)

- [ ] **Step 1: Write failing tests for switch context and branch test endpoints**

Create `tests/test_branch_switch_connectivity.py`:
```python
# tests/test_branch_switch_connectivity.py
import pytest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db, User
from app.models.branch import Branch
import requests

@pytest.fixture
def test_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch_online = Branch(
            nama="Cabang Sukses",
            url="https://branch1.test.id",
            api_key="tmb_key_1",
            aktif=True,
            status_online=True
        )
        branch_offline = Branch(
            nama="Cabang Rusak",
            url="https://branch2.test.id",
            api_key="tmb_key_2",
            aktif=True,
            status_online=False
        )
        db.session.add_all([branch_online, branch_offline])
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'

        yield client, branch_online.id, branch_offline.id
        db.session.remove()
        db.drop_all()

def test_switch_to_local_branch_always_succeeds(test_client):
    client, b_online_id, _ = test_client
    with client.session_transaction() as sess:
        sess['active_branch_id'] = b_online_id
        sess['active_branch_name'] = "Cabang Sukses"

    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": 0})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["active_branch_id"] == 0
    assert data["data"]["is_remote"] is False

    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') is None

@patch('app.services.branch.branch_service.requests.get')
def test_switch_to_remote_branch_succeeds_when_online(mock_get, test_client):
    client, b_online_id, _ = test_client
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"warnet_title": "Cabang Sukses"}}
    mock_get.return_value = mock_resp

    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": b_online_id})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["active_branch_id"] == b_online_id
    assert data["data"]["branch_name"] == "Cabang Sukses"

    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') == b_online_id

@patch('app.services.branch.branch_service.requests.get', side_effect=requests.exceptions.ConnectTimeout)
def test_switch_to_remote_branch_rejected_when_offline(mock_get, test_client):
    client, _, b_offline_id = test_client
    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": b_offline_id})
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert data.get("is_offline") is True
    assert "tidak dapat terhubung" in data["error"].lower()

    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') is None

@patch('app.services.branch.branch_service.requests.get')
def test_dedicated_branch_test_endpoint_updates_db(mock_get, test_client):
    client, _, b_offline_id = test_client
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"warnet_title": "Cabang Pulih"}}
    mock_get.return_value = mock_resp

    res = client.post(f'/api/v1/kasir/branch/{b_offline_id}/test')
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["online"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_branch_switch_connectivity.py -v`
Expected: FAIL (endpoint belum memiliki verifikasi koneksi dan dedicated test belum ada).

- [ ] **Step 3: Implement backend changes in `app/routes/branch/branch_routes.py`**

1. Tambahkan endpoint `POST /<int:branch_id>/test`:
```python
@branch_api_bp.route("/<int:branch_id>/test", methods=["POST"])
@login_required
@admin_required
def test_saved_branch_connection(branch_id: int):
    """Menguji koneksi cabang yang tersimpan dan memperbarui status_online & latensi di database."""
    from app.models.branch import Branch
    from app.models import db, now_local
    branch = Branch.query.get(branch_id)
    if not branch:
        return jsonify({"success": False, "error": "Cabang tidak ditemukan"}), 404

    ok, result = BranchService.test_connection(url=branch.url, api_key=branch.api_key, timeout=4)
    try:
        branch.status_online = ok
        branch.terakhir_dicek = now_local()
        if ok and isinstance(result, dict) and "latency_ms" in result:
            branch.latensi_ms = result["latency_ms"]
        db.session.commit()
    except Exception:
        db.session.rollback()

    if not ok:
        err_detail = result if isinstance(result, str) else "Gagal terhubung ke cabang target"
        return jsonify({
            "success": False,
            "error": err_detail,
            "data": {"online": False}
        }), 400

    return jsonify({
        "success": True,
        "data": result
    }), 200
```

2. Perbarui endpoint `POST /switch-context`:
```python
@branch_api_bp.route("/switch-context", methods=["POST"])
@login_required
@admin_required
def switch_branch_context():
    """Mengubah konteks aktif cabang yang dikontrol di server session secara aman."""
    payload = request.get_json() or {}
    branch_id_raw = payload.get("branch_id", 0)
    try:
        branch_id = int(branch_id_raw)
    except (ValueError, TypeError):
        branch_id = 0

    if branch_id == 0:
        session.pop("active_branch_id", None)
        session.pop("active_branch_name", None)
        return jsonify({
            "success": True,
            "data": {
                "active_branch_id": 0,
                "is_remote": False,
                "branch_name": "Cabang Lokal"
            }
        }), 200

    from app.models.branch import Branch
    from app.models import db, now_local
    branch = Branch.query.get(branch_id)
    if not branch or not branch.aktif:
        return jsonify({
            "success": False,
            "error": "Cabang target tidak ditemukan atau tidak aktif"
        }), 404

    # Pengecekan koneksi langsung (Health-Check Verification) sebelum izinkan switch
    ok, test_res = BranchService.test_connection(url=branch.url, api_key=branch.api_key, timeout=4)
    try:
        branch.status_online = ok
        branch.terakhir_dicek = now_local()
        if ok and isinstance(test_res, dict) and "latency_ms" in test_res:
            branch.latensi_ms = test_res["latency_ms"]
        db.session.commit()
    except Exception:
        db.session.rollback()

    if not ok:
        err_detail = test_res if isinstance(test_res, str) else "Server cabang offline atau tidak dapat dijangkau"
        return jsonify({
            "success": False,
            "is_offline": True,
            "error": f"Cabang '{branch.nama}' tidak dapat terhubung ({err_detail}). Tidak dapat beralih ke cabang ini."
        }), 400

    session["active_branch_id"] = branch.id
    session["active_branch_name"] = branch.nama
    return jsonify({
        "success": True,
        "data": {
            "active_branch_id": branch.id,
            "is_remote": True,
            "branch_name": branch.nama
        }
    }), 200
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_branch_switch_connectivity.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Run existing branch tests to guarantee no regression**

Run: `.venv\Scripts\python.exe -m pytest tests/test_branch_management_api.py tests/test_branch_proxy_relay.py -v`
Expected: PASS.

---

### Task 2: Frontend API Client Extension & Auto-Recovery saat Cabang Offline

**Files:**
- Modify: `app/static/js/kasir/core/api.js:41-49,308-320`

**Interfaces:**
- Consumes: `API.request`, `window.BranchManager.handleActiveBranchDisconnect`
- Produces: `API.branch.testBranch(branchId)`

- [ ] **Step 1: Tambahkan method `testBranch` di `API.branch`**
Di `app/static/js/kasir/core/api.js`:
```javascript
testBranch: (id) => API.request(`/api/v1/kasir/branch/${id}/test`, { method: 'POST' }),
```

- [ ] **Step 2: Tambahkan pemicu auto-recovery jika cabang offline saat request berlangsung**
Di `app/static/js/kasir/core/api.js` (lines 41-48):
```javascript
if (data && data.is_branch_offline) {
    if (window.Toast) {
        window.Toast.show(data.error || "Cabang sedang offline", "error");
    }
    if (window.BranchManager && typeof window.BranchManager.handleActiveBranchDisconnect === 'function') {
        window.BranchManager.handleActiveBranchDisconnect();
    }
    return data;
}
```

---

### Task 3: Refactoring Switcher di Frontend (`branch/index.js`)

**Files:**
- Modify: `app/static/js/kasir/modules/branch/index.js:104-160,288-370,764-796`

**Interfaces:**
- Consumes: `API.branch.switchContext`, `API.branch.testBranch`
- Produces: 
  - `BranchManager.switchBranch(branchId)` yang aman dan memverifikasi koneksi (Just-In-Time)
  - `BranchManager.renderNavbarDropdown()` dengan indikator status Offline yang jelas
  - `BranchManager.testExistingBranch(branchId)` yang menggunakan endpoint `/test` persisten
  - `BranchManager.handleActiveBranchDisconnect()` untuk graceful failover ke Cabang Lokal

- [ ] **Step 1: Modifikasi `renderNavbarDropdown` agar menampilkan badge Offline dan status visual yang akurat**
Setiap cabang offline menampilkan titik merah dan label kecil `Offline` berserta title tooltip informatif: `"Cabang offline - Klik untuk mencoba tes koneksi dan beralih"`.

- [ ] **Step 2: Refactor `switchBranch(branchId)` dengan proteksi state (Just-In-Time Live Check)**
1. Jangan langsung mengubah `this.activeBranchId` dan `sessionStorage`.
2. Jika beralih ke cabang remote (ID != 0):
   - Tampilkan loading pada tombol dropdown (`animate-ping` / spinner kecil) dan Toast info `Menguji koneksi ke [Cabang]...`.
   - Lakukan `await API.branch.switchContext(branchId)`.
   - Jika response gagal:
     - Jangan ubah `this.activeBranchId` dan `sessionStorage` (state tetap tidak berubah).
     - Tandai `targetBranch.status_online = false`.
     - Tampilkan Toast error dari backend.
     - Render ulang dropdown (titik merah).
     - Hentikan proses tanpa me-refresh modul dashboard.
   - Jika response sukses (sudah kembali connect):
     - Ubah `this.activeBranchId = String(branchId)`.
     - Simpan ke `sessionStorage`.
     - Update UI, banner, sidebar, dan muat ulang modul dashboard.
     - Tampilkan Toast sukses.

- [ ] **Step 3: Perbarui `testExistingBranch(branchId)` agar menggunakan `API.branch.testBranch(branchId)`**
Menghubungi endpoint dedicated sehingga status `status_online` dan latensi tersimpan persisten di database.

- [ ] **Step 4: Implementasikan `handleActiveBranchDisconnect()`**
Jika cabang aktif terputus saat request relay:
1. Tandai cabang tersebut `status_online = false`.
2. Tampilkan Toast warning: `Koneksi ke cabang '${this.activeBranchName}' terputus. Mengembalikan kontrol panel ke Cabang Lokal...`.
3. Panggil `this.switchBranch('0')` untuk memulihkan kontrol panel.

---

### Task 4: Verifikasi Menyeluruh & Testing

**Files:**
- Run automated test suite: `tests/test_branch_switch_connectivity.py` dan seluruh file test branch lainnya.

- [ ] **Step 1: Jalankan seluruh test unit branch**
Run: `.venv\Scripts\python.exe -m pytest tests/test_branch*.py -v`
Expected: Seluruh test pass 100%.

- [ ] **Step 2: Validasi skenario manual**
1. Switch ke Cabang Lokal: Sukses tanpa delay.
2. Switch ke Cabang Remote yang Online: Tes koneksi lolos, berpindah ke remote, data termuat.
3. Switch ke Cabang Remote yang URL-nya mati / offline: Muncul toast "Menguji koneksi...", koneksi gagal, muncul toast error "Cabang [Nama] tidak dapat terhubung...", state tetap di cabang sebelumnya (tidak berubah), titik status cabang menjadi merah dengan badge "Offline".
4. Tombol "Tes" di Pengaturan Multi-Cabang: Memperbarui status database secara langsung.

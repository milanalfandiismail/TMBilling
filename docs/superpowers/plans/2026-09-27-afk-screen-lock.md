# Fitur Kunci Meja AFK / Istirahat (Temporary AFK Screen Lock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan fitur penguncian layar sementara (AFK / Istirahat) pada PC klien warnet dan kasir, lengkap dengan proteksi keyboard hook, autentikasi unlock (password member / PIN guest), kontrol remote kasir dari Detail Modal, serta 100% backward compatibility melalui auto-migration database.

**Architecture:** Arsitektur end-to-end terintegrasi yang menghubungkan database SQLite/MySQL (kolom baru pada `Sesi`), API Client & Kasir Remote, sinkronisasi polling real-time, window & keyboard hook control di Tauri/Rust, antarmuka layar AFK hitam polos minimalis di Webview Klien, dan pemantauan serta kontrol di Dashboard Kasir.

**Tech Stack:** Python 3.14, Flask, Flask-SQLAlchemy, Werkzeug Security, Rust (Tauri v2), Vanilla JS/HTML/Tailwind CSS, Pytest.

**Spec:** [`docs/superpowers/specs/2026-09-27-afk-screen-lock-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-09-27-afk-screen-lock-design.md)

## Global Constraints

- **Python Environment**: `.\.venv\Scripts\python`
- **Testing Standard**: Test Driven Development (TDD) — setiap task memiliki unit/integration test mandiri dan seluruh suite pengujian pytest harus 100% pass (`240+ passed`).
- **Backward Compatibility**: Wajib menyertakan *Self-Healing Auto-Migration* di `app/__init__.py` dan `app/routes/settings/migration_routes.py` agar database lama langsung ter-upgrade tanpa crash saat pembaruan lewat tab *Migrasi & Update*.
- **Client Security**: Validasi `X-Client-Key` dengan `hmac.compare_digest` pada semua endpoint publik client.
- **Client AFK Design**: Layar AFK (`#afk-screen`) wajib bertema **hitam polos** (`bg-black`, `#000000`) minimalis, clean, dengan font mono countdown timer.
- **Kasir UI Constraint**: Tombol kontrol AFK (Kunci & Buka Kunci) hanya ditempatkan di dalam **Detail Modal PC** (bukan di context menu).

---

### Task 1: Database Model & Self-Healing Migration (100% Backward Compatible)

**Files:**
- Modify: `app/models/sesi/sesi.py:75-90`
- Modify: `app/models/sesi/sesi.py:195-225`
- Modify: `app/models/pc/pc.py:105-125`
- Modify: `app/__init__.py:325-345`
- Modify: `app/routes/settings/migration_routes.py:255-275`
- Test: `tests/test_afk_model_and_migration.py`

**Interfaces:**
- Consumes: SQLAlchemy `db.Model`, `inspect`, `text`
- Produces: `sesi.is_afk` (`bool`), `sesi.afk_pin` (`str`), `sesi.afk_sejak` (`datetime`), `sesi.to_dict()['is_afk']`, `pc.to_dict()['is_afk']`

- [x] **Step 1: Write the failing test**

```python
# tests/test_afk_model_and_migration.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, Member, Grup, now_local
from sqlalchemy import inspect, text

def test_sesi_afk_fields_and_dict_serialization():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="Reguler", harga_per_jam=5000, warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC01", nama="PC 01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        sesi = Sesi(
            tipe="guest",
            pc_id=pc.id,
            nama_guest="Guest01",
            durasi_beli_menit=60,
            status="aktif",
            is_afk=True,
            afk_pin="hashed_pin_1234",
            afk_sejak=now_local()
        )
        db.session.add(sesi)
        db.session.commit()

        # Verifikasi field dan serialisasi
        sesi_dict = sesi.to_dict()
        assert sesi_dict["is_afk"] is True
        assert sesi_dict["afk_sejak"] is not None

        pc_dict = pc.to_dict()
        assert pc_dict.get("is_afk") is True

def test_self_healing_auto_migration_for_afk_columns():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("sesi")]
        assert "is_afk" in cols
        assert "afk_pin" in cols
        assert "afk_sejak" in cols
```

- [x] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_afk_model_and_migration.py -v`  
Expected: FAIL (AttributeError / KeyError: 'is_afk')

- [x] **Step 3: Implement minimal changes to `Sesi`, `PC`, `app/__init__.py`, and `migration_routes.py`**

Di `app/models/sesi/sesi.py`:
```python
    is_afk = db.Column(db.Boolean, default=False, nullable=False)
    afk_pin = db.Column(db.String(100), nullable=True)
    afk_sejak = db.Column(db.DateTime, nullable=True)
```
Update `Sesi.to_dict()`:
```python
    "is_afk": self.is_afk or False,
    "afk_sejak": format_display(self.afk_sejak) if self.afk_sejak else None,
```
Update `PC.to_dict()`:
```python
    "is_afk": s.is_afk if s else False,
```
Di `app/__init__.py` pada `_init_app_context`:
```python
    # Auto-migration v1.6.2: Sesi AFK columns
    if inspector.has_table('sesi'):
        sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
        with db.engine.connect() as conn:
            if 'is_afk' not in sesi_cols:
                conn.execute(text("ALTER TABLE sesi ADD COLUMN is_afk BOOLEAN DEFAULT 0"))
            if 'afk_pin' not in sesi_cols:
                conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_pin VARCHAR(100)"))
            if 'afk_sejak' not in sesi_cols:
                conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_sejak DATETIME"))
            conn.commit()
```
Di `app/routes/settings/migration_routes.py` pada `upload_update`:
Tambahkan pengecekan kolom `is_afk`, `afk_pin`, `afk_sejak` di safety net inspection.

- [x] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_afk_model_and_migration.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/models/sesi/sesi.py app/models/pc/pc.py app/__init__.py app/routes/settings/migration_routes.py tests/test_afk_model_and_migration.py
git commit -m "feat(db, migration): tambahkan kolom is_afk, afk_pin, afk_sejak pada sesi dengan auto-migration backward compatible"
```

---

### Task 2: Backend Client AFK Service & Endpoints (`afk-lock`, `afk-unlock`, Polling)

**Files:**
- Modify: `app/services/client/client_service.py`
- Modify: `app/routes/client/client_routes.py`
- Test: `tests/test_client_afk_routes.py`

**Interfaces:**
- Consumes: `ClientService`, `SesiRepository`, `PCRepository`, `werkzeug.security.generate_password_hash`, `check_password_hash`
- Produces:
  - `ClientService.afk_lock(ip, mac, pin=None)` -> `dict`
  - `ClientService.afk_unlock(ip, mac, credential)` -> `dict`
  - Endpoint `POST /api/v1/public/client/afk-lock`
  - Endpoint `POST /api/v1/public/client/afk-unlock`
  - Respon polling `get_status` menyertakan `"is_afk"`

- [x] **Step 1: Write the failing test**

```python
# tests/test_client_afk_routes.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, Member, Grup, now_local

@pytest.fixture
def client_app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "CLIENT_API_KEY": "test-key-123"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="Reguler", harga_per_jam=5000, warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        yield app

def test_guest_afk_lock_and_unlock(client_app):
    with client_app.test_client() as c:
        with client_app.app_context():
            pc = PC.query.filter_by(kode="PC01").first()
            sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Budi", durasi_beli_menit=60, status="aktif")
            db.session.add(sesi)
            db.session.commit()

        headers = {"X-Client-Key": "test-key-123"}

        # 1. Kunci Meja dengan PIN 1234
        res = c.post("/api/v1/public/client/afk-lock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "pin": "1234"}, headers=headers)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc.id, status="aktif").first()
            assert saved_sesi.is_afk is True

        # 2. Polling status memuat is_afk
        res_poll = c.post("/api/v1/public/client/status", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
        assert res_poll.status_code == 200
        assert res_poll.get_json()["is_afk"] is True

        # 3. Unlock dengan PIN salah
        res_wrong = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "9999"}, headers=headers)
        assert res_wrong.status_code == 401

        # 4. Unlock dengan PIN benar
        res_ok = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "1234"}, headers=headers)
        assert res_ok.status_code == 200
        assert res_ok.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc.id, status="aktif").first()
            assert saved_sesi.is_afk is False

def test_member_afk_lock_and_unlock_with_password(client_app):
    with client_app.test_client() as c:
        with client_app.app_context():
            pc = PC.query.filter_by(kode="PC01").first()
            member = Member(username="gamer123", nama_lengkap="Pro Gamer", saldo=10000)
            member.set_password("rahasia123")
            db.session.add(member)
            db.session.commit()

            sesi = Sesi(tipe="member", pc_id=pc.id, member_id=member.id, status="aktif")
            db.session.add(sesi)
            db.session.commit()

        headers = {"X-Client-Key": "test-key-123"}

        # 1. Member langsung lock tanpa PIN
        res = c.post("/api/v1/public/client/afk-lock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc.id, status="aktif").first()
            assert saved_sesi.is_afk is True

        # 2. Member unlock dengan password salah
        res_wrong = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "passwordsalah"}, headers=headers)
        assert res_wrong.status_code == 401

        # 3. Member unlock dengan password benar
        res_ok = c.post("/api/v1/public/client/afk-unlock", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01", "credential": "rahasia123"}, headers=headers)
        assert res_ok.status_code == 200
        assert res_ok.get_json()["success"] is True

        with client_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc.id, status="aktif").first()
            assert saved_sesi.is_afk is False
```

- [x] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_client_afk_routes.py -v`  
Expected: FAIL (404 Not Found for `/afk-lock`)

- [x] **Step 3: Implement `afk_lock`, `afk_unlock`, and routes**

Di `app/services/client/client_service.py`:
- Tambahkan method `ClientService.afk_lock(ip_address, mac_address, pin=None)`
- Tambahkan method `ClientService.afk_unlock(ip_address, mac_address, credential)`
- Pada `ClientService.get_status()`: sertakan `"is_afk": sesi.is_afk if sesi else False` pada response dict.
Di `app/routes/client/client_routes.py`:
- Tambahkan `@client_api_bp.route("/afk-lock", methods=["POST"])`
- Tambahkan `@client_api_bp.route("/afk-unlock", methods=["POST"])`

- [x] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_client_afk_routes.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/services/client/client_service.py app/routes/client/client_routes.py tests/test_client_afk_routes.py
git commit -m "feat(client, api): implementasikan endpoint afk-lock, afk-unlock, dan integrasi polling status afk"
```

---

### Task 3: Backend Kasir Remote AFK Endpoints & Master Unlock

**Files:**
- Modify: `app/routes/monitor/monitor_routes.py:220-250`
- Test: `tests/test_kasir_remote_afk_routes.py`

**Interfaces:**
- Consumes: `@login_required`, `@admin_required`, `@shift_required`, `ClientService.queue_command`
- Produces:
  - `POST /api/v1/kasir/monitor/remote/<pc_id>/afk-lock`
  - `POST /api/v1/kasir/monitor/remote/<pc_id>/afk-unlock`

- [x] **Step 1: Write the failing test**

```python
# tests/test_kasir_remote_afk_routes.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Grup, ShiftRecord, now_local
from app.services.client.client_service import PENDING_COMMANDS

@pytest.fixture
def kasir_app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", "WTF_CSRF_ENABLED": False})
    with app.app_context():
        db.create_all()
        admin = User(username="kasir1", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)
        grup = Grup(nama="Reguler", harga_per_jam=5000, warna="#888888")
        db.session.add(grup)
        db.session.commit()

        shift = ShiftRecord(user_id=admin.id, saldo_awal=50000, waktu_mulai=now_local())
        db.session.add(shift)
        pc = PC(kode="PC02", nama="PC 02", ip_address="192.168.1.102", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Doni", durasi_beli_menit=60, status="aktif")
        db.session.add(sesi)
        db.session.commit()
        yield app

def test_kasir_remote_afk_lock_and_master_unlock(kasir_app):
    with kasir_app.test_client() as c:
        with c.session_transaction() as sess:
            sess["user_id"] = 1
            sess["role"] = "admin"
            sess["kasir_username"] = "kasir1"
            sess["shift_id"] = 1

        with kasir_app.app_context():
            pc = PC.query.filter_by(kode="PC02").first()
            pc_id = pc.id

        # 1. Kasir Remote Kunci Meja
        res_lock = c.post(f"/api/v1/kasir/monitor/remote/{pc_id}/afk-lock")
        assert res_lock.status_code == 200
        assert PENDING_COMMANDS.get(pc_id) == "afk_lock"

        with kasir_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is True

        # 2. Kasir Remote Master Unlock
        res_unlock = c.post(f"/api/v1/kasir/monitor/remote/{pc_id}/afk-unlock")
        assert res_unlock.status_code == 200
        assert PENDING_COMMANDS.get(pc_id) == "afk_unlock"

        with kasir_app.app_context():
            saved_sesi = Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()
            assert saved_sesi.is_afk is False
```

- [x] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_kasir_remote_afk_routes.py -v`  
Expected: FAIL (404 Not Found)

- [x] **Step 3: Implement remote endpoints in `monitor_routes.py`**

Di `app/routes/monitor/monitor_routes.py`:
```python
@monitor_kasir_bp.route("/remote/<int:pc_id>/afk-lock", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_afk_lock(pc_id):
    ...
@monitor_kasir_bp.route("/remote/<int:pc_id>/afk-unlock", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_afk_unlock(pc_id):
    ...
```

- [x] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_kasir_remote_afk_routes.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/routes/monitor/monitor_routes.py tests/test_kasir_remote_afk_routes.py
git commit -m "feat(kasir, remote): tambahkan endpoint remote afk-lock dan master afk-unlock dari kasir"
```

---

### Task 4: Kasir Dashboard UI (PC Card Badge & Detail Modal Actions)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`
- Test: `tests/test_afk_dashboard_integration.py`

**Interfaces:**
- Consumes: `pc_dict.is_afk`, `API.request('/api/v1/kasir/monitor/remote/' + pcId + '/afk-lock')`
- Produces:
  - Tampilan badge `🔒 AFK / Istirahat` (amber glowing) pada kartu grid PC ketika `pc.is_afk == true`.
  - Tombol aksi `🔒 Kunci Meja AFK` di Detail Modal PC saat sesi aktif normal.
  - Tombol aksi `🔓 Buka Kunci AFK (Master Unlock)` di Detail Modal PC saat status sedang AFK.

- [x] **Step 1: Write verification test for dashboard data payload**

```python
# tests/test_afk_dashboard_integration.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Grup, now_local
from app.services.dashboard.dashboard_service import DashboardService

def test_dashboard_service_delivers_afk_state():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="Reguler", harga_per_jam=5000, warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC03", nama="PC 03", ip_address="192.168.1.103", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Rudi", durasi_beli_menit=60, status="aktif", is_afk=True)
        db.session.add(sesi)
        db.session.commit()

        data = DashboardService.get_pc_list()
        pc_found = next(p for p in data["pc_list"] if p["kode"] == "PC03")
        assert pc_found["is_afk"] is True
        assert pc_found["sesi_detail"]["is_afk"] is True
```

- [x] **Step 2: Run test to verify it passes backend contract**

Run: `.\.venv\Scripts\python -m pytest tests/test_afk_dashboard_integration.py -v`  
Expected: PASS

- [x] **Step 3: Update `index.js` and `dashboard_detail_modal.js`**

Di `app/static/js/kasir/modules/dashboard/index.js`:
- Saat merender kartu PC: **Tetap tampilkan seluruh info lengkap seperti biasa** (nama member/guest, sisa waktu real-time, grup, zona).
- Jika `pc.is_afk === true`, ubah badge status kartu PC menjadi **`🔒 AFK / Istirahat`** dengan styling warna Amber / Kuning menyala (`text-amber-400`, `border-amber-500/50`, `bg-amber-500/10`).
Di `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`:
- Di dalam template render modal detail PC (hanya di Detail Modal, area tombol aksi remote):
  - Jika `pc.sesi_detail` ada:
    - Jika `pc.is_afk`: Tampilkan tombol `🔓 Buka Kunci AFK (Master Unlock)` yang memanggil `remoteAfkUnlock(pcId)`.
    - Jika tidak `pc.is_afk`: Tampilkan tombol `🔒 Kunci Meja AFK` yang memanggil `remoteAfkLock(pcId)`.

- [x] **Step 4: Verify test suite remains passing**

Run: `.\.venv\Scripts\python -m pytest tests/test_afk_dashboard_integration.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add app/static/js/kasir/modules/dashboard/index.js app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js tests/test_afk_dashboard_integration.py
git commit -m "feat(dashboard, ui): integrasikan badge afk pada kartu pc dan tombol kontrol afk di modal detail pc"
```

---

### Task 5: Client Tauri / Rust Command & Polling Handler

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/commands/window_commands.rs`
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/services/polling.rs`
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/main.rs`

**Interfaces:**
- Consumes: Tauri Window, `GLOBAL_HOOK_ENABLED`, `set_taskbar_visibility`
- Produces:
  - Command `switch_to_afk(window: Window, app_handle: AppHandle)`
  - Polling handler untuk `cmd == "afk_lock"` (emit `force-afk-lock`)
  - Polling handler untuk `cmd == "afk_unlock"` (emit `force-afk-unlock`)

- [x] **Step 1: Inspect and implement `switch_to_afk` in `window_commands.rs`**

```rust
#[tauri::command]
pub fn switch_to_afk(window: Window, _app_handle: AppHandle) {
    // 1. Kunci keyboard & sembunyikan taskbar
    GLOBAL_HOOK_ENABLED.store(true, Ordering::SeqCst);
    set_taskbar_visibility(false);

    let _ = window.set_decorations(false);
    let _ = window.set_resizable(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_fullscreen(true);
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}
```

- [x] **Step 2: Register command in `main.rs`**

Tambahkan `switch_to_afk` ke `invoke_handler![..., switch_to_afk]`.

- [x] **Step 3: Update `polling.rs` command parsing**

Di `WarnetAgent/TMBillingTauri/src-tauri/src/services/polling.rs`:
```rust
if let Some(cmd) = status.command {
    if cmd == "lock" || cmd == "logout" {
        let _ = app.emit_all("force-lock", ());
    } else if cmd == "afk_lock" {
        let _ = app.emit_all("force-afk-lock", ());
    } else if cmd == "afk_unlock" {
        let _ = app.emit_all("force-afk-unlock", ());
    } ...
```

- [x] **Step 4: Commit**

```bash
git add WarnetAgent/TMBillingTauri/src-tauri/src/commands/window_commands.rs WarnetAgent/TMBillingTauri/src-tauri/src/services/polling.rs WarnetAgent/TMBillingTauri/src-tauri/src/main.rs
git commit -m "feat(tauri, rust): tambahkan command switch_to_afk dan penanganan remote afk lock/unlock pada polling service"
```

---

### Task 6: Client Webview UI (Overlay Button, Lock Modal, Pure Black AFK Screen)

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src/overlay.html`
- Modify: `WarnetAgent/TMBillingTauri/src/overlay/overlay.js`
- Modify: `WarnetAgent/TMBillingTauri/src/index.html`
- Modify: `WarnetAgent/TMBillingTauri/src/main.js`
- Modify: `WarnetAgent/TMBillingTauri/src/shared/api.js`

**Interfaces:**
- Consumes: `Api.afkLock`, `Api.afkUnlock`, `Api.switchToAfk`, `Api.switchToOverlay`
- Produces:
  - Tombol `🔒 Kunci Meja (AFK)` di `#billing-overlay`
  - Modal set PIN (Guest) / konfirmasi (Member)
  - Layar `#afk-screen` (Hitam polos murni `#000000`, Header, Info PC & Sesi, Countdown timer, Form input unlock, Pesan bantuan)
  - Penanganan event `force-afk-lock` dan `force-afk-unlock`

- [x] **Step 1: Tambahkan elemen `#afk-screen` di `index.html`**

```html
<!-- 5. LAYAR KUNCI AFK / ISTIRAHAT (HITAM POLOS MINIMALIS) -->
<div id="afk-screen" class="hidden fixed inset-0 z-[500] w-full h-screen bg-black flex flex-col items-center justify-center p-6 select-none overflow-hidden text-white font-sans">
    <div class="w-full max-w-lg bg-[#0a0a0a] border border-[#222] rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        <!-- Header -->
        <div class="flex flex-col items-center space-y-2">
            <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-width="2"/>
                </svg>
            </div>
            <h1 class="text-xl lg:text-2xl font-black uppercase tracking-wider text-white">PC SEDANG DIKUNCI / ISTIRAHAT</h1>
            <p class="text-xs text-neutral-400 font-medium">Layar PC ini diamankan sementara oleh pengguna.</p>
        </div>

        <!-- Info PC & Pengguna -->
        <div class="w-full grid grid-cols-2 gap-3 bg-white/5 border border-white/5 rounded-2xl p-4 text-xs">
            <div class="text-left">
                <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Unit Meja</span>
                <p id="afk-pc-name" class="font-bold text-white text-sm pc-name-display">PC-01</p>
            </div>
            <div class="text-right">
                <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Pengguna</span>
                <p id="afk-user-name" class="font-bold text-accent text-sm">Member</p>
            </div>
        </div>

        <!-- Countdown Sisa Waktu -->
        <div class="space-y-1">
            <span class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Sisa Waktu Billing</span>
            <p id="afk-time-display" class="text-4xl lg:text-5xl font-mono font-black text-amber-400">00:00:00</p>
        </div>

        <!-- Form Unlock -->
        <div class="w-full space-y-3 pt-2">
            <input type="password" id="afk-unlock-input" placeholder="Masukkan Password Akun / PIN Kunci"
                class="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3.5 text-center text-sm outline-none focus:border-amber-400 focus:bg-[#161616] text-white tracking-widest">
            <div id="afk-error-msg" class="text-xs text-red-400 font-semibold hidden">Password akun atau PIN salah!</div>
            <button id="afk-unlock-btn" class="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all">Buka Kunci (Unlock)</button>
        </div>

        <!-- Pesan Bantuan Kasir -->
        <p class="text-[11px] text-neutral-500 font-medium leading-relaxed border-t border-[#1a1a1a] pt-4">
            ⚠️ Lupa PIN / Password? Silakan hubungi kasir atau operator warnet untuk membuka kunci meja ini.
        </p>
    </div>
</div>
```

- [x] **Step 2: Tambahkan tombol kunci di `overlay.html` dan modal input PIN untuk Guest**

Di `WarnetAgent/TMBillingTauri/src/overlay.html`:
- Tambahkan tombol `btn-lock-afk` di panel overlay (`#billing-overlay`).
- Tambahkan modal `modal-afk-pin` (hanya dimunculkan untuk Guest guna memasukkan 4-6 digit PIN sementara).

- [x] **Step 3: Implementasikan fungsi di `api.js`, `overlay.js`, dan `main.js`**

- `api.js`: Tambahkan `afkLock(pin)`, `afkUnlock(credential)`, `switchToAfk()`.
- `overlay.js`:
  - Saat tombol `btn-lock-afk` diklik:
    - Jika sesi adalah **Member**: Langsung panggil `Api.afkLock(null)`, lalu `Api.switchToAfk()` tanpa form PIN.
    - Jika sesi adalah **Guest**: Buka modal `modal-afk-pin`, minta input 4-6 digit PIN angka, lalu kirim ke `Api.afkLock(pin)`.
- `main.js`:
  - Handle form input `#afk-unlock-input` & tombol `#afk-unlock-btn`.
  - Dengarkan event `time-update` untuk mengupdate `#afk-time-display`.
  - Dengarkan event `force-afk-lock` dan `force-afk-unlock`.

- [x] **Step 4: Commit**

```bash
git add WarnetAgent/TMBillingTauri/src/index.html WarnetAgent/TMBillingTauri/src/overlay.html WarnetAgent/TMBillingTauri/src/overlay/overlay.js WarnetAgent/TMBillingTauri/src/main.js WarnetAgent/TMBillingTauri/src/shared/api.js
git commit -m "feat(client, ui): implementasikan layar afk hitam polos minimalis, modal kunci meja di overlay, dan integrasi unlock"
```

---

### Task 7: Full E2E Integration Testing & Documentation Sync

**Files:**
- Modify: `docs/DOCUMENTATION.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Test: All suites (`pytest`)

- [x] **Step 1: Jalankan seluruh test suite pytest**

Run: `.\.venv\Scripts\python -m pytest -v`  
Expected: All tests PASS (`240+ passed`, zero failures).

- [x] **Step 2: Update dokumentasi sistem**

- Di `docs/DOCUMENTATION.md`: Dokumentasikan fitur Kunci Meja AFK / Istirahat, endpoint `/afk-lock`, `/afk-unlock`, dan proteksi hardware hook.
- Di `CHANGELOG.md`: Catat rilis fitur Kunci Meja AFK pada v1.6.2+.
- Di `README.md`: Tambahkan poin fitur AFK Screen Lock.

- [x] **Step 3: Commit dan Push**

```bash
git add docs/DOCUMENTATION.md README.md CHANGELOG.md
git commit -m "docs: dokumentasikan fitur kunci meja afk dan perbarui changelog"
git push origin v1.6.2
```

- [ ] **Step 4: Re-index codebase dengan `index_repository`**

Panggil tool `codebase-memory:index_repository` untuk memastikan pengetahuan graph terbarui dengan simbol baru.

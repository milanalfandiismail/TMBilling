# Kuota Bermain Kasir (Benefit Staf) & Serah Terima Shift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan benefit kuota bermain bulanan (misal 120 jam) untuk staf kasir yang dapat langsung login di PC client, sekaligus mengaktifkan dan menyempurnakan sistem serah terima shift kasir (handover & blind count) dengan struk thermal dan tab audit di Manajemen Staff.

**Architecture:** Model `User` diperluas dengan kuota menit bermain bulanan dan auto-reset setiap tanggal 1. Model `Sesi` mendukung `tipe="kasir"` dengan relasi `user_id`. `AuthService.login` mendeteksi akun kasir saat login di PC client dengan isolasi penuh dari laporan omset billing. `ShiftService` diperbaiki batas query dan disempurnakan dengan catatan handover serta cetak struk. Menu Manajemen Staff dipecah menjadi 3 sub-menu: Akun Kasir, Riwayat Shift, dan Log Audit Staf.

**Tech Stack:** Python 3.14, Flask, SQLAlchemy, SQLite (dengan auto-migration idempotent), Vanilla JS, Tailwind CSS, Pytest.

**Spec:** [docs/superpowers/specs/2026-09-24-kasir-benefit-dan-serah-terima-shift-design.md](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-09-24-kasir-benefit-dan-serah-terima-shift-design.md)

## Global Constraints
- **Bahasa**: Seluruh pesan error, notifikasi, dan label antarmuka wajib dalam Bahasa Indonesia yang ramah pengguna.
- **Kompatibilitas Client**: Respons endpoint `/api/v1/public/auth/login` dan `/status` harus sepenuhnya kompatibel dengan aplikasi Client C# dan Tauri tanpa perlu mengubah source code client C#.
- **Zero Regression**: 211 test unit eksisting harus tetap 100% lulus (hijau).
- **Isolasi Finansial**: Sesi bermain kasir (benefit) berstatus Rp 0 dan TIDAK BOLEH masuk ke dalam laporan omset tunai/QRIS maupun pendapatan billing.

---

### Task 1: Database Model Extensions & Auto-Migration

**Files:**
- Modify: `app/models/user/user.py`
- Modify: `app/models/sesi/sesi.py`
- Modify: `app/models/shift/shift_record.py`
- Modify: `app/__init__.py`
- Test: `tests/test_kasir_benefit_models.py`

**Interfaces:**
- Consumes: `db.Model`, `now_local()`
- Produces: `User.kuota_main_bulanan`, `User.sisa_kuota_menit`, `User.terakhir_reset_kuota`, `User.cek_dan_reset_kuota_bulanan()`, `User.tambah_kuota_bonus()`, `Sesi.user_id`, `ShiftRecord.catatan`, `ShiftRecord.total_qris`, `ShiftRecord.total_refund`

- [ ] **Step 1: Write the failing test for User, Sesi, and ShiftRecord extensions**

```python
# tests/test_kasir_benefit_models.py
import pytest
from app import create_app, db
from app.models import User, Sesi, PC, Grup, ShiftRecord
from datetime import datetime

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_user_benefit_fields_and_methods(app_ctx):
    kasir = User(username="kasir_test", role="kasir")
    kasir.set_password("kasir123")
    kasir.kuota_main_bulanan = 7200 # 120 jam
    kasir.sisa_kuota_menit = 7200
    kasir.terakhir_reset_kuota = "2026-08"
    db.session.add(kasir)
    db.session.commit()

    # Test auto reset bulanan
    reset_terjadi = kasir.cek_dan_reset_kuota_bulanan()
    assert reset_terjadi is True
    assert kasir.sisa_kuota_menit == 7200
    assert kasir.terakhir_reset_kuota == datetime.now().strftime("%Y-%m")

    # Test tambah bonus jam
    kasir.tambah_kuota_bonus(300) # +5 jam
    assert kasir.sisa_kuota_menit == 7500
    assert kasir.kuota_main_bulanan == 7200 # kuota dasar tetap

def test_sesi_kasir_fields_and_calculations(app_ctx):
    grup = Grup(nama="Grup1", warna="#112233")
    db.session.add(grup)
    db.session.flush()
    pc = PC(kode="PC-01", grup_id=grup.id)
    kasir = User(username="kasir_sesi", role="kasir", kuota_main_bulanan=600, sisa_kuota_menit=600)
    kasir.set_password("kasir123")
    db.session.add_all([pc, kasir])
    db.session.commit()

    sesi = Sesi(
        tipe="kasir",
        user_id=kasir.id,
        pc_id=pc.id,
        status="aktif",
        waktu_tersimpan_awal=kasir.sisa_kuota_menit
    )
    db.session.add(sesi)
    db.session.commit()

    assert sesi.tipe == "kasir"
    assert sesi.user_id == kasir.id
    assert sesi.sisa_menit() == 600

def test_shift_record_catatan_and_qris_fields(app_ctx):
    kasir = User(username="kasir_shift", role="kasir")
    kasir.set_password("pass123")
    db.session.add(kasir)
    db.session.commit()

    shift = ShiftRecord(
        kasir_id=kasir.id,
        modal_awal=50000,
        catatan="Serah terima lancar",
        total_qris=150000,
        total_refund=0
    )
    db.session.add(shift)
    db.session.commit()

    saved = ShiftRecord.query.get(shift.id)
    assert saved.catatan == "Serah terima lancar"
    assert saved.total_qris == 150000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_kasir_benefit_models.py`
Expected: FAIL (AttributeError: User has no attribute `kuota_main_bulanan`)

- [ ] **Step 3: Implement model changes and auto-migration**

Modify `app/models/user/user.py`:
- Add `kuota_main_bulanan`, `sisa_kuota_menit`, `terakhir_reset_kuota`
- Add `cek_dan_reset_kuota_bulanan()` and `tambah_kuota_bonus()`
- Update `to_dict()`

Modify `app/models/sesi/sesi.py`:
- Add `user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)`
- Add `user = db.relationship("User", backref=db.backref("sesi_kasir_list", lazy="dynamic"))`
- Update `sisa_menit()` to handle `self.tipe == "kasir"`

Modify `app/models/shift/shift_record.py`:
- Add `catatan = db.Column(db.String(255), nullable=True)`
- Add `total_qris = db.Column(db.Integer, default=0)`
- Add `total_refund = db.Column(db.Integer, default=0)`
- Update `to_dict()`

Modify `app/__init__.py`:
- Add SQLite idempotent column addition checking `PRAGMA table_info(user)`, `PRAGMA table_info(sesi)`, and `PRAGMA table_info(shift_record)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_kasir_benefit_models.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/ tests/test_kasir_benefit_models.py app/__init__.py
git commit -m "feat(models): tambahkan kolom benefit kuota kasir, tipe sesi kasir, dan catatan shift"
```

---

### Task 2: ShiftService Bugfix & Audit Query Enhancement

**Files:**
- Modify: `app/services/shift/shift_service.py:100-248`
- Test: `tests/test_shift_service_robustness.py`

**Interfaces:**
- Consumes: `ShiftRecord`, `Transaksi`, `TransaksiMenu`, `User`
- Produces: `ShiftService.get_shift_summary(shift_id)`, `ShiftService.end_shift(shift_id, uang_fisik, catatan, operator)`

- [ ] **Step 1: Write failing test for ShiftService query bounds & catatan**

```python
# tests/test_shift_service_robustness.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord, Transaksi, TransaksiMenu
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def shift_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_sh", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app, kasir
        db.session.remove()
        db.drop_all()

def test_shift_start_and_end_with_catatan(shift_ctx):
    app, kasir = shift_ctx
    shift = ShiftService.start_shift("kasir_sh", modal_awal=100000, operator="kasir_sh")
    assert shift.status == "AKTIF"
    assert shift.modal_awal == 100000

    # Tutup shift dengan catatan
    result = ShiftService.end_shift(shift.id, uang_fisik=150000, catatan="Ada selisih uang parkir", operator="kasir_sh")
    assert result["status"] == "SELESAI"
    assert result["catatan"] == "Ada selisih uang parkir"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_shift_service_robustness.py`
Expected: FAIL

- [ ] **Step 3: Implement ShiftService enhancements**

In `app/services/shift/shift_service.py`:
- In `get_shift_summary(shift_id)`:
  - If `shift.waktu_selesai`: filter transactions with `Transaksi.dibuat_pada.between(shift.waktu_mulai, shift.waktu_selesai)` and `TransaksiMenu.tanggal.between(shift.waktu_mulai, shift.waktu_selesai)`.
  - Record snapshot `shift.total_qris = breakdown.get("QRIS", 0) + breakdown.get("Transfer", 0) + breakdown.get("Transfer Bank", 0)`.
- In `end_shift(shift_id, uang_fisik, catatan=None, operator="system")`:
  - Validate and save `catatan`.
  - Save `shift.total_qris` and `shift.total_refund`.
  - Include `catatan` in return dictionary and in write_log detail.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_shift_service_robustness.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/shift/shift_service.py tests/test_shift_service_robustness.py
git commit -m "fix(shift): perbaiki batas query waktu_selesai dan tambahkan field catatan pada end_shift"
```

---

### Task 3: AuthService & Client PC Kasir Play Benefit Login

**Files:**
- Modify: `app/services/auth/auth_service.py:28-120`
- Modify: `app/services/client/client_service.py:65-98`
- Modify: `app/services/report/report_service.py`
- Test: `tests/test_kasir_pc_login_benefit.py`

**Interfaces:**
- Consumes: `AuthService.login()`, `AuthService.logout()`, `UserRepository`, `Sesi`
- Produces: `AuthService.login` recognizing kasir accounts, generating `tipe="kasir"` session, real-time quota deduction, isolating from report billing.

- [ ] **Step 1: Write failing test for kasir PC login and report isolation**

```python
# tests/test_kasir_pc_login_benefit.py
import pytest
from app import create_app, db
from app.models import User, PC, Grup, Sesi
from app.services.auth.auth_service import AuthService
from app.services.report.report_service import ReportService

@pytest.fixture
def auth_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="VIP", warna="#112233")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="PC-01", grup_id=grup.id, ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:11")
        kasir = User(username="kasir_gamer", role="kasir", kuota_main_bulanan=600, sisa_kuota_menit=600)
        kasir.set_password("pass123")
        db.session.add_all([pc, kasir])
        db.session.commit()
        yield app, pc, kasir
        db.session.remove()
        db.drop_all()

def test_kasir_pc_login_success(auth_ctx):
    app, pc, kasir = auth_ctx
    res = AuthService.login("kasir_gamer", "pass123", pc.ip_address, pc.mac_address)
    assert res["success"] is True
    assert res["waktu_tersimpan"] == 600
    assert res["grup"] == "Kasir Benefit"
    
    # Sesi harus bertipe kasir
    sesi = Sesi.query.filter_by(token_sesi=res["token_sesi"]).first()
    assert sesi.tipe == "kasir"
    assert sesi.user_id == kasir.id

def test_kasir_pc_login_fails_when_quota_exhausted(auth_ctx):
    app, pc, kasir = auth_ctx
    kasir.sisa_kuota_menit = 0
    db.session.commit()

    with pytest.raises(ValueError, match="Kuota bermain Anda bulan ini telah habis"):
        AuthService.login("kasir_gamer", "pass123", pc.ip_address, pc.mac_address)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_kasir_pc_login_benefit.py`
Expected: FAIL ("Username atau password salah")

- [ ] **Step 3: Implement Kasir Login in AuthService and Logout sync**

In `app/services/auth/auth_service.py`:
- In `login()`:
  - If `member` is not found, check `user = UserRepository.get_by_username(username)`.
  - If `user` found, verify `user.role == "kasir"`, `user.aktif`, and `user.check_password(password)`.
  - Run `user.cek_dan_reset_kuota_bulanan()`.
  - Check `user.sisa_kuota_menit > 0`. If 0: raise `ValueError("Kuota bermain Anda bulan ini telah habis (0 jam tersisa). Hubungi admin untuk penambahan kuota.")`.
  - Check if active session already exists for `user.id`.
  - Create `Sesi(tipe="kasir", user_id=user.id, pc_id=pc.id, status="aktif", token_sesi=secrets.token_hex(32), waktu_mulai_sesi=now_local(), waktu_tersimpan_awal=user.sisa_kuota_menit)`.
  - Return JSON format with `"waktu_tersimpan": user.sisa_kuota_menit`, `"grup": "Kasir Benefit"`.
- In `logout()`:
  - If `sesi.tipe == "kasir"`: calculate remaining minutes, update `user.sisa_kuota_menit = sesi.sisa_menit()`.
- In `ReportService`:
  - Ensure queries for billing revenue filter out `tipe == "kasir"` or `total_bayar == 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_kasir_pc_login_benefit.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/auth/auth_service.py app/services/client/client_service.py tests/test_kasir_pc_login_benefit.py
git commit -m "feat(auth): dukung login mandiri kasir di PC client dengan pemotongan kuota benefit"
```

---

### Task 4: User Service & Kasir Quota API Endpoints

**Files:**
- Modify: `app/services/user/user_service.py`
- Modify: `app/routes/user/user_routes.py`
- Test: `tests/test_user_quota_routes.py`

**Interfaces:**
- Consumes: `UserService`, `admin_required`
- Produces: `PUT /api/v1/kasir/user/<id>/kuota`, `POST /api/v1/kasir/user/<id>/tambah-kuota`, `GET /api/v1/kasir/user/logs`

- [ ] **Step 1: Write failing test for user quota endpoints**

```python
# tests/test_user_quota_routes.py
import pytest
from app import create_app, db
from app.models import User

@pytest.fixture
def client_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        admin = User(username="admin_boss", role="admin")
        admin.set_password("admin123")
        kasir = User(username="kasir_staff", role="kasir")
        kasir.set_password("kasir123")
        db.session.add_all([admin, kasir])
        db.session.commit()
        yield app.test_client(), admin.id, kasir.id
        db.session.remove()
        db.drop_all()

def test_admin_can_set_and_bonus_quota(client_ctx):
    client, admin_id, kasir_id = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_username"] = "admin_boss"
        sess["kasir_role"] = "admin"

    # Set kuota bulanan 120 jam (7200 menit)
    res = client.put(f"/api/v1/kasir/user/{kasir_id}/kuota", json={"kuota_jam": 120})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["kuota_main_bulanan"] == 7200

    # Tambah jam bonus 5 jam (300 menit)
    res2 = client.post(f"/api/v1/kasir/user/{kasir_id}/tambah-kuota", json={"jam_bonus": 5, "keterangan": "Bonus lembur"})
    assert res2.status_code == 200
    assert res2.get_json()["user"]["sisa_kuota_menit"] == 7500
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_user_quota_routes.py`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement UserService methods and routes**

In `app/services/user/user_service.py`:
- `set_kuota_bulanan(user_id, kuota_jam, operator="admin")`: Validates `kuota_jam` (0 s/d 720 jam/bulan), sets `user.kuota_main_bulanan = kuota_jam * 60`, logs `"SET_KUOTA_KASIR"`.
- `tambah_kuota_bonus(user_id, jam_bonus, keterangan="", operator="admin")`: Validates `jam_bonus` (1 s/d 100 jam), adds `jam_bonus * 60` to `user.sisa_kuota_menit`, logs `"BONUS_KUOTA_KASIR"`.
- `get_user_logs(limit=100, user_filter=None, dari=None, sampai=None)`: Queries user action logs from system log.

In `app/routes/user/user_routes.py`:
- Add `PUT /<int:user_id>/kuota`
- Add `POST /<int:user_id>/tambah-kuota`
- Add `GET /logs`

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_user_quota_routes.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/user/user_service.py app/routes/user/user_routes.py tests/test_user_quota_routes.py
git commit -m "feat(user): tambahkan endpoint set kuota bulanan, tambah jam bonus, dan log audit staf"
```

---

### Task 5: Shift Routes & Shift History API Endpoints

**Files:**
- Modify: `app/routes/shift/shift_routes.py`
- Test: `tests/test_shift_api_routes.py`

**Interfaces:**
- Consumes: `shift_api_bp`, `ShiftService`
- Produces: `POST /api/v1/kasir/shift/end` accepting `catatan`, `GET /api/v1/kasir/shift/history` with date filter

- [ ] **Step 1: Write failing test for shift API routes**

```python
# tests/test_shift_api_routes.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord

@pytest.fixture
def client_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_api", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app.test_client(), kasir.id
        db.session.remove()
        db.drop_all()

def test_shift_end_with_catatan_route(client_ctx):
    client, kasir_id = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir_id
        sess["kasir_username"] = "kasir_api"
        sess["kasir_role"] = "kasir"

    client.post("/api/v1/kasir/shift/start", json={"modal_awal": 50000})
    res = client.post("/api/v1/kasir/shift/end", json={"uang_fisik": 60000, "catatan": "Aman terkendali"})
    assert res.status_code == 200
    assert res.get_json()["result"]["catatan"] == "Aman terkendali"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_shift_api_routes.py`
Expected: FAIL

- [ ] **Step 3: Update shift_routes.py to handle catatan and history filters**

In `app/routes/shift/shift_routes.py`:
- `end_shift`: Pass `catatan=data.get("catatan")` to `ShiftService.end_shift`.
- `get_shift_history`: Add query params `dari`, `sampai`, `kasir_id`, `limit`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/test_shift_api_routes.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/shift/shift_routes.py tests/test_shift_api_routes.py
git commit -m "feat(shift): update endpoint end_shift dan get_shift_history dengan filter dan catatan"
```

---

### Task 6: Frontend Shift Module & Active Shift Widget

**Files:**
- Modify: `app/templates/kasir/base.html:358`
- Modify: `app/templates/kasir/components/sidebar.html:118-125`
- Modify: `app/static/js/kasir/modules/shift/index.js`

**Interfaces:**
- Consumes: `/api/v1/kasir/shift/active`, `/start`, `/end`
- Produces: Shift status widget in sidebar, Modal Buka Shift, Modal Tutup Shift (Blind Count + Catatan), Modal Hasil Shift, Cetak Struk 58mm

- [ ] **Step 1: Uncomment shift script in base.html**

In `app/templates/kasir/base.html`:
- Uncomment line 358: `<script src="{{ url_for('static', filename='js/kasir/modules/shift/index.js') }}?v={{ v_cache }}"></script>`.

- [ ] **Step 2: Add shift status widget container in sidebar.html above logout button**

In `app/templates/kasir/components/sidebar.html`:
- Inside the sidebar user footer (`border-t border-[#171717] bg-[#080808]`), place `<div id="shift-info" class="mb-2 w-full"></div>` directly between `#user-info` and the `App.logout()` button.
- Ensure the layout, buttons, and text inside `#shift-info` are fully responsive across breakpoints `sm`, `md`, `lg`, `xl`, and `2xl` without text clipping or horizontal overflow.

- [ ] **Step 3: Enhance shift/index.js with responsive UI, catatan field, and handover button**

In `app/static/js/kasir/modules/shift/index.js`:
- In `updateSidebarInfo()`:
  - If no active shift: render responsive button **`Buka Shift Kasir`** (full-width, amber accent, responsive text `text-[10px] lg:text-xs xl:text-xs 2xl:text-sm`).
  - If active shift: render compact status card with pulsing green indicator, start time, modal awal, and a prominent button **`Pertukaran / Serah Terima Shift`** located right above the Logout button.
- In `showTutupShiftModal()`: add textarea for `catatan-input` (Catatan Serah Terima Kasir, maks. 255 karakter).
- In `submitTutupShift()`: pass `catatan` to API payload.
- In `showHasilShift()`: display `catatan` if present.
- In `printHandover()`: print `catatan` on thermal receipt if present.
- Hook `Shift.load()` on document load.

- [ ] **Step 4: Verify syntax and build CSS**

Run: `npm run build:css`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add app/templates/kasir/base.html app/templates/kasir/components/sidebar.html app/static/js/kasir/modules/shift/index.js
git commit -m "feat(ui): aktifkan widget status shift di sidebar dan tambahkan input catatan serah terima"
```

---

### Task 7: Frontend Manajemen Staff & Riwayat Shift UI

**Files:**
- Modify: `app/templates/kasir/components/sidebar_admin.html:20-27`
- Modify: `app/templates/kasir/tabs/user.html`
- Create: `app/templates/kasir/tabs/shift_history.html`
- Create: `app/templates/kasir/tabs/user_logs.html`
- Modify: `app/static/js/kasir/modules/user/index.js`
- Modify: `app/templates/kasir/dashboard.html` (include new tab contents)

**Interfaces:**
- Consumes: `App.switchTab`, `API.user`, `API.shift`
- Produces: 3 sub-menus in Manajemen Staff, Quota management UI for kasir, Shift History tab with receipt re-print, Staff Audit Log tab

- [ ] **Step 1: Add sub-menus to sidebar_admin.html**

In `app/templates/kasir/components/sidebar_admin.html`:
- Under `staff-submenu`:
  - Item 1: `Akun Kasir & Admin` (`data-tab="user"`)
  - Item 2: `Riwayat Serah Terima` (`data-tab="shift_history"`)
  - Item 3: `Log & Audit Staff` (`data-tab="user_logs"`)

- [ ] **Step 2: Update user.html and user/index.js with Kuota Bulanan & Jam Bonus modal**

In `app/templates/kasir/tabs/user.html`:
- Add table columns: "Kuota Bulanan" and "Sisa Waktu Main".
- In action buttons for kasir: add "Atur Kuota" and "Tambah Jam Bonus".

In `app/static/js/kasir/modules/user/index.js`:
- Add `showSetKuotaModal(userId)`: modal input kuota bulanan dalam jam (misal 120 jam).
- Add `showBonusJamModal(userId)`: modal input jam bonus (misal +5 jam) dan catatan alasan.
- Add `submitSetKuota()` and `submitBonusJam()`.

- [ ] **Step 3: Create shift_history.html and user_logs.html tabs (Mengacu ke Tab Umum & Keamanan)**

Create `app/templates/kasir/tabs/shift_history.html`:
- Acuan desain: Tab **Umum & Keamanan** (`subtab-general`): Card container `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6`, header title uppercase tracking-wider, filter inputs `bg-[#050505] border border-[#1c1c1c]`.
- Date filter (Dari - Sampai), Kasir filter, table with shift details responsif untuk breakpoint `sm, md, lg, xl, 2xl`.
- Tombol **`Lihat Detail`**: Membuka popup modal digital lengkap berisi seluruh breakdown pendapatan, uang fisik, selisih, dan catatan di layar monitor (paperless, tanpa perlu cetak struk).
- Tombol **`Cetak Struk`**: Opsi cetak fisik thermal jika kasir/owner menginginkannya (`Shift.printHandover()`).

Create `app/templates/kasir/tabs/user_logs.html`:
- Acuan desain: Tab **Umum & Keamanan** (`subtab-general`), responsif untuk `sm, md, lg, xl, 2xl`.
- Filter date, Kasir filter, audit log table for staff actions (tambah jam bonus, reset kuota bulanan, sesi bermain PC kasir, edit profil, ganti password).
- Seluruh modal popup (Modal Set Kuota Kasir, Modal Jam Bonus, Modal Blind Count, Modal Detail Shift Digital) distandarisasi konsisten dengan modal eksisting (`Modal.show(...)`) dan responsif penuh di breakpoint `sm, md, lg, xl, 2xl`.

Include tabs in `app/templates/kasir/dashboard.html`.

- [ ] **Step 4: Verify CSS compilation**

Run: `npm run build:css`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add app/templates/kasir/ app/static/js/kasir/modules/user/
git commit -m "feat(ui): tambahkan sub-menu riwayat shift, log audit staf, dan modal kuota bermain kasir"
```

---

### Task 8: End-to-End Regression Verification & Codebase Memory Indexing

**Files:**
- Test: all test files in `tests/`

- [ ] **Step 1: Run full pytest suite**

Run: `$env:PYTHONPATH="."; .\.venv\Scripts\python -m pytest tests/`
Expected: 215+ passed, 0 failed

- [ ] **Step 2: Verify MCP codebase-memory indexing**

Call MCP `index_repository` on `C-Project-GIT-TMBilling`.
Expected: Fully indexed, status "indexed".

- [ ] **Step 3: Commit and update progress**

```bash
git commit --allow-empty -m "chore: verifikasi end-to-end seluruh test lulus 100% dan re-index codebase memory"
```

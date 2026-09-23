# Serah Terima Shift Dinamis & Proteksi Eksklusif Kasir (Anti-Fitnah) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan proteksi login kasir eksklusif (anti-fitnah/eksploitasi) di dashboard web, mewajibkan buka shift untuk transaksi kasir, emergency force close oleh admin, serta rekapitulasi serah terima shift dengan rincian seluruh metode pembayaran dinamis (Tunai vs Non-Tunai) dan penyelesaian UI Manajemen Staf.

**Architecture:** Model `ShiftRecord` diperluas dengan kolom snapshot `detail_metode_json`. `ShiftService` diperbarui untuk single active shift system-wide, grouping dinamis metode pembayaran (Tunai vs Non-Tunai), dan emergency force close. `AuthKasirService.login` memvalidasi shift aktif untuk menolak kasir lain selama shift berjalan (Opsi A) sementara kasir aktif bebas re-login tanpa batas waktu. Endpoint transaksi billing dan kantin memvalidasi keberadaan shift aktif khusus untuk role kasir. Frontend dashboard mengintegrasikan widget sidebar user (termasuk tombol Force Close untuk admin), modal rekap dinamis, dan tab Manajemen Staf.

**Tech Stack:** Python 3.14, Flask, SQLAlchemy, SQLite, Vanilla JS, Tailwind CSS, Pytest.

**Spec:** [docs/superpowers/specs/2026-09-24-shift-concurrency-dan-metode-pembayaran-dinamis-design.md](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-09-24-shift-concurrency-dan-metode-pembayaran-dinamis-design.md)

## Global Constraints
- **Bahasa**: Seluruh pesan error, notifikasi, dan label antarmuka wajib dalam Bahasa Indonesia yang ramah pengguna.
- **Validasi Input Ketat Berlapis Ganda (Dual-Layer FE & BE)**:
  - `modal_awal`: 0 s/d Rp 100.000.000 (integer)
  - `uang_fisik`: 0 s/d Rp 100.000.000 (integer)
  - `catatan`: Maks. 255 karakter string
  - `alasan_force_close`: Minimal 3 karakter, maksimal 255 karakter
  - Validasi FE: Atribut `min`, `max`, live formatting, dialog konfirmasi.
  - Validasi BE: Menggunakan utilitas `app.utils.validators` (`validate_integer_range`, `validate_string_length`), return `400 Bad Request`.
- **Zero Regression**: Seluruh 225 test unit eksisting harus tetap 100% lulus (hijau).
- **Isolasi Finansial**: Laci fisik kasir hanya menghitung metode Tunai/Cash; metode Non-Tunai (QRIS, Transfer, dll.) dipisahkan secara dinamis.
- **Konsistensi UI/UX**: Mengacu pada standar visual tab **Umum & Keamanan** (`settings.html`) dan responsif penuh di breakpoint `sm, md, lg, xl, 2xl`.

---

### Task 1: Database Model Extension (`detail_metode_json`) & Auto-Migration

**Files:**
- Modify: `app/models/shift/shift_record.py:20-67`
- Modify: `app/__init__.py:180-210`
- Modify: `app/routes/settings/migration_routes.py:220-250`
- Test: `tests/test_shift_model_detail_metode.py`

**Interfaces:**
- Consumes: `db.Model`, `inspect(db.engine)`
- Produces: `ShiftRecord.detail_metode_json`, `ShiftRecord.to_dict()["detail_metode"]`

- [ ] **Step 1: Write the failing test for detail_metode_json field and serialization**

```python
# tests/test_shift_model_detail_metode.py
import pytest
import json
from app import create_app, db
from app.models import User, ShiftRecord

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_dt", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app, kasir
        db.session.remove()
        db.drop_all()

def test_shift_record_detail_metode_json(app_ctx):
    app, kasir = app_ctx
    detail_data = {
        "tunai": {"billing": 50000, "kantin": 20000, "refund": 0, "total": 70000},
        "non_tunai": [
            {"method": "QRIS", "billing": 30000, "kantin": 10000, "total": 40000},
            {"method": "Transfer Bank", "billing": 25000, "kantin": 0, "total": 25000}
        ],
        "total_non_tunai": 65000
    }
    shift = ShiftRecord(
        kasir_id=kasir.id,
        modal_awal=100000,
        status="SELESAI",
        detail_metode_json=json.dumps(detail_data)
    )
    db.session.add(shift)
    db.session.commit()

    saved = ShiftRecord.query.get(shift.id)
    assert saved.detail_metode_json is not None
    loaded = json.loads(saved.detail_metode_json)
    assert loaded["tunai"]["total"] == 70000
    assert len(loaded["non_tunai"]) == 2

    # Verifikasi to_dict
    d = saved.to_dict()
    assert "detail_metode" in d
    assert d["detail_metode"]["total_non_tunai"] == 65000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_model_detail_metode.py -q`
Expected: FAIL with attribute error or missing field.

- [ ] **Step 3: Implement model changes and auto-migration**

In `app/models/shift/shift_record.py`:
- Add `detail_metode_json = db.Column(db.Text, nullable=True)`
- In `to_dict()`: parse `self.detail_metode_json` if present and return as dict in key `"detail_metode"`.

In `app/__init__.py`:
- In auto-migration loop, check if `detail_metode_json` column exists in `shift_record`. If not, execute `ALTER TABLE shift_record ADD COLUMN detail_metode_json TEXT`.

In `app/routes/settings/migration_routes.py`:
- In `upload_update` safety net sync, include `detail_metode_json` column check.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_model_detail_metode.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/shift/shift_record.py app/__init__.py app/routes/settings/migration_routes.py tests/test_shift_model_detail_metode.py
git commit -m "feat(shift): tambahkan kolom detail_metode_json dan auto-migration pada ShiftRecord"
```

---

### Task 2: Dynamic Multi-Payment Method Summary & Struk Thermal Breakdown

**Files:**
- Modify: `app/services/shift/shift_service.py:90-195,320-395`
- Test: `tests/test_shift_dynamic_payments.py`

**Interfaces:**
- Consumes: `Transaksi.metode_pembayaran`, `TransaksiMenu.metode_pembayaran`, `ShiftRecord`
- Produces: `ShiftService.get_shift_summary(shift_id)` with dynamic `breakdown_metode` and accurate cash drawer `total_seharusnya`, `ShiftService.generate_shift_receipt_text(shift_id)` with dynamic non-cash rows.

- [ ] **Step 1: Write the failing test for dynamic multi-payment breakdown**

```python
# tests/test_shift_dynamic_payments.py
import pytest
from datetime import datetime
from app import create_app, db
from app.models import User, ShiftRecord, Transaksi, TransaksiMenu
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def shift_multi_payment_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_pay", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app, kasir
        db.session.remove()
        db.drop_all()

def test_dynamic_payment_summary_calculation(shift_multi_payment_ctx):
    app, kasir = shift_multi_payment_ctx
    shift = ShiftService.start_shift("kasir_pay", modal_awal=100000, operator="kasir_pay")

    # Transaksi Billing: Tunai (50k), QRIS (30k), Transfer Bank (40k)
    t1 = Transaksi(user_id=kasir.id, total_biaya=50000, jumlah=50000, metode_pembayaran="Tunai", jenis="paket_personal", status="selesai")
    t2 = Transaksi(user_id=kasir.id, total_biaya=30000, jumlah=30000, metode_pembayaran="QRIS", jenis="paket_personal", status="selesai")
    t3 = Transaksi(user_id=kasir.id, total_biaya=40000, jumlah=40000, metode_pembayaran="Transfer Bank", jenis="paket_personal", status="selesai")
    
    # Transaksi Kantin: Tunai (20k), QRIS (15k), Debit BCA (25k)
    tm1 = TransaksiMenu(kasir_id=kasir.id, total_harga=20000, metode_pembayaran="Tunai", status="selesai")
    tm2 = TransaksiMenu(kasir_id=kasir.id, total_harga=15000, metode_pembayaran="QRIS", status="selesai")
    tm3 = TransaksiMenu(kasir_id=kasir.id, total_harga=25000, metode_pembayaran="Debit BCA", status="selesai")

    # Refund Tunai: 10k
    t_ref = Transaksi(user_id=kasir.id, total_biaya=10000, jumlah=10000, metode_pembayaran="Tunai", jenis="refund_paket", status="selesai")

    db.session.add_all([t1, t2, t3, tm1, tm2, tm3, t_ref])
    db.session.commit()

    summary = ShiftService.get_shift_summary(shift.id)

    # Verifikasi total tunai bersih: Billing Tunai (50k) + Kantin Tunai (20k) - Refund (10k) = 60k
    # Uang seharusnya di laci = modal awal (100k) + total tunai bersih (60k) = 160k
    assert summary["total_seharusnya"] == 160000

    # Verifikasi rincian non-tunai dinamis
    breakdown = summary["rincian_pembayaran"]
    assert breakdown["tunai"]["total"] == 60000
    
    non_tunai_map = {item["method"]: item["total"] for item in breakdown["non_tunai"]}
    assert non_tunai_map["QRIS"] == 45000  # 30k + 15k
    assert non_tunai_map["Transfer Bank"] == 40000
    assert non_tunai_map["Debit BCA"] == 25000

    # Tutup shift dengan blind count 160.000 (PAS)
    res = ShiftService.end_shift(shift.id, uang_fisik=160000, catatan="Lancar", operator="kasir_pay")
    assert res["selisih"] == 0

    # Verifikasi teks struk thermal 58mm
    receipt = ShiftService.generate_shift_receipt_text(shift.id)
    assert "QRIS" in receipt
    assert "Transfer Bank" in receipt
    assert "Debit BCA" in receipt
    assert "Uang Fisik Laci: Rp 160,000" in receipt
    assert "PAS" in receipt
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_dynamic_payments.py -q`
Expected: FAIL

- [ ] **Step 3: Implement dynamic multi-payment breakdown in ShiftService**

In `app/services/shift/shift_service.py`:
- In `get_shift_summary(shift_id)`:
  - Query all distinct payment methods from `Transaksi` and `TransaksiMenu`.
  - Group into `tunai_dict = {"billing": ..., "kantin": ..., "refund": ..., "total": ...}`
  - Group any non-cash method into list of `{"method": name, "billing": ..., "kantin": ..., "total": ...}`
  - Calculate `total_tunai_bersih = billing_tunai + kantin_tunai - total_refund`.
  - Calculate `total_seharusnya = shift.modal_awal + total_tunai_bersih`.
  - Store full snapshot JSON in `shift.detail_metode_json`.
  - Return `rincian_pembayaran` in summary dictionary.
- In `generate_shift_receipt_text(shift_id)`:
  - Render dynamic rows for all non-cash methods that have values $> 0$.
  - Clear row for `Total Uang Seharusnya di Laci`, `Uang Fisik Laci`, and `Selisih`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_dynamic_payments.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/shift/shift_service.py tests/test_shift_dynamic_payments.py
git commit -m "feat(shift): implementasi breakdown dinamis metode pembayaran dan struk thermal 58mm"
```

---

### Task 3: Single Active Shift System-wide & Cashier Concurrency Protection (Opsi A)

**Files:**
- Modify: `app/services/shift/shift_service.py:45-60`
- Modify: `app/services/auth/auth_kasir_service.py:30-65`
- Test: `tests/test_shift_concurrency_protection.py`

**Interfaces:**
- Consumes: `ShiftRecord.query.filter_by(status="AKTIF")`, `User.role`
- Produces: System-wide single shift guarantee, `AuthKasirService.login` blocking non-owner kasir (HTTP 403) with descriptive message, unlimited re-login for active cashier.

- [ ] **Step 1: Write the failing test for shift concurrency and login restriction**

```python
# tests/test_shift_concurrency_protection.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.shift.shift_service import ShiftService
from app.services.auth.auth_kasir_service import AuthKasirService

@pytest.fixture
def concurrency_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir1 = User(username="kasir1", nama_lengkap="Kasir Pertama", role="kasir")
        kasir1.set_password("pass123")
        kasir2 = User(username="kasir2", nama_lengkap="Kasir Kedua", role="kasir")
        kasir2.set_password("pass123")
        admin = User(username="admin_bos", nama_lengkap="Bos Warnet", role="admin")
        admin.set_password("pass123")
        db.session.add_all([kasir1, kasir2, admin])
        db.session.commit()
        yield app, kasir1, kasir2, admin
        db.session.remove()
        db.drop_all()

def test_single_active_shift_system_wide(concurrency_ctx):
    app, kasir1, kasir2, admin = concurrency_ctx
    # Kasir 1 buka shift
    ShiftService.start_shift("kasir1", modal_awal=50000, operator="kasir1")

    # Kasir 2 mencoba buka shift saat Kasir 1 masih aktif -> HARUS GAGAL
    with pytest.raises(ValueError, match="Masih ada shift aktif"):
        ShiftService.start_shift("kasir2", modal_awal=50000, operator="kasir2")

def test_cashier_login_concurrency_restriction(concurrency_ctx):
    app, kasir1, kasir2, admin = concurrency_ctx
    # Kasir 1 buka shift
    ShiftService.start_shift("kasir1", modal_awal=50000, operator="kasir1")

    # 1. Kasir 1 (pemegang shift aktif) login ulang -> HARUS SUKSES (tanpa batas waktu)
    res_k1 = AuthKasirService.login("kasir1", "pass123")
    assert res_k1["success"] is True

    # 2. Kasir 2 mencoba login saat shift Kasir 1 aktif -> HARUS DITOLAK
    with pytest.raises(PermissionError, match="Shift kasir saat ini sedang aktif oleh 'Kasir Pertama'"):
        AuthKasirService.login("kasir2", "pass123")

    # 3. Admin login saat shift Kasir 1 aktif -> HARUS SUKSES
    res_adm = AuthKasirService.login("admin_bos", "pass123")
    assert res_adm["success"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_concurrency_protection.py -q`
Expected: FAIL

- [ ] **Step 3: Implement concurrency control in ShiftService and AuthKasirService**

In `app/services/shift/shift_service.py`:
- In `start_shift()`:
  - Query: `active_shift = ShiftRecord.query.filter_by(status="AKTIF").first()`.
  - If `active_shift`:
    - Raise `ValueError(f"Tidak dapat membuka shift baru: Masih ada shift aktif oleh '{active_shift.kasir.nama_lengkap or active_shift.kasir.username}' sejak {format_display(active_shift.waktu_mulai)}. Selesaikan shift terlebih dahulu.")`

In `app/services/auth/auth_kasir_service.py`:
- In `login(username, password)`:
  - If user is valid and `user.role == "kasir"`:
    - Query: `active_shift = ShiftRecord.query.filter_by(status="AKTIF").first()`.
    - If `active_shift` and `active_shift.kasir_id != user.id`:
      - Raise `PermissionError(f"Akses Ditolak: Shift kasir saat ini sedang aktif oleh '{active_shift.kasir.nama_lengkap or active_shift.kasir.username}' sejak {format_display(active_shift.waktu_mulai)}. Kasir lain tidak dapat masuk sampai shift tersebut ditutup.")`

In `app/routes/auth/auth_kasir_routes.py`:
- In `login()`:
  - Catch `PermissionError as pe`: return `jsonify({"error": str(pe)}), 403`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_concurrency_protection.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/shift/shift_service.py app/services/auth/auth_kasir_service.py app/routes/auth/auth_kasir_routes.py tests/test_shift_concurrency_protection.py
git commit -m "feat(auth,shift): terapkan single active shift dan proteksi login kasir eksklusif (anti-fitnah)"
```

---

### Task 4: Mandatory Active Shift for Cashier Transactions & Admin Exemption

**Files:**
- Modify: `app/middleware/auth.py:120-145`
- Modify: `app/routes/sesi/sesi_routes.py:20-60,175-210,305-325`
- Modify: `app/routes/menu/menu_routes.py:40-70`
- Test: `tests/test_shift_mandatory_transaction.py`

**Interfaces:**
- Consumes: `session["kasir_role"]`, `session["kasir_id"]`, `ShiftService.get_active_shift`
- Produces: `@shift_required` decorator or pre-flight transaction check blocking unshifted cashier with HTTP 400.

- [ ] **Step 1: Write the failing test for mandatory shift on transactions**

```python
# tests/test_shift_mandatory_transaction.py
import pytest
from app import create_app, db
from app.models import User, PC, Paket, Grup, ShiftRecord
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def client_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="Regular", tarif_per_jam=5000)
        db.session.add(grup)
        db.session.flush()

        pc = PC(nomor=1, kode="PC-01", ip_address="192.168.1.101", grup_id=grup.id, status="tersedia")
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, jenis="biasa", grup_id=grup.id)
        kasir = User(username="kasir_trx", role="kasir")
        kasir.set_password("pass123")
        admin = User(username="admin_trx", role="admin")
        admin.set_password("pass123")
        db.session.add_all([pc, paket, kasir, admin])
        db.session.commit()
        yield app.test_client(), pc, paket, kasir, admin
        db.session.remove()
        db.drop_all()

def test_cashier_without_shift_cannot_transact(client_ctx):
    client, pc, paket, kasir, admin = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = kasir.username
        sess["kasir_role"] = "kasir"

    # Kasir belum buka shift mencoba buka guest -> HARUS DITOLAK 400
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res.status_code == 400
    assert "buka shift" in res.get_json()["error"].lower()

    # Buka shift
    ShiftService.start_shift(kasir.username, modal_awal=50000, operator=kasir.username)

    # Sekarang coba buka guest lagi -> HARUS SUKSES 201
    res_success = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Pelanggan"})
    assert res_success.status_code == 201

def test_admin_can_transact_without_shift(client_ctx):
    client, pc, paket, kasir, admin = client_ctx
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = "admin"

    # Admin tidak punya shift aktif tapi HARUS BISA transaksi
    res = client.post("/api/v1/kasir/sesi/buka-guest", json={"pc_kode": pc.kode, "paket_id": paket.id, "nama_guest": "Tamu Admin"})
    assert res.status_code == 201
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_mandatory_transaction.py -q`
Expected: FAIL

- [ ] **Step 3: Implement shift_required decorator / check**

In `app/middleware/auth.py`:
- Define `def shift_required(f)`:
  - If `session.get("kasir_role") == "kasir"`:
    - Cek `ShiftService.get_active_shift(session.get("kasir_username"))`.
    - If `None`: return `jsonify({"error": "Harap buka shift terlebih dahulu sebelum melayani transaksi."}), 400`.
  - Otherwise (admin/owner/system), proceed.

Apply `@shift_required` to:
- `app/routes/sesi/sesi_routes.py`: `buka_guest`, `buka_member`, `buka_guest_batch`, `tambah_waktu_sesi`, `tambah_waktu_batch`, `refund_paket`.
- `app/routes/menu/menu_routes.py`: checkout/order transaction endpoint.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_mandatory_transaction.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/middleware/auth.py app/routes/sesi/sesi_routes.py app/routes/menu/menu_routes.py tests/test_shift_mandatory_transaction.py
git commit -m "feat(security): wajibkan buka shift untuk transaksi role kasir dan bebaskan role admin"
```

---

### Task 5: Emergency Force Close Shift by Admin

**Files:**
- Modify: `app/services/shift/shift_service.py`
- Modify: `app/routes/shift/shift_routes.py`
- Test: `tests/test_shift_force_close.py`

**Interfaces:**
- Consumes: `ShiftRecord`, `admin_required`, `write_log`
- Produces: `ShiftService.force_close_shift(shift_id, admin_username, alasan)`, `POST /api/v1/kasir/shift/force-close`

- [ ] **Step 1: Write the failing test for admin emergency force close**

```python
# tests/test_shift_force_close.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.shift.shift_service import ShiftService

@pytest.fixture
def force_close_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_fc", nama_lengkap="Kasir Terkunci", role="kasir")
        kasir.set_password("pass123")
        kasir2 = User(username="kasir_next", nama_lengkap="Kasir Berikutnya", role="kasir")
        kasir2.set_password("pass123")
        admin = User(username="admin_fc", nama_lengkap="Admin Utama", role="admin")
        admin.set_password("pass123")
        db.session.add_all([kasir, kasir2, admin])
        db.session.commit()
        yield app.test_client(), kasir, kasir2, admin
        db.session.remove()
        db.drop_all()

def test_admin_force_close_shift(force_close_ctx):
    client, kasir, kasir2, admin = force_close_ctx
    shift = ShiftService.start_shift("kasir_fc", modal_awal=50000, operator="kasir_fc")

    # Kasir biasa tidak boleh force-close
    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = kasir.username
        sess["kasir_role"] = "kasir"

    res_fail = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift.id, "alasan": "Tutup"})
    assert res_fail.status_code == 403

    # Admin force close
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = "admin"

    # Alasan kurang dari 3 karakter -> 400
    res_short = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift.id, "alasan": "ab"})
    assert res_short.status_code == 400

    # Alasan valid
    res_ok = client.post("/api/v1/kasir/shift/force-close", json={"shift_id": shift.id, "alasan": "Kasir pulang darurat karena sakit"})
    assert res_ok.status_code == 200
    assert res_ok.get_json()["success"] is True

    # Shift sekarang harus SELESAI
    saved = ShiftRecord.query.get(shift.id)
    assert saved.status == "SELESAI"
    assert "Kasir pulang darurat" in saved.catatan

    # Kasir berikutnya sekarang BISA buka shift baru
    shift2 = ShiftService.start_shift("kasir_next", modal_awal=50000, operator="kasir_next")
    assert shift2.status == "AKTIF"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_force_close.py -q`
Expected: FAIL

- [ ] **Step 3: Implement force_close_shift in ShiftService and route**

In `app/services/shift/shift_service.py`:
- Add method `force_close_shift(shift_id, admin_username, alasan)`:
  - Validate `alasan` (3 - 255 chars).
  - Find shift, ensure `status == "AKTIF"`.
  - Calculate `get_shift_summary(shift.id)`.
  - Set `shift.status = "SELESAI"`, `shift.waktu_selesai = now_local()`.
  - Set `shift.catatan = f"[FORCE CLOSE oleh {admin_username}] {alasan}"`.
  - Set `shift.uang_fisik = None` or estimated.
  - Log audit `write_log("SHIFT_FORCE_CLOSE", ...)`.
  - Commit and return summary.

In `app/routes/shift/shift_routes.py`:
- Add route `@shift_api_bp.route("/force-close", methods=["POST"])`:
  - Protected with `@admin_required`.
  - Extract `shift_id` and `alasan`.
  - Call `ShiftService.force_close_shift`.
  - Return JSON response.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python -m pytest tests/test_shift_force_close.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/shift/shift_service.py app/routes/shift/shift_routes.py tests/test_shift_force_close.py
git commit -m "feat(shift): tambahkan endpoint dan service emergency force close shift oleh admin"
```

---

### Task 6: Frontend Sidebar Shift Widget & Admin Force Close Modal

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html:115-130`
- Modify: `app/static/js/kasir/core/api.js`
- Modify: `app/static/js/kasir/modules/shift/index.js`

**Interfaces:**
- Consumes: `/api/v1/kasir/shift/active`, `/api/v1/kasir/shift/force-close`
- Produces: Sidebar footer widget rendering for kasir and admin, Admin Force Close Modal.

- [ ] **Step 1: Add forceClose API in core/api.js**

In `app/static/js/kasir/core/api.js`:
- Under `API.shift`:
  - Add `forceClose: (data) => API.request('/api/v1/kasir/shift/force-close', { method: 'POST', body: JSON.stringify(data) })`

- [ ] **Step 2: Update sidebar.html container**

In `app/templates/kasir/components/sidebar.html`:
- Ensure `<div id="shift-info" class="mb-2 w-full"></div>` is placed above the logout button in user section.

- [ ] **Step 3: Implement admin shift status & force-close modal in shift/index.js**

In `app/static/js/kasir/modules/shift/index.js`:
- Update `updateSidebarInfo()`:
  - If `App.user && App.user.role === 'admin'`:
    - Fetch `/api/v1/kasir/shift/active`
    - If active shift exists:
      - Render card: `Shift Aktif: ${activeShift.kasir_nama}` with start time.
      - Add button: **`Kelola / Force Close Shift`** (onclick: `Shift.showAdminForceCloseModal()`).
    - If no active shift:
      - Render subtle text: *"Tidak Ada Shift Kasir Aktif"*.
  - If `role === 'kasir'`:
    - If no shift: Render amber button **`Buka Shift Kasir`** (full width).
    - If active shift: Render active badge, start time, modal awal, and button **`Pertukaran / Serah Terima Shift`**.
- Add `showAdminForceCloseModal(shift)`:
  - Display modal with active cashier details, start time, modal awal, current revenue.
  - Textarea: `Alasan Penutupan Paksa (Minimal 3 karakter)`
  - Confirmation button: **`Tutup Paksa Shift (Force Close)`** with red danger accent.
- Add `submitForceClose()`:
  - Call `API.shift.forceClose({ shift_id: shiftId, alasan })`
  - On success: Toast notification, reload shift status.

- [ ] **Step 4: Verify syntax and build CSS**

Run: `npm run build:css`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add app/static/js/kasir/core/api.js app/templates/kasir/components/sidebar.html app/static/js/kasir/modules/shift/index.js
git commit -m "feat(ui): tambahkan widget shift sidebar untuk kasir dan modal force-close untuk admin"
```

---

### Task 7: Frontend Dynamic Breakdown Modal, Struk Thermal, & Manajemen Staf Sub-Menus

**Files:**
- Modify: `app/static/js/kasir/modules/shift/index.js`
- Modify: `app/templates/kasir/components/sidebar_admin.html:20-27`
- Modify: `app/templates/kasir/tabs/user.html`
- Create: `app/templates/kasir/tabs/shift_history.html`
- Create: `app/templates/kasir/tabs/user_logs.html`
- Modify: `app/templates/kasir/dashboard.html`

**Interfaces:**
- Consumes: `App.switchTab`, `API.shift.history`, `API.shift.receipt`
- Produces: Dynamic multi-payment modal display, thermal receipt 58mm rendering, 3 sub-menus in Manajemen Staff, Shift History tab & User Logs tab.

- [ ] **Step 1: Update modal rekap digital and printHandover with dynamic payment breakdown**

In `app/static/js/kasir/modules/shift/index.js`:
- In `showHasilShift(result)`:
  - Render dynamic table of `rincian_pembayaran`:
    - Tunai: Billing Tunai, Kantin Tunai, Refund $\rightarrow$ Total Tunai Masuk.
    - Non-Tunai: Map each non-cash method (QRIS, Transfer, dll.) with its amount.
    - Rekonsiliasi: Uang Seharusnya di Laci vs Uang Fisik Aktual $\rightarrow$ Selisih (Surplus / Sesuai / Defisit).
- In `printHandover(result)`:
  - Format HTML print template to loop through all dynamic non-cash payment methods.

- [ ] **Step 2: Add 3 sub-menus to sidebar_admin.html**

In `app/templates/kasir/components/sidebar_admin.html`:
- Under `staff-submenu`:
  - Item 1: `Akun Kasir & Admin` (`data-tab="user"`)
  - Item 2: `Riwayat Serah Terima` (`data-tab="shift_history"`)
  - Item 3: `Log & Audit Staff` (`data-tab="user_logs"`)

- [ ] **Step 3: Create shift_history.html and user_logs.html tabs**

Create `app/templates/kasir/tabs/shift_history.html`:
- Card container `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6`.
- Filter: Tanggal (Dari - Sampai), Kasir filter dropdown.
- Table: ID Shift, Tanggal/Jam, Kasir, Modal Awal, Billing, Kantin, Total Fisik, Selisih, Status, Catatan, Aksi.
- Aksi: Tombol **`Lihat Detail`** (membuka modal rekapan digital dinamis) & **`Cetak Struk`** (`Shift.printThermalReceipt(shift.id)`).

Create `app/templates/kasir/tabs/user_logs.html`:
- Card container matching `settings.html` aesthetic.
- Table of audit logs for staff actions (`SHIFT_BUKA`, `SHIFT_TUTUP`, `SHIFT_FORCE_CLOSE`, `RESET_KUOTA`, `TAMBAH_BONUS`).

Include both tabs in `app/templates/kasir/dashboard.html`.

- [ ] **Step 4: Verify CSS compilation**

Run: `npm run build:css`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add app/static/js/kasir/modules/shift/index.js app/templates/kasir/components/sidebar_admin.html app/templates/kasir/tabs/shift_history.html app/templates/kasir/tabs/user_logs.html app/templates/kasir/dashboard.html
git commit -m "feat(ui): tambahkan tab riwayat shift, log audit staf, dan rekap metode pembayaran dinamis"
```

---

### Task 8: End-to-End Regression Verification & Codebase Memory Indexing

**Files:**
- Test: All test suites in `tests/`

- [ ] **Step 1: Run full pytest suite**

Run: `.\.venv\Scripts\python -m pytest -q`
Expected: 230+ passed, 0 failed

- [ ] **Step 2: Verify MCP codebase-memory indexing**

Call MCP `index_repository` on `C-Project-GIT-TMBilling` or check `index_status`.
Expected: Fully indexed, status "ready".

- [ ] **Step 3: Commit and clean working tree**

```bash
git commit --allow-empty -m "chore: verifikasi end-to-end seluruh test lulus 100% dan re-index codebase memory"
```

# PC Uptime Log Timezone Fix & Comprehensive PC Hard Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki representasi timezone pada fitur PC Uptime Log agar selalu mengikuti configured timezone (tanpa merusak UTC storage) dan mengimplementasikan comprehensive transactional hard delete untuk PC yang membersihkan seluruh dependent data (uptime logs, hardware telemetry, proses, tiket maintenance, in-memory caches, dan screenshot) sekaligus memproteksi data master/shared dan riwayat finansial.

**Architecture:** 
- **Timezone**: Mempertahankan UTC naive di database SQLite sebagai sumber kebenaran absolut. Pada layer model serialization (`PCUptimeLog.to_dict()` dan `PC.to_dict()`) serta frontend UI, konversi dilakukan menggunakan modul utilitas standar `app.utils.timezone_utils` (`display_in_tz` dan `format_display`).
- **Hard Delete**: Mengimplementasikan atomik transactional deletion di `PCService.delete` dengan validasi sesi aktif, detachment aman terhadap sesi historis (`sesi.pc_id = None`), cascade delete ORM + explicit SQL delete untuk entitas Category A (`pc_uptime_log`, `hardware_monitor`, `pc_process`, `maintenance_ticket`), serta cleanup in-memory state dan filesystem screenshot.

**Tech Stack:** Python 3, Flask, Flask-SQLAlchemy, SQLite (WAL mode), Vanilla JavaScript, Tailwind CSS.

**Spec:** Requirement Plan: PC Uptime Log, Comprehensive Hard Delete, dan Backward Compatibility

## Global Constraints

- Storage database harus tetap menggunakan UTC naive sebagai source of truth (`now_utc().replace(tzinfo=None)` / `now_local()`).
- Jangan mengubah timestamp UTC yang sudah tersimpan di database hanya untuk kebutuhan display.
- Hard delete PC tidak boleh menggunakan soft delete (`is_deleted` dsb). PC dan data dependent-nya harus benar-benar dihapus.
- Data master/shared (Category C: `Grup`, `Member`, `Paket`, `User`, `Transaksi`, `MenuItem`, `Turnamen`, `Settings`) tidak boleh ikut terhapus saat PC dihapus.
- Sesi historis (Category B: `Sesi` yang berstatus `selesai`) tidak boleh dihapus agar integritas laporan omzet/keuangan tetap utuh; relasi `sesi.pc_id` diubah menjadi `NULL`.
- Jika PC sedang digunakan dalam sesi aktif (`status == 'aktif'`), penghapusan PC harus ditolak dengan validasi yang jelas.
- Operasi delete harus dibungkus dalam single database transaction (commit jika sukses, rollback jika error).
- Semua perubahan harus backward compatible terhadap database dan data existing tanpa destructive migration.

---

## File Structure & Responsibilities

| File Path | Responsibility |
|---|---|
| `app/models/pc/pc_uptime.py` | Model `PCUptimeLog`, relasi ke `PC`, serialisasi `to_dict()` dengan konversi timezone display |
| `app/models/pc/pc.py` | Model `PC`, relasi cascade delete ke `uptime_logs` dan `maintenance_tickets`, timezone screenshot |
| `app/models/maintenance/maintenance.py` | Model `MaintenanceTicket`, relasi ke `PC` |
| `app/services/pc/pc_service.py` | Service bisnis PC, implementasi transactional hard delete komprehensif |
| `app/static/js/kasir/modules/uptime/index.js` | Frontend rendering Uptime Tracker, format display waktu lokal |
| `app/static/js/kasir/modules/pc/index.js` | Frontend interaksi modul PC, konfirmasi delete permanen |
| `tests/test_pc_hard_delete_and_uptime.py` | Comprehensive automated test suite |

---

### Task 1: Timezone Support on `PCUptimeLog` & `PC` Models

**Files:**
- Modify: `app/models/pc/pc_uptime.py:1-71`
- Modify: `app/models/pc/pc.py:40-116`
- Modify: `app/models/maintenance/maintenance.py:1-50`
- Test: `tests/test_pc_hard_delete_and_uptime.py`

**Interfaces:**
- Consumes: `app.utils.timezone_utils:display_in_tz`, `app.utils.timezone_utils:format_display`, `app.utils.timezone_utils:get_display_tz`
- Produces: 
  - `PCUptimeLog.to_dict() -> dict` with local timezone fields (`first_seen`, `last_seen`, `first_seen_display`, `last_seen_display`, `first_seen_time`, `last_seen_time`)
  - `PC.to_dict() -> dict` with timezone-aware `screenshot_time`
  - `PC.uptime_logs` & `PC.maintenance_tickets` relationships with `cascade="all, delete-orphan"`

- [ ] **Step 1: Write the test for timezone conversion in `PCUptimeLog`**

Create `tests/test_pc_hard_delete_and_uptime.py`:

```python
import unittest
from datetime import datetime, date, timezone
from app import create_app
from app.models import db, PC, Grup, PCUptimeLog, Settings
from app.services.settings.settings_service import SettingsService

class TestPCUptimeTimezone(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create sample grup & PC
        self.grup = Grup(nama="reguler", warna="#3b82f6")
        db.session.add(self.grup)
        db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_pc_uptime_to_dict_converts_utc_to_configured_timezone(self):
        # Set timezone to Asia/Makassar (WITA, UTC+8)
        SettingsService.set("timezone", "Asia/Makassar")

        # Create uptime log with UTC naive timestamp 15:00:00 (which corresponds to 23:00:00 WITA)
        utc_naive = datetime(2026, 8, 19, 15, 0, 0)
        log = PCUptimeLog(
            pc_id=self.pc.id,
            tanggal=date(2026, 8, 19),
            total_online_seconds=3600,
            total_billing_seconds=1800,
            first_seen=utc_naive,
            last_seen=utc_naive
        )
        db.session.add(log)
        db.session.commit()

        data = log.to_dict()

        # Database must still store UTC naive
        raw_log = PCUptimeLog.query.get(log.id)
        self.assertEqual(raw_log.first_seen, utc_naive)

        # Presentation layer must reflect Asia/Makassar (23:00)
        self.assertIn("23:00", data["first_seen_time"])
        self.assertIn("23:00", data["last_seen_time"])
        self.assertIn("+08:00", data["first_seen"])
        self.assertIn("WITA", data["first_seen_display"])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_pc_hard_delete_and_uptime.TestPCUptimeTimezone.test_pc_uptime_to_dict_converts_utc_to_configured_timezone`
Expected: FAIL (KeyError or AssertionError because `first_seen_time` is missing and `first_seen` is raw UTC without offset).

- [ ] **Step 3: Update `PCUptimeLog` and `PC` models**

Edit `app/models/pc/pc_uptime.py`:
```python
# app/models/pc/pc_uptime.py

"""Model untuk mencatat log harian uptime PC client."""

from app.models import db
from app.utils.timezone_utils import format_display, display_in_tz


class PCUptimeLog(db.Model):
    """Model untuk mencatat statistik uptime dan utilisasi harian per PC."""
    
    __tablename__ = "pc_uptime_log"
    __table_args__ = (
        db.UniqueConstraint("pc_id", "tanggal", name="uq_pc_uptime_pc_tanggal"),
    )
    
    id = db.Column(db.Integer, primary_key=True)
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False)
    tanggal = db.Column(db.Date, nullable=False)
    total_online_seconds = db.Column(db.Integer, default=0, nullable=False)
    total_billing_seconds = db.Column(db.Integer, default=0, nullable=False)
    first_seen = db.Column(db.DateTime, nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    
    # Relasi ke PC
    pc = db.relationship("PC", back_populates="uptime_logs")
    
    def to_dict(self):
        """Mengkonversi objek log uptime ke dictionary dengan konversi timezone."""
        online_menit = round(self.total_online_seconds / 60, 1)
        billing_menit = round(self.total_billing_seconds / 60, 1)
        
        utilisasi = 0.0
        if self.total_online_seconds > 0:
            utilisasi = round((self.total_billing_seconds / self.total_online_seconds) * 100, 1)
            if utilisasi > 100.0:
                utilisasi = 100.0

        grup_nama = self.pc.grup.nama if self.pc and self.pc.grup else "reguler"

        first_seen_local = display_in_tz(self.first_seen) if self.first_seen else None
        last_seen_local = display_in_tz(self.last_seen) if self.last_seen else None

        return {
            "id": self.id,
            "pc_id": self.pc_id,
            "pc_kode": self.pc.kode if self.pc else "Unknown",
            "grup": grup_nama,
            "tanggal": self.tanggal.isoformat() if self.tanggal else None,
            "total_online_menit": online_menit,
            "total_billing_menit": billing_menit,
            "total_online_seconds": self.total_online_seconds,
            "total_billing_seconds": self.total_billing_seconds,
            "first_seen": first_seen_local.isoformat() if first_seen_local else None,
            "last_seen": last_seen_local.isoformat() if last_seen_local else None,
            "first_seen_display": format_display(self.first_seen) if self.first_seen else "-",
            "last_seen_display": format_display(self.last_seen) if self.last_seen else "-",
            "first_seen_time": first_seen_local.strftime("%H:%M") if first_seen_local else "-",
            "last_seen_time": last_seen_local.strftime("%H:%M") if last_seen_local else "-",
            "utilisasi_persen": utilisasi
        }
```

Edit `app/models/pc/pc.py`:
- Update relationships:
```python
    # Relasi ke Sesi
    sesi_list = db.relationship('Sesi', back_populates='pc', lazy='dynamic')
    
    # Relasi ke Uptime Log dengan Cascade Delete
    uptime_logs = db.relationship('PCUptimeLog', back_populates='pc', cascade='all, delete-orphan', lazy='dynamic')
    
    # Relasi ke Maintenance Tickets dengan Cascade Delete
    maintenance_tickets = db.relationship('MaintenanceTicket', back_populates='pc', cascade='all, delete-orphan', lazy='dynamic')
```
- Update `to_dict()` screenshot timestamp in `app/models/pc/pc.py`:
```python
        screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{self.kode}.png")
        has_screenshot = os.path.exists(screenshot_path)
        screenshot_time = None
        if has_screenshot:
            try:
                from app.utils.timezone_utils import format_display
                from datetime import timezone
                mtime = os.path.getmtime(screenshot_path)
                dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
                screenshot_time = format_display(dt_utc)
            except Exception:
                pass
```

Edit `app/models/maintenance/maintenance.py`:
```python
    # Relationship
    pc = db.relationship("PC", back_populates="maintenance_tickets")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m unittest tests/test_pc_hard_delete_and_uptime.TestPCUptimeTimezone.test_pc_uptime_to_dict_converts_utc_to_configured_timezone`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/models/pc/pc_uptime.py app/models/pc/pc.py app/models/maintenance/maintenance.py tests/test_pc_hard_delete_and_uptime.py
git commit -m "fix(pc): add timezone conversion to PCUptimeLog and configure ORM cascades on PC model"
```

---

### Task 2: Frontend Uptime Module & Timezone Presentation

**Files:**
- Modify: `app/static/js/kasir/modules/uptime/index.js:112-195`

**Interfaces:**
- Consumes: `item.first_seen_time`, `item.last_seen_time`, `item.first_seen_display`, `item.last_seen_display` from API `/api/v1/kasir/uptime/daily`
- Produces: Correct localized time display in Uptime Tracker table

- [ ] **Step 1: Update `formatTimeOnly` and table cell rendering in `app/static/js/kasir/modules/uptime/index.js`**

Modify `formatTimeOnly` to safely handle ISO strings with timezone offsets, and update `renderDaily` row markup:

```javascript
    formatTimeOnly(isoStr) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    },
```

In `renderDaily`:
```javascript
<td class="px-6 py-3.5 font-mono text-neutral-500">${item.first_seen_time || this.formatTimeOnly(item.first_seen)}</td>
<td class="px-6 py-3.5 font-mono text-neutral-500">${item.last_seen_time || this.formatTimeOnly(item.last_seen)}</td>
```

- [ ] **Step 2: Commit changes**

```bash
git add app/static/js/kasir/modules/uptime/index.js
git commit -m "fix(uptime-ui): use backend-converted localized time for first_seen and last_seen"
```

---

### Task 3: Comprehensive Transactional Hard Delete for PC

**Files:**
- Modify: `app/services/pc/pc_service.py:212-225`
- Modify: `app/static/js/kasir/modules/pc/index.js:125-136`
- Test: `tests/test_pc_hard_delete_and_uptime.py`

**Interfaces:**
- Consumes: `PCRepository.get_by_id`, `PCUptimeLog`, `HardwareMonitor`, `PCProcess`, `MaintenanceTicket`, `Sesi`, `write_log`
- Produces: `PCService.delete(pc_id, operator) -> dict {"success": True, "message": str}`

- [ ] **Step 1: Write automated tests for all hard delete scenarios**

Add tests to `tests/test_pc_hard_delete_and_uptime.py`:

```python
from app.models import HardwareMonitor, PCProcess, MaintenanceTicket, Sesi, Transaksi
from app.services.pc.pc_service import PCService
from app.services.hardware.hardware_service import TELEMETRY_HISTORY
from app.services.client.client_service import PENDING_COMMANDS

class TestPCHardDelete(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        self.grup = Grup(nama="reguler", warna="#3b82f6")
        db.session.add(self.grup)
        db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_delete_pc_with_all_dependencies_succeeds(self):
        pc_id = self.pc.id

        # 1. Add Uptime Log (Category A)
        log = PCUptimeLog(pc_id=pc_id, tanggal=date(2026, 8, 19), total_online_seconds=100)
        db.session.add(log)

        # 2. Add Hardware Monitor (Category A)
        hw = HardwareMonitor(pc_id=pc_id, cpu_usage=25.0, cpu_temp=45.0)
        db.session.add(hw)

        # 3. Add PC Process (Category A)
        proc = PCProcess(pc_id=pc_id, name="game.exe", title="Game")
        db.session.add(proc)

        # 4. Add Maintenance Ticket (Category A)
        ticket = MaintenanceTicket(pc_id=pc_id, reporter="admin", kategori="HARDWARE", judul="Keyboard rusak")
        db.session.add(ticket)

        # 5. Add Finished Sesi (Category B)
        sesi = Sesi(tipe="guest", nama_guest="Budi", pc_id=pc_id, status="selesai")
        db.session.add(sesi)
        db.session.commit()

        # 6. Add In-Memory Cache/Queue
        TELEMETRY_HISTORY[pc_id] = [{"cpu_usage": 25.0}]
        PENDING_COMMANDS[pc_id] = "screenshot"

        # Execute Hard Delete
        result = PCService.delete(pc_id, operator="admin")
        self.assertTrue(result["success"])

        # Verification: PC must not exist in DB
        self.assertIsNone(PC.query.get(pc_id))

        # Verification: Category A records must be deleted
        self.assertEqual(PCUptimeLog.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(HardwareMonitor.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(PCProcess.query.filter_by(pc_id=pc_id).count(), 0)
        self.assertEqual(MaintenanceTicket.query.filter_by(pc_id=pc_id).count(), 0)

        # Verification: Category B (Sesi) is preserved with pc_id = None
        saved_sesi = Sesi.query.get(sesi.id)
        self.assertIsNotNone(saved_sesi)
        self.assertIsNone(saved_sesi.pc_id)

        # Verification: Category C (Grup) is preserved
        self.assertIsNotNone(Grup.query.get(self.grup.id))

        # Verification: In-memory state cleared
        self.assertNotIn(pc_id, TELEMETRY_HISTORY)
        self.assertNotIn(pc_id, PENDING_COMMANDS)

    def test_delete_pc_blocked_when_active_session_exists(self):
        # Create active session on PC
        sesi = Sesi(tipe="guest", nama_guest="Andi", pc_id=self.pc.id, status="aktif")
        db.session.add(sesi)
        db.session.commit()

        # Deletion must be rejected
        with self.assertRaises(ValueError) as ctx:
            PCService.delete(self.pc.id, operator="admin")
        self.assertIn("sesi aktif", str(ctx.exception).lower())

        # PC and session must still exist
        self.assertIsNotNone(PC.query.get(self.pc.id))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest tests/test_pc_hard_delete_and_uptime.TestPCHardDelete`
Expected: FAIL (because current implementation fails with FK constraint / missing dependency cleanup).

- [ ] **Step 3: Implement comprehensive hard delete in `PCService`**

Modify `app/services/pc/pc_service.py`:

```python
    @staticmethod
    def delete(pc_id, operator="system"):
        """Hapus unit PC secara permanen dari sistem beserta seluruh dependensinya."""
        import os
        from flask import current_app
        from app.models import PCUptimeLog, HardwareMonitor, PCProcess, MaintenanceTicket, Sesi

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            raise ValueError("PC tidak ditemukan")

        # 1. Proteksi Sesi Aktif
        if pc.sesi_aktif:
            raise ValueError(f"PC {pc.kode} tidak dapat dihapus karena sedang digunakan dalam sesi aktif. Harap selesaikan sesi terlebih dahulu.")

        kode = pc.kode
        try:
            # 2. Detach sesi historis (Category B) agar histori keuangan tetap utuh
            Sesi.query.filter_by(pc_id=pc.id).update({"pc_id": None})

            # 3. Hapus seluruh data anak langsung (Category A)
            PCUptimeLog.query.filter_by(pc_id=pc.id).delete()
            HardwareMonitor.query.filter_by(pc_id=pc.id).delete()
            PCProcess.query.filter_by(pc_id=pc.id).delete()
            MaintenanceTicket.query.filter_by(pc_id=pc.id).delete()

            # 4. Hapus entitas PC
            db.session.delete(pc)
            db.session.commit()

            # 5. Cleanup In-Memory states (Non-fatal)
            try:
                from app.services.hardware.hardware_service import TELEMETRY_HISTORY
                TELEMETRY_HISTORY.pop(pc_id, None)
            except Exception:
                pass

            try:
                from app.services.client.client_service import PENDING_COMMANDS
                PENDING_COMMANDS.pop(pc_id, None)
            except Exception:
                pass

            # 6. Cleanup screenshot file di filesystem jika ada
            try:
                screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{kode}.png")
                if os.path.exists(screenshot_path):
                    os.remove(screenshot_path)
            except Exception:
                pass

            write_log("HAPUS_PC", f"PC:{kode} dihapus permanen beserta seluruh dependensinya", user=operator, detail_json={"kode": kode, "pc_id": pc_id})
            return {"success": True, "message": f"PC {kode} berhasil dihapus"}

        except Exception as e:
            db.session.rollback()
            write_log("HAPUS_PC_ERROR", f"Gagal menghapus PC {kode}: {str(e)}", user=operator)
            raise e
```

- [ ] **Step 4: Update Delete Confirmation in `app/static/js/kasir/modules/pc/index.js`**

Modify `delete(id)` in `app/static/js/kasir/modules/pc/index.js`:
```javascript
    async delete(id) {
        const message = '<div class="text-center"><p class="text-xs lg:text-base text-neutral-300 font-semibold mb-1">Hapus PC ini secara permanen?</p><p class="text-[11px] lg:text-sm text-neutral-500">Seluruh data uptime log, hardware telemetry, proses, dan tiket perawatan unit ini akan dihapus bersih.</p></div>';
        Modal.confirm(message, async () => {
            try {
                const res = await API.pc.delete(id);
                Toast.success(res.message || 'PC berhasil dihapus');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal menghapus PC');
            }
        });
    },
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `python -m unittest tests/test_pc_hard_delete_and_uptime.py`
Expected: PASS (all tests pass).

- [ ] **Step 6: Commit changes**

```bash
git add app/services/pc/pc_service.py app/static/js/kasir/modules/pc/index.js tests/test_pc_hard_delete_and_uptime.py
git commit -m "feat(pc): implement comprehensive transactional hard delete with full dependency cleanup"
```

---

### Task 4: Regression Testing & Backward Compatibility Verification

**Files:**
- Test: `tests/test_audit_auth_client_logging.py`
- Test: `tests/test_audit_category_grouping.py`
- Test: `tests/test_audit_logging_coverage.py`
- Test: `tests/test_audit_remote_logging.py`
- Test: `tests/test_audit_settings_logging.py`
- Test: `tests/test_audit_tournament_game_logging.py`
- Test: `tests/test_pc_hard_delete_and_uptime.py`

- [ ] **Step 1: Run full test suite**

Run: `python -m unittest discover -s tests -p "test_*.py"`
Expected: All tests PASS without any regressions.

- [ ] **Step 2: Commit test suite documentation and final verification logs**

```bash
git add tests/
git commit -m "test: verify entire test suite passes with backward compatibility guaranteed"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-pc-uptime-hard-delete.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

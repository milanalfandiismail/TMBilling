# Peripheral & Hardware Checker with Smart CCTV Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement unified Internal Hardware and External Peripheral discrepancy monitoring with 5-minute disconnect grace periods, smart CCTV reference window calculations, and fully responsive UI across all Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) on the Flask server and Kasir dashboard.

**Architecture:** Extend `HardwareMonitor` model with peripheral baseline/current/mismatch columns and disconnect tracking; enrich `HardwareService.process_hardware_metric` to evaluate internal vs peripheral mismatches, manage 5-minute grace timers, and compute exact vs time-range CCTV windows; update Kasir frontend `hardware_checker/index.js` to present partitioned Internal Hardware and Peripheral status cards responsive across all screen sizes.

**Tech Stack:** Python 3.11, Flask, SQLAlchemy, SQLite/MySQL, Pytest, Tailwind CSS Responsive Classes, Vanilla JS (Kasir Dashboard), Rust (WarnetAgent Monitor).

**Spec:** `docs/superpowers/specs/2026-09-23-peripheral-and-hardware-checker-smart-cctv-design.md`

## Global Constraints
- Server-Centric: Client UI remains zero-intrusive without warning popups.
- 5-Minute Grace Period: Peripherals disconnected for &le; 300 seconds must auto-resolve without firing theft alerts.
- Smart CCTV Timestamps: Internal hardware changes format as shutdown-to-boot time ranges; live peripheral disconnects format as exact timestamps (`23:55`).
- Offline State: When a PC is shut down / offline, no telemetry is processed and no false mismatch alarms are triggered.
- Responsive Design: Full responsiveness across `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), and `2xl` (1536px) without horizontal scrollbar or clipped text.

---

### Task 1: Database Model & Migration for Peripherals & CCTV Tracking

**Files:**
- Modify: `app/models/hardware/hardware.py`
- Create: `migrations/versions/b7e2c91a4f01_add_peripherals_and_cctv_to_hardware.py`
- Test: `tests/test_peripheral_model.py`

**Interfaces:**
- Consumes: `HardwareMonitor` model base
- Produces: `peripherals_baseline`, `peripherals_current`, `peripherals_mismatch`, `peripherals_mismatch_desc`, `peripherals_mismatch_time`, `peripherals_disconnect_tracker`, `cctv_reference_window`

- [ ] **Step 1: Write failing test for HardwareMonitor model new columns**

```python
# tests/test_peripheral_model.py
from app.models import db, HardwareMonitor, PC

def test_hardware_monitor_peripherals_fields(app):
    with app.app_context():
        pc = PC.query.first()
        monitor = HardwareMonitor(
            pc_id=pc.id,
            peripherals_baseline='{"Headset": "HyperX Cloud II"}',
            peripherals_current='{"Headset": "HyperX Cloud II"}',
            peripherals_mismatch=False,
            peripherals_mismatch_desc=None,
            peripherals_disconnect_tracker=None
        )
        db.session.add(monitor)
        db.session.commit()
        
        fetched = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
        assert fetched.peripherals_baseline is not None
        d = fetched.to_dict()
        assert "peripherals_baseline" in d
        assert "peripherals_mismatch" in d
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_peripheral_model.py -v`  
Expected: FAIL due to missing columns/attributes on `HardwareMonitor`.

- [ ] **Step 3: Update `HardwareMonitor` in `app/models/hardware/hardware.py` and create migration**

```python
# In app/models/hardware/hardware.py
peripherals_baseline = db.Column(db.Text, nullable=True)
peripherals_current = db.Column(db.Text, nullable=True)
peripherals_mismatch = db.Column(db.Boolean, default=False)
peripherals_mismatch_desc = db.Column(db.Text, nullable=True)
peripherals_mismatch_time = db.Column(db.DateTime, nullable=True)
peripherals_disconnect_tracker = db.Column(db.Text, nullable=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_peripheral_model.py -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/models/hardware/hardware.py migrations/ tests/test_peripheral_model.py
git commit -m "feat(hardware): add peripheral baseline and CCTV tracking fields to HardwareMonitor"
```

---

### Task 2: Service Layer Logic for Peripheral Disconnect Grace Period & Smart CCTV Windows

**Files:**
- Modify: `app/services/hardware/hardware_service.py`
- Create: `tests/test_peripheral_service_logic.py`

**Interfaces:**
- Consumes: `HardwareService.process_hardware_metric(client_ip, data)`, `HardwareService.update_pc_baseline(pc_id)`
- Produces: 5-minute disconnect evaluation, CCTV range formatting, auto-resolution on reconnection

- [ ] **Step 1: Write failing unit tests for 5-minute grace period & CCTV windows**

```python
# tests/test_peripheral_service_logic.py
from datetime import datetime, timedelta, timezone
from app.services.hardware.hardware_service import HardwareService
from app.models import HardwareMonitor, PC, db

def test_peripheral_disconnect_grace_period_under_5_minutes(app):
    with app.app_context():
        # Setup PC & baseline with Mouse, Keyboard, Headset
        ...
        # Payload missing Headset for 2 minutes -> Mismatch is False, pending tracker is active
        ...
        # Payload reconnecting Headset -> Pending tracker cleared, Mismatch remains False
        ...

def test_peripheral_disconnect_exceeds_5_minutes_triggers_alert(app):
    with app.app_context():
        # Missing for > 300 seconds -> Mismatch becomes True, mismatch_time set to disconnect time
        ...

def test_internal_hardware_shutdown_range_cctv_calculation(app):
    with app.app_context():
        # PC shut down at 22:00, boots next day with swapped GPU at 08:00
        # Formats CCTV text: "Cek CCTV dari tanggal 29 Sep 22:00 s/d 30 Sep 08:00"
        ...
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_peripheral_service_logic.py -v`  
Expected: FAIL.

- [ ] **Step 3: Implement peripheral evaluation and CCTV formatting in `HardwareService`**

Implement in `app/services/hardware/hardware_service.py`:
1. `_evaluate_internal_hardware_mismatch(hardware, baseline, serials, last_shutdown_time)`
2. `_evaluate_peripherals_mismatch(hardware, baseline_periph, curr_periph, now)`
3. Helper `format_cctv_time_window(start_dt, end_dt)`

- [ ] **Step 4: Run tests to verify all test cases pass**

Run: `pytest tests/test_peripheral_service_logic.py -v`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/hardware/hardware_service.py tests/test_peripheral_service_logic.py
git commit -m "feat(hardware): implement peripheral 5m grace period and smart CCTV reference logic"
```

---

### Task 3: Responsive Kasir Frontend UI Partitioning (All Tailwind Breakpoints)

**Files:**
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js`
- Modify: `app/templates/kasir/hardware_checker.html`

**Interfaces:**
- Consumes: `GET /api/v1/kasir/monitor/all` data response
- Produces: Dual UI sections per PC (Internal Specs vs Peripherals), 5m countdown badge, CCTV reference callouts, fully responsive on `sm`, `md`, `lg`, `xl`, `2xl`.

- [ ] **Step 1: Update `HardwareChecker.render(data)` with Tailwind Responsive Breakpoints**

Implement responsive grid & flex classes:
- **Card Container**: `w-full max-w-7xl mx-auto space-y-4`
- **PC Card Header**: `flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4`
- **Action Buttons**: `flex flex-wrap sm:flex-nowrap items-center gap-2 self-stretch sm:self-auto shrink-0`
- **Internal Specs vs Peripherals Layout**:
  - `grid grid-cols-1 xl:grid-cols-12 gap-4`
  - Internal Specs Panel: `xl:col-span-7 p-4 bg-[#080808] border border-[#171717] rounded-xl`
  - Peripherals Panel: `xl:col-span-5 p-4 bg-[#080808] border border-[#171717] rounded-xl`
- **Peripherals Grid**: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2.5`
- **Collapsible Full Specs Matrix**: `grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-[#1a1a1a]`
- **CCTV Alert Banner**: `p-3.5 sm:p-4 bg-red-950/30 border border-red-500/20 rounded-lg text-xs sm:text-sm`

- [ ] **Step 2: Responsive Visual & Breakpoint Validation**

Verify rendering on viewports:
- Mobile (< 640px): No horizontal overflow, buttons full width/touch-friendly.
- `sm` (640px): Header row aligned, peripheral cards in 2 columns.
- `md` (768px): Specs side-by-side, peripheral cards in 3 columns.
- `lg` (1024px): Standard desktop tablet/laptop layout.
- `xl` (1280px): Partitioned 12-column grid (7 internal / 5 peripheral).
- `2xl` (1536px): Ultra-wide layout centered with `max-w-7xl`.

- [ ] **Step 3: Commit**

```bash
git add app/static/js/kasir/modules/hardware_checker/index.js app/templates/kasir/hardware_checker.html
git commit -m "feat(kasir-ui): implement responsive hardware and peripheral checker across all breakpoints (sm-2xl)"
```

---

### Task 4: Full End-to-End Regression & Verification

**Files:**
- Test: `tests/test_hardware_checker_security.py`
- Test: `tests/test_monitor_vnc_routes.py`
- Test: `tests/test_peripheral_service_logic.py`

- [ ] **Step 1: Run complete test suite**

Run: `pytest -v`  
Expected: All tests passing (131+ tests).

- [ ] **Step 2: Commit & update documentation**

```bash
git add docs/
git commit -m "docs: document smart CCTV reference windows, peripheral baseline checker, and responsive UI in v1.7.0"
```

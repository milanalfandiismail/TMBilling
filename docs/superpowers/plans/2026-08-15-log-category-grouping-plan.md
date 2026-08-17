# Log Category Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengelompokkan seluruh 130 log audit/activity TMBilling ke dalam 15 Domain Kategori Kanonikal dengan integrasi field terstruktur, backward compatibility, and UI filtering yang sinkron.

**Architecture:** Menerapkan central taxonomy dictionary `ACTION_TO_CATEGORY_MAP` di `app/utils/logger.py` yang diekspor ke `LogAuditService` dan `write_log` untuk pengisian field `category` terstruktur serta pencarian filter O(1). Sinkronisasi tampilan filter tab dan badge di UI dashboard kasir.

**Tech Stack:** Python 3.14, Flask, Pytest, Vanilla JS, Tailwind CSS / HTML Templates.

**Spec:** `docs/superpowers/specs/2026-08-15-log-category-grouping-design.md`

## Global Constraints
- Seluruh 130 event aksi yang ada di codebase harus memiliki mapping eksplisit ke salah satu dari 15 kategori kanonikal.
- Format penulisan log JSON wajib menyertakan field `"category": "<CATEGORY_NAME>"`.
- Log legacy atau log tanpa field `category` harus otomatis di-resolve secara dinamis saat dibaca oleh `LogAuditService`.
- Filter kategori pada `LogAuditService.get_system_logs` harus kompatibel dengan nama kategori baru maupun legacy (`Semua`, `sistem`, `transaksi`, `sesi`, `blackout`, `AUTHENTICATION`, dll).

---

### Task 1: Taxonomy Definition & Core Logger Category Resolution

**Files:**
- Modify: `app/utils/logger.py`
- Test: `tests/test_audit_category_grouping.py`

**Interfaces:**
- Produces: `ACTION_TO_CATEGORY_MAP: dict[str, str]`, `get_action_category(action: str) -> str`
- Modifies: `write_log(aksi, detail, user="kasir", detail_json=None, category=None)` to include `"category"` in output JSON

- [ ] **Step 1: Write failing unit test for logger category mapping**
Buat `tests/test_audit_category_grouping.py` yang memvalidasi mapping action dan output `write_log`.

- [ ] **Step 2: Run test to verify it fails**
Run: `$env:PYTHONPATH="c:\Project GIT\TMBilling"; $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe -m pytest tests/test_audit_category_grouping.py -v`
Expected: FAIL (AttributeError / KeyError)

- [ ] **Step 3: Implement ACTION_TO_CATEGORY_MAP & category resolution in `app/utils/logger.py`**
Tambahkan kamus pemetaan 130 aksi ke 15 kategori kanonikal dan integrasikan ke dalam `write_log`.

- [ ] **Step 4: Run test to verify it passes**
Run: `$env:PYTHONPATH="c:\Project GIT\TMBilling"; $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe -m pytest tests/test_audit_category_grouping.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**
`git add app/utils/logger.py tests/test_audit_category_grouping.py`
`git commit -m "feat(logger): implement canonical category taxonomy map and structured log category field"`

---

### Task 2: Service-Layer Categorization & Filtering Integration

**Files:**
- Modify: `app/services/report/log_audit_service.py`
- Test: `tests/test_audit_category_grouping.py`

**Interfaces:**
- Modifies: `LogAuditService.get_system_logs(limit=500, filter_text="", kategori="")`

- [ ] **Step 1: Write unit test for LogAuditService category filtering and resolution**
Tambahkan test case yang memverifikasi query berdasarkan kategori kanonikal (`AUTHENTICATION`, `PAYMENT_BILLING`, dll) dan fallback log lama.

- [ ] **Step 2: Run test to verify it fails**
Run: `$env:PYTHONPATH="c:\Project GIT\TMBilling"; $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe -m pytest tests/test_audit_category_grouping.py -k test_service_category_filtering -v`
Expected: FAIL

- [ ] **Step 3: Update `LogAuditService.get_system_logs` in `app/services/report/log_audit_service.py`**
Gunakan `ACTION_TO_CATEGORY_MAP` dan dukung filtering kategori kanonikal maupun legacy alias.

- [ ] **Step 4: Run test to verify it passes**
Run: `$env:PYTHONPATH="c:\Project GIT\TMBilling"; $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe -m pytest tests/test_audit_category_grouping.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**
`git add app/services/report/log_audit_service.py tests/test_audit_category_grouping.py`
`git commit -m "feat(audit): integrate canonical category taxonomy into LogAuditService query and filtering"`

---

### Task 3: Frontend UI Category Filter & Badge Styling Sync

**Files:**
- Modify: `app/templates/kasir/tabs/log.html`
- Modify: `app/static/js/kasir/modules/log/index.js`
- Test: `tests/test_audit_category_grouping.py`

**Interfaces:**
- Updates UI category buttons and color badge mapping in `Log.render`

- [ ] **Step 1: Update tab buttons in `app/templates/kasir/tabs/log.html`**
Tambahkan tombol kategori kanonikal yang mudah di-scroll di bilah tab bar.

- [ ] **Step 2: Update category badge colors and renderer in `app/static/js/kasir/modules/log/index.js`**
Berikan styling badge warna yang jelas dan rapi untuk masing-masing dari 15 kategori kanonikal.

- [ ] **Step 3: Update seed tool `tools/seed_audit_logs.py` to use new categories**
Pastikan generator seed menyertakan sample data dari setiap kategori baru.

- [ ] **Step 4: Run full test suite to verify everything passes**
Run: `$env:PYTHONPATH="c:\Project GIT\TMBilling"; $env:PYTHONIOENCODING="utf-8"; .\.venv\Scripts\python.exe -m pytest -v`
Expected: All 13+ tests PASS

- [ ] **Step 5: Commit changes**
`git add app/templates/kasir/tabs/log.html app/static/js/kasir/modules/log/index.js tools/seed_audit_logs.py`
`git commit -m "feat(ui): update audit log tab filters and badges with canonical taxonomy"`

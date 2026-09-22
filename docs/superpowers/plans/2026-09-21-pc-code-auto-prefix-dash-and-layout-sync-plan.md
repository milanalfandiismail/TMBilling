# PC Code Auto-Dash Prefix & Form Layout Sync Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menetapkan batas panjang Kode PC maksimal 11 karakter (contoh: `MANTAP-1000`), menerapkan auto-dash pada prefix (jika user isi `MANTAP` otomatis menjadi `MANTAP-1`), dan menyelaraskan layout UI/UX form Tambah PC Single & Batch.

**Architecture:** Helper normalisasi kode di `PCService` backend, update tests di `tests/test_pc_validation.py`, perombakan layout form dan live preview di `pc_modal.js` dan `index.js`.

**Tech Stack:** Python 3.14 / Flask, SQLAlchemy, Vanilla JS (ES6+), Tailwind CSS, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-21-pc-code-auto-prefix-dash-and-layout-sync-design.md`

## Global Constraints
- Batas maksimal Kode PC: 11 karakter.
- Batas maksimal Prefix: 6 karakter.
- Auto-dash: jika prefix tidak diakhiri `-`, otomatis ditambahkan `-` sebelum nomor.
- Jangan commit ke Git secara otomatis sampai user memerintahkan.

---

### Task 1: Backend Auto-Dash & 11-Char Validation

**Files:**
- Modify: `app/services/pc/pc_service.py`
- Modify: `tests/test_pc_validation.py`

- [ ] **Step 1: Update unit tests for 11-character limit and auto-dash**
  - Tes kode 11 karakter valid (`MANTAP-1000`).
  - Tes kode 12 karakter ditolak (`MANTAP-10000`).
  - Tes batch generation dengan prefix `MANTAP` $\to$ menghasilkan `MANTAP-1`, `MANTAP-2`.
- [ ] **Step 2: Implement auto-dash & 11-char limit in `PCService`**
  - Di `create()`: dukung `kode` atau `prefix` + `nomor` dengan batas `<= 11`.
  - Di `update()`: batas `<= 11`.
  - Di `create_batch()`: bersihkan prefix `clean_prefix = prefix.rstrip("-_")` dan generate `f"{clean_prefix}-{i}"` jika ada nomor, dengan batas panjang `<= 11`.
- [ ] **Step 3: Run pytest to verify backend tests pass**
  Run: `.venv\Scripts\python -m pytest tests/test_pc_validation.py -v`

---

### Task 2: Frontend Form Layout Synchronization & Live Preview

**Files:**
- Modify: `app/static/js/kasir/modules/pc/pc_modal.js`
- Modify: `app/static/js/kasir/modules/pc/index.js`

- [ ] **Step 1: Redesign `PCModal.showAddModal()`**
  - Selaraskan grid 3-kolom untuk Prefix (Maks 6), Nomor Unit, dan Grup Unit.
  - Tambahkan live preview badge: `Preview: MANTAP-1`.
  - Grid 2-kolom untuk IP Address dan MAC Address.
  - Nama Unit (opsional).
- [ ] **Step 2: Enhance `PCModal.showAddBatchModal()`**
  - Update layout dengan live preview badge: `Preview Rentang: MANTAP-1 s/d MANTAP-10 (10 Unit)`.
- [ ] **Step 3: Update `PC.add()`, `PC.addBatch()`, `PC.doEdit()` logic**
  - Format kode otomatis di frontend sebelum kirim request.
  - Event listener live input untuk update badge preview secara instan.

---

### Task 3: Verification & Indexing

- [ ] **Step 1: Rebuild CSS**
  Run: `npm run build:css`
- [ ] **Step 2: Run all tests**
  Run: `.venv\Scripts\python -m pytest tests/test_pc_validation.py tests/test_batch_sesi_routes.py -v`
- [ ] **Step 3: Reindex codebase memory MCP**

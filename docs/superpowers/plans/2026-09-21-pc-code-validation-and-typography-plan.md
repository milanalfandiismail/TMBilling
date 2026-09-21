# PC Code Validation & Dynamic Card Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerapkan validasi ketat batas panjang kode PC (maksimal 10 karakter untuk mendukung ribuan PC seperti `VVIP-2000`) di backend & frontend, serta penyesuaian ukuran tipografi kartu PC dashboard agar tetap rapi dan tidak terpotong di semua breakpoint.

**Architecture:** Validasi regex & panjang karakter di `PCService`, perlindungan form dengan `maxlength` dan client-side check di modul PC kasir, serta adaptif font-size di `dashboard_compact.js`.

**Tech Stack:** Python 3.14 / Flask, SQLAlchemy, Vanilla JavaScript (ES6+), Tailwind CSS, Pytest.

**Spec:** `docs/superpowers/specs/2026-09-21-pc-code-validation-and-typography-design.md`

## Global Constraints
- Batas maksimal Kode PC: 10 karakter.
- Batas maksimal Prefix Batch: 6 karakter.
- Karakter yang diizinkan: `^[A-Za-z0-9\-_]+$`.
- Selalu diubah menjadi huruf kapital (UPPERCASE).
- Strictly wait for user command before any git commit.

---

### Task 1: Backend Validation & Unit Tests

**Files:**
- Create: `tests/test_pc_validation.py`
- Modify: `app/services/pc/pc_service.py`

- [ ] **Step 1: Write the failing unit tests for PC code validation**
  Tulis test di `tests/test_pc_validation.py` untuk menguji:
  - Sukses registrasi PC dengan kode valid (contoh: `PC-01`, `VVIP-2000` - 9 karakter).
  - Gagal registrasi jika kode > 10 karakter (contoh: `SULTANVIP-2000` - 14 karakter) dengan error 400.
  - Gagal registrasi jika kode mengandung karakter ilegal (contoh: `PC#01` atau `PC 01`).
  - Gagal registrasi batch jika `prefix + end_num` > 10 karakter.
  - Gagal edit/update jika kode baru > 10 karakter.

- [ ] **Step 2: Run test to verify failures**
  Jalankan: `.venv\Scripts\python -m pytest tests/test_pc_validation.py -v`
  Expected: FAIL pada validasi panjang > 10 karakter.

- [ ] **Step 3: Implement validation in `app/services/pc/pc_service.py`**
  - Di `create()`:
    - Tambahkan validasi:
      ```python
      if len(kode) > 10:
          raise ValueError("Kode PC maksimal 10 karakter")
      import re
      if not re.match(r'^[A-Za-z0-9\-_]+$', kode):
          raise ValueError("Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)")
      ```
  - Di `update()`:
    - Tambahkan validasi yang sama pada `kode_baru`.
  - Di `create_batch()`:
    - Tambahkan validasi panjang `prefix` (maks 6 karakter).
    - Tambahkan validasi setiap `kode` yang di-generate agar `<= 10` karakter.

- [ ] **Step 4: Run tests to verify they pass**
  Jalankan: `.venv\Scripts\python -m pytest tests/test_pc_validation.py -v`
  Expected: All PASSED.

---

### Task 2: Frontend Form Constraints & Toast Validation

**Files:**
- Modify: `app/static/js/kasir/modules/pc/pc_modal.js`
- Modify: `app/static/js/kasir/modules/pc/index.js`

- [ ] **Step 1: Add `maxlength` attributes in `pc_modal.js`**
  - Input `#modal-pc-kode`: tambahkan `maxlength="10"`.
  - Input `#edit-pc-kode`: tambahkan `maxlength="10"`.
  - Input `#modal-batch-prefix`: tambahkan `maxlength="6"`.

- [ ] **Step 2: Add validation guards in `PC` controller (`app/static/js/kasir/modules/pc/index.js`)**
  - Di `PC.add()`:
    ```javascript
    if (data.kode.length > 10) return Toast.error('Kode PC maksimal 10 karakter');
    if (!/^[A-Za-z0-9\-_]+$/.test(data.kode)) return Toast.error('Kode PC hanya boleh huruf, angka, (-), dan (_)');
    ```
  - Di `PC.doEdit()`:
    ```javascript
    if (data.kode.length > 10) return Toast.error('Kode PC maksimal 10 karakter');
    if (!/^[A-Za-z0-9\-_]+$/.test(data.kode)) return Toast.error('Kode PC hanya boleh huruf, angka, (-), dan (_)');
    ```
  - Di `PC.addBatch()`:
    ```javascript
    if (data.prefix.length > 6) return Toast.error('Prefix Kode PC maksimal 6 karakter');
    if ((data.prefix + data.end_num).length > 10) return Toast.error('Kombinasi prefix dan nomor akhir melebihi 10 karakter');
    ```

---

### Task 3: Dynamic Typography on Dashboard Compact Card

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`

- [ ] **Step 1: Implement dynamic font-size in `renderCompactCard`**
  - Ganti class ukuran font hardcoded pada baris Row 1 (Kode PC) menjadi adaptif:
    ```javascript
    const kodeFontSizeClass = pc.kode.length > 7 ? 'text-xs lg:text-sm xl:text-base' : 'text-sm lg:text-base xl:text-lg';
    ```
  - Gunakan `${kodeFontSizeClass}` pada elemen Kode PC:
    ```html
    <span class="${kodeFontSizeClass} font-black text-neutral-100 tracking-tight truncate">${pc.kode}</span>
    ```

- [ ] **Step 2: Rebuild CSS**
  Jalankan: `npm run build:css`

---

### Task 4: Verification & MCP Index Synchronization

- [ ] **Step 1: Run full pytest suite**
  Jalankan: `.venv\Scripts\python -m pytest tests/test_pc_validation.py tests/test_batch_sesi_routes.py -v`
  Expected: All tests pass cleanly.

- [ ] **Step 2: Update codebase-memory index**
  Panggil MCP `index_repository`.

# [Feature] Natural Sorting Alfanumerik Dinamis pada Monitor Screenshot & Monitor PC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan algoritma natural alphanumeric sorting dinamis (seperti `TM-1`, `TM-2`, `TM-3` ... `TM-10`) pada tab **Monitor Screenshot**, **Hardware Checker**, dan **Hardware Monitor** di frontend kasir serta backend API.

**Architecture:** Menerapkan pengurutan natural ganda:
1. **Frontend JS**: Menggunakan `localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })` pada render grid screenshot dan tabel monitor.
2. **Backend Python**: Menggunakan `re.split(r'(\d+)', kode)` natural sort key pada endpoint `/api/v1/kasir/monitor/screenshot/all` dan `/api/v1/kasir/monitor/all`.

**Tech Stack:** JavaScript (ES6+, `Intl.Collator` / `localeCompare`), Python (Flask, Pytest, Regex).

**Spec:** Kebutuhan pengurutan nama PC dinamis (natural sort) yang konsisten di semua tab kasir.

## Global Constraints
- Sorting harus dinamis dan bekerja untuk semua pola penamaan PC (misal: `TM-1`, `TM-2`, `TM-10`, `PC01`, `VIP-2`, `BILLING-9`, `BILLING-10`).
- Tidak boleh mengubah struktur data response API yang sudah ada agar backward-compatible.
- Semua unit test backend (pytest) harus tetap 100% lulus (31/31 passed).

---

## Proposed Changes

### Component: Frontend Kasir Modules

#### [MODIFY] [screenshot/index.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/screenshot/index.js)
- Pada method `renderGrid()`: lakukan `data.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }))`.
- Pada method `populateGroupFilter()`: urutkan grup dengan `localeCompare` numerik.

#### [MODIFY] [hardware_checker/index.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/hardware_checker/index.js)
- Pada method `render()`: tambahkan sort natural sebelum rendering card.

#### [MODIFY] [monitor/index.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/monitor/index.js)
- Pada method `renderTable()`: tambahkan sort natural sebelum rendering tabel/kartu.

---

### Component: Backend Routes & Repositories

#### [MODIFY] [monitor_routes.py](file:///c:/Project%20GIT/TMBilling/app/routes/monitor/monitor_routes.py)
- Pada endpoint `/screenshot/all`: lakukan natural sort pada daftar `pcs` berdasarkan `(pc.grup_id, natural_sort_key(pc.kode))`.
- Pada endpoint `/all`: lakukan natural sort pada daftar hardware monitor berdasarkan `(m.pc.grup_id if m.pc else 0, natural_sort_key(m.pc.kode if m.pc else ''))`.

---

### Component: Testing

#### [NEW] [tests/test_natural_sorting.py](file:///c:/Project%20GIT/TMBilling/tests/test_natural_sorting.py)
- Pengujian unit test untuk verifikasi algoritma natural sort backend dengan variasi pola kode PC (`TM-1`, `TM-2`, `TM-10`, `PC-9`, `PC-10`).

---

## Tasks

### Task 1: Buat Unit Test untuk Natural Sorting
**Files:**
- Create: `tests/test_natural_sorting.py`

- [ ] **Step 1: Tulis unit test untuk verifikasi sorting natural di backend**
- [ ] **Step 2: Jalankan pytest untuk memvalidasi test baru**

### Task 2: Implementasi Natural Sorting di Backend Routes
**Files:**
- Modify: `app/routes/monitor/monitor_routes.py`

- [ ] **Step 1: Buat helper `natural_sort_key` di `monitor_routes.py` atau utils**
- [ ] **Step 2: Terapkan sorting natural pada `/screenshot/all` dan `/all`**
- [ ] **Step 3: Jalankan pytest untuk memastikan semua test lulus**

### Task 3: Implementasi Natural Sorting di Frontend JS Modules
**Files:**
- Modify: `app/static/js/kasir/modules/screenshot/index.js`
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js`
- Modify: `app/static/js/kasir/modules/monitor/index.js`

- [ ] **Step 1: Tambahkan `localeCompare` numerik pada `screenshot/index.js`**
- [ ] **Step 2: Tambahkan `localeCompare` numerik pada `hardware_checker/index.js`**
- [ ] **Step 3: Tambahkan `localeCompare` numerik pada `monitor/index.js`**

### Task 4: Verifikasi & Finalisasi
- [ ] **Step 1: Jalankan seluruh test suite pytest**
- [ ] **Step 2: Rebuild CSS via `npm run build:css`**
- [ ] **Step 3: Commit dan push ke branch feature**

---

## Verification Plan

### Automated Tests
- `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
- Pastikan seluruh 31+ test lulus tanpa error.

### Manual Verification
- Buka tab Monitor Screenshot di kasir dengan PC bernama `TM-1`, `TM-2`, `TM-10`.
- Pastikan urutan tampilan menjadi `TM-1`, `TM-2`, ..., `TM-10` (bukan `TM-1`, `TM-10`, `TM-2`).

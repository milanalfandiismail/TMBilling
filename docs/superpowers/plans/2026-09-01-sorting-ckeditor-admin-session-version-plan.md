# Rencana Implementasi: Perbaikan Sorting PC, CKEditor Pengumuman/Aturan (Hapus Default), Kontrol Sesi Admin PC Client (Admin & SYSTEM), dan Versi 1.5.8

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki natural sorting PC, mengintegrasikan CKEditor untuk Pengumuman & Aturan dan menghapus semua default aturan hardcoded di backend, memastikan render murni CKEditor HTML di Kiosk Client & Landing Page, menambahkan kontrol Logout Sesi Admin (Admin & SYSTEM) PC Client dari Kasir Dashboard, serta menaikkan versi aplikasi ke 1.5.8.

**Architecture:** Natural comparator `localeCompare`; reuse vendor CKEditor 5 dari modul Tutorial; hapus hardcoded default rules di backend; implementasi server-side HTML sanitization pada `helpers.py`; sediakan tombol `logoutAdmin` untuk PC dalam mode admin di Dashboard Kasir; perbarui backend heartbeat client agar lock PC jika mode admin dimatikan kasir (untuk role `admin` & `emergency`); perbarui viewer HTML di Kiosk Client dan Landing Page; sinkronisasi berkas versi aplikasi.

**Tech Stack:** JavaScript (ES6+), Python 3 / Flask, HTML5 / Tailwind CSS, Rust / Cargo, Tauri.

**Spec:** `docs/superpowers/specs/2026-09-01-sorting-ckeditor-admin-session-version-design.md`

---

### Task 1: Natural Sorting PC pada Ketersediaan PC & TV Signage

**Files:**
- Modify: `app/static/js/member/livepc.js`
- Modify: `app/static/js/public/tv.js`
- Modify: `app/static/js/public/tv_static.js`

- [ ] **Step 1: Update `livepc.js`**
  Urutkan item `pcsInGroup` dan daftar `uniqueGroups` secara natural:
  ```javascript
  pcsInGroup.sort((a, b) => (a.kode || a.nama || '').localeCompare(b.kode || b.nama || '', undefined, { numeric: true, sensitivity: 'base' }));
  ```
- [ ] **Step 2: Update `tv.js` & `tv_static.js`**
  Urutkan `groupPcs` dan `pcGroupNames` secara natural.

---

### Task 2: Server-Side HTML Sanitizer Helper & Hapus Default Rules Hardcoded

**Files:**
- Modify: `app/utils/helpers.py`
- Modify: `app/routes/settings/settings_routes.py`
- Modify: `app/__init__.py`
- Modify: `app/services/settings/settings_service.py`
- Modify: `app/routes/client/client_routes.py`
- Modify: `app/services/public/tv_service.py`

- [ ] **Step 1: Implement `sanitize_html(html_str)` di `helpers.py`**
- [ ] **Step 2: Panggil `sanitize_html` pada endpoint update setting `warnet_announcement` di `settings_routes.py`**
- [ ] **Step 3: Hapus string default rules hardcoded di `__init__.py`, `settings_service.py`, `client_routes.py`, dan `tv_service.py`**

---

### Task 3: Integrasi CKEditor & Perenderan Murni HTML di Kasir, Client, dan Landing

**Files:**
- Modify: `app/templates/kasir/base.html`
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`
- Modify: `app/templates/public/landing/index.html`
- Modify: `WarnetClient/TMBillingTauri/src/kiosk/kiosk.js`

- [ ] **Step 1: Tambahkan CKEditor 5 di `base.html`**
- [ ] **Step 2: Inisialisasi CKEditor di `settings/index.js` & `settings.html`**
- [ ] **Step 3: Update `landing/index.html` untuk render murni CKEditor HTML (`{{ warnet_rules | safe }}` dalam `prose prose-invert`)**
- [ ] **Step 4: Update `WarnetClient/TMBillingTauri/src/kiosk/kiosk.js` untuk inject CKEditor HTML langsung ke `#rules-container`**

---

### Task 4: Kontrol Logout / Tutup Sesi Admin (Admin & SYSTEM) PC Client dari Dashboard Kasir

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`
- Modify: `app/services/client/client_service.py`

- [ ] **Step 1: Tampilkan tombol Logout Admin di Context Menu `dashboard/index.js`**
- [ ] **Step 2: Tampilkan tombol Logout Admin di Modal Detail PC `dashboard_detail_modal.js`**
- [ ] **Step 3: Update `ClientService.get_status_response` di `client_service.py` untuk lock client saat admin mode dimatikan**

---

### Task 5: Upgrade Versi Aplikasi ke 1.5.8

**Files:**
- Modify: `app/config.py`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `WarnetClient/TMBillingTauri/package.json`
- Modify: `WarnetClient/TMBillingTauri/package-lock.json`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/tauri.conf.json`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/Cargo.toml`
- Modify: `WarnetAgent/TMBilling_Uninstaller/Cargo.toml`
- Modify: `WarnetAgent/mtm/Cargo.toml`
- Modify: `WarnetAgent/MGCTM/Cargo.toml`
- Modify: `WarnetAgent/TMBilling_Monitor/Cargo.toml`
- Modify: `app/templates/kasir/base.html` (cache query `?v=158`)

- [ ] **Step 1: Sinkronisasi seluruh string versi aplikasi ke `1.5.8`**

---

### Task 6: Testing & Final Verification

- [ ] **Step 1: Pytest Unit & Integration Tests**
- [ ] **Step 2: Build CSS**
- [ ] **Step 3: Verifikasi Sorting, CKEditor Render Murni, dan Logout Admin**

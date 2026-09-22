# Centralized Versioning from `config.py` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan `app/config.py` (`Config.VERSION`) sebagai Single Source of Truth (master) untuk seluruh komponen Python, template HTML, CSS cache-busting, dan JavaScript, serta mengeliminasi hardcoded version strings.

**Architecture:** 
1. `app/config.py` memegang master `VERSION = "1.6.1"` beserta helper methods (`get_version_tag()`, `get_cache_version()`).
2. Flask Context Processor di `app/__init__.py` menyediakan variabel global Jinja (`version`, `app_version`, `v_cache`, `warnet_title`, `format_display`).
3. Template HTML menggunakan `?v={{ v_cache }}` untuk asset static (CSS & JS), dan menyuntikkan `window.APP_VERSION` ke client-side context.
4. Python backend services & routes (`branch_proxy_service.py`, `branch_service.py`, `branch_routes.py`, `migration_routes.py`) mengambil versi dari `Config.VERSION` / `Config.get_version_tag()` secara dinamis.
5. Ekosistem Rust (`tauri.conf.json`, `Cargo.toml`) dan NPM (`package.json`) tetap mengikuti standar alurnya masing-masing.

**Tech Stack:** Python 3.10+, Flask, Jinja2, Vanilla JS, Tailwind CSS, Pytest.

---

### Task 1: Core Config & Flask Context Processor Refactoring
**Files:**
- Modify: `app/config.py`
- Modify: `app/__init__.py`

- [ ] **Step 1: Tambahkan helper method pada `Config` di `app/config.py`**
  - `get_version_tag()` -> format `'v1.6.1'`
  - `get_cache_version()` -> format `'161'` (atau angka string dari VERSION)

- [ ] **Step 2: Update `_register_context_processors` di `app/__init__.py`**
  - Inject `version`, `app_version`, dan `v_cache`

---

### Task 2: Refactor Python Backend Services & Routes
**Files:**
- Modify: `app/services/branch/branch_proxy_service.py`
- Modify: `app/services/branch/branch_service.py`
- Modify: `app/routes/branch/branch_routes.py`
- Modify: `app/routes/settings/migration_routes.py`

- [ ] **Step 1: Ganti hardcoded User-Agent di branch services & routes**
  - Gunakan `f"TMBilling-Relay/{Config.VERSION}"` dan `f"TMBilling-MultiBranch/{Config.VERSION}"`

- [ ] **Step 2: Ganti fallback version di migration routes**
  - Gunakan `Config.get_version_tag()`

---

### Task 3: Refactor HTML Templates to Dynamic `?v={{ v_cache }}` & Expose `window.APP_VERSION`
**Files:**
- Modify: `app/templates/kasir/base.html`
- Modify: `app/templates/kasir/login.html`
- Modify: `app/templates/kasir/settings/whitelist_ip.html`
- Modify: `app/templates/public/member/login.html`
- Modify: `app/templates/public/member/dashboard.html`
- Modify: `app/templates/public/livepc/index.html`
- Modify: `app/templates/public/components/_head.html`
- Modify: `app/templates/public/tv/static.html`
- Modify: `app/templates/public/tv/index.html`

- [ ] **Step 1: Injeksi `window.APP_VERSION` & `<meta name="app-version">` di `base.html`**
- [ ] **Step 2: Ganti seluruh query parameter hardcoded `?v=...` menjadi `?v={{ v_cache }}`**

---

### Task 4: Refactor Frontend JS Dynamic Version
**Files:**
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Gunakan `window.APP_VERSION || 'v1.6.1'` pada dropdown badge cabang**

---

### Task 5: Build CSS & Full Regression Test Suite
- [ ] **Step 1: Jalankan `npm run build:css`**
- [ ] **Step 2: Jalankan pytest (`.venv\Scripts\python.exe -m pytest -o pythonpath=.`) dan pastikan 108 tests lolos**

---

### Task 6: Codebase Indexing & Final Commit
- [ ] **Step 1: Jalankan `index_repository` pada MCP `codebase-memory`**
- [ ] **Step 2: Commit semua perubahan dengan pesan detail Bahasa Indonesia**

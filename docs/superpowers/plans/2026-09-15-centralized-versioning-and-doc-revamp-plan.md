# Centralized Versioning, CHANGELOG & Full Documentation Content Revamp Plan (v1.6.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Menjadikan `app/config.py` (`Config.VERSION`) sebagai Single Source of Truth (master) untuk seluruh komponen Python, template HTML, CSS cache-busting, dan JavaScript tanpa hardcoding.
2. Membuat dokumen `CHANGELOG.md` resmi untuk melacak evolusi fitur dan rilis aplikasi hingga v1.6.1.
3. Melakukan pembaruan menyeluruh pada isi konten seluruh dokumen teknis & user guide (termasuk `README.md`, `PANDUAN_TIGHTVNC.md`, dan seluruh berkas di `docs/*.md`, kecuali folder `docs/superpowers/`) agar akurat mendokumentasikan arsitektur Rust (Tauri client & agent binaries), C# hardware helper, Multi-Cabang Central Control Panel, Web VNC Remote Desktop, Server & Uptime Monitor, dan Chamber Noir UI.

**Architecture:** 
- `app/config.py` memegang master `VERSION = "1.6.1"` beserta helper methods (`get_version_tag()`, `get_cache_version()`).
- Flask Context Processor di `app/__init__.py` menyediakan variabel global Jinja (`version`, `app_version`, `v_cache`, `warnet_title`, `format_display`).
- Template HTML menggunakan `?v={{ v_cache }}` untuk seluruh asset static (CSS & JS), dan menyuntikkan `window.APP_VERSION` ke client-side context.
- Python backend services & routes (`branch_proxy_service.py`, `branch_service.py`, `branch_routes.py`, `migration_routes.py`) mengambil versi dari `Config.VERSION` / `Config.get_version_tag()` secara dinamis.
- Ekosistem Client & Agent berbasis Rust (`WarnetClient/TMBillingTauri`, `MGCTM`, `TMBilling_Monitor`, `mtm`, `TMBilling_Uninstaller`) dengan C# helper khusus untuk sensor hardware (`HardwareHelper.cs`, `TMLHMService.cs`).
- Dokumen `CHANGELOG.md` dibuat rapi dan seluruh berkas `docs/*.md` diperbarui kontennya secara mendalam sesuai rilis v1.6.1.

**Tech Stack:** Python 3.10+, Flask, Jinja2, Rust (Tauri / Cargo), C# (Hardware Sensor Helper), Vanilla JS, Tailwind CSS, Markdown, Pytest.

---

## Proposed Changes

### Task 1: Core Config & Flask Context Processor Refactoring
**Files:**
- Modify: `app/config.py`
- Modify: `app/__init__.py`

- [ ] **Step 1: Tambahkan helper method pada `Config` di `app/config.py`**
  ```python
  VERSION = "1.6.1"
  VERSION_NAME = "Multi-Branch Nexus"

  @classmethod
  def get_version_tag(cls) -> str:
      return f"v{cls.VERSION}" if not str(cls.VERSION).startswith("v") else str(cls.VERSION)

  @classmethod
  def get_cache_version(cls) -> str:
      return "".join(c for c in str(cls.VERSION) if c.isdigit())
  ```
- [ ] **Step 2: Update `_register_context_processors` di `app/__init__.py`**
  Menyediakan `version` (`v1.6.1`), `app_version` (`1.6.1`), `v_cache` (`161`), `warnet_title`, `plugin_menus`, `format_display`.

---

### Task 2: Refactor Python Backend Services & Routes to Use Master Config
**Files:**
- Modify: `app/services/branch/branch_proxy_service.py`
- Modify: `app/services/branch/branch_service.py`
- Modify: `app/routes/branch/branch_routes.py`
- Modify: `app/routes/settings/migration_routes.py`

- [ ] **Step 1: Ganti hardcoded User-Agent di branch services & routes**
  Gunakan `f"TMBilling-Relay/{Config.VERSION}"` dan `f"TMBilling-MultiBranch/{Config.VERSION}"`.
- [ ] **Step 2: Ganti fallback version di migration routes**
  Gunakan `Config.get_version_tag()`.

---

### Task 3: Refactor Jinja Templates to Dynamic `?v={{ v_cache }}` & Expose `window.APP_VERSION`
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

- [ ] **Step 1: Injeksi `<meta name="app-version" content="{{ version }}">` dan `<script>window.APP_VERSION = "{{ version }}";</script>` di `base.html`**
- [ ] **Step 2: Ganti seluruh query parameter hardcoded `?v=160` / `?v=161` menjadi `?v={{ v_cache }}`**

---

### Task 4: Refactor Frontend JS Dynamic Version
**Files:**
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Gunakan `window.APP_VERSION || 'v1.6.1'` pada badge dropdown cabang**

---

### Task 5: Create CHANGELOG.md & Comprehensive Documentation Content Revamp (v1.6.1)

#### Subtask 5.1: Create Official CHANGELOG.md
**Files:**
- Create: `CHANGELOG.md`
- [ ] **Step 1: Tulis rekam jejak rilis lengkap dari v1.0.0 hingga v1.6.1**:
  - `v1.6.1`: Sentralisasi master config versioning, dynamic asset cache-busting, pembersihan dashboard stats, responsive member refill modal, sidebar submenu flex alignment fix, multi-branch state reset.
  - `v1.6.0`: Multi-Cabang Central Control Panel (Relay Proxy, Inbound Connections, Switcher), Web VNC Remote Desktop Client, Dynamic QRIS.
  - `v1.5.x`: Server Hardware Monitor (TMLHMService), PC Uptime Tracker, Maintenance Ticket System, Audit Logs Category Grouping, Cloudflare Tunnel, Google Drive Backup, Multi-Timezone.

#### Subtask 5.2: Root Documentation (`README.md`, `PANDUAN_TIGHTVNC.md`, `PRIVACY.md`)
**Files:**
- Modify: `README.md`
- Modify: `PANDUAN_TIGHTVNC.md`
- Modify: `PRIVACY.md`
- [ ] **Step 1: `README.md`**:
  - Perbarui badge versi `v1.6.1` dan ringkasan arsitektur (Backend Python Flask + Client/Agent Rust Tauri & MTM/MGCTM + C# HardwareHelper).
  - Tambahkan fitur Multi-Cabang, Web VNC Client, Server Monitor, Dashboard Cleanup, Sentralisasi Versi.
  - Perbarui panduan instalasi, konfigurasi `.env`, dan panduan build asset.
- [ ] **Step 2: `PANDUAN_TIGHTVNC.md`**:
  - Update panduan integrasi Web VNC Client modern (noVNC canvas, HTTP relay & WebSocket proxy, multi-monitor display scaling) di kasir v1.6.1.
- [ ] **Step 3: `PRIVACY.md`**:
  - Update versi referensi ke v1.6.1.

#### Subtask 5.3: Core Architecture & Technical Specifications (`PRD.md`, `ARCHITECTURE.md`, `TECHNICAL_DOCS.md`, `CODEBASE_DOCUMENTATION.md`, `DIAGRAMS.md`)
**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/TECHNICAL_DOCS.md`
- Modify: `docs/CODEBASE_DOCUMENTATION.md`
- Modify: `docs/DIAGRAMS.md`
- [ ] **Step 1: `docs/PRD.md`**:
  - Update roadmap status: fitur v1.6.0 & v1.6.1 (Multi-Cabang, Remote VNC, Server Monitor, Audit Logs, Centralized Versioning) selesai, roadmap v1.7.0+ (Mobile Operator & Owner PWA).
- [ ] **Step 2: `docs/ARCHITECTURE.md`**:
  - Perbarui arsitektur: Rust Tauri client, Rust agents (MTM, MGCTM, Monitor), C# sensor helper, Multi-Branch Proxy Relay, VNC Relay Engine, Cloudflare Tunnel.
- [ ] **Step 3: `docs/TECHNICAL_DOCS.md`**:
  - Perbarui daftar endpoint API lengkap (`/api/branch/*`, `/api/server-monitor/*`, `/api/vnc/*`, `/api/migrations/*`, dll.).
  - Perbarui skema database SQLite / SQLAlchemy models.
- [ ] **Step 4: `docs/CODEBASE_DOCUMENTATION.md`**:
  - Perbarui struktur direktori dan dokumentasi modul kasir (dashboard, pc, paket, member, branch, monitor, vnc, catatankasir, fileexplorer, uptime, hardware_checker, blackout, struk, etc.).
- [ ] **Step 5: `docs/DIAGRAMS.md`**:
  - Perbarui diagram mermaid alur Multi-Cabang relay dan Web VNC remote.

#### Subtask 5.4: Developer & Feature Guides (`BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`, `NEW_FEATURES_GUIDE.md`, `FEATURE_*.md`, `MAINTENANCE_UI_STANDARDS.md`, `UPGRADE_RUPIAH_AND_POS.md`, `design_metode_pembayaran.md`, `DESIGN_IP_WHITELIST_SESSION_DESTROY.md`, `CLOUD_BACKUP_DESIGN.md`, `laporan_tugas_akhir.md`)
**Files:**
- Modify: `docs/BACKEND_GUIDE.md`
- Modify: `docs/FRONTEND_GUIDE.md`
- Modify: `docs/NEW_FEATURES_GUIDE.md`
- Modify: `docs/FEATURE_*.md` & remaining guides
- [ ] **Step 1: `docs/BACKEND_GUIDE.md`**:
  - Update Service-Repository pattern, Multi-Branch Proxy Relay, Centralized Config Versioning (`Config.VERSION`), security & CSRF handling.
- [ ] **Step 2: `docs/FRONTEND_GUIDE.md`**:
  - Dokumentasikan standar Chamber Noir, sistem modular JS, `window.APP_VERSION`, Tailwind CSS compilation, dynamic cache-busting `?v={{ v_cache }}`.
- [ ] **Step 3: `docs/NEW_FEATURES_GUIDE.md`**:
  - Lengkapi panduan fitur hingga v1.6.1: Multi-Cabang Switcher, Web VNC Remote Desktop, Realtime Hardware Monitor, Ticket Maintenance System, Audit Logs Category Grouping, Sentralisasi Versi.
- [ ] **Step 4: `docs/FEATURE_*.md` dan dokumen lainnya**:
  - Perbarui seluruh header/footer versi ke `v1.6.1` dan sinkronkan isi kontennya.

---

### Task 6: Build Assets & Full Test Suite Verification
- [ ] **Step 1: Jalankan build css `npm run build:css`**
- [ ] **Step 2: Jalankan full pytest suite (`.venv\Scripts\python.exe -m pytest -o pythonpath=.`) dan verifikasi 108 tests passing**

---

### Task 7: Knowledge Graph Re-Indexing & Git Commit
- [ ] **Step 1: Jalankan `index_repository` via MCP `codebase-memory`**
- [ ] **Step 2: Commit seluruh perubahan dengan pesan komit detail dalam Bahasa Indonesia**

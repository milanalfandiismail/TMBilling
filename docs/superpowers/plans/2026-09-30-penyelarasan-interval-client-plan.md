# Plan Penyelarasan Interval Polling & Telemetry Client Global (1s, 5s, 10s + Fallback 5s Offline)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan seluruh aplikasi client (TMBillingTauri Kiosk/Billing & TMBilling_Monitor Hardware Telemetry) agar mengikuti interval terpusat dari Server (1 detik, 5 detik, atau 10 detik) dan otomatis fallback ke 5 detik saat server offline.

**Architecture:**
1. **Backend Server (`SettingsService`, `settings_routes.py`)**:
   - Variabel setting `client_polling_interval_seconds` (default: 5, validasi ketat hanya 1, 5, atau 10).
   - Endpoint `PUT /api/v1/kasir/settings/client-polling-interval` dan `GET /api/v1/kasir/settings/`.
2. **Endpoint Payload Integrasi**:
   - `ClientService.identify` & `ClientService.get_status` menyertakan `polling_interval`.
   - `POST /api/v1/public/monitor/` (Telemetry) menyertakan `polling_interval` pada response JSON.
3. **Frontend Server UI (`settings.html`, `settings/index.js`, `api.js`)**:
   - Card "Interval Polling & Telemetry PC Client" di Subtab Umum & Keamanan dengan 3 pilihan preset modern:
     - ⚡ **1 Detik** (Super Responsif / Realtime Tinggi)
     - 🛡️ **5 Detik** (Standar / Rekomendasi)
     - 🍃 **10 Detik** (Hemat Resource Jaringan)
4. **Client Tauri (`WarnetAgent/TMBillingTauri`)**:
   - `polling.rs` menerima `polling_interval` dari `get_status`/`identify` dan menerapkan `tokio::time::sleep(Duration::from_secs(interval))`.
   - Jika koneksi server error / offline (`Err(e)`), otomatis fallback menggunakan interval **5 detik**.
5. **Client Hardware Monitor (`WarnetAgent/TMBilling_Monitor`)**:
   - `send_telemetry_snapshot` membaca `polling_interval` dari respon server.
   - Loop monitor menerapkan `thread::sleep(Duration::from_secs(interval))` dan fallback ke **5 detik** saat offline.

**Tech Stack:** Python (Flask, SQLAlchemy, Pytest), HTML/TailwindCSS, JavaScript (Kasir Settings Module), Rust (Tauri Tokio Async & Monitor Agent).

---

### Task 1: Backend Settings, Telemetry & Client API

**Files:**
- Modify: `app/services/settings/settings_service.py`
- Modify: `app/routes/settings/settings_routes.py`
- Modify: `app/services/client/client_service.py`
- Modify: `app/routes/monitor/monitor_routes.py`
- Test: `tests/test_client_polling_interval_setting.py`

- [x] **Step 1: Update unit test untuk validasi setting interval (1, 5, 10), identify, status, dan telemetry payload**
- [x] **Step 2: Jalankan pytest dan pastikan test menguji seluruh endpoint backend**
- [x] **Step 3: Pastikan `SettingsService`, `settings_routes.py`, `client_service.py`, dan `monitor_routes.py` terintegrasi**
- [x] **Step 4: Jalankan pytest dan pastikan lulus 100%**

---

### Task 2: Frontend Pengaturan Server (Umum & Keamanan)

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`
- Modify: `app/static/js/kasir/core/api.js`

- [x] **Step 1: Buat Card UI Preset (1s, 5s, 10s) di `settings.html` (subtab General / Umum & Keamanan)**
- [x] **Step 2: Hubungkan fungsi load & save preset interval di `settings/index.js` dan method `updateClientPollingInterval` di `api.js`**
- [x] **Step 3: Jalankan `npm run build:css` untuk mengompilasi style TailwindCSS**

---

### Task 3: Tauri Client & Monitor Agent Dynamic Interval + Offline Fallback

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/utils/api.rs`
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/services/polling.rs`
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs`

- [x] **Step 1: Tambahkan `polling_interval` pada `StatusResponse` & `IdentifyResponse` di `api.rs`**
- [x] **Step 2: Terapkan dynamic interval + 5s fallback saat offline pada `polling.rs` di `TMBillingTauri`**
- [x] **Step 3: Terapkan dynamic interval + 5s fallback saat offline pada `main.rs` di `TMBilling_Monitor`**
- [x] **Step 4: Jalankan `cargo check` pada kedua project Rust (`TMBillingTauri` dan `TMBilling_Monitor`)**

---

### Task 4: Verifikasi Menyeluruh & Re-index

**Files:**
- Test: `tests/test_client_polling_interval_setting.py`
- Test: `tests/test_system_mode_separation.py`

- [x] **Step 1: Jalankan seluruh test suite backend dengan pytest**
- [x] **Step 2: Jalankan `cargo check` pada client Rust**
- [x] **Step 3: Update dan validasi index MCP `codebase-memory`**

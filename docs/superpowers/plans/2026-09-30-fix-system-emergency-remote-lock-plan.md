# Plan Perbaikan Sinkronisasi Clear Sesi System ke Kiosk Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memastikan bahwa ketika kasir melakukan "Clear Sesi System" dari dashboard server yang sedang online, PC client yang sedang dalam mode emergency/system otomatis menerima perintah lock dan kembali terkunci ke layar Kiosk.

**Architecture:** 
1. Backend `PCService.reset_admin_mode` secara proaktif mendaftarkan perintah `lock` ke antrean perintah klien (`ClientService.queue_command`).
2. Tauri Client `api.rs` (`get_status`) tidak menimpa (*override*) status menjadi `system` jika server merespon `kosong` atau memberikan `command: "lock"`.
3. Tauri Client `polling.rs` memeriksa respon server: jika status `kosong` atau terdapat perintah `lock`/`logout`, maka `IS_EMERGENCY_MODE`, `IS_ADMIN_MODE`, dan `SESSION_ACTIVE` dinonaktifkan, lalu event `force-lock` dipancarkan ke frontend Tauri untuk beralih ke Kiosk.

**Tech Stack:** Python (Flask, SQLAlchemy, Pytest), Rust (Tauri v1, Tokio, serde_json)

---

### Task 1: Backend Command Queueing pada `reset_admin_mode`

**Files:**
- Modify: `app/services/pc/pc_service.py`
- Test: `tests/test_system_mode_separation.py`

- [ ] **Step 1: Tulis unit test untuk verifikasi `reset_admin_mode` memanggil `queue_command`**
- [ ] **Step 2: Jalankan pytest dan pastikan test mendeteksi kebutuhan antrean perintah**
- [ ] **Step 3: Tambahkan `ClientService.queue_command(pc.ip_address, "lock")` di `PCService.reset_admin_mode`**
- [ ] **Step 4: Jalankan pytest dan pastikan lulus 100%**

---

### Task 2: Tauri Client Handling Perintah Lock saat Emergency Mode

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/utils/api.rs`
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/services/polling.rs`

- [ ] **Step 1: Perbarui `get_status` di `api.rs` agar tidak menimpa status `kosong` / command `lock` saat `IS_EMERGENCY_MODE` aktif**
- [ ] **Step 2: Perbarui loop `polling.rs` agar mendeteksi status `kosong` / command `lock` dan memicu `force-lock` serta mereset `IS_EMERGENCY_MODE`**
- [ ] **Step 3: Jalankan `cargo check` pada `WarnetAgent/TMBillingTauri/src-tauri` untuk memvalidasi kompilasi Rust**

---

### Task 3: Verifikasi Menyeluruh & Testing

**Files:**
- Test: `tests/test_system_mode_separation.py`
- Test: `tests/test_admin_identity_and_emergency.py`

- [ ] **Step 1: Jalankan seluruh suite test backend dengan `pytest`**
- [ ] **Step 2: Jalankan validasi `cargo check`**
- [ ] **Step 3: Lakukan sinkronisasi index MCP `codebase-memory`**

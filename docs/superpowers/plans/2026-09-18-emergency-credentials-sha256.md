# Migrasi Emergency Credentials (EmergencyUser & EmergencyToken) ke SHA-256 Hash

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti metode pengamanan `EmergencyUser` dan `EmergencyToken` dari Hex-XOR Obfuscation menjadi SHA-256 Cryptographic Hash di seluruh skrip instalasi PowerShell, modul agen Rust (`MGCTM`, `mtm`, `TMMonitor`, `TMBilling_Uninstaller`), dan aplikasi client `TMBillingTauri`.

**Architecture:** 
- `ApiKey` tetap menggunakan **Hex-XOR Obfuscation** karena client wajib mengirim string asli ke header HTTP `X-Client-Key`.
- `EmergencyUser` dan `EmergencyToken` di-hash menggunakan **SHA-256** (64 hex characters) saat instalasi dan disimpan di Registry (`HKCU`/`HKLM`) serta `config.ini`.
- Saat login offline di Kiosk atau verifikasi uninstaller offline, input pengguna di-hash dengan SHA-256 dan dicocokkan dengan hash tersimpan (`sha256(input) == stored_hash`).

**Tech Stack:** PowerShell (System.Security.Cryptography.SHA256Managed), Rust (`sha2` crate), Windows Registry (`winreg`).

---

## Global Constraints
- `ApiKey` TIDAK boleh diubah menjadi SHA-256 (tetap Hex-XOR obfuscate).
- Seluruh perbandingan SHA-256 hash wajib *case-insensitive* (`eq_ignore_ascii_case`).
- Mendukung *backward compatibility*: jika kredensial masih dalam format lama (Hex-XOR / plain text), deteksi dan konversi otomatis.
- Tetap mendukung instalasi Non-Admin (`HKCU`) dan Admin (`HKLM`).

---

### Task 1: Update PowerShell Deployment Scripts (`write_config.ps1`, `sync_registry.ps1`, `install.bat`)

**Files:**
- Modify: `WarnetAgent/Deploy/write_config.ps1`
- Modify: `WarnetAgent/Deploy/sync_registry.ps1`
- Modify: `WarnetAgent/Deploy/install.bat`

**Interfaces:**
- Menambahkan fungsi helper `Compute-Sha256 -text $str` di PowerShell.
- Menyimpan `EmergencyUser` dan `EmergencyToken` dalam bentuk SHA-256 ke Registry & `config.ini`.

- [ ] **Step 1: Update `write_config.ps1`**
  Ganti obfuscation `EmergencyUser` dan `EmergencyToken` dengan SHA-256 hashing.
- [ ] **Step 2: Update `sync_registry.ps1`**
  Pastikan `sync_registry.ps1` mendeteksi apakah nilai di `config.ini` sudah SHA-256 (64 hex chars), jika belum (masih plain text/obfuscated lama), lakukan hash ulang.
- [ ] **Step 3: Update `install.bat` fallback**
  Pastikan blok fallback di `install.bat` juga menyimpan SHA-256 hash untuk `EmergencyUser` dan `EmergencyToken`.
- [ ] **Step 4: Commit**
  `git commit -m "feat(deploy): migrasi penulisan EmergencyUser dan EmergencyToken ke SHA-256"`

---

### Task 2: Update `TMBillingTauri` Kiosk Offline Admin Authentication

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/utils/api.rs`

**Interfaces:**
- `ApiService::load_config()` memuat `emergency_user` dan `emergency_token` sebagai hash SHA-256.
- `ApiService::admin_login()` menghitung `Sha256::digest(user)` dan `Sha256::digest(pass)` lalu membandingkannya dengan hash yang tersimpan.

- [ ] **Step 1: Helper SHA-256 di `api.rs`**
  Tambahkan fungsi helper `hash_sha256(input: &str) -> String` menggunakan `sha2::Sha256`.
- [ ] **Step 2: Update `load_config` di `api.rs`**
  Dukung pembacaan hash 64 karakter (jika format lama, otomatis hash).
- [ ] **Step 3: Update offline check di `admin_login`**
  Hitung `sha256(user)` dan `sha256(pass)` lalu bandingkan dengan `self.emergency_user` dan `self.emergency_token`.
- [ ] **Step 4: Verifikasi build dengan `cargo check`**
- [ ] **Step 5: Commit**
  `git commit -m "feat(tauri): verifikasi login darurat offline menggunakan pencocokan SHA-256"`

---

### Task 3: Update `TMBilling_Uninstaller` Offline Token Verification

**Files:**
- Modify: `WarnetAgent/TMBilling_Uninstaller/src/main.rs`

**Interfaces:**
- `load_emergency_token_offline()` memuat hash SHA-256 `EmergencyToken`.
- Window callback uninstaller memvalidasi token offline dengan `sha256(clean_entered) == offline_token_hash`.

- [ ] **Step 1: Helper hash SHA-256 di Uninstaller**
  Gunakan fungsi sha256 yang sudah tersedia di uninstaller (`sha2::{Sha256, Digest}`).
- [ ] **Step 2: Update `load_emergency_token_offline()`**
  Membaca nilai hash dari Registry (`HKLM`/`HKCU`) atau `config.ini`.
- [ ] **Step 3: Update verifikasi password uninstaller offline**
  Hitung `sha256(clean_entered)` dan bandingkan dengan token offline.
- [ ] **Step 4: Verifikasi build dengan `cargo check`**
- [ ] **Step 5: Commit**
  `git commit -m "feat(uninstaller): verifikasi token uninstall offline menggunakan SHA-256"`

---

### Task 4: Update Supervisor & Monitor Agents (`MGCTM`, `mtm`, `TMMonitor`)

**Files:**
- Modify: `WarnetAgent/MGCTM/src/main.rs`
- Modify: `WarnetAgent/mtm/src/main.rs`
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs`

**Interfaces:**
- Menstandarisasi pembacaan dan sinkronisasi `EmergencyUser` dan `EmergencyToken` sebagai SHA-256 hash di seluruh agen.

- [ ] **Step 1: Update `MGCTM/src/main.rs` `load_config`**
- [ ] **Step 2: Update `mtm/src/main.rs` `load_config`**
- [ ] **Step 3: Update `TMBilling_Monitor/src/main.rs` `load_config`**
- [ ] **Step 4: Verifikasi build seluruh agen dengan `cargo check`**
- [ ] **Step 5: Commit**
  `git commit -m "feat(agents): standarisasi konfigurasi EmergencyUser dan EmergencyToken SHA-256 di MGCTM, mtm, dan TMMonitor"`

---

## Verification Plan
1. **Automated Verification**:
   - `cargo check` di `WarnetClient/TMBillingTauri/src-tauri`
   - `cargo check` di `WarnetAgent/MGCTM`
   - `cargo check` di `WarnetAgent/mtm`
   - `cargo check` di `WarnetAgent/TMBilling_Monitor`
   - `cargo check` di `WarnetAgent/TMBilling_Uninstaller`
2. **Offline Logic Verification**:
   - Verifikasi bahwa input `user == "TMBilling"` dan `pass == "TM123qaz!@#"` menghasilkan SHA-256 yang cocok dengan yang tersimpan di Registry / `config.ini`.

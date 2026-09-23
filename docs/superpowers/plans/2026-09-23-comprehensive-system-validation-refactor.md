# Rencana Implementasi Standardisasi & Refactor Validasi Sistem Menyeluruh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melakukan audit menyeluruh dan standardisasi validasi di seluruh modul Backend dan Frontend TMBilling: menambahkan utilitas validasi terpusat baru (`validate_ip_address`, `validate_mac_address`, `validate_choice`, `validate_filename`), merefactor seluruh Service & Route yang belum terintegrasi (`GameService`, `MaintenanceService`, `IpWhitelistService`, `ShiftService`, `TournamentService`, `TutorialService`, `NoteService`, `BackupRoutes`, `MikrotikRoutes`, `SettingsRoutes`), serta memperluas utilitas frontend `app/static/js/kasir/core/utils.js` dan modul modal kasir agar 100% konsisten, aman dari bug/directory traversal, dan memberikan umpan balik Bahasa Indonesia yang ramah.

**Architecture:** 
1. **Backend Utility Layer (`app/utils/validators.py`)**: Single Source of Truth untuk validasi IPv4/IPv6, MAC address, whitelist choice/enum, sanitasi nama berkas & anti-traversal, serta panjang karakter dan batasan angka.
2. **Backend Service & Route Refactor**: Menggantikan validasi manual/ad-hoc di `GameService`, `MaintenanceService`, `IpWhitelistService`, `ShiftService`, `TournamentService`, `TutorialService`, `NoteService`, `BackupRoutes`, `MikrotikRoutes`, dan `SettingsRoutes` dengan pemanggilan fungsi dari `app.utils.validators`.
3. **Frontend Utility Layer (`app/static/js/kasir/core/utils.js`)**: Standar client-side validation (`Utils.isValidUsername`, `Utils.isValidPassword`, `Utils.isValidEmail`, `Utils.isValidPhone`, `Utils.isValidIP`, `Utils.isValidMAC`, `Utils.isValidHexColor`, `Utils.parseRupiah`, `Utils.clamp`).
4. **Testing & Quality Assurance**: Pengujian unit TDD di setiap task backend (mempertahankan 187+ test yang sudah ada dan menambah test baru untuk fungsi yang direfactor).

**Tech Stack:** Python 3.14, Flask, SQLAlchemy, pytest, Vanilla JavaScript, Tailwind CSS.

---

## Global Constraints

- Semua pesan error validasi wajib menggunakan Bahasa Indonesia yang ramah, jelas, dan informatif.
- Tidak boleh merusak logika bisnis eksisting, skema database, ataupun 187 test yang sudah ada.
- Wajib menggunakan MCP `codebase-memory` selama proses analisis dan eksekusi.
- Terapkan alur TDD (Test-Driven Development) di setiap task backend.

---

### Task 1: Perluasan Modul Utilitas Validasi Backend (`app/utils/validators.py`)

**Files:**
- Modify: `app/utils/validators.py`
- Modify: `tests/test_validation_helpers.py`

**Interfaces:**
- Produces:
  - `validate_ip_address(ip: str, allow_empty: bool = False, version: int = 4) -> str | None`
  - `validate_mac_address(mac: str, allow_empty: bool = True) -> str | None`
  - `validate_choice(val: str, choices: list | tuple | set, field_name: str = "Pilihan", case_sensitive: bool = False) -> str`
  - `validate_filename(filename: str, allowed_extensions: set | None = None, field_name: str = "Berkas") -> str`

- [ ] **Step 1: Tulis test unit tambahan di `tests/test_validation_helpers.py`**
- [ ] **Step 2: Jalankan pytest dan pastikan gagal (*fail as expected*)**
- [ ] **Step 3: Implementasikan fungsi baru di `app/utils/validators.py`**
- [ ] **Step 4: Jalankan pytest dan pastikan lulus**
- [ ] **Step 5: Commit perubahan**

---

### Task 2: Refactor Validasi Service Game & Maintenance (`GameService`, `GameKategoriService`, `MaintenanceService`)

**Files:**
- Modify: `app/services/game/game_service.py`
- Modify: `app/services/game/game_kategori_service.py`
- Modify: `app/services/maintenance/maintenance_service.py`
- Create: `tests/test_game_maintenance_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_string_length`, `validate_choice`, `validate_integer_range`, `validate_filename`)
- Enforces:
  - Game: Nama (2 - 100 karakter), Tipe (`['game', 'aplikasi']`), Exe path (maks. 255 karakter), Ekstensi icon whitelist (`['png', 'jpg', 'jpeg', 'ico', 'webp', 'svg']`).
  - Game Kategori: Nama kategori (2 - 50 karakter via `validate_string_length`).
  - Maintenance: Kategori (`['HARDWARE', 'SOFTWARE', 'JARINGAN', 'LAINNYA']`), Prioritas (`['RENDAH', 'SEDANG', 'TINGGI', 'KRITIS']`), Status (`['BARU', 'DIPROSES', 'SELESAI', 'DITOLAK']`), Judul (3 - 150 karakter), Biaya (0 - 100.000.000).

- [ ] **Step 1: Tulis test unit validasi Game & Maintenance**
- [ ] **Step 2: Jalankan pytest dan pastikan gagal**
- [ ] **Step 3: Refactor `GameService`, `GameKategoriService`, dan `MaintenanceService`**
- [ ] **Step 4: Jalankan pytest dan pastikan lulus**
- [ ] **Step 5: Commit perubahan**

---

### Task 3: Refactor Validasi Service Operasional: IP Whitelist, Shift, Turnamen, Tutorial, & Catatan

**Files:**
- Modify: `app/services/ip_whitelist/ip_whitelist_service.py`
- Modify: `app/services/shift/shift_service.py`
- Modify: `app/services/tournament/tournament_service.py`
- Modify: `app/services/tutorial/tutorial_service.py`
- Modify: `app/routes/tutorial/tutorial_routes.py`
- Modify: `app/services/notes/note_service.py`
- Modify: `app/routes/notes/note_routes.py`
- Create: `tests/test_operational_services_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_ip_address`, `validate_integer_range`, `validate_string_length`, `validate_choice`, `validate_filename`)
- Enforces:
  - IP Whitelist: Validasi IPv4 via `validate_ip_address`, label maks. 100 karakter.
  - Shift: Modal awal (0 - 100.000.000), Uang fisik (0 - 100.000.000).
  - Tournament: Nama turnamen (2 - 100 karakter), Deskripsi (maks. 500 karakter), Tipe jalur (`['playoff', 'swiss']`), Format BO (1 - 9), Nama tim (1 - 50 karakter).
  - Tutorial: Judul (3 - 150 karakter), Kategori (2 - 50 karakter), Konten (5 - 100.000 karakter), Urutan (0 - 10.000).
  - Notes: Judul (1 - 100 karakter), Nama berkas `.txt` aman via `validate_filename`, Konten (maks. 100.000 karakter).

- [ ] **Step 1: Tulis test unit validasi operasional services**
- [ ] **Step 2: Jalankan pytest dan pastikan gagal**
- [ ] **Step 3: Refactor `IpWhitelistService`, `ShiftService`, `TournamentService`, `TutorialService`, `NoteService`**
- [ ] **Step 4: Jalankan pytest dan pastikan lulus**
- [ ] **Step 5: Commit perubahan**

---

### Task 4: Refactor Validasi Routes Pengaturan, Backup, MikroTik, & DB Maintenance (`SettingsRoutes`, `BackupRoutes`, `MikrotikRoutes`, `DBMaintenanceService`)

**Files:**
- Modify: `app/routes/settings/settings_routes.py`
- Modify: `app/routes/backup/backup_routes.py`
- Modify: `app/routes/mikrotik/mikrotik_routes.py`
- Modify: `app/services/settings/db_maintenance_service.py`
- Create: `tests/test_system_routes_validation.py`

**Interfaces:**
- Consumes: `app.utils.validators` (`validate_integer_range`, `validate_string_length`, `validate_choice`, `validate_filename`)
- Enforces:
  - Timer Auto-Shutdown: 30 - 600 detik via `validate_integer_range`.
  - Client API Key: 8 - 128 karakter via `validate_string_length`.
  - Backup: Provider whitelist (`['discord', 'webdav', 'gdrive', 'nas']`), Sanitasi berkas `.zip` via `validate_filename`.
  - MikroTik: Port (1 - 65535), Username (1 - 64 karakter), Hotspot Profile (1 - 64 karakter).
  - DB Maintenance: Masa retensi data (`[1, 3, 6, 12]` bulan via `validate_choice`).

- [ ] **Step 1: Tulis test unit validasi system routes & db maintenance**
- [ ] **Step 2: Jalankan pytest dan pastikan gagal**
- [ ] **Step 3: Refactor validasi di `settings_routes.py`, `backup_routes.py`, `mikrotik_routes.py`, dan `db_maintenance_service.py`**
- [ ] **Step 4: Jalankan pytest dan pastikan lulus**
- [ ] **Step 5: Commit perubahan**

---

### Task 5: Standardisasi Helper Validasi Frontend Terpusat (`app/static/js/kasir/core/utils.js`)

**Files:**
- Modify: `app/static/js/kasir/core/utils.js`
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/settings/index.js`
- Modify: `app/static/js/kasir/modules/shift/index.js`
- Modify: `app/static/js/kasir/modules/mikrotik/index.js`

**Interfaces:**
- Produces di `Utils`:
  - `Utils.isValidUsername(str, minLen=3, maxLen=30)`
  - `Utils.isValidPassword(str, minLen=4, maxLen=32)`
  - `Utils.isValidEmail(str)`
  - `Utils.isValidPhone(str)`
  - `Utils.isValidHexColor(str)`
  - `Utils.isValidIP(str)`
  - `Utils.isValidMAC(str)`
  - `Utils.parseRupiah(str)`
  - `Utils.clamp(val, min, max)`

- [ ] **Step 1: Tambahkan fungsi validasi terpusat pada `app/static/js/kasir/core/utils.js`**
- [ ] **Step 2: Refactor modul-modul JS frontend untuk memanfaatkan `Utils.isValid...`**
- [ ] **Step 3: Commit perubahan**

---

### Task 6: Regresi Menyeluruh, Re-index Codebase-Memory MCP, & Push ke Branch

**Files:**
- Full pytest suite
- Build CSS: `npm run build:css`
- Codebase-memory re-index: `index_repository`

- [ ] **Step 1: Jalankan full pytest suite (pastikan seluruh 190+ tests lulus 100%)**
- [ ] **Step 2: Jalankan `npm run build:css`**
- [ ] **Step 3: Re-index codebase memory graph**
- [ ] **Step 4: Commit & Push ke `origin/v1.6.2`**


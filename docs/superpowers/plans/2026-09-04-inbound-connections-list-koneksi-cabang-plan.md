# Inbound Connections (List Koneksi Cabang) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur visibilitas dan kontrol **List Koneksi Cabang (Inbound Connections)** di dalam menu Multi Cabang, sehingga Server B mengetahui secara transparan siapa saja server cabang luar (Server A, dll.) yang terhubung dan mengontrol server ini, lengkap dengan metadata hardware, operator, waktu aktif, serta kemampuan blokir/putuskan akses.

**Architecture:** 
1. Database model `BranchInbound` untuk menyimpan identitas cabang yang masuk (Nama Cabang, MAC Hardware, IP/URL, Operator Terakhir, Total Request, Status Aktif/Diblokir).
2. Middleware interseptor pada verifikasi Bearer API Key (`_apply_branch_relay_identity`) untuk otomatis merekam/memperbarui handshake dan aktivitas server pengontrol, serta menolak request jika status cabang diblokir.
3. Payload enrichment pada Cabang A (`test_connection` & `relay_request`) agar selalu mengirim identitas pengirim (`X-Origin-Branch-Name`, `X-Origin-MAC`, `X-Origin-URL`, `X-Operator-Username`).
4. Submenu baru di sidebar (`🔗 List Koneksi Cabang`) dan template UI [branch_inbound.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/branch_inbound.html) yang konsisten 100% dengan signature styling **Umum & Keamanan**.

**Tech Stack:** Python 3.14, Flask, SQLAlchemy, SQLite, Vanilla JS (ES6+), Tailwind CSS.

---

## Global Constraints
- Tetap di branch `feat/multi-branch-control-panel` (JANGAN merge ke `main`).
- Keamanan 100%: Hak akses halaman dan API dibatasi hanya untuk role `admin`.
- Styling UI harus strictly patuh pada standar subtab **Umum & Keamanan** (`#subtab-general`): Card `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6`, header `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`, tombol standar `text-xs lg:text-base font-bold rounded`.
- Jalankan `npm run build:css` setelah modifikasi HTML/JS.
- Pastikan seluruh automated tests (76+ tests) lolos 100%.
- Lakukan re-indexing codebase-memory via MCP `index_repository`.

---

## Proposed Changes

### Component 1: Database & Model (Backend)

#### [NEW] [app/models/branch_inbound.py](file:///c:/Project%20GIT/TMBilling/app/models/branch_inbound.py)
Model `BranchInbound`:
- `id`: Integer primary key
- `nama`: String(100) — Nama warnet cabang pengontrol
- `url`: String(255), nullable — URL server pengontrol jika ada
- `mac_address`: String(50), nullable — MAC address hardware pengontrol
- `ip_address`: String(100), nullable — IP address pengirim
- `operator_terakhir`: String(100), nullable — Username operator/kasir pengirim terakhir
- `total_request`: Integer, default 1 — Jumlah akumulasi request
- `status`: String(20), default "aktif" ("aktif" atau "diblokir")
- `pertama_terhubung`: DateTime, default `now_local`
- `terakhir_aktif`: DateTime, default `now_local`
- Helper method `to_dict()`

#### [MODIFY] [app/models/__init__.py](file:///c:/Project%20GIT/TMBilling/app/models/__init__.py)
- Import dan daftarkan `BranchInbound` ke `__all__`.

---

### Component 2: Service & Middleware (Backend)

#### [NEW] [app/services/branch/branch_inbound_service.py](file:///c:/Project%20GIT/TMBilling/app/services/branch/branch_inbound_service.py)
Service `BranchInboundService`:
- `record_inbound_access(origin_name, origin_mac, origin_url, operator, ip_address)`:
  - Cari data berdasarkan `mac_address` (jika ada) atau `nama`.
  - Jika ditemukan: perbarui `terakhir_aktif`, `total_request += 1`, update IP dan operator terakhir.
  - Jika baru: insert data baru ke `BranchInbound`.
  - Kembalikan objek `inbound`.
- `is_blocked(origin_name, origin_mac)`: Memeriksa apakah pengirim berstatus `"diblokir"`.
- `get_all_inbound()`: Mengambil daftar seluruh koneksi cabang masuk, diurutkan `terakhir_aktif.desc()`.
- `toggle_block(inbound_id, block: bool)`: Mengubah status `"diblokir"` / `"aktif"`.
- `delete_inbound(inbound_id)`: Menghapus record riwayat koneksi masuk.

#### [MODIFY] [app/middleware/auth.py](file:///c:/Project%20GIT/TMBilling/app/middleware/auth.py)
- Pada `_apply_branch_relay_identity()` dan verifikasi Bearer Token di `login_required` / `admin_required`:
  - Ekstrak metadata: `origin_name`, `origin_mac`, `origin_url`, `remote_op`, `client_ip`.
  - Periksa apakah pengirim diblokir via `BranchInboundService.is_blocked()`. Jika diblokir, return HTTP 403 Forbidden dengan pesan jelas.
  - Panggil `BranchInboundService.record_inbound_access(...)` untuk mencatat / memperbarui aktivitas secara real-time.

#### [MODIFY] [app/services/branch/branch_service.py](file:///c:/Project%20GIT/TMBilling/app/services/branch/branch_service.py)
- Pada `test_connection`: Sertakan header identitas pengirim (`X-Origin-Branch-Name`, `X-Origin-MAC`, `X-Operator-Username`) agar tes koneksi langsung dikenali oleh server target.

#### [MODIFY] [app/routes/branch/branch_routes.py](file:///c:/Project%20GIT/TMBilling/app/routes/branch/branch_routes.py)
Tambahkan endpoints:
- `GET /api/v1/kasir/branch/inbound`: Mengambil daftar koneksi masuk.
- `POST /api/v1/kasir/branch/inbound/<int:inbound_id>/block`: Blokir cabang pengontrol.
- `POST /api/v1/kasir/branch/inbound/<int:inbound_id>/unblock`: Buka blokir cabang pengontrol.
- `DELETE /api/v1/kasir/branch/inbound/<int:inbound_id>`: Hapus riwayat cabang pengontrol.

---

### Component 3: Frontend (Sidebar, Template, JS)

#### [MODIFY] [app/templates/kasir/components/sidebar.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html)
- Tambahkan submenu di dalam dropdown Multi Cabang:
  - `🌐 Koneksi Cabang` (`branch`)
  - `🔗 List Koneksi Cabang` (`branch_inbound`)
  - `👤 Akun Kasir Cabang` (`branch_kasir`)

#### [NEW] [app/templates/kasir/tabs/branch_inbound.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/branch_inbound.html)
Template UI baru dengan arsitektur kartu standar **Umum & Keamanan**:
- **Card 1 (Ringkasan & Status Keamanan Server Ini)**:
  - Keterangan server penerima & status proteksi API Key.
  - Tombol *Segarkan Data*.
- **Card 2 (Tabel List Koneksi Cabang Masuk)**:
  - Kolom: No, Nama Cabang Pengontrol, IP/Hardware Asal, Operator Terakhir, Terakhir Mengakses, Total Akses, Status (Terhubung / Diblokir), Aksi.
  - Action buttons: Tombol *Blokir Akses* / *Buka Blokir*, dan *Hapus*.
- **Modal Konfirmasi Blokir & Hapus**: Dialog konfirmasi kartu standar.

#### [MODIFY] [app/templates/kasir/index.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/index.html)
- Sertakan `{% include 'kasir/tabs/branch_inbound.html' %}`.

#### [MODIFY] [app/static/js/kasir/app.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js)
- Daftarkan `branch_inbound` ke `tabToSubmenu`, `kasirOnlyRestricted`, `updatePageTitle` (`Multi Cabang: List Koneksi Cabang`), dan `loadTab`.

#### [MODIFY] [app/static/js/kasir/core/api.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/api.js)
- Tambahkan helper API endpoints untuk inbound branch:
  `inboundList()`, `inboundBlock(id)`, `inboundUnblock(id)`, `inboundDelete(id)`.

#### [MODIFY] [app/static/js/kasir/modules/branch/index.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/branch/index.js)
- Tambahkan logic modul:
  - `loadInboundBranches()`
  - `renderInboundTable()`
  - `blockInboundBranch(id)`
  - `unblockInboundBranch(id)`
  - `deleteInboundBranch(id)`

---

## Verification Plan

### Automated Tests
- Buat test suite baru `tests/test_branch_inbound_connections.py`:
  1. Tes rekaman otomatis koneksi masuk saat request ber-token Bearer valid diterima.
  2. Tes pembaruan metadata (waktu aktif, operator terakhir, counter total akses).
  3. Tes fitur blokir: ketika cabang diblokir, request berikutnya dari cabang tersebut langsung ditolak 403 Forbidden.
  4. Tes buka blokir (unblock) dan hapus koneksi masuk.
  5. Tes RBAC: kasir biasa tidak dapat mengakses endpoint inbound branch.
- Jalankan pytest untuk seluruh test suite:
  ```bash
  .venv\Scripts\python.exe -m pytest tests/test_branch_inbound_connections.py -v
  .venv\Scripts\python.exe -m pytest tests/ -v
  ```

### Manual Verification
- Buka dashboard kasir sebagai Admin.
- Klik dropdown **Multi Cabang** di sidebar $\rightarrow$ muncul 3 submenu:
  1. `🌐 Koneksi Cabang`
  2. `🔗 List Koneksi Cabang`
  3. `👤 Akun Kasir Cabang`
- Klik `🔗 List Koneksi Cabang` $\rightarrow$ membuka tab dengan styling identik tab Umum & Keamanan.
- Lakukan tes koneksi dari server lain $\rightarrow$ nama server pengontrol langsung tercatat di tabel.
- Klik tombol *Blokir* $\rightarrow$ status berubah menjadi diblokir dan akses remote terputus.

# 🧠 ANTIGRAVITY.md — Master Project Memory & Dual-Engine Playbook
> **Single Source of Truth (SSOT) & Local Brain Memory for TMBilling**  
> *Versi Rilis Saat Ini:* `v1.6.3` | *Branch:* `1.6.3` | *Status:* **Master AI Memory & Execution SOP**  
> *Tujuan:* Eliminasi total halusinasi kode, penghematan token, dan eksekusi secepat kilat dengan menggabungkan **Local Memory Document (`ANTIGRAVITY.md`)** + **MCP `codebase-memory`**.

---

## 📑 DAFTAR ISI (TABLE OF CONTENTS)
1. [SOP & Aturan Wajib Planning, Eksekusi & Debugging](#1-sop--aturan-wajib-planning-eksekusi--debugging)
   - 1.1 [Aturan Wajib Planning (Plugin `superpowers`)](#11-aturan-wajib-planning-plugin-superpowers)
   - 1.2 [Aturan Wajib Eksekusi (MCP `codebase-memory`)](#12-aturan-wajib-eksekusi-mcp-codebase-memory)
   - 1.3 [Aturan Wajib Debugging & Root Cause Analysis](#13-aturan-wajib-debugging--root-cause-analysis)
2. [Arsitektur Sistem Terpadu (3-Layer SoC)](#2-arsitektur-sistem-terpadu-3-layer-soc)
3. [Audit & Pemetaan Root & Infrastruktur Proyek](#3-audit--pemetaan-root--infrastruktur-proyek)
4. [Audit & Pemetaan Lengkap Backend Flask (`app/`)](#4-audit--pemetaan-lengkap-backend-flask-app)
   - 4.1 Konfigurasi & Inisialisasi App (`config.py`, `__init__.py`)
   - 4.2 Middleware Keamanan (`app/middleware/`)
   - 4.3 Model SQLAlchemy (25 Models di `app/models/`)
   - 4.4 Repositories Data Access Layer (15 Repositories di `app/repositories/`)
   - 4.5 Services Business Logic Layer (41 Services di `app/services/`)
   - 4.6 Blueprints & Routes (31 Route Modules di `app/routes/`)
   - 4.7 Utilities & Background Schedulers (8 Modules di `app/utils/`)
5. [Audit & Pemetaan Lengkap Frontend Kasir & Publik](#5-audit--pemetaan-lengkap-frontend-kasir--publik)
   - 5.1 Core JavaScript Modules (`app/static/js/kasir/core/`)
   - 5.2 Kasir Modal Components (`app/static/js/kasir/components/`)
   - 5.3 Modul Fitur Kasir (37 Modul di `app/static/js/kasir/modules/`)
   - 5.4 JavaScript Member Portal & Public TV
   - 5.5 Template Jinja2 Kasir & Public (Semua Template di `app/templates/`)
   - 5.6 Build Pipeline CSS (TailwindCSS v3 Minified)
6. [Audit & Pemetaan Lengkap Klien WarnetAgent (`WarnetAgent/`)](#6-audit--pemetaan-lengkap-klien-warnetagent-warnetagent)
   - 6.1 TMBillingTauri (Tauri v1.5 + Rust Core + Kiosk Webview)
   - 6.2 TMBilling_Monitor (Daemon Telemetri Rust + C# LibreHardwareMonitor)
   - 6.3 MGCTM & mtm (Dual Watchdog Resilience System)
   - 6.4 TMBilling_Uninstaller (GUI Native Win32 Uninstaller)
   - 6.5 Deploy Scripts, Provisioning & TightVNC Server
7. [Audit Database Migrations (`migrations/` — 18 Revisions)](#7-audit-database-migrations-migrations--18-revisions)
8. [Audit Tools Developer & DevOps (`tools/`)](#8-audit-tools-developer--devops-tools)
9. [Audit Test Suites (`tests/` — 81 Test Files, 264 Specs)](#9-audit-test-suites-tests--81-test-files-264-specs)
10. [Dokumentasi & Superpowers Specs (`docs/`)](#10-dokumentasi--superpowers-specs-docs)
11. [Katalog Lengkap API Endpoints (Quick Reference)](#11-katalog-lengkap-api-endpoints-quick-reference)
12. [Aturan Krusial, Bug-Traps, & Codebase Gotchas](#12-aturan-krusial-bug-traps--codebase-gotchas)
13. [Changelog & Riwayat Penambahan Fitur](#13-changelog--riwayat-penambahan-fitur)

---

## ⚡ 1. SOP & ATURAN WAJIB PLANNING, EKSEKUSI & DEBUGGING

Untuk mencegah pemborosan token, memastikan akurasi 100%, dan mengeliminasi halusinasi kode, seluruh agen AI dan developer **WAJIB** menerapkan pembagian peran yang ketat:
* **Fase Planning**: **WAJIB MENGGUNAKAN PLUGIN `superpowers`** (`brainstorming`, `writing-plans`, `test-driven-development`).
* **Fase Eksekusi**: **WAJIB MENGGUNAKAN MCP `codebase-memory`** (`index_status`, `search_graph`, `search_code`, `trace_path`, `get_code_snippet`, `index_repository`).
* **Fase Debugging**: **WAJIB MENGGUNAKAN `systematic-debugging` + MCP `trace_path`** (Dilarang tebak-tebak perbaikan tanpa investigasi akar masalah).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER / CODING TASK                              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│  METODE 1: ANTIGRAVITY.MD       │       │  METODE 2: MCP codebase-memory  │
│  (Fast Macro Context)           │       │  (Live Precise Micro Symbol)    │
│  - Arsitektur 3-Layer           │       │  - index_status & coverage      │
│  - Katalog Model & Field DB     │  ◄──► │  - search_code & search_graph   │
│  - Daftar Endpoint & Parameter  │       │  - trace_path (caller/callee)   │
│  - Gotchas & Validasi Khusus    │       │  - get_code_snippet             │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │    📋 FASE 1: PLANNING (PLUGIN `superpowers`)   │
             │    - brainstorming (eksplorasi intent & arsitektur)│
             │    - writing-plans (buat rencana bertahap & spec) │
             │    - test-driven-development (skenario tes awal)│
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │    ⚙️ FASE 2: EKSEKUSI (MCP `codebase-memory`)   │
             │    - trace_path (cek caller & blast radius)     │
             │    - get_code_snippet (baca symbol target)      │
             │    - view_file HANYA baris terbatas             │
             │    - replace_file_content (atomic minimalis)    │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ├────────────────────────┐
                                      │ (Jika Ada Bug/Test Fail)│
                                      ▼                        ▼
             ┌─────────────────────────────────────────────────┐
             │    🐞 FASE 3: DEBUGGING (ROOT CAUSE FIRST)      │
             │    - systematic-debugging (No fix without root) │
             │    - trace_path inbound (lacak asal data korup) │
             │    - Isolasi tes: pytest tests/test_x.py -k ... │
             │    - Perbaiki akar masalah (bukan gejala)       │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │    ✅ FASE 4: VERIFIKASI (EVIDENCE FIRST)       │
             │    - python -m pytest tests/ -q (264 pass)      │
             │    - npm run build:css (jika menyentuh UI)      │
             │    - index_repository (sinkronisasi graph MCP)  │
             │    - Update Changelog di ANTIGRAVITY.md         │
             └─────────────────────────────────────────────────┘
```

---

### 📋 1.1 ATURAN WAJIB PLANNING (PLUGIN `superpowers`)

Sebelum menulis atau mengubah baris kode apa pun, agen AI **WAJIB** menggunakan kemampuan dan alur kerja dari **Plugin `superpowers`**:

1. **Eksplorasi & Intent (`brainstorming`)**:
   - **WAJIB** digunakan sebelum pekerjaan kreatif, pembuatan fitur baru, penambahan komponen, atau perubahan perilaku sistem yang signifikan.
   - Klarifikasi kebutuhan pengguna, eksplorasi opsi arsitektur, dan diskusikan trade-off desain sebelum membuat keputusan teknis.
2. **Penyusunan Rencana Bertahap (`writing-plans`)**:
   - **WAJIB** membuat implementation plan tertulis yang terstruktur (step-by-step) untuk setiap task non-trivial.
   - Rencana harus mencantumkan: target file/fungsi spesifik, dependensi, kriteria keberhasilan (acceptance criteria), dan langkah verifikasi otomatis.
3. **Pembangunan Berbasis Tes (`test-driven-development`)**:
   - Siapkan skenario pengujian unit test di folder `tests/` sebelum atau bersamaan dengan penulisan implementasi fitur baru (Red-Green-Refactor).
4. **Investigasi Masalah Sistematis (`systematic-debugging`)**:
   - Jika menemukan bug atau kegagalan test, dilarang keras menebak-nebak perbaikan secara acak. Lakukan isolasi akar masalah (root-cause analysis) dan periksa alur data sebelum mengajukan perubahan kode.
5. **Bukti Sebelum Asersi (`verification-before-completion`)**:
   - Dilarang menyatakan suatu pekerjaan selesai, lolos, atau aman sebelum menjalankan perintah verifikasi riil (pytest, build css, git status) dan membaca output langsungnya. Bukti eksekusi selalu mendahului klaim keberhasilan.

---

### ⚙️ 1.2 ATURAN WAJIB EKSEKUSI (MCP `codebase-memory`)

Selama proses eksekusi kode, agen AI **WAJIB** menggunakan **MCP `codebase-memory`** untuk mencari, membaca, memahami, dan memvalidasi codebase secara langsung. Dilarang keras mengandalkan tebakan nama file atau asumsi struktur kode.

#### 💡 Portabilitas Antar-PC & Deteksi Nama Project MCP:
Nama project MCP secara default diturunkan dari root path lokal (contoh di PC ini: `C-Project-GIT-TMBilling`). **Jika Anda berpindah PC atau path folder berbeda (misal `D:/Work/TMBilling`):**
1. **Langkah 1 (Cek Proyek)**: Jalankan `list_projects()`. Periksa apakah direktori workspace saat ini sudah terdaftar.
2. **Langkah 2 (Jika Belum / PC Baru)**: Jalankan inisialisasi indeks untuk folder saat ini:
   ```json
   index_repository(repo_path=".")
   ```
   MCP akan membuat knowledge graph lokal baru dan mengembalikan nama project yang sesuai.
3. **Langkah 3 (Pakai Project Name Terdeteksi)**: Gunakan nama project tersebut sebagai argumen `project` pada seluruh tool MCP di bawah.

#### Toolset MCP `codebase-memory` yang Wajib Digunakan:
* `list_projects()`: Cek daftar project yang terdaftar di mesin lokal saat ini untuk menemukan identifier `project` yang tepat.
* `index_status(project="<detected_project_name>")`: Cek status index sebelum mulai. Pastikan graph berstatus `ready` dan catat jika ada file yang `parse_partial` atau `skipped`.
* `check_index_coverage(project="<detected_project_name>", files=[...])`: Pastikan file yang akan dibaca atau diubah benar-benar tercakup dalam index graph.
* `get_architecture(project="<detected_project_name>")`: Pahami struktur hierarki, layer aplikasi, dan boundaries modul yang berkaitan.
* `search_graph(project="<detected_project_name>", name_pattern="...")`: Cari fungsi, class, route, variable, atau symbol yang berkaitan untuk memperoleh *Qualified Name*.
* `search_code(project="<detected_project_name>", pattern="...")`: Temukan penggunaan kode, string literal, atau deklarasi eksak di seluruh codebase.
* `get_code_snippet(project="<detected_project_name>", qualified_name="...")`: Baca isi fungsi atau method secara tepat sebelum memodifikasinya tanpa perlu membuang token membaca file utuh.
* `trace_path(project="<detected_project_name>", function_name="...")`: **WAJIB** dipanggil saat menyentuh fungsi/method untuk menelusuri siapa yang memanggil (callers), siapa yang dipanggil (callees), dependency, data flow, dan *blast radius* / dampak perubahan.
* `query_graph(project="<detected_project_name>", query="...")`: Gunakan jika memerlukan analisis relasi graph yang rumit antar-komponen.
* `index_repository(project="<detected_project_name>")` / `index_repository(repo_path=".")`: **WAJIB** dijalankan setelah implementasi selesai untuk menyinkronkan kembali knowledge graph MCP.

#### Disiplin Eksekusi Kode:
1. **No Guessing**: Jangan pernah menebak nama field model, nama route, atau parameter service. Selalu verifikasi via `search_graph` atau `ANTIGRAVITY.md`.
2. **Hemat Token & Targeted Reading**: Dilarang keras membaca seluruh file ribuan baris dengan `view_file`. Gunakan `get_code_snippet` atau `view_file` dengan range baris `StartLine` dan `EndLine` terbatas.
3. **Impact Verification**: Sebelum mengubah fungsi publik/service, jalankan `trace_path` untuk memastikan tidak ada pemanggil di route atau modul lain yang rusak karena perubahan signature/return value.
4. **Preserve Existing Integrity**: Gunakan `replace_file_content` secara atomic pada blok kode yang dituju. Pertahankan komentar kode, docstrings, dan penanganan error existing.
5. **Post-Execution Sync**: Setelah tes lolos, jalankan `index_repository` dan perbarui riwayat penambahan fitur di Bagian 13 (Changelog) berkas ini.

---

### 🐞 1.3 ATURAN WAJIB DEBUGGING & ROOT CAUSE ANALYSIS

Ketika menghadapi bug, kegagalan unit test, anomali data, atau perilaku tak terduga, agen AI **DILARANG KERAS** langsung melakukan "quick fix" atau menebak-nebak perbaikan tanpa melalui investigasi sistematis.

#### ⚖️ The Iron Law of Debugging:
> **"NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"**  
> *(Dilarang mengajukan atau mengedit kode perbaikan sebelum akar masalah ditemukan dan dibuktikan secara empiris).*

#### 4 Fase Wajib Penanganan Bug / Error:

1. **Fase 1: Investigasi Akar Masalah (Root Cause Investigation)**
   - **Baca Stack Trace Utuh**: Perhatikan file path, nomor baris, jenis Exception (`KeyError`, `ValueError`, `IntegrityError`, dsb.), dan parameter yang diteruskan.
   - **Reproduksi Secara Terisolasi**: Jalankan test spesifik yang gagal secara mandiri dengan mode verbose:
     ```bash
     python -m pytest tests/test_file.py -k "test_function_name" -vv -s
     ```
   - **Telusuri Alur Data (Data Flow Tracing)**: Gunakan MCP `trace_path` untuk melacak dari mana nilai variabel yang salah itu masuk:
     ```json
     trace_path(project="<detected_project_name>", function_name="<broken_function>", mode="calls")
     ```
   - **Periksa Perubahan Terakhir**: Gunakan `git diff` atau `git log -n 5` untuk melihat modifikasi terakhir yang berpotensi memicu regresi.

2. **Fase 2: Analisis Pola & Komparasi (Pattern Analysis)**
   - Cari implementasi serupa di codebase yang bekerja dengan baik menggunakan `search_code` atau `search_graph`.
   - Bandingkan perbedaan perlakuan input, decorator, transaction rollback, atau session context antara kode yang berjalan normal vs kode yang error.

3. **Fase 3: Hipotesis & Minimal Reproduction**
   - Formulasikan satu hipotesis yang jelas dan dapat diuji: *"Fungsi X gagal karena variabel Y bernilai None saat kondisi Z."*
   - Uji hipotesis tersebut dengan test minimal atau log terarah sebelum menyentuh kode produksi.

4. **Fase 4: Perbaikan Presisi & Regresi Verifikasi**
   - Lakukan perbaikan pada **akar masalah**, bukan menambal gejala (symptom patching) dengan `try-except pass` yang membungkam error.
   - Jalankan test spesifik: pastikan berhasil (PASSED).
   - **Regresi Wajib**: Jalankan seluruh test suite untuk memastikan perbaikan tidak merusak 263 modul lainnya:
     ```bash
     python -m pytest tests/ -q
     ```
     *(Hasil wajib: 264 passed, 0 failed).*

#### 🛠️ Checklist Debugging Khusus Berdasarkan Layer TMBilling:
* **Backend Flask & Database SQLite**:
  - **Database Lock & Rollback**: Pastikan setiap error di dalam blok `try-except` memanggil `db.session.rollback()` agar transaksi SQLite tidak terkunci (*database is locked*).
  - **Timezone UTC Normalization**: Pastikan tanggal disimpan dalam UTC via `now_utc()`, bukan naive local time.
  - **Audit Logging**: Periksa tabel `AuditLog` atau folder `logs/` jika terjadi anomali transaksi atau auth failure.
* **Frontend Kasir (Vanilla JS & Dashboard)**:
  - **HTTP Status Check**: Status HTTP 400 (sering kali karena Shift belum dibuka), 401 (sesi kasir habis), atau 403 (CSRF token missing).
  - **State Reaktif**: Periksa `Dashboard.lastData` dan snapshot `_prevRenderedData` di console browser.
  - **CSS Styling**: Jika style tidak muncul, jalankan `npm run build:css` (Tailwind purge mungkin belum memuat class baru).
* **WarnetAgent Klien (Rust Tauri & Watchdog)**:
  - **Response Polling**: Pastikan server mengembalikan format JSON valid pada endpoint `POST /api/v1/public/client/status`.
  - **File Lock & Token**: Pastikan tidak ada `stop.token` tertinggal jika watchdog `MGCTM` tidak mau menyala.
  - **Registry TightVNC**: Pastikan binding loopback `127.0.0.1` port 5900 aktif via `reg query "HKLM\Software\TightVNC\Server"`.

---

## 🏛️ 2. ARSITEKTUR SISTEM TERPADU (3-LAYER SOC)

Sistem TMBilling dirancang dengan pemisahan tanggung jawab yang ketat (Separation of Concerns):

```
[ BROWSER KASIR / OWNER ]                [ CLIENT PC / WARNET ]
  │           │                                     │
  │ HTTP REST │ WebSocket (RFB/VNC)                 │ HTTP Telemetry / Heartbeat
  ▼           ▼                                     ▼
┌────────────────────────────────────────────────────────┐
│             BACKEND FLASK SERVER (PORT 5000)           │
│  - Routes (31 Blueprints)                              │
│  - Services (41 Business Logic Engines)                │
│  - Repositories (15 Data Access Objects)               │
│  - Models (25 SQLAlchemy Models, SQLite WAL)           │
│  - WebSocket VNC Proxy Relay (TightVNC 5900 Loopback)  │
│  - Cloudflare Ingress & Multi-Branch Relay Forwarder   │
└────────────────────────────────────────────────────────┘
```

1. **Layer 1: Frontend Kasir & Publik (`app/static/`, `app/templates/`)**:
   - Single-Page Application style modular dengan Vanilla ES6 JavaScript murni.
   - TailwindCSS v3 minified (`app/static/css/tailwind.css`), zero external build runtime in production.
   - Standardized skeleton loading generator ([`skeleton.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/skeleton.js)) tanpa spinner putar.
   - UI responsif (dual layout 1024px tablet hingga 1920px+ desktop widescreen).
2. **Layer 2: Backend Server Flask (`app/`)**:
   - 4-Tier Clean SoC: Routes -> Services -> Repositories -> Models.
   - Database: SQLite dengan Write-Ahead Logging (WAL) mode untuk performa konkurensi tinggi.
   - Timezone Handling: Semua timestamp disimpan dalam format **UTC** murni di DB, dan dikonversi saat display melalui [`timezone_utils.py`](file:///c:/Project%20GIT/TMBilling/app/utils/timezone_utils.py).
   - Background Automation: APScheduler berjalan di background untuk auto-cleanup sesi expired (60s), auto-backup DB, dan auto-screenshot.
   - Multi-Branch Architecture: Server dapat bertindak sebagai Server Pusat, Server Cabang mandiri, atau Bridge Proxy via header `X-Branch-ID`.
3. **Layer 3: WarnetAgent Klien (`WarnetAgent/`)**:
   - Desktop Kiosk Lock berbasis Tauri v1.5 (Rust + Webview2) dengan low-level Windows API hooks.
   - Daemon telemetri terpisah (`TMBilling_Monitor`) dengan C# helper driver kernel sensor (`LibreHardwareMonitor`).
   - Remote screen control via TightVNC server (port 5900 loopback only) ditautkan ke WebSocket Kasir.
   - Dual-Watchdog resilience (`MGCTM.exe` + `mtm.exe`) dengan hex-XOR memory obfuscation dan file locking.

---

## 📂 3. AUDIT & PEMETAAN ROOT & INFRASTRUKTUR PROYEK

Berkas-berkas di root direktori mengatur runtime server, deploy, packaging, dan dependencies:

| File / Folder | Peran & Tanggung Jawab Teknis |
|---|---|
| [`run.py`](file:///c:/Project%20GIT/TMBilling/run.py) | Entry point utama server Flask. Menginisialisasi `create_app()`, mendaftarkan 4 background scheduler (cleanup expired sessions, dynamic auto backup, log cleanup, auto screenshot), mendeteksi mode debug/Waitress WSGI, dan membuka port 5000. |
| [`run_branch2.py`](file:///c:/Project%20GIT/TMBilling/run_branch2.py) | Script runner khusus untuk simulasi cabang ke-2 pada port `7016` dengan database terpisah `warnet_cabang2.db`. Digunakan untuk pengetesan multi-branch lokal. |
| [`seed.py`](file:///c:/Project%20GIT/TMBilling/seed.py) | Script database seeder komprehensif. Mengisi data awal: grup (`reguler`, `vip`), paket billing, member default, item menu kantin, akun user/admin, game, dan tutorial dasar. |
| [`create_admin.py`](file:///c:/Project%20GIT/TMBilling/create_admin.py) | CLI utility untuk membuat akun admin emergency dengan hashing password SHA-256 / Werkzeug yang valid secara instan. |
| [`build_release.py`](file:///c:/Project%20GIT/TMBilling/build_release.py) | Script rilis otomatis. Memaketkan `TMBilling_Server_vX.X.X.zip` dan `TMBilling_Client_vX.X.X.zip` dengan menyaring file dev (`.git`, `.venv`, cache, test, node_modules). |
| [`tailwind.config.js`](file:///c:/Project%20GIT/TMBilling/tailwind.config.js) | Konfigurasi purge Tailwind CSS yang memindai semua template HTML dan file JS di `app/templates` dan `app/static/js`. |
| [`package.json`](file:///c:/Project%20GIT/TMBilling/package.json) & [`package-lock.json`](file:///c:/Project%20GIT/TMBilling/package-lock.json) | Definisi toolchain frontend: `tailwindcss@3.4.17` dan script `npm run build:css` (`tailwindcss -i ./app/static/css/input.css -o ./app/static/css/tailwind.css --minify`). |
| [`requirements.txt`](file:///c:/Project%20GIT/TMBilling/requirements.txt) | Dependencies Python: `Flask`, `Flask-SQLAlchemy`, `Flask-WTF`, `Flask-Migrate`, `APScheduler`, `waitress`, `simple-websocket`, `requests`, `python-dotenv`, `pytest`, dll. |
| [`.env`](file:///c:/Project%20GIT/TMBilling/.env) & [`.env.example`](file:///c:/Project%20GIT/TMBilling/.env.example) | Konfigurasi environment: `SECRET_KEY`, `DATABASE_URL`, `DEBUG_MODE`, `CLIENT_API_KEY`, `WAITRESS_THREADS`, `BLACKOUT_THRESHOLD_MINUTES`. |
| [`install.bat`](file:///c:/Project%20GIT/TMBilling/install.bat) | Batch installer otomatis untuk Windows Server: membuat virtual environment `.venv`, menginstall dependencies pip, generate `.env`, dan inisialisasi database. |
| [`start.bat`](file:///c:/Project%20GIT/TMBilling/start.bat) & [`stop.bat`](file:///c:/Project%20GIT/TMBilling/stop.bat) | Script praktis operasional kasir untuk menyalakan server (background/foreground) dan mematikan proses Flask via PID/taskkill. |
| [`developer_install.bat`](file:///c:/Project%20GIT/TMBilling/developer_install.bat) | Setup lingkungan development lengkap (Python `.venv` + `npm install`). |
| [`build_and_deploy.bat`](file:///c:/Project%20GIT/TMBilling/build_and_deploy.bat) | Script pipeline build gabungan untuk frontend CSS dan backend release. |
| [`install_scripts/gen_env.py`](file:///c:/Project%20GIT/TMBilling/install_scripts/gen_env.py) | Generator file `.env` otomatis dari template `.env.example` dengan token rahasia acak 32-byte hexadecimal. |
| [`install_scripts/init_db.py`](file:///c:/Project%20GIT/TMBilling/install_scripts/init_db.py) | Inisialisasi skema tabel database melalui `db.create_all()` di dalam application context. |
| [`scripts/migrate_timezone_to_utc.py`](file:///c:/Project%20GIT/TMBilling/scripts/migrate_timezone_to_utc.py) | Skrip migrasi batch untuk mengonversi data tanggal/waktu lama dari format naive WIB (UTC+7) ke standard UTC. |
| [`plugins/hello_world/`](file:///c:/Project%20GIT/TMBilling/plugins/hello_world) | Plugin percontohan untuk sistem plugin eksternal TMBilling (`manifest.json`, `plugin.py`, `__init__.py`). |

---

## 🐍 4. AUDIT & PEMETAAN LENGKAP BACKEND FLASK (`app/`)

### 4.1 Konfigurasi & Inisialisasi App
* [`app/config.py`](file:///c:/Project%20GIT/TMBilling/app/config.py):
  - Class `Config`: Memuat `.env`, konfigurasi database SQLite (`warnet.db` atau `test_warnet.db` saat pytest), session timeout 24 jam (`PERMANENT_SESSION_LIFETIME = 86400`), `WTF_CSRF_TIME_LIMIT = None` (sinkron dengan session), `VERSION = "1.6.3"`, `VERSION_NAME = "Multi-Branch Nexus"`.
  - Helper methods: `Config.get_version_tag()` (`"v1.6.3"`), `Config.get_cache_version()` (`"163"`).
* [`app/__init__.py`](file:///c:/Project%20GIT/TMBilling/app/__init__.py):
  - Application Factory: `create_app(config_class=Config)`.
  - Inisialisasi Extensions: `db` (SQLAlchemy), `migrate` (Flask-Migrate), `csrf` (CSRFProtect).
  - Pendaftaran 35 Blueprint modular: 2 Frontend Views, 28 Kasir APIs, 5 Public APIs.
  - CSRF Exemption otomatis untuk API Klien/Token: `client_api_bp`, `auth_api_bp`, `monitor_api_bp`, `server_monitor_bp`.
  - Error Handler kustom: 400 Bad Request, 404 Not Found, 500 Internal Server Error, CSRF Error (mengembalikan JSON terstandarisasi).
  - Jinja Filters: `format_rupiah`, `format_durasi`, `format_display_datetime`.

### 4.2 Middleware Keamanan (`app/middleware/`)
* [`app/middleware/auth.py`](file:///c:/Project%20GIT/TMBilling/app/middleware/auth.py):
  - `@login_required`: Memastikan session `user_id` ada dan valid.
  - `@admin_required`: Membatasi rute sensitif hanya untuk user dengan role `admin` atau `owner`.
  - `@shift_required`: Memastikan kasir telah membuka shift aktif sebelum melakukan transaksi billing/kantin.
* [`app/middleware/branch_proxy.py`](file:///c:/Project%20GIT/TMBilling/app/middleware/branch_proxy.py):
  - Mendeteksi header HTTP `X-Branch-ID`. Jika request kasir ditujukan untuk cabang remote, middleware mencegat request dan melakukan forwarding via `BranchProxyService` secara transparan.
* [`app/middleware/ip_whitelist_middleware.py`](file:///c:/Project%20GIT/TMBilling/app/middleware/ip_whitelist_middleware.py):
  - Memverifikasi apakah IP kasir terdaftar dalam whitelist IP yang diizinkan untuk mengakses dashboard kasir.

### 4.3 Model SQLAlchemy (25 Models) — `app/models/`
Semua model inherit dari `app.models.base.base.BaseModel` yang menyediakan kolom `id`, `created_at` (UTC), dan `updated_at` (UTC):

| Model | File Lokasi | Kolom & Field Krusial | Relasi & Catatan |
|---|---|---|---|
| `BaseModel` | `app/models/base/base.py` | `id` (PK, int), `created_at` (DateTime UTC), `updated_at` (DateTime UTC) | Base class seluruh entity. |
| `PC` | `app/models/pc/pc.py` | `kode` (str unique), `nama` (str), `ip_address` (str), `mac_address` (str), `grup_id` (FK Grup), `pos_x` (int), `pos_y` (int), `status` (Enum `PCStatus`), `is_admin_mode` (bool), `aktif` (bool) | Nilai `pos_x, pos_y = -1` berarti Unmapped (belum dipetakan di denah). |
| `PCUptimeLog` | `app/models/pc/pc_uptime.py` | `pc_id` (FK PC), `event_type` (`start`/`stop`/`heartbeat`), `timestamp` (DateTime UTC) | Riwayat hidup/mati unit PC. |
| `Sesi` | `app/models/sesi/sesi.py` | `pc_id` (FK PC), `member_id` (FK Member, nullable), `tipe` (Enum `SesiType`: guest/member/admin), `durasi_menit` (int), `sisa_menit` (int), `status` (Enum `SesiStatus`: aktif/selesai/terkunci), `total_biaya` (int), `biaya_fnb` (int), `sesi_asal_id` (FK self-referential untuk tracking pindah PC), `is_afk` (bool), `afk_start_time` (DateTime) | Unit inti siklus billing. |
| `Grup` | `app/models/grup/grup.py` | `nama` (str unique), `keterangan` (str), `tarif_per_jam` (int), `warna` (str hex), `urutan` (int), `aktif` (bool) | Zona PC (Regular, VIP, VVIP, Sofa). |
| `User` | `app/models/user/user.py` | `username` (str unique), `password_hash` (str), `role` (`admin`/`kasir`/`owner`), `nama_lengkap` (str), `pin` (str 6-digit), `is_active` (bool) | Operator sistem. Password di-hash via Werkzeug / SHA-256. |
| `Member` | `app/models/member/member.py` | `username` (str unique), `password_hash` (str), `nama` (str), `saldo` (int), `nomor_telepon` (str), `rfid_card` (str unique, nullable), `status_aktif` (bool) | Akun member warnet. |
| `Paket` | `app/models/paket/paket.py` | `nama` (str), `durasi_menit` (int), `harga` (int), `grup_id` (FK Grup), `aktif` (bool), `is_promo` (bool), `jam_mulai` (time), `jam_selesai` (time) | Pilihan paket waktu billing. |
| `Menu` | `app/models/menu/menu.py` | `nama` (str), `harga` (int), `stok` (int), `kategori_id` (FK MenuKategori), `is_archived` (bool), `foto_url` (str) | Item FnB kantin. |
| `MenuKategori` | `app/models/menu/menu.py` | `nama` (str unique), `urutan` (int) | Kategori makanan, minuman, rokok, voucher. |
| `MenuStockLog` | `app/models/menu/menu.py` | `menu_id` (FK Menu), `perubahan` (int), `stok_awal` (int), `stok_akhir` (int), `alasan` (str), `operator` (str) | Audit mutasi stok kantin. |
| `Transaksi` | `app/models/transaksi/transaksi.py` | `no_nota` (str), `sesi_id` (FK Sesi, nullable), `user_id` (FK User), `total` (int), `metode_pembayaran` (Enum `PaymentMethod`), `tunai_diterima` (int), `kembalian` (int), `jenis` (Enum `TransaksiJenis`), `operator` (str), `shift_id` (FK ShiftRecord, nullable) | Pencatatan penerimaan uang kas. |
| `TransaksiMenu`| `app/models/transaksi/transaksi.py` | `transaksi_id` (FK Transaksi), `menu_id` (FK Menu), `jumlah` (int), `harga_satuan` (int), `subtotal` (int) | Detail item FnB per nota. |
| `HardwareMonitor` | `app/models/hardware/hardware.py` | `pc_id` (FK PC unique), `cpu_usage` (float), `cpu_temp` (float), `gpu_temp` (float), `total_ram` (int), `free_ram` (int), `nic_speed` (int), `motherboard` (str model), `cpu_name` (str), `gpu_name` (str), `active_window` (str), `hardware_baseline` (JSON), `hardware_current_specs` (JSON), `hardware_mismatch` (bool) | Telemetri realtime dan anti-theft hardware. |
| `PCProcess` | `app/models/hardware/hardware.py` | `pc_id` (FK PC), `pid` (int), `name` (str), `memory_mb` (float), `cpu_pct` (float) | Snapshot proses aktif task manager klien. |
| `ShiftRecord` | `app/models/shift/shift_record.py` | `user_id` (FK User), `mulai` (DateTime UTC), `selesai` (DateTime UTC), `modal_awal` (int), `total_pendapatan_sistem` (int), `total_fisik_diterima` (int), `selisih` (int), `status` (`aktif`/`tutup`), `detail_metode` (JSON), `catatan` (str) | Akuntabilitas kasir (Blind Cash Handover). |
| `Branch` | `app/models/branch/branch.py` | `nama` (str), `alamat` (str), `server_url` (str), `api_key` (str), `is_active` (bool) | Server cabang remote yang terdaftar. |
| `BranchInbound` | `app/models/branch/branch_inbound.py` | `token` (str unique), `nama_cabang` (str), `ip_origin` (str), `last_seen` (DateTime), `is_connected` (bool) | Inbound bridge untuk koneksi Cloudflare Tunnel. |
| `Game` | `app/models/game/game.py` | `nama` (str), `executable_path` (str), `kategori_id` (FK GameKategori), `icon_path` (str), `deskripsi` (str), `tipe` (str) | Launcher game terinstall di warnet. |
| `GameKategori` | `app/models/game/game_kategori.py` | `nama` (str unique), `icon` (str) | Kategori genre game (FPS, MOBA, Battle Royale). |
| `MaintenanceTicket` | `app/models/maintenance/maintenance.py` | `pc_id` (FK PC), `judul` (str), `deskripsi` (str), `status` (`open`/`in_progress`/`resolved`), `prioritas` (`low`/`medium`/`high`), `pelapor` (str) | Tiket komplain kerusakan hardware/software. |
| `MikrotikConfig` | `app/models/mikrotik/mikrotik.py` | `host` (str), `port` (int), `username` (str), `password_encrypted` (str), `is_active` (bool) | Integrasi RouterOS API untuk manajemen traffic warnet. |
| `Settings` | `app/models/settings/settings.py` | `key` (str unique PK), `value` (str), `keterangan` (str) | Konfigurasi dinamis (CCTV URL, GMaps, interval auto-backup, dll). |
| `Turnamen` | `app/models/tournament/tournament.py` | `nama` (str), `game` (str), `biaya_pendaftaran` (int), `tipe_bracket` (`single_elimination`/`double_elimination`), `status` (`pendaftaran`/`berjalan`/`selesai`), `hadiah` (str) | Manajemen turnamen eSports warnet. |
| `TurnamenTahap` | `app/models/tournament/tournament.py` | `turnamen_id` (FK Turnamen), `nama_tahap` (str), `urutan` (int) | Babak turnamen (Qualifier, Semifinal, Grand Final). |
| `TurnamenMatch` | `app/models/tournament/tournament.py` | `tahap_id` (FK TurnamenTahap), `tim_a` (str), `tim_b` (str), `skor_a` (int), `skor_b` (int), `pemenang_id` (str) | Pertandingan eSports individual. |
| `TurnamenPeserta` | `app/models/tournament/tournament.py` | `turnamen_id` (FK Turnamen), `nama_tim` (str), `kontak` (str), `status_bayar` (bool) | Data partisipan tim turnamen. |
| `Tutorial` | `app/models/tutorial/tutorial_model.py` | `judul` (str), `slug` (str unique), `konten_html` (str), `kategori` (str), `urutan` (int) | Dokumentasi & panduan SOP kasir. |
| `AuditLog` | `app/utils/logger.py` | `timestamp` (DateTime UTC), `aksi` (str), `detail` (str), `user` (str), `ip_address` (str), `kategori` (str: auth/sesi/pc/system/hardware/shift/transaksi) | Log aktivitas keamanan & transaksi. |

### 4.4 Repositories Data Access Layer (15 Repositories) — `app/repositories/`
Mengisolasi seluruh query SQL SQLAlchemy agar layer Services bebas dari dependensi kueri langsung:
1. [`pc_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/pc/pc_repository.py): `get_all()`, `get_by_id()`, `get_by_kode()`, `get_by_ip()`, `get_by_grup()`, `update_posisi(pc_id, x, y)`, `save()`, `delete()`.
2. [`sesi_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/sesi/sesi_repository.py): `get_aktif_by_pc()`, `get_all_aktif()`, `get_expired_sesi()`, `get_history()`, `save()`.
3. [`member_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/member/member_repository.py): `get_by_id()`, `get_by_username()`, `get_by_rfid()`, `update_saldo()`, `search()`.
4. [`transaksi_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/transaksi/transaksi_repository.py): `create_transaksi()`, `get_by_no_nota()`, `get_today_transactions()`, `get_by_shift()`.
5. [`hardware_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/hardware/hardware_repository.py): `get_by_pc_id()`, `upsert_metric()`, `update_baseline()`.
6. [`process_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/process/process_repository.py): `bulk_replace_processes(pc_id, process_list)`.
7. [`grup_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/grup/grup_repository.py): `get_all_active()`, `get_by_id()`, `create()`, `update()`.
8. [`paket_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/paket/paket_repository.py): `get_by_grup()`, `get_available_promo()`, `get_by_id()`.
9. [`menu_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/menu/menu_repository.py): `get_active_menu()`, `update_stock()`, `log_stock_mutation()`.
10. [`user_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/user/user_repository.py): `get_by_username()`, `verify_pin()`, `get_operators()`.
11. [`settings_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/settings/settings_repository.py): `get_value(key, default)`, `set_value(key, value)`.
12. [`tournament_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/tournament/tournament_repository.py): CRUD Turnamen, Tahap, Match, dan Peserta.
13. [`tutorial_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/tutorial/tutorial_repository.py): `get_all_published()`, `get_by_slug()`, `save()`.
14. [`game_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/game/game_repository.py): `get_all_games()`, `filter_by_kategori()`.
15. [`game_kategori_repository.py`](file:///c:/Project%20GIT/TMBilling/app/repositories/game/game_kategori_repository.py): CRUD Kategori Game.

### 4.5 Services Business Logic Layer (41 Services) — `app/services/`
Sentral logika bisnis, kalkulasi tarif, proteksi konkurensi, dan validasi:
* **PC & Billing Core**:
  - `pc_service.py`: Operasional PC, mode admin, pendaftaran PC baru, `update_position` dengan validasi rentang koordinat `(-1..10000)`.
  - `sesi_service.py`: `buka_guest()`, `buka_member()`, `buka_admin()`, `tambah_waktu_sesi()`, `tutup_sesi()`, `pindah_pc()`, `cleanup_expired()`, `refund_paket_guest()`.
  - `shift_service.py`: Siklus shift kasir, rekonsiliasi kas (Blind Cash Handover), kalkulasi selisih kas fisik vs sistem.
  - `transaksi_service.py`: Multi-payment receipt generator, integrasi potong stok kantin otomatis.
* **Telemetri, Remote & Hardware**:
  - `hardware_service.py`: Parsing telemetri hardware, verifikasi baseline, deteksi mismatch/pencurian RAM/GPU/Mobo.
  - `uptime_service.py`: Heartbeat tracker, pencatatan log uptime/downtime unit PC.
  - `vnc_service.py`: Sesi remote control display RFB proxy ke TightVNC PC klien.
  - `fileexplorer_service.py`: Remote file manager klien dengan proteksi anti-Path Traversal dan anti-Zip Slip.
  - `server_monitor_service.py`: Monitoring performa server (CPU, RAM, Disk) via LibreHardwareMonitor.
* **Multi-Branch, Network & Cloud**:
  - `branch_service.py` & `branch_proxy_service.py`: Multi-Branch proxy dispatcher via header `X-Branch-ID`.
  - `branch_inbound_service.py`: Registrasi agen remote via Cloudflare Ingress.
  - `cloudflare_tunnel_service.py`: Pengendali daemon Cloudflare Tunnel background.
  - `ip_whitelist_service.py`: Manajemen daftar IP kasir yang diizinkan.
* **FnB, Member & Entertainment**:
  - `member_service.py`: Registrasi member, deposit saldo, riwayat bermain, login portal.
  - `menu_service.py`: Manajemen produk FnB, penyesuaian stok, riwayat mutasi.
  - `tournament_service.py`: Generator bracket turnamen, skoring, manajemen tim peserta.
  - `game_service.py` & `game_kategori_service.py`: Katalog game klien dan peluncur aplikasi.
  - `tv_service.py`: Aggregator data Billboard TV publik (ketersediaan PC, promo, turnamen).
* **Audit, Reporting & Maintenance**:
  - `log_audit_service.py`: Kueri dan filter audit log keamanan.
  - `pdf_export_service.py` & `report_service.py`: Generator laporan keuangan harian/bulanan dalam PDF & Excel.
  - `backup_service.py` & `providers.py`: Provider backup database lokal dan remote.
  - `db_maintenance_service.py`: Vacuuming SQLite, WAL checkpointing, integritas data.
  - `blackout_service.py`: Pemulihan status sesi billing otomatis pasca listrik padam (*power blackout*).
  - `plugin_manager.py` & `base_plugin.py`: Sistem plugin modular untuk ekstensi kasir pihak ketiga.
  - `tutorial_service.py`: CMS artikel bantuan & SOP kasir.

### 4.6 Blueprints & Routes (31 Route Modules) — `app/routes/`
1. `dashboard_bp` (`/kasir`): Render tampilan utama Single-Page kasir (`app/templates/kasir/index.html`).
2. `member_portal_bp` (`/`): Landing page publik, portal login member, cek saldo, live PC status, list game, specs.
3. `auth_kasir_api_bp` (`/api/v1/kasir/auth`): Login, logout, cek sesi operator kasir.
4. `dashboard_api_bp` (`/api/v1/kasir/dashboard`): Data reaktif PC per grup, okupansi, dan metrik kasir.
5. `pc_api_bp` (`/api/v1/kasir/pc`): CRUD PC, `/<id>/position`, remote lock, unlock, shutdown, restart, WOL, batch-action.
6. `sesi_api_bp` (`/api/v1/kasir/sesi`): Buka guest/member, tambah waktu, tutup sesi, pindah PC, refund.
7. `member_api_bp` (`/api/v1/kasir/member`): CRUD member, top-up saldo deposit, riwayat sesi.
8. `paket_api_bp` (`/api/v1/kasir/paket`): CRUD paket billing, tarif promo jam tertentu.
9. `grup_api_bp` (`/api/v1/kasir/grup`): CRUD zona/grup PC.
10. `user_api_bp` (`/api/v1/kasir/user`): Manajemen user kasir & admin, ganti password/PIN.
11. `menu_api_bp` (`/api/v1/kasir/menu`): Katalog FnB kantin, restock, mutasi stok.
12. `report_api_bp` (`/api/v1/kasir/report`): Laporan pendapatan kasir, omzet harian, export PDF/Excel.
13. `shift_api_bp` (`/api/v1/kasir/shift`): Buka shift, tutup shift (blind handover), riwayat serah terima kas.
14. `monitor_kasir_bp` (`/api/v1/kasir/monitor`): Status hardware snapshot, task manager proses, daftarkan baseline.
15. `vnc_api_bp` (`/api/v1/kasir/vnc`): WebSocket RFB display tunnel remote desktop TightVNC.
16. `fileexplorer_api_bp` (`/api/v1/kasir/fileexplorer`): Remote file explorer (baca direktori, unduh, upload file ke klien).
17. `branch_api_bp` (`/api/v1/kasir/branch`): Manajemen cabang remote, switch cabang aktif.
18. `tournament_api_bp` (`/api/v1/kasir/tournament`): Manajemen turnamen eSports, pendaftaran tim, bracket update.
19. `maintenance_api_bp` (`/api/v1/kasir/maintenance`): Tiket maintenance PC, update status perbaikan.
20. `uptime_api_bp` (`/api/v1/kasir/uptime`): Statistik ketersediaan dan log downtime PC.
21. `blackout_api_bp` (`/api/v1/kasir/blackout`): Resolusi sesi tertunda akibat mati listrik.
22. `backup_api_bp` (`/api/v1/kasir/backup`): Pemicu backup manual dan restore database.
23. `settings_api_bp` (`/api/v1/kasir/settings`): Konfigurasi sistem dinamis (GMaps, sound, logo, CCTV URL).
24. `migration_api_bp` (`/api/v1/kasir/settings/migration`): Status migrasi skema database Alembic.
25. `plugin_api_bp` (`/api/v1/kasir/settings/plugins`): Manajemen status plugin eksternal.
26. `mikrotik_api_bp` (`/api/v1/kasir/mikrotik`): Uji koneksi dan sinkronisasi RouterOS Mikrotik.
27. `game_kasir_api_bp` (`/api/v1/kasir/game`): CRUD katalog game yang dipajang di warnet.
28. `tutorial_api_bp` (`/api/v1/kasir/tutorials`): CRUD artikel panduan SOP kasir (CKEditor support).
29. `notes_api_bp` (`/api/v1/kasir/notes`): Catatan internal kasir antar-shift.
30. `server_monitor_bp` (`/api/v1/kasir/server-monitor`): Statistik beban CPU/RAM/Disk server utama.
31. `public_api` (Blueprints Publik):
    - `auth_api_bp` (`/api/v1/public/auth`): Login member dari desktop klien WarnetAgent.
    - `client_api_bp` (`/api/v1/public/client`): Polling status sesi billing, heartbeat klien, lock state.
    - `monitor_api_bp` (`/api/v1/public/monitor`): Ingest snapshot telemetri hardware & daftar proses dari agen klien.
    - `game_public_api_bp` (`/api/v1/public/game`): Daftar game untuk public portal.
    - `tv_public_api_bp` (`/api/v1/public/tv`): Feed data untuk billboard display TV.

### 4.7 Utilities & Background Schedulers (8 Modules) — `app/utils/`
1. [`constants.py`](file:///c:/Project%20GIT/TMBilling/app/utils/constants.py): Enum terpusat: `PCStatus` (`kosong`, `terpakai`, `offline`, `maintenance`, `admin`), `SesiType` (`guest`, `member`, `admin`), `SesiStatus` (`aktif`, `selesai`, `terkunci`), `TransaksiJenis`, `PaymentMethod` (`Tunai`, `QRIS`, `Transfer`, `Deposit`).
2. [`timezone_utils.py`](file:///c:/Project%20GIT/TMBilling/app/utils/timezone_utils.py): Konversi zona waktu standar. `now_utc()`, `to_local()`, `to_utc()`, `format_display()`.
3. [`validators.py`](file:///c:/Project%20GIT/TMBilling/app/utils/validators.py): Validasi ketat input: `validate_integer_range`, `validate_string_length`, `validate_currency`, `validate_ip_address`, `validate_mac_address`.
4. [`logger.py`](file:///c:/Project%20GIT/TMBilling/app/utils/logger.py): Engine centralized audit log. Fungsi `write_log(aksi, detail, user, ip_address, kategori)`.
5. [`scheduler_tasks.py`](file:///c:/Project%20GIT/TMBilling/app/utils/scheduler_tasks.py): Task periodik background: `run_cleanup_expired`, `run_database_backup`, `run_cleanup_logs`, `run_auto_screenshots`.
6. [`mikrotik_api.py`](file:///c:/Project%20GIT/TMBilling/app/utils/mikrotik_api.py): Wrapper socket RouterOS API v6/v7 untuk mengontrol antrian bandwidth dan bind IP-MAC.
7. [`pdf_helper.py`](file:///c:/Project%20GIT/TMBilling/app/utils/pdf_helper.py): Helper rendering PDF thermal struk dan laporan akuntansi A4.
8. [`helpers.py`](file:///c:/Project%20GIT/TMBilling/app/utils/helpers.py): Utilitas parsing angka rupiah, sanitasi nama file, ekstraksi user-agent.

---

## 🎨 5. AUDIT & PEMETAAN LENGKAP FRONTEND KASIR & PUBLIK

### 5.1 Core JavaScript Modules (`app/static/js/kasir/core/`)
* **[`api.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/api.js)**:
  - `API.request(url, options)`: Wrapper global `fetch()`.
  - Menginjeksi token CSRF `X-CSRFToken` pada method POST/PUT/DELETE.
  - Menginjeksi header `X-Branch-ID` otomatis saat kasir mengelola cabang remote.
  - Menangani error 400 "Shift Belum Dibuka" dan otomatis membuka modal Buka Shift.
* **[`modal.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/modal.js)**:
  - `Modal.show(html)`: Overlay modal universal dengan backdrop blur dan animasi transisi halus.
  - `Modal.closeModal()`: Menutup modal dan membersihkan event listener keyboard ESC.
  - `Modal.confirm(html, onConfirm)`: Dialog konfirmasi aksi destruktif.
* **[`skeleton.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/skeleton.js)**:
  - Engine sentral skeleton loading modern (tanpa spinner putar kuno):
  - `Skeleton.pcCards(n)`: Placeholder kartu PC dashboard.
  - `Skeleton.tableRows(cols, rows)`: Placeholder baris tabel data.
  - `Skeleton.statCards(n)`: Placeholder kartu ringkasan metrik omzet.
  - `Skeleton.hardwareDetailView()`: Placeholder view audit hardware.
  - `Skeleton.formFields(n)`: Placeholder form modal.
* **[`toast.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/toast.js)**:
  - Notifikasi toast: `Toast.success()`, `Toast.error()`, `Toast.warning()`, `Toast.info()`.
* **[`utils.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/utils.js)**:
  - Format angka rupiah (`formatRupiah`), durasi waktu (`formatDurasiFriendly`), sanitasi HTML (`escapeHtml`).

### 5.2 Kasir Modal Components (`app/static/js/kasir/components/`)
* [`modal-buka.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/components/modal-buka.js): Modal pembukaan sesi baru PC (Guest, Member, atau Paket Billing).
* [`modal-tambah.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/components/modal-tambah.js): Modal penambahan durasi billing pada sesi aktif.
* [`modal-confirm-tambah.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/components/modal-confirm-tambah.js): Modal konfirmasi pembayaran penambahan waktu billing.

### 5.3 Modul Fitur Kasir (37 Modul di `app/static/js/kasir/modules/`)
1. **`dashboard/`** (Arsitektur Reaktif Dashboard Utama):
   - [`index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/index.js): Controller utama `Dashboard.load()`, polling realtime 3s, switching filter grup, deteksi perubahan denah `_hasStructureChanged`.
   - [`dashboard_compact.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_compact.js): Render kartu PC responsif, ticker sisa waktu live, indikator LAN speed drop warning.
   - [`map_view.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/map_view.js): Visual floor plan editor denah meja PC. Drag-and-drop koordinat meja, validasi `(-1..10000)`, save async batch via `update_position`.
   - [`dashboard_detail_modal.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js): Detail lengkap PC (info sesi, kontrol remote, viewer screenshot live, perbandingan hardware baseline vs live specs, pemisahan Mobo Model vs Mobo Serial).
   - [`dashboard_process_monitor.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js): Task manager klien live dan pengirim sinyal taskkill proses mencurigakan.
   - [`dashboard_selection.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_selection.js): Multi-PC checkbox selection & mass batch operations (mass lock, restart, shutdown, WOL).
   - [`sidebar.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/sidebar.js): Pengendali navigasi sidebar kasir/admin.
2. **`hardware_checker/index.js`**: Halaman audit keamanan spesifikasi hardware (Mobo Model, Mobo Serial, CPU ID, GPU PNP, RAM, Disk).
3. **`fileexplorer/index.js`**: UI File Explorer remote untuk menjelajahi disk PC klien, download, dan upload file.
4. **`remote/vnc_client.js`**: Canvas RFB viewer WebSocket untuk remote control layar TightVNC PC klien realtime.
5. **`screenshot/index.js`**: Galeri screenshot monitor seluruh PC klien dengan natural sorting (PC-1, PC-2, PC-10).
6. **`server_monitor/server_monitor.js`**: Grafik utilisasi CPU, RAM, suhu, dan storage server kasir utama.
7. **`member/`**: `index.js`, `member_modal.js`, `member_refill.js`, `member_table.js` (Manajemen member & saldo).
8. **`paket/`**: `index.js`, `paket_modal.js`, `paket_table.js` (Manajemen paket billing).
9. **`pc/`**: `index.js`, `pc_grid.js`, `pc_modal.js` (CRUD unit meja PC).
10. **`menu/`**: `index.js`, `stock_log.js` (Manajemen produk FnB kantin dan mutasi stok).
11. **`shift/index.js`**: Serah terima shift kasir, input kas fisik (*blind count*), rekap selisih.
12. **`struk/`**: `index.js`, `struk_preview.js` (Preview nota transaksi dan cetak thermal ESC/POS).
13. **`settings/`**: `index.js`, `migration.js`, `plugins.js`, `whitelist_ip.js` (Konfigurasi sistem).
14. **`tournament/index.js`**: Pengaturan turnamen, pembagian bracket, dan input skor pertandingan.
15. **`branch/index.js`**: Multi-Branch switcher dan monitoring konektivitas cabang.
16. **`blackout/index.js`**: Pemulihan sesi terdampak mati listrik (*blackout recovery*).
17. **`catatan/index.js`**: Buku catatan serah terima shift operator.
18. **`laporan/index.js`**: Laporan keuangan kasir, omzet, export dokumen.
19. **`laporan_maintenance/index.js`**: Riwayat tiket perbaikan perangkat komputer.
20. **`laporan_menu/index.js`**: Laporan penjualan makanan & minuman kantin.
21. **`log/index.js`**: Viewer audit trail keamanan dengan filter kategori log.
22. **`maintenance/index.js`**: Manajemen tiket kendala operasional PC.
23. **`mikrotik/index.js`**: Pengaturan koneksi RouterOS Mikrotik.
24. **`monitor/index.js`**: Halaman pantau ringkasan hardware warnet.
25. **`owner/analytics.js`**: Analitik bisnis & grafik okupansi warnet untuk Owner.
26. **`tutorials/index.js`**: Editor CMS artikel tutorial & SOP kasir (integrasi CKEditor).
27. **`uptime/index.js`**: Statistik uptime/downtime unit PC.
28. **`user/index.js`**: Manajemen user operator kasir.

### 5.4 JavaScript Member Portal & Public TV
* `app/static/js/member/`: `dashboard.js` (Dashboard member portal, cek saldo, riwayat transaksi), `livepc.js` (Denah ketersediaan PC live untuk member), `toast.js`.
* `app/static/js/public/`: `games.js` (Filter katalog game warnet), `tv.js` (Billboard TV display carousel reaktif), `tv_static.js` (Versi TV display offline cache).

### 5.5 Template Jinja2 Kasir & Public (`app/templates/`)
* **Kasir Shell & Layouts**:
  - `kasir/base.html`: Kerangka induk aplikasi kasir (Navbar, Sidebar Kasir/Admin, Modal Container, Toast Container, inject token CSRF).
  - `kasir/index.html`: Wrapper kontainer Single-Page tempat seluruh 26 tab dimuat secara dinamis.
  - `kasir/login.html`: Tampilan login operator kasir & admin.
  - `kasir/documentation.html`: Halaman dokumentasi offline bawaan aplikasi kasir.
* **Kasir Layout Components (`app/templates/kasir/components/`)**:
  - `navbar.html`: Header atas (indikator status shift kasir, cabang aktif, jam lokal, profile user).
  - `sidebar.html`, `sidebar_kasir.html`, `sidebar_admin.html`: Sidebar navigasi dinamis berbasis role pengguna.
  - `modals.html`: Kontainer penampung modal buka sesi, tambah waktu, dan dialog konfirmasi.
* **Kasir Server Monitor & Settings**:
  - `kasir/server_monitor/server_statistic.html`: View grafik telemetri performa hardware server.
  - `kasir/settings/migration.html`: Status migrasi skema database.
  - `kasir/settings/plugins.html`: Manajemen modul plugin eksternal.
  - `kasir/settings/whitelist_ip.html`: Konfigurasi pembatasan IP address kasir.
* **Seluruh 26 Tab Kasir (`app/templates/kasir/tabs/`)**:
  - `analytics.html`: Metrik omzet, jam sibuk, dan utilisasi PC.
  - `blackout.html`: Dialog pemulihan sesi pasca listrik padam.
  - `branch.html`: Pengaturan cabang remote warnet.
  - `branch_inbound.html`: Pendaftaran token koneksi Cloudflare Tunnel inbound.
  - `branch_kasir.html`: Tampilan kasir cabang remote.
  - `catatan.html`: Buku komunikasi kasir antar-shift.
  - `dashboard.html`: Grid kartu PC dan denah floor plan utama.
  - `fileexplorer.html`: Penjelajah file remote PC klien.
  - `game.html`: Manajemen katalog game terinstall.
  - `grup.html`: Manajemen zona dan tarif per jam.
  - `hardware_checker.html`: Audit keamanan hardware (anti-theft).
  - `laporan.html`: Laporan pendapatan kasir dan omzet.
  - `laporan_maintenance.html`: Rekap riwayat servis komputer.
  - `laporan_menu.html`: Laporan omzet FnB kantin.
  - `log.html`: Viewer audit log aktivitas kasir.
  - `maintenance.html`: Tiket keluhan kerusakan teknis.
  - `member.html`: Manajemen member dan saldo deposit.
  - `menu.html`: Item menu FnB kantin.
  - `menu_stock_log.html`: Riwayat pergerakan stok kantin.
  - `mikrotik.html`: Konfigurasi RouterOS Mikrotik.
  - `monitor.html`: Ringkasan telemetri hardware seluruh PC.
  - `paket.html`: Manajemen paket billing.
  - `pc.html`: Daftar dan konfigurasi unit meja PC.
  - `remote_server.html`: Monitoring server-server cabang.
  - `screenshot.html`: Galeri tangkapan layar monitor PC klien.
  - `settings.html`: Pengaturan sistem terpusat.
  - `shift_history.html`: Riwayat serah terima kas kasir.
  - `struk.html`: Template nota transaksi thermal.
  - `tournament.html`: Manajemen turnamen eSports warnet.
  - `uptime.html`: Statistik uptime dan keandalan PC.
  - `user.html`: Akun operator dan hak akses.
  - `user_logs.html`: Log aktivitas per user kasir.
* **Public & Member Portal (`app/templates/public/`)**:
  - `landing/index.html`: Halaman depan portal publik warnet.
  - `member/login.html` & `member/dashboard.html`: Portal member login, saldo, dan riwayat.
  - `livepc/index.html`: Cek meja PC yang kosong secara online via smartphone pelanggan.
  - `game/index.html`: Daftar game populer yang tersedia di warnet.
  - `paket/index.html`: Daftar promo dan paket billing yang berlaku.
  - `specs/index.html`: Spesifikasi hardware rig gaming yang disediakan warnet.
  - `tv/index.html` & `tv/static.html`: Tampilan signage billboard TV ruang tunggu.
  - Partials: `components/_head.html`, `components/_footer.html`, `components/_navbar_public.html`, `components/_navbar_member.html`.

### 5.6 Build Pipeline CSS (TailwindCSS v3 Minified)
* CSS Source: `app/static/css/input.css` (memuat `@tailwind base; @tailwind components; @tailwind utilities;`).
* CSS Output Minified: `app/static/css/tailwind.css`.
* Perintah Kompilasi Wajib:
  ```bash
  npm run build:css
  ```

---

## 🖥️ 6. AUDIT & PEMETAAN LENGKAP WARNETAGENT (`WarnetAgent/`)

WarnetAgent adalah paket aplikasi klien yang diinstall di setiap PC gaming/member:

### 6.1 TMBillingTauri (`WarnetAgent/TMBillingTauri/`)
* **Framework**: Tauri v1.5 (Rust Backend + HTML5/CSS/JS Webview2).
* **Rust Architecture (`src-tauri/src/`)**:
  - `main.rs`: Entry point utama. Memeriksa integritas binary, file lock agar tidak bisa di-rename/delete, inisialisasi system tray, dan mendaftarkan tauri invoke handlers.
  - `models.rs` & `state.rs`: Struct data internal status sesi, waktu bermain, dan kredensial server.
  - `commands/`:
    - `auth_commands.rs`: Login member, login guest, unlock admin lokal.
    - `network_commands.rs`: Heartbeat sesi dan pengambilan konfigurasi jaringan (IP, MAC).
    - `system_commands.rs`: Shutdown paksa, restart paksa, set/restore volume master sistem, wallpaper latar.
    - `window_commands.rs`: Kiosk lock enforcement, transisi layar penuh (kiosk <-> overlay floating timer <-> AFK lock).
  - `services/`:
    - `polling.rs`: Polling periodik (1-3 detik) ke endpoint `POST /api/v1/public/client/sync` server.
    - `setup.rs`: Setup awal audio intervals, single-instance mutex, registry hook.
    - `tray.rs`: System tray icon menu (Status Sesi, Buka Overlay, Keluar Admin).
    - `window_events.rs`: Pencegahan penutupan jendela oleh user (ALT+F4 blocker).
  - `utils/`:
    - `keyboard.rs`: Low-Level Windows Keyboard Hook (`SetWindowsHookExW`) untuk memblokir Alt+Tab, Windows Key, Ctrl+Esc, Alt+Esc, Task Manager shortcut.
    - `security.rs`: SHA-256 binary integrity checking, dual-hive registry autorun guard (`HKLM` & `HKCU`), executable file locking handle.
    - `screenshot.rs`: Engine capture monitor desktop PC klien (menggunakan crate `screenshots`) dan kompresi PNG/Base64.
    - `audio.rs`: Engine pemutar suara peringatan sisa waktu bermain (`warning_15min.mp3`, `warning_5min.mp3`, `warning_1min.mp3`).
    - `window_manager.rs`: Manipulasi jendela Win32 API (`SetWindowPos`, `HWND_TOPMOST`, `WS_EX_TOOLWINDOW`).
* **Frontend Kiosk (`src/`)**:
  - `index.html` & `kiosk/kiosk.js`: Tampilan fullscreen Kiosk Lock saat PC kosong atau terkunci. Memuat form login member/guest, cek paket, info turnamen, dan aturan warnet.
  - `overlay.html` & `overlay/overlay.js`: Floating widget kecil di pojok layar saat member sedang bermain. Menampilkan sisa waktu billing live, tombol pesan FnB, request ganti PC, dan logout.
  - `overlay/admin.js`: Modal unlock operator/admin di sisi klien dengan autentikasi PIN/Password server.
  - `shared/`: `api.js`, `constants.js`, `state.js`, `ui.js`, `utils.js`.
  - `assets/sounds/`: Berkas audio audio alert peringatan sisa waktu bermain.

### 6.2 TMBilling_Monitor (`WarnetAgent/TMBilling_Monitor/`)
* **Rust Daemon (`src/main.rs`)**:
  - Berjalan sebagai background service tanpa jendela (`windows_subsystem = "windows"`).
  - Membaca IP lokal, MAC Address, link speed NIC (Gbps/Mbps), dan active window title.
  - Mengekstrak embedded driver `HardwareHelper.exe` + `LibreHardwareMonitorLib.dll` secara otomatis jika belum ada.
  - Memantau port VNC dan mengenkripsi password TightVNC menggunakan DES Block Cipher agar kompatibel dengan native Windows Registry TightVNC.
  - Mengirim payload telemetri periodik ke endpoint `POST /api/v1/public/monitor`.
* **C# Sensor Helper (`HardwareHelper.cs`, `HardwareHelper.exe`, `HardwareHelper.sys`)**:
  - Membaca sensor kernel hardware via `LibreHardwareMonitorLib.dll` dan `HidSharp.dll`.
  - Mengambil data presisi: Model Motherboard, Serial Number Motherboard, Suhu CPU, Suhu GPU, Seri RAM, dan Disk Drive.

### 6.3 MGCTM & mtm (Dual Watchdog Resilience System)
* **`WarnetAgent/MGCTM/src/main.rs`**: Watchdog utama. Memeriksa apakah `TMBilling.exe` dan `TMMonitor.exe` tetap berjalan setiap detik. Jika salah satu proses dimatikan paksa (via Task Manager, Process Hacker, atau command line), watchdog akan otomatis menyalakannya kembali dalam hitungan milidetik.
* **`WarnetAgent/mtm/src/main.rs`**: Auxiliary watchdog pelindung `MGCTM.exe`. Mengawasi `MGCTM.exe` agar proses watchdog utama tidak dapat di-kill.
* **Mekanisme Keamanan Hex-XOR**: Kunci string rahasia dan konfigurasi token disimpan dengan algoritma obfuscation hex-XOR (`key = b"TMBillingSecretKey2026SecureObfuscation"`).
* **Mekanisme File Lock**: Masing-masing watchdog memegang write lock handle pada file executable untuk mencegah penghapusan binary saat sistem menyala.
* **Pemberhentian Resmi**: Hanya dapat dimatikan jika ditemukan berkas `stop.token` resmi yang telah ditandatangani oleh server saat proses uninstalasi.

### 6.4 TMBilling_Uninstaller (`WarnetAgent/TMBilling_Uninstaller/`)
* **`src/main.rs`**: Program uninstaller resmi berbasis Win32 API GUI murni.
* Menampilkan dialog otentikasi password admin. Password diverifikasi ke server atau diverifikasi terhadap hash SHA-256 emergency offline.
* Jika password benar, uninstaller akan:
  1. Menghasilkan `stop.token` untuk melumpuhkan dual watchdog (`MGCTM` dan `mtm`).
  2. Menghentikan seluruh proses `TMBilling.exe`, `TMMonitor.exe`, dan TightVNC.
  3. Menghapus pendaftaran Windows Service dan startup registry run key (`HKLM` & `HKCU`).
  4. Menghapus seluruh folder instalasi klien secara bersih.

### 6.5 Deploy Scripts, Provisioning & TightVNC Server (`WarnetAgent/Deploy/`)
* [`install.bat`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/Deploy/install.bat): Script instalasi otomatis silent untuk PC klien warnet.
* [`uninstall.bat`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/Deploy/uninstall.bat): Script pencopotan instalasi dengan verifikasi.
* [`allow_firewall.bat`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/Deploy/allow_firewall.bat): Membuka port inbound Windows Defender Firewall untuk VNC (5900) dan komunikasi klien.
* [`tightvnc_settings.reg`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/Deploy/tightvnc_settings.reg): Pengaturan registry TightVNC terisolasi (Loopback-only: hanya mengizinkan koneksi dari `127.0.0.1` demi keamanan).
* PowerShell Helper Scripts:
  - `create_admin_creds.ps1`: Pembuatan kredensial admin lokal klien.
  - `sync_registry.ps1`: Sinkronisasi entri autorun registry.
  - `write_config.ps1`: Penulisan konfigurasi IP server dan API Key ke file `.ini`.
  - `write_hashes.ps1`: Kalkulasi dan penulisan hash SHA-256 integritas biner.
* Binaries Siap Pakai:
  - `TMBilling.exe`, `TMMonitor.exe`, `MGCTM.exe`, `mtm.exe`, `TMBilling_Uninstaller.exe`, `WebView2Loader.dll`, `TightVNC/tvnserver.exe`.

---

## 🗄️ 7. AUDIT DATABASE MIGRATIONS (`migrations/` — 18 REVISIONS)

Skema database TMBilling dikelola menggunakan Flask-Migrate / Alembic. Seluruh 18 revisi migrasi:

1. `f2002facdcac_add_pos_x_pos_y_to_pc.py`: Menambahkan kolom koordinat denah `pos_x` dan `pos_y` pada tabel `pc`.
2. `326a351f8a88_add_pc_uptime_log_table.py`: Menambahkan tabel riwayat `pc_uptime_log`.
3. `433a9f697a02_add_process_monitoring.py`: Menambahkan tabel `pc_processes` untuk snapshot task manager klien.
4. `1daeed34ce74_add_serial_monitoring_to_hardware.py`: Menambahkan kolom nomor seri komponen dan baseline ke `hardware_monitor`.
5. `05864b2cbb33_add_maintenance_ticket_table.py`: Menambahkan tabel `maintenance_tickets`.
6. `64353b63b438_add_mikrotik_config.py`: Menambahkan tabel konfigurasi `mikrotik_config`.
7. `fd5f342fef7d_tambahkan_fitur_manajemen_game_dan_.py`: Menambahkan tabel `game` dan `game_kategori`.
8. `378524089e68_add_is_active_to_menu_item.py`: Menambahkan flag arsip `is_archived` pada tabel `menu`.
9. `434a73db84b5_add_tunai_kembalian_to_transaksi_menu.py`: Menambahkan field uang tunai dan kembalian pada transaksi kantin.
10. `638015476514_add_payment_method_columns.py`: Menambahkan kolom metode pembayaran (QRIS, Transfer, Deposit) pada transaksi.
11. `f3a1b2c4d5e6_add_operator_to_transaksi_and_transaksi_menu.py`: Menambahkan nama operator kasir pencatat pada transaksi.
12. `70637ae29f36_remove_unique_no_nota.py`: Menghapus constraint unique berlebih pada nota untuk mendukung multi-item print.
13. `8f7e6d5c4b3a_add_tipe_and_multigenre_to_game.py`: Menambahkan atribut genre dan tipe launcher pada game.
14. `a8f1b2c3d4e5_add_sesi_asal_id_and_afk_columns_to_sesi.py`: Menambahkan kolom `sesi_asal_id` (chaining pindah PC) dan kolom status `is_afk`.
15. `b7e2c91a4f01_add_peripherals_and_cctv_to_hardware.py`: Penambahan kolom peripheral awal pada model hardware.
16. `e7a1b2c3d4f5_remove_peripherals_from_hardware_monitor.py`: Refactor pembersihan schema peripheral monitor.
17. `c9d8e7f6a5b4_add_menu_stock_log_and_kuota_columns.py`: Menambahkan tabel audit `menu_stock_log` dan pembatasan kuota.
18. `e8f9a0b1c2d3_add_system_tutorials_table.py`: Menambahkan tabel dokumentasi dan SOP internal `tutorials`.

---

## 🛠️ 8. AUDIT TOOLS DEVELOPER & DEVOPS (`tools/`)

Folder `tools/` menyediakan script otomatisasi untuk testing, seeding data skenario, dan packaging:

1. [`tools/seed_hardware_peripheral_checker.py`](file:///c:/Project%20GIT/TMBilling/tools/seed_hardware_peripheral_checker.py):
   - Menghasilkan 4 skenario data simulasi audit hardware anti-theft untuk pengujian:
     - `PC01`: Aman / 100% Cocok (Baseline & Live identik).
     - `PC02`: GPU Ditukar saat PC Mati (Rentang waktu CCTV Shutdown-to-Boot dihitung otomatis).
     - `PC03`: RAM 1 Keping Hilang / Dicabut.
     - `PC04`: Motherboard Ditukar / Diganti model lain.
2. [`tools/seed_audit_logs.py`](file:///c:/Project%20GIT/TMBilling/tools/seed_audit_logs.py):
   - Mengisi puluhan audit log realistis dari berbagai kategori (`auth`, `sesi`, `pc`, `shift`, `hardware`, `system`) untuk memvalidasi paginasi dan filter log.
3. [`tools/create_review_package.py`](file:///c:/Project%20GIT/TMBilling/tools/create_review_package.py):
   - Utility packaging git diff antara base commit dan head commit untuk code review otomatis.
4. [`tools/extract_brief.py`](file:///c:/Project%20GIT/TMBilling/tools/extract_brief.py):
   - Mengekstrak task brief spesifik dari file markdown planning ke direktori `.superpowers/sdd/`.
5. [`tools/ckeditor-builder/`](file:///c:/Project%20GIT/TMBilling/tools/ckeditor-builder):
   - Custom build environment untuk paket CKEditor 5 yang digunakan pada fitur CMS Tutorial SOP Kasir.
   - Konfigurasi bundle memuat: `Heading`, `Bold`, `Italic`, `Underline`, `Strikethrough`, `Alignment`, `FontColor`, `Highlight`, `Link`, `List`, `Table`, `ImageUpload`, dan `CodeBlock`.
   - Output biner disimpan di `app/static/vendor/ckeditor/ckeditor.js` dan `ckeditor.css`.

---

## 🧪 9. AUDIT TEST SUITES (`tests/` — 81 TEST FILES, 264 SPECS)

Sistem backend TMBilling dilindungi oleh **264 unit/integration test** di folder `tests/`. Seluruh test wajib lolos:
```bash
python -m pytest tests/ -q
```
*Expected Result:* `264 passed, 0 failed` (Exit code: 0).

### Kategorisasi 81 Berkas Unit Test:
* **PC & Koordinat Denah**:
  - `test_pc_validation.py`: Validasi kode PC, format IP, format MAC address, penolakan input invalid.
  - `test_pc_grup_validation.py`: Validasi relasi grup dan tarif PC.
  - `test_pc_hard_delete_and_uptime.py`: Logika penghapusan hard-delete PC dan cascading log uptime.
  - `test_system_validation_refactor.py`: Validasi range posisi denah floor plan `pos_x` dan `pos_y` (-1 sampai 10000).
* **Sesi Billing & Transaksi**:
  - `test_batch_sesi_routes.py`: Pengujian pembukaan sesi massal dan penambahan waktu.
  - `test_pindah_pc_refund.py`: Pengujian perpindahan unit PC bermain dan refund sisa waktu guest.
  - `test_afk_model_and_migration.py`, `test_afk_dashboard_integration.py`, `test_afk_expiry_and_member_balance.py`: Siklus lengkap mode AFK (kunci layar istirahat meja, pemotongan saldo, dan auto-timeout).
  - `test_kasir_client_session.py`: Sinkronisasi sesi kasir dengan klien.
  - `test_package_transaction_bounds.py`: Batasan durasi dan nominal paket transaksi.
* **Shift Kasir & Akuntansi Kas**:
  - `test_shift_service_robustness.py`: Perhitungan modal awal, pendapatan sistem, dan kalkulasi selisih kas fisik.
  - `test_shift_concurrency_protection.py`: Pencegahan pembukaan dua shift aktif secara bersamaan oleh kasir yang sama.
  - `test_shift_force_close.py`: Penutupan paksa shift oleh admin jika kasir lupa checkout.
  - `test_shift_dynamic_payments.py`: Rekonsiliasi pembayaran multi-metode (Tunai, QRIS, Transfer).
  - `test_shift_mandatory_transaction.py`: Kewajiban shift aktif sebelum memproses transaksi uang.
  - `test_shift_model_detail_metode.py`: Validasi penyimpanan JSON `detail_metode` pada model shift.
  - `test_kasir_benefit_models.py` & `test_kasir_benefit_shift_routes.py`: Perhitungan benefit insentif kasir.
* **Keamanan Hardware & Anti-Theft**:
  - `test_peripheral_model.py` & `test_peripheral_service_logic.py`: Deteksi perubahan fisik Mobo, Mobo Serial, CPU ID, GPU PNP.
  - `test_dashboard_nic_speed.py`: Deteksi penurunan kecepatan LAN (1 Gbps drop ke 100 Mbps) akibat kabel LAN longgar/rusak.
* **Remote Management (VNC & File Explorer)**:
  - `test_vnc_client_proxy.py`: WebSocket RFB tunnel relay ke TightVNC server loopback.
  - `test_vnc_password_automation.py`: Validasi otomatisasi enkripsi password VNC DES registry.
  - `test_vnc_clipboard_guard.py`: Isolasi clipboard remote VNC.
  - `test_fileexplorer_service.py` & `test_fileexplorer_api.py`: Validasi penjelajahan direktori remote PC klien.
  - `test_security_zip_slip.py` & `test_fileexplorer_security.py`: Penolakan mutlak Path Traversal (`../`) dan Zip-Slip pada file explorer.
* **Multi-Branch Nexus Architecture**:
  - `test_branch_model.py`: Model cabang dan validasi URL server remote.
  - `test_branch_proxy_relay.py`: Mekanisme relay HTTP header `X-Branch-ID`.
  - `test_branch_auth_middleware.py`: Isolasi otentikasi antar-cabang.
  - `test_branch_switch_connectivity.py`: Validasi ping konektivitas sebelum kasir beralih cabang.
  - `test_branch_media_proxy.py`: Proxy konten media/gambar dari server cabang remote.
  - `test_branch_refresh_loop_prevention.py`: Pencegahan infinite redirect loop saat koneksi cabang terputus.
  - `test_branch_inbound_connections.py`: Pengujian koneksi masuk via Cloudflare Ingress.
  - `test_branch_remote_kasir_management.py`: Pengendalian PC cabang dari server pusat.
  - `test_branch_relay_csrf_and_logging.py`: Penanganan CSRF token pada request proxy relay.
* **Member, Menu, & Game Management**:
  - `test_member_validation.py` & `test_member_deletion.py`: Validasi saldo, RFID card, dan proteksi hapus member aktif.
  - `test_menu_crud_robustness.py` & `test_menu_archive_and_restore.py`: Operasional katalog kantin dan soft-delete (arsip).
  - `test_game_and_menu_rbac_restock.py`: Pembatasan hak akses kasir vs admin untuk restock FnB.
  - `test_game_maintenance_validation.py`: Penandaan game dalam status maintenance.
* **Keamanan, Audit Log & Sistem**:
  - `test_csrf_protection.py`: Verifikasi perlindungan CSRF pada seluruh endpoint POST/PUT/DELETE.
  - `test_audit_logging_coverage.py`, `test_audit_category_grouping.py`, `test_audit_auth_client_logging.py`, `test_audit_remote_logging.py`, `test_audit_settings_logging.py`, `test_audit_tournament_game_logging.py`: Kelengkapan audit trail log di seluruh modul.
  - `test_e2e_log_clearing.py` & `test_logger_archiving.py`: Pembersihan dan pengarsipan log berkala.
  - `test_emergency_login_auth.py` & `test_admin_identity_and_emergency.py`: Mekanisme login darurat saat koneksi database terganggu.
  - `test_ip_whitelist.py`: Proteksi restriksi IP kasir.
  - `test_google_maps_helper.py` & `test_gmaps_settings_integration.py`: Validasi koordinat dan embed Google Maps.
  - `test_tv_signage_unification.py`: Integritas data endpoint Signage TV display.
  - `test_natural_sorting.py`: Natural sort identifier PC (`PC-1`, `PC-2`, `PC-10`).
  - `test_system_mode_separation.py` & `test_system_routes_validation.py`: Pemisahan mode kasir vs mode public portal.

---

## 📚 10. DOKUMENTASI & SUPERPOWERS SPECS (`docs/`)

Direktori `docs/` menyimpan dokumentasi sistem dan riwayat blueprint implementasi:

* [`docs/DOCUMENTATION.md`](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md): Buku panduan operasional lengkap untuk kasir, teknisi, dan pemilik warnet.
* **`docs/superpowers/plans/` (47 Dokumen Perencanaan)**:
  - Rencana kerja sistematis step-by-step dari setiap fitur yang pernah dikembangkan (contoh: Multi-Branch Nexus, Responsive Grid Denah, Cloudflare Tunnel Service, Smart CCTV Peripheral Checker, Skeleton Loading Alignment).
* **`docs/superpowers/specs/` (26 Dokumen Spesifikasi Desain)**:
  - Spesifikasi teknis arsitektur, skema JSON, mock antarmuka, dan data flow diagram dari modul-modul utama TMBilling.

---

## 📡 11. KATALOG LENGKAP API ENDPOINTS (QUICK REFERENCE)

### 11.1 Kasir — Otentikasi & Sesi Kerja
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `POST` | `/api/v1/kasir/auth/login` | Publik | Login kasir / admin (Body: `username`, `password`) |
| `POST` | `/api/v1/kasir/auth/logout` | Kasir | Logout kasir dan invalidasi session |
| `GET` | `/api/v1/kasir/auth/check` | Publik | Validasi session kasir aktif |

### 11.2 Kasir — Dashboard, Denah & Meja PC
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `GET` | `/api/v1/kasir/dashboard/pc` | Kasir | Data reaktif seluruh PC terkelompok grup + metrik omzet |
| `PUT` | `/api/v1/kasir/pc/<id>/position` | Kasir | Update koordinat denah floor plan (`pos_x`, `pos_y` rentang -1..10000) |
| `POST` | `/api/v1/kasir/pc/wol` | Kasir | Kirim Magic Packet Wake-on-LAN ke PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/lock` | Kasir | Kunci layar PC klien secara remote |
| `POST` | `/api/v1/kasir/pc/<id>/unlock` | Kasir | Buka kunci layar PC klien secara remote |
| `POST` | `/api/v1/kasir/pc/<id>/restart` | Kasir | Restart PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/shutdown` | Kasir | Shutdown PC klien |
| `POST` | `/api/v1/kasir/pc/<id>/afk-lock` | Kasir | Kunci sementara PC klien (Mode AFK) |
| `POST` | `/api/v1/kasir/pc/<id>/afk-unlock` | Kasir | Buka kunci meja AFK |
| `POST` | `/api/v1/kasir/pc/batch-action` | Kasir | Eksekusi massal (Lock, Restart, Shutdown, WOL) |

### 11.3 Kasir — Sesi Billing, Transaksi & Shift
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `POST` | `/api/v1/kasir/sesi/buka` | Kasir+Shift | Buka sesi bermain (Guest, Member, atau Paket) |
| `POST` | `/api/v1/kasir/sesi/tambah` | Kasir+Shift | Tambah durasi bermain pada sesi aktif |
| `POST` | `/api/v1/kasir/sesi/tutup/<id>` | Kasir+Shift | Tutup sesi billing kasir |
| `POST` | `/api/v1/kasir/sesi/pindah` | Kasir+Shift | Pindah PC sesi aktif ke meja lain yang kosong |
| `POST` | `/api/v1/kasir/sesi/refund-guest` | Kasir+Shift | Refund sisa saldo paket guest |
| `GET` | `/api/v1/kasir/sesi/<id>/riwayat-paket` | Kasir | Daftar riwayat paket yang dapat di-refund |
| `GET` | `/api/v1/kasir/transaksi/` | Kasir | Riwayat seluruh transaksi kasir |
| `POST` | `/api/v1/kasir/transaksi/` | Kasir+Shift | Buat transaksi baru (billing atau FnB kantin) |
| `POST` | `/api/v1/kasir/shift/buka` | Kasir | Buka shift kasir (input modal awal) |
| `POST` | `/api/v1/kasir/shift/tutup` | Kasir | Tutup shift kasir (serah terima uang buta) |
| `GET` | `/api/v1/kasir/shift/current` | Kasir | Cek status shift kasir yang sedang aktif |

### 11.4 Kasir — Telemetri Hardware & Remote Management
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `GET` | `/api/v1/kasir/monitor/all` | Kasir | Telemetri hardware & status realtime seluruh PC |
| `GET` | `/api/v1/kasir/monitor/processes/<id>` | Kasir | Daftar snapshot task manager proses berjalan di PC |
| `POST` | `/api/v1/kasir/monitor/processes/<id>/kill` | Kasir | Kirim sinyal taskkill proses berbahaya di klien |
| `POST` | `/api/v1/kasir/monitor/baseline/<id>` | Admin | Daftarkan baseline resmi spesifikasi hardware PC |
| `GET` | `/api/v1/kasir/vnc/<pc_id>` | Kasir | WebSocket RFB Tunnel remote control TightVNC |
| `GET/POST`| `/api/v1/kasir/fileexplorer/*` | Kasir | Web File Explorer (Jelajah disk, download, upload) |
| `GET` | `/api/v1/kasir/server-monitor/stats` | Admin | Statistik beban CPU/RAM/Disk server utama |

### 11.5 Public & Client Agent API Endpoints
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `POST` | `/api/v1/public/auth/login` | Token | Login member dari desktop klien WarnetAgent |
| `POST` | `/api/v1/public/client/sync` | API Key | Heartbeat polling status sesi billing klien (interval 1-3s) |
| `POST` | `/api/v1/public/monitor` | API Key | Ingest snapshot telemetri hardware & daftar proses dari agen |
| `GET` | `/api/v1/public/tv/data` | Publik | Feed data display billboard TV ketersediaan meja PC |
| `GET` | `/api/v1/public/game/list` | Publik | Katalog game yang terpasang di warnet |

---

## ⚠️ 12. ATURAN KRUSIAL, BUG-TRAPS, & CODEBASE GOTCHAS

1. **Rentang Koordinat Floor Plan (Denah)**:
   - Nilai valid koordinat PC (`pos_x` & `pos_y`) adalah **`-1` sampai `10000`**.
   - `(-1, -1)` merepresentasikan status **Belum Dipetakan (Unmapped)**.
   - Jangan pernah mengubah validasi minimum ke `0` karena akan menggagalkan fungsi mengeluarkan PC dari denah visual.
2. **Re-render Dashboard Reaktif**:
   - `Dashboard._render(data, forceFull, previousData)` mendeteksi perubahan `pos_x`, `pos_y`, `grup`, dan `id` dari snapshot `_prevRenderedData`.
   - Hindari penggunaan `location.reload()` atau reload web penuh. Semua pembaruan visual wajib berlangsung *in-place*.
3. **Motherboard Telemetry (2 Komponen Terpisah)**:
   - Nama model fisik motherboard disimpan pada field `motherboard` (model `HardwareMonitor`) dan key `"Motherboard"` di payload serials.
   - Nomor seri unik motherboard disimpan pada key `"MotherboardSerial"` di payload `hardware_baseline` dan `hardware_current_specs`.
   - Di antarmuka UI, keduanya ditampilkan terpisah sebagai **Mobo Model** dan **Mobo Serial**.
4. **Header Multi-Branch**:
   - Request API kasir otomatis menambahkan header `X-Branch-ID` via `api.js` saat kasir mengelola cabang non-lokal. Jangan menghapus atau mengubah header ini pada panggilan `fetch()`.
5. **Kompilasi CSS**:
   - Setiap kali menambahkan class utility Tailwind baru pada file `.html` atau `.js`, jalankan `npm run build:css` untuk memperbarui file minified. Jangan menambahkan file CSS ad-hoc.
6. **Timezone UTC**:
   - Semua penyimpanan ke database SQLite harus menggunakan UTC via `now_utc()`. Format tanggal untuk tampilan UI wajib diproses via `format_display()` di `timezone_utils.py`.
7. **Pencegahan Zombie Process Klien**:
   - Dual watchdog (`MGCTM.exe` dan `mtm.exe`) menggunakan file lock dan polling 1 detik. Jangan menghapus file `stop.token` secara manual jika sedang melakukan debugging.

---

## 📝 13. CHANGELOG & RIWAYAT PENAMBAHAN FITUR

*Catatan: Agen AI dan Pengembang WAJIB menambahkan catatan entri baru di bawah ini setiap kali melakukan perubahan/fitur baru agar memori agen tetap up-to-date.*

### [1.6.3] — 2026-10-04 (Branch: `1.6.3`)
* **Exhaustive Codebase Audit & Master Memory**:
  - Audit menyeluruh 100% file dan folder di seluruh repositori (tanpa terkecuali): Backend Flask (25 models, 15 repositories, 41 services, 31 routes, 8 utils), Frontend (37 modul JS, 26 tab templates, public portal), WarnetAgent klien (Tauri v1.5 Rust, Monitor C#, Dual Watchdog MGCTM/mtm, Uninstaller, Deploy scripts), 18 database migrations, 5 tools developer, dan 81 unit test files (264 specs).
  - Pemuatan aturan wajib tri-fase: **Fase Planning WAJIB Plugin `superpowers`** (`brainstorming`, `writing-plans`, `test-driven-development`), **Fase Eksekusi WAJIB MCP `codebase-memory`** (`index_status`, `check_index_coverage`, `get_architecture`, `search_graph`, `search_code`, `trace_path`, `get_code_snippet`, `index_repository`), dan **Fase Debugging WAJIB `systematic-debugging` + MCP `trace_path`** (The Iron Law: No fix without root cause investigation first).
* **Floor Plan (Denah)**:
  - Perbaikan `MapView._save()` menjadi `async` dengan `await Promise.all()` dan sinkronisasi `Dashboard.load(true)`.
  - Dukungan penyimpanan unmapped PC (`pos_x = -1, pos_y = -1`) ke database backend.
  - Deteksi pergeseran koordinat pada `_hasStructureChanged` di `index.js` untuk re-render seketika tanpa reload browser.
* **Hardware Detail Modal**:
  - Pemisahan komponen Motherboard menjadi 2 entri: **`Mobo Model`** (model/nama) dan **`Mobo Serial`** (nomor seri) pada baseline dan live telemetry.
  - Sinkronisasi key `"Motherboard"` ke dalam dictionary `HardwareSerials` di `HardwareService.process_hardware_metric`.
* **Skeleton Loading Standardization**:
  - Sentralisasi engine [`skeleton.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/skeleton.js) untuk seluruh tab kasir.
  - Pembersihan total seluruh spinner putar lama (`animate-spin`, `fa-spin`) dan placeholder statis pada 17 template Jinja2.
  - Kompilasi ulang [`tailwind.css`](file:///c:/Project%20GIT/TMBilling/app/static/css/tailwind.css) minified.

---
*(Akhir dari Master Memory Dokumen — Simpan berkas ini dan jadikan rujukan utama saat planning dan eksekusi)*

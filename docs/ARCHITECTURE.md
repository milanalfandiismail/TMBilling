# Arsitektur TMBilling

## 3-Layer Architecture (Strict SoC)

Aplikasi memisahkan kode menjadi 3 layer dengan aliran satu arah:

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Routes    │ ──> │  Services    │ ──> │  Repositories  │ ──> DB
│ (Endpoints) │     │ (Business)   │     │   (Queries)    │
└─────────────┘     └──────────────┘     └────────────────┘
       │                    │                     │
   Validasi           commit/rollback         add/delete
   Request            try/except              query only
```

### Layer Rules

| Layer | Boleh | DILARANG |
|-------|-------|----------|
| **Routes** | Parse request, validasi skema, panggil service, return JSON | Query DB, logic bisnis |
| **Services** | Business logic, `db.session.commit()`, `rollback()` | Query langsung (via repo) |
| **Repositories** | `add()`, `delete()`, `filter()`, query SQLAlchemy | `db.session.commit()` |

## Aliran Data End-to-End

### 1. Dashboard Kasir (Real-time)

```
Browser                          Flask Server                    Database
   │                                │                              │
   ├── GET /kasir/api/pc ──────────>│                              │
   │                                ├── cleanup_expired()          │
   │                                ├── cleanup_admin_sessions()   │
   │                                ├── PCService.get_all() ──────>│
   │                                │<───── pc_list ──────────────│
   │                                ├── group by grup             │
   │<─── JSON {by_grup, pc_list} ───│                              │
   │                                │                              │
   ├── renderTabs()                 │                              │
   ├── render() → PC cards          │                              │
   ├── updateStats()                │                              │
   │    └── GET /api/report/        │                              │
   │        laporan-harian ────────>│                              │
   │<─── {total_pendapatan, ...} ───│                              │
```

### 2. Buka Sesi Guest

```
User Click          Frontend              Flask Server              DB
   │                  │                       │                    │
   ├─ BUKA SESI ─────>│                       │                    │
   │                  ├─ BukaModal.open()      │                    │
   │                  │  → Modal dengan        │                    │
   │                  │    pilihan paket       │                    │
   │                  ├─ GET /api/paket/ ──────>│                    │
   │                  │<─── paket_list ────────│                    │
   │                  │                       │                    │
   │  Pilih paket +   │                       │                    │
   │  klik Mulai ────>│                       │                    │
   │                  ├─ POST /api/sesi/       │                    │
   │                  │   buka-guest ─────────>│                    │
   │                  │                       ├─ validate PC       │
   │                  │                       ├─ validate paket    │
   │                  │                       ├─ create Sesi ──────>│
   │                  │                       ├─ create Transaksi ──>│
   │                  │                       ├─ db.session.commit()│
   │                  │<─── {sesi_id, token} ──│                    │
   │                  ├─ Dashboard.load()     │                    │
   │<── Toast + Grid ─│                       │                    │
```

### 3. Client Tauri Polling

```
Tauri Client (PC)       Flask Server            Database
     │                      │                     │
     ├─ POST /client/ ──────>│                     │
     │   identify            ├─ cek IP di DB ─────>│
     │                       │<── PC ditemukan ────│
     │<── {valid: true} ─────│                     │
     │                       │                     │
     │  (setiap 5 detik)     │                     │
     ├─ POST /client/ ──────>│                     │
     │   status              ├─ update last_activity│
     │                       ├─ cek sesi aktif ───>│
     │                       │<── sesi atau null ──│
     │                       │                     │
     │  ┌── jika ada sesi: ──│                     │
     │  │  {status: "aktif", │                     │
     │  │   sisa_waktu: 45}  │                     │
     │  │                    │                     │
     │  └── jika kosong: ────│                     │
     │     {status: "kosong",│                     │
     │      shutdown: 180}   │                     │
     │<── status ────────────│                     │
```

### 4. Plugin System Flow

```
User Click          Frontend (Iframe)     Flask Server
   │                  │                       │
   ├─ BUKA PLUGIN ───>│                       │
   │                  ├─ load iframe src      │
   │                  │  /api/plugin/xyz ────>│
   │                  │                       ├─ plugin_bp
   │                  │<── HTML UI/API ───────│
   │<── Render UI ────│                       │
```

## Frontend Architecture

```
index.html (SPA)
├── core/
│   ├── api.js        — HTTP client (CSRF auto, credentials include)
│   ├── utils.js      — formatRupiah, formatMenit
│   ├── toast.js      — Notifikasi (success/error)
│   └── modal.js      — Dynamic modal, confirm dialog
├── components/
│   ├── modal-buka.js   — Buka sesi guest
│   └── modal-tambah.js — Tambah durasi sesi
├── modules/
│   ├── dashboard.js  — Grid PC real-time
│   ├── member.js     — CRUD member
│   ├── paket.js      — CRUD paket
│   ├── pc.js         — CRUD PC + batch
│   ├── grup.js       — CRUD grup
│   ├── laporan.js    — Laporan harian
│   ├── log.js        — System logs
│   ├── struk.js      — Riwayat + cetak struk
│   ├── monitor.js    — Hardware monitor table
│   ├── blackout.js   — Blackout recovery
│   ├── user.js       — CRUD staff
│   ├── settings.js   — Auto-shutdown, backup, timezone, scheduler
│   └── plugins.js    — Plugin Manager settings
└── app.js            — Router, auth check, init, plugin iframe injector
```

### Pola Module

Setiap module JS mengikuti pola yang sama:

```javascript
const Module = {
    async load()     — panggil API, render data
    render(data)     — generate HTML, set innerHTML
    add() / edit()   — CRUD operations
    delete(id)       — confirm → API call → reload
}
```

Komunikasi API melalui `window.API` yang handle CSRF, credential, dan error secara otomatis.

## Client Tauri & Agent Flow

```
┌──────────────┐    POST /client/identify    ┌──────────────┐
│ Tauri Client │ ──────────────────────────>  │ Flask Server │
│ (PC Warnet)  │                              │              │
│              │ <── {valid, pc_kode, grup} ──│              │
│              │                              │              │
│   Setiap 5s  │    POST /client/status       │              │
│   (Polling)  │ ──────────────────────────>  │              │
│              │                              │   cek sesi   │
│              │ <── {status, sisa_waktu} ────│              │
│              │                              │              │
│   jika sisa  │    POST /client/selesai      │              │
│   = 0: auto  │ ──────────────────────────>  │              │
│   shutdown   │                              │  tutup sesi  │
└──────────────┘                              └──────────────┘

Client & Agent Components:
├── WarnetClient/TMBillingTauri/   — Main lockscreen & timer UI (Tauri + Rust + HTML/JS/CSS)
│   ├── Low-Level Keyboard Hook (`WH_KEYBOARD_LL`): Disuntikkan via Windows Hook API dalam thread Rust terpisah untuk menghadang total Alt+Tab, Alt+F4, tombol Windows, dan kombinasi Ctrl+Shift+Esc secara low-level. Hook dilepas secara instan saat Admin masuk.
│   ├── 🔊 Asynchronous Audio Warning Alert: Sistem alarm 5 menit hemat resource. Memutar `warning_5min.mp3` secara asinkron di latar belakang menggunakan HTML5 Audio API sehingga 100% aman tanpa memicu unfocus mouse/keyboard game fullscreen pemain.
│   └── 🔑 Automatic Hex-XOR De-Obfuscation: Backend Tauri (`api.rs`) mendeteksi dan secara otomatis men-deobfuscate `ApiKey` ter-scramble dari `config.ini` menggunakan sandi internal `TMBillingSecretKey2026SecureObfuscation` sebelum mengirimkannya ke server Flask.
├── WarnetAgent/TMBilling_Monitor/ — Telemetry helper (Rust) (Proyek C# lama di WarnetClient/TMMonitor/ telah didepresiasi)
│   ├── Mengirim data metrik sistem (CPU, GPU, RAM, Suhu) secara asinkron ke server setiap 60 detik.
│   └── Memiliki modul watchdog siluman terpisah yang memantau keaktifan Master Guardian setiap 5 detik.
├── WarnetAgent/MGCTM/             — Core launcher agent (Rust) yang memicu startup otomatis seluruh komponen client.
│   └── Mengamankan registry & `config.ini` lokal dengan menyandikan plain-text konfigurasi secara otomatis menggunakan Hex-XOR (Auto-Scrambler) setiap 5 detik sekali.
├── WarnetAgent/mtm/               — Aggressive anti-kill watchdog (Rust) yang berjalan dari `%APPDATA%\Microsoft\Protect\`, bertugas membangkitkan kembali launcher secara paksa jika proses dimatikan secara tidak wajar.
└── WarnetAgent/TMBilling_Uninstaller/ — Offline Fallback Uninstaller (Rust)
    └── Membaca dan men-deobfuscate cached `EmergencyToken` dari Registry secara aman untuk otentikasi kata sandi darurat luring tanpa memerlukan koneksi internet.

```

## Database Migrations

Menggunakan **Flask-Migrate** (Alembic) di `migrations/`:

```bash
flask db init          # Inisialisasi (sudah dilakukan)
flask db migrate -m "deskripsi"   # Buat migration
flask db upgrade       # Apply migration
```

## Scheduler (Background Tasks)

| Task | Interval | Fungsi |
|------|----------|--------|
| Cleanup expired | 1 menit | Tutup otomatis sesi yang waktunya habis |
| Database backup | 60 menit | Backup database ke folder `backups/` |

## Error Handling Pattern

```python
# Service Layer: try/commit/rollback
def proses(service_method):
    try:
        result = service_method()
        db.session.commit()
        return result
    except Exception as e:
        db.session.rollback()
        raise e

# Route Layer: try/return JSON
@route.endpoint
def api():
    try:
        return jsonify(service.process()), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

## Security

- **IP Whitelist**: Endpoint dashboard kasir `/kasir` dilindungi secara ketat, hanya IP yang terdaftar (atau Bypass Token darurat) yang dapat mengakses.
- **CSRF**: Flask-WTF activated globally, exempt only for Tauri Client & Agent
- **Session**: Cookie-based, signed with SECRET_KEY
- **Role**: `admin` (full access) vs `kasir` (terbatas)
- **Client API & Storage**: Header `X-Client-Key` divalidasi ketat di server Flask. Di sisi klien, seluruh data sensitif (`ApiKey`, `EmergencyUser`, `EmergencyToken`) disimpan ter-obfuscate di Registry (`HKLM\Software\TMBilling`) & `config.ini` menggunakan sandi **Hex-XOR Cipher** (kunci: `TMBillingSecretKey2026SecureObfuscation`) untuk menghindari Regedit Hack & Plaintext Leak. Nilai `EmergencyUser` dan `EmergencyToken` diatur oleh admin **saat instalasi** oleh `install.bat`.
- **Dynamic API Key Rotation**: Administrator kasir dapat mengubah API Key secara real-time dari Dashboard. Perubahan ini secara otomatis disimpan ke berkas `.env` dan dimuat ke memori aktif Flask secara instan tanpa perlu restart server.
- **Watchdog Alignment & Config-First Heuristic**: Seluruh watchdog (`MGCTM.exe`, `TMMonitor.exe`, `mtm.exe`) diselaraskan pada loop **5 detik**. Watchdog menggunakan algoritma cerdas *Config-First*: jika mendeteksi masukan `ApiKey` berupa plain-text baru di file `config.ini` lokal (tindakan override oleh admin), watchdog akan memprioritaskan kunci tersebut dibanding Registry lama yang stale, melakukan enkripsi otomatis, lalu menyinkronkannya kembali ke Registry.
- **Password**: Werkzeug hash (scrypt)

## Key Terminology

| Istilah | Definisi |
|---------|----------|
| **Grup** | Zona/zona PC (reguler, vip, vvip) |
| **Sesi** | Periode penggunaan PC oleh guest/member/admin |
| **Blackout** | Kejadian mati lampu yang memutus sesi |
| **Suspect** | Sesi yang dicurigai terdampak blackout |
| **Resolve** | Proses pemulihan sesi blackout |
| **Nota** | Nomor transaksi (format: TM-YYYYMMDD-NNN) |
| **Emergency User** | Username bypass offline dari Registry (diatur saat instalasi, default `TMBilling`) |
| **Emergency Token** | Password bypass offline & uninstaller fallback (diatur saat instalasi, default `TM123qaz!@#`) |

## Standar Multi-Timezone

- **Penyimpanan:** Semua waktu di-commit ke database dalam format **UTC (Timezone Aware)**.
- **Konversi:** Disajikan di frontend melalui fungsi utilitas `format_display()` berdasarkan default timezone yang dikonfigurasi di Settings (misal `Asia/Makassar`).

---
*Last Updated: 2026-06-20 | TMBilling Core Team*

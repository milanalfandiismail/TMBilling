# Design Specification — Log Category Grouping & Taxonomy Standardization

## 1. Overview & Goal

Sistem audit & activity logging TMBilling saat ini merekam 130 jenis event aksi dari berbagai domain bisnis. Namun, pengelompokan kategori pada runtime (`get_system_logs`) sebelumnya hanya mendeteksi 4 kategori terbatas (`transaksi`, `sesi`, `blackout`, `sistem`) melalui pencocokan substring sederhana.

Tujuan spesifikasi ini adalah:
1. Menstandardisasi **15 Domain Kategori Kanonikal** untuk seluruh 130 event aksi sistem.
2. Menyediakan central taxonomy mapping table `ACTION_TO_CATEGORY_MAP` di layer logger (`app/utils/logger.py`) dan service report (`app/services/report/log_audit_service.py`).
3. Mengintegrasikan field `category` terstruktur langsung ke dalam payload JSON baris log pada saat `write_log` dipanggil, dengan fallback otomatis ke taxonomy map jika tidak disediakan.
4. Menyesuaikan antarmuka UI filter tab di dashboard kasir (`app/templates/kasir/tabs/log.html` & `app/static/js/kasir/modules/log/index.js`) agar mendukung pemfilteran multi-domain dan badge styling yang konsisten.

---

## 2. Canonical Category Taxonomy

| Kategori Kanonikal | Label UI | Deskripsi |
|---|---|---|
| `AUTHENTICATION` | Autentikasi | Login kasir/member/admin, logout, login darurat, status login gagal |
| `USER_ACCOUNT` | Akun & User | Manajemen user operator kasir, akun member pelanggan, grup member |
| `AUTHORIZATION_SECURITY` | Keamanan & Otorisasi | Validasi password admin (elevation), IP Whitelist, session revoke, API Key |
| `PAYMENT_BILLING` | Pembayaran & Billing | Pengaturan metode bayar, QRIS, refund, transaksi billing, transaksi F&B, topup |
| `TRANSACTION` | Transaksi & Keuangan | Penghapusan struk permanen, shift kasir (buka modal & tutup shift) |
| `SESI_BILLING` | Sesi & Rental | Aktivasi rental guest & member, tambah waktu/durasi, pindah PC, tutup sesi |
| `DATA_CATALOG` | Katalog & PC | Master menu kantin, paket billing, inventori PC, registrasi hardware, Wake-on-LAN |
| `MONITOR_REMOTE` | Monitoring & Remote | Remote taskkill, shutdown/reboot client, proxy VNC, telemetry & screenshot client |
| `TOURNAMENT_GAME` | Turnamen & Game | Turnamen esports, update skor/bracket, katalog game launcher PC |
| `CONFIGURATION` | Konfigurasi Sistem | Setting auto-shutdown PC client, timezone, Cloudflare tunnel, public URL |
| `API_INTEGRATION` | Integrasi Eksternal | MikroTik RouterOS sync, konfigurasi API integration |
| `BACKGROUND_JOB` | Background Scheduler | Scheduler backup berkala, scheduler log cleanup, auto-screenshot cron |
| `MAINTENANCE` | Pemeliharaan Sistem | Pembersihan log (archive), reset riwayat transaksi, vacuum DB, backup cloud |
| `SYSTEM` | Sistem & Insiden | Blackout (deteksi & resolusi mati lampu), akses dashboard, upgrade aplikasi |
| `ERROR_FAILURE` | Error & Kegagalan | Database error, failure handler, service sync crash, uptime exception |

---

## 3. Architecture & Data Flow

### A. Logging Module (`app/utils/logger.py`)
- Mendefinisikan konstanta kamus `ACTION_TO_CATEGORY_MAP: dict[str, str]` yang memetakan seluruh 130 nama aksi (misal `"PAYMENT_METHOD_CONFIG": "PAYMENT_BILLING"`).
- Fungsi `write_log(aksi, detail, user="kasir", detail_json=None, category=None)`:
  - Jika parameter `category` tidak disertakan, otomatis mencari dari `ACTION_TO_CATEGORY_MAP.get(aksi.upper(), "SYSTEM")`.
  - Menyimpan field `"category": resolved_category` ke dalam dictionary `log_entry` sebelum di-dump ke format JSON Lines di `logs/warnet.log`.

### B. Service Layer (`app/services/report/log_audit_service.py`)
- `LogAuditService.get_system_logs(limit, filter_text, kategori)`:
  - Membaca baris log JSON.
  - Mengambil field `data.get("category")` jika ada, atau me-resolve lewat `ACTION_TO_CATEGORY_MAP` jika membaca log lama/legacy.
  - Memfilter parameter `kategori` secara case-insensitive (membandingkan `kategori.upper()` dengan `category.upper()`).

### C. Frontend UI (`app/templates/kasir/tabs/log.html` & `app/static/js/kasir/modules/log/index.js`)
- Tab kategori di `log.html` diperkaya dengan kategori domain utama.
- `LogFormatter` di `index.js` mengalokasikan styling badge yang elegan untuk setiap kategori domain.

---

## 4. Testing & Verification

- `tests/test_audit_category_grouping.py`:
  - Menguji `ACTION_TO_CATEGORY_MAP` memetakan seluruh 130 event aksi yang terdaftar tanpa ada yang `unknown`.
  - Menguji `write_log` menuliskan field `category` yang tepat ke file log.
  - Menguji `LogAuditService.get_system_logs` memfilter dengan benar berdasarkan kategori kanonikal.

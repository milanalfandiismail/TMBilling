# Desain Arsitektur Multi-Cabang Warnet (Central Control Panel) - TMBilling v1.6.0

## 1. Ringkasan Eksekutif
Fitur **Multi-Cabang (Central Control Panel)** memungkinkan pemilik warnet (*Owner*) atau Administrator untuk mengontrol dan memantau banyak cabang warnet (misal: *TM-Esports Samarinda*, *TM-Esports Belida*) dari satu antarmuka Kasir terpadu. 

Setiap cabang warnet tetap menjalankan server TMBilling lokalnya secara independen (agar billing tetap berjalan jika koneksi internet terputus). Pengguna cukup membuka salah satu web kasir cabang (misal `https://tmbilling.milannn.my.id`), lalu memilih cabang lain dari dropdown navbar atas untuk beralih konteks kontrol secara instan tanpa perlu membuka tab baru atau login berulang kali.

---

## 2. Tujuan & Batasan (Goals & Non-Goals)

### Tujuan (Goals)
1. **Otonomi Server Lokal:** Setiap server cabang tetap independen, menjalankan database lokal, socket lokal, serta menangani client Kiosk dan PC agent di jaringan lokalnya sendiri.
2. **Seamless Branch Switcher:** Dropdown pemilih cabang di navbar header kasir (`app/templates/kasir/base.html`) yang memungkinkan Admin berganti cabang secara instan.
3. **Full Operational Control (Opsi A):** Saat beralih ke cabang remote, admin dapat melihat status PC real-time, mengontrol sesi bermain (buka/tutup sesi, tambah waktu, pindah PC), mengirim perintah remote (restart/shutdown), dan mengakses Remote Control VNC ke PC cabang tersebut.
4. **Otentikasi & Keamanan Kuat:** Komunikasi server-to-server diamankan dengan token rahasia per-cabang (`branch_api_key`) berbasis header `Authorization: Bearer <api_key>`.
5. **Auto-Discovery Nama Cabang:** Sistem otomatis mendeteksi nama cabang dari nilai `warnet_title` cabang remote saat pertama kali dihubungkan.
6. **Migrasi Aman & Non-Destruktif:** Skema database lama tidak diubah atau dihapus; tabel baru dibuat otomatis saat startup tanpa mengganggu data yang sudah ada.

### Batasan (Non-Goals)
- Tidak menggabungkan database multi-tenant ke dalam satu cloud database terpusat (server lokal tetap menyimpan datanya masing-masing demi keandalan saat internet lokal mati).
- Kasir shift biasa (role `kasir`) tidak dapat mengakses atau berpindah ke cabang lain; fitur switcher dan konfigurasi cabang dibatasi khusus role `admin`.

---

## 3. Topologi Arsitektur & Alur Data

```
+---------------------------------------------------------------------------------+
| Browser Admin (Kasir Web)                                                      |
| URL Aktif: https://tmbilling.milannn.my.id/kasir                                |
| Navbar Dropdown: [ TM-Esports Belida (Remote) ▼ ]                               |
+---------------------------------------------------------------------------------+
                                      |
                         (1) API Request + Header
                         X-Branch-ID: 2 (Belida)
                                      v
+---------------------------------------------------------------------------------+
| Server Cabang 1 (Samarinda - Server Lokal)                                      |
| - Memeriksa session admin                                                       |
| - Mendeteksi target X-Branch-ID == 2                                            |
| - Mengambil URL & API Key Belida dari tabel `cabang`                            |
| - Backend Reverse-Proxy Relay Service (requests/urllib3)                         |
+---------------------------------------------------------------------------------+
                                      |
                         (2) Server-to-Server Relay
                         URL: https://tm2billing.milannn.my.id/api/v1/kasir/...
                         Header: Authorization: Bearer <api_key_belida>
                                      v
+---------------------------------------------------------------------------------+
| Server Cabang 2 (Belida - Server Remote)                                        |
| - Middleware @login_required memeriksa Bearer Token vs `branch_api_key` lokal    |
| - Otentikasi Valid -> Menjalankan logic service & database lokal Belida         |
| - Mengembalikan respon JSON (Status PC, sesi, omzet)                            |
+---------------------------------------------------------------------------------+
                                      |
                         (3) Data Response Diteruskan
                                      v
+---------------------------------------------------------------------------------+
| Browser Admin: Tampilan Dashboard me-refresh data Cabang Belida secara instan  |
+---------------------------------------------------------------------------------+
```

---

## 4. Desain Database & Skema Data

### A. Tabel Baru: `cabang` (`app/models/branch/branch.py`)
Tabel untuk menyimpan daftar koneksi cabang yang terdaftar pada dashboard ini.

| Nama Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key, Auto Increment |
| `nama` | `VARCHAR(100)` | Nama cabang (diambil dari `warnet_title` target atau kustom) |
| `url` | `VARCHAR(255)` | Base URL cabang (contoh: `https://tm2billing.milannn.my.id`) |
| `api_key` | `VARCHAR(255)` | Kunci otentikasi rahasia cabang target |
| `aktif` | `BOOLEAN` | Default `True` (apakah tampil di dropdown switcher) |
| `urutan` | `INTEGER` | Default `0` (urutan prioritas dropdown) |
| `status_online` | `BOOLEAN` | Default `False` (hasil health check terakhir) |
| `latensi_ms` | `INTEGER` | Nullable, latensi ping dalam milidetik |
| `terakhir_dicek`| `DATETIME` | Timestamp terakhir pengecekan koneksi |
| `dibuat_pada` | `DATETIME` | Default `now_local` |

### B. Konfigurasi Kunci Server Lokal (`branch_api_key`)
* Disimpan di tabel `settings` yang sudah ada dengan key: `'branch_api_key'`.
* Default: Jika belum ada di database saat bootstrap aplikasi, sistem membuat token acak berstandar keamanan tinggi:
  `"tmb_sec_" + secrets.token_hex(24)`.
* Disediakan endpoint untuk melihat dan melakukan regenerasi token (`POST /api/v1/kasir/branch/my-key/regenerate`).

### C. Jaminan Keamanan Migrasi (Self-Healing Bootstrap)
Di dalam `app/__init__.py`, sistem memeriksa eksistensi tabel `cabang`:
```python
from sqlalchemy import inspect
from app.models.branch import Branch

inspector = inspect(db.engine)
if not inspector.has_table('cabang'):
    Branch.__table__.create(db.engine)
```
Tidak ada tabel atau kolom lama yang di-alter, menjamin backward compatibility 100%.

---

## 5. Spesifikasi API & Middleware

### A. Middleware Autentikasi Dual-Mode (`app/middleware/auth.py`)
Memperbarui decorator `login_required` agar mendukung dua metode akses:
1. **Sesi Browser Kasir:** `session.get('user_id')` (Akses lokal pengguna web).
2. **Bearer API Key Lintas Cabang:**
   ```python
   auth_header = request.headers.get("Authorization")
   if auth_header and auth_header.startswith("Bearer "):
       token = auth_header.split(" ", 1)[1].strip()
       local_key = SettingsService.get("branch_api_key")
       if local_key and secrets.compare_digest(token, local_key):
           # Akses sah sebagai Admin Lintas Cabang
           return fn(*args, **kwargs)
   ```
*Menggunakan `secrets.compare_digest` untuk mencegah serangan timing attack.*

### B. Endpoint Manajemen Cabang (`/api/v1/kasir/branch/...`)
* `GET /api/v1/kasir/branch/list`: Mengambil daftar cabang yang terdaftar beserta status online/offline.
* `POST /api/v1/kasir/branch/add`: Menambahkan koneksi cabang baru.
  - Payload: `{ "url": "https://...", "api_key": "..." }`
  - Logic: Otomatis melakukan tes koneksi ke target, mengambil `warnet_title`, dan menyimpan ke DB.
* `PUT /api/v1/kasir/branch/<int:id>`: Mengubah URL, API Key, nama, atau status aktif cabang.
* `DELETE /api/v1/kasir/branch/<int:id>`: Menghapus koneksi cabang.
* `POST /api/v1/kasir/branch/test`: Mengetes koneksi ke URL & API Key tertentu tanpa menyimpannya.
* `GET /api/v1/kasir/branch/my-key`: Mengambil API Key cabang lokal ini (khusus admin).
* `POST /api/v1/kasir/branch/my-key/regenerate`: Membuat ulang API Key cabang lokal ini.

### C. Backend Reverse-Proxy Relay Router
Ketika request API kasir dipanggil dengan header `X-Branch-ID` bernilai ID cabang remote:
* Modul `BranchProxyService` mengarahkan HTTP method, query params, dan request body ke cabang tujuan via `requests.request(...)` dengan timeout 6 detik.
* Header `Authorization: Bearer <remote_api_key>` disematkan otomatis oleh server lokal.
* Jika terjadi timeout atau error jaringan, proxy mengembalikan error terstruktur:
  ```json
  {
    "success": false,
    "is_branch_offline": true,
    "error": "Cabang TM-Esports Belida sedang offline atau tidak dapat dijangkau"
  }
  ```

---

## 6. Desain Antarmuka Pengguna (UI/UX)

### A. Navbar Global Branch Switcher (`app/templates/kasir/base.html`)
* Terletak di bagian header kasir (di sebelah profil admin / jam operasional):
  - Komponen dropdown selektor bergaya dark-cyber:
    `[ 🏢 TM-Esports Samarinda (Lokal) ▼ ]`
  - Pilihan dropdown:
    - 🏢 **TM-Esports Samarinda** *(Cabang Ini / Lokal)*
    - 🌐 **TM-Esports Belida** *(Online - 24ms)*
    - 🌐 **TM-Esports Antasari** *(Offline)*
    - ➕ **Kelola Cabang...** *(Membuka tab/modal Pengaturan Cabang)*
* Saat cabang berganti:
  - Context ID cabang disimpan di state frontend (`AppState.activeBranchId`).
  - Indikator badge di atas dashboard menampilkan: `Sedang Mengelola: [Nama Cabang]`.
  - Semua modul UI (Grid PC, timer, modal detail PC, laporan omzet) otomatis memuat data cabang terpilih.

### B. Menu Pengaturan Multi-Cabang (`app/templates/kasir/tabs/settings.html`)
Ditambahkan tab/panel khusus **"Multi-Cabang & API"**:
1. **Card API Key Cabang Ini:**
   - Field password-mask dengan tombol tampilkan/sembunyikan (*eye icon*).
   - Tombol **Salin Kunci** (*Copy to clipboard*).
   - Tombol **Regenerate Kunci** (dengan konfirmasi modal pencegahan salah klik).
2. **Card Daftar Cabang Terhubung:**
   - Tabel responsif daftar cabang dengan indikator lampu status (*green pulse* = Online, *red pulse* = Offline).
   - Tombol tambah cabang dengan dialog interaktif: sistem otomatis menguji URL dan menampilkan nama warnet hasil auto-detect sebelum disimpan.

---

## 7. Remote Control VNC Lintas Cabang
* Komponen modal detail PC di kasir memanggil endpoint status VNC cabang terpilih melalui proxy relay.
* Ketika koneksi VNC dimulai (`vnc_ready`), remote server mengembalikan WebSocket tunnel URL cabang tersebut (contoh: `wss://tm2billing.milannn.my.id/websockify?token=...`).
* Browser Kasir langsung membuka sesi noVNC ke tunnel cabang tersebut tanpa membebani server lokal sebagai relay video.
* Seluruh fitur v1.5.8 (sapuan 1-jari mouse scroll, scaling presisi, dark theme) berfungsi otomatis.

---

## 8. Rencana Pengujian & Verifikasi (Testing Plan)
1. **Unit & Integration Tests (Pytest):**
   - Tes pembuatan tabel `cabang` saat bootstrap database.
   - Tes middleware `@login_required` memverifikasi token valid vs token salah/kosong.
   - Tes CRUD endpoint manajemen cabang (`/api/v1/kasir/branch/...`).
   - Tes simulasi proxy relay (sukses meneruskan request dan penanganan saat remote server offline).
2. **Manual Verification:**
   - Menghubungkan dua instance TMBilling lokal/tunnel.
   - Menguji pergantian cabang di dropdown navbar.
   - Memastikan buka sesi billing, tutup sesi, dan remote VNC berjalan pada cabang target.
   - Memutus koneksi internet cabang target untuk memastikan fallback pesan offline bekerja tanpa crash.

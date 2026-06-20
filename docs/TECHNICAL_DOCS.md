# Dokumentasi Teknis API

## Autentikasi

Menggunakan **Flask session cookie**. Login via `/api/kasir/login`.

### Session Endpoints

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/kasir/login` | - | Login, set session cookie |
| POST | `/api/kasir/logout` | login | Logout, clear session |
| GET | `/api/kasir/check` | - | Cek session status (`logged_in`) |
| POST | `/api/kasir/admin-check` | - | Validasi kredensial admin (untuk client C# bypass) |

**Login Request:**
```json
{ "username": "admin", "password": "admin" }
```

**Login Response:**
```json
{ "success": true, "user": { "id": 1, "username": "admin", "role": "admin" } }
```

**Check Response:**
```json
{ "logged_in": true, "username": "admin", "role": "admin", "nama_lengkap": "Administrator" }
```

## Session (Sesi Bermain)

Prefix: `/api/sesi` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/buka-guest` | Buka sesi guest |
| POST | `/buka-member` | Buka sesi member (gratis, pakai saldo) |
| POST | `/tutup/{sesi_id}` | Tutup sesi bermain |
| POST | `/pindah-pc/{sesi_id}` | Pindah PC dalam grup yang sama |
| POST | `/tambah-waktu-sesi/{sesi_id}` | Tambah durasi sesi |
| GET | `/sesi/{sesi_id}` | Detail sesi |

**Buka Guest:**
```json
// Request
{ "pc_kode": "PC-01", "paket_id": 1, "nama_guest": "Guest2401" }

// Response
{ "success": true, "sesi_id": 42, "token_sesi": "a1b2...", "sisa_menit": 60 }
```

**Buka Member:**
```json
// Request
{ "pc_kode": "PC-01", "username": "milan" }

// Response
{ "success": true, "sesi_id": 43, "token_sesi": "c3d4...", "waktu_tersimpan": 120 }
```

## Client API (Tauri & C# Helper)

Prefix: `/client` — Auth: `X-Client-Key` header

---

### 🔑 Emergency Local Bypass Credentials & Offline Fallback Uninstaller
Untuk mengatasi situasi darurat di mana server kasir mati total, terputus dari jaringan LAN, atau mengalami crash, aplikasi client Tauri dan uninstaller mendukung kredensial bypass darurat secara lokal:
* **Client Lockscreen Username**: `TMBilling` (diatur saat instalasi)
* **Emergency Token (Uninstaller Password)**: Diatur manual oleh admin **saat instalasi** oleh `install.bat` (default `TM123qaz!@#`). Disimpan di Registry `HKLM\Software\TMBilling` (Hex-XOR) dan `C:\TMBILLING\config.ini`. Bisa diubah kapan saja via Dashboard Kasir (Settings → Emergency Token) yang akan di-sync oleh MGCTM setiap 5 detik.

**Dual Auth Paths:**

| Entitas | Online Path | Offline Path |
|---------|------------|-------------|
| **Admin Login (Client)** | `POST /client/admin-login` → Flask API | Cek Emergency User + Emergency Token dari Registry langsung |
| **Uninstaller** | `GET /api/settings/uninstall-token/client` → dapet Uninstall Token | Deobfuscate EmergencyToken dari Registry |

1. **Tauri Lockscreen Offline Mode**: Jika PC client kehilangan koneksi ke server, login dengan kredensial Emergency (dari Registry, diatur saat install) akan langsung sukses secara instan di memori (offline) tanpa validasi API. Default: `TMBilling` / `TM123qaz!@#`.
2. **Tauri Lockscreen Online Mode**: Jika server sedang aktif dan ada pihak luar mencoba menebak/menggunakan kredensial bypass ini di client, login lokal tetap akan sukses awalnya, tetapi **thread polling client (yang berjalan tiap 5 detik) akan langsung mendeteksi ketiadaan sesi aktif di server Flask** dan otomatis mengunci kembali layar client dalam beberapa detik. Hal ini menjamin keamanan mutlak PC dari upaya bermain gratis!
3. **Offline Fallback Uninstaller**: Uninstaller (`TMBilling_Uninstaller.exe`) menyinkronkan token keamanan darurat (`EmergencyToken`) dari server melalui agen watchdog (`MGCTM.exe`), lalu menyimpannya dalam bentuk terenkripsi **Hex-XOR** di Registry (`HKLM\Software\TMBilling`). Jika uninstaller mendeteksi jaringan terputus (luring), uninstaller akan mendekode nilai `EmergencyToken` dari Registry secara offline, mencocokkannya dengan password darurat yang dimasukkan admin, lalu mengizinkan pencopotan billing secara bersih dan tuntas tanpa membutuhkan koneksi internet!

---

### Endpoints Client

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/identify` | Registrasi PC saat startup |
| POST | `/status` | Polling status (tiap 5 detik) |
| POST | `/selesai` | Logout dari client |
| POST | `/admin-login` | Login admin langsung dari client |
| POST | `/emergency-login` | Login darurat/emergency (bisa online/offline) |
| GET | `/warnet` | Ambil konfigurasi lengkap Kiosk Client (Judul, Aturan, QRIS, & Paket) |

**Status Response (dengan sesi):**

```json
{
    "status": "aktif",
    "sisa_waktu": 45,
    "nama": "Guest2401",
    "grup": "tm",
    "pc_kode": "PC-01",
    "shutdown_timer": 0
}
```

**Status Response (kosong):**
```json
{
    "status": "kosong",
    "pc_kode": "PC-01",
    "shutdown_timer": 180
}
```

## Dashboard

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/` | - | Redirect otomatis ke halaman login kasir `/kasir/login` |
| GET | `/kasir/api/pc` | login | Data PC grouped by grup |
| GET | `/kasir/login` | - | Halaman login |
| GET | `/kasir/` | login | Halaman dashboard utama |

**PC List Response:**
```json
{
    "pc_list": [
        {
            "id": 1, "kode": "PC-01", "grup": "tm",
            "status": "kosong", "online": false,
            "ip_address": "192.168.1.10",
            "sesi_detail": null, "is_admin": false
        }
    ],
    "by_grup": {
        "tm": [ ... ]
    },
    "grup_meta": {
        "tm": { "warna": "#888888" }
    }
}
```

## Member

Prefix: `/api/member` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/member` | List member (search, pagination) |
| POST | `/member` | Tambah member |
| GET | `/member/{id}` | Detail member |
| PUT | `/member/{id}` | Update member |
| DELETE | `/member/{id}` | Hapus member |
| POST | `/tambah-waktu` | Top-up saldo member via paket |
| POST | `/member/refund-paket` | Refund transaksi paket |
| GET | `/member/{id}/paket` | Riwayat pembelian paket |

**Query Parameters (list):**
- `q` — search username/nama
- `grup_id` — filter grup
- `page`, `per_page` — pagination

**Refund Request:**
```json
{ "member_id": 1, "transaksi_id": 5 }
```

## PC Management

Prefix: `/api/pc` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/pc` | List semua PC (grouped by grup) |
| POST | `/pc` | Tambah PC |
| POST | `/pc/batch` | Registrasi massal |
| PUT | `/pc/{id}` | Edit PC |
| DELETE | `/pc/{id}` | Hapus PC |

**Batch Request:**
```json
{
    "prefix": "GAME-",
    "start_num": 1, "end_num": 10,
    "grup": "reguler",
    "ip_start": "192.168.1.10",
    "ip_end": "192.168.1.19"
}
```

## Paket

Prefix: `/api/paket/` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | List paket (filter: `aktif`, `grup`) |
| POST | `/` | Tambah paket |
| PUT | `/{id}` | Edit paket |
| DELETE | `/{id}` | Hapus paket |

## Grup

Prefix: `/api/grup/` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | List grup |
| POST | `/` | Tambah grup |
| DELETE | `/{id}` | Hapus grup |

**Grup Request:**
```json
{ "nama": "vip", "keterangan": "Area VIP", "warna": "#f59e0b" }
```

## Laporan

Prefix: `/api/report` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/laporan` | Laporan detail per tanggal |
| GET | `/laporan-harian` | Ringkasan hari ini |
| GET | `/tanggal` | Daftar tanggal unik |
| GET | `/kasir-list` | Daftar kasir untuk filter |
| GET | `/struk/{id}` | Data struk by ID/no_nota |
| POST | `/struk/by-no` | Cari struk by nomor |
| GET | `/log` | System logs |
| GET | `/log/export` | Download log (.txt) |
| POST | `/log/clear` | Clear logs (admin) |
| POST | `/transaksi/clear` | Clear semua transaksi (admin) |
| DELETE | `/transaksi/{id}` | Hapus 1 transaksi (admin) |
| DELETE | `/transaksi/by-date/{tgl}` | Hapus per tanggal (admin) |
| GET | `/blackout-log` | Log khusus blackout |

**Laporan Response:**
```json
{
    "total_pendapatan": 150000,
    "total_sesi": 12,
    "total_guest": 8, "total_member": 4,
    "sesi_aktif": 3,
    "page": 1, "pages": 2,
    "history_struk": [
        { "id": 1, "no_nota": "TM-20260515-001",
          "nama_pelanggan": "Guest2401", "jumlah": 5000,
          "waktu": "15/05/2026 08:30", "pc_kode": "PC-01" }
    ]
}
```

**Struk Response:**
```json
{
    "no_nota": "TM-20260515-001",
    "tanggal": "15/05/2026 08:30:00",
    "pc_kode": "PC-01",
    "nama_pelanggan": "Guest2401",
    "rincian": [{ "keterangan": "Paket 1 Jam", "durasi": 60, "harga": 5000 }],
    "total_durasi": 60,
    "total_harga": 5000,
    "kasir": "admin"
}
```

## Hardware Monitor

Prefix: `/api/monitor`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/all` | login | Semua data hardware + PC |
| POST | `/` | - | Terima telemetry dari Rust agent (`TMMonitor.exe`) |
| GET | `/processes/{pc_id}` | login | Daftar proses PC |
| POST | `/remote/{pc_id}/{action}` | login | Trigger remote action (`shutdown` atau `restart`) pada PC client |
| POST | `/screenshot/trigger/{pc_id}` | login | Kirim perintah ke antrean client untuk mengambil screenshot layar |
| POST | `/screenshot/upload` | API Key | Endpoint bagi client PC untuk mengunggah tangkapan layar (screenshot) terbaru |

**Telemetry Data (POST):**

```json
{
    "cpu_usage": 45.2,
    "cpu_temp": 72.5,
    "gpu_temp": 68.0,
    "total_ram": "16 GB",
    "cpu_name": "Intel Core i5",
    "gpu_name": "NVIDIA GTX 1650",
    "motherboard": "B360M",
    "nic_speed": "1 Gbps",
    "active_window": "VALORANT"
}
```

## Blackout

Prefix: `/api/blackout` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/deteksi` | Deteksi sesi blackout |
| GET | `/list` | List sesi blackout (filter: `date`) |
| GET | `/dates` | Daftar tanggal ada blackout |
| POST | `/resolve/member/{id}` | Refund member |
| POST | `/resolve/guest/lanjut/{id}` | Guest pindah PC |
| POST | `/resolve/guest/tutup/{id}` | Guest ditutup |
| POST | `/resolve/guest/sama/{id}` | Guest lanjut PC sama |
| POST | `/clear` | Hapus resolved records |
| POST | `/force-all-and-detect` | Force shutdown sesi + detect |

## User Management

Prefix: `/api/user/` — Auth: `@login_required + @admin_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | List staff |
| GET | `/{id}` | Detail staff |
| POST | `/` | Tambah staff |
| PUT | `/{id}` | Edit staff |
| DELETE | `/{id}` | Hapus staff |

## Settings

Prefix: `/api/settings` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/settings` | Semua konfigurasi |
| PUT | `/settings/auto-shutdown` | Update timer shutdown |
| PUT | `/settings/apikey` | Update global `CLIENT_API_KEY` di memori dan berkas `.env` |
| PUT | `/settings/{key}` | Update setting generic |
| POST | `/settings/backup/manual` | Trigger backup manual |
| GET | `/settings/backup/download` | Download database |
| POST | `/settings/qris` | Unggah berkas gambar QRIS baru untuk pembayaran di Kiosk |
| GET | `/settings/uninstall-token/client` | *(Bypass Auth — API Key)* Mengembalikan `uninstall_token` & `emergency_token` untuk sinkronisasi offline klien |
| GET | `/settings/ip-whitelist` | Daftar IPv4 yang masuk dalam daftar putih |
| POST | `/settings/ip-whitelist` | Mendaftarkan alamat IPv4 baru ke daftar putih |
| DELETE | `/settings/ip-whitelist/{ip}` | Menghapus alamat IP dari daftar putih |
| POST | `/settings/ip-whitelist/toggle` | Mengaktifkan atau mematikan fitur perlindungan IP Whitelist |
| POST | `/settings/ip-whitelist/regenerate-token` | Membuat Token Bypass Darurat baru untuk remote access dinamis |
| GET | `/settings/ip-whitelist/status` | Mengembalikan status aktif whitelist dan URL Bypass lengkap |
| GET | `/settings/plugins` | Mengambil daftar plugin ekstensi terdeteksi beserta status aktifnya |
| POST | `/settings/plugins/toggle` | Mengaktifkan (enable) atau mematikan (disable) sebuah modul plugin |
| POST | `/settings/plugins/upload` | Mengunggah file ZIP plugin baru dan mengekstraknya otomatis |
| PUT | `/settings/scheduler` | Memperbarui interval waktu untuk Auto Scheduler (Backup & Cleanup Logs) |
| POST | `/settings/scheduler/restart` | Me-restart backend Flask agar interval Auto Scheduler yang baru diterapkan |

## Cloud Backup

Prefix: `/api/backup` — Auth: `@login_required + @admin_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/trigger` | Memicu manual backup database SQLite (ZIP) dan mengunggahnya ke cloud provider aktif |
| POST | `/test-connection` | Menguji koneksi cloud provider tertentu menggunakan kredensial sementara |
| GET | `/list` | Mengembalikan daftar berkas ZIP backup lokal beserta ukuran dan waktu pembuatan |
| GET | `/download/{filename}` | Mengunduh file backup ZIP lokal tertentu (dilengkapi proteksi directory traversal) |
| DELETE | `/delete/{filename}` | Menghapus file backup ZIP lokal tertentu |

### Contoh Request & Response

**1. Test Connection (POST `/api/backup/test-connection`)**

**Request (JSON - Discord Webhook):**
```json
{
  "provider": "discord",
  "url": "https://discord.com/api/webhooks/1234567890/abcde"
}
```

**Request (JSON - WebDAV / Nextcloud):**
```json
{
  "provider": "webdav",
  "url": "https://nextcloud.example.com/remote.php/dav/files/user/backups/",
  "username": "user",
  "password": "secretpassword"
}
```

**Request (JSON - Google Drive):**
```json
{
  "provider": "gdrive",
  "client_id": "gdrive-client-id",
  "client_secret": "gdrive-client-secret",
  "refresh_token": "gdrive-refresh-token",
  "folder_id": "optional-folder-id"
}
```

**Request (JSON - NAS / Shared Folder):**
```json
{
  "provider": "nas",
  "path": "\\\\192.168.1.100\\Backup"
}
```

**Response (JSON - Berhasil):**
```json
{
  "success": true,
  "message": "Koneksi ke Discord Webhook Berhasil!"
}
```

**2. Memicu Backup Manual (POST `/api/backup/trigger`)**

**Response (JSON - Berhasil):**
```json
{
  "success": true,
  "message": "Backup manual dan upload cloud berhasil diproses!",
  "filename": "warnet_backup_20260616_221500.zip"
}
```

## Kantin / POS Makanan & Minuman (F&B)

Prefix: `/api` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/menu` | Mengambil katalog semua makanan dan minuman |
| POST | `/menu` | Membuat item menu baru beserta upload gambarnya |
| PUT | `/menu/{menu_id}` | Mengupdate item menu beserta upload gambar baru (jika ada) |
| DELETE | `/menu/{menu_id}` | Menghapus (arsip/soft-delete) item menu dari katalog |
| DELETE | `/menu/{menu_id}/permanent` | Menghapus menu secara permanen beserta seluruh transaksi terkait |
| POST | `/menu/checkout` | Memproses transaksi checkout pesanan makanan/minuman |
| GET | `/menu/transaksi` | Mendapatkan riwayat seluruh transaksi penjualan menu |

### Contoh Request & Response

**1. Membuat Menu Baru (POST `/api/menu`)**

Menggunakan request body tipe `multipart/form-data` dengan field:
- `nama`: `Indomie Goreng`
- `harga`: `10000` (atau input terformat titik dari UI)
- `stok`: `50` (atau `-1` untuk Stok Unlimited)
- `gambar`: (berkas gambar opsional)

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "nama": "Indomie Goreng",
    "harga": 10000,
    "stok": 50,
    "gambar_path": "/static/uploads/menu/indomie_goreng_827f31.png",
    "is_active": true
  },
  "message": "Menu 'Indomie Goreng' berhasil dibuat!"
}
```

**2. Memproses Transaksi Belanja (POST `/api/menu/checkout`)**

**Request (JSON):**
```json
{
  "cart_items": [
    { "menu_id": 5, "jumlah": 2 }
  ],
  "pc_kode": "PC-01",
  "tunai": 25000,
  "kembalian": 5000
}
```

**Response (JSON):**
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "no_nota": "FNB-20260616-003",
      "menu_id": 5,
      "menu_nama": "Indomie Goreng",
      "menu_harga": 10000,
      "jumlah": 2,
      "total_harga": 20000,
      "pc_kode": "PC-01",
      "tanggal": "2026-06-16 22:15:00",
      "kasir_id": 1,
      "kasir_nama": "admin",
      "tunai": 25000,
      "kembalian": 5000
    }
  ],
  "message": "Transaksi F&B berhasil diproses!"
}
```

## Shift Handover (Sesi Kerja Kasir)

Prefix: `/api` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/shift/start` | Membuka shift baru untuk kasir yang sedang login |
| GET | `/shift/active` | Memeriksa status shift aktif kasir saat ini |
| GET | `/shift/summary` | Ringkasan pendapatan internal shift aktif (untuk admin preview) |
| POST | `/shift/end` | Menutup shift aktif dengan memasukkan uang fisik (hitung buta / blind count) |
| GET | `/shift/history` | Riwayat shift kasir yang sudah selesai (untuk admin) |

### Contoh Request & Response

**1. Buka Shift Kasir (POST `/api/shift/start`):**

**Request (JSON):**
```json
{ "modal_awal": 50000 }
```

**Response (JSON):**
```json
{
  "success": true,
  "shift": {
    "id": 1,
    "kasir_nama": "kasir1",
    "waktu_mulai": "2026-06-16 08:00:00",
    "waktu_selesai": null,
    "modal_awal": 50000,
    "uang_fisik": 0,
    "selisih": 0,
    "status": "aktif"
  }
}
```

---

## Turnamen Bracket Maker

Prefix: `/api` — Auth: `@login_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/tournament` | Mengambil seluruh daftar turnamen |
| GET | `/tournament/{t_id}` | Mengambil detail lengkap turnamen beserta tim, ronde, match, dan klasemen Swiss |
| POST | `/tournament` | Membuat turnamen baru, mendaftarkan tim, dan menginisialisasi bagan |
| POST | `/tournament/match/{match_id}/skor` | Mengupdate skor pertandingan dan meloloskan pemenang ke babak berikutnya |
| POST | `/tournament/{t_id}/swiss/next` | Membuka ronde Swiss berikutnya dan melakukan matchmaking otomatis |
| POST | `/tournament/stage/{stage_id}/finish` | Menyelesaikan tahap saat ini dan meloloskan tim terpilih ke Playoffs |
| DELETE | `/tournament/{t_id}` | Menghapus turnamen beserta seluruh datanya secara permanen |

### Contoh Request & Response

**1. Membuat Turnamen Baru (POST `/api/tournament`):**

**Request (JSON):**
```json
{
  "nama": "TMBilling Valorant Cup",
  "deskripsi": "Turnamen 5v5 di zona reguler",
  "tipe_jalur": "playoff",
  "teams": ["Tim A", "Tim B", "Tim C", "Tim D"],
  "bo_format": 1
}
```

**Response (JSON):**
```json
{
  "success": true,
  "message": "Turnamen 'TMBilling Valorant Cup' berhasil dibuat",
  "tournament_id": 3
}
```

---

## Owner Analytics

Prefix: `/api/owner` — Auth: `@login_required + @admin_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/analytics-data` | Mengambil agregasi data JSON untuk 7 KPI Owner (Pendapatan, Heatmap, Revenue PC, dll) dalam rentang waktu 7 hari terakhir |

*(Catatan: Halaman dashboard utamanya diakses via `GET /owner/analytics`)*

---

## Portal Web Member & Publik

Auth: Mix (`member_login_required` untuk halaman dashboard)

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/member/login` | None | Halaman login portal member |
| POST | `/member/login` | None | Proses login akun member (username & password) |
| POST | `/member/logout` | Member | Keluar dari session portal member |
| GET | `/member/` | Member | Halaman dashboard dashboard member (sisa waktu, status PC) |
| GET | `/api/public/pc-status` | None | Mengambil peta status PC real-time secara publik |

---

## Database Migration Manager & Update System

Auth: `admin_required`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/settings/migration/status` | Status migrasi (HEAD, Current, history, app_version) |
| POST | `/api/settings/migration/upload` | Upload ZIP update + auto-extract + auto-migrate + restart |

**Status Response:**
```json
{
  "success": true,
  "current": "f2002fac",
  "head": "f2002fac",
  "needs_upgrade": false,
  "app_version": "v1.0",
  "history": [
    { "revision": "f2002fac", "down_revision": "37852408", "description": "add pos_x pos_y to pc", "is_current": true, "is_head": true }
  ]
}
```

**Upload Response:**
```json
{ "success": true, "message": "Update berhasil! Server akan restart..." }
```

---
*TMBilling v1.0 — API Documentation*

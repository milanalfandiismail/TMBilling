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
| POST | `/` | - | Terima telemetry dari C# agent |
| GET | `/processes/{pc_id}` | login | Daftar proses PC |

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
| GET | `/settings/uninstall-token/client` | *(Bypass Auth — API Key)* Mengembalikan `uninstall_token` & `emergency_token` untuk sinkronisasi offline klien |

---
*TMBilling v1.0 — API Documentation*

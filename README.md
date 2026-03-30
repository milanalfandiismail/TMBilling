# Warnet Billing — Flask Server

## Cara Jalankan

```bash
pip install -r requirements.txt
python run.py
```

Server berjalan di `http://localhost:5000`

---

## Autentikasi

### Member (Client C++)
Gunakan JWT Bearer token yang didapat dari `/auth/login`.

```
Authorization: Bearer <token>
```

### Kasir / Operator
Gunakan header khusus (ganti value di `run.py` dan semua routes):

```
X-Kasir-Key: kasir-rahasia-ganti-ini
```

---

## Endpoint

### Auth

| Method | URL | Deskripsi |
|--------|-----|-----------|
| POST | `/auth/login` | Login member dari client C++ |
| GET  | `/auth/me` | Info member yang sedang login (JWT) |
| POST | `/auth/logout` | Logout (token invalidasi di client) |

**Body login:**
```json
{ "username": "budi", "password": "budi123" }
```

---

### Sesi (Client C++ polling)

| Method | URL | Deskripsi |
|--------|-----|-----------|
| POST | `/session/status` | Cek sisa waktu (polling tiap 10 detik) |
| POST | `/session/pindah` | Pindah PC — member saja (JWT) |
| POST | `/session/selesai` | Akhiri sesi |
| POST | `/session/tambah` | Tambah menit ke sesi aktif |

**Body semua endpoint sesi:**
```json
{ "token_sesi": "abc123..." }
```

**Response `/session/status` saat waktu habis:**
```json
{ "status": "lock", "sisa_menit": 0, "pesan": "Waktu habis" }
```

---

### Kasir (Dashboard Operator)

| Method | URL | Deskripsi |
|--------|-----|-----------|
| GET  | `/kasir/pc` | Daftar semua PC + status |
| POST | `/kasir/sesi/guest` | Buka sesi tamu baru |
| POST | `/kasir/sesi/member` | Assign paket ke member di PC |
| POST | `/kasir/sesi/pindah-guest` | Pindah PC untuk tamu |
| POST | `/kasir/member` | Daftarkan member baru |
| GET  | `/kasir/member` | Daftar semua member |
| GET  | `/kasir/laporan/hari-ini` | Laporan pendapatan hari ini |

**Body buka sesi guest:**
```json
{
  "pc_kode": "PC-01",
  "paket_id": 1,
  "nama_guest": "Tamu 1"
}
```

---

### Paket

| Method | URL | Deskripsi |
|--------|-----|-----------|
| GET    | `/paket/` | Daftar paket aktif (public) |
| POST   | `/paket/` | Buat paket baru (kasir) |
| PUT    | `/paket/<id>` | Edit paket (kasir) |
| DELETE | `/paket/<id>` | Nonaktifkan paket (kasir) |

---

## Alur C++ Client

1. **Startup:** Client baca `config.ini` → ambil `server_url` dan `pc_kode`
2. **Idle:** Tampilkan form login member + tombol "Saya Tamu"
3. **Polling:** GET `/session/status` tiap 10 detik dengan `token_sesi`
4. **Waktu habis:** Server balas `"status": "lock"` → client kunci layar
5. **Member pindah PC:** POST `/session/pindah` dengan JWT

## Alur Pindah PC Member

```
1. Member login di PC baru → JWT diterima
2. Client kirim POST /session/pindah { pc_kode: "PC-02" }
3. Server:
   - Hentikan sesi lama di PC-01
   - Kembalikan sisa menit ke saldo member
   - Buat sesi baru di PC-02 pakai saldo
   - Balas token_sesi baru
4. Client PC-02 mulai polling dengan token baru
```

## Struktur Database

- **paket** — template durasi & harga yang dijual
- **member** — akun pelanggan tetap, simpan saldo menit
- **pc** — daftar unit komputer
- **sesi** — satu baris per sesi aktif/selesai
- **transaksi** — log setiap pembelian paket & pembayaran

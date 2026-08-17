# Design Spec: Standardisasi Format Audit Log Seluruh Flow (Source of Truth: Refund)

**Tanggal**: 2026-08-15  
**Status**: Draft / Awaiting Approval  
**Sistem**: TMBilling Audit Logging Pipeline, Services, & Kasir Frontend Formatter  

---

## 1. Ikhtisar & Tujuan

Menstandarisasi seluruh pemanggilan `write_log()` pada seluruh flow operasional dan transaksional di backend agar menyertakan structured payload dictionary (`detail_json`) yang seragam, konsisten, dan rapi mengikuti standar implementasi **Refund** (*source of truth*), serta memperkaya frontend `LogFormatter` dengan header tematik terstruktur untuk setiap kategori event.

---

## 2. Source of Truth: Konvensi Format Refund

Format acuan yang ditetapkan dari event `REFUND_PAKET` dan `TRANSAKSI (REFUND)`:
1. **Atribut `detail`**: String ringkas deskriptif human-readable (misal: `Guest:nama | Durasi: 60m -> 30m`).
2. **Atribut `detail_json`**: Dictionary terstruktur dengan penamaan key berbasis `snake_case`:
   - `no_nota` / `no_nota_refund` / `no_nota_original`: Nomor nota transaksi terkait.
   - Nominal Rupiah: `jumlah_refund`, `total_harga`, `harga`, `modal_awal`, `total_pendapatan`.
   - Durasi Waktu: `durasi_menit`, `saldo_sebelum`, `saldo_sesudah`, `durasi_dikurangi`, `sisa_menit`, `durasi_terpakai`.
   - Identitas Entitas: `username`, `nama_guest`, `pc_kode`, `nama_paket`, `nama_menu`, `nama_grup`, `role`.
   - Metode Pembayaran: `metode_pembayaran` (`Tunai`, `QRIS`, dsb).
3. **Frontend Visual Card**:
   - Card container dengan dark aesthetic (`bg-[#0c0c0c] border rounded max-w-lg`).
   - Header badge tematik ber-ikon dengan teks uppercase tebal.
   - List key-value terformat otomatis (nominal diformat `Rp XX.XXX`, durasi diformat `XX Menit`, string Title Case).
   - Collapsible drawer `⚙️ Lihat Data Mentah (Raw)` opsional.

---

## 3. Spesifikasi Payload per Flow Target

### A. Flow Sesi Billing (`app/services/sesi/sesi_service.py`)
1. **`BUKA_GUEST` & `TRANSAKSI`**:
   - `detail_json`: `{"pc_kode": str, "nama_guest": str, "paket": str, "durasi_menit": int, "harga": int, "no_nota": str, "metode_pembayaran": str}`
2. **`BUKA_MEMBER`**:
   - `detail_json`: `{"pc_kode": str, "username": str, "sisa_menit": int, "grup": str}`
3. **`TAMBAH_WAKTU` (Sesi)**:
   - `detail_json`: `{"pelanggan": str, "tipe": "member"|"guest", "pc_kode": str, "paket": str, "durasi_menit": int, "harga": int, "no_nota": str, "metode_pembayaran": str}`
4. **`TUTUP_SESI`**:
   - `detail_json`: `{"pc_kode": str, "tipe": str, "pelanggan": str, "durasi_terpakai": int, "sisa_menit": int}`
5. **`PINDAH_PC`**:
   - `detail_json`: `{"pc_asal": str, "pc_tujuan": str, "pelanggan": str, "sisa_menit": int}`

### B. Flow Member & Saldo (`app/services/member/member_service.py`)
1. **`TAMBAH_MEMBER`**:
   - `detail_json`: `{"username": str, "nama_lengkap": str, "grup": str, "saldo_menit": int}`
2. **`EDIT_MEMBER`**:
   - `detail_json`: `{"username": str, "nama_lengkap": str, "grup": str, "no_hp": str, "email": str}`
3. **`DELETE_MEMBER`**:
   - `detail_json`: `{"username": str, "nama_lengkap": str, "sisa_saldo_menit": int}`
4. **`TAMBAH_WAKTU` / Topup Member**:
   - `detail_json`: `{"username": str, "paket": str, "durasi_menit": int, "total_harga": int, "saldo_sebelum": int, "saldo_sesudah": int, "no_nota": str, "metode_pembayaran": str}`

### C. Flow Kantin & POS F&B (`app/services/menu/menu_service.py`)
1. **`TRANSAKSI_MENU` / Checkout**:
   - `detail_json`: `{"no_nota": str, "nama_menu": str, "jumlah_qty": int, "total_harga": int, "pc_kode": str|None, "metode_pembayaran": str, "tunai": int|None, "kembalian": int|None}`
2. **`TAMBAH_MENU`**:
   - `detail_json`: `{"nama_menu": str, "harga": int, "stok": int}`
3. **`EDIT_MENU`**:
   - `detail_json`: `{"nama_menu": str, "harga": int, "stok": int}`
4. **`ARSIP_MENU` & `HAPUS_MENU_PERMANEN`**:
   - `detail_json`: `{"nama_menu": str, "transaksi_historis": int}`

### D. Flow Shift Kasir (`app/services/shift/shift_service.py`)
1. **`SHIFT_BUKA`**:
   - `detail_json`: `{"kasir": str, "modal_awal": int, "waktu_buka": str}`
2. **`SHIFT_TUTUP`**:
   - `detail_json`: `{"kasir": str, "modal_awal": int, "pendapatan_billing": int, "pendapatan_kantin": int, "total_pendapatan": int, "total_kas_akhir": int, "waktu_tutup": str}`

### E. Flow Master Paket, PC, & Grup (`paket_service.py`, `pc_service.py`, `grup_service.py`)
1. **`TAMBAH_PAKET`, `HAPUS_PAKET`**:
   - `detail_json`: `{"nama_paket": str, "harga": int, "durasi_menit": int, "grup": str}`
2. **`TAMBAH_PC`, `EDIT_PC`, `HAPUS_PC`**:
   - `detail_json`: `{"kode_pc": str, "nama_pc": str, "ip_address": str, "grup": str}`
3. **`TAMBAH_GRUP`, `EDIT_GRUP`, `HAPUS_GRUP`**:
   - `detail_json`: `{"nama_grup": str, "keterangan": str, "warna": str}`

### F. Flow Auth & User Management (`user_service.py`, `auth_kasir_routes.py`)
1. **`LOGIN`, `LOGOUT`**:
   - `detail_json`: `{"username": str, "role": str, "nama": str}`
2. **`TAMBAH_USER`, `UPDATE_USER`, `HAPUS_USER`**:
   - `detail_json`: `{"username": str, "nama": str, "role": str}`

### G. Flow Perawatan & Maintenance (`maintenance_service.py`)
1. **`BUAT_TIKET`, `UPDATE_STATUS_TIKET`**:
   - `detail_json`: `{"pc_kode": str, "judul": str, "kategori": str, "prioritas": str, "status": str, "biaya": int|None, "reporter": str}`

---

## 4. Penyempurnaan Frontend `LogFormatter` (`log/index.js`)

Menyediakan penataan kartu visual yang terkelompok berdasarkan prefix event:
- 🔄 **Detail Refund** (Merah / Red border)
- 🎮 **Detail Sesi Billing** (Emerald / Green border)
- 👤 **Detail Member** (Purple / Violet border)
- 🍔 **Detail Transaksi Kantin** (Amber / Yellow border)
- 💵 **Detail Shift Kasir** (Emerald / Cyan border)
- 💳 **Detail Paket Billing** (Blue / Sky border)
- 🖥️ **Detail Unit PC & Grup** (Indigo / Slate border)
- 🛠️ **Detail Perawatan PC** (Orange / Rose border)
- 🔑 **Detail User & Keamanan** (Zinc / Neutral border)

---

## 5. Rencana Verifikasi (Testing Plan)

1. **Uji Kompilasi Python**:
   - Menjalankan `python -m py_compile` pada seluruh file service yang dimodifikasi.
2. **Unit Test Python Formatter**:
   - Menjalankan script pengujian data model untuk memastikan seluruh dictionary event terformat dengan benar.
3. **Pemeriksaan Konsistensi Frontend**:
   - Memastikan seluruh log baru tampil rapi dengan format yang identik dengan refund.

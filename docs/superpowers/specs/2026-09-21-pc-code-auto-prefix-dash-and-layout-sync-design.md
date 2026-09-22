# PC Code Auto-Dash Prefix & Form Layout Sync Spec

## 1. Overview
Menyelaraskan pengalaman pengguna (UI/UX) dan format kode PC pada form **Tambah Unit PC (Single)** dan **Tambah Massal (Batch)**:
1. **Batas Panjang Kode PC**: Ditetapkan maksimal **11 karakter** (misal: `MANTAP-1000` = 6 huruf prefix + 1 dash + 4 digit nomor).
2. **Aturan Prefix (Maksimal 6 Karakter) & Auto-Dash**:
   - Jika pengguna memasukkan prefix tanpa tanda `-` (misal `MANTAP`), sistem otomatis menambahkan tanda hubung `-` saat digabung dengan nomor PC (misal nomor `1` $\to$ `MANTAP-1`).
   - Jika pengguna sudah mengetik tanda `-` (misal `MANTAP-`), sistem tidak menambahkan double dash (tetap `MANTAP-1`).
3. **Penyelarasan UI/UX Form Input**:
   - Menyamakan struktur form Single PC dan Batch PC agar konsisten dan modern dengan live preview kode yang akan terbentuk.

## 2. Specification Details

### 2.1 Format Kode PC & Auto-Dash
* **Prefix**:
  - Maksimal 6 karakter (huruf dan angka).
  - Di-strip karakter `-` atau `_` di akhir sebelum penggabungan.
  - Format hasil: `${cleanPrefix}-${nomor}` jika ada nomor.
* **Panjang Total**:
  - Maksimal 11 karakter (contoh: `MANTAP-1000`, `VVIP-2000`, `PC-01`).
* **Karakter Legal**:
  - `^[A-Za-z0-9\-_]+$`.

### 2.2 Penyelarasan Layout UI/UX Modal
1. **Modal Tambah PC (Single)**:
   - Max-width diselaraskan menjadi `max-w-xl`.
   - Grid Row 1 (3 Kolom):
     - **Prefix Nama** (Maks 6, placeholder: `PC` atau `MANTAP`)
     - **Nomor Unit** (Type number, placeholder: `1`)
     - **Grup Unit** (Dropdown)
   - Live Preview Box: `Preview Kode PC: MANTAP-1`
   - Grid Row 2 (2 Kolom):
     - **IP Address** (placeholder: `192.168.1.101`)
     - **MAC Address** (placeholder: `AA:BB:CC:DD:EE:FF` - opsional)
   - Grid Row 3 (1 Kolom):
     - **Nama Unit (Opsional)** (placeholder: Kosongkan untuk mengikuti Kode PC)

2. **Modal Tambah PC Massal (Batch)**:
   - Max-width `max-w-xl`.
   - Grid Row 1 (3 Kolom):
     - **Prefix Nama** (Maks 6, placeholder: `PC` atau `MANTAP`)
     - **No Mulai** (placeholder: `1`)
     - **No Akhir** (placeholder: `10`)
   - Live Preview Box: `Preview Rentang: MANTAP-1 s/d MANTAP-10 (10 Unit)`
   - Grid Row 2 (3 Kolom):
     - **IP Awal** (placeholder: `192.168.1.101`)
     - **IP Akhir** (placeholder: `192.168.1.110`)
     - **Grup Unit** (Dropdown)

3. **Modal Edit PC**:
   - Max-width `max-w-lg`.
   - Kode PC (Maks 11 karakter), Grup Unit, Nama Unit, IP Address, MAC Address.

## 3. Backend Logic (`PCService`)
- Normalisasi kode di `create()`, `update()`, dan `create_batch()`:
  - Bersihkan format `prefix` & `nomor`.
  - Jika `len(kode) > 11` $\to$ raise `ValueError("Kode PC maksimal 11 karakter (contoh: MANTAP-1000)")`.
  - Di `create_batch()`, jika prefix dikirim tanpa dash (misal `MANTAP`), generate kode dengan format `f"{clean_prefix}-{i}"`.

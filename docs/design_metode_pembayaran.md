# Dokumen Desain: Integrasi Metode Pembayaran (Payment Method)

Dokumen ini mendokumentasikan hasil diskusi perancangan fitur penambahan metode pembayaran dinamis untuk seluruh pos keuangan/transaksi pada aplikasi TMBilling.

## 1. Ringkasan Pemahaman

*   **Tujuan**: Membantu owner warnet memisahkan dan memantau pendapatan riil kasir berdasarkan tipe cara pembayaran (Tunai vs. QRIS/Transfer) untuk mencegah kecurangan (*fraud*) dan merapikan audit keuangan tutup shift.
*   **Target Pengguna**: Kasir (operator lapangan) dan Owner (pemilik warnet).
*   **Cakupan Sistem**:
    *   Sesi Guest (buka sesi baru dengan paket).
    *   Tambah Waktu Sesi Aktif (membeli paket tambahan saat sedang bermain).
    *   Tambah Saldo/Waktu Member (pembelian paket prabayar member untuk disimpan).
    *   Transaksi Kantin / F&B (checkout pesanan makanan/minuman).
    *   Filter dan Rekap Laporan Keuangan (Laporan Transaksi, Laporan Menu, dan Tutup Shift).

## 2. Asumsi-Asumsi Utama

1.  **Sesi Prabayar Member**: Sesi member yang dibuka murni memotong saldo waktu tersimpan (`waktu_tersimpan`) tidak mencatat metode pembayaran baru (kolom `metode_pembayaran` bernilai `NULL` di database) karena uang riil sudah dicatat saat pembelian paket/tambah saldo sebelumnya.
2.  **Default Pilihan**: Pilihan default di UI kasir saat melayani transaksi baru adalah `"Tunai"`.
3.  **Audit Void/Refund**: Transaksi pembatalan (Void) atau pengembalian dana (Refund) akan mencatat metode pembayaran yang sesuai dengan transaksi aslinya.

## 3. Log Keputusan (Decision Log)

| Keputusan Desain | Alternatif yang Dipertimbangkan | Alasan Memilih Opsi Ini |
|---|---|---|
| **Struktur Database**: Kolom String `metode_pembayaran` di tabel `Transaksi` & `TransaksiMenu`. | Membuat tabel relasional baru `MetodePembayaran`. | Jauh lebih sederhana, performa cepat, meminimalkan kompleksitas migrasi (prinsip YAGNI), dan tetap fleksibel. |
| **Daftar Pilihan**: Disimpan sebagai string terpisah koma pada tabel `Settings` (Key: `payment_methods`, default: `"Tunai,QRIS,Transfer Bank"`). | Hardcoded di kode program frontend/backend. | Owner warnet dapat secara dinamis menambah atau mengubah nama metode pembayaran baru dari halaman pengaturan tanpa perlu menyentuh kode. |
| **Auto-Lock Cashless**: Mematikan input tunai & set kembalian ke 0 saat memilih metode selain "Tunai" / "Cash". | Input manual atau format pengaturan tipe pembayaran `:cashless`. | Deteksi cerdas berbasis string ("Tunai" / "Cash") memberi kemudahan operasional tanpa konfigurasi tambahan bagi Owner. |
| **Pencatatan Sesi Member**: Sesi bermain memotong saldo tercatat `NULL` di kolom pembayaran. | Dicatat otomatis dengan string `"Deposit / Saldo"`. | Menghindari perhitungan ganda (*double-counting*) kas masuk pada pelaporan keuangan harian Owner. |

## 4. Desain Teknis & Alur Data

### A. Skema Database (Database Schema)
*   **`Transaksi` (`app/models/transaksi/transaksi.py`)**:
    ```python
    metode_pembayaran = db.Column(db.String(50), nullable=True)
    ```
*   **`TransaksiMenu` (`app/models/menu/menu.py`)**:
    ```python
    metode_pembayaran = db.Column(db.String(50), nullable=True)
    ```
*   **Migrasi**: Alembic script akan menyuntikkan kolom ini dan memperbarui seluruh baris transaksi lawas bernilai `"Tunai"`.

### B. Alur Logika Auto-Lock di UI Kantin
```
Pilih Metode Pembayaran
       │
       ├─► Jika == "Tunai" / "Cash" (Case-Insensitive)
       │     └─► Aktifkan input "Uang Tunai"
       │     └─► Hitung kembalian secara dinamis
       │
       └─► Jika METODE LAIN (QRIS, OVO, dll.)
             └─► Kunci input "Uang Tunai" (Readonly)
             └─► Set nilai "Uang Tunai" = Total Belanjaan
             └─► Set "Kembalian" = Rp0
```

### C. Alur Filter Laporan
Setiap permintaan riwayat laporan ke API (`/api/v1/kasir/report/*`) akan menyertakan parameter `metode_pembayaran`. Di backend, query database akan menyaring data:
```python
if metode_pembayaran:
    query = query.filter(Transaksi.metode_pembayaran == metode_pembayaran)
```
Di halaman rekapitulasi shift, total nominal tunai dan cashless akan dikelompokkan secara terpisah untuk memudahkan pencocokan uang fisik di laci kasir.

---
*TMBilling v1.4.4*

# 🌍 Multi-Timezone Support

TMBilling menggunakan arsitektur multi-timezone untuk memastikan konsistensi waktu di seluruh sistem, terlepas dari lokasi fisik server atau klien (misal: WIB, WITA, atau WIT).

## Konsep Dasar

1. **Penyimpanan Database (UTC Base):**
   Semua data timestamp (waktu sesi, transaksi, dll) disimpan dalam format **UTC (aware datetime)** di dalam database. Ini mencegah terjadinya kerancuan waktu saat melakukan kalkulasi durasi.

2. **Konfigurasi Tersentralisasi:**
   Admin dapat mengatur *default timezone* aplikasi dari halaman **Dashboard Kasir > Settings**. Pengaturan ini akan disimpan di tabel `settings` dan digunakan oleh seluruh layanan aplikasi.

3. **Presentasi Waktu (Display):**
   Ketika data timestamp akan ditampilkan ke pengguna (baik di Dashboard Kasir, Cetak Struk, Riwayat Member, dll), backend akan otomatis mengonversi format UTC tersebut menjadi waktu lokal sesuai dengan zona waktu yang telah dikonfigurasi.

## Implementasi Kode

- **Konversi Waktu (`app/utils/timezone_utils.py`):**
  Modul ini menangani konversi bolak-balik antara UTC dan Local Timezone. Fungsi utamanya adalah `format_display()`, yang mengonversi objek UTC menjadi format string waktu yang mudah dibaca berdasarkan pengaturan zona waktu aktif.
- **Model Dasar (`app/models/base/base.py`):**
  Fungsi utilitas utama yang menghasilkan waktu saat ini sekarang menggunakan format UTC standar (`datetime.now(timezone.utc)`).
- **Pengiriman Data ke Frontend:**
  Semua model (seperti `Member`, `Sesi`, `Laporan`) mengimplementasikan metode `to_dict()` yang memanggil utilitas format waktu di atas. Sehingga antarmuka kasir (JS/HTML) selalu menerima data waktu yang sudah siap ditampilkan tanpa perlu melakukan konversi di sisi klien.

## Migrasi dari Versi Terdahulu
Untuk sistem lama yang sebelumnya menggunakan asumsi waktu lokal (WIB), skrip migrasi `seed.py` telah diperbarui untuk mengonversi data waktu dari format *naive* menjadi *UTC-aware* saat TMBilling di-upgrade.

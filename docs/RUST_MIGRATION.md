# Backend Rust: Arsitektur, Upgrade, dan Rollback (2.0.3)
Dokumen ini mencatat keputusan arsitektur biner `tmbilling-server` dan prosedur upgrade dari rilis lama ke 2.0.x.

## Keputusan arsitektur
- Satu biner Windows x86_64 `tmbilling-server.exe` berisi HTTP server, scheduler, tray, dan aset frontend yang di-embed dari `app/static` + `app/templates`.
- Big-bang: seluruh domain dilayani satu proses, tanpa layanan pendamping.
- Whitelist IP hanya berlaku untuk `/kasir/` dan `/api/v1/kasir/`; endpoint klien dan publik memakai aturan sendiri.
- Skema database adalah satu head kanonik (`app-rust/migrations/0001_schema_head.sql`) dengan migrasi aditif + snapshot otomatis sebelum menyentuh database lama.
- Autostart lewat entri registry login; integritas rilis memakai `SHA256SUMS.txt` (biner belum ditandatangani Authenticode).

## Perbedaan yang disadari saat upgrade
- Format cookie sesi baru: semua kasir dan member login sekali setelah upgrade.
- Relay RFB WebSocket berjalan di dalam biner; TightVNC tetap proses eksternal per PC.
- Backup cloud (Discord/WebDAV/Google Drive/NAS) memakai `ureq` (rustls) di dalam biner, termasuk tes koneksi HTTP sungguhan.
- PDF laporan memakai tata letak A4 generik; struk thermal tetap memakai payload JSON yang sama.
- Portal member memakai cookie `tm_member` (HMAC) dan endpoint `/api/v1/public/auth/*`.
- Waktu database disimpan UTC; tampilan mengikuti zona waktu pada pengaturan (default `Asia/Makassar`).

## Prosedur upgrade
1. Hentikan `tmbilling-server.exe` dan pastikan port 7015 bebas.
2. Salin `instance/warnet.db` (beserta `-wal`/`-shm` bila ada) ke `backups/`.
3. Ekstrak `TMBilling_Server_v2.0.3.zip` ke root direktori server, atau jalankan `app-rust/packaging/update.bat`.
4. Jalankan `tmbilling-server.exe`; migrasi aditif berjalan otomatis dan snapshot dibuat lebih dulu.
5. Buka `http://localhost:7015/api/health`, login kasir, lalu uji satu sesi billing dan satu transaksi POS.
6. Pembaruan berikutnya memakai tombol Migrasi & Update di dashboard atau `update.bat` dengan ZIP rilis.

## Verifikasi
- `cargo test -j 2 -- --test-threads=2` — seluruh suite contract dan unit harus passed.
- `cargo build --release` — artefak `app-rust/target/release/tmbilling-server.exe`.
- Cek `version` di `/api/health` sama dengan `app-rust/Cargo.toml`.
- Smoke manual: login, buka sesi, tambah waktu, tutup sesi, transaksi POS, dan cetak struk.

## Rollback
1. Hentikan `tmbilling-server.exe`.
2. Kembalikan `backups/manual_pre_update.db` (atau snapshot otomatis) menjadi `instance/warnet.db`.
3. Ekstrak ulang ZIP versi sebelumnya ke root direktori server.
4. Jalankan `tmbilling-server.exe` dan verifikasi `/api/health` serta satu transaksi uji.

# Migrasi ke Backend Rust (2.0.0)

Dokumen ini mencatat keputusan, keadaan, dan prosedur cutover dari backend Python 1.6.5 ke biner
Rust `tmbilling-server` 2.0.0.

## Keputusan operator

- Big-bang (semua domain sekaligus), bukan strangler.
- Frontend tidak diubah; aset `app/static` + `app/templates` di-embed ke biner.
- Whitelist IP tetap berlaku untuk `/kasir/` dan `/api/v1/kasir/`.
- 26 revisi Alembic diganti satu skema head kanonik (`app-rust/migrations/0001_schema_head.sql`)
  plus sinkronisasi aditif + snapshot otomatis sebelum menyentuh DB lama.
- Tray + autostart login; Python 1.6.5 dibekukan sebagai acuan; ZIP rilis 2.0.0 tanpa Authenticode
  (integritas lewat `SHA256SUMS.txt`).

## Perbedaan yang disadari

- Format cookie sesi tidak kompatibel dengan Flask: semua kasir/member login sekali setelah cutover.
- `websockify` diganti proxy WebSocket RFB di dalam biner (TightVNC tetap eksternal per PC).
- Backup cloud (Discord/WebDAV/Google Drive/NAS) baru memverifikasi keterjangkauan host; unggah
  arsip ke provider belum diport.
- PDF laporan memakai tata letak A4 generik (bukan golden 58/80 mm); struk thermal tetap memakai
  payload JSON yang sama.
- Portal member (`/member/*`) memakai cookie `tm_member` (HMAC) dan endpoint
  `/api/v1/public/auth/*`.

## Cutover manual (sekali)

1. Stop server Python (`stop.bat`), salin `instance/warnet.db` (+`-wal`) ke `backups/`.
2. Ekstrak `TMBilling_Server_v2.0.0.zip` ke root direktori server.
3. Jalankan `tmbilling-server.exe`; cek `http://localhost:7015/api/health`.
4. Login kasir, buka dashboard, lakukan satu transaksi uji.
5. Setelah ini pembaruan berikutnya memakai `update.bat` / tombol pembaruan dashboard.

## Verifikasi

- `cargo test -j 2 -- --test-threads=2` (semua suite kontrak hijau).
- `.venv\Scripts\python.exe scripts\rust_parity.py` → `Hanya di Python : 0`.
- `tests/test_version_consistency.py` (versi rilis dari `app-rust/Cargo.toml`, Python tetap 1.6.5).

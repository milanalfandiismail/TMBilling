# TMBilling: Peta Repo (ringkas)

Sistem Manajemen Billing Warnet & Game Center. Backend aktif: biner Rust `app-rust/` (axum + sqlx + SQLite WAL). Frontend Modular ES6 ada di `app-rust/app/static/` dan `app-rust/app/templates/` (di-embed ke biner). Klien PC (GPUI, Rust) ada di `WarnetAgent/TMBilling/`; klien Tauri 1.6.5 beserta watchdog MGCTM/mtm diarsipkan di `archive-1.6.5/WarnetAgent/`. Server Python 1.6.5 dibekukan di `archive-1.6.5/` (referensi migrasi, bukan runtime).

Dokumen acuan lengkap (WAJIB dibaca sebelum menyentuh kode):

- `app-rust/AGENTS.md` — peta modul backend, endpoint, service, model, aturan uang/sesi, perintah cepat, standar test.
- `app-rust/DOCUMENTATION.md` — dokumentasi teknis lengkap (arsitektur, 245 route, 24 tabel, frontend, klien, operasional).
- `app-rust/README.md` — build, menjalankan server, rilis, troubleshooting.
- `docs/RUST_MIGRATION.md` — arsitektur, prosedur upgrade, dan rollback.

## Aturan kerja

- Semua perintah shell lewat `rtk` di WSL: `wsl -- sh -c 'exec "$HOME/.local/bin/rtk" grep ...'`. Tanpa `grep`/`rg` native.
- Baca/tulis berkas besar lewat context-mode (`ctx_execute`), bukan tool native.
- Pekerjaan lokal wajib memakai semua core CPU bila alatnya mendukung; pekerjaan yang berbagi state tetap serial.
- Bahasa respons: Bahasa Indonesia, lugas dan teknis.
- Jangan `git commit` atau `git push` tanpa perintah eksplisit dari operator.
- Setiap modul, endpoint, atau folder baru wajib memperbarui peta di `app-rust/AGENTS.md`.

# TMBilling: Peta Repo (ringkas)

Sistem Manajemen Billing Warnet & Game Center. Backend aktif: biner Rust `app-rust/` (axum + sqlx + SQLite WAL). Frontend Modular ES6 ada di `app-rust/app/static/` dan `app-rust/app/templates/` (di-embed ke biner). Klien PC (GPUI, Rust) ada di `WarnetAgent/TMBilling/`; klien TV Rental PS (Kotlin + Jetpack Compose) ada di `WarnetAgent/TMBillingAndroidTV/`; klien Tauri 1.6.5 diarsipkan di `archive-1.6.5/WarnetAgent/TMBillingTauri/`; watchdog MGCTM/mtm tetap di `WarnetAgent/` (belum diintegrasikan ke klien GPUI). Server Python 1.6.5 dibekukan di `archive-1.6.5/` (referensi migrasi, bukan runtime).

Dokumen acuan lengkap (WAJIB dibaca sebelum menyentuh kode):

- `app-rust/AGENTS.md` — peta modul backend, endpoint, service, model, aturan uang/sesi, perintah cepat, standar test.
- `app-rust/DOCUMENTATION.md` — dokumentasi teknis lengkap (arsitektur, 248 route, 24 tabel, frontend, klien, operasional).
- `app-rust/README.md` — build, menjalankan server, rilis, troubleshooting.
- `docs/RUST_MIGRATION.md` — arsitektur, prosedur upgrade, dan rollback.

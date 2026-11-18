# app-rust — Backend Rust TMBilling 2.0.3

Biner tunggal `tmbilling-server.exe`: backend produksi TMBilling sejak 2.0.0.
Versi aktif dibaca dari `app-rust/Cargo.toml` (saat ini `2.0.3`) dan menjadi satu-satunya sumber versi backend.

## Status & Hubungan dengan Jalur Python

- Jalur Rust adalah backend aktif: seluruh endpoint, aturan uang/sesi, CSRF, whitelist, dan bentuk JSON mengikuti perilaku Python 1.6.5 secara 1:1.
- `app/`, `run.py`, dan `install_scripts/*.py` dibekukan di 1.6.5: hanya hotfix darurat, tanpa fitur baru.
- `app/config.py` tetap memuat `VERSION = "1.6.5"` sebagai acuan; jangan dipakai untuk menyebut versi rilis.
- Frontend tidak berubah: `app/static/` dan `app/templates/` di-embed ke dalam biner saat build.

## Prasyarat

- Windows x86_64.
- Rust stable toolchain MSVC + Visual Studio Build Tools (menyediakan `link.exe`).
- Python 3.11+ hanya untuk parity gate (`scripts/rust_parity.py`) dan `build_release.py`.

## Build & Test

```bat
cd app-rust
cargo build --release
```

Hasil: `app-rust\target\release\tmbilling-server.exe`.

```bat
cargo test -j 2 -- --test-threads=2
```

Suite: 12 target kontrak di `tests/contract/` dan 6 target unit di `tests/unit/`.

Parity gate (wajib `Hanya di Python : 0` sebelum rilis):

```bat
.venv\Scripts\python.exe scripts\rust_parity.py
```

Skrip itu membandingkan `app.url_map` (Flask) dengan router Rust; selisih alias yang disengaja dilaporkan terpisah.

## Menjalankan Server

```bat
tmbilling-server.exe
```

- Mendengarkan `0.0.0.0:7015`.
- Jalan pertama membuat `.env` (dengan `SECRET_KEY` acak), `instance/`, dan akun admin acak yang dicetak ke `initial_admin.txt` di root aplikasi.
- `--init` menyiapkan instance tanpa langsung melayani request.
- `--apply-update <zip> <dir>` hanya menukar berkas dari paket pembaruan (dipakai `update.bat`).
- Tray icon berjalan di proses yang sama; satu instance dijaga `instance/server.lock`.

## Peta Modul

| Path | Isi |
|---|---|
| `src/main.rs` | Entry point, mode CLI, bootstrap, bind port, scheduler + tray. |
| `src/app.rs` | Router axum: 245 registrasi `.route(`, guard CSRF/whitelist, aset statis. |
| `src/state.rs` | `AppState`: pool sqlx, cache in-memory, antrean perintah, `write()` (gerbang tulis tunggal). |
| `src/routes/` | 27 domain, 63 file: handler HTTP tipis. |
| `src/services/` | 27 domain, 62 file: seluruh aturan bisnis. |
| `src/repositories/` | 18 file: query SQL/ORM. |
| `src/models/` | 15 file model + `to_json()`. |
| `src/middleware/` | `auth` (sesi + guard), `csrf`, `whitelist` (IP). |
| `src/cache/` | 7 store in-memory: online, pc_network, settings, telemetry, uptime, command, mismatch. |
| `src/db/` | `open`, `migrate::ensure_schema`, `write_lock`. |
| `src/utils/` | `time`, `logger`, `http`, `validators`, `idempotency`, `instance`, `constants`, `helpers`. |
| `src/scheduler.rs` | Tick 60 detik: flush uptime, deteksi blackout, cleanup sesi, reap VNC, backup harian, prune uptime 366 hari. |
| `src/templates.rs`, `src/assets.rs` | Minijinja + rust-embed; `cache_version()` menghitung hash aset untuk `?v=`. |
| `src/tray.rs`, `src/update.rs` | Tray Windows dan penukaran berkas pembaruan. |
| `migrations/0001_schema_head.sql` | Skema head 24 tabel + `0001_schema.json` untuk parity test. |
| `packaging/` | `install.bat` (salin biner + autostart `HKCU\...\Run`) dan `update.bat`. |

## Keamanan & Sesi

- Cookie sesi `tm_session` = base64url(JSON) + HMAC-SHA256 dengan `SECRET_KEY`, TTL 24 jam; user dimuat ulang tiap request sehingga akun nonaktif/role berubah langsung ditolak.
- CSRF double-submit: cookie `csrf_token` (Max-Age 86400) vs header `X-CSRFToken`; dilewati untuk `GET/HEAD/OPTIONS` dan request Bearer client agent. Halaman kasir menerbitkan ulang cookie bila hilang.
- IP whitelist hanya menjaga `/kasir/` dan `/api/v1/kasir/`; `CF-Connecting-IP`/`X-Forwarded-For` dipercaya hanya dari peer loopback.
- `admin_only` untuk operasi admin, `shift_required` untuk endpoint uang/sesi (kasir wajib punya shift `AKTIF`).
- Semua jalur tulis memakai `state.write()` (satu lock global) untuk SQLite.

## Database & Migrasi

- SQLite mode WAL di `instance/warnet.db`; waktu disimpan UTC, ditampilkan dengan zona setting (default `Asia/Makassar`).
- Bukan Alembic. DB baru dibangun dari `migrations/0001_schema_head.sql`. DB lama hanya ditambah tabel/kolom/index yang kurang, lalu distempel `HEAD_REVISION = "a2b3c4d5e6f7"`.
- Snapshot otomatis dibuat sebelum DB lama disentuh; tidak ada operasi drop. DB hasil jalur Python tetap bisa dibuka.
- Backup/restore memakai snapshot SQLite dan menolak arsip yang bukan database TMBilling.

## Rilis, Instalasi, dan Update

```bat
.venv\Scripts\python.exe build_release.py
```

Menghasilkan `TMBilling_Server_v<versi>.zip` berisi `tmbilling-server.exe`, `install.bat`, `update.bat`, dan `SHA256SUMS.txt`.

- Instalasi: ekstrak paket, jalankan `install.bat` (menyalin biner ke folder induk dan mendaftarkan autostart login).
- Pembaruan: `update.bat "TMBilling_Server_vX.zip"` → `tmbilling-server.exe --apply-update`. Berkas `.env`, `instance/`, dan `backups/` tidak ditimpa.
- Skrip root `install.bat`/`start.bat`/`stop.bat`/`update.bat` masih jalur Python beku; untuk Rust gunakan `app-rust/packaging/`.

## Troubleshooting

| Gejala | Penyebab / tindakan |
|---|---|
| Gagal bind | Port 7015 sudah dipakai proses lain; hentikan `tmbilling-server.exe` lama. |
| "Access is denied (os error 5)" saat build | Biner sedang berjalan; hentikan dulu prosesnya. |
| Instance terkunci | `instance/server.lock` milik proses yang masih hidup; hapus hanya bila proses benar-benar mati. |
| Login pertama tidak diketahui | Lihat `initial_admin.txt` di root aplikasi. |
| Setelan tidak berubah | `.env` dan folder `instance/` harus writable oleh user yang menjalankan server. |
| Aset UI lama muncul | Cache `?v=` berubah hanya setelah rebuild; restart biner setelah build. |

## Bacaan Lanjutan

- `../docs/RUST_MIGRATION.md` — keputusan migrasi dan cutover.
- `../docs/DOCUMENTATION.md` — dokumentasi teknis lengkap.
- `../AGENTS.md` — peta repo untuk agent.

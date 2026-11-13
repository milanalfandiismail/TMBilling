# TMBilling: A Map for Agents & Dynamic Context Guide

Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise-Grade).
Arsitektur **3-Layer Separation of Concerns (SoC)**: Backend Flask Python, Frontend Modular ES6 Vanilla JS, Client WarnetAgent Rust & Tauri 1.5, dan TightVNC Remote Control.
Master Dokumentasi Acuan Tunggal (*Single Source of Truth*): [docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md).

> 📌 **Catatan Portabilitas**: Dokumen ini dirancang agar sepenuhnya **PORTABLE** untuk semua AI Coding Agent (Claude Code, Cursor, Copilot, ChatGPT, Windsurf, Antigravity, dsb) tanpa ketergantungan pada tool MCP tertentu.

---

## 🗺️ Peta Direktori & Kepemilikan Modul Lengkap (Exhaustive Map)

### 1. Berkas & Skrip Root Direktori

| Berkas/Folder | Tanggung Jawab & Cakupan |
|---|---|
| `run.py` | Entry point utama server Flask development & inisialisasi daemon background scheduler (APScheduler). |
| `create_admin.py` | Skrip CLI interaktif untuk pembuatan akun superadmin pertama kali. |
| `seed.py` | Skrip pengisian data awal database (paket billing, grup PC reguler/VIP, pengaturan default). |
| `seed_games.py` | Skrip seeding metadata katalog game populer dan ikon default. |
| `build_release.py` | Skrip automasi packaging rilis Server dan Client ke dalam arsip zip terdistribusi; screenshot runtime `app/static/uploads/screenshots/` tidak ikut dipaketkan. |
| `build_and_deploy.bat` | Skrip batch Windows untuk kompilasi otomatis seluruh biner klien (Rust/C#) dan build aset CSS. |
| `developer_install.bat` | Skrip instalasi cepat virtual environment Python, dependencies pip, dan node modules. |
| `install.bat` | Skrip instalasi server produksi untuk pengguna akhir. |
| `update.bat` | Runner batch Windows mandiri di root direktori untuk pembaruan manual aplikasi via CLI atau drag-and-drop berkas ZIP rilis; mengambil klaim `update_claim.py` **sebelum** menyalin ZIP ke `instance/temp_update.zip` sehingga update otomatis yang sedang berjalan tidak tertimpa. |
| `start.bat` & `stop.bat` | Skrip otomasi start/stop background service server pada Windows. |
| `package.json` | Konfigurasi npm, devDependencies (TailwindCSS 4.3 via `@tailwindcss/cli`, Playwright, FontAwesome 7), dan skrip build vendor/CSS. |
| `requirements.txt` | Daftar pustaka Python backend (Flask 3.1.3, SQLAlchemy 2.1, APScheduler, Waitress, dll; wajib Python 3.11+). |
| `scripts/` | Helper operasional: `allcore_search.py` (pencarian literal all-core), `migrate_timezone_to_utc.py` (migrasi data waktu), `upgrade_packages.py` (sinkronisasi/upgrade dependensi Python; `--latest` menulis ulang pin `requirements.txt` dan menyimpan salinan lama ke `backups/`). |
| `tailwind.config.js` | Konfigurasi framework CSS Tailwind untuk dashboard kasir dan client kiosk UI. |
| `CHANGELOG.md` | Riwayat log perubahan dan rilis versi aplikasi (*Keep a Changelog standard*). |
| `README.md` | Ringkasan proyek publik, sorotan fitur, dan panduan instalasi cepat. |
| `docs/superpowers/plans/` | Rencana implementasi agent; direktori kerja yang di-ignore Git dan bukan bagian runtime aplikasi. |
| `AGENTS.md` | Dokumen panduan navigasi arsitektur terpadu bagi AI Coding Agent (file ini). |
| `LICENSE` | Lisensi open-source software (MIT License). |

---

### 1.1 Skrip Otomasi Instalasi & Pembaruan Server (`install_scripts/`)

| Berkas Skrip | Tanggung Jawab & Cakupan |
|---|---|
| `install_scripts/update_claim.py` | Klaim tunggal lintas-proses (`instance/update.lock`, dibuat atomik via `os.makedirs`) agar hanya satu pembaruan berjalan: route dashboard memegang klaim `web` sebelum mempublikasikan ZIP, `updater.bat` mengadopsinya sebagai `runner`; klaim basi (>30 menit) dibersihkan otomatis. CLI: `claim` / `release` / `active`. |
| `install_scripts/updater.bat` | Runner batch Windows mandiri (detached) untuk **semua** jalur update (sidebar Migrasi & Update, GitHub 1-klik, `update.bat`): preflight Python 3.11+, mengambil klaim tunggal `update_claim.py claim`, menghentikan server lewat proses background, proses `run.py`, **dan** pemilik port 7015, membatalkan tanpa mengubah berkas bila port masih hidup, backup+ekstraksi (gagal → server dinyalakan ulang), lalu `"%TM_PY%" -m pip install -r requirements.txt --quiet` (**wajib**, tanpa syarat `pip.exe` ada) **sebelum** migrasi dan start ulang. Klaim selalu dilepas di label `:done`. Kegagalan `pip install` atau migrasi berhenti di label `:fail` (exit 1, server tidak dinyalakan) agar kode tidak berjalan di atas skema/dependensi yang belum siap. |
| `install_scripts/extract_update.py` | Ekstraksi aman paket update ZIP (anti path-traversal, auto-backup SQLite via Online Backup API sehingga isi `-wal` ikut tersalin, batal bila backup gagal, paket dipertahankan saat gagal, proteksi berkas `.env` dan `instance/warnet.db`). Sebelum `app/` diganti, screenshot lama di `app/static/uploads/screenshots` disalin ke staging agar tidak hilang (gagal salin = batal sebelum pohon live disentuh). Ekstraksi dilakukan ke `instance/staging_update` lalu ditukar per entri top-level dengan `os.replace` berdasarkan jurnal `instance/update_journal.json` + cadangan `instance/rollback_<ts>`; niat pasang ditulis ke jurnal **sebelum** `os.replace`, sehingga penukaran yang terputus (proses dibunuh / listrik padam) dipulihkan otomatis oleh `recover_interrupted_swap()` di awal setiap pembaruan. Migrasi dipindah ke `run_migration.py` setelah dependensi baru terpasang. |
| `install_scripts/run_migration.py` | Runner CLI one-shot untuk eksekusi migrasi skema database Alembic (`flask_migrate.upgrade`) dan safety-net sync kolom/tabel baru pada fresh process; `run(app=None)` menerima app yang sudah ada (dipakai restore database). `run()` mengembalikan `False` dan **tidak** melakukan `stamp(head)` bila upgrade atau safety sync gagal, sehingga revisi Alembic tidak pernah menunjuk ke skema yang belum terpasang. |
| `install_scripts/gen_env.py` | Generator otomatis berkas konfigurasi `.env` dengan `SECRET_KEY` acak saat instalasi awal. |
| `install_scripts/init_db.py` | Inisialisasi awal skema database SQLite dan akun admin default saat instalasi awal. |

---

### 2. Backend Server (`app/`)

#### A. Konfigurasi & Inisialisasi
- `app/config.py`: **Single Source of Version Truth** (`VERSION = "1.6.5-rc3"`), dynamic random `SECRET_KEY` generator with write-through `.env` persistence, konfigurasi database SQLite, session lifetime, batas upload `MAX_CONTENT_LENGTH = 64 MB`, dan environment loader.
- `app/__init__.py`: Application Factory (`create_app(config_override=None)`), inisialisasi CORS, custom `TMBillingCSRFProtect` (Bearer client key dibandingkan dengan `hmac.compare_digest`), Flask-Migrate, `bootstrap_app_data(app)` (seed pengaturan/whitelist/tutorial + bootstrap superadmin acak unik `initial_admin.txt`; hanya menjalankan `db.create_all()` untuk database yang benar-benar baru, database ber-`alembic_version` tidak disentuh factory dan wajib lewat migrasi), guard `before_request` lazy bila skema baru tersedia setelah factory, dan pendaftaran 34 Blueprint.

#### B. Model ORM SQLAlchemy (`app/models/` — 17 Sub-Domain)
| Subfolder Model | Model SQLAlchemy & Entitas Data |
|---|---|
| `models/base/` | Model dasar, helper mixin, dan relasi umum. |
| `models/game/` | `Game` (daftar game klien) & `GameKategori` (kategori eSports/casual/FPS). |
| `models/grup/` | `Grup` (kategori ruangan PC: VIP, Reguler, VVIP beserta tarif per menit). |
| `models/hardware/` | `HardwareMonitor` (baseline spek CPU, GPU, RAM, Mobo) & `PCProcess` (daftar proses aktif). |
| `models/maintenance/` | `MaintenanceTicket` (pelaporan kerusakan hardware/peripheral PC dari member). |
| `models/member/` | `Member` (akun member, saldo prabayar, poin, status aktif). |
| `models/menu/` | `MenuItem` (menu FnB kantin, stok, harga) & `TransaksiMenu` (pesanan kasir; index `ix_transaksi_menu_tanggal` pada `tanggal`). |
| `models/mikrotik/` | `MikroTikConfig` (konfigurasi RouterOS API untuk manajemen bandwidth per PC). |
| `models/paket/` | `Paket` (paket billing waktu tetap: 1 Jam, 3 Jam, Paket Malam, dll). |
| `models/pc/` | `PC` (registrasi client meja, IP, MAC address) & `PCUptimeLog` (log online & billing). |
| `models/sesi/` | `Sesi` (sesi bermain aktif, sisa waktu, jenis prepaid/postpaid, blackout token). |
| `models/settings/` | `Settings` (key-value konfigurasi sistem global, toleransi blackout, tarif minimum). |
| `models/shift/` | `ShiftRecord` (catatan shift kasir, modal awal, modal akhir, blind cash reconciliation). |
| `models/tournament/` | `Tournament`, `TournamentTeam`, `TournamentMatch` (bracket eSports eliminasi). |
| `models/transaksi/` | `Transaksi` (pembayaran billing meja kasir: Tunai, QRIS, Transfer). |
| `models/tutorial/` | `SystemTutorial` (artikel panduan operasional & CMS internal kasir). |
| `models/user/` | `User` (akun kasir & admin); audit trail disimpan sebagai file JSON di `logs/warnet.log`, bukan tabel database. |

#### C. Route Blueprints HTTP REST & VNC Bridge (`app/routes/` — 26 Sub-Domain)
| Subfolder Rute | Tanggung Jawab Endpoint |
|---|---|
| `routes/auth/` | Autentikasi kasir & admin (`/kasir/auth/`) serta autentikasi member client PC dengan validasi API key (`/public/auth/`). |
| `routes/backup/` | Manajemen backup database lokal SQLite, integrasi cloud backup, dan restore database aktif dari arsip (`POST /restore/<filename>`, admin-only, wajib `{"confirm": true}`); arsip yang bukan database TMBilling ditolak sebelum DB aktif ditimpa. |
| `routes/blackout/` | Endpoint penanganan toleransi pemulihan sesi pasca mati lampu; hapus audit `/clear` khusus admin. |
| `routes/client/` | Handshake client agent PC, detak jantung (heartbeat), penerimaan status sesi, dan emergency login yang diotorisasi token server **atau** IP koneksi peer sama dengan `pc.ip_address`. Identitas client diambil dari IP koneksi (`IpWhitelistService.extract_client_ip`); `ip_address` di body hanya boleh berbeda bila request datang dari loopback. `GET /api/v1/public/client/warnet` mengirim `qris_path` relatif (dipakai client), `qris_url` absolut (dari setting `app_public_url`, fallback `request.host_url`), dan announcement yang sudah disanitasi `sanitize_html`. |
| `routes/dashboard/` | Data agregat statistik dashboard kasir, total pendapatan hari ini, dan summary PC. |
| `routes/game/` | CRUD katalog game klien, uploader cover game, dan crop ikon otomatis; ikon SVG ditolak, folder ikon mengikuti `current_app.static_folder`. |
| `routes/grup/` | Manajemen grup ruangan dan penetapan tarif bertingkat; `POST /grup/<id>/archive` dan `/restore` mengubah kolom `aktif`. |
| `routes/arsip/` | Endpoint agregat `GET /api/v1/kasir/arsip/` untuk tab Data Diarsipkan (grup, pc, paket, member, user, game, menu). |
| `routes/hardware/` | Audit spek hardware, pembaruan baseline anti-maling, dan log perubahan komponen. |
| `routes/maintenance/` | Tiket servis pemeliharaan PC dan status perbaikan hardware. |
| `routes/member/` | Registrasi member, top-up saldo (multi-paket satu transaksi atomik), reset password, dan riwayat transaksi member; `/pc-status` publik menyamarkan nama member menjadi "Member" dan total belanja portal hanya menghitung pembelian valid (bukan refund). |
| `routes/menu/` | Kasir FnB kantin, manajemen inventaris stok, kategori menu, dan cetak struk thermal; unggah gambar divalidasi Pillow (byte non-gambar ditolak 400). |
| `routes/mikrotik/` | Sinkronisasi queue bandwidth MikroTik dan monitoring traffic internet; `host`/`username` null dari form diperlakukan sebagai string kosong (bukan 500). |
| `routes/monitor/` | Telemetry hardware & proses PC (`monitor_routes.py`, identitas dari IP koneksi peer bukan body `IpAddress`, metrik tidak valid 400), endpoint ringan `GET /api/v1/kasir/monitor/hardware/<int:pc_id>` untuk modal detail satu PC, aksi remote AFK/shutdown/restart (`remote_action_routes.py`), manajemen screenshot PC (`screenshot_routes.py`, identitas dari IP koneksi bukan header `X-IP-Address`, byte divalidasi Pillow lalu dinormalkan ke PNG maks 1280 px di `instance/uploads/screenshots` — bukan static publik; metadata dan byte hanya untuk admin via `GET /api/v1/kasir/monitor/screenshot/image/<int:pc_id>`, dan `migrate_legacy_screenshots(app)` memindahkan berkas lama dari `static/uploads/screenshots` saat startup non-testing), dan proxy VNC client (`vnc_client_routes.py`). |
| `routes/notes/` | Scratchpad / sticky notes serah terima pesan antar shift kasir; seluruh endpoint memakai `@login_required` sehingga sesi kasir yang sudah dihapus/nonaktif ditolak 401. |
| `routes/paket/` | CRUD paket billing jam-jaman dan promosi khusus warnet; paket yang tidak ada dibalas 404, bukan 500. |
| `routes/pc/` | CRUD registrasi meja PC, pengaturan denah koordinat meja, dan status koneksi. |
| `routes/public/` | Billboard TV publik, leaderboard score eSports, landing page info tarif, dan health check publik `GET /api/health`. |
| `routes/report/` | Laporan pendapatan berkala, ekspor PDF/Excel kasir, dan rekonsiliasi keuangan; struk hanya untuk pemilik atau admin, tanggal/pagination tidak valid 400 (termasuk export PDF), hapus transaksi yang tidak ada 404, hapus tanggal yang masih dipakai sesi aktif 400, dan hapus log sistem mengarsipkan berkas lama. |
| `routes/server_monitor/` | Status kesehatan internal server billing (CPU, RAM, Disk, CPU Temp Server); start/stop LHM khusus admin. |
| `routes/sesi/` | Siklus hidup sesi (buka sesi, tambah waktu, pindah PC, tutup sesi paksa, stop sementara); tambah waktu multi-paket dijalankan sebagai satu transaksi atomik. |
| `routes/settings/` | Konfigurasi IP whitelist, token API, integrasi Cloudflare Tunnel, vacuum SQLite, dan manajemen pembaruan sistem (GitHub 1-Klik / manual upload via runner mandiri). `GET /api/v1/kasir/settings/` meredaksi kredensial untuk role kasir (hanya `payment_methods` & `vnc_password`). Unduhan database (`/download-db`) memakai snapshot SQLite Online Backup API + `PRAGMA integrity_check` (aman WAL, file sementara dihapus via `after_this_request`). Endpoint `/uninstall-token/client` hanya mengembalikan `uninstall_token` dari IP koneksi peer; `client_api_key` hanya dapat diubah lewat `/api/v1/kasir/settings/apikey`, handler setting generik dibatasi allowlist prefix, dan QRIS disimpan di `static/uploads/qris`. |
| `routes/shift/` | Buka shift, tutup shift kasir dengan hitung buta (*blind cash reconciliation*); ringkasan shift (`/summary`) khusus admin — kasir mendapat 403 termasuk saat `shift_id` tidak dikirim, struk shift hanya dapat dibaca pemilik shift atau admin (kasir lain 403), riwayat shift non-admin dikunci ke `kasir_id` sendiri dengan `limit` 1..100 dan tanggal invalid 400. |
| `routes/tournament/` | Manajemen turnamen game, pendaftaran tim eSports, dan generator bagan bracket. |
| `routes/tutorial/` | CMS panduan sistem, artikel tutorial, dan upload media rich-text editor; unggah gambar divalidasi Pillow (byte non-gambar ditolak 400), input tidak valid dibalas 400 (bukan 500), dan cleanup berkas sementara hanya menghapus berkas di `static/assets/tutorials/temp` yang dirujuk payload editor tersebut. |
| `routes/user/` | RBAC manajemen user kasir/admin dan penelusuran audit log lengkap. |
| `routes/vnc/` | Kontrol HTTP start/stop/status proxy VNC; relay WebSocket RFB TightVNC port 5900 dan clipboard dua arah ditangani Websockify (port 8081). |

#### D. Business Logic Services (`app/services/` — 31 Sub-Domain)
Seluruh aturan bisnis murni berada di layer service:
- `services/auth/`: Validasi kredensial, hashing password, dan manajemen token; login wajib token sesi saat logout, `login_throttle.py` membatasi 5 kegagalan per (IP, username) dan 20 kegagalan per IP dalam 5 menit (HTTP 429) dan dipakai pada login kasir, `admin-check`, `client/admin-login`, serta portal member; setiap login sukses memanggil `session.clear()` agar sesi lama tidak menempel; `AuthService.logout` melayani logout portal member via `/api/v1/public/auth/logout`.
- `services/backup/`: Backup otomatis rotasi harian dan restore snapshot SQLite; snapshot memakai SQLite Online Backup API + `PRAGMA integrity_check` (aman untuk mode WAL), path DB diturunkan dari engine aktif via `default_db_path()`, direktori backup dari `default_backup_dir()` (env `BACKUP_DIR` untuk test/sandbox), dan `restore_backup()` membuat backup pengaman lalu menulis ke DB aktif tanpa restart (lock bersama dengan proses backup). `_inspect_schema()` menolak arsip SQLite valid yang bukan database TMBilling (tabel inti `grup`/`pc`/`sesi`/`transaksi` tidak lengkap) **sebelum** DB aktif ditimpa; setelah dipasang, restorasi menjalankan migrasi Alembic (`run_migration.run(app)`) bila DB punya tabel `alembic_version` **atau** skemanya belum identik dengan metadata model, lalu memverifikasi ulang skema hasil migrasi; bila migrasi gagal atau skema masih tidak lengkap, DB dikembalikan ke kondisi sebelum restore dari backup pengaman (galat jelas bila pemulihan itu pun gagal). Skema tanpa revisi yang sudah identik dengan model tetap dipulihkan tanpa migrasi. Semua panggilan `urlopen` provider cloud memakai `timeout=30` agar job backup tidak menggantung.
- `services/blackout/`: Logika pemulihan sesi berdasarkan threshold blackout terkonfigurasi (validasi route `1..1440` menit, hanya sesi `is_blackout_suspect` yang boleh di-resolve); deteksi juga dijalankan scheduler 60 detik; deteksi berjalan di dalam `WRITE_LOCK`, me-reload tiap sesi, dan melewati sesi yang `last_sync`-nya masih baru sehingga heartbeat tidak dianggap mati lampu; polling client yang `last_sync`-nya sudah melewati threshold memicu `deteksi()` sebelum heartbeat diperbarui agar jeda outage tidak hilang dari audit; `sesi.selesai_pada` diset ke waktu referensi (bukan jam sekarang) agar waktu terpakai tidak membengkak selama outage, sesi guest yang di-resolve mengisi `selesai_pada`, dan `resolve_member` menolak member yang masih punya sesi aktif serta menghormati `cek_kadaluarsa()` (saldo hangus tidak dihidupkan); `force_all_and_detect` juga mereset `pc.is_admin_mode`; force close menandai **semua** sesi guest/member aktif (termasuk yang heartbeat-nya masih baru) sebagai suspect blackout dengan snapshot sisa menit di `last_sync`, menyimpan saldo member, dan menulis satu transaksi `tutup_sesi` Rp0 per sesi; pemulihan guest menolak PC arsip (`aktif=False`) baik di PC asal maupun PC tujuan.
- `services/cache/`: Subsystem in-memory cache berkecepatan tinggi (rincian di Bagian 3); `ProcessMemoryStore` ber-TTL 300 detik dan `PCNetworkCacheStore` di-rebuild di luar lock; `UptimeMemoryStore` menyimpan flag billing per PC di RAM (dibaca jalur telemetri, bukan query sesi).
- `services/client/`: Manajemen handshake, antrean perintah cepat client PC, dan heartbeat `sesi.last_sync` throttled 30 detik (`ClientService.HEARTBEAT_PERSIST_SECONDS`) yang diperbarui lewat UPDATE bersyarat tanpa query SELECT tambahan di jalur polling; bila `last_sync` sudah melewati ambang blackout, polling menjalankan `BlackoutService.deteksi()` lebih dulu lalu memuat ulang sesi sebelum heartbeat ditulis; fallback identitas lewat MAC address menolak PC yang `aktif=False` (maintenance/arsip) sehingga polling lama tidak melanjutkan sesi; kegagalan sinkronisasi waktu member tidak lagi menutup sesi berbayar; takeover `emergency_login`/`admin_login` menutup sesi lama lewat `SesiService.tutup_sesi` sehingga tercatat sebagai transaksi.
- `services/cloudflare_tunnel/`: Integrasi zero-trust Cloudflare Ingress daemon (log cloudflared ditulis ke `logs/` di samping biner).
- `services/dashboard/`: Kalkulasi metrik visual denah meja dan kartu status PC; cache omzet hari ini 5 detik (`_get_omzet`, `clear_omzet_cache`) agar polling dashboard tidak mengulang agregasi; batas hari omzet memakai `get_today_local_date()` (zona waktu setting), bukan tanggal UTC.
- `services/game/`: Manajemen file aset executable game dan integrasi launcher; ikon SVG ditolak dan folder unggah mengikuti `current_app.static_folder/uploads/games`.
- `services/grup/`: Logika validasi tarif grup meja; `archive`/`restore` menyetel `grup.aktif` dalam `WRITE_LOCK`.
- `services/arsip/`: Agregasi data terarsip lintas 7 kategori untuk tab Data Diarsipkan.
- `services/hardware/`: Evaluasi diskrepansi hardware baseline (anti pencurian komponen); laporan uptime memakai eager load PC/grup dan tidak menulis di jalur GET (flush hanya dari scheduler 60 detik); identitas PC telemetri diambil dari IP koneksi peer (bukan `IpAddress` body) lalu di-resolve lewat `PCNetworkCacheStore` tanpa SELECT ulang tabel `pc`, `get_one_with_pc()` melayani modal detail satu PC, dan metrik non-numerik dibalas 400 (`InvalidMetricError`).
- `services/health/`: Guard sumber daya (`MIN_FREE_BYTES = 512 MB`) dan payload `GET /api/health` publik (`db`/`disk`/`backup`, tanpa angka/path; status `degraded` tetap HTTP 200); `has_free_space()` gagal tertutup bila kapasitas disk tidak terbaca.
- `services/ip_whitelist/`: Proteksi akses kasir hanya dari subnet IP yang terdaftar; toggle menerima string boolean (`"false"` benar-benar menonaktifkan).
- `services/maintenance/`: Alur status tiket perbaikan PC; tiket KRITIS menonaktifkan PC, dan status SELESAI hanya mengaktifkan kembali PC bila tidak ada tiket KRITIS lain yang masih `BARU`/`DIPROSES` (menyelesaikan tiket ringan pada PC arsip/kritis tidak menghidupkannya), tanggal laporan invalid 400, dan `limit` tiket divalidasi 1..500.
- `services/member/`: Transaksi saldo, potongan diskon tarif member, dan proteksi saldo minus; `archive_member` menonaktifkan member dan `delete` menghapus permanen sambil melepas `sesi.member_id`/`transaksi.member_id` (riwayat tetap utuh, wajib konfirmasi nama di route); top-up multi-paket (`tambah_waktu_batch`) memakai `WRITE_LOCK` dengan satu commit/rollback sehingga tidak ada top-up setengah jadi; paket nonaktif (`aktif=False`) ditolak untuk top-up member maupun sesi; sinkronisasi MikroTik di background menangkap `username` sebagai scalar di thread pemanggil sehingga worker tidak menyentuh objek ORM yang sudah expired; refund paket memotong saldo menit lalu mengembalikan nilai penuh transaksi (`-jumlah`); refund memanggil `cek_kadaluarsa()` lebih dulu dan meng-clamp tanggal kadaluarsa yang terlewati ke waktu sekarang; klaim refund atomik lewat `TransaksiRepository.claim_refund()`; penulisan saldo diserialisasi `WRITE_LOCK`; daftar member eager load grup & sesi.
- `services/menu/`: Pengurangan stok bahan makanan/minuman otomatis saat transaksi POS terjadi; metode Tunai wajib menyertakan nominal `>= total_tagihan` (tunai kosong/kurang ditolak).
- `services/notes/`: Sinkronisasi catatan serah terima kasir; nama berkas baru dipesan atomik (`O_CREAT|O_EXCL`) sehingga rename ke judul yang sudah dipakai menjadi `judul_1.txt` dan tidak menimpa catatan lain.
- `services/owner/`: Agregasi statistik finansial khusus peran owner/pemilik warnet; `get_top_paket` mengelompokkan per `Transaksi.paket_id` dan memberi label "Paket dihapus" untuk paket yang sudah tidak ada; pendapatan harian/per kasir dan top paket mengecualikan transaksi refund (`is_refunded`/`jenis="refund_paket"`), refund rate memakai pembelian sebagai penyebut, dan tanggal analytics invalid dibalas 400.
- `services/paket/`: Validasi durasi dan jam berlaku paket (contoh: paket malam); flag `aktif` menerima string boolean sehingga `"false"` tidak lagi dianggap aktif; `archive` hanya menonaktifkan, `delete` menghapus permanen sambil melepas `sesi.paket_id`/`transaksi.paket_id` di dalam `WRITE_LOCK`.
- `services/pc/`: Manajemen status ketersediaan meja PC dan uptime tracking; `archive` menonaktifkan PC (`aktif=False`, audit `ARSIP_PC`) dan `delete` menghapus permanen di dalam `WRITE_LOCK` — melepas `sesi.pc_id` menjadi NULL, menghapus uptime log/hardware/process/tiket, dan ikut menghapus screenshot privat di `instance/uploads/screenshots` (wajib konfirmasi kode PC di route), dan `create` menghidupkan kembali PC arsip dengan kode sama; `reset_admin_mode` menutup sesi admin/guest lewat `SesiService.tutup_sesi` dan mengantre perintah `lock` dengan id PC.
- `services/plugins/`: (dihapus) subsistem ekstensi dinamis tidak lagi tersedia.
- `services/public/`: Format data tampilan TV billboard publik; payload TV di-cache 5 detik.
- `services/report/`: Kompilasi laporan keuangan harian/bulanan kasir (rentang harian memakai tanggal lokal server, bukan UTC); relasi struk/menu di-eager load dan hitung sesi aktif memakai `SesiRepository.count_aktif()`. Hapus riwayat transaksi juga menghapus `TransaksiMenu` pada rentang yang sama, menolak rentang yang dipakai sesi aktif (pemeriksaan sesi aktif + penghapusan dijalankan di dalam `WRITE_LOCK` agar tidak bertabrakan dengan pembukaan sesi baru), dan nota pembelian paket tidak boleh dihapus (`ValueError` → 400; gunakan Refund agar saldo ikut kembali); hapus transaksi yang tidak ada dibalas 404; `clear_system_logs` meneruskan opsi arsip.
- `services/server_monitor/`: Sensor telemetri performa mesin server utama.
- `services/sesi/`: Engine kalkulasi tarif per menit, sisa waktu billing, dan refund saldo; refund paket guest memotong durasi beli sesuai sisa waktu lalu mengembalikan nilai penuh transaksi; refund guest dan member memakai klaim atomik `TransaksiRepository.claim_refund()` sehingga satu transaksi hanya menghasilkan satu nota refund; commit sesi menangkap `IntegrityError` (unique index `uq_aktif_sesi_pc`/`uq_aktif_sesi_member`) menjadi `ValueError("PC sedang dipakai")`; seluruh jalur tulis tambah-waktu (termasuk batch satu commit), buka sesi guest, pindah sesi, dan tutup sesi diserialisasi `WRITE_LOCK` (`app/services/write_lock.py`); sesi kedaluwarsa via polling client ditutup lewat `tutup_sesi` sehingga tercatat transaksi `tutup_sesi` Rp0; paket dengan `aktif=False` ditolak (`ValueError("Paket tidak aktif")`) sebelum durasi/saldo/transaksi diubah.
- `services/settings/`: Cache write-through pengaturan aplikasi, auto-generator random `vnc_password`, serta auto-generator random token emergency & uninstall (`secrets.token_urlsafe`, hanya mengisi bila kosong sehingga token lama di database tetap berlaku); cache miss negatif untuk setting yang tidak ada. Upload QRIS (`routes/settings/database_routes.py`) divalidasi Pillow, diperkecil maks 800 px, dan deskripsinya disimpan dengan nama bertimestamp. Arsip pra-purge database (`db_maintenance_service.py`) memakai `default_backup_dir()` + snapshot Online Backup API + `PRAGMA integrity_check`, bukan `copy2` berkas WAL.
- `services/shift/`: Verifikasi selisih uang kas fisik kasir (blind reconciliation); ringkasan shift mencakup transaksi semua kasir pada rentang waktu shift (tanpa filter `user_id`) dan tidak meng-clamp nilai negatif; riwayat shift memakai rentang tanggal lokal, `force_close_shift` menghitung ringkasan sebelum satu commit, `end_shift`/`force_close_shift` diserialisasi `WRITE_LOCK` sehingga dua request tutup tidak sama-sama menang, `start_shift` dilindungi unique index `uq_aktif_shift` dan menolak kasir nonaktif.
- `services/tournament/`: Engine pairing babak dan alur skor turnamen eSports; format `playoff`/`swiss`/`multi`, nama tim kosong diabaikan sebelum validasi minimal 2 tim, `finish_stage` menolak babak yang sudah selesai/milik turnamen lain, dan skor hanya boleh dimenangkan tim yang bertanding di match tersebut; match yang belum punya kedua tim ditolak.
- `services/transaksi/`: Pencatatan buku besar transaksi pembayaran.
- `services/tutorial/`: Manajemen konten artikel tutorial CMS.
- `services/user/`: Validasi RBAC hak akses pengguna; `archive_user` menonaktifkan akun, `delete_user` menghapus permanen sambil melepas `transaksi.user_id`/`sesi.user_id` tetapi tetap menolak user yang punya riwayat `shift_record` (`kasir_id` NOT NULL — nonaktifkan saja), guard "admin terakhir" hanya berlaku untuk admin yang masih aktif sehingga admin nonaktif tetap bisa dihapus, dan race username saat `create_user` di-rollback menjadi `ValueError("Username sudah terdaftar")`.
- `services/vnc/`: Broker koneksi TCP TightVNC dan pengelola proses Websockify untuk klien browser; token proxy acak (`secrets.token_urlsafe(24)`), token lama dicabut saat proxy dimulai ulang, penulisan file token atomik (`os.replace`), polling status non-blocking (`poll_vnc_result`, start membalas 202), dan reaper mematikan proxy milik PC offline atau yang idle melewati batas.

#### E. Data Access Layer Repositories (`app/repositories/` — 15 Sub-Domain)
Pemisahan query ORM mentah dari service:
`arsip/`, `game/`, `grup/`, `hardware/`, `member/`, `menu/`, `paket/`, `pc/`, `process/`, `sesi/`, `settings/`, `tournament/`, `transaksi/`, `tutorial/`, `user/`.

#### F. Middleware & Utilities (`app/middleware/` & `app/utils/`)
- `middleware/auth.py`: Decorator `@login_required`, `@admin_required`, `@shift_required`.
- `middleware/ip_whitelist_middleware.py`: Filter akses IP subnet warnet (token URL dibandingkan dengan `hmac.compare_digest`); akun admin dibebaskan dari cek whitelist **hanya** bila sesi masih menunjuk user aktif ber-role `admin` di database (role sesi lama yang sudah diturunkan/nonaktif tidak lagi memberi bypass, dan `kasir_role` disegarkan dari DB).
- `utils/constants.py`: Konstanta global durasi, status sesi, dan kode error.
- `utils/helpers.py`: Response formatter JSON terstandar (`success_response`, `error_response`) dan `natural_sort_key` bersama untuk pengurutan kode PC; `SafeHTMLParser`/`sanitize_html` memakai allowlist protokol (`http://`, `https://`, `mailto:`, `/`, `#`, `data:image/`) setelah normalisasi karakter kontrol.
- `utils/logger.py`: Centralized audit logger ke file JSON `logs/warnet.log` (rotasi gzip); tanpa `print` per entri, dan `read_logs` hanya membaca ekor file. Tidak ada penulisan audit ke SQLite.
- `utils/mikrotik_api.py`: Klien API RouterOS MikroTik berbasis socket.
- `utils/pdf_helper.py`: Generator laporan PDF struk kasir & rekap keuangan (ReportLab).
- `utils/scheduler_tasks.py`: Daemon tugas berkala APScheduler (auto-flush, auto-backup, expired cleanup).
- `utils/timezone_utils.py`: Formatter waktu terpusat (WIB/WITA/WIT/UTC).
- `utils/validators.py`: Sanitasi input data form kasir.

---

### 3. Sub-Modul In-Memory Cache (`app/services/cache/`)

Subsystem kritis pengeliminasi query disk SQLite berulang pada loop polling klien:

| Berkas Modul | Tanggung Jawab & Store |
|---|---|
| `client_state_store.py` | `OnlineStatusStore` (detak jantung PC < 15s), `AntiTheftGraceTracker` (toleransi cold boot 60s anti false-alarm hardware dengan auto-reboot detection saat PC bangun dari offline), dan `ApiKeyMismatchStore` (pelacakan client dengan API key salah/mismatch). |
| `command_store.py` | `CommandQueueStore` & `CommandQueueDict` (antrean perintah FIFO GUI & VNC fast-command per PC dengan proteksi memory leak). |
| `telemetry_store.py` | `ProcessMemoryStore` (snapshot Task Manager PC di RAM), `HardwareMetricsStore`, dan `TelemetryHistoryStore` (sliding window 3 snapshot). |
| `system_cache_store.py` | `SettingsCacheStore` (write-through cache pengaturan global) dan `PCNetworkCacheStore` (cache mapping IP/MAC -> metadata PC). |
| `uptime_store.py` | `UptimeMemoryStore` (akumulasi detik online & billing di RAM dengan flush batch berkala ke SQLite setiap 60s). |
| `memory_store.py` | **Facade re-export backward-compatibility** agar seluruh kode dan unit test tetap kompatibel. |

---

### 4. Client WarnetAgent (`WarnetAgent/`)

Aplikasi klien berjalan di setiap PC member/kiosk:

| Direktori / Biner | Tanggung Jawab & Cakupan |
|---|---|
| `TMBillingTauri/` | Source code klien utama: UI HTML/CSS kiosk lockscreen (`src/kiosk/`) & floating overlay bar (`src/overlay/`), Rust backend (`src-tauri/`) dengan Win32 low-level hooks penonaktifan tombol sistem Windows. `src/main.js` memegang satu-satunya loop konfigurasi warnet (60 dtk sehat / 5 dtk gagal, event `tm:refresh-config`), QRIS diunduh ke data URI hanya saat `qris_path` berubah dan disimpan di RAM (`src-tauri/src/utils/qris_memory.rs`, tanpa cache disk). Kredensial darurat dibaca dari registry/`config.ini`; bila kosong fitur darurat offline nonaktif (fail-closed, tanpa fallback default). |
| `MGCTM/` | Watchdog daemon C++ yang bertugas mengawasi proses `TMBilling.exe` dan memulihkan aplikasi secara otomatis jika dihentikan paksa. |
| `mtm/` | Auxiliary watchdog & resilience guard pelindung integritas service klien. |
| `TMBilling_Monitor/` | Daemon telemetri Rust (`src/main.rs`) & helper C# `HardwareHelper.exe` berbasis kernel driver LibreHardwareMonitor dengan sinkronisasi startup cold boot (pengumpul metrik CPU/GPU load & temp, RAM, active window, native Win32 NIC speed). |
| `TMBilling_Uninstaller/` | Program uninstaller aman yang membersihkan hash registry, Win32 service, dan konfigurasi klien. |
| `Deploy/` | Skrip automasi firewall Windows (`allow_firewall.bat`), skrip sync registry, installer & uninstaller biner lengkap (`install.bat` / `uninstall.bat` untuk fresh install & clean update), dan TightVNC server loopback port 5900. `install.bat` membangkitkan password admin darurat acak (dicetak ke konsol) bila operator mengosongkannya. |

---

### 5. Frontend Dashboard Kasir (`app/static/` & `app/templates/`)

#### A. Modular ES6 JavaScript (`app/static/js/kasir/`)
- `app.js`: Entry point inisialisasi aplikasi kasir, event delegation, dan routing 31 tab.
- `core/api.js`: Klien HTTP REST terpusat dengan penanganan CSRF otomatis dan error reporting.
- `core/modal.js`: Pengendali modal dialog modular; `Modal.confirm` mendukung opsi `requireCheck` (satu checkbox wajib dicentang, tombol setuju nonaktif sampai aktif) yang dipakai hapus permanen PC/Paket/Member/User/Game.
- `core/arsip_list.js`: Skema kolom arsip per resource (`ArsipList.SCHEMA`) + renderer tabel/kartu bersama (`ArsipList.mount/render/table/cards/restore/hapus`), filter golongan (`ArsipList.filter` + `setGrup`/`match`), hitungan per grup (`ArsipList.counts`) untuk pill grup yang mengikuti mode tampil, dan footer `Total N <unit> arsip` yang mengikuti hasil filter. `ArsipList.onChanged(cb)` menjalankan ulang daftar (`_refresh`) **dan** semua callback pemanggil setelah pulihkan/hapus permanen, sehingga daftar, total, dan pill grup ikut segar tanpa reload. Arsip selalu memakai bentuk dan kolom yang sama dengan data aktifnya; dipakai tab Data Diarsipkan, pill arsip grup/PC/paket/member/user/game, dan tampilan arsip menu FnB.
- `core/skeleton.js`: Skeleton loader statis (tanpa animasi) untuk 31 tab tampilan.
- `core/toast.js`: Sistem notifikasi toast floating modern.
- `core/utils.js`: Formatter mata uang Rupiah, kalkulator waktu, dan escape HTML sanitizer.
- `components/modal-buka.js`: Modal alur pembukaan sesi baru meja PC (Prepaid/Postpaid/Member).
- `components/modal-tambah.js`: Modal penambahan durasi waktu bermain.
- `components/modal-confirm-tambah.js`: Konfirmasi pembayaran perpanjangan durasi.
- `modules/dashboard/`: Logika view dashboard utama (`dashboard_card.js`, `dashboard_compact.js`, `dashboard_detail_modal.js`, `dashboard_process_monitor.js`, `dashboard_selection.js`, `map_view.js`, `sidebar.js`).
- `modules/`: 29 Modul fitur independen (`blackout.js`, `catatan.js`, `game.js`, `grup.js`, `hardware_checker.js`, `laporan.js`, `laporan_maintenance.js`, `laporan_menu.js`, `log.js`, `maintenance.js`, `member.js`, `menu.js`, `mikrotik.js`, `monitor.js`, `owner.js`, `paket.js`, `pc.js`, `arsip/` (tab Data Diarsipkan), `remote.js`, `screenshot.js`, `server_monitor.js`, `settings.js`, `shift.js`, `struk.js`, `tournament.js`, `tutorials.js`, `uptime.js`, `user.js`).

#### B. Template Jinja2 HTML (`app/templates/`)
- `templates/kasir/base.html`: Shell induk HTML dashboard kasir, deklarasi CSS/JS dan meta CSRF.
- `templates/kasir/index.html`: Kontainer view 31 tab modular kasir.
- `templates/kasir/login.html`: Halaman login kasir dan administrator.
- `templates/kasir/documentation.html`: Portal internal dokumentasi interaktif & CMS tutorial sistem (`/kasir/documentation`).
- `templates/kasir/components/`: Partisi navbar (`navbar.html`), sidebar (`sidebar.html`, `sidebar_admin.html`, `sidebar_kasir.html`), dan modal induk (`modals.html`).
- `templates/kasir/tabs/`: 29 Tampilan tab independen lengkap (`dashboard.html`, `pc.html`, `grup.html`, `paket.html`, `menu.html`, `menu_stock_log.html`, `laporan_menu.html`, `member.html`, `monitor.html`, `hardware_checker.html`, `uptime.html`, `screenshot.html`, `maintenance.html`, `laporan_maintenance.html`, `shift_history.html`, `catatan.html`, `tournament.html`, `game.html`, `remote_server.html`, `user.html`, `user_logs.html`, `log.html`, `laporan.html`, `struk.html`, `blackout.html`, `arsip.html`, `mikrotik.html`, `analytics.html`, `settings.html`) ditambah tab `server_statistic.html` (di `server_monitor/`).
- `templates/public/`: 8 Halaman portal publik (`landing/` info billing, `tv/` & `tv/static` billboard display, `livepc/` live scoreboard, `member/` kiosk login & dashboard, `game/` katalog game, `paket/` daftar tarif, `specs/` spesifikasi PC modern minimalis berbasis compact 2-column mobile grid, debounced search toolbar & modal hardware ringkas fokus trio utama CPU, GPU, RAM serta penyesuaian kode PC client Tauri tanpa telemetri berlebih; katalog hanya memuat PC aktif dan status `"online"` diambil dari heartbeat `OnlineStatusStore`, bukan flag arsip `pc.aktif`).

---

### 6. Subsystem Navigator: Where Things Live

Tabel pencarian cepat file penanggung jawab fitur operasional:

| Domain Fitur | Frontend JS | Backend Route & Service | Model Terkait |
|---|---|---|---|
| **Blackout Recovery** | `modules/blackout.js` | `routes/blackout/`, `services/blackout/` (deteksi via `sesi.last_sync` yang di-heartbeat tiap 30 detik) | `Sesi`, `PCUptimeLog` |
| **Process Monitor & Task Killer** | `modules/dashboard/dashboard_process_monitor.js` | `routes/monitor/monitor_routes.py`, `services/cache/telemetry_store.py` | `PCProcess`, in-memory store |
| **VNC Remote Control & Clipboard** | `modules/remote.js`, `core/vnc_client.js` | `routes/vnc/vnc_routes.py` (semua route `@login_required` + `@admin_required`, start non-blocking 202), `services/vnc/` (`poll_vnc_result`, token acak, reaper hanya PC offline) | `PC`, `Settings` |
| **POS Kantin & Billing FnB** | `modules/menu.js`, `modules/struk.js` | `routes/menu/menu_routes.py`, `services/menu/` (anti-skip monotonic receipt generator, local timezone boundaries, stok atomik & arsip satu query `GROUP BY`) | `MenuItem`, `TransaksiMenu` |
| **Hardware Baseline Anti-Maling** | `modules/hardware_checker.js` | `routes/monitor/monitor_routes.py` (`GET /api/v1/kasir/monitor/hardware/<pc_id>` untuk modal detail), `routes/hardware/`, `services/hardware/` | `HardwareMonitor` |
| **Shift Kasir (Blind Cash)** | `modules/shift.js` | `routes/shift/shift_routes.py`, `services/shift/` | `ShiftRecord`, `Transaksi` |
| **Health & Resource Guard** | `modules/settings/settings_scheduler.js` (`loadSchedulerStatus`) | `routes/public/health_routes.py` (`GET /api/health` publik, payload kasar), `routes/settings/general_routes.py` (`GET /api/v1/kasir/settings/scheduler/status` admin), `services/health/` (`MIN_FREE_BYTES` 512 MB), `utils/scheduler_tasks.py` (`record_run`), guard disk di `services/backup/` & `run_auto_screenshots` | `Settings` |
| **Floor Plan / Visual Denah Meja** | `modules/dashboard/map_view.js` | `routes/pc/pc_routes.py`, `services/pc/` | `PC`, `Grup` |
| **CMS Artikel & Tutorial** | `modules/tutorials.js` | `routes/tutorial/`, `services/tutorial/` | `SystemTutorial` |
| **MikroTik Bandwidth QoS** | `modules/mikrotik.js` | `routes/mikrotik/`, `services/mikrotik/` | `MikroTikConfig` |
| **Turnamen eSports & Bracket** | `modules/tournament.js` | `routes/tournament/`, `services/tournament/` | `Tournament`, `TournamentMatch` |
| **Backup & Restore Database** | `modules/settings/settings_general.js` (`restoreBackup`) | `routes/backup/backup_routes.py`, `services/backup/backup_service.py` (snapshot Online Backup API + integrity check; restore via tombol Restore di daftar backup, wajib konfirmasi; `default_backup_dir()` menghormati env `BACKUP_DIR` untuk sandbox/test; restore menjalankan migrasi Alembic untuk DB berversi dan rollback ke backup pengaman bila migrasi gagal), `services/maintenance_mode.py` (gerbang maintenance berbasis hitungan konteks aktif sehingga restore yang tumpang tindih tidak membuka gerbang terlalu awal) | `Settings` (provider cloud) |
| **Auto-Update & Migrasi Skema** | `modules/settings/migration.js` | `routes/settings/migration_routes.py` (anti-SSRF whitelist, active session count, klaim tunggal `install_scripts/update_claim.py` + publikasi ZIP atomik via `.pending`/`os.replace`), `install_scripts/updater.bat` | Alembic skema, SQLite backups |
| **Client Security & API Key Guard** | `modules/dashboard/dashboard_compact.js` | `routes/auth/auth_routes.py`, `routes/client/client_routes.py`, `app/__init__.py:TMBillingCSRFProtect` (Bearer client API key validation & constant-time comparison, emergency login diotorisasi token server **atau** IP asal PC terdaftar via `hmac.compare_digest`) | `PC`, `ApiKeyMismatchStore` |
| **Receipt / Nota Anti-Collision Generator** | `modules/struk.js` | `services/transaksi/transaksi_service.py`, `services/menu/menu_service.py` (atomic microsecond timestamping + sequential fallback collision-free numbering) | `Transaksi`, `TransaksiMenu` |
| **Katalog Game & Crop Cover** | `modules/game/` | `routes/game/game_routes.py`, `services/game/` (katalog publik mendukung `limit`/`offset` opsional) | `Game`, `GameKategori` |
| **Tiket Servis & Perawatan PC** | `modules/maintenance/`, `modules/laporan_maintenance/` | `routes/maintenance/maintenance_routes.py`, `services/maintenance/` | `MaintenanceTicket` |
| **Uptime Tracker Meja PC** | `modules/uptime.js` | `routes/pc/pc_routes.py`, `services/cache/uptime_store.py` (flush hanya dari scheduler 60 detik; laporan eager load) | `PCUptimeLog` |
| **Owner Analytics & Tren** | `modules/owner.js` | `routes/report/`, `services/owner/` | `Transaksi`, `Sesi` |
| **Member, Saldo, & Refill** | `modules/member/` | `routes/member/member_routes.py`, `services/member/` | `Member` |
| **Paket Billing Jam-Jaman** | `modules/paket/` | `routes/paket/paket_routes.py`, `services/paket/` | `Paket` |
| **Staff Kasir/Admin & RBAC** | `modules/user/` | `routes/user/user_routes.py`, `services/user/` | `User` |
| **Screenshot Monitor PC** | `modules/screenshot/index.js` (cache daftar grup `_groupsCache`) | `routes/monitor/screenshot_routes.py` (`PCRepository.get_all_light()` tanpa hardware; identitas PC dari IP peer, gambar divalidasi Pillow dan dinormalkan PNG maks 1280 px di `instance/uploads/screenshots` privat; metadata dan byte hanya untuk admin, byte disajikan `GET .../screenshot/image/<int:pc_id>`), `services/cache/telemetry_store.py` (stat file di-cache 5 detik) | In-memory store |
| **Unit PC & Meja Klien** | `modules/pc.js`, `modules/pc/` | `routes/pc/pc_routes.py`, `services/pc/` (prefetch sesi aktif sekali query) | `PC`, `Grup` |
| **Log Mutasi Stok FnB** | `modules/menu/stock_log.js` | `routes/menu/menu_routes.py`, `services/menu/` | `MenuItem`, in-memory store |
| **Laporan Penjualan FnB** | `modules/laporan_menu.js` | `routes/menu/menu_routes.py`, `services/menu/` | `TransaksiMenu`, `MenuItem` |
| **Tab Data Diarsipkan** | `modules/arsip/index.js` (pills kategori), `core/arsip_list.js` (baris arsip bersama, juga dipakai pill `Aktif \| Diarsipkan` di tab grup/PC/paket/member/user/game dan arsip menu FnB) | `routes/arsip/arsip_routes.py` (agregat `GET /api/v1/kasir/arsip/`), `services/arsip/`, `repositories/arsip/`; pemulihan `POST /<resource>/<id>/restore` | `Grup`, `PC`, `Paket`, `Member`, `User`, `Game`, `MenuItem` |
| **Sticky Notes Antar Shift** | `modules/catatan.js` | `routes/notes/note_routes.py`, `services/notes/` | Scratchpad disk store |
| **Audit Log Terpusat** | `modules/log.js` | `routes/user/user_routes.py`, `services/user/`, `utils/logger.py` (file JSON `logs/warnet.log`, rotasi gzip; tanpa tabel DB) | — (file-based) |
| **Cetak Ulang Struk Kasir** | `modules/struk.js` | `routes/report/report_routes.py` (`get_struk`, `get_struk_menu`), `services/transaksi/` | `Transaksi` |
| **Server Health & LHM Telemetry** | `modules/server_monitor/server_monitor.js` | `routes/server_monitor/`, `services/server_monitor/` | Host sensors, LHM Engine |
| **Public Specs & Hardware Catalog** | `templates/public/specs/index.html` (compact 2-column mobile card grid, debounced search & modal controller fokus trio CPU, GPU, RAM) | `app/__init__.py:public_specs()` (minimalist structured catalog JSON tanpa telemetri berlebih, eager load PC/hardware/paket; hanya PC aktif dan status online dari heartbeat `OnlineStatusStore`) | `PC`, `HardwareMonitor`, `Grup` |
| **Frontend CPU & Zero-Thrashing** | `modules/dashboard/dashboard_compact.js`, `core/skeleton.js` | `templates/kasir/base.html` (semua script eksternal `defer`), `app/__init__.py` (cache 1 tahun immutable untuk `/static/js|css|vendor`), `tailwind.config.js` | Strict dirty-checking, zero infinite keyframe loops, guard anti-tumpuk & jeda polling saat tab hidden; throttle 2 detik untuk tab monitor & screenshot |
| **Responsive Tailwind Reflow** | `modules/dashboard/dashboard_compact.js`, `core/modal.js` | `templates/kasir/base.html`, `templates/kasir/components/navbar.html`, `sidebar.html` | Pure Tailwind Breakpoints (`< sm`, `sm`, `md`, `lg`, `xl`, `2xl`), `max-h-[90dvh]`, zero horizontal overflow across all 38 views (30 kasir tabs, 8 public portals); semua tab kasir non-dashboard memakai lebar maksimum `80rem` dan terpusat, dashboard tetap full-width |

---

### 7. Perintah Cepat Pengujian & Build (Fast Commands)

Jalankan perintah-perintah berikut langsung di terminal atau command prompt:

```bash
# Menjalankan unit test pytest spesifik
.venv\Scripts\python.exe -m pytest tests/test_monitor_vnc_routes.py -v

# Menjalankan seluruh test suite (serial)
.venv\Scripts\python.exe -m pytest tests/ -v

# Install dev-only test runner (pytest-xdist)
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# Seluruh unit test memakai semua core (per-worker DB/temp/backup/notes)
npm run test:unit

# Pencarian literal all-core (default semua core; SEARCH_WORKERS=1 untuk serial)
.venv\Scripts\python.exe scripts\allcore_search.py "pola1|pola2" app tests

# Upgrade dependensi Python di dalam .venv (--latest menulis ulang pin requirements.txt)
.venv\Scripts\python.exe scripts\upgrade_packages.py --check
.venv\Scripts\python.exe scripts\upgrade_packages.py --latest

# Cek sintaks JavaScript dengan Node.js
node -c app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js

# Compile ulang aset CSS Tailwind (minified)
npm run build:css

# Memulai server development
python run.py

# Kompilasi ulang seluruh biner deploy klien & server
build_and_deploy.bat

# Menjalankan Master Runner E2E Sandbox Terisolasi (Zero Database Mutation Guarantee)
# 15 suite Chromium sungguhan (Playwright): 385 check, paralel otomatis semua CPU
npm run test:e2e
# atau langsung via Python: .venv\Scripts\python.exe tests/e2e/run_all_e2e.py
# Serial untuk debug: .venv\Scripts\python.exe tests/e2e/run_all_e2e.py --jobs 1

# Menjalankan satu suite saja (reseed + restart sandbox per suite)
.venv\Scripts\python.exe tests/e2e/run_all_e2e.py --suite pc_billing
# Daftar suite: --list  |  Output JSON: --json tests/e2e/results/

# Menjalankan Sandbox Server Standalone Port 7016 untuk pengetesan interaktif Playwright
npm run test:e2e:sandbox
# atau langsung via Python: .venv\Scripts\python.exe tests/e2e/e2e_sandbox_server.py --standalone 7016
```

> **Aturan eksekusi lokal:** setiap tugas agent di shell (pencarian, baca/tulis massal, PowerShell, test, build, audit) WAJIB memakai seluruh core CPU bila alatnya mendukung. Contoh: `rg --threads 0` atau `git grep --threads 16`, `npm run test:unit` (`pytest -n auto`), `npm run test:e2e` (`--jobs 0`), `npm run build`, `robocopy /MT:16`, `7z -mmt=16`, `cargo -j 16`, serta beberapa perintah independen yang dijalankan bersamaan. PowerShell 5.1 tidak punya `ForEach-Object -Parallel`; untuk bulk operation gunakan `scripts/allcore_search.py` (pencarian) atau helper Python `ProcessPoolExecutor`. Jangan menjalankan serial kecuali sedang men-debug kegagalan atau pekerjaannya memang tidak bisa diparalelkan.
>
> **Batas aman:** paralelkan hanya pekerjaan yang independen per target (per file, per suite, per command). Operasi yang berbagi state tetap serial: tulis database, migrasi, backup/restore, `git add/commit` (index dan HEAD), dua proses yang menulis file/output sama, dan perintah tunggal yang selesai dalam hitungan milidetik (overhead spawn lebih mahal daripada kerjanya). `pytest` paralel sudah aman lewat `npm run test:unit`: `conftest.py` memberi setiap worker DB, temp, backup, dan notes sendiri.

### 7.1 Peta Suite E2E (`tests/e2e/`)

Runner Chromium sungguhan (Playwright) dengan sandbox terisolasi; setiap suite dijalankan pada database baru di `instance/e2e/<suite>/warnet.db`, port dinamis, serta catatan/backup per suite. Guard memeriksa `instance/warnet.db` (sha256+rowcount), `backups/`, `instance/notes/`, `.env`, dan `initial_admin.txt`.

| Berkas | Tanggung Jawab |
|---|---|
| `tests/e2e/run_all_e2e.py` | Orkestrator paralel process-per-suite: `--jobs 0` semua CPU / `1` serial, snapshot guard produksi (DB, `backups/`, `instance/notes/`, `.env`, `initial_admin.txt`), exit code nyata, `--list/--suite/--no-guard/--self-test`. |
| `tests/e2e/run_all_e2e.js` | Registry suite + CLI Node; memuat `lib/browser.js`. |
| `tests/e2e/e2e_sandbox_server.py` | Sandbox per suite: path `instance/e2e/<suite>/`, port dinamis, Waitress `tests.e2e.sandbox_app:create_app`, `TM_NOTES_DIR`/`PROJECT_ROOT`/`BACKUP_DIR`/`E2E_INSTANCE_PATH`/`E2E_API_LOG`/`TEMP` terisolasi, menulis `routes.json` dari `url_map`, proses dibungkus Job Object Windows. |
| `tests/e2e/sandbox_app.py` | Factory sandbox: meneruskan `INSTANCE_PATH` dari env `E2E_INSTANCE_PATH` dan mencatat `endpoint method` tiap request ke `E2E_API_LOG` (dipakai gerbang cakupan). |
| `tests/e2e/check_coverage_gate.py` | Gerbang cakupan: membandingkan `routes.json` dengan `requests.log` semua suite dikurangi `api_exempt.EXEMPT`; cetak `GATE LULUS`/`GATE GAGAL` (exit 1). |
| `tests/e2e/api_exempt.py` | Rute yang sah tidak dipanggil dari sandbox (proses/jaringan nyata) beserta alasannya. |
| `tests/e2e/seed_e2e_data.py` | Seed deterministik (admin/kasir1, member1..3 + member_expired, 5 PC, paket, menu, tutorial, transaksi historis). |
| `tests/e2e/lib/browser.js` | Driver Chromium, `BASE_URL`, deteksi binary Playwright hilang. |
| `tests/e2e/lib/harness.js` | `login/logout/tab/settingsTab/api/clientPoll/hardwarePost/waitFor/unique/check`. |
| `tests/e2e/lib/db.js` | `dbQuery/dbExec` via `.venv` sqlite3; path dari `E2E_SANDBOX_DB`, menolak `instance/warnet.db`. |
| `tests/e2e/lib/report.js` | Kontrak laporan `{total,passed,failed,checks[]}`. |
| `tests/e2e/lib/coverage_manifest.js` | 30 tab container + 10 sub-tab settings + 8 portal, pemilik suite per tab. |
| `tests/e2e/test_e2e_backup_restore.js` | Suite `backup_restore`: backup → mutasi → restore di sandbox, validasi admin/konfirmasi/404/403, dan guard folder `backups/` produksi tidak berubah. |
| `tests/e2e/test_e2e_*.js` | 15 suite: `pc_billing`, `fnb_pos`, `member_paket`, `auth_shift_notes`, `hardware_maintenance_remote`, `tournament_game`, `settings_admin_logs`, `backup_restore`, `public_portals_cms`, `coverage`, `perf_invariants`, `update_restore` (klaim update, restore DB, tukar berkas + pemulihan jurnal), `screenshot_whitelist` (screenshot privat + revalidasi role), `analytics_cleanup` (top paket tanpa baris siklus hidup + guard hapus tanggal), `route_smoke` (semua rute sisa agar gerbang cakupan lulus). |

---

## 🔄 Aturan Pemeliharaan Dinamis (Dynamic Maintenance Rule)

> [!IMPORTANT]
> **ATURAN WAJIB BAGI SETIAP AGENT AI**:
> 1. Setiap kali Anda menambahkan folder baru, file baru, modul baru, endpoint API baru, atau memindahkan arsitektur kode pada repositori ini:
>    **Anda WAJIB memperbarui pemetaan tabel pada AGENTS.md ini.**
> 2. Peta ini adalah referensi langsung agar sesi baru agent AI di masa mendatang dapat langsung memahami konteks proyek secara instan tanpa perlu eksplorasi redundan.
> 3. Jaga agar deskripsi direktori dan tautan berkas selalu sinkron dengan kondisi *working tree* terkini.

---

## 📜 Panduan Operasional & Praktik Terbaik Agent (Portable Best Practices)

### 1. Prinsip Utama (Core Principle)
- Semua instruksi harus kontekstual dan adaptif terhadap repositori aktif.
- Jangan berasumsi bahwa arsitektur atau teknologi repositori lain berlaku di repositori ini.
- Terapkan solusi yang minimalis, rapi, dan menjaga backward-compatibility.

### 2. Berpikir dalam Kode (Think in Code)
- Untuk analisis data, pencarian menyeluruh, parsing, perbandingan, atau transformasi skrip:
  Jalankan skrip pembantu (Node.js atau Python) secara lokal dan cetak hanya kesimpulan/hasil yang relevan, daripada membuang ribuan baris teks mentah ke dalam konteks percakapan.
- Tangani error dengan blok `try/catch` atau `try/except` yang kokoh.

### 3. Operasi Repositori & Berkas
- **Sebelum Mengedit**: Periksa file yang relevan, telusuri alur pemanggilan fungsi, dan pahami dependensi antar komponen.
- **Saat Mengedit**: Ubah hanya baris/komponen yang berkaitan langsung dengan tugas. Hindari refactoring massal yang tidak diminta.
- **Setelah Mengedit**: Lakukan validasi sintaks dan jalankan automated test terkait untuk menjamin tidak ada regresi.

### 4. Konteks Khusus TMBilling
- **Backend**: Flask 3.1.3 + Python 3.11+ (ORM SQLAlchemy 2.1).
- **Frontend**: Vanilla ES6 JavaScript Modular (tanpa Webpack/Vite bundler runtime pada dashboard kasir).
- **Client**: Rust Tauri 1.5 + C# / C++ watchdog daemons.
- **Database**: SQLite (`warnet.db` produksi / `test_warnet.db` unit test).
- **Single Source of Version**: `app/config.py` (`Config.VERSION`).
- **Cache Transient**: Seluruh data yang sering di-polling klien WAJIB melalui in-memory store di `app/services/cache/` untuk melindungi disk SQLite.

### 5. Arsitektur & Standar Performa Frontend Kasir (Zero CPU Thrashing)
Untuk menjaga agar penggunaan CPU browser (Brave, Chrome, Edge) tetap sangat rendah (< 2%) saat idle dan monitoring dashboard:
- **Zero Infinite Keyframe Loops**: DILARANG menambahkan CSS keyframes looping tak berhingga seperti `pulse-*-bg`, `animate-ping`, `animate-pulse`, `animate-modal-in`, `animate-in`, `fade-in`, atau `zoom-in`. Status darurat meja (Terputus, API Key Salah, LAN Drop, Hardware Swapped) WAJIB menggunakan badge visual solid berkontras tinggi dan teks tegas (`[ ⚠️ TERPUTUS ]`, `[ 🔑 KEY TIDAK COCOK ]`, `[ ⚠️ LAN 100M ]`) tanpa animasi berkedip.
- **Zero Compositing Blur Filter**: DILARANG menggunakan CSS filter `backdrop-blur-*` dan `hover:brightness-*` pada modal overlay atau kartu meja. Modal overlay WAJIB menggunakan solid dark semi-transparan (`bg-black/90` atau `bg-black/95`) untuk mencegah GPU/CPU convolution composite pass berulang.
- **Strict Dirty-Checking pada Polling**: Setiap fungsi update berulang (seperti `syncLiveCards` setiap 1 detik) WAJIB membandingkan nilai sebelum menyentuh DOM (`textContent`, `className`, `innerHTML`, `style`). Mutasi DOM hanya boleh dieksekusi bila terdapat perbedaan nilai riil.
- **Static Skeletons**: Seluruh placeholder loading skeleton di 31 tab dan `skeleton.js` menggunakan balok statis netral (`bg-[#202020]` atau `bg-neutral-800`) tanpa animasi denyut `animate-pulse`.

### 6. Komunikasi
- Respon selalu menggunakan **Bahasa Indonesia** kecuali jika diminta lain oleh pengguna.
- Lugas, teknis, praktis, dan langsung pada pokok permasalahan.
- Paparkan alasan teknis di balik setiap keputusan arsitektural atau perbaikan bug.

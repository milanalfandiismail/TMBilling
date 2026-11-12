# Changelog

Semua perubahan penting dan rekam jejak rilis pada proyek **TMBilling** didokumentasikan dalam berkas ini.

Format pencatatan mengikuti panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan menganut [Semantic Versioning](https://semver.org/lang/id/).

---

## [Unreleased]

### Perbaikan Migrasi Skema Saat Update (2026-11-12)
- **Update Gagal pada Instalasi Baru**: `install_scripts/run_migration.py` tidak lagi memutar ulang seluruh migrasi pada database hasil `db.create_all()`; bila skema sudah identik dengan metadata model, revisi langsung di-`stamp` ke `head` sehingga `updater.bat` tidak berhenti di `:fail` karena `duplicate column name: operator`.
- **Migrasi Idempoten**: migrasi `f3a1b2c4d5e6` (kolom `operator`) dan `b7e2c91a4f01` (kolom peripheral/CCTV) memeriksa kolom yang sudah ada sebelum menambah/menghapus, dan migrasi `8f7e6d5c4b3a` tidak lagi me-recreate tabel `game` hanya untuk melebarkan `kategori` (SQLite tidak menegakkan panjang `VARCHAR`).
- **Index RC2 pada Database Hasil `db.create_all()`**: safety net `run_migration.py` memasang ulang `uq_aktif_shift`, `uq_aktif_sesi_pc`, `uq_aktif_sesi_member`, `ix_transaksi_menu_tanggal`, `ix_transaksi_member_id`, `ix_transaksi_user_id`, dan `ix_sesi_mulai_pada` secara idempoten, sehingga database v1.6.5-rc1 yang di-`stamp` head tanpa melewati migrasi tetap mendapat proteksi dua shift aktif dan index performa.
- **Instalasi Baru Langsung Ber-revisi `head`**: `install_scripts/init_db.py` melakukan `stamp` ke `head` setelah `db.create_all()`, sehingga database instalasi baru sudah mencatat revisi Alembic terbaru dan `flask db upgrade` tidak memutar ulang migrasi lama.

### Remediasi Audit Keamanan & Integritas Finansial (2026-11-07)
- **Refund & Masa Aktif Member**: refund member memanggil `cek_kadaluarsa()` lebih dulu (menolak saldo yang sudah hangus), tanggal kadaluarsa hasil refund di-clamp ke waktu sekarang (tidak lagi menjadi `None`/abadi), dan klaim refund atomik `TransaksiRepository.claim_refund()` mencegah nota refund ganda saat request bersamaan.
- **Token Darurat Tidak Lagi Bocor ke Client**: `GET /api/v1/kasir/settings/uninstall-token/client` hanya mengembalikan `uninstall_token`; `emergency_token` server tidak pernah dikirim lagi. Emergency login diterima bila token server valid **atau** IP asal request sama dengan `ip_address` PC terdaftar (`hmac.compare_digest`).
- **Kredensial Darurat Fail-Closed**: Semua fallback `TMBilling` / `TM123qaz!@#` dihapus dari Tauri, MGCTM, mtm, TMonitor, dan Uninstaller serta `config.ini` dikosongkan. Jalur darurat offline hanya aktif bila operator mengisinya; `install.bat` membangkitkan password acak 24 karakter dan mencetaknya ke konsol bila prompt dikosongkan.
- **Refund Paket Nominal Penuh**: Refund guest dan member mengembalikan nilai penuh transaksi (`-jumlah`) sambil memotong durasi/menit yang tersisa (guest dibatasi `min(durasi, sisa_menit)`, member `max(0, saldo - durasi)`); durasi 0 ditolak.
- **Satu Sesi Aktif per PC**: Migrasi `uq_aktif_sesi_pc` (unique index parsial `pc_id` WHERE `status='aktif'`) mencegah dua sesi guest pada satu meja; `IntegrityError` dipetakan menjadi `ValueError("PC sedang dipakai")`.
- **Nomor Nota Anti-Loop**: Generator nota memakai `MAX(CAST(substr(no_nota, ...) AS INTEGER))` (`get_max_nota_seq`) sehingga tidak lagi menjalankan loop query saat nota terakhir terhapus.
- **Unduhan Database Aman WAL**: `/settings/backup/download` memakai snapshot SQLite Online Backup API + `PRAGMA integrity_check` ke file sementara yang dihapus via `after_this_request`.
- **Update Server Atomik**: `extract_update.py` mengekstrak ke `instance/staging_update` lalu menukar berkas per entri top-level dengan `os.replace`; kegagalan memicu rollback dari `instance/rollback_<timestamp>`.
- **XSS Pengumuman Kiosk**: `SafeHTMLParser` memakai allowlist protokol (`http://`, `https://`, `mailto:`, `/`, `#`, `data:image/`) setelah normalisasi karakter kontrol; sanitasi dijalankan saat simpan dan saat `get_warnet_config`.
- **Login Throttle & Logout Ber-token**: `services/auth/login_throttle.py` membatasi 5 kegagalan per (IP, username) dalam 5 menit (HTTP 429) dan auto-whitelist IP admin dihapus; logout menolak request tanpa token sesi.
- **VNC Non-Blocking & Terproteksi**: Semua route VNC wajib login + admin, start membalas 202 dengan polling `poll_vnc_result`, token proxy acak `secrets.token_urlsafe(24)`, reaper hanya mematikan proxy PC offline.
- **Ringkasan Shift Lintas Kasir**: Filter `user_id`/`kasir_id` dihapus dan clamp `max(0, ...)` dihilangkan sehingga selisih negatif (refund berlebih) terlihat; blackout menyimpan `sisa_audit`, bukan jam berjalan.
- **Job Cloud & Tunnel**: 11 panggilan `urlopen` provider backup memakai `timeout=30`; direktori log `cloudflared` diperbaiki (sebelumnya `TUNNEL_DIR` tidak terdefinisi).

### Pengerasan Putaran 2 (2026-11-07)
- **Serialisasi Tulis Billing**: modul baru `app/services/write_lock.py` (`WRITE_LOCK`) membungkus `SesiService.tambah_waktu_sesi`, `MemberService.tambah_waktu`, dan `MemberService.refund_paket` sehingga dua request bersamaan tidak saling menimpa durasi/saldo (read-modify-write) pada satu proses Waitress.
- **Validasi Batch Dua Fase**: `POST /api/v1/kasir/sesi/tambah-waktu-batch` memvalidasi seluruh paket lebih dulu; bila salah satu paket tidak ada, sesi tidak tertagih sebagian.
- **Index & Migrasi Baru**: model `Sesi` memakai `uq_aktif_sesi_pc` (partial unique index), migrasi `d3e4f5a6b7c8` menambah `ix_transaksi_member_id`, `ix_transaksi_user_id`, dan `ix_sesi_mulai_pada`.
- **Integritas Blackout**: `sesi.selesai_pada` pada deteksi memakai waktu referensi (`last_sync`/`mulai_pada`), sesi guest yang dipulihkan mengisi `selesai_pada`, dan `resolve_member` menolak member yang masih punya sesi aktif serta tidak menghidupkan saldo yang sudah kadaluarsa.
- **Hapus Riwayat Menyeluruh**: `LogAuditService.clear_all_transactions`/`clear_transactions_by_date` kini juga menghapus `TransaksiMenu`; nota pembelian paket ditolak dihapus (400) dan harus lewat Refund.
- **Arsip Pra-Purge Aman**: `DBMaintenanceService` memakai `default_backup_dir()` + snapshot Online Backup API + `PRAGMA integrity_check` (bukan `copy2` berkas WAL).
- **Throttle Login Diperluas**: `admin-check`, `client/admin-login`, dan `/member/login` memakai `login_throttle`; pesan gagal portal member diseragamkan, dan setiap login sukses memanggil `session.clear()`.
- **Batas Unggah & Nama Screenshot**: `MAX_CONTENT_LENGTH = 64 MB`; `_screenshot_filename()` membuang pemisah path sebelum `secure_filename` (`PC/01` → `PC01.png`).
- **Endpoint Khusus Admin**: hapus audit blackout `/clear` dan start/stop TMLHMService memakai `@admin_required`.
- **Higiene Resource**: unduhan `cloudflared` memakai `timeout=30`; `PCService.delete` memanggil `cleanup_pc_cache()` agar cache RAM PC terhapus ikut bersih.
- **Analitik Paket Terhapus**: `OwnerAnalyticsService.get_top_paket` mengelompokkan per `paket_id` dan memberi label "Paket dihapus" alih-alih membuang transaksi paket yang sudah dihapus.
- **Token Klien**: `GET /api/v1/kasir/settings/` tidak lagi mengembalikan default `TM2026QWERTY-api-key`; `/uninstall-token/client` menolak (403) request dari IP yang bukan PC terdaftar; `install.bat` membangkitkan API key acak bila prompt dikosongkan.

### Keamanan & Perbaikan Bug
- **Redaksi Setting Sensitif**: `GET /api/v1/kasir/settings/` kini hanya mengembalikan `payment_methods` dan `vnc_password` untuk role kasir; kredensial lain (`client_api_key`, `mikrotik_password`, token, kredensial backup) khusus role admin.
- **Emergency Login Berbasis Token atau IP**: Endpoint emergency login menolak request tanpa `emergency_token` server yang sah **kecuali** berasal dari IP PC terdaftar; bypass loopback dihapus. Client Tauri tidak lagi mengirim token server (diperbarui oleh remediasi 2026-11-07).
- **Token Klien Tanpa Default Hardcoded**: Token emergency & uninstall kini dibuat acak (`secrets.token_urlsafe(32)`) dan disimpan di database. Nilai lama di database tetap dipakai apa adanya.
- **Atribusi Transaksi**: Operator tak dikenal tidak lagi dibebankan ke admin pertama; checkout kantin menolak kasir yang tidak valid.
- **Ringkasan Shift Read-Only**: `GET /summary` tidak lagi menulis ke database; force close menyimpan `uang_fisik`/`selisih` kosong (frontend menampilkan `-` / `(Penutupan Paksa)`) alih-alih menganggap PAS, dan struk handover mencetak `BELUM DIHITUNG`.
- **Stok Kantin Atomik**: Pengurangan stok memakai satu `UPDATE ... WHERE stok >= jumlah` untuk mencegah oversell saat checkout bersamaan.
- **Backup Konsisten & Restore Tanpa Restart**: backup kini memakai SQLite Online Backup API + `PRAGMA integrity_check` (data di `-wal` ikut tersalin dan arsip rusak ditolak sebelum tersimpan), path database diturunkan dari engine aktif (bukan hardcode `instance/warnet.db`), dan admin dapat restore langsung dari daftar backup (`POST /api/v1/kasir/backup/restore/<filename>` wajib `{"confirm": true}`; backup pengaman dibuat otomatis sebelum restore).
- **Bersih-Bersih**: Menghapus CLI `--release` pada `run.py` (rusak: `UnboundLocalError`, ekstraksi ZIP tanpa proteksi path traversal, tidak pernah menyalin payload) dan route ringkasan shift duplikat yang tidak terjangkau.
- **Health Check & Guard Sumber Daya**: `GET /api/health` publik melaporkan `db`/`disk`/`backup` secara kasar (tanpa angka/path, tetap HTTP 200 saat `degraded`); backup menolak berjalan saat sisa disk < 512 MB; screenshot otomatis dilewati dengan alasan di log; status eksekusi terakhir tiap job scheduler tampil di tab Settings (khusus admin).
- **Hapus Fitur File Explorer**: Modul, route, service, template, menu sidebar, API frontend, dan test terkait dihapus seluruhnya (tidak ada migrasi database; tidak ada tabel/model khusus).

### UI & Tata Letak
- **Tab Berat Masuk Area Scroll**: `mikrotik`, `settings`, `plugins`, dan `analytics` tidak lagi dirender di bawah halaman akibat `</div>` prematur di `index.html`; kontennya kini berada di dalam `#main-scroll` dan dibatasi `max-w-7xl`/`max-w-5xl` serta dipusatkan.
- **Paket Billing**: daftar paket dibatasi 8 baris per halaman pada breakpoint `lg`, `xl`, dan `2xl`; breakpoint lebih kecil tetap 7/5 baris.
- **Analitik Owner**: panel KPI tidak lagi memakai `max-height`/scroll internal (`setScroll` dihapus), sehingga kartu memanjang natural.
- **Scrollbar & Log**: scrollbar global mengikuti tema gelap (`color-scheme: dark`, thumb `#333`); badge kategori Log Sistem memakai latar netral dengan aksen teks, bukan latar warna pekat.
- **Whitelist IP**: tabel daftar IP memakai `table-fixed` + `colgroup` pada `lg`/`xl`/`2xl` agar pas lebar tanpa scroll horizontal; perilaku mobile tetap.
- Enam check E2E baru di suite `settings_admin_logs` mencakup nesting/centering, batas 8 paket, panel analitik, scrollbar, badge log, dan fit tabel whitelist.
- **Shell Tab Terpusat**: semua tab kasir non-dashboard memakai `max-width: 80rem` + `margin-inline: auto` pada semua breakpoint; dashboard tetap full-width dan MikroTik tetap `max-w-5xl`. Satu check E2E baru di suite `coverage` memverifikasi pusat konten pada 1024/1280/1536/1920 px.
- **Hardware Checker Fit**: tabel hardware checker memakai `table-layout: fixed` pada `lg`/`xl`/`2xl` dengan lebar kolom per breakpoint, sehingga tidak ada scroll horizontal; layout lebar `2xl` tetap menampilkan seluruh kolom dan header panjang boleh wrap. Satu check E2E baru memverifikasi 1024/1280/1536/1920 px.

### Performa & Optimasi
- **Heartbeat Klien**: `sesi.last_sync` kini disimpan tiap 30 detik (`ClientService.HEARTBEAT_PERSIST_SECONDS`) sehingga deteksi blackout berlaku untuk sesi guest; penulisan `pc.last_activity` per poll tanpa commit dihapus (poll turun dari 5 statement menjadi 3 SELECT tanpa UPDATE).
- **Jalur Panas**: Eager load hardware/PC/grup pada tab monitor, cache stat file screenshot 5 detik, batch sesi portal member publik, katalog `/spesifikasi` bebas N+1, arsip menu satu query `GROUP BY`, prefetch sesi aktif pada daftar PC, dan pagination opsional katalog game publik.
- **Infrastruktur**: `SettingsCacheStore.update_dict` ditambahkan (mencegah error 500 saat tabel settings kosong) dan warmup dijalankan di luar lock; `ProcessMemoryStore` diberi TTL 300 detik; rebuild `PCNetworkCacheStore` di luar lock; logger tanpa `print` per entri dan membaca ekor file saja; guard anti-tumpuk serta jeda polling saat tab dashboard disembunyikan.
- **Dashboard**: `Dashboard.updateStats()` tidak lagi memanggil `API.report.harian()` (blok mati karena elemen `stat-*` tidak ada di template); omzet dibaca dari payload dashboard dan jumlah sesi aktif memakai `SesiRepository.count_aktif()` (4,1 ms menjadi 0,2 ms pada 200 sesi).
- Index `ix_transaksi_menu_tanggal` untuk filter tanggal FnB yang dipanggil tiap detik.
- Status billing PC di-cache di `UptimeMemoryStore`; telemetri tidak lagi query sesi per tick.
- Laporan uptime tidak menulis database di jalur GET dan memakai eager load PC/grup.
- Daftar member eager load grup & sesi (dua query tetap, bukan satu per member).
- `sync_waktu_member` tidak commit sendiri; ikut commit heartbeat 30 detik.
- Settings yang tidak ada di-cache negatif (1 query untuk banyak pemanggilan).
- Payload TV di-cache 5 detik.
- Tab monitor & screenshot melewati polling silent yang lebih rapat dari 2 detik;
  polling status Cloudflare Tunnel menjadi 1 detik.

### Dependensi & Build
- **Backend Python**: pin dinaikkan ke SQLAlchemy 2.1.8, ReportLab 5.1.0, APScheduler 3.11.3, Flask-WTF 1.3.0, Werkzeug 3.1.9, flask-cors 6.0.5, waitress 3.0.2, websockify 0.13.0, greenlet 3.5.6, MarkupSafe 3.0.4, python-dotenv 1.2.4, typing_extensions 4.16.0. Batas bawah Python menjadi **3.11+** (syarat SQLAlchemy 2.1). Custom `TMBillingCSRFProtect.protect()` disesuaikan dengan signature Flask-WTF 1.3 (`apply_exemptions`).
- **Frontend Build**: TailwindCSS 4.3 (`@tailwindcss/cli`, `@import "tailwindcss" source(none)` + `@source` eksplisit), FontAwesome Free 7.3.1 (seluruh 53 ikon yang dipakai tersedia), dan shim kompatibilitas v3 untuk warna border, cursor tombol, serta placeholder. `@tauri-apps/cli` root yang tidak terpakai dihapus; CSS hasil build kini 194 KB (mekanisme `@property`/OKLCH v4). Prasyarat baru: Node.js 20+ untuk build CSS dan browser dashboard Chrome/Edge 111+.
- **Jalur Upgrade**: semua metode update (sidebar Migrasi & Update, GitHub 1-klik, `update.bat`) melewati `install_scripts/updater.bat` yang kini: memvalidasi Python 3.11+ **sebelum** menyentuh berkas; menghentikan server lewat proses background maupun pemilik port 7015 dan **membatalkan tanpa mengubah berkas** bila port masih hidup; membatalkan ekstraksi bila backup database gagal; mempertahankan ZIP bila ekstraksi gagal; menyalakan ulang server otomatis saat gagal; serta memasang dependensi **sebelum** migrasi. `stop.bat` juga kini menghentikan proses `run.py`/pemilik port 7015 dan memverifikasi port benar-benar lepas. Backup pra-update memakai SQLite Backup API sehingga transaksi di `-wal` tidak hilang. Tidak ada migrasi skema baru; database dan `.env` tetap dipertahankan.
- **Paritas Visual**: probe computed-style pada dashboard, POS, settings, dan landing menunjukkan warna setara (OKLCH), border `gray-200` tetap, cursor tombol tetap pointer; perbedaan yang diterima: `shadow-sm` kini setara `shadow` v3 dan `outline-none` menjadi `none/3px` (keduanya tidak terlihat berubah).

### Pengujian E2E
- **Suite Chromium Nyata**: `npm run test:e2e` kini menjalankan 11 suite Playwright (335 check) terhadap sandbox terisolasi, dengan guard sha256 + jumlah baris `instance/warnet.db`, reseed database per suite, dan exit code yang benar-benar gagal saat ada check merah. Perintah npm memakai `.venv\Scripts\python.exe` agar tidak bergantung pada Python global. Runner lama yang mencetak total hardcoded `382 PASSED` tanpa menjalankan test dihapus.
- **Cakupan**: 31 tab container kasir, 10 sub-tab settings, 8 portal publik, plus alur billing, POS kantin, member/paket/grup, shift & rekonsiliasi kas, telemetri hardware & anti-maling, turnamen, RBAC/redaksi setting, blackout & emergency login, serta invarian zero-thrash dan reflow responsif (234 sel).
- **Isolasi**: direktori catatan sandbox dipisah lewat `TM_NOTES_DIR`; proses Waitress sandbox dibungkus Windows Job Object sehingga port 7016 tidak tertinggal.
- **Suite Backup & Restore**: suite `backup_restore` (8 check) memicu backup nyata, memutasi data, lalu restore tanpa restart di sandbox; folder `backups/` produksi diverifikasi tidak berubah dan guard sha256 database produksi tetap lulus.
- **Bug Produk Ditemukan & Diperbaiki**: member dengan `kadaluarsa_pada` lampau kini ditolak saat login portal (`403 Masa aktif member sudah kadaluarsa`); dua kelas `animate-in` sisa di modal dashboard dan overlay screenshot dihapus sesuai aturan zero-thrash.

---

## [1.6.5-rc2] - 2026-11-01 - Release Candidate 2

### Keamanan & Perbaikan Bug
- **Validasi API Key Menyeluruh pada Endpoint Member Client & Hardware Monitor**:
  - Memproteksi rute `/api/v1/public/auth/login`, `/logout`, dan `/status` dengan decorator `@api_key_required`.
  - Memperbaiki fungsi `member_login` pada client Tauri agar menyertakan header `X-Client-Key`.
  - Memproteksi rute `/api/v1/public/monitor` dengan `@api_key_required` untuk mencegah telemetry dari client tanpa API key yang sah menandai PC aktif.
- **Deteksi Mismatch API Key & Visual Alert Khusus pada Dashboard**:
  - Menghadirkan in-memory store `ApiKeyMismatchStore` untuk melacak IP dan PC yang mengalami penolakan API key.
  - Menandai PC dengan status koneksi `api_key_mismatch` (`online: False`) agar kartu meja tidak menyala online secara keliru.
  - Menghadirkan visual alert bertema warna **Fuchsia / Magenta** (`pulse-fuchsia-bg`, `text-fuchsia-400`, `KEY SALAH`, `🔑 KEY TIDAK COCOK`) yang eksklusif dan berbeda dari warna status lainnya (merah terputus, hijau aktif, oranye admin/afk).
- **Pencegahan Race Condition Sesi Member**:
  - Menambahkan pengecekan sesi aktif member dan migrasi SQLite partial index `uq_aktif_sesi_member` untuk menolak double-click pembukaan sesi secara atomik.
- **Pembersihan Silent Exceptions & Resilience**:
  - Menghilangkan `except: pass` pada middleware auth dan rute client API key mismatch dengan pencatatan audit log terstruktur.
  - Memperkuat alur migrasi database (`migration_routes.py`) dengan pembersihan berkas sementara ZIP terpusat (`_safe_remove_temp`) dan logging error.
- **Pembaruan Sistem Otomatis 1-Klik**:
  - Integrasi fitur cek rilis GitHub dan runner updater mandiri anti file-locking Windows (`updater.bat`).
- **Perbaikan False Alarm Hardware Checker & Anti-Theft Cold Boot**:
  - Mengeliminasi false positive `Model GPU berubah (ke 'Unknown')` saat boot dengan mengabaikan nilai placeholder `Unknown` dan menerapkan proteksi grace period 60 detik pada model GPU.
  - Memastikan jika PCI PNP ID kartu fisik sama persis dengan baseline, status pembacaan nama sementara tidak memicu alarm pencurian.
  - Menghadirkan deteksi reboot otomatis pada `OnlineStatusStore` dan `AntiTheftGraceTracker` saat PC online kembali setelah offline (> 15 detik) untuk menjamin grace period 60 detik selalu aktif.
  - Mencegah penimpaan cache nama hardware valid di database dengan string `Unknown`.
  - Menambahkan sinkronisasi cold boot wait (maks 3 detik) pada agen `TMMonitor.exe` agar menunggu `hardware_temp.json` dari `HardwareHelper.exe` selesai dibuat sebelum mengirim telemetri perdana.

### Optimasi Performa & Refactoring
- **Batch Flush Uptime (Eliminasi N+1 Queries)**:
  - Mengubah kalkulasi akumulasi `UptimeMemoryStore.flush_to_database()` dari N+1 query loop tunggal menjadi satu `WHERE pc_id IN (...) AND tanggal IN (...)` bulk-fetch.
- **Dekomposisi Modular Rute Monitor**:
  - Memisahkan file monolitik `monitor_routes.py` menjadi 4 modul terfokus: `monitor_routes.py` (telemetri & hardware baseline), `remote_action_routes.py` (AFK lock/unlock, shutdown, restart batch), `screenshot_routes.py` (capture & upload screenshot), dan `vnc_client_routes.py` (proxy VNC client).
  - Mengonsolidasikan kode duplikat handler hardware, penghapusan, dan kill process.
- **In-Memory Cache TTL Pruning**:
  - Menambahkan auto-pruning entri usang (> 5 menit) pada `ApiKeyMismatchStore` untuk mencegah akumulasi memori.
- **Optimalisasi Query Laporan Finansial Owner**:
  - Membatasi kueri analitik member trend dengan filter tanggal atas-bawah yang ketat di level database dan normalisasi timezone range otomatis.

## [1.6.5-rc1] - 2026-10-24 - Release Candidate 1

### Diperbaiki
- **Interaktivitas Menu Stok Habis (Out-of-Stock Restock)**:
  - Memperbaiki tombol aksi kartu produk di katalog kasir sehingga tombol **Restock**, Edit, dan Hapus tetap dapat diakses saat stok mencapai `0`.
  - Mengubah badge pasif `Habis` menjadi tombol interaktif **`+ Restock`** yang dapat langsung diklik oleh Kasir (shift aktif) dan Admin untuk menambah stok barang secara instan.
  - Memperbaiki aksi klik kartu menu berstok 0 agar langsung membuka modal Restock disertai notifikasi toast panduan.
  - Menjaga integritas keranjang kasir dari penambahan item yang stok fisiknya habis.
- **Standarisasi Rilis Semantic Versioning**:
  - Mengubah skema rilis dan cabang git menjadi `v1.6.5-rc1` sebagai Release Candidate sebelum rilis stabil `v1.6.5`.

## [1.6.5] - 2026-10-18 - Autonomous Offline Studio

### Ditambahkan
- **Arsitektur 100% Pure Offline & Local Vendor Management**:
  - Mengintegrasikan seluruh dependensi frontend pihak ketiga (`@fortawesome/fontawesome-free@6.4.0`, `qrcodejs@1.0.0`, `@novnc/novnc@1.4.0`) ke dalam `package.json`.
  - Menghadirkan skrip otomatisasi lintas-platform `tools/sync-vendor.js` yang otomatis menyalin aset runtime ke `app/static/vendor/` saat `npm install` via hook `postinstall`.
  - Menghapus ketergantungan CDN eksternal (Google Fonts, Cloudflare cdnjs, jsDelivr) dengan 0 request outbound saat runtime.
  - Memutakhirkan font stack utama ke sistem native (`Segoe UI`, `Inter`, `Consolas`) untuk tampilan tipografi yang tajam, presisi, dan konsisten 100% antara kondisi online dan offline.
- **Redesain Footer Kartu Monitor Screenshot**:
  - Merombak footer kartu screenshot menjadi layout minimalis 1 baris ramping terkunci di 26px di semua breakpoint tanpa wrap canggung.
  - Menghapus label kaku `Update:` dan menggantinya dengan icon gambar tangkapan layar SVG di kiri serta timestamp cerdas berbasis zona waktu warnet aktif (`WITA`/`WIB`).
  - Menghilangkan scrollbar horizontal abu-abu native pada tab grup screenshot di tampilan mobile via utility modern Tailwind.
- **Penyelarasan Responsif & Zero-Truncate Multi-Tab**:
  - **Tab Laporan Kantin**: Mengoptimalkan tabel fit-to-screen bebas scrollbar horizontal/vertikal dan menghadirkan modal popover interaktif untuk pratinjau daftar menu panjang (>3 item).
  - **Tab Pengaturan & Penjadwalan Otomatis**: Skala tipografi adaptif dan eliminasi teks terpotong (*zero-truncate*) di seluruh breakpoint desktop hingga mobile.
  - **Tab Migrasi & Update**: Desain responsif terpadu tanpa overflow dan scrollbar ganda.

### Diubah
- Menaikkan versi seluruh ekosistem Server Flask dan Klien WarnetAgent Tauri/Rust ke `v1.6.5`.
- Memperbarui codename rilis aplikasi di `app/config.py` menjadi `"Autonomous Offline Studio"`.
- Pembaruan otomatis cache buster asset browser (`v_cache = 165`).

### Dihapus
- Menghapus dependensi tidak terpakai `chart.js` dari `package.json`.
- Menghapus dead links stylesheet CDN eksternal `flatpickr` dan `tom-select` dari `base.html`.

---

## [1.6.4] - 2026-10-14

### Ditambahkan
- **Integrasi Logo Resmi TM Server & Standarisasi Visual**:
  - Mengintegrasikan icon multi-resolusi resmi TM (`icon.ico`, `logo.png`, `logo-32.png`) dari klien Tauri ke server Flask.
  - Menambahkan dukungan favicon browser dan apple-touch-icon di seluruh template panel kasir (`kasir/base.html`, `kasir/login.html`) dan portal publik (`_head.html`).
  - Mengganti brand badge teks pada header sidebar kasir, halaman login kasir, portal member, dan navbar publik dengan wadah borderless & transparan berlogo TM resmi yang responsif di seluruh breakpoint tanpa garis border putih mencolok.
  - Menautkan icon resmi TM ke berkas shortcut desktop Windows kasir (`TMBilling - Kasir.url`).
- **Navigasi Kolom Denah Manual Discrete Chunks (Zero Overlap)**:
  - Merombak navigasi geser denah manual di Dashboard menjadi model discrete page chunks tanpa pengulangan kolom antar halaman (misal: Hal 1 Kolom 1-8, Hal 2 Kolom 9-12).
  - Menggantikan kontrol panah header dan banner kuning dengan Footer Bar Navigasi Kolom Noir terpadu di bawah denah, lengkap dengan dot indicator interaktif yang dapat diklik langsung.
- **Penyelarasan Responsif & Skala Tipografi Laporan Kasir**:
  - Menyelaraskan layout, padding, dan arsitektur tabel pada tab Grup PC dan Akun Kasir/Admin agar konsisten dengan tab Paket Billing di seluruh breakpoint.
  - Memperbesar ukuran teks dan padding bar rincian metode pembayaran di Laporan Billing & Kantin (dari font mikro 9px/10px ke 12px dan 14px di 2XL) dengan diferensiasi warna kontras tinggi (Tunai amber, QRIS emerald, Transfer sky).
- **Fit-to-Screen, Single Container & Responsive POS F&B Tab Kantin (`#tab-menu`)**:
  - Menyatukan POS Header dan Content ke dalam **1 Container Terpadu Ramping** (`bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2.5 sm:p-3 xl:p-3.5 space-y-2.5`), selaras dengan standar Tab Member, Paket, dan Unit PC.
  - Menghadirkan **Header Toolbar Terpadu**: Judul & deskripsi di sisi kiri, search box cepat dengan tombol reset `✕` dan tombol `Tambah Menu` di sisi kanan.
  - Menambahkan **Horizontal Tab & Filter Pills**: Tab switcher `Katalog Menu` & `Arsip Menu` disertai badge counter dinamis serta pills filter stok cepat (`Semua`, `Tersedia`, `Stok Habis`).
  - Menerapkan **Grid 2-Kolom Terpadu dengan Internal Scroll (Fit-to-Screen)**:
    - Kolom Kiri: Grid Katalog Produk mandiri (`max-h-[calc(100vh-215px)] overflow-y-auto scrollbar-thin`) dengan grid responsif (2 col di mobile & lg, 3 col di sm/md/xl, 4 col di 2xl).
    - Kolom Kanan: Panel Keranjang Belanja Cart terintegrasi pas di layar (`flex flex-col max-h-[calc(100vh-215px)]`) dengan daftar item scrollable mandiri dan ringkasan checkout selalu terkunci di bawah tanpa terdorong keluar layar.
  - **Rombakan UI/UX Operasional Kasir Harian (Long-Shift Ergonomics)**:
    - **Kartu Interaktif Penuh (Tap-to-Add)**: Klik/tap di mana saja pada kartu produk menambah +1 item ke keranjang secara instan (`active:scale-[0.98]`).
    - **In-Cart Badging & Border Glow**: Menampilkan badge kuantitas di pojok atas (`xN di Keranjang`) dan highlight border emerald (`border-emerald-500/60 bg-[#08130d]`) yang tersinkronisasi realtime dengan isi keranjang.
    - **Proteksi Aksi Admin & Preview**: Aksi edit, restock, arsip, hapus, dan preview dilindungi dengan `stopPropagation` agar tidak memicu add-to-cart.
    - **Modal Pembayaran Kompak & Ergonomis (`max-w-2xl`)**: Menggantikan modal lama (`max-w-6xl`) dengan ukuran proporsional 2 kolom seimbang, grid pecahan nominal cepat simetris, dan nominal kembalian besar beraksen emerald.
  - Menyinkronkan dimensi kartu skeleton `Skeleton.menuCards()` dan placeholder SSR ke ukuran compact `min-h-[220px]` dan padding `p-2 sm:p-2.5`.
- **Fit-to-Screen, Adaptive Pagination & Navigasi Grup Tab Member (`#tab-member`)**:
  - Menyatukan 2 card terpisah menjadi 1 boks container ramping terpadu (`bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2.5 sm:p-3 xl:p-3.5`) dengan Toolbar Terpadu di bagian atas.
  - Menghadirkan navigasi **Horizontal Tab Pills Per Grup** (`#member-group-tabs`) dengan pill "Semua" dan tab tiap grup beraksen warna grup (`grup.warna`) menggantikan dropdown filter statis.
  - Menerapkan **Adaptive Pagination dinamis** berbasis breakpoint: Mobile (`< md`) = 5 baris, Tablet & Laptop Sedang (`md`/`lg`) = 7 baris, XL = 8 baris, dan Layar Lebar 2XL = 10 baris (dengan debounced window resize auto-listener).
  - Menyelaraskan proporsi dan padding 2XL dengan XL (`xl:p-3.5`, `py-2`, avatar & tombol `w-8 h-8`) serta menghilangkan sorting berdasarkan kolom agar tampilan stabil, bersih, dan **`overflowPx === 0`** (bebas scrollbar vertikal).
  - Streamline footer pagination dengan status 'Menampilkan X - Y dari Total Z Member' dan tombol Prev/Next, mengeliminasi dropdown manual yang membebani UI.
  - Menyesuaikan SSR fallback di `member.html` agar selaras dengan 8 baris dan layout terpadu.
  - Mengeliminasi duplikasi scrollbar pada modal detail riwayat member, membuang ruang hitam kosong (space void), menambahkan ringkasan total pembelian & kartu kebijakan refund, serta melebarkan jarak (gap) scrollbar dari tombol refund.
- **Fit-to-Screen, Adaptive Grid & Optimasi Ruang Unit PC (`#tab-pc`)**:
  - Mengeliminasi layout multi-grup bertumpuk yang menyebabkan scrolling vertikal, digantikan dengan **Horizontal Tab Pills Per Grup** (`#pc-group-tabs`) dengan aksen warna dan badge jumlah unit PC (`${count} UNIT`).
  - Menerapkan **Adaptive Target Pagination** optimal untuk mengisi ruang vertikal secara seimbang tanpa scrollbar (`overflowPx === 0`): Mobile (`< md`) = 8 PC (2x4), Tablet & Laptop Sedang (`md`/`lg`) = 12 PC (4x3), Desktop Standar (`xl`) = 18 PC (6x3), dan Layar Lebar 2XL = 24 PC (6x4) dengan resize listener otomatis.
  - **Hardening Tata Letak Kartu untuk Nama PC Panjang (hingga 11–15 karakter)**:
    - Memisahkan kode PC dari status badge tekstual: Header kini mendedikasikan ruang penuh untuk Kode PC (`truncate min-w-0 flex-1`) didampingi ikon monitor SVG dan Status Dot bercahaya (emerald/sky/purple/neutral glowing dot dengan tooltip).
    - Menghilangkan badge grup di dalam kartu untuk mengeliminasi redundansi visual dan menghemat ruang vertikal.
    - Menempatkan Status Badge teks penuh di baris footer sebelah kiri (`TERSEDIA`, `TERPAKAI`, `ADMIN`, `MAINTENANCE`) dengan aksen border kontras.
    - Memproteksi baris IP address (`truncate min-w-0 flex-1 font-mono`) dan tombol aksi sentuh (`shrink-0`) agar tidak saling mendesak atau meluap dari batas kartu.
  - Menyesuaikan proporsi tinggi kartu (`min-h-[82px] sm:min-h-[88px] 2xl:min-h-[98px]`) dan padding (`p-2.5 sm:p-3 2xl:p-3.5`) untuk mengeliminasi ruang kosong di bagian bawah container.
  - Menyatukan 2 card terpisah menjadi 1 boks container ramping terpadu (`bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2.5 sm:p-3 xl:p-3.5 2xl:p-5`).
  - Interaksi kartu touch-friendly: Tombol aksi permanen di mobile/tablet/lg (`< xl`) dan hover overlay di desktop (`xl+`).
  - Menyesuaikan `Skeleton.pcManagementGrid(cards = 8)` dan SSR fallback di `pc.html` agar selaras dengan dimensi dan elemen kartu baru.
- **Fit-to-Screen, 2XL Adaptive Pagination & Navigasi Grup Tab Paket Billing (`#tab-paket`)**:
  - Mengeliminasi layout multi-grup bertumpuk yang menyebabkan scrolling vertikal tinggi, digantikan dengan navigasi **Horizontal Tab Pills Per Grup** (`#paket-group-tabs`) dengan aksen warna dan badge jumlah paket.
  - Menerapkan **Adaptive Pagination dinamis** berbasis breakpoint: Mobile (`< md`) = 5 baris, Tablet/Laptop (`md`/`lg`) = 7 baris, XL = 8 baris, dan Layar Lebar 2XL = 11 baris (dengan debounced window resize auto-listener).
  - Skala proporsional di layar 2XL: Container card `2xl:p-5`, toolbar search `2xl:w-64 2xl:py-2 2xl:text-sm`, tombol tambah `2xl:px-4 2xl:py-2 2xl:text-sm`, dan tab pills `2xl:px-3.5 2xl:py-2 2xl:text-sm`.
  - Padding baris tabel membesar proporsional di 2XL (`2xl:py-3`, `2xl:text-sm`) sehingga ruang vertikal terisi padat tanpa spasi kosong menganga dan tetap **`overflowPx === 0`** (zero vertical scrollbar).
  - Menyesuaikan `Skeleton.paketTable(rows)` agar mendukung jumlah baris dinamis dan kelas 2XL.
- **Fit-to-Screen & Optimasi Responsif Tab Riwayat Struk (`#tab-struk`)**:
  - Mengubah pagination default riwayat struk menjadi 5 item per halaman untuk menjaga tinggi halaman tetap fit-to-screen di seluruh breakpoint.
  - Merampingkan preview struk dan card container untuk mengeliminasi vertical scrollbar pada viewport kasir.
- **Overhaul Responsif & Redesain UI/UX Tab Kantin / POS F&B (Mobile-First to Desktop)**:
  - **Sistem Grid Adaptif Multi-Breakpoint**: Merestrukturisasi grid katalog produk (`#menu-catalog-grid`) di seluruh 6 tingkatan breakpoint Tailwind CSS:
    - Default (`< 640px`: spektrum 320px–639px): Grid 2 kolom seimbang (kartu 130px–185px) dengan **`overflowPx === 0`** tanpa horizontal scrollbar.
    - `sm:` (640px): Grid ditingkatkan menjadi 3 kolom (`sm:grid-cols-3`), mengeliminasi masalah kartu melar berlebihan (269px) menjadi ~180px proporsional.
    - `md:` (768px): Grid 3 kolom (`md:grid-cols-3`, kartu ~212px).
    - `lg:` (1024px): Layout split berdampingan (Katalog 7 kolom : Keranjang 5 kolom, kartu ~195px).
    - `xl:` (1280px): Grid katalog disesuaikan menjadi 3 kolom (`xl:grid-cols-3`), mengeliminasi bug kartu terjepit (sebelumnya hanya 147px, kini menjadi ~202px yang lapang dan elegan).
    - `2xl:` (1536px+): Grid 4 kolom (`2xl:grid-cols-4`, kartu ~217px).
  - **Mobile Floating Bottom Action Bar (`#menu-mobile-cart-bar`)**:
    - Mengintegrasikan bar mengambang interaktif di bagian bawah layar pada viewport `< lg` yang otomatis muncul saat keranjang terisi (`Total: RpXX.XXX • X item`).
    - Menyediakan tombol pintas langsung *"Keranjang"* (smooth scroll) dan tombol *"Bayar"* (langsung membuka modal pembayaran POS tanpa perlu scroll melewati puluhan produk).
    - Otomatis disembunyikan saat keranjang kosong.
  - **Penyempurnaan Segmented Control View Switcher (Katalog Menu vs Arsip Menu)**:
    - Memperbaiki bug kerusakan layout dan pergeseran tombol saat diklik dengan memisahkan *base layout classes* (`w-full sm:w-auto`, `justify-center`, `rounded-md`) dari *theme classes*, serta mengamankan kelas `.remote-hide-action` pada tombol arsip.
    - Mengeliminasi emoji kardus berantakan (`📦`) dan menggantikannya dengan ikon SVG ramping yang simetris dan konsisten pada tab `Katalog Menu` dan `Arsip Menu`.
    - Di layar mobile (`< sm`), tab switcher menggunakan `grid grid-cols-2` sehingga kedua tombol terbagi 50:50 dengan lebar identik (164px &times; 164px) tanpa pergeseran atau loncatan lebar saat berpindah tampilan.
  - **Perbaikan Tata Letak Search Bar & Toolbar Katalog pada Breakpoint LG (1024px)**:
    - Mengatasi masalah search bar yang terdorong keluar batas kartu (`overflowPx > 0`) pada breakpoint LG akibat pembagian 2 kolom berdampingan (Katalog 7 : Keranjang 5) yang mempersempit ruang kartu katalog menjadi ~407px (tidak muat untuk Switcher 233px + Search Box 208px jika dipaksa horizontal).
    - Menerapkan tata letak bertingkat adaptif pada breakpoint LG (`lg:flex-col lg:items-start`), di mana View Switcher ditempatkan rapi di baris atas dan Search Bar membentang penuh 100% (`lg:w-full`) di baris bawah.
    - Pada resolusi XL/2XL (`>= 1280px`), Search Bar dan Switcher secara otomatis kembali berdampingan (`xl:flex-row xl:w-60`) karena ruang kontainer sudah sangat lapang (> 640px).
    - Memastikan nilai **`overflowPx === 0`** di seluruh breakpoint dengan placeholder dan teks pencarian yang terbaca sempurna tanpa terpotong.
  - **Aksi Kelola Menu Khusus Layar Sentuh / Handphone (`< lg`)**:
    - Memecahkan keterbatasan perangkat ponsel/tablet layar sentuh yang tidak memiliki mouse hover (`opacity-0 group-hover:opacity-100` tidak dapat dijangkau di smartphone).
    - Menyematkan tombol aksi titik tiga (`⋮`) ramah sentuhan di pojok kanan atas kartu menu pada layar `< lg` (khusus role Admin).
    - Mengetuk tombol titik tiga menampilkan **Action Sheet / Modal Kelola Menu Ringkas** dengan target sentuh jari yang nyaman (44px+) untuk aksi: Tambah Stok (Restock), Edit Nama, Harga & Foto, Lihat Foto Fullscreen, Arsipkan Menu, dan Hapus Permanen.
    - Pada layar desktop monitor (`lg:` ke atas), tombol hover mouse tetap berfungsi secara native dengan tombol `⋮` otomatis disembunyikan.
  - **Penyempurnaan Keranjang Belanja (*Cart Panel*)**:
    - Menambahkan tombol *"Kosongkan Keranjang"* (`#menu-cart-clear-btn`) di header keranjang.
    - Menyesuaikan batas ketinggian vertikal item keranjang secara responsif hingga `2xl:max-h-[620px]` untuk memanfaatkan ruang layar monitor desktop/2K secara maksimal.
  - **Penataan Modal Transaksi POS & Quick Cash**:
    - Merapikan pecahan uang cepat (`Rp1K`–`Rp100K`) beserta tombol *"Uang Pas"* ke dalam grid responsif 4 kolom &times; 2 baris (`grid grid-cols-4 gap-1.5`) yang simetris dan rapi di semua perangkat.
    - Menyelaraskan padding dan tipografi kartu menu serta aksi hover admin.
- **Perbaikan Bug Redundant DOM Re-render pada Tab List Koneksi Cabang & Akun Kasir Cabang**:
  - Mengeliminasi penghapusan dan re-render DOM berulang yang terjadi pada setiap interval polling global di modul `BranchManager` (`tab-branch_inbound` dan `tab-branch_kasir`).
  - Mengimplementasikan fingerprinting berbasis data (`_lastInboundFingerprint`, `_lastOperatorsFingerprint`, `_lastBranchesFingerprint`) dan mode *silent poll* (`isSilent = true`), sehingga tabel hanya dirender ulang saat data benar-benar berubah di backend.
  - Menghilangkan kemunculan baris spinner / teks "Memuat..." yang sebelumnya merusak tampilan dan mereset interaksi pengguna setiap beberapa detik.
  - Menjaga interval polling tetap konsisten mengikuti ritme global dashboard tanpa mengganggu modal dialog yang sedang terbuka atau input pencarian pengguna.
- **Penyempurnaan Filter Tanggal Mutasi Log Stok Menu (Hanya Tanggal yang Ada Data)**:
  - Mengganti input tanggal kalender terbuka (`<input type="date">`) menjadi dropdown selektif dinamis (`<select id="stock-log-filter-date">`) pada tab `tab-menu_stock_log`.
  - Dropdown hanya menyajikan tanggal-tanggal unik yang benar-benar memiliki riwayat mutasi stok (`MenuRepository.get_distinct_stock_log_dates`), mencegah kasir memilih tanggal kosong yang tidak memiliki data.
  - Opsi dropdown berformat tanggal Indonesia `DD/MM/YYYY` dengan nilai ISO `YYYY-MM-DD`, terintegrasi otomatis dengan aksi reset filter dan live polling.
  - Menambahkan endpoint REST API dedicated `GET /api/v1/kasir/menu/stock-logs/dates` dan properti `dates` pada payload respons `GET /api/v1/kasir/menu/stock-logs`.
- **Optimasi Responsif "Fit-to-Table" Mobile Portrait Tanpa Prefix (`< sm`: 360px – 430px) pada 8 Tab Kasir Termasuk Tab Member**:
  - **Zero Horizontal Overflow (`overflowPx === 0`) pada Layar Ponsel**: Mengeliminasi scrollbar horizontal dan memastikan seluruh konten dan tombol aksi terlihat 100% pas (*Fit-to-Table*) pada layar smartphone (iPhone 14 @ 390px, Android @ 360px) di 8 tab kasir:
    1. `tab-member`: Arsitektur tabel horizontal ramping (`px-2 sm:px-3 py-2`), kolom esensial `Member`, `Waktu`, dan `Aksi` di `< sm`, tombol cepat `+` (Isi Saldo) & menu aksi `⋮` (Action Sheet modal terpadu: Isi Saldo, Detail/Riwayat, Edit, Hapus), server-side pagination & sorting responsif dengan selector baris (5, 10, 25) mengeliminasi card mode vertikal bertumpuk.
    2. `tab-menu_stock_log`: Padding sel ringkas `px-1.5 sm:px-3`, badge mutasi kompak, tombol Detail berbasis ikon di mobile (`<span class="hidden sm:inline">Detail</span>`), format tanggal ringkas `DD/MM HH:mm`.
    3. `tab-shift_history`: Header responsif `Petugas`, `Omset`, `Laci`, stacking tanggal dan rentang jam vertikal, status badge ringkas `SEL`, kontrol aksi ramping.
    4. `tab-user_logs`: Header & padding responsif `p-2 sm:p-3`, penanggalan log ringkas `MM-DD HH:mm`, tombol Detail berbasis ikon pada mobile.
    5. `tab-maintenance`: Tombol aksi icon-only pada mobile (`🔍`, `▶`, `✕`, `✓`, `🗑`), batasan lebar judul masalah dinamis `max-w-[55px] sm:max-w-[150px]`, sel padding `px-0.5 sm:px-2`.
    6. `tab-laporan_maintenance`: Padding kontainer & tabel ramping `p-1.5 sm:p-2.5`, format tanggal ringkas, tombol Detail icon-only pada mobile.
    7. `tab-monitor`: Badge suhu CPU & GPU ultra-kompak `min-w-[28px] sm:min-w-[54px]`, indikator kecepatan jaringan ringkas `1G`, kolom aksi hemat ruang.
    8. `tab-hardware_checker`: Badge status hardware ringkas (`🛡️`, `🚨`, `⚙️` pada `< sm`), adapter LAN ringkas `1G`, tombol aksi Detail & Baseline berbasis ikon di layar mobile.
  - **Paginasi & Sorting Server-Side Tab Member**: Menambahkan parameter `page`, `per_page`, `sort_by`, dan `sort_order` pada REST API `GET /api/v1/member/` (`MemberRepository.get_members_paginated`), menyajikan respon terpaginasi lengkap dengan metadata total records dan total halaman, mengurangi beban rendering DOM ribuan baris menjadi instant.
  - **Preservasi 100% Fit-to-Table pada Breakpoint `sm` (640px), `md` (768px), dan `lg` (1024px)**: Teruji bebas regresi (`overflowPx === 0`) di seluruh breakpoint standar Tailwind CSS.
- **Optimasi Responsif "Fit-to-Table" Multi-Breakpoint (`sm` 640px & `md` 768px) pada 7 Tab Kasir**:
  - **Eliminasi Total Horizontal Overflow & Kolom Terpotong**: Mengeliminasi kolom terpotong atau tersembunyi ke sisi kanan (`overflowPx === 0`) pada 7 tab utama antarmuka kasir tanpa scrollbar horizontal:
    1. `tab-menu_stock_log` (Logstok Menu F&B): Arsitektur adaptif 4 kolom (`Waktu & Petugas`, `Menu`, `Stok & Mutasi`, `Aksi`) dengan tombol Detail ringkas `h-7`.
    2. `tab-shift_history` (Riwayat Serah Terima Shift): Arsitektur adaptif 5 kolom (`Petugas & Waktu`, `Penerimaan`, `Kas & Selisih`, `Status`, `Aksi`) menyatukan penerimaan & kas bertingkat.
    3. `tab-user_logs` (Log Audit Staff): Arsitektur adaptif 4 kolom (`Waktu & Operator`, `Aksi & IP`, `Keterangan`, `Aksi`) pada layar mobile/tablet.
    4. `tab-maintenance` (Perawatan PC): Arsitektur adaptif 4 kolom (`PC & Prioritas`, `Masalah & Detail`, `Status & Pelapor`, `Aksi`) dengan tombol aksi ringkas (`Detail`, `Proses`, `Tolak`, `Selesai`, `Hapus`).
    5. `tab-laporan_maintenance` (Laporan Perawatan): Pembatasan lebar (`max-w-[130px] sm:max-w-[180px] md:max-w-[220px] truncate`) pada judul masalah & resolusi serta normalisasi padding sel.
    6. `tab-monitor` (Monitor Hardware): Penataan kontainer responsif (`p-3 sm:p-4 lg:p-4 xl:p-6`), eliminasi date string overflow di kolom aksi pada breakpoint `sm`, dan perampingan sel.
    7. `tab-hardware_checker` (Hardware Checker): Penataan kontainer responsif (`p-3 sm:p-4 lg:p-4 xl:p-6`), tombol aksi kompak (`Detail` & `Baseline`), dan format waktu sinkronisasi ringkas.
  - **Preservasi Penuh Tampilan Desktop (`lg`, `xl`, `2xl`)**: Menjaga tabel tetap luas dengan seluruh kolom terpisah (`hidden lg:table-cell`) saat diakses pada monitor desktop standar atau lebar.
- **Optimasi Responsif & Paginasi Tab Perawatan PC (Zero Scroll Multi-Breakpoint)**:
  - **Redesain 2-Kolom Modal Detail Tiket Perawatan PC**: Membagi struktur modal detail (`modal-detail-ticket`) menjadi 2 kolom responsif (`sm:grid sm:grid-cols-2 lg:gap-3.5 xl:gap-4.5`) serupa modal riwayat serah terima shift kasir, memisahkan kelompok identitas PC & pelapor di sisi kiri dengan rincian deskripsi masalah, status penyelesaian, serta biaya perbaikan di sisi kanan untuk mengeliminasi vertical scrollable di resolusi `sm`, `md`, `lg`, `xl`, dan `2xl`.
  - **Limit 5 Item per Halaman & Paginasi**: Membatasi tampilan tiket perawatan menjadi tepat 5 data per halaman secara dinamis di modul `Maintenance`, dilengkapi bar navigasi paginasi ringkas (`Menampilkan X - Y dari Z tiket`, tombol `← Sebelumnya`, dan tombol `Berikutnya →` dengan penanganan boundary disabled).
  - **Single Unified Card Layout**: Menyatukan 3 kartu terpisah (Action Header, 4 Mini Status Cards, dan Tabel Data) pada `maintenance.html` menjadi 1 card wrapper terpadu, memangkas jarak vertikal berlebih (`space-y-6` menjadi `space-y-2 lg:space-y-1.5 xl:space-y-2`) dan padding kartu.
  - **Zero Scroll di Seluruh Breakpoint Desktop**: Mengeliminasi scrollbar vertikal pada `#main-scroll` di resolusi desktop (`lg` 1024x768, `xl` 1280x800, dan `2xl` 1536x960), dengan tinggi tab hanya 397–571 px (jauh di bawah batas viewport).
  - **Tabel Responsif Ramping Tanpa Card Mode Berlebih**: Menjaga tabel tetap dalam satu baris terpadu (`overflow-x-auto scrollbar-thin`) di seluruh resolusi termasuk mobile/tablet (`sm`, `md`), dilengkapi teks terpotong rapi (`truncate min-w-0 max-w-[200px] xl:max-w-xs`) serta tombol aksi dan badge status yang kompak (`whitespace-nowrap`).
- **Penyempurnaan Tampilan Monitor Hardware & Hardware Checker**:
  - **Fitur Filter / Sorting Grup di Monitor Hardware**: Menambahkan kontrol dropdown `<select id="monitor-group-filter">` pada header Monitor Hardware untuk memudahkan kasir memfilter dan mengurutkan unit PC per grup atau menampilkan seluruh grup sekaligus.
  - **Highlighted Group Header & Pembersihan Color Bar Samping**: Menghapus strip warna vertikal di samping teks grup dan mengubah header grup menjadi badge pill berlatar kontras tinggi (`REGULER • 20 UNIT`) dengan unit count badge terpadu sehingga langsung mudah dikenali oleh end-user.
  - **Penggantian Kolom Grup Menjadi Kolom Status di Hardware Checker**: Mengeliminasi kolom Grup pada Hardware Checker dan menggantikannya dengan kolom berdedikasi `Status` (`🛡️ AMAN`, `🚨 DITUKAR`, `⚙️ PENDING`), serta merapikan tampilan kode PC pada breakpoint kecil (`sm`, `md`, `lg`, `xl`).
  - **Grouping per Grup PC & Spacing Antargrup**: Membagi baris tabel Monitor Hardware per grup PC dengan menambahkan jarak/gap vertikal antargrup yang lebih tinggi (`pt-8 sm:pt-9 pb-2.5`) pada Monitor Hardware dan Hardware Checker.
  - **Skema Warna Komponen CPU & GPU**: Menerapkan diferensiasi warna yang konsisten pada nama CPU (`text-cyan-400`) serta badge suhunya (`text-cyan-300 border-cyan-800/60 bg-cyan-950/60`), dan nama GPU (`text-amber-400`) serta badge suhunya (`text-amber-300 border-amber-800/60 bg-amber-950/60`).
  - **Pembersihan Alert Suhu & Bullet Point**: Menghapus indikator alert peringatan suhu berlebih ("Perhatian" / red ping animation) dan bullet point pada nama PC di Monitor Hardware, dengan mempertahankan indikator status kecepatan LAN adapter.
  - **Pembaruan Header Sinkronisasi**: Mengganti label kolom `"SYNC"` menjadi `"Terakhir disinkronkan"` pada tabel dan modal detail Hardware Checker agar lebih informatif dan rapi.
  - **Informasi Nama/Model SSD & RAM pada Modal Detail**: Menampilkan model atau nama RAM dan SSD/Disk pada Modal Detail Hardware Checker jika data tersedia pada spesifikasi (baseline/telemetri), serta mengabaikannya secara bersih jika tidak tersedia.
- **Unifikasi Responsif Monitor Hardware & Hardware Checker (1 Baris per PC)**:
  - Unifikasi tampilan daftar PC pada tab Monitor Hardware (`tab-monitor`) dan Hardware Checker (`tab-hardware_checker`) menjadi tabel 1 baris per PC yang seragam di seluruh breakpoint responsive (`sm`, `md`, `lg`, `xl`, `2xl`).
  - **Optimasi Fit-to-Table Lintas-Breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`)**: Mengeliminasi lebar minimum artifisial (`min-w-[960px]`) dan menerapkan arsitektur kolom adaptif multi-line (Spesifikasi CPU/GPU/Mobo, RAM & LAN, Suhu terpadu, tombol aksi fleksibel) sehingga tabel 100% pas (*fit to table width*) tanpa ada kolom yang terpotong atau hilang di semua resolusi.
  - Pencegahan pemotongan baris (*line-wrapping*) pada indikator kecepatan adapter jaringan (`1000 Mbps`, `1 Gbps`) menggunakan normalisasi unit dan utilitas `whitespace-nowrap shrink-0 inline-flex`.
  - Integrasi kapasitas **Total RAM** (`m.total_ram`) dan Network Adapter pada Modal Detail Hardware Checker, baik di kolom Baseline Resmi maupun Live Telemetry.
  - Penggantian konfirmasi browser native `window.confirm()` dengan Custom Modal Dialog terstandarisasi (`Modal.confirm`) bernuansa amber warning, keyboard shortcut `E`, serta ukuran modal responsive.
- **Refactoring Desain Overlay Client (Apple Dark-Mode Aesthetic)**:
  - Palet gelap elevasi modern (`#161618`, `#1c1c1e`, `#2c2c2e`) dengan aksen mint (`#30d158`) dan hairline borders (`border-white/10`).
  - Segmented pill controls terstandarisasi untuk navigasi modal (Katalog Menu FnB, Daftar Paket).
  - Eliminasi total animasi berulang/looping (pulse, spin, infinite effects) untuk menghemat alokasi CPU/GPU gaming dan kompatibilitas display refresh rate tinggi (144Hz / 240Hz).
- **Auto-Hide Floating Overlay Card pada Modal Aktif**:
  - Otomatis menyembunyikan floating widget `#overlay-main-card` saat modal QRIS Fullscreen HD atau Katalog Menu/Paket dibuka.
  - Memulihkan visibilitas kartu utama secara mulus saat modal ditutup atau di-reset.
- **Engine Validasi Waktu Unlimited Berbasis Status Murni**:
  - Format waktu riil (`X jam Y menit` / `00:00:00`) untuk seluruh durasi kuota member tanpa batas atas buatan (termasuk kuota 1.000 s/d 1.000.000+ jam).
  - Tampilan teks `"Unlimited"` secara eksklusif hanya diberikan pada sesi dengan status valid `admin` atau `system`.
  - Mengeliminasi CPU thrashing render loop dan menjaga performa klien tetap konstan.
- **Pembersihan & Keamanan Kredensial Administrator Klien**:
  - Form input username dan password admin pada modal darurat agen dibersihkan seketika pada saat login success, login error, maupun pembatalan (cancel/close).
  - Mencegah residu kredensial tertinggal di DOM/memori form browser klien.

### Diperbaiki
- **Isolasi Scrollbar & Interaksi Roda Mouse Katalog POS (`#menu-catalog-scroll-container`)**:
  - Mencegah *scroll chaining* ke seluruh halaman saat mouse hover di atas kartu menu dengan menambahkan `overscroll-behavior: contain` (`.pos-catalog-scroll-container` & `.pos-cart-box`) dan event listener non-passive `wheel` yang mengunci perputaran scroll di dalam kontainer internal katalog.
  - Memberikan batas tinggi adaptif (`max-height`) dan *bottom breathing room* (`padding-bottom: 2.75rem` / `pb-10` di mobile, `pb-8` di sm/md, `pb-6` di lg/xl/2xl) agar item terbawah tidak menabrak batas bawah kontainer atau terpotong.
  - Menambah jarak bawah pada `#tab-menu` mobile (`pb-28 sm:pb-24 lg:pb-0`) untuk memastikan floating action bar keranjang tidak menutupi produk terakhir.
  - **Dukungan Klik Kiri (Tambah) & Klik Kanan (Kurangi) pada Kartu**: Klik kiri kartu menambah kuantitas, klik kanan (`contextmenu`) memanggil `decrementCart()` untuk mengurangi kuantitas atau menghapus item tanpa memicu menu konteks browser.
  - **Kontrol Stepper Responsif Mobile**: Pada item yang sudah ada di keranjang (`inCartQty > 0`), tombol aksi bawah kartu otomatis berubah menjadi stepper interaktif `[-]` `N` `[+]` dan mendukung *long-press* (tekan tahan) di layar sentuh.
  - **Pencegahan Teks Judul Menimpa Tombol Kebab Mobile**: Memindahkan tombol aksi mobile (`adminMobileActions`) ke dalam flex container judul (`flex items-start justify-between gap-1.5 min-w-0`) dengan `line-clamp-2` sehingga nama menu yang panjang tidak pernah bertabrakan dengan ikon titik tiga.
  - Mempertahankan posisi scroll katalog (`prevScroll`) saat re-render kartu untuk kenyamanan interaksi kasir tanpa lonjakan scrollbar.

## [1.6.3] - 2026-10-05

### Ditambahkan
- **Floor Plan Engine v1.6.3 (Denah Meja Asinkronus & Unmapped Coordinates)**:
  - Optimasi penyimpanan posisi meja dengan async batching `Promise.all()` di `map_view.js` dan sinkronisasi instan via `Dashboard.load(true)`.
  - Dukungan koordinat meja unmapped (`pos_x = -1, pos_y = -1`) dengan validasi skema database `-1..10000`.
  - Mekanisme reactive rerender di tempat (`_hasStructureChanged`) tanpa melakukan reload halaman browser penuh.
- **Hardware Checker & Security Audit v1.6.3**:
  - Pemisahan entri Motherboard menjadi **Mobo Model** (model papan) dan **Mobo Serial** (serial anti-theft unik) pada baseline dan live telemetry.
  - Sinkronisasi payload dictionary `"Motherboard"` dan `"MotherboardSerial"` di `HardwareService.process_hardware_metric`.
  - Referensi estimasi rentang jam rekaman CCTV (*Smart CCTV Time Window*) untuk setiap indikasi pergantian/pencopotan komponen internal PC.
- **Standardized Skeleton Loading Engine**:
  - Engine shimmer loading terpusat di `app/static/js/kasir/core/skeleton.js` yang terintegrasi di seluruh 26 tab antarmuka kasir.
  - Mengeliminasi spinner berputar usang (`fa-spin`, `animate-spin`).
- **Arsitektur Proteksi Triple-Layer Session Expiry**:
  - Layer 1: Background Server Scheduler (APScheduler 60 detik di `run.py`).
  - Layer 2: Realtime Client Polling (Tauri Kiosk 1–3 detik di `ClientService.get_status`).
  - Layer 3: Frontend Dashboard Polling (Kasir web 1, 2, 3, 5 detik di `DashboardService.get_pc_list`).

## [1.6.2] - 2026-10-01

### Ditambahkan
- **Fitur Kunci Meja AFK / Istirahat Sementara (Temporary AFK Screen Lock)**:
  - Fitur penguncian layar PC klien sementara saat pengguna meninggalkan meja (istirahat, makan, ibadah, dll) dengan proteksi keyboard hook & penyembunyian taskbar.
  - Tampilan layar AFK minimalis bertema hitam polos murni (`bg-black`, `#000000`) dengan mono timer countdown billing yang tetap berjalan aktif.
  - Alur autentikasi unlock aman:
    - Akun **Member**: Langsung mengunci meja tanpa form PIN; membuka kunci menggunakan password akun member.
    - Sesi **Guest**: Meminta pembuatan 4–6 digit PIN angka sementara saat mengunci; membuka kunci menggunakan PIN tersebut.
  - Remote control & **Master Unlock** dari Kasir: Tombol `🔒 Kunci Meja AFK` dan `🔓 Buka Kunci AFK (Master Unlock)` di dalam Detail Modal PC pada Dashboard Kasir untuk membantu pelanggan yang lupa PIN/password.
  - Indikator status real-time di Dashboard Kasir: Badge amber menyala `🔒 AFK / Istirahat` pada kartu grid PC dengan timer dan nama pengguna tetap tampil lengkap.
  - **100% Backward Compatibility**: Kolom `is_afk`, `afk_pin`, `afk_sejak` di-upgrade otomatis via *Self-Healing Auto-Migration* di `app/__init__.py` dan `migration_routes.py`.
- **Shift Kasir & Serah Terima Shift (Hitung Buta / Blind Cash Reconciliation)**:
  - Sistem serah terima shift kasir anti-manipulasi berbasis *Blind Count*: angka pendapatan seharusnya disembunyikan saat kasir mengakhiri shift.
  - Alur Buka Shift dengan modal awal dinamis dan validasi nominal `Rp 0 s/d Rp 100.000.000` (`Utils.formatInputRupiah`).
  - Rekonsiliasi laci kas otomatis: pembandingan kas fisik aktual vs total modal awal + transaksi tunai bersih, menghasilkan status terkunci `PAS / Rp 0`, `SURPLUS (+)`, atau `DEFISIT (-)`.
  - Pemisahan penerimaan tunai (Cash) vs non-tunai (QRIS / Bank) secara otomatis pada model `ShiftRecord`.
  - Fitur **Admin Force Close Shift**: kemampuan administrator menutup paksa shift kasir aktif dalam situasi darurat dengan alasan yang terekam di audit log.
  - Polling real-time status shift kasir aktif di sidebar admin dan kasir tanpa perlu reload halaman.
  - Pencetakan **Struk Thermal Handover 58mm / 80mm** dan struk browser untuk bukti fisik serah terima kasir.
  - Tab **Riwayat Serah Terima Shift** dengan filter tanggal cepat (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Semua), badge status, dan modal rincian shift.
- **Log Mutasi Stok Menu (`MenuStockLog`) & Restock Audit**:
  - Model database `MenuStockLog` dan migrasi `c9d8e7f6a5b4` untuk mencatat seluruh mutasi stok barang (Restock, Transaksi Penjualan, Penyesuaian Audit).
  - Tab **Log Stok Menu** dengan filter tanggal cepat, filter operator, pagination server-side, dan ekspor data.
  - Otorisasi RBAC untuk penambahan stok makanan/minuman oleh staff/kasir dengan pencatatan audit log otomatis.
- **Konsolidasi Master Dokumentasi (Single Source of Truth)**: 
  - Seluruh dokumentasi sistem dan arsitektur dilebur ke dalam [docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md) yang mencakup katalog lengkap 28 domain fitur, panduan backend (30 blueprints, 35+ services, 26 database models), frontend modular JS, serta panduan teknis agent Rust.
  - Pembaruan dokumen ringkas [README.md](file:///c:/Project%20GIT/TMBilling/README.md) dengan panduan Quick Start terstandarisasi.
- **Dual-Hive Registry SHA-256 Binary Integrity**:
  - Penambahan verifikasi hash SHA-256 binary pada registry `HKCU` dan `HKLM` (`Hash_MGCTM`, `Hash_TMBilling`, `Hash_TMMonitor`, `Hash_mtm`, `Hash_Uninstaller`) untuk mencegah manipulasi binary klien oleh pihak ketiga.
- **Bi-directional Clipboard Sync & Auto-Firewall TightVNC**:
  - Sinkronisasi clipboard dua arah otomatis antara browser kasir dan desktop Windows PC klien melalui WebSocket VNC proxy port `5900` loopback.
  - Penyediaan skrip otomatisasi firewall Windows Defender `allow_firewall.bat` dan `tightvnc_settings.reg`.
- **Blackout Auto-Recovery System**:
  - Toleransi pemadaman listrik otomatis dengan pencatatan heartbeat `PCUptimeLog` dan pemulihan sisa waktu pelanggan secara otomatis saat PC kembali menyala (*Auto Session Resume*).
- **Chain Sesi Pindah PC (`sesi_asal_id`)**:
  - Penambahan kolom `sesi_asal_id` (ForeignKey ke `sesi.id`) pada model `Sesi` untuk melacak rantai sesi akibat perpindahan PC (*pindah PC*), memungkinkan penelusuran seluruh riwayat sesi pelanggan dari satu PC ke PC lain dalam satu grup yang sama.
  - Dimanfaatkan oleh `sesi_service.py` dan `blackout_service.py` untuk menjaga konsistensi data refund dan recovery saat sesi dipindahkan.
  - Skema database di-upgrade otomatis via *Self-Healing Auto-Migration* di `app/__init__.py` dan `migration_routes.py` (migrasi `a8f1b2c3d4e5`).
- **Sesi Kasir Benefit (`user_id` pada Model `Sesi`)**:
  - Penambahan kolom `user_id` (ForeignKey ke `user.id`) pada model `Sesi` untuk mendukung sesi bermain staf kasir / benefit internal, dipisahkan dari sesi member reguler.
- **Overhaul Deteksi Hardware TMMonitor (LibreHardwareMonitor Exclusive)**:
  - `TMBilling_Monitor` (`TMMonitor.exe`) kini menggunakan `HardwareHelper.exe` (berbasis LibreHardwareMonitor kernel driver) sebagai *sumber tunggal* untuk nama hardware (CPU, GPU, Motherboard), menggantikan fallback WMI `Win32_VideoController` yang rentan terhadap GPU display adapter palsu.
  - Serial number motherboard kini dibaca via WMI `Win32_BaseBoard` (struct `BaseBoardInfo`: `SerialNumber`, `Product`, `Manufacturer`) untuk presisi identifikasi yang lebih akurat.
  - Eliminasi false positive GPU "Microsoft Basic Display Adapter" atau adapter palsu pada hasil Hardware Checker.
- **Modul Validasi Input Terpusat (`app/utils/validators.py`)**:
  - Penambahan modul utilitas validasi dan sanitasi input pengguna yang digunakan oleh seluruh domain sistem (User, Member, PC, Grup, Paket, Menu, Sesi, Branch).
  - Fungsi tersedia: `validate_username`, `validate_password`, `validate_integer_range`, `validate_string_length`, `validate_hex_color`, `validate_phone_number`, `validate_ip_address`, `validate_url`, `validate_choice`, `validate_filename`, dan lainnya.

### Diubah
- **Restrukturisasi Direktori Klien**:
  - Pemindahan seluruh modul klien dari `WarnetClient/TMBillingTauri` ke direktori terpusat `WarnetAgent/TMBillingTauri` untuk konsistensi penamaan arsitektur.
  - Penyesuaian skrip otomatisasi root `build_and_deploy.bat`, `developer_install.bat`, dan `WarnetAgent/Deploy/build_and_deploy.bat`.
- **Label Tombol Shift Kasir**:
  - Penggantian label tombol aksi di sidebar kasir dari `Serah Terima Shift` menjadi `Akhiri Shift`.

### Diperbaiki
- **Modal Tutup Shift Layout**:
  - Perbaikan struktur tag penutup HTML pada `showTutupShiftModal()` di `app/static/js/kasir/modules/shift/index.js` agar layout modal stabil dan rapi pada breakpoint `LG`, `XL`, dan `2XL`.
- **Responsivitas Tabel Breakpoint LG**:
  - Penyesuaian styling tata letak tabel agar *fit-to-table* (tidak terpotong) pada breakpoint `LG` untuk tab **Riwayat Serah Terima Shift**, **Log Stok Menu**, dan **Riwayat Transaksi (Struk)**.
- **Batch Actions Multi-PC API**:
  - Konsolidasi deklarasi ganda namespace `API.monitor` pada `app/static/js/kasir/core/api.js` sehingga pemanggilan `API.monitor.remoteBatch` untuk aksi massal (>1 PC: Shutdown, Restart, Lock, Move PC, Clear Sesi) berjalan normal tanpa error JavaScript.

---

## [1.6.1] - 2026-09-15

### Ditambahkan
- **Sentralisasi Master Versioning**: `app/config.py` (`Config.VERSION`) kini menjadi Single Source of Truth untuk seluruh komponen Python backend, template HTML, CSS cache-busting, dan frontend JavaScript.
- **Dynamic Asset Cache-Busting**: Query string cache buster pada seluruh stylesheet dan script Jinja2 diinjeksi secara otomatis melalui Flask context processor (`?v={{ v_cache }}`).
- **Global Client Version Injection**: Penyuntikan `<meta name="app-version">` dan `window.APP_VERSION` pada halaman Kasir untuk sinkronisasi otomatis status versi pada komponen UI client.

### Diperbaiki
- **Sidebar Submenu Alignment**: Perbaikan tata letak flex (`items-start` dengan `gap-2.5`) pada submenu sidebar kasir agar label menu yang panjang (seperti *Laporan Perawatan & Catatan*) melakukan text wrapping dengan rapi dan ikon menu tetap sejajar pada baris pertama.
- **Multi-Cabang State Reset**: Penambahan reset state otomatis pada modul Kasir (Member, Perawatan PC, Laporan Perawatan, Screenshot Monitor, Blackout, dan Web VNC Client) saat beralih antar cabang agar data lokal dan remote tidak tercampur.
- **VNC Relay Synchronization**: Sinkronisasi rute relay multi-cabang untuk remote monitor mouse, keyboard, dan framebuffer events.

### Ditingkatkan
- **Pembersihan Dashboard Kasir**: Penghapusan 4 kartu ringkasan statistik dari bagian atas tab Dashboard kasir untuk antarmuka yang lebih bersih, cepat, dan fokus pada status grid PC.
- **Modal Tambah Waktu Member**: Perluasan modal pencarian & pengisian waktu member pada Dashboard (`max-w-4xl`) dengan grid 2-kolom responsif dan list 5 hasil member tanpa scrollbar.

---

## [1.6.0] - 2026-09-06

### Ditambahkan
- **Multi-Cabang (Central Control Panel & Remote Relay)**:
  - Kemampuan mengontrol dan memantau beberapa server cabang warnet secara terpadu melalui dropdown switcher di navbar Kasir.
  - Arsitektur Reverse-Proxy Relay berbasis API Key terenkripsi untuk meneruskan request endpoint kasir, media/screenshot, dan VNC secara transparan.
  - Fitur pemantauan *Inbound Connections* dan health check latensi koneksi antar cabang.
- **Web VNC Remote Desktop Client**:
  - Integrasi canvas noVNC modern langsung di dalam dashboard Kasir untuk kendali jarak jauh layar PC client.
  - Dukungan adaptive display scaling, koordinat pointer dinamis, mapping keyboard shortcut, serta fail-fast diagnostic monitoring.
- **Automated Dynamic QRIS Payment**:
  - Integrasi pembayaran otomatis QRIS dinamis & Midtrans dengan status verifikasi instan.

---

## [1.5.8] - 2026-08-25

### Ditambahkan
- **Natural Sorting Screenshot Monitor**: Pengurutan nama PC secara alami (contoh: PC-01, PC-02, ..., PC-10) pada monitor screenshot kasir.
- **Overlay Properties Enhancement**: Sinkronisasi properti overlay informasi sisa waktu pada client Tauri.

---

## [1.5.5] - 2026-08-22

### Ditambahkan
- **Chamber Noir UI Design System**: Transformasi tema antarmuka kasir ke warna gelap pekat premium (*Chamber Noir*) dengan aksen kontras tinggi dan tipografi modern (*Space Grotesk* & *JetBrains Mono*).
- **Web-based File Explorer**: Eksplorasi file log, backup, dan media server langsung dari dashboard admin kasir.
- **Smart Tutorial Seeding**: Sistem manajemen tutorial dan wiki operasional bawaan.

---

## [1.5.2] - 2026-08-16

### Ditambahkan
- **Cloudflare Zero-Trust Tunnel Integration**: Akses dashboard kasir dan TV signage dari jaringan publik/internet tanpa perlu IP publik statis atau port forwarding router.
- **Automated Cloud Backup (Google Drive & Local)**: Pencadangan otomatis basis data SQLite dan konfigurasi ke penyimpanan awan terenkripsi.

---

## [1.5.1] - 2026-08-10

### Ditambahkan
- **Real-Time Server Hardware Monitoring**:
  - Layanan mikro `TMLHMService` berbasis LibreHardwareMonitor untuk memantau metrik suhu, beban kerja CPU, GPU, RAM, disk, dan throughput jaringan server.
- **PC Uptime Tracking**: Pencatatan durasi hidup dan utilisasi PC client dengan konversi zona waktu lokal (`Asia/Jakarta`, `Asia/Makassar`, `Asia/Jayapura`).
- **Sistem Tiket Perawatan PC (Maintenance)**: Pencatatan riwayat kerusakan, servis, pergantian sparepart, dan log operasional teknisi warnet.
- **Audit Logs Category Grouping**: Pengelompokan log aktivitas kasir berdasarkan kategori modul (*Billing*, *Member*, *PC*, *Sistem*, *Transaksi*).

---

## [1.0.0] - 2026-06-01

### Rilis Perdana
- Rilis awal sistem billing warnet **TMBilling**.
- Core engine berbasis Flask & SQLAlchemy (Server) dan Rust Tauri (Client Desktop Windows).
- Manajemen sesi PC (Personal, Paket, Member, Voucher), POS Kasir Menu/F&B, dan cetak struk termal.

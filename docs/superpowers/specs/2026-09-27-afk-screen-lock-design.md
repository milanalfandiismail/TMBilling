# Desain Spesifikasi: Fitur Kunci Meja AFK / Istirahat (Temporary AFK Screen Lock)

**Tanggal:** 2026-09-27  
**Status:** Disetujui (Approved)  
**Versi Target:** TMBilling v1.6.2+  

---

## 1. Latar Belakang & Tujuan
Di warnet / gaming arena, pelanggan yang memiliki sesi aktif (baik Member maupun Guest) seringkali perlu meninggalkan meja sejenak (misal ke toilet, membeli makanan/minuman di luar, atau beribadah). Jika PC dibiarkan terbuka tanpa proteksi, akun game (Steam, Riot, Discord) atau privasi pelanggan rentan diutak-atik oleh orang lain. Namun jika pelanggan melakukan *Logout*, sesi bermain akan terhenti dan sisa waktu hangus.

Fitur **Kunci Meja AFK / Istirahat** menyediakan solusi penguncian layar sementara yang aman:
1. Layar PC terkunci penuh (fullscreen, background hitam polos minimalis, keyboard & shortcut Windows diblokir).
2. Waktu billing tetap berjalan terpotong normal. Jika waktu habis di tengah masa AFK, sistem otomatis menyelesaikan sesi dan kembali ke mode Kiosk login.
3. Pelanggan dapat membuka kunci kembali menggunakan password akun (untuk Member) atau PIN angka 4-6 digit (untuk Guest).
4. Operator Kasir dapat melihat status AFK dari dashboard, dan memiliki akses **Master Unlock** serta **Remote AFK Lock** melalui Detail Modal PC.
5. Mendukung **100% Backward Compatibility** melalui *Self-Healing Auto-Migration* saat startup dan saat proses upload update di tab *Migrasi & Update*.

---

## 2. Arsitektur Data & Backward Compatibility

### 2.1 Skema Database (`app/models/sesi/sesi.py`)
Pada entitas `Sesi`, ditambahkan 3 atribut baru:
- `is_afk` (`db.Boolean`, `default=False`, `nullable=False`): Menandai apakah sesi sedang dalam kondisi terkunci AFK.
- `afk_pin` (`db.String(100)`, `nullable=True`): Menyimpan *hash* PIN angka (4-6 digit) untuk pengguna tipe `guest`.
- `afk_sejak` (`db.DateTime`, `nullable=True`): Waktu saat penguncian AFK diaktifkan (timezone lokal).

### 2.2 Model Serialization
- `Sesi.to_dict()`:
  - Menyertakan field `"is_afk": self.is_afk`
  - Menyertakan field `"afk_sejak": format_display(self.afk_sejak) if self.afk_sejak else None`
- `PC.to_dict()`:
  - Jika `self.sesi_aktif and self.sesi_aktif.is_afk`: menyertakan `"is_afk": True`.

### 2.3 Self-Healing Auto-Migration (Non-Destructive)
Untuk menjamin 100% backward compatibility pada database lama (SQLite/MySQL):
1. **Bootstrap Initialization (`app/__init__.py`)**:
   Di dalam `_init_app_context()`, SQLAlchemy `inspector` memeriksa kolom tabel `sesi`:
   - Jika kolom `is_afk` belum ada: `ALTER TABLE sesi ADD COLUMN is_afk BOOLEAN DEFAULT 0`
   - Jika kolom `afk_pin` belum ada: `ALTER TABLE sesi ADD COLUMN afk_pin VARCHAR(100)`
   - Jika kolom `afk_sejak` belum ada: `ALTER TABLE sesi ADD COLUMN afk_sejak DATETIME`
2. **Update ZIP Handler (`app/routes/settings/migration_routes.py`)**:
   Pada fungsi `upload_update()`, safety net yang sama dieksekusi setelah ekstraksi file ZIP update, memastikan pembaruan lewat tab *Migrasi & Update* langsung sinkron tanpa perlu campur tangan manual.
3. **Alembic Version File**:
   Dibuatkan file migrasi Alembic di `migrations/versions/` untuk merekam versi skema revisi.

---

## 3. Alur API & Backend Services

### 3.1 Endpoint Client (`app/routes/client/client_routes.py`)
Diproteksi dengan decorator `@api_key_required` (`X-Client-Key` dengan constant-time comparison).

1. `POST /api/v1/public/client/afk-lock`
   - Payload:
     ```json
     {
       "ip_address": "192.168.1.101",
       "mac_address": "AA:BB:CC:DD:EE:FF",
       "pin": "1234"
     }
     ```
   - Logika:
     - Dapatkan PC dan sesi aktif via `ClientService`.
     - Jika sesi bertipe `guest`: pastikan `pin` ada (minimal 4 digit, angka), lakukan hashing dengan `generate_password_hash(pin)`.
     - Jika sesi bertipe `member`: langsung kunci tanpa input PIN (`pin = None`), karena pembukaan kunci murni menggunakan password akun member.
     - Update database: `sesi.is_afk = True`, `sesi.afk_pin = hashed_pin`, `sesi.afk_sejak = now_local()`.
     - Catat log audit: `CLIENT_AFK_LOCKED`.
     - Return: `200 OK` `{ "success": true, "message": "PC berhasil dikunci untuk AFK" }`.

2. `POST /api/v1/public/client/afk-unlock`
   - Payload:
     ```json
     {
       "ip_address": "192.168.1.101",
       "mac_address": "AA:BB:CC:DD:EE:FF",
       "credential": "password_or_pin"
     }
     ```
   - Logika:
     - Dapatkan PC dan sesi aktif yang sedang AFK.
     - Jika `sesi.tipe == 'member'`: verifikasi `sesi.member.check_password(credential)`.
     - Jika `sesi.tipe == 'guest'`: verifikasi `check_password_hash(sesi.afk_pin, credential)`.
     - Jika valid:
       - Update: `sesi.is_afk = False`, `sesi.afk_pin = None`, `sesi.afk_sejak = None`.
       - Catat log audit: `CLIENT_AFK_UNLOCKED`.
       - Return: `200 OK` `{ "success": true, "message": "Kunci meja berhasil dibuka" }`.
     - Jika salah:
       - Catat log audit: `CLIENT_AFK_UNLOCK_FAILED`.
       - Return: `401 Unauthorized` `{ "success": false, "error": "Password akun atau PIN salah" }`.

3. Sinkronisasi Polling (`ClientService.get_status`):
   - Menambahkan field `"is_afk": sesi.is_afk` pada payload respon polling status klien.
   - Tetap menghitung sisa waktu (`sisa = SesiService.sync_waktu_member(sesi)`). Jika `sisa <= 0`, sesi otomatis diubah menjadi `selesai` dan dikembalikan response `status: "kosong"` dengan `shutdown_timer`.

### 3.2 Endpoint Kasir Remote (`app/routes/monitor/monitor_routes.py`)
1. `POST /api/v1/kasir/monitor/remote/<int:pc_id>/afk-lock`
   - Diproteksi `@login_required`, `@admin_required`, `@shift_required`.
   - Mengunci sesi aktif PC dari kasir: `sesi.is_afk = True`, `sesi.afk_sejak = now_local()`.
   - Antrekan perintah remote: `ClientService.queue_command(pc.id, "afk_lock")`.
   - Catat log audit: `REMOTE_AFK_LOCK`.
   - Return: `200 OK`.

2. `POST /api/v1/kasir/monitor/remote/<int:pc_id>/afk-unlock`
   - Diproteksi `@login_required`, `@admin_required`, `@shift_required`.
   - Master unlock oleh kasir: `sesi.is_afk = False`, `sesi.afk_pin = None`, `sesi.afk_sejak = None`.
   - Antrekan perintah remote: `ClientService.queue_command(pc.id, "afk_unlock")`.
   - Catat log audit: `REMOTE_AFK_UNLOCK`.
   - Return: `200 OK`.

---

## 4. Antarmuka Klien (Tauri, Rust, & Webview)

### 4.1 Tombol Kunci pada Overlay (`WarnetAgent/TMBillingTauri/src/overlay.html`)
- Ditambahkan tombol **"🔒 Kunci Meja (AFK)"** di samping tombol properti atau di bagian sesi aktif.
- Perilaku saat tombol diklik:
  - **Untuk Member**: Langsung terkunci otomatis ke layar AFK tanpa form/input PIN. Pembukaan kunci nanti murni menggunakan password akun member.
  - **Untuk Guest**: Memunculkan modal pembuatan PIN angka sementara (4-6 digit angka).
- Konfirmasi sukses memicu pemanggilan API `afk-lock`, lalu memanggil `Api.switchToAfk()`.

### 4.2 Layar AFK Penuh (`#afk-screen`) (`WarnetAgent/TMBillingTauri/src/index.html`)
- Desain minimalis **hitam polos** (`bg-black`, `#000000` murni, zero-distraction).
- Komponen visual:
  1. **Header**: Icon gembok besar dengan teks `PC SEDANG DIKUNCI / ISTIRAHAT (AFK)`.
  2. **Info Meja**: Badge Nama PC (misal `PC-01`) dan Nama Pengguna (`Member: username` atau `Guest`).
  3. **Countdown Sisa Waktu**: Font mono besar yang menghitung mundur detik demi detik secara real-time.
  4. **Form Pembuka Kunci**:
     - Input teks/password (Password Akun untuk Member, PIN Angka untuk Guest).
     - Tombol aksi `Buka Kunci (Unlock)`.
     - Alert pesan error inline jika PIN/password salah.
  5. **Pesan Bantuan Kasir**:
     - *"Lupa PIN / Password? Silakan hubungi kasir atau operator warnet untuk membuka kunci meja ini."*

### 4.3 Logika Sistem Operasi & Keamanan (Rust)
- Fungsi `switch_to_afk`:
  - `GLOBAL_HOOK_ENABLED.store(true, Ordering::SeqCst)`: Blokir tombol Windows, Alt+Tab, Ctrl+Esc, dan shortcut task switching.
  - `set_taskbar_visibility(false)`: Sembunyikan taskbar Windows.
  - `window.set_fullscreen(true)` dan `window.set_always_on_top(true)`.
- Penanganan Command Polling di Rust (`polling.rs`):
  - Jika menerima `cmd == "afk_lock"`, pancarkan event `force-afk-lock` ke Webview.
  - Jika menerima `cmd == "afk_unlock"`, pancarkan event `force-afk-unlock` ke Webview.

---

## 5. Antarmuka Kasir Dashboard

### 5.1 Kartu PC Grid (`app/static/js/kasir/modules/dashboard/index.js`)
- Jika PC memiliki sesi aktif dengan `is_afk == True`:
  - Kartu PC **tetap menampilkan seluruh informasi lengkap seperti biasanya**: nama member / nama guest, sisa waktu/timer berjalan secara real-time, nama grup dan zona.
  - Hanya styling status & badge yang disesuaikan: badge status diganti menjadi **`🔒 AFK / Istirahat`** dengan styling warna Amber / Kuning menyala (`text-amber-400`, `border-amber-500/50`, `bg-amber-500/10`).
  - Timer billing tetap berjalan aktif.

### 5.2 Detail Modal PC (`app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`)
- Pada bagian aksi di dalam Detail Modal PC:
  - Jika PC sedang aktif normal: Ditambahkan tombol **`🔒 Kunci Meja AFK`**.
  - Jika PC sedang dalam status AFK: Ditambahkan tombol **`🔓 Buka Kunci AFK (Master Unlock)`** dengan konfirmasi cepat.

---

## 6. Rencana Verifikasi & Pengujian
1. **Unit & Integration Test (Backend)**:
   - Tes skema database dan verifikasi auto-migration `is_afk`, `afk_pin`, `afk_sejak`.
   - Tes endpoint `afk-lock` dan `afk-unlock` untuk member (password matching) dan guest (PIN hash matching).
   - Tes error cases: wrong password, invalid pin, lock PC tanpa sesi aktif.
   - Tes remote action kasir: `remote/<pc_id>/afk-lock` dan `remote/<pc_id>/afk-unlock`.
   - Tes polling status: verifikasi flag `is_afk` terbawa dalam status polling.
   - Tes auto-terminate: jika waktu habis saat AFK, sesi selesai dan status menjadi kosong.
2. **Suite Test Verification**:
   - Jalankan seluruh suite test pytest (`pytest`) untuk menjamin semua 240+ pengujian lulus 100%.
3. **Audit & Log Verifikasi**:
   - Pastikan setiap aksi (kunci klien, buka kunci klien, remote kunci kasir, remote buka kasir) tercatat rapi di tabel audit log sistem.

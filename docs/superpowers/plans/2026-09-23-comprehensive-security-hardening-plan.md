# Rencana Implementasi: Penguatan Keamanan & Remediasi Kerentanan Komprehensif

> **Untuk agen pekerja:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini tugas per tugas. Langkah-langkah menggunakan sintaks kotak centang (`- [ ]`) untuk pelacakan.

**Tujuan:** Memperkuat keamanan seluruh sistem TMBilling dengan memperbaiki celah Zip Slip, IP Whitelist header spoofing, otentikasi emergency login, isolasi session cookie pada multi-branch relay, restorasi proteksi CSRF, dan eliminasi potensi DoS pada transaksi paket.

**Arsitektur:** Menerapkan validasi kanonikal path untuk ekstraksi ZIP, sanitasi pengambilan IP client dari reverse proxy terpercaya, validasi Strict Socket IP & MAC Binding pada endpoint emergency login, pemisahan state Bearer request ke `flask.g`, pengaktifan kembali CSRF token pada endpoint kasir berbasis cookie, dan optimasi matematis bounded transaksi paket.

**Tech Stack:** Python 3.11+, Flask 3, Werkzeug, SQLAlchemy, Rust (Tauri v2), pytest.

---

### Tugas 1: Remediasi Zip Slip & Path Traversal pada Upload Plugin & Rilis Migrasi

**Berkas:**
- Modifikasi: `app/routes/settings/plugin_routes.py`
- Modifikasi: `app/routes/settings/migration_routes.py`
- Pengujian: `tests/test_security_zip_slip.py`

- [ ] **Langkah 1: Buat unit test yang menguji penolakan ZIP berbahaya (payload traversal)**
- [ ] **Langkah 2: Jalankan test untuk memastikan test gagal sebelum perbaikan (`.venv/Scripts/python.exe -m pytest tests/test_security_zip_slip.py`)**
- [ ] **Langkah 3: Implementasikan fungsi validasi path kanonikal yang aman dan filter ekstraksi**
- [ ] **Langkah 4: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 5: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/routes/settings/plugin_routes.py app/routes/settings/migration_routes.py tests/test_security_zip_slip.py
  git commit -m "perbaiki(keamanan): cegah celah zip slip dan path traversal pada upload plugin serta update rilis

- Tambahkan fungsi validasi path kanonikal \`is_safe_path\` untuk verifikasi setiap entri ZIP sebelum diekstrak.
- Terapkan pengecekan ketat pada manifest.json plugin agar plugin_id hanya berisi karakter alfanumerik aman (mencegah traversal nama folder).
- Tangani error BadZipFile dan path tidak aman dengan pesan error yang deskriptif dan log audit.
- Tambahkan test suite \`tests/test_security_zip_slip.py\` untuk menguji payload traversal dan arsip berbahaya."
  ```

---

### Tugas 2: Proteksi Spoofing IP Whitelist (`X-Forwarded-For`)

**Berkas:**
- Modifikasi: `app/services/ip_whitelist/ip_whitelist_service.py`
- Pengujian: `tests/test_ip_whitelist.py`

- [ ] **Langkah 1: Buat test untuk memastikan spoofing header `X-Forwarded-For` dari IP asing ditolak**
- [ ] **Langkah 2: Jalankan test untuk memverifikasi kegagalan (`.venv/Scripts/python.exe -m pytest tests/test_ip_whitelist.py -k test_spoofed_ip`)**
- [ ] **Langkah 3: Perbaiki `extract_client_ip()` agar mengutamakan `remote_addr` dari soket TCP**
- [ ] **Langkah 4: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 5: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/services/ip_whitelist/ip_whitelist_service.py tests/test_ip_whitelist.py
  git commit -m "perbaiki(keamanan): cegah bypass ip whitelist dengan memprioritaskan remote_addr soket tcp

- Ubah \`extract_client_ip()\` di \`ip_whitelist_service.py\` agar mengutamakan \`request.remote_addr\` dari soket TCP fisik.
- Batasi parsing header \`X-Forwarded-For\` dan \`CF-Connecting-IP\` hanya jika koneksi berasal dari reverse proxy terpercaya/Cloudflare Tunnel.
- Tolak permintaan yang mencoba memalsukan header IP klien dari jaringan lokal/LAN.
- Tambahkan unit test di \`tests/test_ip_whitelist.py\` untuk verifikasi skenario spoofing header X-Forwarded-For."
  ```

---

### Tugas 3: Penguatan Endpoint `/emergency-login` via Strict Socket IP & MAC Binding

**Berkas:**
- Modifikasi: `app/routes/client/client_routes.py`
- Modifikasi: `app/services/client/client_service.py`
- Pengujian: `tests/test_emergency_login_auth.py`

- [ ] **Langkah 1: Buat unit test verifikasi penolakan emergency login jika IP soket fisik (`remote_addr`) tidak cocok dengan IP PC terdaftar**
- [ ] **Langkah 2: Jalankan test dan pastikan gagal (`.venv/Scripts/python.exe -m pytest tests/test_emergency_login_auth.py`)**
- [ ] **Langkah 3: Implementasikan validasi Strict Socket IP (`request.remote_addr == pc.ip_address`) dan pencocokan MAC di `ClientService.emergency_login`**
- [ ] **Langkah 4: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 5: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/routes/client/client_routes.py app/services/client/client_service.py tests/test_emergency_login_auth.py
  git commit -m "perbaiki(keamanan): perketat autentikasi emergency login klien dengan strict socket ip dan validasi mac address fisik

- Validasi kecocokan IP soket TCP fisik asli (\`request.remote_addr\`) dengan \`pc.ip_address\` yang terdaftar pada database.
- Cocokkan MAC address fisik perangkat klien pada payload emergency login untuk mencegah impersonasi PC lain di LAN.
- Pertahankan password darurat lokal di Registry Klien tanpa perlu sinkronisasi manual atau risiko terekspos ke jaringan.
- Buat test suite di \`tests/test_emergency_login_auth.py\` untuk memvalidasi penolakan upaya login darurat dari IP asing."
  ```

---

### Tugas 4: Isolasi Konteks Stateless Bearer Relay dari Session Cookie

**Berkas:**
- Modifikasi: `app/middleware/auth.py`
- Pengujian: `tests/test_auth_branch_relay_isolation.py`

- [ ] **Langkah 1: Buat test untuk memastikan request Bearer token tidak menghasilkan cookie admin**
- [ ] **Langkah 2: Jalankan test dan pastikan gagal (`.venv/Scripts/python.exe -m pytest tests/test_auth_branch_relay_isolation.py`)**
- [ ] **Langkah 3: Refaktor `_apply_branch_relay_identity()` agar menyimpan state ke `flask.g` tanpa memutasi `flask.session`**
- [ ] **Langkah 4: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 5: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/middleware/auth.py tests/test_auth_branch_relay_isolation.py
  git commit -m "perbaiki(keamanan): isolasi relay multi-cabang bearer ke flask.g untuk cegah pencemaran cookie sesi browser

- Refaktor \`_apply_branch_relay_identity()\` di \`app/middleware/auth.py\` agar menyimpan identitas operator ke \`flask.g\`.
- Hentikan mutasi \`flask.session\` pada permintaan stateless yang menggunakan \`Authorization: Bearer\`.
- Cegah kebocoran hak akses admin ke browser klien saat melayani request relay antar-cabang.
- Buat unit test di \`tests/test_auth_branch_relay_isolation.py\` untuk memastikan session cookie tidak terbuat dari request bearer."
  ```

---

### Tugas 5: Koreksi Pengecualian Blueprint CSRF

**Berkas:**
- Modifikasi: `app/__init__.py`
- Pengujian: `tests/test_csrf_protection.py`

- [ ] **Langkah 1: Buat test verifikasi proteksi CSRF pada `shift_api_bp`, `branch_api_bp`, dan `tutorial_api_bp`**
- [ ] **Langkah 2: Perbarui `_register_blueprints()` di `app/__init__.py` untuk menghapus `csrf.exempt` berlebih**
- [ ] **Langkah 3: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 4: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/__init__.py tests/test_csrf_protection.py
  git commit -m "perbaiki(keamanan): pulihkan proteksi csrf pada blueprint kasir berbasis cookie sesi

- Hapus pembebasan \`csrf.exempt()\` berlebih pada \`shift_api_bp\`, \`branch_api_bp\`, dan \`tutorial_api_bp\` di \`app/__init__.py\`.
- Pertahankan pengecualian otomatis untuk request antar-cabang yang menggunakan Bearer Token melalui \`TMBillingCSRFProtect\`.
- Pastikan seluruh form dan AJAX kasir berbasis session cookie terlindungi dari serangan Cross-Site Request Forgery.
- Buat test suite di \`tests/test_csrf_protection.py\` untuk memvalidasi penolakan request POST/PUT tanpa token CSRF."
  ```

---

### Tugas 6: Pencegahan CPU DoS & Integer/Timedelta Overflow pada Transaksi Paket

**Berkas:**
- Modifikasi: `app/services/member/member_service.py`
- Modifikasi: `app/services/sesi/sesi_service.py`
- Pengujian: `tests/test_package_transaction_bounds.py`

- [ ] **Langkah 1: Buat test untuk verifikasi batas `qty` dan perhitungan waktu langsung**
- [ ] **Langkah 2: Implementasikan perhitungan matematis langsung (`qty * durasi`, `qty * kadaluarsa`) serta batasi `1 <= qty <= 100`**
- [ ] **Langkah 3: Jalankan test kembali dan pastikan lulus (PASS)**
- [ ] **Langkah 4: Commit perubahan dengan pesan commit terstruktur dan rinci:**
  ```powershell
  git add app/services/member/member_service.py app/services/sesi/sesi_service.py tests/test_package_transaction_bounds.py
  git commit -m "perbaiki(keamanan): optimasi transaksi paket dengan perhitungan waktu matematis dan batas qty maksimal

- Ganti iterasi perulangan \`for _ in range(qty)\` di \`member_service.py\` dan \`sesi_service.py\` dengan perkalian matematis langsung.
- Terapkan validasi kuantitas paket \`1 <= qty <= 100\` untuk mencegah serangan CPU DoS dan integer/timedelta overflow.
- Perbarui kalkulasi durasi dan masa aktif paket agar atomic dan efisien.
- Tambahkan test suite di \`tests/test_package_transaction_bounds.py\` untuk menguji batas kuantitas dan kalkulasi paket."
  ```

---

### Tugas 7: Verifikasi Menyeluruh & Re-indexing Codebase

**Berkas:**
- Pengujian: Seluruh test di folder `tests/`

- [ ] **Langkah 1: Jalankan seluruh test suite (`.venv/Scripts/python.exe -m pytest -q`)**
- [ ] **Langkah 2: Jalankan MCP `codebase-memory` (`index_repository`)**
- [ ] **Langkah 3: Perbarui dokumen walkthrough dan push ke git repository:**
  ```powershell
  git add .
  git commit -m "koreksi(keamanan): verifikasi menyeluruh seluruh test suite keamanan dan perbarui dokumentasi sistem

- Jalankan pengujian menyeluruh (100% PASS) mencakup seluruh test suite unit, integrasi, dan keamanan baru.
- Jalankan sinkronisasi dan re-indexing struktur codebase menggunakan MCP codebase-memory.
- Perbarui catatan walkthrough dan panduan keamanan sistem TMBilling."
  git push origin v1.6.2
  ```

<!-- markdownlint-disable MD033 MD041 -->
<p align="center">
  <img src="tm.png" alt="TMBilling" width="360" />
</p>

<h1 align="center">🖥️ TMBilling</h1>

<p align="center">
  <strong>Sistem Manajemen Billing Warnet & Game Center Modern (Enterprise Grade)</strong>
  <br />
  Backend Flask · Frontend Modular Vanilla JS · WarnetAgent Tauri 1.5 & Rust · TightVNC Remote Control
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/Version-v1.6.5--rc2-blue.svg?style=flat-square" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python" />
  <img alt="Flask" src="https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-v1.5-FFC131?style=flat-square&logo=tauri" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75%2B-DEA584?style=flat-square&logo=rust" />
  <img alt="Database" src="https://img.shields.io/badge/Database-SQLite-003B57?style=flat-square&logo=sqlite" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" />
</p>

---

## 📖 Tentang TMBilling

**TMBilling** adalah solusi manajemen operasional terpadu untuk warnet, cybercafe, dan arena esports modern. Dirancang dengan arsitektur **3-Layer Separation of Concerns (SoC)** yang tangguh, sistem ini mengintegrasikan server billing kasir, kasir kantin/FnB terpadu, kendali jarak jauh (remote control TightVNC berbasis web), monitoring hardware baseline anti-maling, dan pertahanan klien 5-lapis (*5-Layer Anti-Tamper Security*).

> 📚 **Dokumentasi Lengkap (Single Source of Truth):**  
> Untuk panduan arsitektur mendalam, spesifikasi fitur lengkap, katalog 34 Blueprint & 254 Route API, dan skema database, buka **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)**.

---

## ✨ Sorotan Fitur Utama (v1.6.5-rc3)

- 🔐 **Zero-Config Out-of-the-Box Security**: Instalasi instan tanpa konfigurasi manual yang rumit. Server otomatis meng-generate `SECRET_KEY` kuat 64-hex persisten ke `.env`, membuat password superadmin acak sekali-pakai (`initial_admin.txt`), auto-generate password VNC unik, dan memproteksi pembaruan sistem via URL Whitelist anti-SSRF.
- ☁️ **Cloudflare Tunnel & Remote Access**: Akses dashboard kasir & owner dari internet secara instan tanpa perlu port-forwarding router atau IP publik statis.
- ⚡ **Multi-PC Selection & Batch Actions (`remoteBatch`)**: Seleksi banyak PC sekaligus (drag select/checkbox) untuk Shutdown, Restart, Kunci, Pindah PC, atau Terapkan Paket promosi secara massal.
- 🖥️ **TightVNC Remote Control + Dual-Clipboard Sync**: Kendalikan layar, keyboard, dan mouse PC klien langsung dari browser web kasir dengan sinkronisasi clipboard teks dua arah otomatis (Port 5900 Loopback).
- 🔌 **Blackout Auto-Recovery System**: Toleransi pemadaman listrik otomatis. Durasi dan saldo pelanggan tidak hilang ketika terjadi mati lampu mendadak (*Auto Session Resume*).
- 🛡️ **5-Layer WarnetAgent Anti-Tamper Security**: Proteksi klien berlapis menggunakan Win32 Low-level Hooks, Kiosk lockdown, integritas Registry SHA-256 Hashes Dual-Hive (`HKCU` & `HKLM`), dan Watchdog Supervisor Daemon (`MGCTM.exe`).
- 🔍 **Hardware Baseline & Theft Alerts**: Snapshot spesifikasi hardware (CPU, GPU, RAM, Disk serials) untuk mendeteksi penggantian atau pencurian sparepart PC secara *real-time*.
- 🔒 **Kunci Meja AFK / Istirahat Sementara (Screen Lock)**: Fitur penguncian layar PC klien saat ditinggal istirahat dengan tampilan hitam polos minimalis, countdown billing real-time, autentikasi password member / PIN guest, remote control kasir, dan master unlock.
- 💼 **Shift Kasir & Hitung Buta (*Blind Cash Reconciliation*)**: Sistem serah terima shift anti-manipulasi kasir dengan input modal awal dinamis, *blind count* uang fisik laci, auto-audit selisih (surplus/defisit), cetak struk handover thermal 58mm, dan fitur *Admin Force Close*.
- 🍔 **POS Kantin & Log Mutasi Stok Inventaris**: Kasir penjualan makanan/minuman dengan stok unlimited/limited, audit log mutasi stok (`MenuStockLog`), restock barang, multi-payment (Tunai/QRIS/Transfer), dan cetak struk thermal 58mm/80mm.
- 📋 **Dynamic Tutorials CMS**: Modul SOP dan panduan operator warnet bawaan berbasis custom CKEditor 5 WYSIWYG.
- 📂 **Process Monitor**: Pantau dan matikan proses aplikasi yang not-responding dari jarak jauh.
- 🗂️ **Arsip vs Hapus Permanen Terpisah**: Setiap PC, paket, member, user, game, grup, dan menu punya dua aksi berbeda — arsip (nonaktifkan, bisa dipulihkan) dan hapus permanen yang meminta konfirmasi centang, melepas relasi riwayat tanpa menghapus data transaksi. Semua data terarsip terkumpul di tab **Data Diarsipkan** dengan tombol pulihkan.
- 📱 **Responsive Dual-Layout**: Antarmuka adaptif untuk layar 1024px, 1920px Full HD, serta layar sentuh tablet/smartphone.

---

## 📦 Struktur Repositori

```text
c:\Project GIT\TMBilling
├── app/                        # Backend Server Flask & Frontend Kasir Web
│   ├── config.py               # Single Source of Version Truth (v1.6.5-rc3)
│   ├── models/                 # 24 Model Database SQLAlchemy
│   ├── routes/                 # 34 Blueprint REST + VNC Bridge (254 Route)
│   ├── services/               # 36 Service Class Logika Bisnis (31 Sub-Domain)
│   └── static/js/kasir/        # Modular Vanilla ES6 Frontend JS
├── docs/                       # Master Dokumentasi
│   ├── DOCUMENTATION.md        # Master Technical Manual & Single Source of Truth
│   └── superpowers/            # Arsip Rencana Kerja & Spesifikasi
├── tools/ckeditor-builder/     # Custom CKEditor 5 Build untuk CMS
├── WarnetAgent/                # Source Code Klien Warnet (Rust / Tauri 1.5)
│   ├── TMBillingTauri/         # Klien Utama (Lockscreen, Overlay, Win32 Hooks)
│   ├── TMBilling_Monitor/      # Modul Hardware Monitor & Process Helper
│   ├── MGCTM/                  # Watchdog Service Supervisor
│   ├── TMBilling_Uninstaller/  # Secure Uninstaller
│   └── Deploy/                 # Paket Siap Deploy Klien & Skrip Instalasi
├── install.bat                 # Skrip Instalasi Server 1-Klik
├── start.bat                   # Skrip Menyalakan Server (Port 7015 Background)
├── stop.bat                    # Skrip Menghentikan Server
├── developer_install.bat       # Skrip Inisialisasi Environment Pengembang
├── build_and_deploy.bat        # Skrip Kompilasi Seluruh Binary Klien ke Deploy
├── CHANGELOG.md                # Riwayat Rilis & Update Per Versi
└── README.md                   # File Ini
```

---

## 🚀 Panduan Instalasi & Pengoperasian Cepat

### Prasyarat Sistem:
- **Server Billing**: Windows 10/11 / Windows Server, Python 3.11+, browser dashboard Chrome/Edge 111+ (CSS Tailwind 4 memakai OKLCH & `@property`), Koneksi Internet (untuk dependensi awal).
- **PC Klien Warnet**: Windows 10/11 64-bit, Microsoft Edge WebView2 Runtime.
- **Pengembang (Opsional)**: Node.js 20+ (Tailwind CLI 4), Rust & Cargo 1.75+, .NET Framework 4.5+ SDK.

---

### 1. Setup & Menjalankan Server Billing (Komputer Server / Kasir)

1. **Unduh Paket Server**:
   Unduh paket rilis server terbaru (misal: `TMBilling_Server_v1.6.5-rc3.zip`) dari halaman **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)** lalu ekstrak di komputer server/kasir Anda (contoh: `C:\TMBilling`). *(Bagi developer, silakan gunakan `git clone` pada [Panduan Pengembang](#3-panduan-pengembang-developer--build-pipeline))*.

2. **Instalasi Server 1-Klik**:
   Jalankan file `install.bat` di direktori utama:
   ```cmd
   install.bat
   ```
   > Skrip otomatis memeriksa Python, membuat virtual environment (`.venv`), memasang seluruh dependensi dari `requirements.txt`, meng-generate file `.env` dengan `SECRET_KEY` acak, dan menginisialisasi basis data SQLite.

3. **Menyalakan Server**:
   ```cmd
   start.bat
   ```
   > Server otomatis berjalan di background pada port `7015`. Buka browser ke:
   > **`http://localhost:7015`**  
   > *(Kredensial Superadmin Awal: Username `admin`, Password acak dicetak di terminal startup dan disimpan pada berkas `initial_admin.txt` di root folder. Harap login dan segera ganti di menu **Manajemen Staff > Akun Kasir & Admin**)*.

4. **Menghentikan Server**:
   ```cmd
   stop.bat
   ```

5. **Cara Pembaruan / Update Versi Server**:
   - **Update Otomatis 1-Klik (Mulai v1.6.5-rc2)**:
     Buka Dashboard Kasir > menu **Pengaturan** > sub-tab **Migrasi & Update**, klik tombol **Cek Pembaruan GitHub**, lalu tekan **Mulai Update 1-Klik**. Sistem otomatis mencadangkan database, mengekstrak rilis baru, memasang dependensi, menjalankan migrasi skema, dan memulai ulang server tanpa mengunci file. Hanya satu pembaruan dapat berjalan pada satu waktu (klaim `instance/update.lock`; permintaan kedua dibalas `409`), penukaran berkas dicatat di `instance/update_journal.json` sehingga pembaruan yang terputus di tengah jalan dipulihkan otomatis pada percobaan berikutnya, dan paket hanya dipublikasikan lewat `os.replace` setelah unduhan selesai. Bila pemasangan dependensi atau migrasi gagal, updater berhenti dan **tidak** menyalakan server (detail rollback ada di `docs/DOCUMENTATION.md` §9.3).
   - **Update Cepat via `update.bat`**:
     Unduh rilis `TMBilling_Server_v<versi>.zip`, lalu jalankan:
     ```cmd
     update.bat TMBilling_Server_v1.6.5-rc3.zip
     ```
     Atau cukup *drag-and-drop* file ZIP rilis ke file `update.bat`.
   - **Update Manual (Bagi yang memperbarui dari versi terdahulu)**:
     1. Pastikan Python **3.11+** (wajib untuk SQLAlchemy 2.1):
        ```cmd
        .venv\Scripts\python.exe -c "import sys; print(sys.version)"
        ```
     2. Hentikan server, lalu pastikan port `7015` benar-benar lepas:
        ```cmd
        stop.bat
        netstat -ano | findstr :7015
        ```
        Tidak boleh ada baris `LISTENING`.
     3. Cadangkan database sebelum menimpa berkas:
        ```cmd
        .venv\Scripts\python.exe -c "import sqlite3,os; os.makedirs('backups',exist_ok=True); s=sqlite3.connect(r'instance\warnet.db'); d=sqlite3.connect(r'backups\manual_pre_update.db'); s.backup(d); s.close(); d.close()"
        copy .env .env.bak
        ```
     4. Unduh paket rilis server terbaru (`TMBilling_Server_v<versi>.zip`) dari **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)**, lalu ekstrak dan timpa ke folder instalasi:
        ```powershell
        Expand-Archive -Path TMBilling_Server_v<versi>.zip -DestinationPath . -Force
        ```
        *Data aman: `.env`, `instance/`, dan `backups/` tidak ada di dalam ZIP dan tidak akan tertimpa. Jangan hapus `plugins/` bila Anda memakai plugin kustom.*
     5. Pasang dependensi (wajib bila `requirements.txt` berubah):
        ```cmd
        .venv\Scripts\python.exe -m pip install -r requirements.txt
        ```
     6. Jalankan migrasi skema (wajib bila rilis membawa perubahan skema; aman diulang):
        ```cmd
        .venv\Scripts\python.exe install_scripts\run_migration.py
        ```
     7. Nyalakan kembali server dan verifikasi:
        ```cmd
        start.bat
        ```
        Buka `http://localhost:7015/api/health` dan pastikan `status` bernilai `ok` (atau `degraded` hanya bila disk/backup bermasalah), lalu uji login dan satu transaksi.

---

### 2. Setup & Instalasi WarnetAgent (PC Klien Warnet)

1. **Unduh Paket Klien**:
   Unduh paket rilis klien terbaru (misal: `TMBilling_Client_v1.6.5-rc3.zip`) dari halaman **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)** lalu ekstrak ke PC Klien *(atau salin isi folder `WarnetAgent\Deploy` jika Anda mengunduh full repository)*.
2. Klik kanan **`install.bat`** lalu pilih **Run as administrator** (atau jalankan biasa).
3. Masukkan **IP Server Billing** saat diminta (contoh: `192.168.1.100`). Port default `7015` akan otomatis digunakan *(kecuali jika Anda mengubah port server billing, Anda dapat memasukkan format `IP:PORT`, contoh: `192.168.1.100:8080`)*. Masukkan juga **API Key** yang dapat Anda cek dan kelola di dashboard server melalui menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System (Client API Key)**.

> [!WARNING]
> **PENTING — KEAMANAN API KEY & KREDENSIAL DARURAT:**
> - **Wajib Ganti Default API Key**: Jangan gunakan API Key bawaan (`TM2026QWERTY-api-key`). Anda dapat melihat dan mengubah API Key secara praktis langsung dari dashboard di menu **Sidebar > Pengaturan > Umum & Keamanan > API Key System**, lalu klik **Simpan API Key** *(atau bagi yang memahami konfigurasi server, dapat langsung menyesuaikan variabel `CLIENT_API_KEY` pada file `.env`)*. Pastikan API Key yang diinput pada PC klien sama persis dengan yang ada di server dan selalu jaga kerahasiaannya.
> - **Wajib Ganti Emergency User & Password**: Saat installer menanyakan kredensial admin darurat (*Emergency Access*), harap segera ubah dari nilai default (`TMBilling` / `TM123qaz!@#`) untuk mencegah akses darurat tak sah di PC klien.
> - **Wajib Hapus / Amankan Berkas `admin_credentials.txt`**: Setelah instalasi selesai, installer membuat catatan kredensial `admin_credentials.txt` di folder instalasi (contoh: `C:\TMBILLING\admin_credentials.txt`). **Segera catat kredensial tersebut lalu hapus berkasnya (atau pindahkan ke tempat aman admin)** agar tidak terlihat atau diakses oleh pengguna/pelanggan di PC klien!

4. **Otomatisasi Instalasi**:
   - Skrip menyalin seluruh binary (`TMBilling.exe`, `MGCTM.exe`, `TMMonitor.exe`, `WebView2Loader.dll`, `mtm.exe`, `TightVNC`).
   - Mendaftarkan konfigurasi Registry Windows (`HKCU` & `HKLM`) dan TightVNC port `5900` loopback.
   - Menambahkan aturan Windows Defender Firewall otomatis untuk port 5900 dan executable.
   - Mendaftarkan shortcut Startup Windows agar agen otomatis aktif saat PC booting.
   - Menghitung hash SHA-256 binary untuk proteksi integritas dan langsung menjalankan agen di background.

5. **Cara Pembaruan / Update Versi Klien**:
   Karena biner klien memiliki proteksi anti-tamper dan pengawas supervisor ganda (*watchdog mutual guard*), pembaruan versi klien dilakukan dengan alur bersih berikut:
   1. Jalankan **`uninstall.bat`** (atau `TMBilling_Uninstaller.exe`) di PC klien untuk menghentikan seluruh proses proteksi secara legal dan membersihkan instalasi versi lama.
   2. Unduh dan ekstrak paket klien versi terbaru (`TMBilling_Client_v<versi>.zip`) dari **[GitHub Releases](https://github.com/milanalfandiismail/TMBilling/releases)**.
   3. Jalankan **`install.bat`** seperti biasa, lalu masukkan IP Server Billing dan API Key yang sesuai.

6. **Uninstalasi Klien**:
   Jalankan **`uninstall.bat`** di PC klien untuk meluncurkan panel uninstalasi aman.

---

### 3. Panduan Pengembang (Developer & Build Pipeline)

1. **Clone Repositori**:
   ```bash
   git clone https://github.com/milanalfandiismail/TMBilling.git
   cd TMBilling
   ```

2. **Inisialisasi Environment Pengembang**:
   Jalankan skrip untuk otomatis membuat virtual environment Python, menginstal dependensi backend, node modules, dan build aset CSS:
   ```cmd
   developer_install.bat
   ```

3. **Kompilasi & Build Seluruh Komponen Klien (Rust / Tauri 1.5)**:
   ```cmd
   build_and_deploy.bat
   ```
   > Mengompilasi seluruh modul Rust (`TMBillingTauri`, `TMBilling_Monitor`, `MGCTM`, `TMBilling_Uninstaller`, `mtm`), microservice `TMLHMService`, dan menyalin seluruh binary rilis ke folder `WarnetAgent\Deploy\`.

4. **Menjalankan Pengujian Backend (Pytest)**:
   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
   npm run test:unit
   ```
   > `npm run test:unit` menjalankan seluruh unit test paralel memakai semua core (per-worker DB/temp/backup/notes). Gunakan `.\.venv\Scripts\python.exe -m pytest` untuk mode serial.

5. **Menjalankan Pengujian End-to-End Browser (Playwright)**:
   ```powershell
   npm run test:e2e
   ```
   > 15 suite Chromium (374 check) berjalan paralel otomatis memakai seluruh CPU (`--jobs 1` untuk serial). Setiap suite memakai database, port, catatan, dan backup sendiri; `instance/warnet.db`, `backups/`, `instance/notes/`, `.env`, dan `initial_admin.txt` dijaga guard sha256.

6. **Memeriksa Kompilasi Klien Rust**:
   ```powershell
   cd WarnetAgent\TMBillingTauri\src-tauri
   cargo check
   ```

---

## 📚 Navigasi Dokumentasi

| Dokumen | Deskripsi |
| :--- | :--- |
| **[docs/DOCUMENTATION.md](file:///c:/Project%20GIT/TMBilling/docs/DOCUMENTATION.md)** | **Master Dokumentasi Teknis (Single Source of Truth)** — Memuat arsitektur sistem, katalog lengkap 31 domain fitur, 34 Blueprint & 254 Route REST API, skema 24 model database, panduan backend/frontend/Rust, dan spesifikasi VNC bridge (WebSocket via Websockify). |
| **[CHANGELOG.md](file:///c:/Project%20GIT/TMBilling/CHANGELOG.md)** | **Catatan Rilis** — Riwayat log perubahan dan rilis dari `v1.0.0` hingga `v1.6.5-rc3`. |

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

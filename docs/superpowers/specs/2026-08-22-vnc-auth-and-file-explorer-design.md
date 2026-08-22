# Spesifikasi Desain: Otomasi Password Remote Control Server & Web File Explorer

- **Status**: Disetujui
- **Tanggal**: 2026-08-22
- **Kategori**: Architectural / Subsystem Feature

---

## 1. Ringkasan Eksekutif

Pembaruan ini mencakup dua cakupan (*scope*) fungsionalitas utama pada sistem TMBilling:
1. **Scope 1 — Otomasi Password Remote Control Server (TightVNC / noVNC)**:
   Menghilangkan kebutuhan input manual password TightVNC oleh admin di antarmuka web. Sistem mengambil dan menginjeksi kredensial yang terkonfigurasi secara terpusat dan aman pada level backend ke client noVNC via API terproteksi peran admin.
2. **Scope 2 — Web File Explorer & Text Editor**:
   Menyediakan modul pengelola berkas berbasis web di panel admin untuk menjelajahi folder server, melihat metadata berkas, membaca dan menyunting berkas teks/kode sumber secara aman (berbasis CodeMirror 6), dengan batasan sandbox *allowed roots*, penanganan berkas biner, batas ukuran 5MB, penulisan atomik, dan pencatatan audit log lengkap.

---

## 2. Arsitektur Teknis

```
[ Browser Admin / Kasir ]
       │
       ├── (1) Tab Remote Control ────▶ API POST /api/v1/kasir/vnc/start (Auth Admin)
       │                                     │ (Mengembalikan listen_port & vnc_password)
       │                                     ▼
       │                               noVNC RFB (Kredensial otomatis terinjeksi)
       │                                     │ ws:// / wss://
       │                                     ▼
       │                               Websockify Proxy (Port 8081) ──▶ TightVNC Server (127.0.0.1:5900)
       │
       └── (2) Tab File Explorer ─────▶ API /api/v1/kasir/fileexplorer/* (Auth Admin)
                                             │
                                             ▼
                                     FileExplorerService
                                     - Canonical Path & Allowed Roots Check
                                     - Binary Null-Byte Detection
                                     - Max 5MB Limit
                                     - Atomic Temp-Write & mtime Lock
                                             │
                                             ▼
                                     [ Local Server Filesystem ]
```

---

## 3. Detail Desain Scope 1: Otomasi Password Remote Control Server

### 3.1 Penyimpanan & Manajemen Kredensial
- Password VNC disimpan di tabel database `settings` dengan key `vnc_password` melalui `SettingsService`.
- Nilai default dapat diisi melalui konfigurasi atau input saat pertama kali, dan dapat diperbarui oleh administrator.
- Nilai password **TIDAK PERNAH** dicatat ke audit log atau diekspos ke peran non-admin (kasir biasa).

### 3.2 Alur API & Frontend
1. Saat admin menekan tombol `▶ Hubungkan` di [`remote_server.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/remote_server.html), modul [`vnc_client.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/remote/vnc_client.js) memanggil `POST /api/v1/kasir/vnc/start`.
2. Endpoint backend mengembalikan respon:
   ```json
   {
     "success": true,
     "message": "Websockify berhasil dinyalakan",
     "listen_port": 8081,
     "vnc_password": "..."
   }
   ```
3. `vnc_client.js` langsung mengoper `credentials: { password: startRes.vnc_password || '' }` ke objek `RFBClass`.
4. Field input password manual pada toolbar `remote_server.html` dihilangkan atau digantikan dengan indikator status kredensial otomatis.
5. Jika server TightVNC tetap menolak kredensial (misal password diubah di registry Windows), event listener `credentialsrequired` tetap bertindak sebagai *fallback prompt*.

---

## 4. Detail Desain Scope 2: Web File Explorer & Text Editor

### 4.1 Batasan Keamanan & Sandbox Filesystem
- **Allowed Roots**:
  - Disimpan pada tabel `Settings` dengan key `file_explorer_allowed_roots` (JSON array).
  - Default: Direktori instalasi TMBilling (`c:\Project GIT\TMBilling`).
  - Administrator dapat menambah/mengurangi folder (misal `D:\Backups`) via modal pengaturan direktori.
- **Validasi Canonical Path**:
  - Menggunakan `os.path.realpath` / `pathlib.Path.resolve()`.
  - Memverifikasi apakah path target merupakan turunan langsung dari salah satu *allowed roots*.
  - Melarang symlink/junction point yang mengarah ke luar root, serta memblokir pola traversal `..`.
- **Deteksi Berkas Biner**:
  - Mengecek ekstensi biner umum (.exe, .dll, .db, .zip, .png, dll.) dan memindai 8000 byte pertama untuk karakter *null byte* `\x00`.
  - Berkas biner hanya dapat dilihat metadatanya dan tidak bisa dibuka/disunting di text editor.
- **Batas Ukuran & Encoding**:
  - Membaca/menyunting teks dibatasi maksimal **5 MB**.
  - Decoding menggunakan UTF-8 dengan fallback Latin-1.
- **Penulisan Atomik & Optimistic Concurrency**:
  - Penulisan berkas baru atau perubahan disimpan ke file `.tmp` di direktori yang sama terlebih dahulu, lalu di-*replace* menggunakan `os.replace`.
  - Memverifikasi `expected_mtime` sebelum menimpa berkas untuk menghindari *overwrite conflict*.

### 4.2 Kontrak API `/api/v1/kasir/fileexplorer/`
- `GET /roots`: Mengambil daftar folder yang diizinkan.
- `POST /roots`: Memperbarui daftar folder yang diizinkan (`{"roots": [...]}`).
- `GET /list?path=<canonical_path>`: Mengambil daftar isi folder (berkas & subfolder).
- `GET /read?path=<canonical_path>`: Membaca teks berkas untuk editor CodeMirror.
- `POST /save`: Menyimpan perubahan konten teks (`{"path": "...", "content": "...", "expected_mtime": ...}`).
- `POST /create`: Membuat berkas atau folder baru (`{"parent_path": "...", "name": "...", "is_dir": false}`).
- `POST /rename`: Mengganti nama berkas/folder (`{"path": "...", "new_name": "..."}`).
- `POST /delete`: Menghapus berkas/folder (`{"path": "..."}`).

### 4.3 Audit Logging
Setiap operasi manipulasi berkas dicatat ke tabel log sistem:
- `FILE_EXPLORER_SAVE`: Modifikasi berkas.
- `FILE_EXPLORER_CREATE`: Pembuatan berkas/folder.
- `FILE_EXPLORER_RENAME`: Perubahan nama.
- `FILE_EXPLORER_DELETE`: Penghapusan berkas/folder.
- `FILE_EXPLORER_ROOTS_UPDATE`: Perubahan daftar allowed roots.

### 4.4 Antarmuka Pengguna (Frontend)
- **Sidebar**: Menambahkan menu `📁 File Explorer` (khusus peran admin) di `sidebar.html`.
- **Tab View (`fileexplorer.html`)**:
  - Breadcrumbs navigasi path yang dapat diklik.
  - Split View: Panel kiri (Pohon direktori & daftar berkas dengan ukuran dan waktu modifikasi) + Panel kanan (CodeMirror 6 Text Editor, nomor baris, status bar, shortcut `Ctrl+S`).
  - Modal Kelola Folder Diizinkan (*Allowed Roots Manager*).

---

## 5. Rencana Pengujian

1. **Unit & Security Tests**:
   - `tests/test_vnc_password_automation.py`: Menguji endpoint VNC status, start, dan pembacaan konfigurasi password.
   - `tests/test_fileexplorer_service.py`: Menguji manipulasi folder/file, CRUD, penulisan atomik, dan proteksi mtime.
   - `tests/test_fileexplorer_security.py`: Menguji penolakan path traversal (`../../windows`), proteksi file biner, batas ukuran 5MB, dan RBAC akses kasir non-admin.
   - `tests/test_fileexplorer_api.py`: Menguji seluruh endpoint API File Explorer.
2. **Full Regression Test**: Menjalankan seluruh test suite yang ada untuk memastikan 0 regresi.

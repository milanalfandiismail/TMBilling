# Spesifikasi Desain: Komponen Web File Explorer

- **Status**: Disetujui
- **Penulis**: Antigravity & Pasangan Pengembang
- **Tanggal**: 15-08-2026
- **Kategori**: Architectural / Subsystem

---

## 1. Ringkasan Eksekutif

TMBilling membutuhkan fitur **File Explorer berbasis web** yang disematkan langsung di dashboard kasir/admin. Fitur ini memungkinkan administrator untuk menjelajahi direktori server, melihat metadata berkas, membuka dan menyunting berkas teks/kode sumber secara aman, serta mengonfigurasi direktori yang diizinkan (*allowed roots*) langsung dari antarmuka web tanpa membuka remote desktop atau memberikan akses shell/command sembarangan.

---

## 2. Arsitektur & Pilihan Teknologi

### 2.1 Keputusan Teknologi

1. **Integrasi Backend**: Menggunakan backend Python Flask secara langsung dengan modul `os`, `pathlib`, dan `shutil`. Service background Rust terpisah tidak diperlukan karena backend Flask berjalan langsung di mesin server lokal dan telah memiliki akses filesystem lokal secara penuh.
2. **Antarmuka Pengguna (Frontend)**:
   - Tampilan tema *Chamber Noir Dark* konsisten dengan tema TMBilling (`#0a0a0a`, `#171717`, `#1c1c1c`, Tailwind CSS).
   - Code Editor terintegrasi ditenagai oleh **CodeMirror 6** (CDN bundle) yang dilengkapi *syntax highlighting*, nomor baris, dan penyesuaian tema gelap.
3. **Penempatan Navigasi Sidebar**: Menu tingkat atas tersendiri: `📁 File Explorer` (Khusus Administrator).
4. **Kontrol Akses**: Proteksi ketat menggunakan dekorator `@login_required` + `@admin_required` di seluruh endpoint API dan tampilan tab.

---

## 3. Batasan Keamanan Filesystem & Direktori yang Diizinkan (*Allowed Roots*)

Untuk mencegah penghapusan file sistem, peretasan direktori, atau eksploitasi path traversal:

1. **Direktori Diizinkan yang Dapat Dikonfigurasi (*Configurable Allowed Roots*)**:
   - Administrator mengonfigurasi daftar folder yang diizinkan langsung melalui antarmuka File Explorer (disimpan di database tabel `Settings` dengan kunci `file_explorer_allowed_roots` dalam format JSON array).
   - Folder bawaan (*default*): Direktori kerja instalasi TMBilling (`c:\Project GIT\TMBilling`).
2. **Validasi Path yang Ketat**:
   - Setiap path yang diminta akan diubah menjadi *canonical path* mutlak (`os.path.realpath` / `pathlib.Path.resolve()`).
   - Path tujuan WAJIB berawalan dari salah satu direktori yang terdaftar di *allowed roots*.
   - Symlink atau junction point NTFS yang merujuk ke luar direktori yang diizinkan akan langsung ditolak dengan kode `403 Forbidden`.
   - Pola traversal relatif (`..`, `../`, `..\`) yang berusaha melompat keluar dari batasan direktori akan ditolak.

---

## 4. Kebijakan Keamanan & Berkas yang Dapat Disunting

1. **Deteksi Berkas Biner (*Binary Detection*)**:
   - Pengecekan ekstensi biner umum + pemeriksaan byte awal (memeriksa keberadaan *null bytes* `\x00` pada 8000 byte pertama).
   - Berkas biner (contoh: `.exe`, `.dll`, `.db`, `.png`, `.zip`, `.gz`) hanya dapat dilihat infonya / tidak dapat disunting sebagai teks untuk mencegah kerusakan berkas.
2. **Batas Ukuran Berkas (*File Size Limit*)**:
   - Menjelajah folder & melihat metadata: Tidak ada batasan ukuran.
   - Membaca / menyunting konten teks: Dibatasi maksimal **5 MB** guna mencegah peramban kehabisan memori (*out of memory*).
3. **Penanganan Encoding**:
   - Mencoba decode dengan UTF-8 terlebih dahulu, lalu otomatis beralih ke fallback Latin-1 / CP1252 jika decode UTF-8 gagal.
4. **Konkurensi & Atomisitas Penyimpanan (*Save Concurrency & Atomicity*)**:
   - Pemeriksaan konkurensi optimistik: Frontend mengirimkan nilai `mtime` (waktu modifikasi) terakhir yang diketahui. Jika `mtime` di disk ternyata lebih baru, server mengembalikan respon `409 Conflict` agar perubahan tidak ditimpa tanpa sengaja.
   - Penulisan atomik: Menulis ke berkas sementara (*temp file*) di direktori yang sama terlebih dahulu, lalu menggantikannya secara atomik menggunakan `os.replace`.

---

## 5. Kontrak API (*API Contracts*)

Seluruh endpoint berada di bawah prefix `/api/v1/kasir/fileexplorer/`:

### 5.1 `GET /api/v1/kasir/fileexplorer/roots`
- **Deskripsi**: Mengambil daftar direktori yang diizinkan saat ini.
- **Respon**: `{"success": true, "roots": ["C:\\Project GIT\\TMBilling", ...]}`

### 5.2 `POST /api/v1/kasir/fileexplorer/roots`
- **Deskripsi**: Menambah, mengubah, atau menghapus daftar direktori yang diizinkan.
- **Payload**: `{"roots": ["C:\\Project GIT\\TMBilling", "D:\\Backups"]}`

### 5.3 `GET /api/v1/kasir/fileexplorer/list?path=<canonical_path>`
- **Deskripsi**: Menampilkan daftar isi suatu direktori.
- **Respon**:
  ```json
  {
    "success": true,
    "current_path": "C:\\Project GIT\\TMBilling",
    "is_root": false,
    "items": [
      {"name": "app", "path": "C:\\Project GIT\\TMBilling\\app", "is_dir": true, "size": null, "modified": 1755252000},
      {"name": "config.ini", "path": "C:\\Project GIT\\TMBilling\\config.ini", "is_dir": false, "size": 120, "modified": 1755252100, "editable": true}
    ]
  }
  ```

### 5.4 `GET /api/v1/kasir/fileexplorer/read?path=<canonical_path>`
- **Deskripsi**: Membaca isi berkas teks untuk disunting di editor.
- **Respon**:
  ```json
  {
    "success": true,
    "path": "C:\\Project GIT\\TMBilling\\config.ini",
    "content": "...",
    "size": 120,
    "mtime": 1755252100,
    "extension": ".ini",
    "editable": true
  }
  ```

### 5.5 `POST /api/v1/kasir/fileexplorer/save`
- **Deskripsi**: Menyimpan perubahan isi berkas.
- **Payload**:
  ```json
  {
    "path": "C:\\Project GIT\\TMBilling\\config.ini",
    "content": "...",
    "expected_mtime": 1755252100,
    "force": false
  }
  ```

### 5.6 `POST /api/v1/kasir/fileexplorer/create`
- **Deskripsi**: Membuat berkas atau folder baru.
- **Payload**: `{"parent_path": "...", "name": "berkas_baru.txt", "is_dir": false}`

### 5.7 `POST /api/v1/kasir/fileexplorer/rename`
- **Deskripsi**: Mengganti nama berkas atau folder.
- **Payload**: `{"path": "...", "new_name": "berkas_diperbarui.txt"}`

### 5.8 `POST /api/v1/kasir/fileexplorer/delete`
- **Deskripsi**: Menghapus berkas atau folder (dijamin berada di dalam boundary).
- **Payload**: `{"path": "..."}`

---

## 6. Pencatatan Audit Log (*Audit Logging*)

Setiap operasi manipulasi berkas wajib dicatat menggunakan `write_log()` dengan kategori kanonikal `SYSTEM` / `MAINTENANCE`:
- `FILE_EXPLORER_SAVE`: Saat berkas disimpan/diubah.
- `FILE_EXPLORER_CREATE`: Saat berkas atau folder baru dibuat.
- `FILE_EXPLORER_RENAME`: Saat berkas atau folder diubah namanya.
- `FILE_EXPLORER_DELETE`: Saat berkas atau folder dihapus.
- `FILE_EXPLORER_ROOTS_UPDATE`: Saat daftar direktori yang diizinkan diperbarui.

---

## 7. Tata Letak & UX Frontend

1. **Tautan Sidebar**:
   - Lokasi: `app/templates/kasir/components/sidebar.html`
   - Ikon: Berkas/Folder SVG 📁
   - Label: `File Explorer`
2. **Tampilan Tab Utama (`app/templates/kasir/tabs/fileexplorer.html`)**:
   - Bar navigasi rekam jejak (*breadcrumbs*) + tombol aksi (Buat Berkas, Buat Folder, Segarkan, Kelola Folder Diizinkan).
   - Tampilan Terpisah (*Split View* / *Dual Pane*):
     - **Panel Kiri**: Navigasi hierarki folder, daftar berkas, dan pencarian cepat.
     - **Panel Kanan**: Code editor CodeMirror 6, bar status (jumlah baris, karakter, bahasa/syntax mode, status simpan).
   - Modal Konfigurasi:
     - Pengelola direktori yang diizinkan (Input tambah direktori, tombol hapus, daftar direktori aktif).
3. **Modul JavaScript**:
   - `app/static/js/kasir/modules/fileexplorer/index.js` dimuat di `base.html`.

---

## 8. Rencana Pengujian & Verifikasi

1. **Uji Otomatis Unit & Integrasi**:
   - `tests/test_fileexplorer_security.py`: Menguji serangan path traversal, symlink escape, penolakan akses di luar allowed roots, perlindungan berkas biner, dan batasan ukuran berkas.
   - `tests/test_fileexplorer_api.py`: Menguji fungsionalitas list, read, save, create, rename, delete, deteksi konflik perubahan, dan manajemen allowed roots.
2. **Verifikasi Tampilan UI**:
   - Navigasi tab dari sidebar berjalan lancar.
   - Navigasi breadcrumb dapat diklik untuk melompat antar folder.
   - Penyuntingan teks dengan CodeMirror 6 dan penyimpanan shortcut `Ctrl+S` berjalan mulus.
   - Log audit tercatat dengan benar di sistem log.

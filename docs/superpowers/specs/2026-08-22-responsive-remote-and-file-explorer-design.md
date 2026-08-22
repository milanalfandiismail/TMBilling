# Spesifikasi Desain: Antarmuka Responsif Remote Control Server & Web File Explorer

## 1. Ringkasan Eksekutif

Dokumen ini menetapkan spesifikasi desain teknis untuk merombak antarmuka (UI) dan model interaksi fitur **Kendali Jarak Jauh Server (Remote VNC)** dan **Web File Explorer** agar sepenuhnya responsif, nyaman, dan ergonomis digunakan pada berbagai ukuran layar:
- Desktop & Laptop (layar lebar / standar)
- Tablet (orientasi portrait & landscape)
- Smartphone / Mobile (portrait & landscape)
- Viewport sempit / window browser yang diperkecil

Prinsip utama: **Progressive Enhancement** — Meningkatkan kemampuan sentuh dan tata letak layar kecil secara adaptif tanpa mengubah maupun merusak kenyamanan penggunaan pada desktop (*Zero Desktop Regression*).

---

## 2. Analisis Masalah & Root Causes

### 2.1 Remote Control Server
1. **Header & Toolbar Padat**: Tombol status, input password, simpan password, hubungkan, scaling, dan fullscreen tersusun horizontal. Pada viewport sempit (`< 768px`), tombol-tombol ini bertumpuk berantakan dan menghabiskan ruang vertikal layar.
2. **Ketiadaan Input Keyboard pada Layar Sentuh**: Canvas noVNC hanya menangkap event keyboard fisik perangkat keras. Pengguna smartphone/tablet tidak dapat memunculkan keyboard perangkat untuk mengetik teks, password, atau perintah di Windows Server.
3. **Keterbatasan Interaksi Sentuh**: Tidak tersedianya pintasan tombol fungsi sistem (seperti `Ctrl+Alt+Del`, `Win+R`, `Alt+F4`, `Enter`, `Esc`, `Tab`, Panah Navigasi) dan mode klik kanan yang intuitif pada perangkat sentuh.
4. **Tinggi Viewport Kaku**: Menggunakan `h-[calc(100vh-...)]` yang menimbulkan scrollbar ganda pada browser mobile karena adanya address bar dinamis.

### 2.2 Web File Explorer
1. **Tata Letak Dual-Pane Kaku**: Split-view vertikal/horizontal memaksa pohon direktori dan editor teks berbagi ruang layar yang sempit pada mobile, mengakibatkan editor teks terhimpit dan tidak dapat digunakan.
2. **Ketiadaan Transisi Tampilan Berkas vs Editor**: Belum ada mekanisme adaptif (*master-detail switch*) untuk berpindah secara mulus antara penjelajahan berkas dan penyuntingan teks penuh di layar kecil.
3. **Ergonomi Mengetik & Simpan**: Ketika keyboard virtual smartphone aktif, tombol Simpan dapat tertutup atau terdorong keluar viewport.
4. **Breadcrumb Path Meluap**: Struktur path folder yang panjang memecah baris header pada mobile.

---

## 3. Arsitektur & Desain Solusi

### 3.1 Scope 1: Kendali Jarak Jauh Server (Remote VNC)

#### A. Tata Letak Header & Kontrol Adaptif
- **Desktop (`>= md`)**: Mempertahankan toolbar horizontal lengkap yang sudah selaras dengan tab Pengaturan.
- **Mobile / Tablet (`< md`)**:
  - Baris Utama: Ikon & Judul singkat, Badge Status, Tombol Utama `[▶ Hubungkan / ⏹ Putuskan]`, dan Tombol `[⚙️ Menu / Opsi]`.
  - Dropdown / Drawer Opsi: Menyembunyikan input password TightVNC, tombol *Simpan PW*, *Scaling*, dan *Fullscreen* ke dalam panel opsi yang rapi agar tidak memakan ruang layar remote.

#### B. Virtual Quick Keyboard & Send Text Helper (Mobile Dock)
Pada mobile saat sesi VNC terhubung, sediakan **Toolbar Kontrol Mobile Bawah (Bottom Dock)** yang dapat di-toggle (`⌨️ Keyboard / Kontrol`):
1. **Modul Pengiriman Teks ("Kirim Teks")**:
   - Kolom input teks sederhana dengan tombol `[Kirim]`.
   - Admin dapat mengetik kata, URL, script, atau password menggunakan keyboard native HP (lengkap dengan autocorrect/paste clipboard), lalu menekan *Kirim*.
   - Script akan mengonversi string menjadi urutan keysym noVNC (`rfb.sendKey(...)`) dengan jeda aman.
2. **Tombol Pintasan Modifier Sticky**:
   - `[Ctrl]`, `[Alt]`, `[Win]`, `[Shift]` dengan status aktif/terkunci (warna highlight saat ditekan), memungkinkan kombinasi multi-tombol (contoh: aktifkan `Ctrl` lalu tekan `Esc` untuk membuka Start menu).
3. **Tombol Fungsi Esensial & Navigasi**:
   - `[Esc]`, `[Tab]`, `[Enter]`, `[Bksp]`, `[Del]`, `[Space]`.
   - Tombol Panah: `[↑]`, `[↓]`, `[←]`, `[→]`.
4. **Pintasan Sistem Siap Pakai**:
   - `[CAD]` (`Ctrl+Alt+Del` via `rfb.sendCtrlAltDel()`).
   - `[Win+R]` (Run dialog), `[Win+D]` (Show Desktop), `[Alt+Tab]`, `[Alt+F4]`.

#### C. Interaksi Sentuh & Mouse
- noVNC canvas mendukung gesture sentuh native:
  - Single tap = Klik Kiri (Left Click) & fokus kursor.
  - Long press (500ms) = Klik Kanan (Right Click / Context Menu).
  - Drag 2 jari = Scroll halaman / mouse wheel.
- Penyesuaian viewport `scaleViewport = true` otomatis saat orientasi berganti (portrait ↔ landscape).

---

### 3.2 Scope 2: Web File Explorer

#### A. Pola Navigasi Master-Detail Adaptif (Mobile View Switch)
- **Desktop (`>= md`)**: Split-pane berdampingan (Kiri: Tree List 320px, Kanan: Text Editor).
- **Mobile (`< md`)**: Model tampilan adaptif dua mode:
  1. **Mode 1: Daftar Berkas (`tree`)**:
     - Memenuhi 100% lebar kartu.
     - Header: Ikon, Breadcrumbs yang dapat di-scroll horizontal (`overflow-x-auto whitespace-nowrap`), tombol `[+ File]`, `[+ Folder]`, `[🔄]`, dan `[⚙️ Folder Diizinkan]`.
     - Daftar berkas dengan padding sentuh nyaman (`py-2.5 px-3`) dan tombol hapus/ubah nama yang mudah diakses sentuhan.
  2. **Mode 2: Editor Teks Penuh (`editor`)**:
     - Ketika berkas teks diklik, tampilan otomatis beralih ke editor teks penuh (100% lebar & tinggi).
     - Toolbar Atas Editor:
       - Tombol `[← Berkas]` untuk kembali ke daftar file.
       - Nama file aktif & status simpan (`Tersimpan` / `Belum disimpan *`).
       - Tombol `[💾 Simpan]` yang mencolok.
     - Textarea Editor:
       - Mengisi sisa ruang vertikal secara optimal dengan scrolling sentuh lancar (`-webkit-overflow-scrolling: touch`).
       - Ukuran font yang nyaman dibaca pada layar smartphone (`text-xs md:text-sm`).

#### B. Breadcrumb Path Responsif
- Container breadcrumb menggunakan `overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap` sehingga path yang sangat panjang dapat digeser dengan jari tanpa merusak tata letak baris header.

#### C. Modal Sandbox Responsif
- Modal `fe-roots-modal` dibuat dengan `max-w-lg w-full max-h-[90dvh] overflow-y-auto` agar muat dan mudah dioperasikan pada layar smartphone kecil sekalipun.

---

## 4. Breakpoint & Design System Consistency

- Seluruh styling menggunakan token dan kelas standar Tailwind CSS:
  - `sm:` (min-width: 640px)
  - `md:` (min-width: 768px)
  - `lg:` (min-width: 1024px)
- Palet warna tetap 100% konsisten dengan tema *Chamber Noir*:
  - Card background: `#0c0c0c` & `#090909`
  - Border: `#1c1c1c` & `#262626`
  - Input: `#050505`
  - Text: `neutral-200`, `neutral-400`, `neutral-500`
  - Accent / Primary buttons: `neutral-100` (text-black), `emerald-600`, `amber-600`

---

## 5. Rencana Pengujian & Verifikasi

1. **Uji Fungsional & Unit Test**:
   - Menjalankan 28 unit tests Pytest (`test_fileexplorer_api.py`, `test_fileexplorer_security.py`, `test_fileexplorer_service.py`, `test_vnc_password_automation.py`) untuk memastikan integritas API dan keamanan sandbox 100% terjaga.
2. **Uji Responsif Manual (Desktop, Tablet, Mobile)**:
   - Remote VNC: Uji koneksi, tombol opsi mobile, pengiriman teks string ke VNC, toggle modifier key, dan gesture sentuh.
   - File Explorer: Uji penjelajahan direktori di mobile, transisi buka file ke editor penuh, tombol kembali ke daftar berkas, pengetikan teks, dan penyimpanan perubahan.
3. **Kompilasi CSS**:
   - Memastikan build Tailwind CSS sukses dan bersih.
4. **Re-indexing Codebase**:
   - Memperbarui memori repositori via MCP `index_repository`.

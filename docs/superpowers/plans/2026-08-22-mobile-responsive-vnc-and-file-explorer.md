# Rencana Implementasi: Perbaikan Total Responsive UI/UX Mobile pada Kendali Jarak Jauh Server & Web File Explorer

> **Untuk agen/pekerja otomatis:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Merombak antarmuka (UI) dan model interaksi sentuh fitur **Kendali Jarak Jauh Server (Remote VNC)** dan **Web File Explorer** agar tampil rapi, proporsional, dan sangat ergonomis digunakan pada perangkat mobile (smartphone/tablet), layar sempit, dan orientasi landscape/portrait tanpa mengubah maupun merusak pengalaman desktop (*Zero Desktop Regression*).

**Arsitektur:**
1. **Responsive Kendali Jarak Jauh Server (VNC)**:
   - **Desktop Wide (`>= md`)**: Mempertahankan toolbar horizontal penuh, input password langsung, dan tampilan layar remote besar.
   - **Mobile Viewport (`< md`)**:
     - *Header Ringkas*: Judul/ikon + Badge status + Tombol `[▶ Hubungkan / ⏹ Putuskan]` + Tombol `[⌨️]` (toggle dock keyboard) + Tombol `[⚙️]` (toggle drawer opsi password/scaling).
     - *Collapsible Options Drawer (`#vnc-options-panel`)*: Menyembunyikan input password TightVNC, simpan password, scaling toggle, dan fullscreen agar tidak memakan ruang remote screen.
     - *Bottom Dock Virtual Keyboard & String Sender (`#vnc-virtual-keyboard`)*:
       - Kolom "Kirim Teks" yang memanfaatkan keyboard native smartphone untuk pengetikan cepat.
       - Baris modifier sticky keys (`Ctrl`, `Alt`, `Win`, `Shift`) dengan visual lock highlight.
       - Tombol pintasan esensial: `Esc`, `Tab`, `Enter`, `Bksp`, `Del`, `Space`, `CAD` (`Ctrl+Alt+Del`), `Win+R`, `Win+D`, `Alt+Tab`, `Alt+F4`, dan Panah Navigasi.
     - *Viewport Height & Touch*: Menggunakan `100dvh` flex-box layout dengan gesture sentuh (tap = klik kiri, long-press = klik kanan, 2-finger drag = scroll).
2. **Responsive Web File Explorer**:
   - **Desktop Wide (`>= md`)**: Mempertahankan split-view berdampingan (pohon direktori kiri 320px, text editor kanan).
   - **Mobile Viewport (`< md`)**:
     - *Adaptive Master-Detail View Switch*:
       - Mode Berkas (`tree`): Menampilkan pohon folder/file 100% lebar layar dengan baris sentuh luas (`p-2.5`) dan nyaman diklik.
       - Mode Editor (`editor`): Ketika file teks dipilih, tampilan beralih mulus ke editor teks 100% layar penuh.
       - Toolbar Editor: Memiliki tombol `[← Berkas]` untuk kembali ke penjelajah direktori dan tombol `[💾 Simpan]` yang tetap terlihat di atas keyboard.
     - *Horizontal Scrollable Breadcrumbs*: Container path menggunakan `overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap` sehingga path panjang tidak merusak baris header.
     - *Modal Sandbox Adaptif*: Menggunakan `max-h-[50dvh] overflow-y-auto` agar muat di semua ukuran layar mobile.

**Tech Stack:** HTML5, Tailwind CSS (Chamber Noir Dark), Vanilla JS (noVNC RFB API, DOM Events), Python Flask, Pytest.

**Spec:** [`docs/superpowers/specs/2026-08-22-responsive-remote-and-file-explorer-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-22-responsive-remote-and-file-explorer-design.md)

## Global Constraints
- **Desktop Protection**: Seluruh tata letak dan perilaku pada layar lebar desktop/laptop (`>= md` atau `>= 768px`) WAJIB dipertahankan tanpa perubahan visual yang merusak.
- **Design System Consistency**: Menggunakan token dan tema standar TMBilling *Chamber Noir* (`#0c0c0c`, `#1c1c1c`, `#050505`, `#171717`, `#262626`).
- **Breakpoint Standards**: Menggunakan breakpoint bawaan Tailwind CSS (`sm: 640px`, `md: 768px`, `lg: 1024px`).
- **Full Test Suite**: Mempertahankan kelulusan 100% dari 28 unit tests Pytest.
- **Build & Memory Indexing**: Wajib menjalankan kompilasi Tailwind CSS minified dan re-indexing memori repositori via MCP `index_repository`.

---

### Task 1: Remote Control Server Mobile Overhaul & Virtual Keyboard Dock
**Files:**
- Modify: `app/templates/kasir/tabs/remote_server.html`
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`
- Test: `tests/test_vnc_password_automation.py`

**Interfaces:**
- Consumes: `VNCClient.rfb.sendKey(keysym, code, down)`, `VNCClient.rfb.sendCtrlAltDel()`
- Produces: UI responsif dengan collapsible options panel, bottom virtual keyboard dock, sticky modifier locks, string sender helper.

- [ ] **Step 1: Tata Letak Header & Options Panel Adaptif di `remote_server.html`**
  - Buat header baris utama dengan judul ringkas, badge status, tombol Hubungkan/Putuskan, tombol toggle keyboard (`⌨️`), dan tombol toggle opsi (`⚙️`).
  - Bungkus input password TightVNC, simpan password, scaling, dan fullscreen ke dalam panel `#vnc-options-panel` (`hidden md:flex`).

- [ ] **Step 2: Markup Virtual Quick Keyboard & Text Sender Dock di `remote_server.html`**
  - Tambahkan `#vnc-virtual-keyboard` (`hidden md:hidden`):
    - Input text helper `#vnc-text-helper` + tombol Kirim (`VNCClient.sendTextHelper()`).
    - Sticky modifier buttons: `Ctrl`, `Alt`, `Win`, `Shift` (`VNCClient.toggleModifier()`).
    - Essential keys: `Esc`, `Tab`, `Enter`, `Bksp`, `Del`, `Space`, `CAD` (`VNCClient.sendSpecialKey()`, `VNCClient.sendCtrlAltDel()`).
    - System shortcuts: `Win+R`, `Win+D`, `Alt+Tab`, `Alt+F4` (`VNCClient.sendShortcutPreset()`).
    - Direction arrows: `▲`, `◀`, `▼`, `▶`.

- [ ] **Step 3: Logika Event Keyboard, Modifiers, & Text Sender di `vnc_client.js`**
  - Implementasikan `toggleVirtualKeyboard()`, `toggleMobileOptions()`.
  - Implementasikan `sendTextHelper()` untuk mengirim string karakter demi karakter via keysym noVNC.
  - Implementasikan `toggleModifier()` dan `releaseModifiers()`.
  - Implementasikan `sendCtrlAltDel()` dan `sendShortcutPreset()`.

- [ ] **Step 4: Jalankan Unit Test VNC**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_vnc_password_automation.py`

---

### Task 2: Web File Explorer Master-Detail Switcher & Mobile Editor
**Files:**
- Modify: `app/templates/kasir/tabs/fileexplorer.html`
- Modify: `app/static/js/kasir/modules/fileexplorer/index.js`
- Test: `tests/test_fileexplorer_api.py`, `tests/test_fileexplorer_security.py`, `tests/test_fileexplorer_service.py`

**Interfaces:**
- Consumes: `FileExplorer.openDirectory()`, `FileExplorer.openFile()`, `API.fileexplorer.save()`
- Produces: Master-detail view switcher (`mobileView: 'tree' | 'editor'`), back navigation (`backToTree()`), scrollable breadcrumbs.

- [ ] **Step 1: Tata Letak Master-Detail & Breadcrumbs di `fileexplorer.html`**
  - Konfigurasi Left Panel (`#fe-left-panel`) dan Right Panel (`#fe-right-panel`) agar tampil split pada desktop (`md:flex`) dan tampil bergantian pada mobile (`hidden md:flex`).
  - Tambahkan tombol `[← Berkas]` (`#fe-back-btn`, `md:hidden`) pada toolbar editor.
  - Terapkan `overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap` pada container `#fe-breadcrumbs`.
  - Sesuaikan modal Allowed Roots `#fe-roots-modal` dengan `max-h-[50dvh]` agar nyaman di layar smartphone.

- [ ] **Step 2: Logika Navigasi Master-Detail di `index.js`**
  - Modifikasi `openFile(path)` agar otomatis menyembunyikan `#fe-left-panel` dan menampilkan `#fe-right-panel` saat layar `< 768px`.
  - Buat method `backToTree()` yang menampilkan kembali `#fe-left-panel` dan menyembunyikan `#fe-right-panel`.
  - Pastikan tombol simpan editor tetap terlihat dan mudah ditekan saat mobile keyboard muncul.

- [ ] **Step 3: Jalankan Test Suite File Explorer**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_fileexplorer_api.py tests/test_fileexplorer_security.py tests/test_fileexplorer_service.py`

---

### Task 3: Kompilasi Tailwind CSS & Re-indexing Repositori via MCP
**Files:**
- Command: `node node_modules\tailwindcss\lib\cli.js -i ./app/static/css/input.css -o ./app/static/css/tailwind.css --minify`
- MCP Tool: `index_repository`

- [ ] **Step 1: Kompilasi ulang Tailwind CSS**
  - Pastikan stylesheet `app/static/css/tailwind.css` ter-compile bersih tanpa error.

- [ ] **Step 2: Index ulang repositori via MCP**
  - Panggil MCP tool `index_repository` pada direktori repositori.

---

### Task 4: Full Regression Testing & Code Review
**Files:**
- Command: `pytest`
- Git: `git status`, `git diff`

- [ ] **Step 1: Jalankan seluruh 28 tests Pytest**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
  - Pastikan seluruh 28 tests lulus 100%.

- [ ] **Step 2: Lakukan Code Review menyeluruh**
  - Tinjau responsivitas pada viewport 320px - 768px, ketiadaan overflow horizontal, dan perlindungan desktop wide.

---

### Task 5: Git Commit & Push
**Files:**
- Git: `git commit`, `git push`

- [ ] **Step 1: Commit perubahan dengan pesan Bahasa Indonesia informatif**
- [ ] **Step 2: Push ke remote origin branch `feature/vnc-auth-and-web-file-explorer`**
- [ ] **Step 3: Update dokumentasi walkthrough**

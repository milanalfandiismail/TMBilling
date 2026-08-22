# Rencana Implementasi: Responsive Remote Control Server & Web File Explorer

> **Untuk agen/pekerja otomatis:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Merombak antarmuka (UI) dan model interaksi fitur Kendali Jarak Jauh Server (VNC) dan Web File Explorer agar 100% responsif, ramah sentuhan, dan ergonomis pada desktop, laptop, tablet, dan smartphone tanpa regresi pada pengalaman desktop.

**Arsitektur:**
1. **Remote Control Server**:
   - Header adaptif (desktop: toolbar penuh, mobile: compact header + collapsible option drawer).
   - Bottom Dock Virtual Keyboard & String Text Sender untuk perangkat mobile/sentuh.
   - Penanganan modifier keys sticky (`Ctrl`, `Alt`, `Win`, `Shift`), tombol esensial (`Esc`, `Tab`, `Enter`, `Bksp`, `Del`, Panah), dan shortcut sistem (`Ctrl+Alt+Del`, `Win+R`, `Alt+Tab`).
   - Dynamic viewport sizing (`100dvh` / container flex).
2. **Web File Explorer**:
   - Responsive Master-Detail pattern (desktop: split-view berdampingan, mobile: view switcher antara `tree` dan `editor` penuh).
   - Toolbar editor dengan tombol navigasi kembali (`← Berkas`) dan tombol Simpan yang selalu mudah dijangkau.
   - Breadcrumbs scrollable horizontal anti-overflow pada mobile.
   - Area klik baris file/folder yang luas dan nyaman untuk sentuhan.

**Tech Stack:** HTML5, Tailwind CSS (Chamber Noir Dark), Vanilla JS (noVNC RFB client, DOM events), Python Flask, Pytest.

**Spec:** [`docs/superpowers/specs/2026-08-22-responsive-remote-and-file-explorer-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-22-responsive-remote-and-file-explorer-design.md)

## Global Constraints
- Mempertahankan keselarasan visual dengan tema standar *Chamber Noir* (`#0c0c0c`, `#1c1c1c`, `#050505`).
- Tidak merusak tata letak maupun alur kerja desktop existing (*Zero Desktop Regression*).
- Menggunakan breakpoint standar Tailwind CSS (`sm:`, `md:`, `lg:`).
- Menjaga seluruh 28 unit tests Pytest tetap lulus 100%.
- Melakukan build CSS minified dan re-indexing repository via MCP.

---

### Task 1: Responsive Overhaul Remote Control Server UI & Adaptor Mobile
**Files:**
- Modify: `app/templates/kasir/tabs/remote_server.html`
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`

- [ ] **Step 1: Desain ulang Header & Toolbar Remote Server**
  - Pada desktop (`md:flex`): Tampilkan seluruh kontrol secara horizontal.
  - Pada mobile: Tampilkan header ringkas dengan tombol Hubungkan/Putuskan, status badge, tombol toggle keyboard (`⌨️`), dan tombol toggle menu opsi (`⚙️`).
  - Tambahkan panel opsi collapsible (`#vnc-mobile-options`) untuk menampung input password TightVNC, simpan password, toggle scaling, dan fullscreen pada layar kecil.

- [ ] **Step 2: Bangun Virtual Quick Keyboard & Text Sender Drawer (Mobile Dock)**
  - Tambahkan kontainer `#vnc-virtual-keyboard` di bawah canvas remote:
    - Input text helper dengan tombol Kirim ("Kirim Teks ke Server").
    - Baris tombol modifier sticky: `Ctrl`, `Alt`, `Win`, `Shift`.
    - Baris tombol esensial: `Esc`, `Tab`, `Enter`, `Bksp`, `Del`, `Space`, `CAD` (`Ctrl+Alt+Del`), `Win+R`, `Win+D`, `Alt+Tab`, `Alt+F4`, `↑`, `↓`, `←`, `→`.

- [ ] **Step 3: Implementasi Key Event Emitter & String Sender di `vnc_client.js`**
  - Buat metode `VNCClient.sendString(text)` yang mengirim urutan keysym per karakter ke RFB.
  - Buat metode `VNCClient.sendSpecialKey(keysym, code)` dan `VNCClient.toggleModifier(modKey)`.
  - Buat metode `VNCClient.toggleVirtualKeyboard()` dan `VNCClient.toggleMobileOptions()`.

- [ ] **Step 4: Uji fungsionalitas remote VNC & pastikan test otomatis lulus**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_vnc_password_automation.py`

---

### Task 2: Responsive Master-Detail & Text Editor Web File Explorer
**Files:**
- Modify: `app/templates/kasir/tabs/fileexplorer.html`
- Modify: `app/static/js/kasir/modules/fileexplorer/index.js`

- [ ] **Step 1: Implementasi Master-Detail View Switcher di `fileexplorer.html`**
  - Bungkus Left Panel (Tree) dan Right Panel (Editor) agar adaptif:
    - Desktop (`>= md`): Keduanya tampil berdampingan (`md:flex md:flex-row`).
    - Mobile (`< md`): Hanya satu panel yang aktif (`viewMode: 'tree' | 'editor'`).
  - Pada toolbar editor, tambahkan tombol `← Berkas` (`#fe-back-to-tree-btn`) yang hanya muncul di layar mobile (`md:hidden`).
  - Ubah breadcrumb path agar dapat di-scroll horizontal tanpa mematahkan baris: `overflow-x-auto whitespace-nowrap scrollbar-none`.

- [ ] **Step 2: Update Logika View Switcher & Touch Navigation di `index.js`**
  - Tambahkan property `FileExplorer.mobileView = 'tree'` (default).
  - Pada `openFile(path)`, jika viewport mobile (`window.innerWidth < 768`), otomatis alihkan tampilan ke mode `editor` (`FileExplorer.setMobileView('editor')`).
  - Pada tombol `← Berkas`, alihkan kembali ke mode `tree` (`FileExplorer.setMobileView('tree')`).
  - Pastikan tombol simpan dan status editor tetap terlihat dan mudah ditekan saat mobile keyboard muncul.

- [ ] **Step 3: Uji seluruh rangkaian test File Explorer**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_fileexplorer_api.py tests/test_fileexplorer_security.py tests/test_fileexplorer_service.py`

---

### Task 3: Kompilasi Tailwind CSS & Re-indexing Repository via MCP
**Files:**
- Command: `node node_modules\tailwindcss\lib\cli.js -i ./app/static/css/input.css -o ./app/static/css/tailwind.css --minify`
- MCP Tool: `index_repository`

- [ ] **Step 1: Jalankan kompilasi CSS Tailwind lokal**
  - Pastikan seluruh class utility responsif (`md:hidden`, `hidden`, `whitespace-nowrap`, dll.) terkompilasi dengan baik ke `app/static/css/tailwind.css`.

- [ ] **Step 2: Update repository memory graph via MCP**
  - Panggil tool `index_repository` dari MCP `codebase-memory`.

---

### Task 4: Pengujian Menyeluruh (Pytest 28 Tests), Versioning & Code Review
**Files:**
- Test: `pytest`
- Git: `git status`, `git diff`

- [ ] **Step 1: Jalankan full suite Pytest**
  - Jalankan: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
  - Pastikan 28 tests lulus 100%.

- [ ] **Step 2: Lakukan Code Review menyeluruh**
  - Verifikasi kepatuhan UI responsif, ketiadaan memory leak, kebersihan event listeners, dan non-regresi desktop.

---

### Task 5: Git Commit & Push
**Files:**
- Git: `git commit`, `git push`

- [ ] **Step 1: Commit perubahan dengan pesan Bahasa Indonesia informatif**
- [ ] **Step 2: Push ke remote branch `feature/vnc-auth-and-web-file-explorer`**
- [ ] **Step 3: Update dokumentasi walkthrough**

# Rencana Implementasi Penyelarasan Skeleton Loading & Pembersihan Total Loading Indicator

> **For agentic workers:** REQUIRED SUB-SKILL: Gunakan `superpowers:executing-plans` atau `superpowers:subagent-driven-development` untuk mengeksekusi rencana ini tahap demi tahap. Setiap langkah menggunakan format kotak centang (`- [ ]`) untuk pelacakan progres.

**Goal:** Menstandarisasi skeleton loading di seluruh 10 area antarmuka frontend TMBilling (Kantin & POS, Member, Pemulihan Mati Lampu, Paket Billing, Unit PC, Tournament, Laporan Billing, Laporan Kantin, Akun Kasir/Admin, dan Screenshot Monitor) agar 100% presisi dan identik dengan tata letak data riil setelah render di seluruh breakpoint (`lg`, `xl`, `2xl`), serta menghapus seluruh sisa loading spinner (`animate-spin`) dan teks pemuatan statis dari seluruh template HTML.

**Architecture:**
1. **Peningkatan Engine Sentral (`app/static/js/kasir/core/skeleton.js`)**:
   - Menambahkan generator struktur skeleton khusus yang merefleksikan tata letak asli:
     - `menuCards(count = 8)`: Menghasilkan kartu individual (child element) dengan rasio thumbnail `aspect-[4/3]`, harga, judul, dan tombol aksi tanpa wrapper ganda sehingga mewarisi responsivitas grid induk (`lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4`).
     - `memberTable(rows = 6)`: Menghasilkan elemen `<table>` utuh dengan header kolom `<thead>` 6 kolom asli dan baris `<tbody>` skeleton responsif.
     - `blackoutCards(count = 4)`: Menghasilkan grid 2 kolom kartu blackout dengan avatar PC, detail info, dan tombol pemulihan.
     - `paketTable(groups = 2, rowsPerGroup = 3)`: Menghasilkan grup paket terkelompok dengan judul grup dan tabel 5 kolom.
     - `pcManagementGrid(groups = 2, cardsPerGroup = 6)`: Menghasilkan grup PC terkelompok dengan grid responsif kartu PC (`lg:max-xl:grid-cols-4 xl:grid-cols-6`).
     - `tournamentCards(count = 6)`: Menghasilkan kartu individual `h-[180px]` tanpa wrapper ganda yang mewarisi grid responsif `#tournaments-grid` (`lg:max-xl:grid-cols-2 xl:grid-cols-3`).
     - `laporanBilling(rows = 6)`: Menghasilkan 4 KPI summary cards (`grid-cols-2 md:grid-cols-4`) + tabel transaksi 8 kolom.
     - `laporanMenu(rows = 6)`: Menghasilkan KPI summary card + tabel transaksi responsif (5 kolom compact di `lg`, 11 kolom detail di `xl/2xl`).
     - `userTable(rows = 5)`: Menghasilkan elemen `<table>` utuh dengan header 5 kolom asli, avatar operator, dan kuota bermain.
     - `screenshotCards(count = 8)`: Menghasilkan kartu individual tanpa wrapper ganda dengan box preview `aspect-video` yang mewarisi grid `#screenshot-grid` (`lg:max-xl:grid-cols-3 xl:grid-cols-4`).
2. **Penyelarasan Modul JavaScript**:
   - Memperbarui pemanggilan skeleton pada modul-modul terkait saat status pemuatan awal (`!isSilent`) agar menggunakan helper baru yang presisi dan tidak menginjeksi elemen tabel mentah ke dalam `<div>`.
3. **Pembersihan Total Spinner & Indikator Usang pada Template HTML**:
   - Menghapus seluruh spinner lingkaran `animate-spin` dan teks statis `"Memuat..."` dari seluruh file template Jinja2 kasir, menggantikannya langsung dengan markup awal skeleton yang seragam.

**Tech Stack:** Vanilla JavaScript (ES6+), TailwindCSS (utility responsive classes: `lg:`, `xl:`, `2xl:`, `animate-pulse`), Jinja2 HTML Templates, Flask/Python (pytest verification).

---

## Global Constraints & Prinsip Desain
- **Zero Layout Shift (Zero CLS)**: Struktur, padding, rasio gambar, jumlah kolom, dan dimensi skeleton harus sama persis dengan elemen aslinya saat data selesai dimuat.
- **No Double-Wrapping Grids**: Modul-modul dengan container yang sudah berupa CSS Grid (Kantin, Screenshot, Tournament) tidak boleh dibungkus lagi oleh tag grid luar di dalam helper skeleton.
- **Valid Table Structure**: Elemen tabel skeleton harus selalu membungkus `<tr>` di dalam `<table>` dan `<tbody>` serta menyertakan `<thead>` responsif jika diinjeksi ke dalam container `<div>`.
- **Zero Spinner Policy**: Tidak ada lagi spinner lingkaran `animate-spin` atau teks statis `"Memuat..."` di template maupun di modul JS.
- **Dark Mode Palette Consistency**: Latar kartu `#0c0c0c` / `#121212`, border `#1c1c1c` / `#262626`, placeholder bar `bg-[#202020]` / `bg-[#262626]`.
- **Preserve Silent Realtime Updates**: Siklus refresh background berkala tetap berjalan senyap tanpa menampilkan skeleton ulang jika data sudah tampil di layar kasir.

---

### Task 1: Peningkatan Generator Sentral `Skeleton` (`skeleton.js`)

**Files:**
- Modify: `app/static/js/kasir/core/skeleton.js`

**Interfaces:**
- Produces:
  - `Skeleton.menuCards(count = 8)` -> string kartu-kartu anak tanpa wrapper grid
  - `Skeleton.memberTable(rows = 6)` -> string `<table>` lengkap 6 kolom
  - `Skeleton.blackoutCards(count = 4)` -> string grid 2 kolom kartu blackout
  - `Skeleton.paketTable(groups = 2, rowsPerGroup = 3)` -> string grouped table 5 kolom
  - `Skeleton.pcManagementGrid(groups = 2, cardsPerGroup = 6)` -> string grouped grid kartu PC unit
  - `Skeleton.tournamentCards(count = 6)` -> string kartu turnamen `h-[180px]` tanpa wrapper grid
  - `Skeleton.laporanBilling(rows = 6)` -> string 4 KPI cards + tabel 8 kolom
  - `Skeleton.laporanMenu(rows = 6)` -> string KPI card + tabel 5/11 kolom responsif
  - `Skeleton.userTable(rows = 5)` -> string `<table>` lengkap 5 kolom
  - `Skeleton.screenshotCards(count = 8)` -> string kartu screenshot `aspect-video` tanpa wrapper grid

- [x] **Step 1: Implementasikan helper baru dan refaktor helper lama di `skeleton.js`**
  - Pastikan `menuCards`, `tournamentCards`, dan `screenshotCards` mengembalikan kartu-kartu langsung tanpa wrapper `<div class="grid...">` luar.
  - Implementasikan `memberTable`, `blackoutCards`, `paketTable`, `pcManagementGrid`, `laporanBilling`, `laporanMenu`, dan `userTable`.
- [x] **Step 2: Verifikasi syntax file `skeleton.js`**
  - Jalankan pengecekan integritas sintaks JavaScript.

---

### Task 2: Penyelarasan Modul JS untuk 10 Area

**Files:**
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/static/js/kasir/modules/member/index.js`
- Modify: `app/static/js/kasir/modules/blackout/index.js`
- Modify: `app/static/js/kasir/modules/paket/index.js`
- Modify: `app/static/js/kasir/modules/pc/index.js`
- Modify: `app/static/js/kasir/modules/tournament/index.js`
- Modify: `app/static/js/kasir/modules/laporan/index.js`
- Modify: `app/static/js/kasir/modules/laporan_menu/index.js`
- Modify: `app/static/js/kasir/modules/user/index.js`
- Modify: `app/static/js/kasir/modules/screenshot/index.js`

- [x] **Step 1: Selaraskan modul Kantin & POS (`menu/index.js`)**
  - Pada `loadCatalog()`, render `Skeleton.menuCards(8)` langsung ke `#menu-catalog-grid`.
- [x] **Step 2: Selaraskan modul Member (`member/index.js`)**
  - Pada `load()`, ganti `Skeleton.tableRows(8, 6)` dengan `Skeleton.memberTable(6)` ke `#member-table`.
- [x] **Step 3: Selaraskan modul Pemulihan Mati Lampu (`blackout/index.js`)**
  - Pada `loadList()`, ganti `Skeleton.tableRows(6, 6)` dengan `Skeleton.blackoutCards(4)` ke `#blackout-list`.
- [x] **Step 4: Selaraskan modul Paket Billing (`paket/index.js`)**
  - Pada `load()`, ganti `Skeleton.paketCards(6)` dengan `Skeleton.paketTable(2, 3)` ke `#paket-table`.
- [x] **Step 5: Selaraskan modul Unit PC (`pc/index.js`)**
  - Pada `load()`, ganti `Skeleton.tableRows(8, 5)` dengan `Skeleton.pcManagementGrid(2, 6)` ke `#pc-table`.
- [x] **Step 6: Selaraskan modul Tournament (`tournament/index.js`)**
  - Pada `renderList()`, render `Skeleton.tournamentCards(6)` ke `#tournaments-grid`.
- [x] **Step 7: Selaraskan modul Laporan Billing (`laporan/index.js`)**
  - Pada `loadByDate()`, ganti `Skeleton.tableRows(8, 6)` dengan `Skeleton.laporanBilling(6)` ke `#laporan-area`.
- [x] **Step 8: Selaraskan modul Laporan Kantin (`laporan_menu/index.js`)**
  - Pada `fetchData()`, ganti `Skeleton.tableRows(8, 6)` dengan `Skeleton.laporanMenu(6)` ke `#laporan-menu-area`.
- [x] **Step 9: Selaraskan modul Akun Kasir & Admin (`user/index.js`)**
  - Pada `load()`, ganti `Skeleton.tableRows(5, 5)` dengan `Skeleton.userTable(5)` ke `#user-table`.
- [x] **Step 10: Selaraskan modul Monitor Screenshot (`screenshot/index.js`)**
  - Pada `load()`, render `Skeleton.screenshotCards(8)` ke `#screenshot-grid`.

---

### Task 3: Pembersihan Total Loading Spinner pada 10 Template Utama

**Files:**
- Modify: `app/templates/kasir/tabs/menu.html`
- Modify: `app/templates/kasir/tabs/member.html`
- Modify: `app/templates/kasir/tabs/blackout.html`
- Modify: `app/templates/kasir/tabs/paket.html`
- Modify: `app/templates/kasir/tabs/pc.html`
- Modify: `app/templates/kasir/tabs/tournament.html`
- Modify: `app/templates/kasir/tabs/laporan.html`
- Modify: `app/templates/kasir/tabs/laporan_menu.html`
- Modify: `app/templates/kasir/tabs/user.html`
- Modify: `app/templates/kasir/tabs/screenshot.html`

- [x] **Step 1: Bersihkan spinner & pasang skeleton awal di `menu.html`**
  - Hapus spinner `#menu-catalog-grid`, gantikan dengan skeleton cards awal.
- [x] **Step 2: Bersihkan spinner & pasang skeleton awal di `member.html`**
  - Hapus spinner `#member-table`, gantikan dengan skeleton table awal.
- [x] **Step 3: Bersihkan teks statis & pasang skeleton awal di `blackout.html`**
  - Rapikan container `#blackout-list`.
- [x] **Step 4: Bersihkan spinner & pasang skeleton awal di `paket.html`**
  - Hapus spinner `#paket-table`, gantikan dengan skeleton grouped table awal.
- [x] **Step 5: Bersihkan spinner & pasang skeleton awal di `pc.html`**
  - Hapus spinner `#pc-table`, gantikan dengan skeleton PC management grid awal.
- [x] **Step 6: Bersihkan teks pemuatan di `tournament.html`**
  - Hapus teks `"Memuat daftar turnamen..."` di `#tournaments-grid`, gantikan dengan skeleton cards awal.
- [x] **Step 7: Bersihkan spinner & pasang skeleton awal di `laporan.html`**
  - Hapus spinner `#laporan-area`, gantikan dengan skeleton laporan billing awal.
- [x] **Step 8: Bersihkan spinner & pasang skeleton awal di `laporan_menu.html`**
  - Hapus spinner `#laporan-menu-area`, gantikan dengan skeleton laporan kantin awal.
- [x] **Step 9: Bersihkan spinner & pasang skeleton awal di `user.html`**
  - Hapus spinner `#user-table`, gantikan dengan skeleton user table awal.
- [x] **Step 10: Bersihkan spinner & pasang skeleton awal di `screenshot.html`**
  - Hapus spinner `#screenshot-grid`, gantikan dengan skeleton screenshot cards awal.

---

### Task 4: Pembersihan Sisa Spinner di Tab & Modal Pendukung Lainnya

**Files:**
- Modify: `app/templates/kasir/tabs/catatan.html`
- Modify: `app/templates/kasir/tabs/grup.html`
- Modify: `app/templates/kasir/tabs/log.html`
- Modify: `app/templates/kasir/tabs/maintenance.html`
- Modify: `app/templates/kasir/tabs/monitor.html`
- Modify: `app/templates/kasir/tabs/struk.html`
- Modify: `app/templates/kasir/tabs/hardware_checker.html`
- Modify: `app/templates/kasir/tabs/dashboard.html`
- Modify: `app/templates/kasir/tabs/branch_kasir.html`
- Modify: `app/templates/kasir/tabs/branch_inbound.html`
- Modify: `app/templates/kasir/tabs/menu_stock_log.html`

- [x] **Step 1: Hapus spinner di tab `catatan.html`, `grup.html`, dan `struk.html`**
  - Gantikan dengan skeleton list / table yang sesuai.
- [x] **Step 2: Hapus spinner di tab `log.html`, `maintenance.html`, dan `monitor.html`**
  - Gantikan dengan skeleton log / table / monitor rows.
- [x] **Step 3: Hapus spinner di `hardware_checker.html` dan `dashboard.html`**
  - Gantikan dengan skeleton hardware table / PC cards.
- [x] **Step 4: Hapus spinner di `branch_kasir.html`, `branch_inbound.html`, dan `menu_stock_log.html`**
  - Gantikan dengan skeleton table.

---

### Task 5: Pengujian Otomatis & Verifikasi Keseluruhan

- [x] **Step 1: Jalankan pytest untuk memverifikasi backend dan rendering template**
  ```powershell
  python -m pytest tests/ -q
  ```
- [x] **Step 2: Lakukan audit pola DOM dan CSS untuk memastikan tidak ada sisa `animate-spin`**
  - Lakukan ripgrep pada seluruh direktori `app/templates/kasir/` untuk memastikan tidak ada lagi spinner yang tersisa.
- [x] **Step 3: Verifikasi responsivitas breakpoint `lg`, `xl`, dan `2xl`**
  - Pastikan semua grid dan tabel mematuhi kelas breakpoint yang sama dengan komponen data asli.

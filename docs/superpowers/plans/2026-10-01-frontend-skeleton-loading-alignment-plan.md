# Standarisasi Selaras Skeleton Loading Frontend TMBilling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menstandarisasi seluruh state loading di antarmuka frontend TMBilling (seluruh tab, panel, tabel, dan modal) dari pola lama yang terpecah-pecah (spinner lingkaran `animate-spin`, teks polos "Memuat...", dan area kosong) menjadi **Skeleton Loading** yang selaras, rapi, modern, dan berestetika tinggi sesuai desain dark mode TMBilling.

**Architecture:**
1. **Core Skeleton Engine (`app/static/js/kasir/core/skeleton.js`)**: Modul singleton sentral yang menyediakan generator template HTML skeleton beranimasi (`animate-pulse` & gradient shimmer) untuk berbagai bentuk visual: kartu PC, kartu menu katalog 4:3, kartu paket, kartu turnamen, monitor screenshot 16:9, list catatan, list transaksi struk, struk thermal print preview, baris tabel responsif, log audit, sensor hardware monitor, dan form modal.
2. **Template Integration (`app/templates/kasir/base.html`)**: Pemuatan script `skeleton.js` pada core script pipeline sebelum modul-modul bisnis kasir dimuat.
3. **Tab & Modal Alignment**: Penggantian seluruh state spinner/teks pemuatan pada setiap modul JS dan template HTML dengan pemanggilan helper `Skeleton.*()` sebelum data asinkron tiba dari server.

**Tech Stack:** Vanilla JavaScript (ES6+), TailwindCSS (`animate-pulse`, subtle dark borders), HTML5 DOM, Jinja2 Templates.

## Global Constraints & Prinsip Desain
- **100% Skeleton Consistency**: Tidak ada lagi spinner lingkaran acak atau teks "Memuat..." yang merusak tata letak; setiap area konten memiliki skeleton yang merefleksikan bentuk data aslinya (Content-Shaped Skeletons).
- **Dark Mode Aesthetics**: Skeleton menggunakan palet netral ultra-dark (`#121212`, `#171717`, border `#1f1f1f`/`#262626`, placeholder bar `bg-neutral-800` / `bg-neutral-800/60`).
- **No Layout Shift (Zero CLS)**: Dimensi, padding, dan grid skeleton harus sama persis dengan elemen aslinya agar transisi saat data selesai dimuat berlangsung mulus tanpa loncatan visual.
- **State-Preserving Realtime Harmony**: Pembaruan background berkala (heartbeat realtime) tetap berjalan silent tanpa menampilkan kembali skeleton jika data sudah ada di layar, skeleton HANYA tampil pada inisialisasi awal atau pergantian filter/kategori yang memerlukan pemuatan baru.
- **Automated Verification**: Seluruh tes pytest dan build CSS wajib lulus setelah implementasi.

---

### Task 1: Fondasi Modul Sentral `Skeleton` (`skeleton.js` & `base.html`)

**Files:**
- Create: `app/static/js/kasir/core/skeleton.js`
- Modify: `app/templates/kasir/base.html`
- Modify: `app/static/css/input.css` (opsional jika membutuhkan keyframe shimmer khusus)

**Interfaces:**
- Produces: `window.Skeleton = Skeleton;` dengan method-method:
  - `Skeleton.pcCards(count = 12, mode = 'grid')`
  - `Skeleton.menuCards(count = 8)`
  - `Skeleton.paketCards(count = 6)`
  - `Skeleton.tournamentCards(count = 6)`
  - `Skeleton.tournamentBracket()`
  - `Skeleton.screenshotCards(count = 8)`
  - `Skeleton.notesList(count = 5)`
  - `Skeleton.strukList(count = 6)`
  - `Skeleton.strukThermal()`
  - `Skeleton.tableRows(rows = 6, cols = 5, options = {})`
  - `Skeleton.logRows(count = 8)`
  - `Skeleton.monitorRows(count = 8)`
  - `Skeleton.modalTambahInfo()`
  - `Skeleton.modalTambahPaket(count = 4)`

- [ ] **Step 1: Buat file `app/static/js/kasir/core/skeleton.js`**
  - Implementasikan modul `Skeleton` dengan helper generator HTML untuk semua varian UI.
  - Setiap skeleton menggunakan class `animate-pulse`, container `#0c0c0c` / `#121212`, border `#1c1c1c` / `#262626`, dan placeholder bar abu-abu netral.
- [ ] **Step 2: Daftarkan `skeleton.js` ke `app/templates/kasir/base.html`**
  - Sisipkan `<script src="{{ url_for('static', filename='js/kasir/core/skeleton.js') }}?v={{ v_cache }}"></script>` tepat setelah `utils.js` dan sebelum `toast.js`.
- [ ] **Step 3: Verifikasi ketersediaan global `window.Skeleton`**
  - Pastikan modul dapat diakses dari console dan oleh modul-modul lainnya.

---

### Task 2: Standarisasi Skeleton pada Dashboard & Monitor Screenshot

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/screenshot/index.js`

- [ ] **Step 1: Dashboard PC Cards Skeleton (`dashboard/index.js`)**
  - Saat `Dashboard.load()` dipanggil untuk pertama kali (sebelum data `API.dashboard.get()` tiba dan `!this.lastData`), render `Skeleton.pcCards(12)` ke dalam `#pc-area`.
  - Pada modal refund paket guest: render `Skeleton.tableRows(3, 3)` ke dalam container list riwayat paket sebelum data tiba.
- [ ] **Step 2: Screenshot Monitor Skeleton (`screenshot/index.js`)**
  - Pada `Screenshot.load()` awal (ketika `this.cachedData.length === 0`), render `Skeleton.screenshotCards(8)` ke dalam `#screenshot-grid`.
  - Hilangkan layar kosong sesaat sebelum data screenshot termuat.

---

### Task 3: Standarisasi Skeleton pada Tab Kantin (Menu) & Catatan

**Files:**
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/static/js/kasir/modules/menu/stock_log.js`
- Modify: `app/static/js/kasir/modules/catatan/index.js`

- [ ] **Step 1: Kantin / Menu Catalog Skeleton (`menu/index.js`)**
  - Pada `Menu.loadCatalog()` awal sebelum `Promise.all` fetch aktif & archived menu selesai, render `Skeleton.menuCards(8)` ke dalam `#menu-catalog-grid`.
- [ ] **Step 2: Modal Log Stok Menu Skeleton (`menu/stock_log.js`)**
  - Ganti spinner lama (`<div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div>`) pada `#menu-stock-log-tbody` dengan `Skeleton.tableRows(5, 5)`.
- [ ] **Step 3: Catatan Kasir Skeleton (`catatan/index.js`)**
  - Pada `Catatan.loadNotes()`, ganti spinner bulat pada `#notes-list-container` dengan `Skeleton.notesList(5)`.
  - Jika editor sedang memuat catatan spesifik (`selectNote`), tampilkan skeleton judul & skeleton area konten sebelum teks catatan siap.

---

### Task 4: Standarisasi Skeleton pada Tab Struk & Turnamen

**Files:**
- Modify: `app/static/js/kasir/modules/struk/index.js`
- Modify: `app/static/js/kasir/modules/tournament/index.js`

- [ ] **Step 1: Riwayat Transaksi & Preview Struk Skeleton (`struk/index.js`)**
  - Pada `Struk.loadHistory()` (bukan background silent), ganti spinner bulat pada `#struk-history-list` dengan `Skeleton.strukList(6)`.
  - Pada `Struk.cetak(sesiId)` / load detail transaksi, ganti spinner bulat pada `#struk-preview` dengan `Skeleton.strukThermal()`.
- [ ] **Step 2: Turnamen List & Stage Bracket Skeleton (`tournament/index.js`)**
  - Pada `Tournament.renderList()` (bukan silent), ganti teks "Memuat daftar turnamen..." pada `#tournaments-grid` dengan `Skeleton.tournamentCards(6)`.
  - Pada `Tournament.renderDetail()` (bukan silent), ganti teks "Memuat rincian turnamen..." pada `#stage-view-content` dengan `Skeleton.tournamentBracket()`.

---

### Task 5: Standarisasi Skeleton pada Tab Log, Hardware Monitor & Shift

**Files:**
- Modify: `app/static/js/kasir/modules/log/index.js`
- Modify: `app/static/js/kasir/modules/monitor/index.js`
- Modify: `app/static/js/kasir/modules/shift/index.js`
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js`

- [ ] **Step 1: Audit Log Rows Skeleton (`log/index.js`)**
  - Pada `Log.load()`, jika belum ada konten log atau saat berpindah kategori/pencarian, render `Skeleton.logRows(8)` ke dalam `#log-content`.
- [ ] **Step 2: Hardware Monitor Sensor Skeleton (`monitor/index.js`)**
  - Pada `Monitor.load()` awal, render `Skeleton.monitorRows(8)` ke dalam `#monitor-table`.
- [ ] **Step 3: Riwayat Shift & Log Aktivitas Staf Skeleton (`shift/index.js`)**
  - Pada `Shift.loadHistory()`, ganti spinner dan teks dengan `Skeleton.tableRows(5, 8)` pada `#shift-history-list`.
  - Pada `Shift.loadUserLogs()`, ganti spinner dan teks dengan `Skeleton.tableRows(6, 5)` pada `#user-logs-rows`.
- [ ] **Step 4: Hardware Checker & Tiket Perawatan Skeleton (`hardware_checker/index.js`)**
  - Ganti spinner pada `#hardware-checker-table` dan tabel tiket dengan `Skeleton.tableRows(6, 5)`.

---

### Task 6: Standarisasi Skeleton pada Tab Master Data & Multi-Cabang

**Files:**
- Modify: `app/static/js/kasir/modules/member/index.js`
- Modify: `app/static/js/kasir/modules/paket/index.js`
- Modify: `app/static/js/kasir/modules/grup/index.js`
- Modify: `app/static/js/kasir/modules/pc/index.js`
- Modify: `app/static/js/kasir/modules/user/index.js`
- Modify: `app/static/js/kasir/modules/uptime/index.js`
- Modify: `app/static/js/kasir/modules/blackout/index.js`
- Modify: `app/static/js/kasir/modules/laporan/index.js`
- Modify: `app/static/js/kasir/modules/laporan_menu/index.js`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Master Member, Paket, Grup, PC, Akun Kasir Skeleton**
  - Ganti spinner di `member/index.js` dengan `Skeleton.tableRows(8, 6)`.
  - Ganti spinner di `paket/index.js` dengan `Skeleton.paketCards(6)`.
  - Ganti spinner di `grup/index.js` dengan `Skeleton.tableRows(4, 4)`.
  - Ganti spinner di `pc/index.js` dengan `Skeleton.tableRows(8, 5)`.
  - Ganti spinner di `user/index.js` dengan `Skeleton.tableRows(5, 4)`.
- [ ] **Step 2: Laporan, Uptime & Blackout Skeleton**
  - Ganti spinner di `uptime/index.js` dengan `Skeleton.tableRows(8, 6)`.
  - Ganti spinner di `blackout/index.js` dengan `Skeleton.tableRows(5, 5)`.
  - Ganti spinner di `laporan/index.js` & `laporan_menu/index.js` dengan `Skeleton.tableRows(8, 6)`.
- [ ] **Step 3: Multi-Cabang / Branch Tables Skeleton (`branch/index.js`)**
  - Ganti area loading di `#branch-list-tbody`, `#branch-operators-tbody`, dan `#branch-inbound-tbody` dengan `Skeleton.tableRows(4, 5)`.

---

### Task 7: Standarisasi Skeleton pada Modal Utama (Tambah Waktu & Buka Sesi)

**Files:**
- Modify: `app/static/js/kasir/components/modal-tambah.js`
- Modify: `app/static/js/kasir/components/modal-buka.js`

- [ ] **Step 1: Modal Tambah Waktu Skeleton (`modal-tambah.js`)**
  - Saat modal dibuka dan menunggu fetch data sesi & paket aktif, render layout modal dengan skeleton card target sesi dan skeleton list pilihan paket.
- [ ] **Step 2: Modal Buka Sesi Skeleton (`modal-buka.js`)**
  - Ganti spinner kecil pada daftar pilihan paket awal dengan skeleton pilihan paket radio/card.

---

### Task 8: Verifikasi Menyeluruh, Build CSS & Automated Testing

**Files:**
- Output: `app/static/css/tailwind.css`

- [ ] **Step 1: Kompilasi Tailwind CSS**
  - Jalankan `npm run build:css` untuk memastikan class utilitas skeleton terkompilasi optimal.
- [ ] **Step 2: Jalankan Pytest Suite**
  - Jalankan `.venv\Scripts\python -m pytest` dan pastikan seluruh test suite (259 passed) tetap 100% hijau.
- [ ] **Step 3: Re-index Codebase Memory**
  - Jalankan `index_repository` via MCP `codebase-memory`.

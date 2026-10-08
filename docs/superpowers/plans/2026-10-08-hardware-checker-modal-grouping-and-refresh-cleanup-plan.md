# Hardware Checker Modal, Grouping by ID, and Global Refresh Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti accordion inline Hardware Checker dengan Modal Detail Spesifikasi lengkap (bebas truncate di semua layar), menambahkan filter per grup dan grouping berbasis ID pembuatan database, serta mengeliminasi tombol refresh manual usang pada 9 tab kasir agar tersinkronisasi penuh dengan global polling loop `app.js`.

**Architecture:** Memanfaatkan engine `Modal.show()` untuk menampilkan perbandingan komprehensif Baseline vs Live Telemetry; mengelompokkan data hardware checker berdasarkan `pc_grup_id` (ID database) baik pada opsi filter dropdown maupun seksi visual "Semua Grup"; menghapus tombol refresh manual pada template Jinja2 dan menstandarkan hook `refreshLive()` agar modul dieksekusi secara periodik dan senyap via `App.startDashboardPolling()`.

**Tech Stack:** JavaScript (ES6+), Jinja2 HTML templates, Tailwind CSS v3, Python Flask backend, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-08-hardware-checker-modal-grouping-and-refresh-cleanup-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-10-08-hardware-checker-modal-grouping-and-refresh-cleanup-design.md)

## Global Constraints

- Selektor CSS `body[data-branch-mode="remote"] .remote-hide-action` tetap aktif untuk seluruh tombol aksi mutasi (termasuk tombol Update Baseline di dalam modal baru).
- Seluruh 271 test pada test suite `pytest tests/` harus selalu lulus 100%.
- File manager (`fileexplorer`) dikecualikan dari polling otomatis global untuk menjaga beban I/O server.
- Urutan grup harus selalu konsisten berbasis ID pembuatan database (`grup_id` ascending 1, 2, 3...).

---

### Task 1: Eliminasi Tombol Refresh Manual pada 9 Tab Template Kasir

**Files:**
- Modify: [`app/templates/kasir/tabs/hardware_checker.html:11-15`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/hardware_checker.html)
- Modify: [`app/templates/kasir/tabs/monitor.html:6-8`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/monitor.html)
- Modify: [`app/templates/kasir/tabs/screenshot.html:16-19`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/screenshot.html)
- Modify: [`app/templates/kasir/tabs/blackout.html:40-42`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/blackout.html)
- Modify: [`app/templates/kasir/tabs/maintenance.html:17-20`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/maintenance.html)
- Modify: [`app/templates/kasir/tabs/laporan_maintenance.html:17-20`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/laporan_maintenance.html)
- Modify: [`app/templates/kasir/tabs/menu_stock_log.html:15-23`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/menu_stock_log.html)
- Modify: [`app/templates/kasir/tabs/shift_history.html:15-20`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/shift_history.html)
- Modify: [`app/templates/kasir/tabs/user_logs.html:15-20`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/user_logs.html)

**Interfaces:**
- Consumes: Template Jinja2 kasir
- Produces: Clean action headers tanpa tombol manual refresh

- [ ] **Step 1: Hapus tombol refresh di `hardware_checker.html` dan `monitor.html`**
  Hapus elemen tombol `#hc-refresh-btn` dan tombol `Monitor.load()`.

- [ ] **Step 2: Hapus tombol refresh di `screenshot.html` dan `blackout.html`**
  Hapus elemen tombol `Screenshot.load()` dan `Blackout.load()`.

- [ ] **Step 3: Hapus tombol refresh di `maintenance.html` dan `laporan_maintenance.html`**
  Hapus tombol `Maintenance.load()` dan `LaporanMaintenance.loadReport()`.

- [ ] **Step 4: Hapus tombol refresh di `menu_stock_log.html`, `shift_history.html`, dan `user_logs.html`**
  Hapus tombol `MenuStockLog.load()`, `Shift.loadHistory()`, dan `Shift.loadUserLogs()`.

- [ ] **Step 5: Verifikasi perubahan template dan kompilasi CSS**
  Jalankan: `npm run build:css`
  Expected: Berhasil tanpa error.

---

### Task 2: Penyelarasan Global Polling Loop & Pembersihan Modul JS

**Files:**
- Modify: [`app/static/js/kasir/app.js:88-92`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js)
- Modify: [`app/static/js/kasir/modules/hardware_checker/index.js:38-48`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/hardware_checker/index.js)

**Interfaces:**
- Consumes: `App.startDashboardPolling()`, `Dashboard.getRefreshInterval()`
- Produces: `HardwareChecker.refreshLive()` method

- [ ] **Step 1: Tambahkan method `refreshLive()` pada `HardwareChecker`**
  Di `hardware_checker/index.js`:
  ```javascript
  refreshLive() {
      if (typeof App !== 'undefined' && App.currentTab !== 'hardware_checker') return;
      return this.load(false, true);
  },
  ```

- [ ] **Step 2: Bersihkan referensi elemen `#hc-refresh-btn` dan `#hc-refresh-icon`**
  Hapus kode yang mencoba mendisable tombol refresh atau menganimasikan icon spin saat loading.

- [ ] **Step 3: Selaraskan pemanggilan `HardwareChecker.refreshLive()` di `app.js`**
  Di `app.js`:
  ```javascript
  case 'hardware_checker':
      if (typeof HardwareChecker !== 'undefined' && typeof HardwareChecker.refreshLive === 'function') HardwareChecker.refreshLive();
      break;
  ```

- [ ] **Step 4: Verifikasi sintaks JavaScript**
  Jalankan browser check / linter check untuk memastikan tidak ada kesalahan sintaks.

---

### Task 3: Group Filter & Grouping Berbasis ID pada Hardware Checker

**Files:**
- Modify: [`app/templates/kasir/tabs/hardware_checker.html:4-16`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/hardware_checker.html)
- Modify: [`app/static/js/kasir/modules/hardware_checker/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/hardware_checker/index.js)

**Interfaces:**
- Consumes: `API.grup.list()`, `result.data` dari `API.monitor.all()`
- Produces: `HardwareChecker.filterGroup`, `HardwareChecker.populateGroupFilter()`, `HardwareChecker.onGroupFilterChange()`

- [ ] **Step 1: Tambahkan dropdown filter grup di header `hardware_checker.html`**
  ```html
  <div class="flex items-center gap-2">
      <label for="hc-group-filter" class="sr-only">Filter Grup</label>
      <select id="hc-group-filter" onchange="HardwareChecker.onGroupFilterChange(this.value)"
          class="px-3 py-1.5 bg-[#0a0a0a] border border-[#262626] rounded text-xs lg:text-sm text-neutral-200 focus:outline-none focus:border-neutral-500">
          <option value="all">Semua Grup</option>
      </select>
  </div>
  ```

- [ ] **Step 2: Tambahkan state filter dan method `populateGroupFilter` di `HardwareChecker`**
  Pastikan opsi grup terurut berdasarkan `grup_id` ascending (`idA - idB`).

- [ ] **Step 3: Implementasikan grouping berbasis `grup_id` saat `filterGroup === 'all'`**
  Bagi kartu PC ke dalam seksi visual per grup:
  - Header seksi: `[ NAMA GRUP • X UNIT ]`
  - Kontainer grid 2-kolom kompak untuk kartu unit PC di grup tersebut.
  - Urutkan seksi grup berdasarkan `pc_grup_id` (urutan pembuatan database).

- [ ] **Step 4: Implementasikan penyaringan saat grup tertentu dipilih (`filterGroup !== 'all'`)**
  Tampilkan hanya unit PC milik grup tersebut dalam grid 2-kolom.

---

### Task 4: Implementasi Detail Modal Hardware Checker & Eliminasi Accordion Inline

**Files:**
- Modify: [`app/static/js/kasir/modules/hardware_checker/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/hardware_checker/index.js)

**Interfaces:**
- Consumes: `Modal.show()`, `Modal.closeModal()` dari `core/modal.js`
- Produces: `HardwareChecker.showDetailModal(pcId)`

- [ ] **Step 1: Hapus method accordion `toggleDetails` dan inline accordion DOM**
  Hapus kontainer `#hc-details-${m.pc_id}` dari badan kartu PC.

- [ ] **Step 2: Pasang tombol `🔍 Detail` yang memanggil `HardwareChecker.showDetailModal(m.pc_id)`**
  Tombol kartu tetap ringkas:
  - Tombol Detail: `HardwareChecker.showDetailModal(${m.pc_id})`
  - Tombol Baseline: `HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}')`

- [ ] **Step 3: Buat method `showDetailModal(pcId)` dengan visual komprehensif**
  - Mengambil data PC dari cache data.
  - Membangun modal popup:
    - **Header**: Kode PC, Group Badge, Status Badge Keamanan, tombol X.
    - **Body (Scrollable `max-h-[75vh]`):**
      - Mismatch Alert CCTV (jika ada) tanpa truncate.
      - 2 Kolom Komparasi:
        - Kiri: 🔒 **Baseline Resmi (Terkunci)** — Mobo Model & Serial, CPU Model & ID, GPU Model & Full PNP ID (select-all), RAM Serials pills, Disk Serials pills.
        - Kanan: 🔍 **Live Telemetry (Terdeteksi)** — Mobo Model & Serial, CPU Model & ID, GPU Model & Full PNP ID (select-all), RAM Serials pills (merah jika tukar), Disk Serials pills (merah jika tukar).
    - **Footer**: Last sync time, Gigabit NIC status, tombol `🔄 Update Baseline` (tagged `.remote-hide-action`), tombol `Tutup`.
  - Panggil `Modal.show(modalHtml, null, { disableBackdropClose: false })`.

- [ ] **Step 4: Verifikasi tampilan modal dan kelengkapan teks**
  Pastikan serial number dan GPU PNP ID dapat dilihat dan disalin secara utuh tanpa terpotong truncate di resolusi manapun.

---

### Task 5: Verifikasi Menyeluruh, Test Suite, dan Update Master Memory

**Files:**
- Modify: [`ANTIGRAVITY.md`](file:///c:/Project%20GIT/TMBilling/ANTIGRAVITY.md)
- Test: `tests/`

- [ ] **Step 1: Jalankan kompilasi CSS**
  Run: `npm run build:css`
  Expected: Minified CSS berhasil diperbarui.

- [ ] **Step 2: Jalankan test suite pytest**
  Run: `python -m pytest tests/`
  Expected: 271 passed (100%).

- [ ] **Step 3: Update dokumentasi dan changelog di `ANTIGRAVITY.md`**
  Catat implementasi modal hardware checker, filter & grouping grup, serta eliminasi tombol refresh manual.

- [ ] **Step 4: Sinkronisasi codebase memory MCP**
  Jalankan `detect_changes` dan `index_repository`.

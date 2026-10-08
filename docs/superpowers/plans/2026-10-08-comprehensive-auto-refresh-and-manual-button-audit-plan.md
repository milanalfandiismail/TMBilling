# Comprehensive Auto-Refresh and Manual Button Elimination Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menuntaskan audit dan standardisasi auto-refresh ke seluruh 32 tab/subtab kasir/admin TMBilling, mengeliminasi tombol manual refresh yang tersisa (`server_statistic.html`), memperbaiki guard nama tab yang rusak pada 4 modul JS (`laporan_menu`, `game_management`, `plugins`, `branch`), serta memutus auto-polling pada `fileexplorer` agar tidak membebani CPU dan disk I/O.

**Architecture:** Menggunakan loop interval terpusat di `app.js` (`startDashboardPolling`), di mana setiap modul mengimplementasikan `refreshLive()` dengan silent fingerprint diff (`isSilent = true`) dan form/modal guard, sementara tab berat filesystem (`fileexplorer`) sengaja dipertahankan manual dengan tombol Refresh tersendiri.

**Tech Stack:** JavaScript (ES6+ Vanilla Modular), HTML5 / Jinja2 Templates, Tailwind CSS v3 Minified, Python Flask Backend, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-08-comprehensive-auto-refresh-and-manual-button-audit-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-10-08-comprehensive-auto-refresh-and-manual-button-audit-design.md)

## Global Constraints
- Seluruh 32 tab kasir/admin tidak boleh memiliki tombol "Refresh" manual kecuali `fileexplorer.html`.
- Pembaruan live harus berjalan secara senyap (tanpa skeleton loading berulang kali jika data sudah pernah dirender).
- Input form/modal yang sedang diedit pengguna tidak boleh ter-reset saat auto-refresh berjalan di background.
- Pytest 271 unit test specs harus 100% passed (`271 passed`).

---

### Task 1: Eliminasi Tombol Refresh Manual di `server_statistic.html` & Integrasi Live Polling `ServerMonitor`

**Files:**
- Modify: [`app/templates/kasir/server_monitor/server_statistic.html:20-25`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/server_monitor/server_statistic.html)
- Modify: [`app/static/js/kasir/modules/server_monitor/server_monitor.js:10-25`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/server_monitor/server_monitor.js)
- Modify: [`app/static/js/kasir/app.js:130-155`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js)

**Interfaces:**
- Consumes: `API.request('/api/v1/kasir/server-monitor/metrics')`, `API.request('/api/v1/kasir/server-monitor/lhm/status')`
- Produces: `ServerMonitor.refreshLive()`

- [ ] **Step 1: Hapus tombol manual "Refresh" dari header `server_statistic.html`**
  Hapus elemen tombol:
  ```html
  <button onclick="ServerMonitor.fetchMetrics()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" ...></svg>
      Refresh
  </button>
  ```
  Pertahankan indikator status `#sm-status` dan kontrol `#lhm-toggle` agar header tetap rapi dan bersih.

- [ ] **Step 2: Tambahkan method `refreshLive()` pada `ServerMonitor` di `server_monitor.js`**
  ```javascript
  refreshLive() {
      if (typeof App !== 'undefined' && App.currentTab !== 'server_statistic') return;
      return this.fetchMetrics();
  },
  ```

- [ ] **Step 3: Hubungkan `server_statistic` ke polling loop di `app.js`**
  Di `startDashboardPolling()` pada `app.js`:
  ```javascript
  case 'server_statistic':
      if (typeof ServerMonitor !== 'undefined' && typeof ServerMonitor.refreshLive === 'function') ServerMonitor.refreshLive();
      break;
  ```

---

### Task 2: Perbaikan Broken Tab Guards di 4 Modul (`laporan_menu`, `game_management`, `plugins`, `branch`)

**Files:**
- Modify: [`app/static/js/kasir/modules/laporan_menu/index.js:115-125`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/laporan_menu/index.js)
- Modify: [`app/static/js/kasir/modules/game/index.js:43-55`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/game/index.js)
- Modify: [`app/static/js/kasir/modules/settings/plugins.js:10-20`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/settings/plugins.js)
- Modify: [`app/static/js/kasir/modules/branch/index.js:60-80`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/branch/index.js)

**Interfaces:**
- Consumes: `App.currentTab`
- Produces: Respon auto-refresh yang akurat saat user berada di tab `laporan_menu`, `game_management`, `plugins`, `branch_inbound`, dan `branch_kasir`.

- [ ] **Step 1: Perbaiki guard tab di `laporan_menu/index.js`**
  Ubah guard:
  ```javascript
  refreshLive() {
      if (typeof App !== 'undefined' && !['laporan_menu', 'laporan-menu'].includes(App.currentTab)) return;
      return this.fetchData(true);
  },
  ```

- [ ] **Step 2: Perbaiki guard tab di `game/index.js`**
  Ubah guard:
  ```javascript
  refreshLive() {
      if (typeof App !== 'undefined' && !['game', 'game_management'].includes(App.currentTab)) return;
      const modalForm = document.getElementById('game-modal');
      const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
      if ((modalForm && !modalForm.classList.contains('hidden')) || isAppModalOpen) {
          return;
      }
      return this.fetchGames(true);
  },
  ```

- [ ] **Step 3: Perbaiki guard tab di `settings/plugins.js`**
  Ubah guard:
  ```javascript
  refreshLive: function() {
      if (typeof App !== 'undefined' && !['settings', 'plugins'].includes(App.currentTab)) return;
      if (App.currentTab === 'plugins') {
          return this.fetchPlugins(true);
      }
      const subTab = document.getElementById('settings-subtab-plugins');
      if (subTab && subTab.classList.contains('hidden')) return;
      return this.fetchPlugins(true);
  },
  ```

- [ ] **Step 4: Tambahkan auto-reload untuk `branch_inbound` dan `branch_kasir` di `branch/index.js`**
  Di `BranchManager.refreshLive()`:
  ```javascript
  if (App.currentTab === 'branch_inbound') {
      await this.loadInboundBranches();
  }
  if (App.currentTab === 'branch_kasir') {
      await this.loadRemoteOperators();
  }
  ```

---

### Task 3: Pemutusan FileExplorer dari Interval Polling Otomatis di `app.js` demi Penghematan CPU & Disk

**Files:**
- Modify: [`app/static/js/kasir/app.js:130-133`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js)
- Modify: [`app/static/js/kasir/modules/fileexplorer/index.js:90-100`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/fileexplorer/index.js)

**Interfaces:**
- Consumes: User click pada tombol `<button onclick="FileExplorer.refresh()">`
- Produces: Peniadaan auto-polling filesystem di background

- [ ] **Step 1: Hapus `case 'fileexplorer':` dari `startDashboardPolling` di `app.js`**
  Hapus blok pemanggilan `FileExplorer.refreshLive()` dari `setInterval` agar browser tidak memanggil `list` direktori setiap interval detik.

- [ ] **Step 2: Nonaktifkan auto-polling di `FileExplorer.refreshLive()` pada `fileexplorer/index.js`**
  Ubah `refreshLive()` menjadi no-op atau return segera, sehingga satu-satunya cara me-refresh isi direktori adalah saat user membuka folder atau menekan tombol manual **Refresh** yang telah disediakan di toolbar File Explorer.

---

### Task 4: Kompilasi Asset CSS, Pengujian Pytest Suite, dan Sinkronisasi Master Memory ANTIGRAVITY.md + MCP codebase-memory

**Files:**
- Modify: [`ANTIGRAVITY.md`](file:///c:/Project%20GIT/TMBilling/ANTIGRAVITY.md)
- Test: `tests/`

- [ ] **Step 1: Kompilasi CSS Tailwind**
  Run: `npm run build:css`
  Expected: Minified CSS berhasil dibangun tanpa error.

- [ ] **Step 2: Jalankan test suite pytest**
  Run: `python -m pytest tests/`
  Expected: 271 passed (100%).

- [ ] **Step 3: Dokumentasikan hasil audit dan perbaikan di `ANTIGRAVITY.md`**
  Catat eliminasi tombol refresh `server_statistic`, perbaikan guard 4 tab modul, serta isolasi beban CPU/Disk `fileexplorer`.

- [ ] **Step 4: Re-index MCP codebase-memory**
  Jalankan `detect_changes` dan `index_repository`.

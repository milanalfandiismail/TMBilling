# Comprehensive Auto-Refresh and Manual Button Elimination Design

> **Document:** Design Specification  
> **Status:** Draft / Ready for Plan  
> **Date:** 2026-10-08  
> **Branch:** `v1.6.4`  
> **Topic:** Audit Menyeluruh Auto-Refresh Semua Tab Kasir, Eliminasi Tombol Refresh Manual, dan Proteksi Beban CPU/Disk

---

## 1. Executive Summary

Berdasarkan audit menyeluruh terhadap 32 tab dan subtab antarmuka kasir/admin TMBilling, sistem telah mengadopsi mekanisme auto-refresh global terpusat di `app.js` (`startDashboardPolling`), yang berjalan senyap (silent) dengan interval adaptif 1s/2s/3s/5s sesuai pengaturan pada dashboard.

Namun, hasil audit mendalam menemukan 4 kelompok isu krusial:
1. **Sisa Tombol Refresh Manual**: Masih ada tombol manual "Refresh" di tab [`server_statistic.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/server_monitor/server_statistic.html). Tombol ini perlu dieliminasi.
2. **Tab dengan Nama Beda / Broken Guard di `refreshLive()`**:
   - `laporan_menu`: Guard di `index.js` memeriksa `App.currentTab !== 'laporan-menu'`, padahal di sistem tab-nya bernama `laporan_menu` (dengan underscore). Akibatnya tab ini **tidak pernah ter-refresh otomatis**.
   - `game_management`: Guard di `index.js` memeriksa `App.currentTab !== 'game'`, padahal di sistem tab-nya bernama `game_management`. Akibatnya tab ini **tidak pernah ter-refresh otomatis**.
   - `plugins`: Guard di `plugins.js` memeriksa `App.currentTab !== 'settings'`, padahal tab di sidebar bernama `plugins`. Akibatnya saat membuka tab ekstensi & plugin, data **tidak pernah ter-refresh otomatis**.
   - `branch_inbound` & `branch_kasir`: Method `refreshLive()` di `branch/index.js` hanya memproses `branch`, mengabaikan `branch_inbound` dan `branch_kasir`.
3. **Tab yang Berbahaya Jika Terus Di-polling (CPU & Disk Overload)**:
   - `fileexplorer`: Saat ini terdaftar di `app.js` loop polling (`FileExplorer.refreshLive()`), yang membaca struktur direktori filesystem setiap 1-5 detik! Hal ini menyebabkan lonjakan I/O disk dan CPU server/klien. Tab ini **WAJIB dihentikan dari loop interval auto-polling** dan hanya mengandalkan tombol manual "Refresh".
   - Settings on-demand actions (`settings_migration`, `settings_local_backup`, `settings_cloud_backup`, `settings_db_cleanup`): Merupakan utilitas batch/destruktif yang dijalankan hanya saat admin menekan tombol aksi (bukan data polling).
4. **`server_statistic` Live Integration**:
   - Diintegrasikan ke dalam siklus `startDashboardPolling` di `app.js` dengan method `ServerMonitor.refreshLive()`, dan tombol manual refresh di template HTML dihilangkan.

---

## 2. Arsitektur Polling & Matriks Tab

### 2.1 Tab Auto-Refresh Aktif (Silent & State-Preserving)

| Modul Tab | Template | Method Polling | Mekanisme Anti-Flicker / State Guard |
|---|---|---|---|
| `dashboard` / `dash` | `dashboard.html` | `Dashboard.load(true)` | In-place live sync PC cards & stat badges |
| `pc` | `pc.html` | `PC.refreshLive()` | Skip jika modal form tambah/batch terbuka |
| `paket` | `paket.html` | `Paket.refreshLive()` | Skip jika modal paket terbuka, fingerprint diff |
| `member` | `member.html` | `Member.refreshLive()` | Skip jika modal member terbuka, fingerprint diff |
| `grup` | `grup.html` | `Grup.refreshLive()` | Fingerprint JSON diff pada daftar grup |
| `user` | `user.html` | `User.refreshLive()` | Fingerprint JSON diff pada daftar kasir/admin |
| `menu` | `menu.html` | `Menu.refreshLive()` | Skip jika modal restock/form/lightbox terbuka |
| `menu_stock_log` | `menu_stock_log.html` | `MenuStockLog.refreshLive()` | Auto fetch logs dengan pagination preservation |
| `tournament` | `tournament.html` | `Tournament.refreshLive()` | Skip jika modal skor/buat/lolos terbuka |
| `catatan` | `catatan.html` | `Catatan.refreshLive()` | Silent fetch notes |
| `struk` | `struk.html` | `Struk.refreshLive()` | In-place delta update struk history |
| `screenshot` | `screenshot.html` | `Screenshot.refreshLive()` | Delta DOM update per PC card |
| `log` | `log.html` | `Log.refreshLive()` | Fingerprint timestamp log teratas |
| `monitor` | `monitor.html` | `Monitor.refreshLive()` | Silent table row sync |
| `hardware_checker` | `hardware_checker.html` | `HardwareChecker.refreshLive()` | In-place fingerprint check, group preserve |
| `maintenance` | `maintenance.html` | `Maintenance.refreshLive()` | Skip jika modal tiket/detail terbuka |
| `laporan_maintenance`| `laporan_maintenance.html` | `LaporanMaintenance.refreshLive()` | Silent fetch report data |
| `uptime` | `uptime.html` | `UptimeTracker.refreshLive()` | Silent table rows reload |
| `blackout` | `blackout.html` | `Blackout.refreshLive()` | Silent cards refresh |
| `laporan` | `laporan.html` | `Laporan.refreshLive()` | Fingerprint total & history ID |
| `laporan_menu` | `laporan_menu.html` | `LaporanMenu.refreshLive()` | **[FIX]** Guard diperbaiki agar menerima `laporan_menu` |
| `shift_history` | `shift_history.html` | `Shift.refreshHistoryLive()` | Fingerprint diff riwayat shift |
| `user_logs` | `user_logs.html` | `Shift.refreshHistoryLive()` | Fingerprint diff log audit user |
| `game_management` | `game.html` | `GameManagement.refreshLive()` | **[FIX]** Guard diperbaiki agar menerima `game_management` |
| `analytics` | `analytics.html` | `OwnerAnalytics.refreshLive()` | Fingerprint date & KPI diff |
| `plugins` | `settings/plugins.html` | `PluginsModule.refreshLive()` | **[FIX]** Guard diperbaiki agar menerima `plugins` |
| `mikrotik` | `mikrotik.html` | `MikrotikModule.refreshLive()` | Skip update jika user aktif fokus pada input |
| `server_statistic` | `server_statistic.html` | `ServerMonitor.refreshLive()` | **[FIX]** Tombol manual dihapus, terhubung ke loop |
| `branch` | `branch.html` | `BranchManager.refreshLive()` | Silent reload branches & dropdown |
| `branch_inbound` | `branch_inbound.html` | `BranchManager.refreshLive()` | **[FIX]** Reload inbound branches otomatis |
| `branch_kasir` | `branch_kasir.html` | `BranchManager.refreshLive()` | **[FIX]** Reload remote operators otomatis |

---

### 2.2 Tab Pengecualian (Manual Saja Demi CPU & Disk I/O)

1. **`fileexplorer` (`fileexplorer.html`)**:
   - Membaca daftar file dan folder di disk lokal/klien via filesystem OS.
   - Polling setiap 1-5 detik menyebabkan `os.scandir` atau `dir` berulang kali, menghabiskan disk I/O dan CPU.
   - **Keputusan**: Dihapus dari loop `startDashboardPolling` di `app.js`. Tombol manual "Refresh" di [`fileexplorer.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/fileexplorer.html) tetap dipertahankan.
2. **`settings_migration`, `settings_local_backup`, `settings_cloud_backup`, `settings_db_cleanup`**:
   - Merupakan task batch on-demand (membuat zip backup, migrasi database alembic, vacuum database).
   - Bukan tabel data realtime, melainkan tombol trigger aksi.

---

## 3. Rencana Perubahan Detail

### 3.1 Eliminasi Tombol Refresh Manual di `server_statistic.html`
- Hapus tag `<button onclick="ServerMonitor.fetchMetrics()">...Refresh</button>`.
- Di `server_monitor.js`, tambahkan method `refreshLive()` dan hilangkan duplicate timer internal saat tab aktif, digantikan oleh ritme dashboard polling global.
- Di `app.js`, tambahkan `case 'server_statistic': ServerMonitor.refreshLive(); break;`.

### 3.2 Perbaikan Guard Tab pada 4 Modul JS
1. **`app/static/js/kasir/modules/laporan_menu/index.js`**:
   Ubah baris 119:
   ```javascript
   if (typeof App !== 'undefined' && !['laporan_menu', 'laporan-menu'].includes(App.currentTab)) return;
   ```
2. **`app/static/js/kasir/modules/game/index.js`**:
   Ubah baris 46:
   ```javascript
   if (typeof App !== 'undefined' && !['game', 'game_management'].includes(App.currentTab)) return;
   ```
3. **`app/static/js/kasir/modules/settings/plugins.js`**:
   Ubah baris 13:
   ```javascript
   if (typeof App !== 'undefined' && !['settings', 'plugins'].includes(App.currentTab)) return;
   if (App.currentTab === 'plugins') {
       return this.fetchPlugins(true);
   }
   ```
4. **`app/static/js/kasir/modules/branch/index.js`**:
   Perluas `refreshLive()`:
   ```javascript
   if (App.currentTab === 'branch_inbound') {
       await this.loadInboundBranches();
   }
   if (App.currentTab === 'branch_kasir') {
       await this.loadRemoteOperators();
   }
   ```

### 3.3 Pemutusan FileExplorer dari Interval Polling di `app.js`
- Hapus `case 'fileexplorer':` dari `startDashboardPolling()` di [`app.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js).
- Pastikan tab File Explorer hanya melakukan scan disk saat pertama kali dibuka atau saat tombol manual Refresh diklik.

---

## 4. Kriteria Keberhasilan (Acceptance Criteria)
1. Seluruh 32 tab kasir/admin terverifikasi tidak memiliki tombol "Refresh" manual kecuali `fileexplorer.html`.
2. Seluruh tab data langsung me-refresh dan memperbarui tampilannya secara otomatis saat data di backend berubah tanpa perlu reload halaman.
3. Tab `fileexplorer` tidak membebani CPU/Disk di background polling.
4. Seluruh test suite pytest (271 specs) tetap lulus 100%.

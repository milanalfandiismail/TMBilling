# Perbaikan Dashboard Kasir, Active Sidebar, Perataan Menu Kendali Server, dan Sinkronisasi Multi-Cabang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Menyederhanakan halaman Dashboard Kasir dengan menghapus 4 kartu statistik agar dalam 1 layar atas ke bawah langsung fokus pada grid Unit PC.
2. Memastikan tombol Dashboard di sidebar langsung menyala aktif (*highlighted*) secara default saat pertama kali login / muat halaman.
3. Memperbaiki perataan teks pada menu *Kendali Jarak Jauh Server* di sidebar agar baris teks kedua tidak bertumpuk di bawah logo/icon satelit.
4. Memperbaiki modul sistem (*Monitor Hardware, Statistik Server, Hardware Checker, Pelacak Statistik PC, Perawatan PC, Pemulihan Mati Lampu*) agar otomatis mengambil data cabang remote yang dipilih saat berganti cabang dan tidak tertahan di cabang lokal.

**Architecture:**
1. **Pembersihan Dashboard Kasir:**
   - Menghapus blok elemen `#dashboard-stats` dari `app/templates/kasir/tabs/dashboard.html`.
   - Merapikan `app/static/js/kasir/modules/dashboard/index.js` agar aman dari null-pointer (*graceful no-op*).
2. **Initial Active State Sidebar:**
   - Menyetel class aktif default pada tombol Dashboard di `app/templates/kasir/components/sidebar.html`.
   - Memanggil `this.setupNavigation()` dan `this.switchTab('dash')` pada `App.init()` di `app/static/js/kasir/app.js`.
3. **Perataan Teks & Logo Submenu Sidebar:**
   - Memisahkan icon dan teks pada tombol submenu di `app/templates/kasir/components/sidebar.html` menjadi `<span class="shrink-0">` dan `<span class="leading-tight">` dengan container `flex items-start gap-2.5`.
4. **Sinkronisasi Multi-Cabang Komprehensif (X-Branch-ID Relay):**
   - Menghubungkan endpoint Hardware Monitor ke blueprint `/api/v1/kasir/monitor/` di `app/routes/monitor/monitor_routes.py` dan `app/static/js/kasir/core/api.js` agar di-intercept & di-relay oleh `BranchProxyService` saat memilih cabang remote (sebelumnya memanggil `/api/v1/public/monitor/` yang mem-bypass relay).
   - Menambahkan handler `case 'server_statistic'` di `App.loadTab()` pada `app/static/js/kasir/app.js`.
   - Menyempurnakan lifecycle reset & reload di `BranchManager.refreshAllModulesAfterBranchSwitch()` pada `app/static/js/kasir/modules/branch/index.js` untuk modul `Monitor`, `HardwareChecker`, `ServerMonitor`, `UptimeTracker`, `Maintenance`, `LaporanMaintenance`, dan `Blackout`.

**Tech Stack:** Python (Flask, Jinja2), Vanilla JavaScript (ES6), HTML5, Tailwind CSS.

**Spec:** Permintaan pengguna per 15 September 2026:
1. Hapus 4 kotak statistik di Dashboard (Sesi Aktif, PC Tersedia, Koneksi Terputus, Omzet Hari Ini).
2. Sidebar tab Dashboard harus langsung menyala/aktif saat awal login ke kasir.
3. Perbaiki susunan teks menu sidebar "Kendali Jarak Jauh Server".
4. Pastikan data pada Monitor Hardware, Statistik Server, Hardware Checker, Pelacak Statistik PC, Perawatan PC, dan Pemulihan Mati Lampu mengambil data cabang yang dipilih saat berganti cabang.

## Global Constraints
- Navigasi tab kasir (`App.switchTab`) dan otentikasi role tetap aman.
- Akses multi-cabang tetap terproteksi via `BranchProxyService` dan `login_required` Bearer API Key.
- Zero layout shift dan zero runtime console error.

---

### Task 1: Pembersihan Baris Statistik di Dashboard Kasir

**Files:**
- Modify: `app/templates/kasir/tabs/dashboard.html:1-45`
- Modify: `app/static/js/kasir/modules/dashboard/index.js:400-415`

**Interfaces:**
- Consumes: Template dashboard dan service PC.
- Produces: Layout dashboard tanpa blok statistik, langsung menampilkan filter grup dan grid kartu PC.

- [x] **Step 1: Hapus `#dashboard-stats` di `app/templates/kasir/tabs/dashboard.html`**
  Hapus baris 4 sampai 43 pada `app/templates/kasir/tabs/dashboard.html`.
- [x] **Step 2: Bersihkan `updateStats()` di `app/static/js/kasir/modules/dashboard/index.js`**
  Pastikan `updateStats()` mengecek ketersediaan elemen secara aman (*graceful no-op*).

---

### Task 2: Perbaikan Initial Active State Sidebar Dashboard & Sinkronisasi Navigasi

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html:27-37`
- Modify: `app/static/js/kasir/app.js:1-75`

**Interfaces:**
- Consumes: Navigasi sidebar kasir.
- Produces: Tab Dashboard menyala (`bg-neutral-100 text-[#050505] font-bold`) sejak awal dimuat / login.

- [x] **Step 1: Set class aktif default pada tombol Dashboard di `sidebar.html`**
- [x] **Step 2: Panggil `this.setupNavigation()` dan `this.switchTab('dash')` pada `App.init()` di `app.js`**

---

### Task 3: Perbaikan Perataan Teks & Logo Submenu Kendali Jarak Jauh Server

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html:200-240`

**Interfaces:**
- Consumes: Submenu Kendali Jarak Jauh Server dan submenu lainnya di `sidebar.html`.
- Produces: Kolom teks terpisah dari icon/logo sehingga baris kedua teks tetap rapi ter-indentasi di samping icon.

- [x] **Step 1: Perbaiki tombol `Kendali Jarak Jauh Server` di `sidebar.html`**
  Gunakan container `flex items-start gap-2.5`, pisahkan `<span class="shrink-0 text-sm leading-none mt-0.5">📡</span>` dan `<span class="leading-tight">Kendali Jarak Jauh Server</span>`.
- [x] **Step 2: Standarisasi tombol submenu lainnya agar konsisten**

---

### Task 4: Perbaikan Sinkronisasi Multi-Cabang untuk Monitor Hardware, Statistik Server, Hardware Checker, Pelacak Uptime, Perawatan PC, dan Blackout

**Files:**
- Modify: `app/routes/monitor/monitor_routes.py`
- Modify: `app/static/js/kasir/core/api.js`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js`
- Modify: `app/static/js/kasir/app.js`
- Modify: `app/static/js/kasir/modules/branch/index.js`
- Modify: `app/static/js/kasir/modules/maintenance/index.js`
- Modify: `app/static/js/kasir/modules/laporan_maintenance/index.js`
- Modify: `app/static/js/kasir/modules/blackout/index.js`

**Interfaces:**
- Consumes: `BranchProxyService`, `sessionStorage.getItem('active_branch_id')`, `X-Branch-ID` header.
- Produces: Seluruh modul sistem & utilitas mengambil data dari server cabang remote saat branch aktif berganti.

- [x] **Step 1: Daftarkan endpoint kasir monitor di `app/routes/monitor/monitor_routes.py`**
  Tambahkan route pada `monitor_kasir_bp`:
  - `GET /all` -> `@login_required` memanggil `HardwareService.get_all_with_pc()`.
  - `DELETE /<int:hardware_id>` -> `@login_required @admin_required`.
  - `GET /processes/<int:pc_id>` -> `@login_required`.
  - `POST /processes/<int:pc_id>/kill` -> `@login_required @admin_required`.
- [x] **Step 2: Arahkan `API.monitor` ke `/api/v1/kasir/monitor/` di `app/static/js/kasir/core/api.js`**
  Ubah endpoint `all`, `delete`, dan `processesKill` agar memanggil `/api/v1/kasir/monitor/...` sehingga otomatis di-relay ke cabang remote via `X-Branch-ID`.
- [x] **Step 3: Update `dashboard_process_monitor.js`**
  Ubah panggilan `fetch('/api/v1/public/monitor/processes/...')` menjadi `API.request('/api/v1/kasir/monitor/processes/...')`.
- [x] **Step 4: Tambahkan `server_statistic` pada `App.loadTab` di `app/static/js/kasir/app.js`**
  ```javascript
  case 'server_statistic':
      if (typeof ServerMonitor !== 'undefined') {
          ServerMonitor.fetchMetrics();
          ServerMonitor.checkLHMStatus();
      }
      break;
  ```
- [x] **Step 5: Tambahkan fungsi `resetState()` pada modul `Maintenance`, `LaporanMaintenance`, dan `Blackout`**
  Kosongkan cache internal PC list, tiket, dan report data saat cabang berganti.
- [x] **Step 6: Sempurnakan `BranchManager.refreshAllModulesAfterBranchSwitch()` di `app/static/js/kasir/modules/branch/index.js`**
  Reset dan panggil refresh untuk seluruh modul sistem & utilitas saat berganti cabang.

---

### Task 5: Verifikasi & Uji Menyeluruh

**Files:**
- All modified files

- [x] **Step 1: Uji Pembersihan Dashboard Kasir**
  Buka `/kasir/` -> Pastikan blok statistik sudah bersih dan kartu PC langsung tampil lapang.
- [x] **Step 2: Uji Active State Sidebar Saat Login**
  Muat ulang halaman / login -> Pastikan tab Dashboard langsung menyala putih tebal.
- [x] **Step 3: Uji Teks Kendali Jarak Jauh Server**
  Buka dropdown Sistem & Utilitas -> Pastikan tulisan rapi sejajar di samping icon 📡.
- [x] **Step 4: Uji Multi-Cabang pada Seluruh Modul Sistem & Utilitas**
  1. Pilih Cabang Remote di navbar dropdown.
  2. Buka **Monitor Hardware** -> Pastikan menampilkan data hardware monitor dari cabang remote.
  3. Buka **Hardware Checker** -> Pastikan menampilkan status hardware PC cabang remote.
  4. Buka **Statistik Server** -> Pastikan grafik CPU/RAM/Disk menampilkan resource server cabang remote.
  5. Buka **Pelacak Statistik PC (Uptime)** -> Pastikan data uptime harian PC cabang remote termuat.
  6. Buka **Perawatan PC & Laporan Perawatan** -> Pastikan list PC dan tiket perawatan sesuai cabang remote.
  7. Buka **Pemulihan Mati Lampu (Blackout)** -> Pastikan sesi blackout cabang remote termuat.
  8. Kembalikan ke Cabang Lokal -> Pastikan seluruh data kembali normal menampilkan data cabang lokal.

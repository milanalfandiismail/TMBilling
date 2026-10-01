# Master Plan: Standarisasi Skeleton Loading & Silent Realtime Data Menyeluruh di Seluruh Tab TMBilling (Anti-Flicker & Zero Reload)

> **Untuk agentic workers:** SUB-SKILL WAJIB: Gunakan `superpowers:subagent-driven-development` (direkomendasikan) atau `superpowers:executing-plans` untuk mengeksekusi rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`).

**Goal:** 
1. **Standarisasi Skeleton Loading di SEMUA Tab & Modal (35 Tab/Halaman + Modal)**: Mengganti SEMUA spinner lingkaran (`animate-spin`), teks polos "Memuat...", dan area kosong dengan **Content-Shaped Skeleton Loading** bernuansa dark mode TMBilling (`bg-[#141414] border-[#1c1c1c] animate-pulse`) saat *initial load* atau pergantian filter/kategori.
2. **Realtime Silent Polling di SEMUA Tab Tanpa Flickering**: Mengintegrasikan silent background polling (setiap 1–3 detik) di `app.js` untuk SELURUH tab yang sedang aktif dengan prinsip *Targeted In-Place DOM Mutation* dan *Data-Fingerprint Caching*. Realtime murni memperbarui data nilai (`.textContent` & targeted class) tanpa merusak DOM (`innerHTML`), tanpa skeleton saat polling, dan tanpa mengganggu tombol/input/kursor user (Zero Flickering).
3. **Bugfix Screenshot Image & Status Filter**: Memperbaiki logika boolean negasi terbalik (`const hasImage = Boolean(pc.screenshot_url)`).
4. **Monitoring Proses Realtime Tanpa Flickering**: Background polling berkala saat modal proses PC client terbuka, dengan update diferensial per-baris tanpa memutar tombol "Segarkan" atau skeleton.
5. **Anti-Flicker Modal Detail PC & Tombol**: Mengunci action grid modal detail PC dengan fingerprint state agar tombol tidak dihancurkan ulang setiap detik.

**Architecture:**
1. **Core Skeleton Engine (`app/static/js/kasir/core/skeleton.js`)**: Modul singleton sentral penyedia generator HTML skeleton beranimasi (`animate-pulse`) yang presisi merefleksikan bentuk konten aslinya (PC cards, menu cards, paket cards, table rows, log rows, bracket turnamen, KPI cards, modal loader).
2. **Harmonisasi Siklus Hidup UI (Initial Load vs Realtime Live Polling)**:
   - **Fase Initial Load (Pertama Buka / Ganti Tab / Cache Kosong)**: Tampilkan **Skeleton Loading** yang sesuai bentuk halaman.
   - **Fase Realtime Polling (Background Ticker 1–3 Detik)**: Berjalan dalam mode **Silent** (`isSilent = true`). DILARANG menampilkan skeleton atau memutar spinner tombol.
   - **Data-Fingerprint Caching**: Bandingkan payload data baru dengan snapshot data sebelumnya (`JSON.stringify(data) === this._lastFingerprint`). Jika identik: **LEWATI (0 DOM mutations)**.
   - **Targeted Node Updates**: Jika ada data nilai yang berubah (sisa waktu, status, angka, nama window), perbarui langsung ke node teks target (`.textContent`) atau kelas gayanya (`.classList`).
3. **Pusat Polling `app.js` (`startDashboardPolling`)**:
   - Memastikan SEMUA tab yang sedang aktif menjalankan method `refreshLive()` atau `load(..., isSilent = true)`.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, TailwindCSS, Jinja2 Templates, Flask Backend API, SQLite.

## Global Constraints
- **SUPERPOWERS & MCP WAJIB**: Seluruh pekerjaan dikawal oleh master plan dan MCP `codebase-memory`.
- **ZERO PAGE RELOAD**: Dilarang me-reload browser (`location.reload()`).
- **ZERO BUTTON FLICKERING**: Tombol dan kontrol interaktif tidak boleh berkedip, terputus hover-nya, atau dibongkar ulang jika fungsinya tidak berubah.
- **TARGETED REALTIME UPDATE**: Realtime hanya memperbarui nilai teks data spesifik, dilarang melakukan full re-render kontainer (`innerHTML = ...`) pada polling rutin.
- **100% SKELETON CONSISTENCY**: Seluruh 35 tab dan modal memiliki skeleton yang menyerupai bentuk aslinya saat pertama kali dibuka.
- **HARMONISASI SKELETON**: Skeleton HANYA tampil saat inisialisasi awal (belum ada data) atau pergantian filter besar. Skeleton DILARANG muncul saat polling realtime background.
- **BAHASA INDONESIA**: Seluruh dokumentasi, log, dan komentar berbahasa Indonesia.
- **VERIFIKASI TEST SUITE**: 259 backend test (`pytest`) wajib tetap 100% lulus.

---

## Matriks Audit Lengkap Seluruh 35 Tab/Halaman & Modal TMBilling

| No | Tab / Halaman | Template HTML | File Modul JS | Skeleton Template (Initial Load) | Audit Masalah Saat Ini | Realtime Polling Strategy (Silent & Anti-Flicker) |
|---|---|---|---|---|---|---|
| 1 | **Dashboard PC Grid** | `tabs/dashboard.html` | `modules/dashboard/dashboard_compact.js` | `Skeleton.pcCards(12)` | `#pc-area` kosong awal; polling 1s re-render `innerHTML` total kartu | `syncLiveCards`: Update teks `.pc-card-timer`, `.pc-card-app`, `.pc-card-user` tanpa sentuh DOM kartu |
| 2 | **Monitor Screenshot** | `tabs/screenshot.html` | `modules/screenshot/index.js` | `Skeleton.screenshotCards(8)` | Bug negasi `!pc.screenshot_url` gambar tidak muncul; kosong saat awal | `syncDelta`: Ganti `img.src` HANYA jika timestamp/url berubah; update sisa waktu |
| 3 | **Kantin (Menu / POS)** | `tabs/menu.html` | `modules/menu/index.js` | `Skeleton.menuCards(8)` | Belum ada skeleton awal; polosan saat loading katalog | `refreshLive`: Fingerprint check; jika data katalog sama, batalkan re-render katalog |
| 4 | **Log Stok Menu** | `tabs/menu_stock_log.html` | `modules/menu/stock_log.js` | `Skeleton.tableRows(6, 7)` | Memakai spinner `animate-spin` di tbody | `refreshLive`: Fingerprint check pada riwayat perubahan stok tanpa flicker |
| 5 | **Catatan Kasir** | `tabs/catatan.html` | `modules/catatan/index.js` | `Skeleton.notesList(5)` | Memakai spinner `animate-spin` di notes container | `refreshLive`: Fingerprint check daftar berkas catatan tanpa sentuh list jika sama |
| 6 | **Struk & Transaksi** | `tabs/struk.html` | `modules/struk/index.js` | `Skeleton.strukList(6)` & `Skeleton.strukThermal()` | Memakai spinner `animate-spin` di list history | `refreshLive`: Cek id transaksi terakhir; batalkan innerHTML jika tidak ada transaksi baru |
| 7 | **Turnamen Esports** | `tabs/tournament.html` | `modules/tournament/index.js` | `Skeleton.tournamentCards(6)` & `Skeleton.tournamentBracket()` | Memakai teks polos "Memuat..."; detail kosong | `refreshLive`: Fingerprint check; abaikan polling jika modal skor/lolos sedang aktif |
| 8 | **Log Audit Sistem** | `tabs/log.html` | `modules/log/index.js` | `Skeleton.logRows(8)` | Belum ada skeleton awal; render ulang seluruh baris saat polling | `refreshLive`: Cek timestamp/id log terbaru; jika sama, 0 mutasi DOM |
| 9 | **Hardware Monitor** | `tabs/monitor.html` | `modules/monitor/index.js` | `Skeleton.monitorRows(8)` | Kosong saat initial load; tabel dibongkar ulang | `refreshLive`: Update nilai sensor suhu & bar CPU tanpa membongkar tombol Hapus |
| 10 | **Hardware Checker** | `tabs/hardware_checker.html` | `modules/hardware_checker/index.js` | `Skeleton.tableRows(6, 5)` | Tombol refresh disable sendiri dan berputar tiap detik; spinner | `load(..., isSilent = true)`: Silent polling tanpa mendisable tombol & tanpa memutar icon |
| 11 | **Server Statistic** | `tabs/server_statistic.html` | `modules/server_monitor/server_monitor.js` | `Skeleton.monitorRows(4)` | Kosong saat inisialisasi | Polling silent CPU/RAM/Network metrics langsung ke angka & bar grafik |
| 12 | **Riwayat Shift** | `tabs/shift_history.html` | `modules/shift/index.js` | `Skeleton.tableRows(6, 9)` | Memakai spinner `animate-spin` teks kuning di tabel | `refreshHistoryLive`: Cek id shift terakhir; jangan bongkar tabel jika tidak ada pergantian |
| 13 | **Log Staf (User Logs)** | `tabs/user_logs.html` | `modules/shift/index.js` | `Skeleton.tableRows(6, 5)` | Memakai spinner `animate-spin` cyan di tabel | `refreshUserLogsLive`: Cek baris log baru tanpa menghancurkan tabel yang sedang di-scroll |
| 14 | **Master Member** | `tabs/member.html` | `modules/member/index.js` | `Skeleton.tableRows(8, 6)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Fingerprint check; update data saldo member secara silent tanpa flicker |
| 15 | **Master Paket** | `tabs/paket.html` | `modules/paket/index.js` | `Skeleton.paketCards(6)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Cek perubahan tarif/paket; jika identik, 0 mutasi DOM |
| 16 | **Master Grup PC** | `tabs/grup.html` | `modules/grup/index.js` | `Skeleton.tableRows(5, 4)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Cek perubahan grup PC secara silent tanpa re-render dropdown jika sama |
| 17 | **Master Unit PC** | `tabs/pc.html` | `modules/pc/index.js` | `Skeleton.tableRows(8, 5)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Cek update status PC secara silent |
| 18 | **Master Staf/User** | `tabs/user.html` | `modules/user/index.js` | `Skeleton.tableRows(5, 5)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Cek pembaruan staf kasir secara silent |
| 19 | **PC Uptime Tracker** | `tabs/uptime.html` | `modules/uptime/index.js` | `Skeleton.tableRows(8, 6)` | Memakai spinner `animate-spin` di tbody | `refreshLive`: Update jam uptime/downtime tanpa membongkar tabel |
| 20 | **Blackout Audit** | `tabs/blackout.html` | `modules/blackout/index.js` | `Skeleton.tableRows(6, 6)` | Memakai spinner `animate-spin` di area tabel | `refreshLive`: Cek status blackout recovery secara silent |
| 21 | **Laporan Billing** | `tabs/laporan.html` | `modules/laporan/index.js` | `Skeleton.tableRows(8, 6)` | Memakai spinner `animate-spin` di area laporan | `refreshLive`: Update total omzet & baris transaksi baru secara silent |
| 22 | **Laporan Kantin** | `tabs/laporan_menu.html` | `modules/laporan_menu/index.js` | `Skeleton.tableRows(8, 6)` | Memakai spinner `animate-spin` di area laporan | `refreshLive`: Update omzet makanan/minuman secara silent |
| 23 | **Tiket Maintenance** | `tabs/maintenance.html` | `modules/maintenance/index.js` | `Skeleton.tableRows(6, 5)` | Belum ada skeleton awal; blank saat request | `refreshLive`: Cek tiket baru/status perbaikan tanpa merefresh form |
| 24 | **Laporan Maintenance**| `tabs/laporan_maintenance.html` | `modules/laporan_maintenance/index.js` | `Skeleton.tableRows(6, 5)` | Belum ada skeleton awal | `refreshLive`: Update rekap biaya & status tiket secara silent |
| 25 | **Owner Analytics** | `tabs/analytics.html` | `modules/owner/analytics.js` | `Skeleton.analyticsCards(7)` | Memakai spinner `animate-spin` di `#analytics-loading` | `refreshLive`: Update metrik revenue & okupansi tanpa loncatan visual |
| 26 | **Multi-Cabang Hub** | `tabs/branch.html` | `modules/branch/index.js` | `Skeleton.tableRows(4, 5)` | Belum ada skeleton awal | `refreshLive`: Update status heartbeat cabang online/offline secara silent |
| 27 | **Cabang Inbound** | `tabs/branch_inbound.html` | `modules/branch/index.js` | `Skeleton.tableRows(4, 5)` | Belum ada skeleton awal | `refreshInboundLive`: Cek koneksi relay masuk cabang tanpa flicker |
| 28 | **Cabang Kasir** | `tabs/branch_kasir.html` | `modules/branch/index.js` | `Skeleton.tableRows(4, 5)` | Belum ada skeleton awal | `refreshRemoteOperatorsLive`: Update operator remote secara silent |
| 29 | **File Explorer** | `tabs/fileexplorer.html` | `modules/fileexplorer/index.js` | `Skeleton.tableRows(6, 4)` | Blank saat open directory | `refreshLive`: Polling direktori aktif tanpa me-reset cursor/scroll |
| 30 | **Remote Client (VNC)**| `tabs/remote_server.html` | `modules/remote/vnc_client.js` | `Skeleton.monitorRows(4)` | Placeholder canvas polos | Canvas stream berjalan mulus tanpa reload |
| 31 | **Mikrotik Router** | `tabs/mikrotik.html` | `modules/mikrotik/index.js` | `Skeleton.tableRows(5, 4)` | Blank saat request config | `refreshLive`: Update status interface/koneksi tanpa flicker |
| 32 | **Game Management** | `tabs/game.html` | `modules/game/index.js` | `Skeleton.tableRows(6, 4)` | Kosong saat load games | `refreshLive`: Cek update daftar game secara silent |
| 33 | **Plugins Manager** | `settings/plugins.html` | `modules/settings/plugins.js` | `Skeleton.tableRows(4, 4)` | Blank saat load plugins | `refreshLive`: Silent update status aktif plugin |
| 34 | **Pengaturan/Settings**| `tabs/settings.html` | `modules/settings/index.js` | `Skeleton.tableRows(6, 3)` | Blank saat load config section | `refreshLive`: Update status service/backup silent tanpa mengganggu form input |
| 35 | **Tutorials & Docs** | `templates/kasir/documentation.html` | `modules/tutorials/index.js` | `Skeleton.tableRows(4, 3)` | Blank saat load list | `refreshLive`: Cek daftar artikel panduan |
| 36 | **Modal Detail PC** | `components/modals.html` | `modules/dashboard/dashboard_detail_modal.js` | `Skeleton.tableRows(4, 3)` | Action buttons di-destroy dan re-render tiap detik | Kunci action grid (`_lastActionStateKey`); update langsung ke teks data |
| 37 | **Modal Proses PC** | `components/modals.html` | `modules/dashboard/dashboard_process_monitor.js` | `Skeleton.tableRows(8, 3)` | Re-render skeleton & spinner tombol tiap refresh | Silent polling 2-3 detik; in-place delta update memori tanpa spinner tombol |
| 38 | **Modal Tambah Waktu**| `components/modals.html` | `components/modal-tambah.js` | `Skeleton.modalTambahInfo()` + `Skeleton.modalTambahPaket(4)` | Sebelum diperbaiki sisa waktu 0 menit | Sisa waktu berdetik (*ticking*) live via `syncLive` tanpa reload modal |
| 39 | **Modal Buka Sesi** | `components/modals.html` | `components/modal-buka.js` | `Skeleton.modalTambahPaket(4)` | Blank pilihan paket awal | Skeleton pilihan paket awal saat modal terbuka |

---

## Rincian Tugas Eksekusi

### Task 1: Fondasi Modul Sentral `Skeleton` (`skeleton.js` & `base.html`)
**Files:**
- Create: `app/static/js/kasir/core/skeleton.js`
- Modify: `app/templates/kasir/base.html`

**Deskripsi & Rencana:**
1. Buat generator HTML skeleton komprehensif di `window.Skeleton`:
   - `pcCards(count = 12)`
   - `menuCards(count = 8)`
   - `paketCards(count = 6)`
   - `tournamentCards(count = 6)`
   - `tournamentBracket()`
   - `screenshotCards(count = 8)`
   - `notesList(count = 5)`
   - `strukList(count = 6)`
   - `strukThermal()`
   - `tableRows(rows = 6, cols = 5)`
   - `logRows(count = 8)`
   - `monitorRows(count = 8)`
   - `analyticsCards(count = 7)`
   - `modalTambahInfo()`
   - `modalTambahPaket(count = 4)`
2. Daftarkan `skeleton.js` di `base.html` tepat setelah `utils.js` agar tersedia sebelum semua modul tab dieksekusi.

- [ ] **Step 1: Tulis file `app/static/js/kasir/core/skeleton.js` dengan seluruh template di atas**
- [ ] **Step 2: Daftarkan `skeleton.js` di `app/templates/kasir/base.html`**
- [ ] **Step 3: Uji fungsionalitas generator skeleton di browser console**

---

### Task 2: Perbaikan Bug Gambar Screenshot & Filter Status
**Files:**
- Modify: `app/static/js/kasir/modules/screenshot/index.js`

**Deskripsi & Rencana:**
1. Di baris 268: `const hasImage = !pc.screenshot_url;` diubah menjadi `const hasImage = Boolean(pc.screenshot_url);` agar gambar muncul.
2. Di baris 247-251: Filter `has_screenshot` diubah menjadi `data.filter(pc => Boolean(pc.screenshot_url));`.
3. Pasang `Skeleton.screenshotCards(8)` pada inisialisasi awal `Screenshot.load()` saat data cache masih kosong.
4. Di `syncDelta()`: Hindari refresh `img.src` jika URL dan timestamp gambar tidak berubah, agar gambar tidak berkedip saat polling silent.

- [ ] **Step 1: Perbaiki kondisi `hasImage` dan filter status di `renderGrid()`**
- [ ] **Step 2: Pasang `Skeleton.screenshotCards(8)` pada load awal saat cache kosong**
- [ ] **Step 3: Pastikan `syncDelta()` stabil dan tidak reload gambar jika tidak ada perubahan**

---

### Task 3: Kunci Grid Tombol pada Modal Detail PC (`DashboardDetailModal.syncLive`)
**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`

**Deskripsi & Rencana:**
1. Kunci rekonsiliasi tombol action grid dengan state fingerprint: `const stateKey = `${pc.status}_${isOnline}_${Boolean(sesi)}_${Boolean(isAfk)}_${Boolean(isSystemMode)}_${Boolean(isAdminMode)}`;`.
2. `actionGrid.innerHTML` HANYA di-render jika `this._lastActionStateKey !== stateKey`.
3. Update data sisa waktu, active window, dan preview screenshot dilakukan langsung ke elemen target tanpa menyentuh tombol.

- [ ] **Step 1: Terapkan caching state fingerprint `_lastActionStateKey` pada action grid**
- [ ] **Step 2: Pisahkan update teks data realtime (sisa waktu, active window) dari render tombol**
- [ ] **Step 3: Verifikasi bahwa tombol "Ambil Gambar" stabil 100% tanpa kedipan saat polling**

---

### Task 4: Monitoring Proses Realtime Tanpa Flickering (`DashboardProcessMonitor`)
**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js`

**Deskripsi & Rencana:**
1. Tambahkan background silent polling (setiap 2-3 detik) saat view daftar proses sedang aktif.
2. Terapkan in-place delta update pada baris proses:
   - Bandingkan list proses dengan snapshot sebelumnya.
   - Jika tidak ada perubahan, 0 mutasi DOM.
   - Jika memory/title berubah, perbarui hanya teks kolom memori/judul di baris yang bersangkutan.
3. Tombol "Segarkan" tidak boleh memunculkan spinner dan kontainer tidak boleh menampilkan skeleton saat silent polling berlangsung di latar belakang.
4. Pasang `Skeleton.tableRows(8, 3)` HANYA saat pertama kali tab proses dibuka dan data cache masih kosong.

- [ ] **Step 1: Pasang `Skeleton.tableRows(8, 3)` untuk initial load monitor proses**
- [ ] **Step 2: Tambahkan lifecycle silent polling saat view proses aktif**
- [ ] **Step 3: Implementasikan delta update data baris proses tanpa menyentuh tombol aksi**

---

### Task 5: Pure Targeted Node Update Dashboard Cards & Tombol Hardware Checker
**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js`

**Deskripsi & Rencana:**
1. **Dashboard Cards (Zero Full Re-Render)**:
   - Pasang penanda kelas spesifik pada template kartu PC: `.pc-card-timer`, `.pc-card-app`, `.pc-card-user`, `.pc-card-dot`.
   - Buat method `syncLiveCards(data)`:
     - Cari elemen kartu di DOM: `.pc-card-item[data-pc-id="${pc.id}"]`.
     - Teks timer diperbarui langsung via `timerEl.textContent = timerStr`.
     - Teks active window diperbarui via `appEl.innerHTML = row2Html`.
     - Teks nama member/guest diperbarui via `userEl.textContent = memberName`.
     - Kelas status kartu hanya dimutasi jika status berubah.
   - Saat initial load (sebelum data pertama tiba), render `Skeleton.pcCards(12)` ke `#pc-area`.
2. **Hardware Checker**:
   - Tambahkan parameter `isSilent = false` pada `HardwareChecker.load(isInitial = false, isSilent = false)`.
   - Polling otomatis dari `app.js` menggunakan `isSilent = true` sehingga icon tidak berputar liar dan tombol refresh tidak mendisable sendiri setiap detik.
   - Ganti spinner loading awal dengan `Skeleton.tableRows(6, 5)`.

- [ ] **Step 1: Pasang `Skeleton.pcCards(12)` pada load awal dashboard**
- [ ] **Step 2: Implementasikan `syncLiveCards` (pure targeted text update) di `dashboard_compact.js`**
- [ ] **Step 3: Hentikan kedipan tombol refresh pada `HardwareChecker.load()` dengan flag `isSilent`**
- [ ] **Step 4: Pasang `Skeleton.tableRows(6, 5)` pada initial loading Hardware Checker**

---

### Task 6: Standarisasi Skeleton & Realtime Polling Modul Operasional (Kantin/Menu, Log Stok, Catatan, Struk, Turnamen, Log Audit, Hardware Monitor)
**Files:**
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/static/js/kasir/modules/menu/stock_log.js`
- Modify: `app/static/js/kasir/modules/catatan/index.js`
- Modify: `app/static/js/kasir/modules/struk/index.js`
- Modify: `app/static/js/kasir/modules/tournament/index.js`
- Modify: `app/static/js/kasir/modules/log/index.js`
- Modify: `app/static/js/kasir/modules/monitor/index.js`

**Deskripsi & Rencana:**
1. **Menu / Kantin**:
   - Initial load: tampilkan `Skeleton.menuCards(8)` jika `this.items.length === 0`.
   - `refreshLive()`: bandingkan fingerprint JSON item menu, jika identik batalkan re-render katalog.
2. **Log Stok Menu**:
   - Ganti spinner di `tbody` dengan `Skeleton.tableRows(6, 7)` saat initial fetch.
   - Tambahkan `refreshLive()` dengan fingerprint checking agar silent update berjalan saat tab dibuka.
3. **Catatan Kasir**:
   - Ganti spinner dengan `Skeleton.notesList(5)` saat load awal.
   - `refreshLive()`: pertahankan state editor kursor jika catatan sedang diedit (`isDirty`), sinkronisasi list silent.
4. **Struk & Transaksi**:
   - Ganti spinner riwayat dengan `Skeleton.strukList(6)`.
   - `refreshLive()`: bandingkan no_nota transaksi terakhir, jika sama lewati re-render.
5. **Turnamen Esports**:
   - Ganti teks polos dengan `Skeleton.tournamentCards(6)` di list view, dan `Skeleton.tournamentBracket()` di detail view.
   - `refreshLive()`: polling otomatis bracket/pertandingan jika tidak sedang buka modal skor.
6. **Log Audit**:
   - Pasang `Skeleton.logRows(8)` saat initial load.
   - `refreshLive()`: cek timestamp log terbaru, lewati jika tidak ada log baru.
7. **Hardware Monitor**:
   - Pasang `Skeleton.monitorRows(8)` saat initial load.
   - `refreshLive()`: in-place update nilai sensor suhu & CPU bar tanpa membongkar tombol hapus.

- [ ] **Step 1: Pasang Skeleton & Silent Polling di `Menu` dan `MenuStockLog`**
- [ ] **Step 2: Pasang Skeleton & Silent Polling di `Catatan` dan `Struk`**
- [ ] **Step 3: Pasang Skeleton & Silent Polling di `Tournament` (Cards & Bracket)**
- [ ] **Step 4: Pasang Skeleton & Silent Polling di `Log` dan `Monitor`**

---

### Task 7: Standarisasi Skeleton & Realtime Polling Modul Administrasi & Shift (Shift History, User Logs, Master Member, Master Paket, Master Grup, Master PC, Master User/Staff)
**Files:**
- Modify: `app/static/js/kasir/modules/shift/index.js`
- Modify: `app/static/js/kasir/modules/member/index.js`
- Modify: `app/static/js/kasir/modules/paket/index.js`
- Modify: `app/static/js/kasir/modules/grup/index.js`
- Modify: `app/static/js/kasir/modules/pc/index.js`
- Modify: `app/static/js/kasir/modules/user/index.js`

**Deskripsi & Rencana:**
1. **Shift History & User Logs**:
   - Ganti spinner kuning di `Shift.loadHistory` dengan `Skeleton.tableRows(6, 9)`.
   - Ganti spinner cyan di `Shift.loadUserLogs` dengan `Skeleton.tableRows(6, 5)`.
   - Buat method `refreshHistoryLive()` di `Shift` untuk silent polling riwayat shift.
2. **Master Member**:
   - Ganti spinner di `Member.load` dengan `Skeleton.tableRows(8, 6)`.
   - Buat method `refreshLive()` dengan fingerprint caching (saldo member update otomatis tanpa re-render dropdown filter).
3. **Master Paket**:
   - Ganti spinner di `Paket.load` dengan `Skeleton.paketCards(6)`.
   - Buat method `refreshLive()` dengan fingerprint caching.
4. **Master Grup**:
   - Ganti spinner di `Grup.load` dengan `Skeleton.tableRows(5, 4)`.
   - Buat method `refreshLive()`.
5. **Master PC**:
   - Ganti spinner di `PC.load` dengan `Skeleton.tableRows(8, 5)`.
   - Buat method `refreshLive()`.
6. **Master User/Staff**:
   - Ganti spinner di `User.load` dengan `Skeleton.tableRows(5, 5)`.
   - Buat method `refreshLive()`.

- [ ] **Step 1: Pasang Skeleton & Silent Polling pada `Shift.loadHistory` dan `Shift.loadUserLogs`**
- [ ] **Step 2: Pasang Skeleton & Silent Polling pada `Member` dan `Paket`**
- [ ] **Step 3: Pasang Skeleton & Silent Polling pada `Grup`, `PC`, dan `User`**

---

### Task 8: Standarisasi Skeleton & Realtime Polling Modul Analitik, Pelaporan & Keandalan (Uptime, Blackout, Laporan Billing, Laporan Kantin, Tiket Maintenance, Laporan Maintenance, Owner Analytics)
**Files:**
- Modify: `app/static/js/kasir/modules/uptime/index.js`
- Modify: `app/static/js/kasir/modules/blackout/index.js`
- Modify: `app/static/js/kasir/modules/laporan/index.js`
- Modify: `app/static/js/kasir/modules/laporan_menu/index.js`
- Modify: `app/static/js/kasir/modules/maintenance/index.js`
- Modify: `app/static/js/kasir/modules/laporan_maintenance/index.js`
- Modify: `app/static/js/kasir/modules/owner/analytics.js`
- Modify: `app/templates/kasir/tabs/analytics.html`

**Deskripsi & Rencana:**
1. **Uptime Tracker**:
   - Ganti spinner tbody dengan `Skeleton.tableRows(8, 6)`.
   - Buat method `refreshLive()`.
2. **Blackout Audit**:
   - Ganti spinner di `Blackout.loadList` dengan `Skeleton.tableRows(6, 6)`.
   - Buat method `refreshLive()`.
3. **Laporan Billing & Laporan Kantin**:
   - Ganti spinner di `Laporan.loadByDate` dan `LaporanMenu.fetchData` dengan `Skeleton.tableRows(8, 6)`.
   - Buat method `refreshLive()`.
4. **Maintenance & Laporan Maintenance**:
   - Pasang `Skeleton.tableRows(6, 5)` pada load awal saat data kosong.
   - Buat method `refreshLive()`.
5. **Owner Analytics**:
   - Di `tabs/analytics.html`, ganti `#analytics-loading` dari spinner menjadi 7-card grid skeleton: `Skeleton.analyticsCards(7)`.
   - Di `OwnerAnalytics.load`, tambahkan silent mode (`isSilent = true`) agar saat polling otomatis tidak toggle `.hidden` pada card container.

- [ ] **Step 1: Pasang Skeleton & Silent Polling pada `UptimeTracker` dan `Blackout`**
- [ ] **Step 2: Pasang Skeleton & Silent Polling pada `Laporan` dan `LaporanMenu`**
- [ ] **Step 3: Pasang Skeleton & Silent Polling pada `Maintenance` dan `LaporanMaintenance`**
- [ ] **Step 4: Pasang Skeleton & Silent Polling pada `OwnerAnalytics` dan `tabs/analytics.html`**

---

### Task 9: Standarisasi Skeleton & Realtime Polling Modul Jaringan, Integrasi & Sistem (Multi-Cabang Hub/Inbound/Kasir, MikroTik, Kelola Game, File Explorer, Settings & Subtabs, Plugins, Tutorials, Modals)
**Files:**
- Modify: `app/static/js/kasir/modules/branch/index.js`
- Modify: `app/static/js/kasir/modules/mikrotik/index.js`
- Modify: `app/static/js/kasir/modules/game/index.js`
- Modify: `app/static/js/kasir/modules/fileexplorer/index.js`
- Modify: `app/static/js/kasir/modules/settings/index.js`
- Modify: `app/static/js/kasir/modules/settings/plugins.js`
- Modify: `app/static/js/kasir/modules/tutorials/index.js`
- Modify: `app/static/js/kasir/components/modal-buka.js`

**Deskripsi & Rencana:**
1. **Multi-Cabang (Hub, Inbound, Kasir Remote)**:
   - Pasang `Skeleton.tableRows(4, 5)` untuk load awal tabel cabang dan operator remote.
   - Terapkan `refreshLive()`, `refreshInboundLive()`, `refreshRemoteOperatorsLive()`.
2. **MikroTik Router**:
   - Pasang `Skeleton.tableRows(5, 4)` saat inisialisasi.
   - Terapkan `refreshLive()`.
3. **Kelola Game & Aplikasi**:
   - Pasang `Skeleton.tableRows(6, 4)` saat `fetchGames` pertama kali.
   - Terapkan `refreshLive()`.
4. **File Explorer**:
   - Pasang `Skeleton.tableRows(6, 4)` saat open directory pertama kali.
5. **Settings & Plugins & Tutorials**:
   - Pasang skeleton section saat initial load form setting dan plugin list.
   - Pasang `refreshLive()` silent.
6. **Modal Buka Sesi**:
   - Pasang `Skeleton.modalTambahPaket(4)` saat memuat daftar paket awal.

- [ ] **Step 1: Pasang Skeleton & Silent Polling pada `BranchManager` (Cabang, Inbound, Kasir)**
- [ ] **Step 2: Pasang Skeleton & Silent Polling pada `MikrotikModule` dan `GameManagement`**
- [ ] **Step 3: Pasang Skeleton & Silent Polling pada `FileExplorer`, `Settings`, `PluginsModule`, `Tutorials`**
- [ ] **Step 4: Pasang Skeleton pada `modal-buka.js`**

---

### Task 10: Integrasi Polling Universal di `app.js` & Sinkronisasi Seluruh Tab
**Files:**
- Modify: `app/static/js/kasir/app.js`

**Deskripsi & Rencana:**
1. Perluas `startDashboardPolling()` pada `app.js` agar mencakup seluruh 35 tab secara teratur dan silent:
   - Dashboard: `Dashboard.load()` -> `syncLiveCards`
   - PC: `PC.refreshLive()`
   - Paket: `Paket.refreshLive()`
   - Member: `Member.refreshLive()`
   - Grup: `Grup.refreshLive()`
   - User: `User.refreshLive()`
   - Game: `GameManagement.refreshLive()`
   - Laporan Billing: `Laporan.refreshLive()`
   - Laporan Kantin: `LaporanMenu.refreshLive()`
   - Kantin/Menu: `Menu.refreshLive()`
   - Log Stok Menu: `MenuStockLog.refreshLive()`
   - Struk: `Struk.refreshLive()`
   - Catatan: `Catatan.refreshLive()`
   - Turnamen: `Tournament.refreshLive()`
   - Log Sistem: `Log.refreshLive()`
   - Log Staff: `Shift.refreshUserLogsLive()`
   - Riwayat Shift: `Shift.refreshHistoryLive()`
   - Hardware Monitor: `Monitor.load(true)`
   - Hardware Checker: `HardwareChecker.load(false, true)`
   - Server Monitor: `ServerMonitor.fetchMetrics()`
   - Screenshot: `Screenshot.refreshLive()`
   - Perawatan PC: `Maintenance.refreshLive()`
   - Laporan Perawatan: `LaporanMaintenance.refreshLive()`
   - Uptime: `UptimeTracker.refreshLive()`
   - Blackout: `Blackout.refreshLive()`
   - Owner Analytics: `OwnerAnalytics.refreshLive()`
   - Multi-Cabang: `BranchManager.refreshLive()`, `refreshInboundLive()`, `refreshRemoteOperatorsLive()`
   - MikroTik: `MikrotikModule.refreshLive()`
   - File Explorer: `FileExplorer.refreshLive()`
   - Settings: `Settings.refreshLive()`
   - Plugins: `PluginsModule.refreshLive()`
   - Tutorials: `Tutorials.refreshLive()`
2. Pastikan tidak ada tab yang tertinggal dalam lifecycle polling background kasir.

- [ ] **Step 1: Perluas switch statement `this.currentTab` di `startDashboardPolling` pada `app.js`**
- [ ] **Step 2: Pastikan modal sync (`DashboardDetailModal.syncLive` & `TambahModal.syncLive`) tetap berjalan lancar**
- [ ] **Step 3: Uji pergantian tab dan verifikasi polling berjalan silent tanpa interupsi UI**

---

### Task 11: Verifikasi Menyeluruh, Build CSS & Automated Testing
**Files:**
- Test: `tests/`
- Build: `app/static/css/tailwind.css`

**Deskripsi & Rencana:**
1. Jalankan `npm run build:css` untuk memastikan seluruh utility class skeleton terkompilasi rapi.
2. Jalankan unit & integration test suite backend `.venv\Scripts\python -m pytest` (harus 259 passed).
3. Verifikasi menyeluruh:
   - Initial loading di setiap 35 tab menampilkan skeleton yang serasi dengan dark mode.
   - Live background polling di setiap tab tidak menampilkan skeleton dan tidak membongkar tombol (zero flicker).
   - Gambar thumbnail screenshot muncul dan filter berfungsi akurat.
   - Tombol "Ambil Gambar" di modal PC stabil 100%.
   - Monitor proses mengalirkan data realtime secara silent.
4. Re-index repository pada MCP `codebase-memory`.

- [ ] **Step 1: Jalankan build Tailwind CSS (`npm run build:css`)**
- [ ] **Step 2: Jalankan pytest test suite backend (target: 259 passed)**
- [ ] **Step 3: Re-index codebase memory via `index_repository`**

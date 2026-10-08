# Hardware Checker Modal, Grouping by ID, and Global Refresh Cleanup Design

**Tanggal:** 2026-10-08  
**Sprint:** `v1.6.4`  
**Status:** Approved by User  

---

## 1. Context & Objectives

1. **Detail Modal in Hardware Checker**:
   - Sebelumnya, menekan tombol "Detail" membuka kartu accordion ke bawah (inline) yang membuat kartu meregang secara vertikal, merusak susunan grid 2x2 yang kompak, dan memotong beberapa serial number atau GPU PNP ID dengan ellipsis (`truncate`).
   - Teks tombol juga berubah bolak-balik antara "Detail" dan "Spesifikasi Lengkap".
   - Tujuan: Ganti accordion inline dengan dedicated popup modal menggunakan engine `Modal.show()`. Kartu PC di grid tetap berdimensi kompak (~160px), dan modal menampilkan perbandingan lengkap Baseline Resmi vs Live Telemetry tanpa potongan teks (*no truncation*) pada semua breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`).

2. **Group Filter & Grouping by ID in Hardware Checker**:
   - Hardware Checker perlu dilengkapi dropdown filter per grup (`Semua Grup`, `REGULER`, `VIP`, `VVIP`, dst.).
   - Opsi dropdown dan seksi visual diurutkan berdasarkan `grup_id` ascending (urutan pembuatan database ID 1, 2, 3...), bukan alfabetis.
   - Ketika filter adalah "Semua Grup", kartu PC dikelompokkan dalam seksi visual berlabel header grup (`[ NAMA GRUP • X UNIT ]`), dengan masing-masing seksi memiliki grid 2-kolom kompak.

3. **Eliminasi Tombol Refresh Manual & Sinkronisasi Global Polling**:
   - Seluruh modul kasir di-polling secara otomatis dan senyap (*silent background heartbeat*) oleh `app.js` (`App.startDashboardPolling()`) dengan frekuensi yang disesuaikan pengaturan dashboard (`Dashboard.getRefreshInterval()`: 1s, 2s, 3s, 5s).
   - Hapus tombol manual refresh usang dari 9 tab:
     - `hardware_checker.html` (Refresh Status)
     - `monitor.html` (↻ Refresh)
     - `screenshot.html` (↻ Refresh)
     - `blackout.html` (↻ Refresh)
     - `maintenance.html` (Refresh)
     - `laporan_maintenance.html` (Refresh)
     - `menu_stock_log.html` (Refresh)
     - `shift_history.html` (Refresh)
     - `user_logs.html` (Refresh)
   - Standardisasi `refreshLive()` pada modul JavaScript terkait.

---

## 2. Technical Architecture & UI Components

### 2.1 Hardware Checker Modal (`HardwareChecker.showDetailModal(pcId)`)
- Dipicu ketika pengguna menekan tombol `🔍 Detail` pada kartu PC.
- Mengambil data PC dari cache memory `HardwareChecker._cachedData`.
- Menggunakan `Modal.show(modalHtml, null, { disableBackdropClose: false })`.
- **Struktur Modal**:
  - **Header**: Kode PC (mono bold), Badge Grup, Status Keamanan (`🛡️ Aman` / `🚨 Ditukar` / `⚙️ Pending`), tombol Close (X).
  - **Body (Scrollable `max-h-[75vh]`):**
    - Alert Banner CCTV (jika ada mismatch) dengan deskripsi selengkapnya tanpa truncate dan rentang estimasi CCTV.
    - Grid 2-Kolom (Stacked pada `sm`, Berdampingan pada `md..2xl`):
      - **Kolom Kiri: 🔒 Baseline Resmi (Terkunci)**:
        - Mobo Model & Mobo Serial
        - CPU Model & CPU ID
        - GPU Model & GPU PNP ID (full block, selectable)
        - RAM Serials (pill badge ungu)
        - Disk Serials (pill badge cyan)
      - **Kolom Kanan: 🔍 Live Telemetry (Terdeteksi Saat Ini)**:
        - Mobo Model & Mobo Serial
        - CPU Model & CPU ID
        - GPU Model & GPU PNP ID (full block, selectable)
        - RAM Serials (pill badge ungu atau merah berkedip jika tertukar)
        - Disk Serials (pill badge cyan atau merah berkedip jika tertukar)
  - **Footer**:
    - Kiri: Waktu Verifikasi Terakhir & Status Kecepatan LAN (`NIC: 1 Gbps` hijau).
    - Kanan: Tombol `🔄 Update Baseline` (dengan class proteksi `.remote-hide-action`) dan tombol `Tutup` (`Modal.closeModal()`).

### 2.2 Group Filter & Sectional Grouping
- Di template `hardware_checker.html`:
  - Di baris header, tambahkan `<select id="hc-group-filter" onchange="HardwareChecker.onGroupFilterChange(this.value)">`.
- Di `hardware_checker/index.js`:
  - `populateGroupFilter(groups, data)` mengisi opsi terurut berdasarkan ID grup (`grup_id`).
  - `onGroupFilterChange(val)` mengupdate state `this.filterGroup = val` dan memanggil `this.renderCards()`.
  - Jika `filterGroup === 'all'`:
    - Mengelompokkan PC ke dalam dictionary/Map berdasarkan `pc_grup_id` dan `pc_grup_nama`.
    - Mengurutkan grup berdasarkan `grup_id` ascending.
    - Menampilkan header seksi grup dan grid 2-kolom di setiap seksi.
  - Jika `filterGroup !== 'all'`:
    - Menampilkan langsung kartu PC grup terpilih dalam 1 grid 2-kolom.

### 2.3 Global Polling Synchronization & Cleanups
- Menghapus tombol refresh manual dari 9 template:
  - `hardware_checker.html`
  - `monitor.html`
  - `screenshot.html`
  - `blackout.html`
  - `maintenance.html`
  - `laporan_maintenance.html`
  - `menu_stock_log.html`
  - `shift_history.html`
  - `user_logs.html`
- Memastikan method `refreshLive()` pada setiap modul JS berjalan lancar tanpa efek samping flicker saat dipanggil oleh `app.js`.

---

## 3. Verification & Testing Strategy

1. **Unit & Integration Tests**:
   - Jalankan `python -m pytest tests/` untuk memastikan seluruh 271 test eksisting tetap lulus 100%.
   - Tambahkan test untuk memverifikasi ketiadaan tombol refresh usang di template yang telah dimodifikasi.
2. **CSS Build**:
   - Jalankan `npm run build:css` untuk memastikan tidak ada class baru yang belum terkompilasi.

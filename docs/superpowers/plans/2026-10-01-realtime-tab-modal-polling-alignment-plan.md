# Sistem Realtime Konstan Frontend & In-Place Modal Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun sistem sinkronisasi realtime frontend terpusat pada aplikasi kasir TMBilling dengan interval konstan yang terhubung dengan pengaturan Dashboard, mengaktifkan live in-place update pada modal (detail PC & tambah waktu) tanpa harus keluar dari modal, serta mengimplementasikan pembaruan diferensial (delta-check) khusus data gambar screenshot agar tidak berkedip atau reload halaman.

**Architecture:**
1. **Unified Polling Engine (`App.startDashboardPolling`)**: Menggunakan nilai interval dinamis dari `Dashboard.getRefreshInterval()` (1s, 2s, 3s, 5s) sebagai heartbeat konstan tunggal untuk menyinkronkan tab yang sedang aktif (`currentTab`) dan modal yang sedang terbuka.
2. **Modal Live-Observer (`DashboardDetailModal.syncLive` & `TambahModal.syncLive`)**: Saat modal detail PC atau tambah waktu terbuka, data sesi, sisa waktu, status AFK, status PC online/offline, dan ketersediaan tombol aksi disinkronkan secara in-place ke dalam DOM modal tanpa menutup modal atau mengganggu input/remote view.
3. **Smart In-Place Screenshot Refresher (`Screenshot.refreshLive`)**: Menghilangkan `innerHTML` re-render dan query parameter bypass berulang; hanya memperbarui elemen `img.src` dan timestamp jika URL atau waktu screenshot PC mengalami perubahan.
4. **State-Preserving Tab Auto-Refreshers**: Menambahkan handler `refreshLive()` pada tab `tournament`, `menu`, `catatan`, `struk`, `log`, `monitor`, dan `branch` yang mempertahankan state input, keranjang belanja, editor, dan preview yang sedang aktif.

**Tech Stack:** Vanilla JavaScript (ES6+), TailwindCSS, Jinja2, HTML5 DOM API.

## Global Constraints & Prinsip Mutlak: ZERO PAGE RELOAD
- **DILARANG KERAS RELOAD WEB**: Tidak boleh ada pemanggilan `window.location.reload()`, `location.href = location.href`, atau tindakan apapun yang memicu browser reload/refresh halaman penuh!
- **Pure In-Place Asynchronous Updates (AJAX/Fetch)**: Seluruh pembaruan data dilakukan di latar belakang secara asinkron via `API.request()` dan dimutasikan langsung ke elemen DOM yang bersangkutan (in-place mutation) tanpa flicker dan tanpa reset posisi scroll.
- **State & Input Preservation**: Pembaruan background tidak boleh mereset state interaktif yang sedang digunakan user (misalnya keranjang POS `this.cart`, editor teks catatan yang sedang diketik, dropdown yang sedang dibuka, sesi remote VNC yang sedang streaming, atau modal dialog yang sedang aktif).
- **Differential/Delta Image Update**: Pada screenshot, hanya elemen `<img>` yang memiliki timestamp/data baru yang diperbarui sumbernya, sehingga kartu PC lain tidak berkedip dan tidak mendownload ulang aset yang sama.
- Menjaga kompatibilitas penuh dengan interval yang dipilih dari modal pengaturan Dashboard (`1s`, `2s`, `3s`, `5s`).
- Menjalankan pengujian otomatis pytest dan build CSS setelah implementasi selesai.

---

### Task 1: Unified Heartbeat Polling Engine pada `App` (app.js)

**Files:**
- Modify: `app/static/js/kasir/app.js`

- [x] **Step 1: Audit dan refaktor `startDashboardPolling` di `app.js`**
  - Jadikan `startDashboardPolling` sebagai engine polling konstan utama yang membaca `Dashboard.getRefreshInterval()`.
  - Pada setiap tick interval:
    - Selalu sinkronkan `Shift.load(false)`.
    - Cek apakah `#pc-detail-modal-card` atau modal detail PC sedang aktif. Jika ya, trigger `DashboardDetailModal.syncLive()`.
    - Cek apakah `#modal-tambah-container` atau modal tambah waktu sedang aktif. Jika ya, trigger `TambahModal.syncLive()`.
    - Jalankan poller khusus tab yang sedang aktif (`this.currentTab`):
      - `dash`: `Dashboard.load()`
      - `tournament`: jika `typeof Tournament !== 'undefined'`, jalankan `Tournament.refreshLive()`
      - `menu`: jika `typeof Menu !== 'undefined'`, jalankan `Menu.refreshLive()`
      - `catatan`: jika `typeof Catatan !== 'undefined'`, jalankan `Catatan.refreshLive()`
      - `struk`: jika `typeof Struk !== 'undefined'`, jalankan `Struk.refreshLive()`
      - `screenshot`: jika `typeof Screenshot !== 'undefined'`, jalankan `Screenshot.refreshLive()`
      - `log`: jika `typeof Log !== 'undefined'`, jalankan `Log.refreshLive()`
      - `monitor`: `Monitor.load()`
      - `branch`: jika `typeof BranchManager !== 'undefined'`, jalankan `BranchManager.refreshLive()`

---

### Task 2: Live In-Place Refresher pada Modal Detail PC (`DashboardDetailModal`)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`
- Modify: `app/static/js/kasir/modules/dashboard/index.js`

- [x] **Step 1: Buat method `syncLive(pcData)` pada `DashboardDetailModal`**
  - Tangkap PC aktif berdasarkan `this.currentPcId`.
  - Perbarui badge status (Online / Offline / AFK / Admin / System) secara in-place.
  - Perbarui tombol aksi kontrol PC (aktifkan / nonaktifkan tombol AFK / Pindah PC / WOL sesuai status terbaru).
  - Jika ada pembaruan screenshot time atau screenshot url pada PC tersebut, perbarui `screenshot-img` dan `screenshot-time` tanpa berkedip.
- [x] **Step 2: Panggil `syncLive` dari `Dashboard._render` dan `Dashboard.load`**
  - Pastikan setiap data PC baru yang tiba dari server langsung dialirkan ke modal detail PC yang sedang terbuka tanpa mengharuskan kasir menutup modal.

---

### Task 3: Live Ticking Sisa Waktu pada Modal Tambah Waktu (`TambahModal`)

**Files:**
- Modify: `app/static/js/kasir/components/modal-tambah.js`

- [x] **Step 1: Implementasikan `syncLive()` pada `TambahModal`**
  - Jika modal tambah waktu sedang terbuka, secara berkala sinkronkan sisa waktu PC target yang ditampilkan pada kartu info sesi.
  - Jika sesi di PC tersebut ditutup atau selesai saat modal terbuka, tampilkan indikator bahwa sesi telah berakhir.

---

### Task 4: Deteksi Perubahan Data Gambar Screenshot Anti-Flicker (`Screenshot`)

**Files:**
- Modify: `app/static/js/kasir/modules/screenshot/index.js`

- [x] **Step 1: Implementasikan `Screenshot.refreshLive()` dengan delta-checking**
  - Ganti polling 30/60 detik statis dengan `refreshLive()` yang dipanggil oleh siklus konstan `App`.
  - Buat pembanding per-PC: bandingkan `screenshot_url` dan `screenshot_time` dengan data sebelumnya.
  - Jika tidak ada data gambar baru pada sebuah PC, biarkan DOM elemen kartu dan elemen `<img src>` tetap utuh tanpa me-reload.
  - Jika ada data gambar baru pada PC tertentu, mutasikan atribut `src` dengan timestamp baru dan perbarui teks waktu pengambilannya saja.
  - Jika ada unit PC baru yang aktif atau offline, perbarui kartu tersebut secara targeted.

---

### Task 5: State-Preserving Auto-Refresh pada Tab Operasional

**Files:**
- Modify: `app/static/js/kasir/modules/tournament/index.js`
- Modify: `app/static/js/kasir/modules/menu/index.js`
- Modify: `app/static/js/kasir/modules/catatan/index.js`
- Modify: `app/static/js/kasir/modules/struk/index.js`

- [x] **Step 1: `Tournament.refreshLive()`**
  - Jika modal input skor sedang terbuka, tunda auto-refresh.
  - Jika sedang di Detail View turnamen, refresh data match/bracket secara in-place tanpa me-reset tab stage atau kembali ke List View.
  - Jika di List View, update status/skor kartu turnamen.
- [x] **Step 2: `Menu.refreshLive()` (Kantin)**
  - Refresh data stok menu di background; perbarui angka stok dan status badge pada kartu katalog tanpa mereset keranjang belanja (`this.cart`) kasir.
- [x] **Step 3: `Catatan.refreshLive()`**
  - Jika editor catatan sedang dalam kondisi diubah (`this.isDirty === true`), jangan sentuh isi editor; hanya perbarui daftar berkas catatan di panel kiri.
- [x] **Step 4: `Struk.refreshLive()`**
  - Perbarui daftar riwayat transaksi di panel kiri; masukkan transaksi baru secara silent tanpa mereset preview struk yang sedang dilihat kasir.

---

### Task 6: Verifikasi, Build CSS & Automated Testing

**Files:**
- Output: `app/static/css/tailwind.css`

- [x] **Step 1: Kompilasi Tailwind CSS**
  - Jalankan `npm run build:css`.
- [x] **Step 2: Jalankan Automated Test Suite Pytest**
  - Jalankan `.venv\Scripts\python -m pytest` dan pastikan seluruh test suite tetap 100% passing (259 passed).
- [x] **Step 3: Sinkronisasi MCP Codebase Memory**
  - Jalankan `index_repository` dan validasi graph memory.

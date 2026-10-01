# Rencana Implementasi: Modal Pengaturan Dashboard Kasir (LAN Drop & Polling) & Penghapusan Animasi Shaking Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol & modal Pengaturan Dashboard di kasir web (opsi toggle deteksi LAN drop < 1 Gbps untuk keamanan pemakai kabel Cat 5 serta pilihan interval polling 1s/2s/3s/5s dengan default 1 detik), serta menghapus animasi shaking (getaran visual) pada aplikasi client TMBillingTauri saat terjadi kesalahan login/PIN.

**Architecture:**
1. **Kasir Web Frontend**:
   - Tombol icon Gear (⚙️) di header dashboard tab (`dashboard.html`).
   - Modal `#modal-dashboard-settings` di `modals.html` yang memuat opsi toggle Deteksi LAN Speed Drop dan pilihan Interval Polling.
   - Modul `Dashboard` (`index.js`) & `dashboard_compact.js` yang membaca/menyimpan preferensi ke `localStorage` (`dashboard_nic_drop_detection` dan `dashboard_refresh_interval`) serta merender ulang kartu PC seketika.
   - Polling dinamis di `app.js` yang merespon perubahan interval secara live.
2. **TMBillingTauri Client**:
   - Pembersihan class `.shake` dan `@keyframes shake` di `input.css`.
   - Pembersihan method `shakeLogin()` dan `.classList.add('shake')` di `ui.js` & `kiosk.js`.

**Tech Stack:** Python Flask (Waitress), Vanilla JavaScript, Tailwind CSS, Tauri v1.5 (Rust).

---

## Global Constraints

- **Penyimpanan Preferensi**: Menggunakan `localStorage` browser agar konfigurasi kasir instan, persisten, dan tanpa overhead database.
- **Dilarang Melakukan Git Commit Tanpa Izin Eksplisit User**: Menunggu konfirmasi user sebelum melakukan commit.
- **WAJIB Menggunakan MCP Codebase-Memory**: Untuk validasi kode dan pelacakan symbol.
- **Bahasa Indonesia**: Komunikasi dan dokumentasi dalam Bahasa Indonesia.

---

### Task 1: Modal Pengaturan Dashboard Kasir (Toggle LAN Drop & Interval Polling)

**Files:**
- Modify: `app/templates/kasir/tabs/dashboard.html`
- Modify: `app/templates/kasir/components/modals.html`
- Modify: `app/static/js/kasir/modules/dashboard/index.js`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`
- Modify: `app/static/js/kasir/app.js`

**Interfaces:**
- Produces:
  - `Dashboard.showSettingsModal()`: Membuka modal pengaturan dashboard dan menyinkronkan UI toggle & radio interval.
  - `Dashboard.closeSettingsModal()`: Menutup modal pengaturan dashboard.
  - `Dashboard.toggleNicDropDetection(checked)`: Mengubah preferensi `dashboard_nic_drop_detection` dan merender ulang grid PC.
  - `Dashboard.setPollingInterval(ms)`: Mengubah preferensi `dashboard_refresh_interval` dan menyetel ulang timer interval di `App`.
  - `Dashboard.getRefreshInterval()`: Mengambil interval polling saat ini (default: 1000 ms).
  - `DashboardCompact.isNicSpeedDrop(speed)`: Mengecek apakah fitur deteksi aktif sebelum mengevaluasi kecepatan LAN.

- [x] **Step 1: Tambahkan tombol Gear icon di header `dashboard.html`**

Di [`app/templates/kasir/tabs/dashboard.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/dashboard.html), tambahkan tombol icon settings di baris kontrol:
```html
<button onclick="Dashboard.showSettingsModal()"
    class="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] hover:border-neutral-500 text-neutral-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
    title="Pengaturan Dashboard">
    <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
    </svg>
</button>
```

- [x] **Step 2: Tambahkan modal `#modal-dashboard-settings` di `modals.html`**

Di [`app/templates/kasir/components/modals.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/modals.html), tambahkan modal:
- Toggle switch deteksi LAN drop < 1 Gbps.
- Pilihan radio/dropdown interval refresh polling: 1 Detik (Real-time), 2 Detik, 3 Detik, 5 Detik.

- [x] **Step 3: Implementasikan fungsi kontrol modal di `index.js`**

Di [`app/static/js/kasir/modules/dashboard/index.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/index.js), tambahkan:
- `showSettingsModal()`
- `closeSettingsModal()`
- `toggleNicDropDetection(enabled)`
- `setPollingInterval(intervalMs)`
- `getRefreshInterval()`

- [x] **Step 4: Update fungsi `isNicSpeedDrop()` di `dashboard_compact.js`**

Di [`app/static/js/kasir/modules/dashboard/dashboard_compact.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_compact.js):
Tambahkan pengecekan awal `localStorage.getItem('dashboard_nic_drop_detection') !== 'false'`.

- [x] **Step 5: Sesuaikan interval polling dinamis di `app.js`**

Di [`app/static/js/kasir/app.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/app.js):
Ubah interval dashboard agar menggunakan interval dinamis dari `Dashboard.getRefreshInterval()` dan mendukung perubahan live via event/method `App.restartDashboardPolling()`.

---

### Task 2: Penghapusan Animasi Shaking di TMBillingTauri Client

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src/css/input.css`
- Modify: `WarnetAgent/TMBillingTauri/src/shared/ui.js`
- Modify: `WarnetAgent/TMBillingTauri/src/kiosk/kiosk.js`
- Rebuild: `WarnetAgent/TMBillingTauri/package.json` (`npm run build:css`)

**Interfaces:**
- Produces: Error feedback yang bersih dan stabil tanpa animasi getar fisik (`.shake`).

- [x] **Step 1: Hapus keyframe dan utility `.shake` di `input.css`**

Di [`WarnetAgent/TMBillingTauri/src/css/input.css`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/TMBillingTauri/src/css/input.css):
Hapus `.shake` dan `@keyframes shake`.

- [x] **Step 2: Hapus animasi shake di `ui.js`**

Di [`WarnetAgent/TMBillingTauri/src/shared/ui.js`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/TMBillingTauri/src/shared/ui.js):
- Bersihkan `modalBox.classList.add('shake')` di `showAdminError`, `showAfkPinError`, `showAfkUnlockError`.
- Hapus/noop `shakeLogin()`.

- [x] **Step 3: Bersihkan pemanggilan `shakeLogin()` di `kiosk.js`**

Di [`WarnetAgent/TMBillingTauri/src/kiosk/kiosk.js`](file:///c:/Project%20GIT/TMBilling/WarnetAgent/TMBillingTauri/src/kiosk/kiosk.js):
Hapus `UI.shakeLogin()` pada `catch (err)`.

- [x] **Step 4: Kompilasi ulang CSS Tailwind**

Jalankan `npm run build:css` di direktori `WarnetAgent/TMBillingTauri`.

---

### Task 3: Verifikasi & Pengujian

**Files:**
- Test: Unit test backend (`pytest`)
- Test: Rust compilation (`cargo check`)
- Codebase-memory: `index_repository`

- [x] **Step 1: Jalankan pytest backend**
Jalankan `.\.venv\Scripts\python -m pytest` untuk memastikan semua test lulus 100%.

- [x] **Step 2: Jalankan cargo check tauri**
Jalankan `cargo check` di `WarnetAgent/TMBillingTauri/src-tauri` untuk memastikan build Rust tauri clean.

- [x] **Step 3: Update indeks codebase-memory via MCP**
Panggil `index_repository` pada project `C-Project-GIT-TMBilling`.

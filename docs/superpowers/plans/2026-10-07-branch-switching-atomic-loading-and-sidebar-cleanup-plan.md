# Multi-Branch Atomic Loading Handshake & Sidebar Cleanup v1.6.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan menu 'Multi Cabang' dari sidebar admin agar kembali bersih flat seperti sidebar lama, serta menerapkan loading overlay transisi terpusat saat berpindah cabang (remote, local, antar-cabang, atau disconnect) sehingga notifikasi sukses hanya muncul setelah seluruh data cabang baru selesai di-fetch dan ter-render di antarmuka.

**Architecture:** 
1. Menghapus seksi grup navigasi `Multi Cabang` dari `sidebar_admin.html`, mengalihkan akses pengelolaan cabang secara terpusat via navbar branch selector ("Kelola Cabang") dan tab pengaturan.
2. Membangun komponen UI `BranchSwitchOverlay` (transisi loading layar penuh berlatar gelap blur dengan indikator status dinamis dan animasi elegan).
3. Merefaktor alur logika `BranchManager.switchBranch` dan `handleActiveBranchDisconnect` di `app/static/js/kasir/modules/branch/index.js` agar berjalan secara sekuensial: Tampilkan Overlay -> Handshake Backend Context -> Fetch & Reset Data Semua Modul (`await refreshAllModulesAfterBranchSwitch`) -> Render UI -> Tutup Overlay -> Munculkan Toast Sukses.
4. Memperkuat fungsi `updateBrandAndSidebarVisibility` agar secara konsisten menyembunyikan item khusus server lokal (File Explorer, Dokumentasi) saat berada di cabang remote dan memunculkannya kembali saat di cabang lokal.

**Tech Stack:** JavaScript (SPA Kasir), HTML5 / Jinja2 Templates, TailwindCSS, Python / Flask (Test Suite).

**Spec:** `docs/superpowers/specs/2026-10-07-branch-switching-atomic-loading-and-sidebar-cleanup-design.md`

## Global Constraints
- Bahasa antarmuka dan pesan status: Bahasa Indonesia profesional.
- Tidak mengubah skema database SQLite (zero database migration risk).
- Mematuhi aturan disiplin Git SOP: Dilarang commit atau push sebelum ada instruksi eksplisit dari user.
- Menjaga seluruh test suite backend tetap lulus 100% (`264 passed, 0 failed`).

---

### Task 1: Pembersihan Grup Menu Multi Cabang di Sidebar Admin

**Files:**
- Modify: `app/templates/kasir/components/sidebar_admin.html:125-165`
- Test: Inspeksi visual DOM dan verifikasi tidak ada ID yang hilang/patah

**Interfaces:**
- Produces: Sidebar admin yang bersih dan flat tanpa grup `MULTI CABANG`.

- [ ] **Step 1: Hapus blok grup 'MULTI CABANG' di `sidebar_admin.html`**
  Hapus elemen:
  ```html
  <!-- ===== GRUP: MULTI CABANG ===== -->
  <div class="pt-3 pb-1 px-2.5" id="sidebar-branch-section">
      <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Multi Cabang</span>
  </div>
  <div class="space-y-0.5">
      <!-- Multi Cabang Utama -->
      <button onclick="App.switchTab('branch')" data-tab="branch" id="sidebar-tab-branch" ...>...</button>
      <!-- List Koneksi Cabang -->
      <button onclick="App.switchTab('branch_inbound')" data-tab="branch_inbound" ...>...</button>
      <!-- Akun Kasir Cabang -->
      <button onclick="App.switchTab('branch_kasir')" data-tab="branch_kasir" ...>...</button>
  </div>
  ```

- [ ] **Step 2: Verifikasi tombol 'Kelola Cabang' di navbar tetap utuh dan fungsional**
  Pastikan `app/templates/kasir/components/navbar.html` dan `BranchManager.bindNavbarEvents()` tetap dapat memicu `App.switchTab('branch')` saat user mengklik menu "Kelola Cabang" pada dropdown selector navbar.

---

### Task 2: Pembuatan Komponen UI `BranchSwitchOverlay`

**Files:**
- Modify: `app/templates/kasir/components/modals.html`
- Modify: `app/static/js/kasir/modules/branch/index.js`

**Interfaces:**
- Produces: 
  - Element `#branch-switch-overlay` di DOM.
  - Metode `BranchManager.showSwitchLoading(branchName, statusText)`
  - Metode `BranchManager.updateSwitchStatus(statusText)`
  - Metode `BranchManager.hideSwitchLoading()`

- [ ] **Step 1: Tambahkan markup HTML `#branch-switch-overlay` ke `modals.html`**
  ```html
  <!-- Overlay Loading Transisi Antar Cabang -->
  <div id="branch-switch-overlay" class="fixed inset-0 z-50 hidden bg-black/80 backdrop-blur-md flex-col items-center justify-center p-4 transition-all duration-300">
      <div class="flex flex-col items-center text-center p-6 bg-[#0f0f0f] border border-[#262626] rounded-2xl shadow-2xl max-w-sm w-full">
          <div class="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping"></div>
              <div class="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
              <svg class="w-7 h-7 text-emerald-400 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
              </svg>
          </div>
          <h3 id="branch-switch-title" class="text-base font-extrabold text-neutral-100 tracking-wide">Menghubungkan Cabang...</h3>
          <p id="branch-switch-status" class="text-xs text-neutral-400 mt-1 font-sans">Menyinkronkan data sistem...</p>
      </div>
  </div>
  ```

- [ ] **Step 2: Implementasikan metode helper overlay di `branch/index.js`**
  Tambahkan fungsi:
  - `showSwitchLoading(branchName, statusText)`: Menampilkan overlay, mengatur teks nama cabang dan status awal.
  - `updateSwitchStatus(statusText)`: Mengubah teks pesan progress tanpa re-render.
  - `hideSwitchLoading()`: Menyembunyikan overlay dengan transisi fade out yang halus.

---

### Task 3: Refaktor Alur Asinkron `switchBranch` & Disconnect Handshake (Zero Glitch)

**Files:**
- Modify: `app/static/js/kasir/modules/branch/index.js:317-445`

**Interfaces:**
- Modifies:
  - `BranchManager.switchBranch(branchId)`
  - `BranchManager.handleActiveBranchDisconnect()`
  - `BranchManager.updateBrandAndSidebarVisibility()`

- [ ] **Step 1: Sesuaikan `updateBrandAndSidebarVisibility`**
  - Hapus pengecekan `#sidebar-branch-section` yang sudah tidak ada.
  - Perkuat penanganan `#sidebar-fileexplorer-btn` dan `#sidebar-documentation-btn` agar disembunyikan saat remote dan dipulihkan saat lokal.

- [ ] **Step 2: Tata ulang alur `switchBranch(branchId)`**
  1. Munculkan `showSwitchLoading`.
  2. Panggil `API.branch.switchContext`.
  3. Update status overlay: `"Mengunduh data PC & transaksi..."`.
  4. Eksekusi `await this.refreshAllModulesAfterBranchSwitch()`.
  5. Perbarui tampilan navbar dan brand.
  6. Tutup `hideSwitchLoading`.
  7. Terakhir, picu toast sukses: `"Berhasil terhubung ke [Nama Cabang]"` atau `"Beralih ke [Nama Warnet] (Lokal)"`.

- [ ] **Step 3: Tata ulang alur `handleActiveBranchDisconnect()`**
  1. Tampilkan loading overlay dengan pesan `"Koneksi ke [Cabang] terputus. Mengembalikan ke Cabang Lokal..."`.
  2. Panggil `this.switchBranch('0')` yang akan menangani proses loading hingga data lokal termuat penuh.

---

### Task 4: Verifikasi & Test Suite Regression

**Files:**
- Test: `tests/`
- Browser/E2E: Verifikasi alur navigasi kasir SPA

- [ ] **Step 1: Jalankan pytest suite backend**
  Jalankan `python -m pytest tests/ -q` dan pastikan hasil tetap `264 passed, 0 failed`.

- [ ] **Step 2: Kompilasi aset CSS (jika ada class baru)**
  Jalankan `npm run build:css` di `WarnetAgent/TMBillingTauri` jika diperlukan.

- [ ] **Step 3: Sinkronisasi Single Source of Truth `ANTIGRAVITY.md`**
  Perbarui bagian status perencanaan, arsitektur Multi-Branch Nexus v1.6.4, dan alur atomic handshake di `ANTIGRAVITY.md`.

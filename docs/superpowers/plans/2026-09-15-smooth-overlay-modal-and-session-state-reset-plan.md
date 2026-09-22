# Perbaikan Transisi Modal Menu & Paket yang Mulus dan Reset State Sesi Otomatis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan flickering/pergeseran visual overlay saat membuka modal Menu & Paket agar tampil instan dan mulus (overlay tetap kokoh di posisi aslinya di sudut kanan atas), serta memastikan seluruh state UI (modal Akhiri Sesi, modal Menu & Paket, input form, tab) selalu di-reset bersih ke State Awal (*Pristine Initial State*) saat waktu sesi habis atau saat kembali ke layar Kiosk.

**Architecture:** 
1. **Zero-Glitch Modal Architecture:**
   - Menyederhanakan modal `#modal-menu-paket` menjadi In-Card Modal terpadu (`absolute inset-0` di dalam 1 Card Panel Utuh) persis seperti modal `#logout-confirm-modal`.
   - Menghilangkan proses resize/move window OS Tauri yang memicu alokasi ulang buffer DirectX/WebView2 (penyebab utama flickering dan pergeseran card ke kiri selama ~0.5s).
   - Modal muncul instan (0 milidetik) dengan animasi CSS fade-in halus di dalam panel kartu tanpa window berkedip atau bergeser 1 piksel pun.
2. **Comprehensive Session State Reset Lifecycle:**
   - Membuat fungsi terpusat `UI.resetOverlayUI()` dan menyempurnakan `Overlay.resetState()` serta `AppState.resetSession()`.
   - Setiap kali sesi berakhir (waktu habis / logout / status kosong / force-lock) maupun sebelum sesi baru dimulai:
     - Seluruh modal (`#logout-confirm-modal`, `#modal-menu-paket`, `#admin-modal`, `#power-confirm-modal`) otomatis ditutup/diberi class `hidden`.
     - Tab aktif modal Menu & Paket di-reset kembali ke tab default `🏷️ Paket Billing`.
     - Display waktu di-reset ke `00:00:00` dan teks member/PC di-reset ke default.
     - Input username & password di-clear.
   - Sesi baru dijamin 100% selalu membuka tampilan awal yang bersih dan segar.

**Tech Stack:** Tauri v1 (Rust), Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS.

**Spec:** Permintaan pengguna per 15 September 2026:
1. Modal Menu & Paket harus mulus (*smooth*), overlay card tetap berada di posisi aslinya di kanan atas, tidak ada jeda/flickering/hilang sesaat atau pergeseran ke kiri.
2. Saat waktu habis dan kembali ke Kiosk, jika pengguna login lagi ke sesi baru, card overlay tidak boleh mempertahankan modal terbuka dari sesi sebelumnya; state harus kembali bersih ke awal.

## Global Constraints
- Isolasi mode Overlay tetap terjaga (tanpa keyboard hook, taskbar tetap muncul).
- Perubahan state UI harus reaktif dan sinkron dengan event Rust backend (`time-update`, `status-update`, `force-lock`).
- Zero layout shift dan zero visual delay pada semua interaksi kartu overlay.

---

### Task 1: Perbaikan Layout Modal Menu & Paket Menjadi In-Card Modal Zero-Glitch

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/overlay.html:170-230`
- Modify: `WarnetClient/TMBillingTauri/src/overlay/overlay.js:190-255`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/commands/window_commands.rs` (hapus/nonaktifkan resize modal yang tidak diperlukan)
- Test: `npm run build:css` dan `cargo check`

**Interfaces:**
- Consumes: Modal container `#modal-menu-paket` di dalam 1 Card Panel Utuh (`.bg-card`).
- Produces: Transisi modal 0 milidetik via class toggle `hidden` dengan CSS animasi fade-in lembut di dalam batas kartu.

- [ ] **Step 1: Kembalikan `#modal-menu-paket` ke dalam Card Panel Utuh di `overlay.html`**
  Letakkan `#modal-menu-paket` berdampingan dengan `#logout-confirm-modal` di dalam `<div class="relative w-[600px] sm:w-[680px] bg-card ...">`:
  ```html
  <!-- 5. MODAL DAFTAR MENU & PAKET (ABSOLUTE PAS DI DALAM 1 CARD UTUH - 0MS ZERO FLICKER) -->
  <div id="modal-menu-paket"
      class="hidden absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 animate-in fade-in duration-150">
      <div class="w-full h-full bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col">
          <!-- Header Modal dengan Tombol X -->
          <div class="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                  </div>
                  <div>
                      <h2 class="text-sm font-bold text-white tracking-wide">Daftar Menu & Paket</h2>
                      <p class="text-[10px] text-neutral-400 font-medium">Katalog tarif billing & menu kantin (F&B)</p>
                  </div>
              </div>
              <button id="btn-close-menu-paket" type="button" title="Tutup"
                  class="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>

          <!-- Tabs: Paket Billing vs Menu Kantin -->
          <div class="flex gap-2 pt-3 pb-2">
              <button id="tab-btn-paket" type="button"
                  class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-accent text-white shadow-md shadow-accent/20 cursor-pointer">
                  🏷️ Paket Billing
              </button>
              <button id="tab-btn-menu" type="button"
                  class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5 cursor-pointer">
                  🍜 Menu Kantin (F&B)
              </button>
          </div>

          <!-- Content: Tab Paket Billing -->
          <div id="tab-content-paket" class="flex-1 overflow-y-auto pr-1 space-y-2 mt-1.5 scrollbar-thin">
              <p class="text-xs text-neutral-500 py-6 text-center">Memuat daftar paket...</p>
          </div>

          <!-- Content: Tab Menu Kantin -->
          <div id="tab-content-menu" class="hidden flex-1 overflow-y-auto pr-1 space-y-2 mt-1.5 scrollbar-thin">
              <p class="text-xs text-neutral-500 py-6 text-center">Memuat menu kantin...</p>
          </div>
      </div>
  </div>
  ```

- [ ] **Step 2: Sederhanakan fungsi `openMenuPaketModal` dan `closeMenuPaketModal` di `overlay.js`**
  Hapus pemanggilan `Api.setOverlayFullscreenModal` agar window OS tidak mengalami resize/move yang memicu flicker:
  ```javascript
  openMenuPaketModal() {
      const modal = document.getElementById('modal-menu-paket');
      if (!modal) return;

      // Render data terlebih dahulu
      if (!AppState.allPackages?.length || !AppState.allMenus?.length) {
          Api.getWarnetConfig().then(config => {
              if (config) {
                  AppState.allPackages = config.paket || [];
                  AppState.allMenus = config.menu || [];
                  this.renderPaketList();
                  this.renderMenuList();
              }
          }).catch(console.warn);
      }

      this.renderPaketList();
      this.renderMenuList();
      this.switchMenuPaketTab('paket');
      modal.classList.remove('hidden');
  },

  closeMenuPaketModal() {
      const modal = document.getElementById('modal-menu-paket');
      if (modal) modal.classList.add('hidden');
  },
  ```

---

### Task 2: Implementasi Reset State UI Otomatis & Pembersihan Sesi Menyeluruh

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/shared/ui.js`
- Modify: `WarnetClient/TMBillingTauri/src/shared/state.js`
- Modify: `WarnetClient/TMBillingTauri/src/overlay/overlay.js`
- Modify: `WarnetClient/TMBillingTauri/src/main.js`
- Test: Verifikasi transisi Kiosk -> Overlay -> Time Up -> Kiosk -> Login Baru

**Interfaces:**
- Consumes: Fungsi `UI.resetOverlayUI()`, `Overlay.resetState()`, dan `AppState.resetSession()`.
- Produces: Pembersihan total elemen UI dan modal saat sesi berakhir atau sebelum sesi baru dimulai.

- [ ] **Step 1: Buat method `UI.resetOverlayUI()` di `src/shared/ui.js`**
  ```javascript
  resetOverlayUI() {
      // 1. Tutup semua modal overlay
      const logoutModal = document.getElementById('logout-confirm-modal');
      if (logoutModal) logoutModal.classList.add('hidden');

      const menuModal = document.getElementById('modal-menu-paket');
      if (menuModal) menuModal.classList.add('hidden');

      const adminModal = document.getElementById('admin-modal');
      if (adminModal) adminModal.classList.add('hidden');

      const powerModal = document.getElementById('power-confirm-modal');
      if (powerModal) powerModal.classList.add('hidden');

      // 2. Reset tab Menu & Paket ke tab awal 'paket'
      const tabPaketBtn = document.getElementById('tab-btn-paket');
      const tabMenuBtn = document.getElementById('tab-btn-menu');
      const contentPaket = document.getElementById('tab-content-paket');
      const contentMenu = document.getElementById('tab-content-menu');

      if (tabPaketBtn && tabMenuBtn && contentPaket && contentMenu) {
          tabPaketBtn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-accent text-white shadow-md shadow-accent/20 cursor-pointer";
          tabMenuBtn.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5 cursor-pointer";
          contentPaket.classList.remove('hidden');
          contentMenu.classList.add('hidden');
      }

      // 3. Reset display data
      const timeEl = document.getElementById('overlay-time');
      if (timeEl) timeEl.innerText = "00:00:00";

      const memberEl = document.getElementById('overlay-member-name');
      if (memberEl) memberEl.innerText = ": -";

      const groupEl = document.getElementById('overlay-group');
      if (groupEl) groupEl.innerText = ": -";

      // 4. Bersihkan input form login
      const usernameInput = document.getElementById('username');
      if (usernameInput) usernameInput.value = "";

      const passwordInput = document.getElementById('password');
      if (passwordInput) passwordInput.value = "";
  }
  ```

- [ ] **Step 2: Panggil `UI.resetOverlayUI()` pada `Overlay.resetState()` di `overlay.js`**
  ```javascript
  resetState() {
      AppState.resetSession();
      AppState.resetShutdownTimer();
      UI.resetOverlayUI();
  },
  ```

- [ ] **Step 3: Pastikan `UI.resetOverlayUI()` dipanggil sebelum sesi baru dibuka di `main.js`, `kiosk.js`, dan `admin.js`**
  - Pada `main.js` saat `status-update` (`STATUS.AKTIF` / `STATUS.ADMIN`):
    ```javascript
    UI.resetOverlayUI(); // Bersihkan modal lama sebelum pasang data baru
    UI.setOverlayData(data);
    UI.showScreen('billing-overlay');
    ```
  - Pada `kiosk.js` saat `handleLogin`:
    ```javascript
    UI.resetOverlayUI();
    UI.setOverlayData(res);
    UI.showScreen('billing-overlay');
    ```
  - Pada `admin.js` saat `handleLogin`:
    ```javascript
    UI.resetOverlayUI();
    UI.setOverlayData(res);
    UI.showScreen('billing-overlay');
    ```

---

### Task 3: Kompilasi & Verifikasi Menyeluruh

**Files:**
- All modified files

- [ ] **Step 1: Kompilasi Tailwind CSS**
  `npm run build:css` di `WarnetClient/TMBillingTauri`.
- [ ] **Step 2: Kompilasi Rust Backend**
  `cargo check` di `WarnetClient/TMBillingTauri/src-tauri`.
- [ ] **Step 3: Skenario Pengujian Manual (UX Flow)**
  1. **Uji Transisi Modal:**
     - Klik tombol "Menu & Paket" -> Modal muncul seketika di dalam card tanpa kedipan, tanpa jeda 0.5s, dan card overlay tetap stabil di pojok kanan atas.
     - Klik tombol '✕' -> Modal tertutup seketika dengan mulus.
  2. **Uji Reset State Waktu Habis:**
     - Buka modal "Menu & Paket" atau modal "Akhiri Sesi".
     - Biarkan waktu habis / tutup sesi dari kasir sehingga kembali ke Kiosk.
     - Mulai sesi baru (login akun atau start dari kasir).
     - Pastikan card overlay tampil segar dari keadaan awal (**State Awal**) tanpa ada modal yang masih terbuka.

# Rencana Implementasi: Optimasi Performa & Eliminasi Lonjakan CPU TMBillingTauri di Mode Overlay (Dari ~20% ke < 0.5%)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menurunkan penggunaan CPU `TMBilling.exe` dan WebView2 di mode Overlay dari ~15%–20% ke < 0.5% (flat 0% saat idle) dengan mengeliminasi 3 titik loop animasi CSS tak terhingga (`animate-pulse`) di `overlay.html` dan `index.html` yang memicu GPU render loop 144 FPS pada window transparan, serta menjaga mekanisme lockscreen `set_focus` bawaan tetap utuh sesuai preferensi pengguna.

**Fakta Hasil Audit:**
1. **CPU 15% - 20% Terjadi di Mode Overlay**: Pengguna mengonfirmasi bahwa mode Kiosk berjalan aman, namun saat masuk ke mode Overlay (saat bermain game/desktop), CPU melonjak ke 15%–20%.
2. **Penyebab Utama 100% Murni `animate-pulse`**:
   - Di file `overlay.html` terdapat **3 titik animasi berkedip `animate-pulse`** yang aktif secara bersamaan:
     - Header "Properties" (Baris 13)
     - Header "QRIS Pembayaran" (Baris 83)
     - Header "Sesi Aktif" (Baris 107)
   - Pada window transparan melayang (680x530) di monitor 144Hz–240Hz, Chromium GPU compositor dipaksa melakukan *alpha-blending* dan *repaint* jutaan piksel sebanyak **144 kali per detik** di atas desktop/game yang sedang berjalan.
3. **Rust Watcher (`setup.rs`) Dibiarkan Asli**: Panggilan `set_focus()` di mode Kiosk dipertahankan sesuai permintaan pengguna karena tidak menimbulkan masalah.

**Tech Stack:** Tauri v1.5, HTML5, Vanilla JavaScript, TailwindCSS.

---

## Global Constraints

- **Thread Watcher `setup.rs` Tidak Diubah**: Mekanisme `set_focus()` bawaan di `setup.rs` tetap dipertahankan aslinya.
- **Tampilan Visual Tetap Keren & Modern**: Dot hijau diubah menjadi pendar neon statis `.status-dot-active` (`box-shadow: 0 0 8px rgba(52, 211, 153, 0.8)`) tanpa animasi berkedip yang membebani CPU.
- **Dilarang Melakukan Git Commit Tanpa Izin Eksplisit User**: Tunggu perintah konfirmasi user sebelum git commit.

---

### Task 1: Eliminasi 3 Titik `animate-pulse` di `overlay.html` & Kiosk `index.html`

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src/overlay.html:13, 83, 107`
- Modify: `WarnetAgent/TMBillingTauri/src/index.html:95, 121, 228`
- Modify: `WarnetAgent/TMBillingTauri/src/css/input.css:45-55`
- Rebuild: `WarnetAgent/TMBillingTauri/package.json` (`npm run build:css`)

**Interfaces:**
- Produces: Mode Overlay murni statis tanpa animasi loop:
  - Mengganti class `animate-pulse` dengan `.status-dot-active` di 3 titik `overlay.html`:
    1. Properties bar
    2. QRIS header
    3. Sesi Aktif header
  - Mengganti class `animate-pulse` di `index.html` (Kiosk).
  - Mengompilasi ulang CSS dengan `npm run build:css`.

- [x] **Step 1: Ganti 3 titik `animate-pulse` di `overlay.html`**

Di `WarnetAgent/TMBillingTauri/src/overlay.html`:
1. Baris 13: Ganti `<div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>` menjadi `<div class="status-dot-active"></div>`.
2. Baris 83: Ganti `<div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>` menjadi `<div class="status-dot-active"></div>`.
3. Baris 107: Ganti `<div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>` menjadi `<div class="status-dot-active"></div>`.

- [x] **Step 2: Ganti titik `animate-pulse` di `index.html`**

Di `WarnetAgent/TMBillingTauri/src/index.html`:
Ganti elemen `<div class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>` di baris 95, 121, 228 menjadi `<div class="status-dot-active"></div>`.

- [x] **Step 3: Pastikan `.status-dot-active` tersedia di `input.css` dan jalankan compile CSS**

Jalankan `npm run build:css` di `WarnetAgent/TMBillingTauri` untuk me-render `output.css` baru tanpa keyframe animasi aktif.

---

### Task 2: Verifikasi & Pengujian Hasil

**Files:**
- Execute: `cargo check` di `WarnetAgent/TMBillingTauri/src-tauri`
- Test: Unit test suite server `tests/` (`pytest`)
- Codebase-memory: `index_repository`

- [x] **Step 1: Cek integritas build Tauri**
Jalankan `cargo check` di `WarnetAgent/TMBillingTauri/src-tauri` untuk memastikan build berjalan sempurna.

- [x] **Step 2: Jalankan pytest server**
Pastikan 252 unit test server backend tetap passed 100%.

- [x] **Step 3: Update indeks codebase-memory via MCP**
Panggil `index_repository` pada project `C-Project-GIT-TMBilling`.

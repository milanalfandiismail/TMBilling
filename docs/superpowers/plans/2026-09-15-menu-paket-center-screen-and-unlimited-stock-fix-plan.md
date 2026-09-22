# Perbaikan Status Ready Menu Kantin dan Modal Menu & Paket di Tengah Layar Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan status ketersediaan menu kantin (F&B) secara bersih dan berorientasi pelanggan sebagai status **"Ready"** (jika `stok < 0` unlimited atau `stok > 0`) atau **"Habis"** (jika `stok === 0`) tanpa menampilkan angka stok internal, serta memindahkan tampilan Modal "Daftar Menu & Paket" dari sudut kanan atas agar muncul lapang dan terpusat tepat di tengah layar desktop monitor dengan latar belakang gelap transparan.

**Architecture:** 
1. **Frontend Logic:** Memperbaiki pengecekan ketersediaan menu di mana `isAvailable = (m.stok < 0 || m.stok > 0)` dan menampilkan badge sederhana **`Ready`** (hijau/emerald) atau **`Habis`** (merah). Angka stok internal tidak ditampilkan ke end-user.
2. **Tauri Window Management:** Menyediakan command Rust `set_overlay_fullscreen_modal(fullscreen: bool)` yang memperluas jendela transparan Tauri menjadi fullscreen saat modal dibuka (sehingga backdrop dan dialog berada di tengah monitor desktop), dan mengembalikannya ke ukuran compact sudut kanan atas (`680x530` / `600x500`) saat modal ditutup.
3. **Responsive Modal UI:** Memperbarui `#modal-menu-paket` di `overlay.html` dengan tata letak `fixed inset-0` dan card dialog berukuran `max-w-[780px] h-[540px]` yang elegan dan responsif.

**Tech Stack:** Tauri v1 (Rust), Vanilla JavaScript (ES6 Modules), HTML5, Tailwind CSS.

**Spec:** Permintaan pengguna per 15 September 2026:
1. Status ketersediaan menu: Tampilkan dengan status **"Ready"** (tanpa menampilkan angka stok dan tanpa teks "unlimited"), atau **"Habis"** jika stok kosong.
2. Fitur: Modal "Menu & Paket" muncul di tengah layar desktop secara keseluruhan (bukan hanya di dalam card kecil sudut kanan atas), dengan tombol '✕', backdrop blur, serta dapat ditutup via klik backdrop atau tombol Escape.

## Global Constraints
- Tetap menjaga isolasi mode Overlay (tidak mengaktifkan keyboard hook kiosk, tidak menyembunyikan taskbar).
- Background jendela Tauri di luar kartu dialog harus tetap 100% transparan (`transparent: true`).
- Transisi buka dan tutup modal harus mulus dan mengembalikan posisi overlay sudut kanan atas secara presisi.

---

### Task 1: Penerapan Status "Ready" vs "Habis" pada Katalog Menu Kantin

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/overlay/overlay.js:280-340`
- Test: Verifikasi rendering item menu dengan `stok: -1`, `stok: 10`, dan `stok: 0`

**Interfaces:**
- Consumes: Objek `MenuItem` dari backend (`{ nama, harga, stok, gambar_path, is_active }`).
- Produces: Rendering HTML badge status menu pelanggan:
  - Tersedia (`m.stok < 0 || m.stok > 0`): Badge **`Ready`** dengan styling hijau/emerald (`bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`).
  - Kosong (`m.stok === 0`): Badge **`Habis`** dengan styling merah (`bg-red-500/10 text-red-400 border border-red-500/20`).

- [ ] **Step 1: Terapkan logika status "Ready" vs "Habis" pada `renderMenuList()` di `overlay.js`**
  ```javascript
  const isAvailable = (m.stok !== undefined && m.stok !== null) ? (m.stok < 0 || m.stok > 0) : true;
  const statusText = isAvailable ? 'Ready' : 'Habis';
  const badgeClass = isAvailable
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : 'bg-red-500/10 text-red-400 border border-red-500/20';
  ```

---

### Task 2: Penambahan Rust Command `set_overlay_fullscreen_modal` untuk Memperluas Window Tauri

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/commands/window_commands.rs`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/main.rs`
- Modify: `WarnetClient/TMBillingTauri/src/shared/api.js`
- Test: `cargo check` di folder `WarnetClient/TMBillingTauri/src-tauri`

**Interfaces:**
- Consumes: `window: Window`, `fullscreen: bool`
- Produces: IPC invocation `invoke('set_overlay_fullscreen_modal', { fullscreen })`

- [ ] **Step 1: Buat fungsi `set_overlay_fullscreen_modal` di `window_commands.rs`**
  ```rust
  #[tauri::command]
  pub fn set_overlay_fullscreen_modal(window: Window, fullscreen: bool) -> Result<(), String> {
      if fullscreen {
          window.set_fullscreen(true).map_err(|e| e.to_string())?;
          window.set_always_on_top(true).map_err(|e| e.to_string())?;
      } else {
          window.set_fullscreen(false).map_err(|e| e.to_string())?;
          window.set_always_on_top(true).map_err(|e| e.to_string())?;
          window.set_decorations(false).map_err(|e| e.to_string())?;
          window.set_resizable(false).map_err(|e| e.to_string())?;

          if let Ok(Some(monitor)) = window.current_monitor() {
              let (size, pos) = get_responsive_overlay_geometry(&monitor);
              let _ = window.set_size(size);
              let _ = window.set_position(Position::Logical(pos));
          } else {
              let _ = window.set_size(LogicalSize::new(680.0, 530.0));
          }
      }
      Ok(())
  }
  ```

- [ ] **Step 2: Daftarkan command di `main.rs` invoke_handler**
  Tambahkan `crate::commands::window_commands::set_overlay_fullscreen_modal`.

- [ ] **Step 3: Tambahkan method pemanggil di `src/shared/api.js`**
  ```javascript
  async setOverlayFullscreenModal(fullscreen) {
      return await invoke('set_overlay_fullscreen_modal', { fullscreen });
  },
  ```

- [ ] **Step 4: Verifikasi kompilasi Rust**
  Jalankan `cargo check` di `WarnetClient/TMBillingTauri/src-tauri`.

---

### Task 3: Restrukturisasi Layout Modal "Daftar Menu & Paket" di Tengah Layar Desktop

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/overlay.html`
- Modify: `WarnetClient/TMBillingTauri/src/overlay/overlay.js`
- Test: `npm run build:css` di `WarnetClient/TMBillingTauri`

**Interfaces:**
- Consumes: Modal container `#modal-menu-paket`
- Produces: Modal layout lapang di tengah layar desktop (`fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50`).

- [ ] **Step 1: Pindahkan `#modal-menu-paket` keluar dari card sudut kanan atas di `overlay.html`**
  Letakkan tepat di dalam `<div id="billing-overlay">` sebagai elemen fixed overlay layar penuh:
  ```html
  <div id="modal-menu-paket"
      class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div id="modal-menu-paket-card"
          class="w-full max-w-[780px] h-[540px] max-h-[85vh] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col">
          ...
      </div>
  </div>
  ```

- [ ] **Step 2: Sinkronkan interaksi buka/tutup modal pada `overlay.js`**
  - Saat membuka (`openMenuPaketModal`):
    1. Panggil `await Api.setOverlayFullscreenModal(true)`.
    2. Tampilkan `#modal-menu-paket`.
    3. Pasang listener untuk tombol Escape dan klik pada backdrop (di luar card).
  - Saat menutup (`closeMenuPaketModal`):
    1. Sembunyikan `#modal-menu-paket`.
    2. Panggil `await Api.setOverlayFullscreenModal(false)`.
    3. Lepas listener Escape.

- [ ] **Step 3: Sesuaikan grid paket dan menu agar memanfaatkan ruang layar yang lebih luas**
  Gunakan grid multi-kolom yang rapi (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5`) dengan badge "Ready" / "Habis" yang bersih.

- [ ] **Step 4: Kompilasi ulang CSS Tailwind**
  Jalankan `npm run build:css`.

---

### Task 4: Verifikasi Menyeluruh & Testing

**Files:**
- All modified files

- [ ] **Step 1: Verifikasi Rust build**
  `cargo check` pada `src-tauri`.
- [ ] **Step 2: Verifikasi CSS build**
  `npm run build:css` pada `WarnetClient/TMBillingTauri`.
- [ ] **Step 3: Uji fungsi interaktif**
  - Buka modal -> Layar monitor menampilkan backdrop gelap transparan dan kartu menu berada persis di tengah monitor desktop.
  - Cek item menu kantin -> Menampilkan status **`Ready`** (jika tersedia atau unlimited) atau **`Habis`** (jika stok 0), tanpa menampilkan angka stok internal.
  - Tutup modal (klik '✕', klik backdrop, atau tekan Esc) -> Layar kembali ke ukuran overlay sudut kanan atas.

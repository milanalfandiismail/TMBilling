# Mobile Touch Sweep Scroll & Kiosk UI Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan 1-finger swipe gesture untuk mouse wheel scroll pada remote control VNC mobile di seluruh zoom level, memperbesar skala teks & komponen Kiosk Client dengan acuan kasir sidebar, dan menghapus header duplikat/hardcode pada tab Kiosk.

**Architecture:** 
- Menambahkan metode `dispatchCanvasWheel` dan penanganan `touchmove` 1-jari pada `vnc_client.js` untuk semua level zoom.
- Memperbarui markup `index.html` dan logika switching tab pada `kiosk.js` di WarnetClient untuk menghapus header panel statis dan meningkatkan ukuran font semua elemen.
- Memperbarui stylesheet `WarnetClient/TMBillingTauri/src/css/input.css` dan mengompilasi ulang output CSS.

**Tech Stack:** JavaScript (ES6+), noVNC RFB, HTML5 Canvas, Tailwind CSS, Tauri Client.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-touch-scroll-and-kiosk-scaling-design.md`

## Global Constraints
- Bahasa kode, komentar, dan commit dalam Bahasa Indonesia.
- Gestur 1-jari sapuan atas/bawah berlaku di semua zoom level sebagai scroll mouse.
- Gestur 2-jari didedikasikan untuk pinch-to-zoom dan pan viewport.
- Jangan merusak single tap (klik kiri), double tap, dan long press (klik kanan).

---

### Task 1: Implementasi Mobile Touch Sweep Scroll pada Remote Control VNC (Semua Zoom Level)

**Files:**
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js:71-105`
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js:340-525`

**Interfaces:**
- Produces: `dispatchCanvasWheel(clientX, clientY, deltaY)`
- Consumes: Standard DOM `WheelEvent` dan `RFB` canvas mouse tracking

- [ ] **Step 1: Tambahkan method `dispatchCanvasWheel` pada class `VNCClient`**
  ```javascript
  dispatchCanvasWheel(clientX, clientY, deltaY) {
      const screen = this.options.screenContainer;
      if (!screen) return;
      const canvas = screen.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      const clampedRelX = Math.max(0, Math.min(1, relX));
      const clampedRelY = Math.max(0, Math.min(1, relY));

      const baseW = canvas.offsetWidth || (rect.width / (this.zoomLevel || 1.0));
      const baseH = canvas.offsetHeight || (rect.height / (this.zoomLevel || 1.0));

      const syntheticClientX = rect.left + (clampedRelX * baseW);
      const syntheticClientY = rect.top + (clampedRelY * baseH);

      const ev = new WheelEvent('wheel', {
          clientX: syntheticClientX,
          clientY: syntheticClientY,
          deltaY: deltaY,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
          view: window
      });
      canvas.dispatchEvent(ev);
  }
  ```

- [ ] **Step 2: Implementasikan tracking sapuan 1-jari pada `touchstart`, `touchmove`, dan `touchend` di `vnc_client.js`**
  - Pada `touchstart`: inisialisasi `lastScrollTouchY = touch.clientY; isScrolling = false;`
  - Pada `touchmove` (1 jari):
    ```javascript
    if (e.touches.length === 1) {
        if (this.isPinchZooming) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const dist = Math.hypot(dx, dy);

        if (dist > 12) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            isDragging = true;

            const scrollDy = touch.clientY - lastScrollTouchY;
            if (Math.abs(scrollDy) >= 15) {
                isScrolling = true;
                const deltaY = scrollDy < 0 ? 100 : -100;
                this.dispatchCanvasWheel(touch.clientX, touch.clientY, deltaY);
                lastScrollTouchY = touch.clientY;
            }
            e.preventDefault();
        }
        e.stopPropagation();
    }
    ```
  - Pada `touchend`:
    ```javascript
    if (isLongPress || isDragging || isScrolling) {
        e.stopPropagation();
        e.preventDefault();
        return;
    }
    ```

---

### Task 2: Pembersihan Header Hardcode & Pembesaran Skala Tipografi pada Kiosk Client

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src/index.html:30-165`
- Modify: `WarnetClient/TMBillingTauri/src/kiosk/kiosk.js:70-95`
- Modify: `WarnetClient/TMBillingTauri/src/kiosk/kiosk.js:200-290`
- Modify: `WarnetClient/TMBillingTauri/src/css/input.css:125-265`

- [ ] **Step 1: Hapus header statis `<header>... Informasi ...</header>` dari dalam `#panel-rules` dan `#panel-packages` di `src/index.html`**
- [ ] **Step 2: Perbesar ukuran tombol tab (`#tab-rules-btn`, `#tab-packages-btn`) menjadi `text-xs lg:text-sm font-bold py-2` dan sesuaikan class aktif di `kiosk.js`**
- [ ] **Step 3: Perbesar ukuran teks `#rules-container` menjadi `text-xs lg:text-sm` serta sesuaikan skala heading di `input.css`**
- [ ] **Step 4: Perbesar elemen Daftar Paket (tabs grup, nama paket, durasi, harga) di `kiosk.js`**
- [ ] **Step 5: Perbesar elemen Footer Info (IP, MAC Address, Countdown Timer, Status, Client Version) di `index.html`**
- [ ] **Step 6: Perbesar elemen Badges dan teks pada QRIS Card & Login Card di `index.html`**

---

### Task 3: Kompilasi Asset CSS & Verifikasi Sistem

**Files:**
- Output: `WarnetClient/TMBillingTauri/src/css/output.css`
- Output: `app/static/css/tailwind.css`

- [ ] **Step 1: Kompilasi Tailwind CSS untuk WarnetClient (`npx tailwindcss -i src/css/input.css -o src/css/output.css --minify`)**
- [ ] **Step 2: Kompilasi Tailwind CSS untuk Kasir (`npm run build:css`)**
- [ ] **Step 3: Jalankan `pytest -q` untuk memastikan seluruh test suite backend lulus 100%**
- [ ] **Step 4: Commit seluruh hasil perubahan ke Git dengan commit message deskriptif**

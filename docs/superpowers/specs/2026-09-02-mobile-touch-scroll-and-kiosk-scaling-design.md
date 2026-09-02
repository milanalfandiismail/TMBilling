# Design Specification: Mobile Touch Sweep Scroll (All Zoom Levels) & Kiosk UI Scaling

**Author:** Antigravity AI  
**Date:** 2026-09-02  
**Status:** Validated & Ready for Execution  

---

## 1. Overview & Objectives

Dokumen spesifikasi ini mendefinisikan rancangan teknis untuk 3 penyempurnaan sistem:
1. **Remote Control (VNC) Mobile Touch Scroll (Semua Zoom Level)**: Menjadikan gestur sapuan 1 jari (*1-finger swipe up & down*) sebagai pengganti mutlak *mouse wheel scroll* pada remote PC di **seluruh tingkatan zoom (all zoom levels)**, sementara gestur 2-jari didedikasikan penuh untuk *Pinch-to-Zoom* dan *Pan Viewport*.
2. **Client Kiosk UI Scaling & Typography Enhancement**: Memperbesar ukuran teks dan skala seluruh komponen Kiosk Client (*Aturan Warnet*, *Daftar Paket*, *IP Address*, *MAC Address*, *Client Version*, *Shutdown Timer*, dan *QRIS Card*) dengan menjadikan standar tipografi sidebar Kasir (13px - 16px) sebagai acuan visual utama.
3. **Pembersihan Header Hardcode pada Tab Kiosk**: Menghapus header duplikat/hardcoded (*Informasi*, *Aturan Warnet*, *Daftar Paket*) di dalam panel konten agar area tampilan aturan dan paket lebih luas, bersih, dan dinamis.

---

## 2. Detail Rancangan Teknis

### Feature A: Mobile Touch Sweep Scroll di Remote Control VNC (`vnc_client.js`)
* **Touch Mapping Matrix**:
  | Gestur | Jumlah Jari | Aksi Remote Desktop | Keterangan |
  |---|---|---|---|
  | **Single Tap** | 1 Jari | **Klik Kiri (Left Click)** | Klik tombol primer mouse pada koordinat sentuh. |
  | **Double Tap** | 1 Jari | **Klik Ganda (Double Click)** | Membuka folder/aplikasi. |
  | **Long Press (>500ms)** | 1 Jari | **Klik Kanan (Right Click)** | Membuka context menu (dengan haptic vibration). |
  | **Swipe / Sweep Up & Down** | 1 Jari | **Mouse Wheel Scroll (Atas & Bawah)** | Berlaku di **semua tingkat zoom** (pengganti scroll mouse fisik). |
  | **Pinch & Drag** | 2 Jari | **Zoom In/Out & Pan Viewport** | Mengatur pembesaran layar remote dan menggeser viewport. |

* **Logika Implementasi Scroll**:
  - Pada `touchstart`, rekam koordinat sentuh `touchStartX`, `touchStartY`, `lastScrollTouchY = touch.clientY`, dan waktu sentuh `touchStartTime`.
  - Pada `touchmove` (1 jari):
    - Hitung jarak pergeseran: `dy = touch.clientY - lastScrollTouchY`.
    - Jika pergeseran kumulatif melebihi threshold sentuh awal (`dist > 12px`):
      - Tandai `isScrolling = true` dan batalkan `longPressTimer`.
      - Hitung step delta scroll:
        - Jika jari digeser ke atas (`dy < 0`): kirim event `WheelEvent` dengan `deltaY = +100` (scroll halaman ke bawah / natural mobile scroll).
        - Jika jari digeser ke bawah (`dy > 0`): kirim event `WheelEvent` dengan `deltaY = -100` (scroll halaman ke atas).
      - Perbarui `lastScrollTouchY = touch.clientY`.
  - Pada `touchend`:
    - Jika `isScrolling = true`, cegah eksekusi klik (single tap / double tap).

### Feature B: Kiosk Client Scaling & Typography Standardisation (`WarnetClient`)
* **Acuan**: Standar komponen Kasir & Sidebar (13px - 16px, `font-bold` / `font-semibold`).
* **Komponen yang disesuaikan**:
  - **Tab Switcher Buttons (`#tab-rules-btn`, `#tab-packages-btn`)**: Diubah menjadi `text-xs lg:text-sm font-bold py-2`.
  - **Aturan Warnet (`#rules-container`)**:
    - Kontainer teks: `text-xs lg:text-sm text-neutral-300 leading-relaxed`.
    - Headings h1-h4: Ditingkatkan agar proporsional dan jelas (`h1: 1.4rem`, `h2: 1.2rem`, `h3: 1.05rem`, `h4: 0.95rem`).
  - **Daftar Paket (`#panel-packages`)**:
    - Paket Group Tabs: `text-xs lg:text-sm font-bold px-3 py-1.5`.
    - Paket List Items: Nama paket (`text-sm lg:text-base font-bold text-neutral-200`), durasi (`text-xs lg:text-sm text-neutral-400`), harga (`text-sm lg:text-base font-bold text-accent font-mono`).
  - **Kiosk Footer Info**:
    - IP & MAC Address: `text-xs lg:text-sm font-mono text-neutral-300`.
    - Countdown Timer: `text-2xl lg:text-3xl xl:text-4xl font-mono text-white font-black`.
    - Shutdown Status & Client Version: `text-xs lg:text-sm font-bold`.
  - **QRIS & Login Cards**:
    - Badges ("Pembayaran", "Sistem Terkunci"): `text-xs font-bold uppercase tracking-widest`.
    - Subtitles & Notes: `text-xs lg:text-sm`.

### Feature C: Pembersihan Header Hardcode di Panel Konten
* **Struktur Sebelum**:
  Di dalam `#panel-rules` terdapat `<header>... Informasi ... Aturan Warnet</header>`, dan di `#panel-packages` terdapat `<header>... Informasi ... Daftar Paket</header>`.
* **Struktur Sesudah**:
  Header statis di dalam panel konten dihapus sepenuhnya. Tombol navigasi tab di bagian atas sudah bertindak sebagai judul aktif dan penanda konteks, sehingga konten memiliki ruang vertikal maksimal tanpa teks berulang.

---

## 3. Rencana Verifikasi & Uji
1. **Unit & Regression Testing**: `pytest -q` (45/45 passed).
2. **Build Compilation**: Tailwind CSS untuk WarnetClient (`output.css`) dan Web Kasir (`tailwind.css`).
3. **Manual Validation**: Pengecekan bebas eror pada event handling touch dan rendering Kiosk.

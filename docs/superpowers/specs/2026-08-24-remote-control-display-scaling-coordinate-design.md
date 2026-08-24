# Spesifikasi Desain — Professionalisasi Remote Control Server (Display, Scaling & Mouse Coordinate)

**Tanggal:** 24 Agustus 2026  
**Status:** In Review / Ready for Plan  
**Target Komponen:** Remote Control Server (`remote_server.html`, `vnc_client.js`)

---

## 1. Ringkasan Masalah & Root Cause Analysis

### 1.1 Alur Sistem Remote Control Saat Ini
```
TightVNC Server (Port 5900)
       ↓ (TCP RFB Raw Frame)
Websockify Daemon (Port 8081 / /ws/vnc)
       ↓ (WebSocket Binary Tunnel)
noVNC RFB.js (Browser Client)
       ↓ (Render Frame to <canvas>)
Viewport Container (#vnc-container & #vnc-screen)
       ↓ (Input Event: Mouse / Touch / Keyboard)
TightVNC Server (Remote Desktop Target)
```

### 1.2 Temuan Investigasi (Root Cause)
1. **Konflik CSS Global pada Canvas (`#vnc-screen canvas`)**:
   - Di `remote_server.html`, terdapat CSS:
     ```css
     #vnc-screen canvas {
         max-width: 100% !important;
         max-height: 100% !important;
         object-fit: contain !important;
         margin: auto;
         display: block;
     }
     ```
   - **Dampak saat Scaling ON**: CSS ini menimpa kalkulasi layout internal noVNC sehingga membatasi ekspansi canvas dan berpotensi memicu ketidakakuratan bounding rect jika terjadi letterboxing.
   - **Dampak Fatal saat Scaling OFF**: Ketika `scaleViewport = false`, noVNC menetapkan faktor skala internal `scale = 1.0` (koordinat 1:1). Namun CSS memaksa canvas 1920×1080 mengecil ke ukuran viewport (misal 1000px). noVNC tidak mengetahui canvas telah dikecilkan oleh CSS, sehingga setiap event klik mouse mengirimkan koordinat piksel lokal yang belum diskalakan ke server (misal klik di tengah canvas x=500 dikirim sebagai x=500 padahal seharusnya x=960). **Ini adalah akar penyebab posisi mouse meleset parah saat Scaling OFF.**

2. **Viewport & Overflow Behavior**:
   - `#vnc-screen` menggunakan class `overflow-hidden` secara permanen. Saat Scaling OFF (1:1), remote screen beresolusi tinggi (seperti 1920×1080 atau 2560×1440) terpotong dan tidak dapat digeser/di-scroll oleh kasir.
   - Tab height `h-[calc(100vh-200px)]` menyisakan gap kosong yang tidak adaptif terhadap berbagai resolusi monitor kasir.

3. **Lifecycle Resize & Mode Switching**:
   - Perpindahan Scaling ON ↔ Scaling OFF belum mereset layout class container dan belum memicu penyesuaian ulang kanvas secara reaktif.
   - Tidak adanya indikator resolusi remote (HUD) membuat kasir tidak mengetahui ukuran asli layar server (misal: 1920×1080).

---

## 2. Solusi & Arsitektur Perbaikan

### 2.1 Mode Scaling ON (Fit to Viewport)
- **Tujuan**: Menampilkan seluruh layar remote di dalam area viewport secara proporsional (aspect ratio terkunci) tanpa ada bagian yang terpotong.
- **Implementasi**:
  - Hapus CSS yang memaksa `max-width: 100% !important` dan `max-height: 100% !important`.
  - `#vnc-screen` menggunakan mode `overflow-hidden flex items-center justify-center w-full h-full`.
  - `rfb.scaleViewport = true`.
  - noVNC secara matematis menghitung:
    $$\text{scale} = \min\left(\frac{W_{\text{viewport}}}{W_{\text{remote}}}, \frac{H_{\text{viewport}}}{H_{\text{remote}}}\right)$$
  - Transformasi koordinat mouse:
    $$X_{\text{remote}} = \frac{X_{\text{local}} - \text{rect.left}}{\text{scale}}, \quad Y_{\text{remote}} = \frac{Y_{\text{local}} - \text{rect.top}}{\text{scale}}$$
  - Bounding rectangle canvas secara otomatis menampung offset letterbox/pillarbox.

### 2.2 Mode Scaling OFF (1:1 Native Resolution)
- **Tujuan**: Menampilkan layar remote pada piksel asli (100% crisp/tajam) dengan dukungan scrolling/panning yang mulus jika ukuran remote lebih besar dari viewport kasir.
- **Implementasi**:
  - `#vnc-screen` beralih ke mode `overflow-auto block w-full h-full scrollbar-mono`.
  - `rfb.scaleViewport = false`.
  - Canvas dirender dengan ukuran piksel alami tanpa kompresi visual CSS.
  - Transformasi koordinat mouse:
    $$X_{\text{remote}} = X_{\text{local}} - \text{rect.left}, \quad Y_{\text{remote}} = Y_{\text{local}} - \text{rect.top}$$
  - Karena `rect.left` dan `rect.top` secara presisi mencerminkan scroll offset (`container.scrollLeft` & `container.scrollTop`), koordinat mouse terkirim 1:1 secara matematis akurat ke TightVNC server di seluruh area scroll.

### 2.3 Single Source of Truth & Zero-Drift Switching
- Setiap perubahan mode (Scaling ON ↔ OFF), resize window, toggle sidebar, atau fullscreen akan memicu fungsi terpadu `updateDisplayMode()`.
- Menggunakan `ResizeObserver` modern pada `#vnc-container` untuk mendeteksi perubahan ukuran kontainer secara real-time.

### 2.4 HUD Status Bar & UX Professional
- Menambahkan informasi resolusi remote aktif (misal: `1920 × 1080 (16:9)`) dan status scaling (`FIT` / `1:1`) di header toolbar.
- Pengoptimalan tinggi tab container agar memanfaatkan 100% sisa ruang vertikal layar kasir (`flex-1 min-h-0`).

---

## 3. Matriks Transformasi Koordinat Mouse

| Kondisi | Mode Display | Dimensi Canvas Visual | noVNC Scale | Formula Koordinat Remote ($X_r, Y_r$) | Status Akurasi |
|---|---|---|---|---|---|
| **Scaling ON** | Fit & Centered | $W_r \times s, \; H_r \times s$ | $s = \min(W_v/W_r, H_v/H_r)$ | $X_r = (X_c - \text{left})/s, \; Y_r = (Y_c - \text{top})/s$ | **100% Akurat** |
| **Scaling OFF** | 1:1 Scrollable | $W_r \times 1, \; H_r \times 1$ | $1.0$ | $X_r = X_c - \text{left}, \; Y_r = Y_c - \text{top}$ | **100% Akurat** |
| **Resize Event** | Auto-recalculate | Dinamis | Dinamis | Auto-recalculated via `ResizeObserver` | **100% Akurat** |

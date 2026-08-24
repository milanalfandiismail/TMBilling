# Implementation Plan — Professionalisasi Remote Control Server (Display, Scaling & Mouse Coordinate)

Dokumen ini berisi tahapan implementasi perbaikan display, scaling, dan transformasi koordinat mouse untuk Remote Control Server di TMBilling.

---

## Tahap 1: Perbaikan Markup & Layout CSS (`remote_server.html`)
- [ ] Hapus inline style CSS yang menimpa canvas (`#vnc-screen canvas { max-width: 100% !important; ... }`).
- [ ] Sesuaikan wrapper tab remote server menjadi `h-[calc(100vh-140px)]` atau `flex-1 min-h-0` agar memenuhi kontainer secara optimal.
- [ ] Tambahkan elemen HUD indikator resolusi di toolbar (`#vnc-resolution-badge`).
- [ ] Perbarui tombol toggle scaling dengan indikator visual yang jelas (Badge `FIT (Skala)` vs `1:1 (Asli)`).

## Tahap 2: Refactoring Core Scaling & Display Logic (`vnc_client.js`)
- [ ] Implementasikan fungsi sentral `applyDisplayMode()` yang mengatur:
  - Mode Scaling ON: Menyetel `rfb.scaleViewport = true`, `#vnc-screen` class `overflow-hidden flex items-center justify-center w-full h-full`.
  - Mode Scaling OFF: Menyetel `rfb.scaleViewport = false`, `#vnc-screen` class `overflow-auto block w-full h-full scrollbar-mono`.
- [ ] Tangkap event `desktopname`, `firstframe`, dan `capabilities` dari noVNC untuk membaca resolusi asli remote screen (`rfb._fbWidth`, `rfb._fbHeight`) dan tampilkan di `#vnc-resolution-badge`.
- [ ] Pasang `ResizeObserver` pada kontainer `#vnc-container` untuk memicu penyesuaian otomatis noVNC secara instan ketika ukuran browser atau kontainer berubah.
- [ ] Pastikan tidak ada hardcoded offset (seperti `+5px`, `-10px`).

## Tahap 3: Verifikasi Matematis & Runtime Testing
- [ ] Verifikasi mode Scaling ON dengan aspect ratio 16:9, 16:10, dan 4:3.
- [ ] Verifikasi mode Scaling OFF dengan overflow scrolling pada viewport yang lebih kecil dari resolusi remote.
- [ ] Verifikasi akurasi mouse pada 4 sudut dan titik tengah canvas pada kedua mode.
- [ ] Verifikasi transisi Scaling ON ↔ Scaling OFF dan fullscreen toggle tanpa coordinate drift.
- [ ] Jalankan backend test suite dan MCP reindexing.

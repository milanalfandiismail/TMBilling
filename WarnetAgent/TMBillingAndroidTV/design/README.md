# TMBilling Android TV Kiosk — Authentic Design System (Chamber Noir)

Dokumen dan aset visual resmi hasil rebuild pada **FigCraft MCP** yang telah diselaraskan 100% dengan **Frontend Asli TMBilling v2.0** (`app-rust/app/templates/`, `app-rust/tailwind.config.js`, dan `WarnetAgent/TMBilling/`).

---

## 🎨 Palet & Design Tokens Resmi TMBilling

| Komponen | Token Hex | Keterangan & Penggunaan |
|---|---|---|
| **Background Dasar** | `#050505` | Hitam pekat pekat (OLED Pure Black) tanpa gradasi biru murahan |
| **Surface Kontainer** | `#0A0A0A` | Header HUD, input field background, status badge dasar |
| **Card / Dialog Modal** | `#0C0C0C` | Kartu utama info workstation, dialog setup console, modal PIN |
| **Border & Divider** | `#1C1C1C` / `#262626` | Garis batas tipis 1px tajam & elegan |
| **Input Field Border** | `#2A2A2A` | Border form text input saat idle |
| **Brand Badge** | `#FFFFFF` badge + `#000000` text | Logo resmi TMBilling: kotak putih rounded-xl dengan teks tebal "TM" |
| **Aksen Aktif (Running)** | `#34D399` (Emerald Green) | Status SESI AKTIF, progress bar, timer sisa waktu bermain |
| **Tombol Fokus Utama (TV)**| `#FFFFFF` bg + `#000000` text | Tombol aktif terpilih pada remote TV D-Pad (high contrast) |
| **Tombol Sekunder (TV)** | `#171717` bg + `#262626` border | Tombol sekunder dengan teks `#E5E5E5` |
| **Tipografi Angka & Timer**| `Consolas` / `JetBrains Mono` | Monospace akurat untuk angka jam, menit, detik, IP, dan harga |
| **Tipografi Teks Utama** | `Segoe UI` / `Inter` | Sans-serif bersih, modern, dan mudah dibaca dari jarak 3-4 meter |

---

## 🖼️ Tinjauan 4 Layar (1920x1080 Full HD 16:9)

### 1. Layar Standby (Kiosk Locked)
![Screen 1 Standby](screen1_standby.png)
- **Top Bar**: Logo TMBilling (putih), Badge `STATION: PS-01`, Zona `RENTAL PS`, Server Status `10.0.2.2:7015 (ONLINE)`, Jam Realtime.
- **Hero Card**: Status `STANDBY • MENUNGGU AKTIVASI KASIR`, Header `PLAYSTATION 5`, Tarif `Rp 15.000 / Jam`, Promo `Paket Promo 3 Jam: Rp 40.000`, 3 langkah panduan bermain, dan kotak QR code kasir.
- **Bottom HUD**: Panduan tombol remote TV D-Pad `[OK] Refresh Status`, `[MENU] Pengaturan Server`.

### 2. Layar Sesi Berjalan (Active Session)
![Screen 2 Active](screen2_active.png)
- **Top Bar**: Badge `SESI AKTIF` hijau emerald dengan dot pulsasi realtime.
- **Hero Card**: Nama penyewa `Rian Gaming (Member VIP)`, Header `SISA WAKTU BERMAIN`.
- **Giant Monospace Timer**: Teks raksasa `01:45:20` font-bold monospace Consolas warna `#34D399`.
- **Progress Bar**: Bar persentase waktu terpakai (hijau emerald).
- **Statistik Trio**: Total Durasi (`02:30:00`), Waktu Terpakai (`00:44:40`), Total Biaya (`Rp 37.500`).
- **Notice Suara**: Peringatan TTS otomatis 5 menit & 1 menit sebelum sesi berakhir.
- **Tombol Navigasi**: Tombol putih kontras tinggi `[MASUK KE GAME (HDMI 1)]` untuk langsung beralih ke input PlayStation.

### 3. Layar Setup Console (Pengaturan 16:9 Landscape)
![Screen 3 Setup](screen3_setup.png)
- **Modal 2 Kolom**: Menggantikan dialog sempit vertikal model HP menjadi konsol TV 16:9 landscape yang proporsional.
- **Kolom Kiri (Input & Preset)**:
  - Input IP/URL Server (`http://10.0.2.2:7015`).
  - Tombol Preset Cepat: `[Preset Emulator]` dan `[Preset LAN]`.
  - Input Kode Workstation (`PS-01`).
  - Input Secret Key (`TM2026`) dengan tombol default satu klik.
- **Kolom Kanan (Diagnostik Realtime)**:
  - Panel tes koneksi langsung ke backend Axum Rust.
  - Menampilkan HTTP Status `200 OK`, latency `8 ms`, Workstation terdaftar, dan tombol `[TEST PING KONEKSI KASIR]`.
- **Tombol Aksi**: Tombol putih `[SIMPAN & HUBUNGKAN]` dan tombol gelap `[BATAL]`.

### 4. Layar PIN Admin (Keamanan Kiosk)
![Screen 4 PIN](screen4_pin.png)
- **Modal PIN Terpusat**: Proteksi keamanan agar pelanggan tidak dapat mengubah pengaturan server atau keluar dari Kiosk.
- **Indikator PIN**: 4 titik bulat (3 titik terisi warna hijau emerald, 1 titik kosong).
- **Virtual Numpad 3x4**: Navigasi D-Pad remote TV yang nyaman (tombol 5 memiliki status highlight aktif warna putih kontras tinggi).
- **Tombol Bantuan**: `RESET`, `HAPUS`, petunjuk navigasi remote, serta info PIN default (`8888`).

---

## 💾 File Desain Asli Tersimpan

- File Proyek FigCraft: [`tmbilling_tv_kiosk.figcraft`](tmbilling_tv_kiosk.figcraft)
- File Format Figma Interchange: [`tmbilling_tv_kiosk.fig`](tmbilling_tv_kiosk.fig)
- Gambar Tangkapan Layar HD:
  - [`screen1_standby.png`](screen1_standby.png)
  - [`screen2_active.png`](screen2_active.png)
  - [`screen3_setup.png`](screen3_setup.png)
  - [`screen4_pin.png`](screen4_pin.png)

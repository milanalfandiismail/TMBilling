# TMBilling Game Launcher - Panduan Spesifikasi Desain UI/UX (GPUI Rust)

Dokumen ini disusun sebagai panduan spesifikasi dan acuan visual bagi implementasi antarmuka klien GPUI Rust (`WarnetAgent/TMBilling/`).

Berkas desain visual resmi hasil ekspor dari FigCraft tersimpan di folder ini:
- **Dokumen Proyek FigCraft**: [`TMBilling_Launcher_Design.figcraft`](file:///C:/Project%20GIT/TMBilling/docs/design/launcher/TMBilling_Launcher_Design.figcraft)
- **Ekspor Gambar 1080p (FHD)**: [`TMBilling_Launcher_1920x1080.png`](file:///C:/Project%20GIT/TMBilling/docs/design/launcher/TMBilling_Launcher_1920x1080.png)
- **Ekspor Gambar 2K (QHD)**: [`TMBilling_Launcher_2560x1440.png`](file:///C:/Project%20GIT/TMBilling/docs/design/launcher/TMBilling_Launcher_2560x1440.png)
- **Ekspor Gambar HD Ready**: [`TMBilling_Launcher_1366x768.png`](file:///C:/Project%20GIT/TMBilling/docs/design/launcher/TMBilling_Launcher_1366x768.png)
- **Ekspor Gambar 4:3 Klasik**: [`TMBilling_Launcher_1024x768.png`](file:///C:/Project%20GIT/TMBilling/docs/design/launcher/TMBilling_Launcher_1024x768.png)

---

## 1. Aturan Warna & Design Tokens GPUI
Sesuai `WarnetAgent/TMBilling/src/theme.rs`:
- **Background Utama**: `#050505` (Black depth)
- **Surface Bar (Navbar & Footer)**: `#0A0A0A`
- **Card Background**: `#0C0C0C`
- **Border Default**: `#1C1C1C` (1px solid)
- **Border Strong / Separator**: `#2A2A2A`
- **Cover Image Placeholder Background**: `#141414`
- **Text Primary**: `#E5E5E5`
- **Text Secondary / Muted**: `#A3A3A3`
- **Text Dim / Placeholder**: `#737373`
- **Aksen Utama**: `#34D399` (Emerald 400 - TM Brand & Active states)

---

## 2. Struktur Layout (Vertikal)

### A. Top Navbar (`height: 68px`)
- **Padding horizontal**: Sesuai resolusi (24px s.d. 64px)
- **Border bawah**: 1px `#1C1C1C`
- **Komponen**:
  1. **Brand Kiri**: Badge hijau `#34D399` (32x32px, radius 6px) + Teks `TM LAUNCHER` (Bold, 13px, `#E5E5E5`).
  2. **Search Bar Tengah**: Input box (`height: 38px`, radius 6px, bg `#0C0C0C`, border `#1C1C1C`). Ikon `🔍` + placeholder `Cari game atau aplikasi (1 - Z)...`.
  3. **Countdown Kanan**: Capsule box (`height: 34px`, border `#1C1C1C`, bg `#0C0C0C`), indikator online `●` `#34D399` + hitungan waktu `03 : 24 : 15`.

### B. Sub-Header Controls (`height: 34px`)
- **Segmented Filter Tipe (Kiri)**:
  - Container capsule: `#0C0C0C`, border `#1C1C1C`, height 32px.
  - Pilihan:
    - `[ Semua ]` *(Default State: Active bg `#34D399`, text `#050505`)*
    - `[ Game ]` *(Inactive: text `#A3A3A3`)*
    - `[ Aplikasi ]` *(Inactive: text `#A3A3A3`)*
- **Counter Info (Kanan)**: Teks info jumlah item dan resolusi aktif (contoh: `21 Item (1 - Z) · 1920x1080`).

### C. Grid Poster Cards (Urutan 1 - Z)
- **Format Rasio Poster**: Rasio vertikal ramping ~2:3 (Steam Portrait Cover).
- **Struktur Tiap Kartu (2-Tier Vertical Layout)**:
  1. **Top Poster Cover (`Image fill`)**:
     - Sudut atas membulat (radius 8px), border bawah pemisah `#1C1C1C`.
     - Monogram watermark saat gambar belum dimuat / cover gambar asli saat sudah ada (contoh: poster GTA V).
  2. **Bottom Label & Action Bar (`height: 68px s.d. 88px`)**:
     - **Baris 1**: Judul Game / Aplikasi (Bold, `#E5E5E5`, lebar penuh tanpa terpotong).
     - **Baris 2**: Tombol aksi dedicated penuh (`Width: 100%`, `height: 24px-26px`, border `#34D399`):
       - `▶ MAIN` (untuk item tipe Game)
       - `▶ BUKA` (untuk item tipe Aplikasi)

### D. Bottom Footer Dock (`height: 44px`)
- Border atas 1px `#1C1C1C`, background `#0A0A0A`.
- **Kiri**: Teks identitas versi ringkas `TMBilling v2.0` (`#737373`).
- **Kanan**: Identitas unit klien `PC-07` (`#737373`).

---

## 3. Matriks Ukuran & Responsivitas Grid Desktop

| Resolusi | Grid (Kolom × Baris) | Ukuran Card (W × H) | Tinggi Cover Poster | Tinggi Label Bar |
| :--- | :--- | :--- | :--- | :--- |
| **`1024 x 768` (XGA)** | 6 kolom × 2 baris | `146 x 262 px` | `194 px` | `68 px` |
| **`1366 x 768` (HD)** | 8 kolom × 2 baris | `148 x 262 px` | `194 px` | `68 px` |
| **`1920 x 1080` (FHD)** | 9 kolom × 2 baris | `186 x 380 px` | `302 px` | `78 px` |
| **`2560 x 1440` (2K QHD)** | 10 kolom × 2 baris | `226 x 490 px` | `402 px` | `88 px` |

> *Catatan Implementasi GPUI*: Gunakan auto-flow grid flex wrap atau uniform list GPUI dengan breakpoint lebar viewport window untuk menentukan jumlah kolom dinamis.

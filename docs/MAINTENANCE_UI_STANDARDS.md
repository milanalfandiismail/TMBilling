# 🎨 Standar UI Component & Styling TMBilling

Dokumen ini mencatat pedoman desain dan ukuran komponen (font, padding, borders, dll) yang harus diterapkan secara konsisten pada Tab Perawatan dan Tab Laporan Perawatan agar selaras dengan tab lain (seperti Tab Paket dan Member).

---

## 🕋 1. Card & Container
Semua card utama penampung konten menggunakan spesifikasi berikut:
- **Background**: `#111`
- **Border**: `border-[#1f1f1f]` (1px solid)
- **Rounded Corners**: `rounded-xl`
- **Padding**: `p-5`
- **Spacing antar Card**: `space-y-6`

---

## 🔤 2. Tipografi (Font Sizes & Weights)
- **Judul Utama Card (Header)**:
  - Class: `text-sm lg:text-[22px] font-bold text-neutral-100 tracking-wide`
- **Sub-judul / Penjelasan**:
  - Class: `text-[10px] lg:text-base text-neutral-500 mt-0.5`
- **Judul Section / Sub-Card**:
  - Class: `text-xs lg:text-[22px] font-bold text-neutral-400 uppercase tracking-wider`
- **Judul Grup Tabel / Kategori**:
  - Class: `text-xs lg:text-base font-bold text-neutral-300 tracking-wider uppercase`
- **Teks Tabel / Data**:
  - Font size: `text-xs lg:text-base`
  - Font family (untuk tanggal/angka/biaya): `font-mono`

---

## 🔘 3. Tombol (Buttons)
- **Tombol Utama (Primary Action - Tambah/Lapor)**:
  - Class: `px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2`
- **Tombol Sekunder (Secondary/Search)**:
  - Class: `px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors`
- **Tombol Batal / Reset / Refresh**:
  - Class: `px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:text-base font-bold rounded-lg transition-colors`
- **Tombol Aksi Tabel / Icon**:
  - Class: `w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors`
- **Tombol Aksi Tabel Perawatan (Text Buttons)**:
  - Class: `px-3.5 py-1.5 rounded-lg text-xs lg:text-sm font-bold transition-colors` (e.g. untuk tombol "Proses", "Selesaikan", "Hapus")

---

## 📥 4. Input & Dropdown Select
- **Styling Input Teks & Dropdown**:
  - Class: `px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500`
- **Lebar Input Cari (Search)**:
  - Class: `w-40`

---

## 🔄 5. Spinners & Loader
- **Loading Spinner**:
  - Class: `<div class="w-6 h-6 border-2 border-[#2a2a2a] border-t-neutral-100 rounded-full animate-spin"></div>`
  - Di-center dengan container: `flex justify-center py-10`

---

## 🛠️ 6. Kompilasi Local Tailwind CSS
Ketika melakukan perubahan pada class Tailwind di file HTML template (`.html`) atau file JavaScript (`.js`), class baru tersebut harus di-build secara lokal agar masuk ke file stylesheet utama:

- **Command Build (Produksi / Minified)**:
  ```bash
  cmd.exe /c "npm run build:css"
  ```
  atau jika PowerShell diijinkan:
  ```powershell
  npm run build:css
  ```

- **Command Watcher (Development)**:
  ```bash
  cmd.exe /c "npm run dev:css"
  ```
  atau jika PowerShell diijinkan:
  ```powershell
  npm run dev:css
  ```

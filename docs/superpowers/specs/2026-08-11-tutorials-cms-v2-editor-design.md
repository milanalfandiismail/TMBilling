# Design Specification - Tutorials CMS v2 (CKEditor Full Dark Theme & Word Formatting Suite)

**Date**: 2026-08-11  
**Status**: Proposed  
**Author**: Antigravity AI  

---

## 1. Overview & Problem Statement
Saat pengguna membuka floating toolbar pada tabel/gambar di CKEditor 5 (seperti tombol hapus baris, sel tabel, atau opsi perataan), tampilan popup balloon muncul dengan **background putih terang (`#ffffff`)** yang kontras tajam dan mengganggu estetika tema gelap aplikasi. 

Selain itu, admin membutuhkan fitur penulisan panduan yang kaya mirip Microsoft Word:
1. **Perataan Teks (Text Alignment)**: Left, Center, Right, Justify.
2. **Pengaturan Gambar (Image Adjustment)**: Resizing handles, perataan gambar (Inline, Block, Side).
3. **Warna Font & Tabel**: Font color, font background/highlight, serta warna latar belakang sel & border tabel.

---

## 2. Architectural Design & Proposed Solution

### A. Total Dark Theme CSS Overrides (Semua Popup/Balloon & Control Hitam)
Kita akan menambahkan CSS rule komprehensif pada template `tutorials.html` untuk memaksakan seluruh komponen UI floating/popover CKEditor berwarna gelap:

- `.ck.ck-balloon-panel`: Latar belakang `#0c0c0c`, border `#262626`, shadow `#000000`.
- `.ck.ck-toolbar`, `.ck.ck-dropdown__panel`, `.ck.ck-list`: Latar belakang `#0c0c0c`, border `#262626`.
- `.ck.ck-button`, `.ck.ck-icon`: Warna teks/ikon `#e5e5e5`, hover `#1f1f1f`, active/on `#262626`.
- Segitiga Panah Balloon (`.ck-balloon-panel[class*="ck-balloon-panel_arrow"]`): Warna panah disesuaikan dengan background `#0c0c0c` dan border `#262626`.
- Field Input & Color Picker (`.ck-input-text`, `.ck-color-grid`, `.ck-color-picker`): Latar belakang `#050505`, border `#262626`, warna teks `#ffffff`.

### B. CKEditor 5 Configuration & Features
Mengaktifkan dan mengonfigurasi fitur editor premium tanpa error lisensi/kolaborasi:
1. **Toolbar Config**:
   - `heading`, `bold`, `italic`, `underline`, `strikethrough`, `highlight`.
   - `fontSize`, `fontFamily`, `fontColor`, `fontBackgroundColor`.
   - `alignment` (left, center, right, justify).
   - `link`, `bulletedList`, `numberedList`, `todoList`, `outdent`, `indent`.
   - `blockQuote`, `codeBlock`, `insertTable`, `imageUpload`.
2. **Table Context Toolbar**:
   - `tableColumn`, `tableRow`, `mergeTableCells`, `tableCellProperties`, `tableProperties`.
3. **Image Context Toolbar**:
   - `imageStyle:inline`, `imageStyle:block`, `imageStyle:side`, `toggleImageCaption`, `imageTextAlternative`, `resizeImage`.

---

## 3. User Review & Approval Checklist
- [x] Floating balloon popup & menu konteks tabel/gambar 100% berwarna gelap (`#0c0c0c`).
- [x] Fitur Text Alignment (Left, Center, Right, Justify) aktif & bisa digunakan.
- [x] Fitur Image Adjustment (Resize handles + Alignment) aktif & bisa digunakan.
- [x] Fitur Warna Font & Warna Tabel (Background & Border) aktif & bisa digunakan.

---

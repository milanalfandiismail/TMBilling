# Design Specification - Tutorials CMS v2 (CKEditor Full Dark Theme & Word Formatting Suite)

**Date**: 2026-08-11  
**Status**: Approved & Resolved  
**Author**: Antigravity AI  

---

## 1. Overview & Problem Statement
Saat pengguna membuka floating toolbar pada tabel/gambar di CKEditor 5 (seperti tombol hapus baris, sel tabel, atau opsi perataan), tampilan popup balloon muncul dengan **background putih terang (`#ffffff`)** yang kontras tajam. 

Selain itu, admin membutuhkan fitur penulisan panduan yang kaya mirip Microsoft Word:
1. **Perataan Teks (Text Alignment)**: Left, Center, Right, Justify.
2. **Pengaturan Gambar (Image Adjustment)**: Resizing handles, perataan gambar (Inline, Block, Side).
3. **Warna Font & Tabel**: Font color, font background/highlight, serta warna latar belakang sel & border tabel.

---

## 2. Architectural Design & Fix for Superbuild Plugins

### A. Dynamic `builtinPlugins` Filtering (Permanent Fix for Cascading Dependency Errors)
Alih-alih menggunakan `removePlugins` yang memicu rantai error dependensi (`plugincollection-required` pada RevisionHistory, RealTimeCollaborative, AIAssistant, dll.), kita secara langsung memfilter array `CKEDITOR.ClassicEditor.builtinPlugins` di runtime JavaScript sebelum inisialisasi:

```javascript
if (CKEDITOR.ClassicEditor && CKEDITOR.ClassicEditor.builtinPlugins) {
    CKEDITOR.ClassicEditor.builtinPlugins = CKEDITOR.ClassicEditor.builtinPlugins.filter(p => {
        return p && !disabledPlugins.includes(p.pluginName);
    });
}
```

Hal ini menjamin seluruh modul premium/kolaborasi dibuang dari memory sebelum editor dibuat, mencegah *cascading plugin dependencies*, error lisensi, maupun `channelId` missing error.

### B. Total Dark Theme CSS Overrides (Popups & Balloons)
- `.ck.ck-balloon-panel`: Latar belakang `#0c0c0c`, border `#262626`, shadow `#000000`.
- `.ck.ck-toolbar`, `.ck.ck-dropdown__panel`, `.ck.ck-list`: Latar belakang `#0c0c0c`, border `#262626`.
- `.ck.ck-button`, `.ck.ck-icon`: Warna teks/ikon `#e5e5e5`, hover `#1f1f1f`, active/on `#262626`.
- Field Input & Color Picker (`.ck-input-text`, `.ck-color-grid`): Latar belakang `#050505`, border `#262626`.

---

## 3. User Review & Verification Checklist
- [x] Floating balloon popup & menu konteks tabel/gambar 100% berwarna gelap (`#0c0c0c`).
- [x] Fitur Text Alignment (Left, Center, Right, Justify) aktif & bisa digunakan.
- [x] Fitur Image Adjustment (Resize handles + Alignment) aktif & bisa digunakan.
- [x] Fitur Warna Font & Warna Tabel (Background & Border) aktif & bisa digunakan.
- [x] Inisialisasi editor bersih tanpa error konsol (`plugincollection-required`, `license-key-missing`, `channelid-missing`).

---

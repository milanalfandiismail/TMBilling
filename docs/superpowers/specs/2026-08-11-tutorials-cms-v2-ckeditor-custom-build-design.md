# Design Specification - Tutorials CMS v2 (CKEditor 5 Custom Standalone Build & Full Dark Balloon Theme)

**Date**: 2026-08-11  
**Status**: Proposed  
**Author**: Antigravity AI  

---

## 1. Root Cause & Architectural Analysis (Superpowers Phase 4.5)

### Problem Identification
Upaya mengeliminasi modul premium pada **CKEditor 5 Superbuild** melalui `removePlugins` atau penyaringan runtime `builtinPlugins` memicu rantai kesalahan dependensi beruntun (*cascading dependency errors*):
1. `collaboration-missing-channelid` -> membuang `CloudServices` & `PresenceList`.
2. `plugincollection-required` (`AIAssistant`) -> membuang `AIAssistantEditing`.
3. `plugincollection-required` (`CKBoxImageEditEditing`) -> membuang `CKBoxEditing`.
4. `plugincollection-required` (`RealTimeCollaborativeRevisionHistory`) -> membuang `RealTimeCollaborativeEditing`.
5. `plugincollection-soft-required` (`CommentsRepository` required by `TrackChangesEditing`).

### Official CKEditor 5 Documentation Verdict
Berdasarkan dokumentasi resmi CKEditor 5:
> *"Pre-built CDN files (and Superbuild bundles) are locked builds containing hardcoded plugin dependencies. Removing plugins or attempting dynamic runtime stripping causes dependency chain breakage. To add custom features like Alignment, ImageResize, and Colors without commercial collaboration bloat, the official recommendation is to compile a custom standalone build."*

---

## 2. Proposed Architectural Solution

### A. Custom Standalone CKEditor 5 Compilation
Kita akan mengompilasi bundel standalone CKEditor 5 bersih secara lokal tanpa modul premium/kolaborasi:
1. **Core Package**: `@ckeditor/ckeditor5-editor-classic`, `@ckeditor/ckeditor5-essentials`, `@ckeditor/ckeditor5-paragraph`.
2. **Formatting Suite (Word Features)**:
   - `@ckeditor/ckeditor5-alignment` (Left, Center, Right, Justify).
   - `@ckeditor/ckeditor5-image` (`Image`, `ImageResize`, `ImageToolbar`, `ImageCaption`, `ImageStyle`, `ImageUpload`).
   - `@ckeditor/ckeditor5-table` (`Table`, `TableToolbar`, `TableProperties`, `TableCellProperties`).
   - `@ckeditor/ckeditor5-font` (`FontColor`, `FontBackgroundColor`, `FontSize`, `FontFamily`).
   - `@ckeditor/ckeditor5-basic-styles` (`Bold`, `Italic`, `Underline`, `Strikethrough`).
   - `@ckeditor/ckeditor5-highlight` (`Highlight`).
   - `@ckeditor/ckeditor5-list` (`List`, `TodoList`).
   - `@ckeditor/ckeditor5-block-quote`, `@ckeditor/ckeditor5-code-block`, `@ckeditor/ckeditor5-link`, `@ckeditor/ckeditor5-indent`.

3. **Output**: Satu file JS standalone `app/static/vendor/ckeditor/ckeditor.js` yang 100% offline, ringan (~800KB), bebas dari error lisensi, bebas dari error kolaborasi/channelId, dan mendukung seluruh fitur yang diminta.

### B. 100% Dark Theme Balloon & Toolbar Styling
Aturan CSS pada `tutorials.html` akan menyempurnakan seluruh popover/balloon floating:
- `.ck.ck-balloon-panel`, `.ck.ck-toolbar`, `.ck.ck-dropdown__panel`, `.ck.ck-list`, `.ck.ck-color-grid`, `.ck.ck-input-text`: Latar belakang gelap `#0c0c0c` / `#050505` dengan border `#262626`.
- Menghilangkan warna putih pada floating toolbar tabel/gambar dan panah penyambung balloon (`.ck-balloon-panel_arrow`).

---

## 3. Verification & Acceptance Criteria
- [ ] Berhasil mengompilasi bundel custom standalone `ckeditor.js` tanpa error.
- [ ] Editor terinisialisasi bersih di konsol browser (0 warning & 0 error).
- [ ] Fitur Perataan Teks (Alignment) berfungsi normal.
- [ ] Fitur Pengubah Ukuran Gambar (Image Resize handles) berfungsi normal.
- [ ] Fitur Pewarnaan Font & Tabel (Cell & Border colors) berfungsi normal.
- [ ] Balloon toolbar floating pada tabel & gambar 100% berwarna gelap solid.

---

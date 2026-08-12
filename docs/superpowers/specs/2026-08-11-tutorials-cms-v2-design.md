# Design Spec: Tutorials CMS v2 (CKEditor Fix, Table Borders, Image Resizing, Fullscreen Modal & Dynamic Categories)

**Date:** 2026-08-11  
**Status:** Draft / User Review Required  

---

## 🎯 Objectives

1. **CKEditor 5 Reliability & Full Feature Set**:
   - Resolve initialization failure in CKEditor 5.
   - Restore robust offline ClassicEditor build with image uploading, table creation, list styling, formatting, and text alignment capabilities.
   - Enable Image Resizing & responsive scaling (`max-width: 100%`).

2. **Table Border Contrast Fix**:
   - Update table styling in dark mode (`.prose table` and `.ck-content table`).
   - Change dark/invisible borders to high-contrast visible borders (`#3d3d3d` / `rgba(255,255,255,0.2)`) with clean padding, header background (`#1a1a1a`), and hover states so tables are crisp and clear on black backgrounds.

3. **True Fullscreen Modal Layout**:
   - Expand `#modal-tutorial-editor` to span true full width & height (`w-full max-w-[98vw] h-[96vh] sm:h-[98vh]`), maximizing screen space for desktop while maintaining 100% mobile HP responsiveness (`p-2 sm:p-4`).

4. **Dynamic Category Dropdown System**:
   - Replace standard text input for Category with a smart custom searchable Dropdown / Select component.
   - Automatically fetch unique categories via `GET /api/v1/kasir/tutorials/categories`.
   - Allow selecting from existing categories or creating a new category on the fly via `➕ Kategori Baru`.
   - Scrollable dropdown list (`max-h-60 overflow-y-auto`) to handle 20+ categories cleanly on all devices including mobile HPs.

---

## 🏗️ Architecture & Component Design

### 1. Backend (`app/services/tutorial/tutorial_service.py` & `tutorial_routes.py`)
- **New API Route**: `GET /api/v1/kasir/tutorials/categories`
  - Returns JSON list of unique categories sorted alphabetically: `["Cloudflare & VNC", "Jaringan", "Umum", ...]`.

### 2. Frontend Modal (`app/templates/kasir/tabs/tutorials.html`)
- **Modal Dimensions**:
  - Modal overlay: `fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4`
  - Modal container: `bg-[#0c0c0c] border border-[#262626] w-full max-w-[98vw] h-[96vh] rounded-lg overflow-hidden shadow-2xl flex flex-col`
- **Category Select Field**:
  - Combined select & custom category input:
    - Dropdown `<select id="tutorial-category-select">` dynamically populated from API.
    - Option: `[+ Tambah Kategori Baru]`.
    - When `+ Tambah Kategori Baru` is selected, an input field `#tutorial-new-category-input` appears so the admin can type a new category name.

### 3. CKEditor 5 Script & CSS Overrides (`tutorials.html` & `tutorials/index.js`)
- Re-install verified stable local CKEditor 5 build in `app/static/vendor/ckeditor/ckeditor.js`.
- Custom CSS Overrides:
  - Table borders: `border: 1px solid #3d3d3d !important;`
  - Table headers: `background-color: #1a1a1a !important; color: #ffffff !important; font-weight: bold;`
  - Table rows: `border-bottom: 1px solid #2a2a2a !important;`
  - Image resizing handles & container responsive rules.

---

## 🧪 Verification Plan

1. **Automated Integration Tests**:
   - Test `GET /api/v1/kasir/tutorials/categories` returns unique categories array.
   - Test CRUD operations for tutorials with new categories.
2. **Manual & UI Verification**:
   - Open editor modal on desktop and mobile viewport sizes: verify modal spans 98vw/96vh.
   - Test creating a table in CKEditor: verify white/contrast borders are clearly visible against black background.
   - Test selecting category from dropdown and creating a new category: verify new category appears in list.
   - Verify image uploading and resizing.

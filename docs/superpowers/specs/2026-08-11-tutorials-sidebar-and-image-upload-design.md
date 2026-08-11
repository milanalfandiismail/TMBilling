# Design Specification: Main Sidebar Tutorial Tab & CKEditor 5 Image Upload

> **Date:** 2026-08-11  
> **Status:** Approved  
> **Author:** Antigravity AI & User  

---

## 1. Goal & Requirements

Pembaruan ini bertujuan untuk:
1. Memindahkan **Dokumentasi & Tutorial** dari subtab Pengaturan ke **Menu Utama Sidebar Paling Bawah** (`#tab-tutorials`).
2. Menyetarakan **UI/UX Aesthetics & Card Component** dengan standar desain gelap TMBilling agar 100% konsisten secara visual.
3. Menambahkan **Fitur Upload Gambar CKEditor 5** sehingga Admin dapat mengunggah screenshot/gambar langsung ke artikel panduan.

---

## 2. Architecture & Design Details

### 2.1 Main Sidebar Navigation
- Navigation item di [`sidebar.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html) di bagian paling bawah:
  ```html
  <button onclick="App.switchTab('tutorials')" data-tab="tutorials" ...>
      📚 <span>Dokumentasi & Tutorial</span>
  </button>
  ```
- ID Tab Utama: `tab-tutorials` (`app/templates/kasir/tabs/tutorials.html` - terpisah dari `settings.html`).

### 2.2 Image Upload Endpoint & Storage
- Storage Folder: `app/static/assets/tutorials/`
- Endpoint: `POST /api/v1/kasir/tutorials/upload-image`
- Header: `@login_required`, `@admin_required`
- Payload: Multipart form file (`upload` field per CKEditor standard upload adapter interface)
- Response JSON: `{ "url": "/static/assets/tutorials/<filename>.png" }`

### 2.3 CKEditor 5 Image Upload Adapter Integration
- Custom Upload Adapter JS function in `app/static/js/kasir/modules/tutorials/index.js` or `settings/index.js`.
- Intercepts file uploads in CKEditor 5, uploads to `/api/v1/kasir/tutorials/upload-image`, and inserts `<img src="..." />` into the editor DOM.

---

## 3. Component UI/UX Consistency
- Title Bar: Standard `App.updatePageTitle('tutorials')` -> `"Dokumentasi & Tutorial"`.
- Tab Content Container: `<div id="tab-tutorials" class="tab-content hidden space-y-6">`
- Article Render: `prose prose-invert max-w-none text-neutral-300` with styled `img` tags (`rounded-xl border border-[#262626] shadow-lg my-4`).

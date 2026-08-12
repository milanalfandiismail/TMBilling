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
- Navigation item di [`sidebar.html`](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html) di posisi paling bawah:
  ```html
  <button onclick="App.switchTab('tutorials')" data-tab="tutorials"
      class="tab-btn w-full flex items-center gap-3 px-3 py-2 rounded text-[13px] font-semibold text-neutral-400 hover:text-neutral-100 hover:bg-[#121212] transition-all text-left">
      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
      </svg>
      <span>Dokumentasi & Tutorial</span>
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

## 3. Component UI/UX Consistency (Matching Umum & Keamanan)

Untuk menjamin 100% konsistensi visual dengan tab **Umum & Keamanan**:
- **Title Header**: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`
- **Sub-header / Deskripsi**: `text-[9px] lg:text-base text-neutral-500 mt-1`
- **Tombol / Badges**: `text-xs lg:text-base font-bold rounded transition-colors`
- **Card Container**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 space-y-4`
- **Artikel Prose**: `prose prose-invert max-w-none text-xs lg:text-base text-neutral-300 leading-relaxed` dengan gambar `rounded border border-[#262626] shadow-lg max-w-full my-4`.

---

## 4. Port Correction (5000 to 7015)
- Port bawaan TMBilling adalah **`7015`** (bukan `5000`). Semua file dokumentasi (seperti `docs/FEATURE_CLOUDFLARE_TUNNEL.md`, `app/services/tutorial/tutorial_service.py` seed data) wajib diperbarui dari port `5000` ke `7015` agar petunjuk konfigurasi akurat.
- Port VNC tetap `5900` dan WebSocket VNC tetap `8081`.

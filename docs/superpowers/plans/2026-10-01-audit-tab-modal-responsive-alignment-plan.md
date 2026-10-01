# Penyelarasan Seluruh Tab & Modal Berdasarkan Acuan Umum & Keamanan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan seluruh komponen UI, tipografi, form input, kartu (*cards*), tombol (*action buttons*), dan jendela dialog modal pada seluruh tab kasir & admin TMBilling agar 100% konsisten dengan standar acuan tab **"Umum & Keamanan"** (`subtab-general`), dengan fokus khusus pada skala responsif breakpoint **`lg` (1024px), `xl` (1280px), dan `2xl` (1536px)** sesuai Tailwind CSS.

**Architecture:**
1. **Design System Tokens (Acuan `subtab-general`)**:
   - **Card Container**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6`
   - **Card Heading (H3 / Header)**: `text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider mb-4`
   - **Form Label**: `text-xs lg:max-xl:text-sm xl:text-[22px] text-neutral-400 uppercase font-bold tracking-wider block` (atau `text-xs lg:max-xl:text-sm xl:text-base`)
   - **Help / Subtext**: `text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 mt-1` & `text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-0.5 font-normal font-sans`
   - **Form Input / Select / Textarea**: `px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:max-xl:text-xs xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-500`
   - **Primary Action Button**: `px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors flex items-center`
   - **Secondary / Ghost Button**: `px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors`
   - **Modal Dialog Box**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-5 sm:p-6 shadow-2xl relative text-xs lg:max-xl:text-xs xl:text-base`
2. **Breakpoints Target**:
   - `lg` (1024px - 1279px via `lg:max-xl:`)
   - `xl` (1280px - 1535px via `xl:`)
   - `2xl` (1536px+ via `2xl:`)

**Tech Stack:** TailwindCSS, Jinja2 Templates, Vanilla JavaScript Kasir SPA.

---

### Task 1: Penyelarasan Tab Operasional & Master (Tournament, Menu/POS, Catatan, Game)

**Files:**
- Modify: `app/templates/kasir/tabs/tournament.html`
- Modify: `app/templates/kasir/tabs/menu.html`
- Modify: `app/templates/kasir/tabs/catatan.html`
- Modify: `app/templates/kasir/tabs/game.html`

- [x] **Step 1: Selaraskan `tournament.html`**
  - Ubah header turnamen, form buat turnamen, input nama tim/game, dan tombol simpan bracket ke skala `lg:max-xl:` dan `xl:`.
- [x] **Step 2: Selaraskan `menu.html` (POS Kantin)**
  - Terapkan standar acuan pada form modal menu, card keranjang F&B, badge kategori, dan input pencarian menu.
- [x] **Step 3: Selaraskan `catatan.html`**
  - Terapkan skala responsif pada form tambah catatan shift, textarea, filter waktu, dan kartu riwayat catatan.
- [x] **Step 4: Selaraskan `game.html`**
  - Terapkan skala responsif pada form modal tambah/edit game, file picker, input nama/kategori, dan action buttons.

---

### Task 2: Penyelarasan Tab Monitoring, Hardware & Remote (Remote Server, Screenshot, Dashboard)

**Files:**
- Modify: `app/templates/kasir/tabs/remote_server.html`
- Modify: `app/templates/kasir/tabs/screenshot.html`
- Modify: `app/templates/kasir/tabs/dashboard.html`

- [x] **Step 1: Selaraskan `remote_server.html`**
  - Update 23 tombol perintah remote (shutdown, restart, lock, task manager, service reboot, command terminal) dan input terminal ke skala responsif `lg:max-xl:text-xs xl:text-base`.
- [x] **Step 2: Selaraskan `screenshot.html`**
  - Update dropdown filter unit PC, tombol refresh screenshot, dan metadata timestamp preview.
- [x] **Step 3: Selaraskan `dashboard.html`**
  - Update toolbar filter status, search input PC, dan counter status billing di atas grid PC.

---

### Task 3: Penyelarasan Partial Settings (Plugins & Whitelist IP)

**Files:**
- Modify: `app/templates/kasir/settings/plugins.html`
- Modify: `app/templates/kasir/settings/whitelist_ip.html`

- [x] **Step 1: Selaraskan `plugins.html`**
  - Terapkan card container `bg-[#0c0c0c] border border-[#1c1c1c]`, judul card responsif, toggle plugin, dan tombol upload ekstensi.
- [x] **Step 2: Selaraskan `whitelist_ip.html`**
  - Terapkan skala responsif pada form input IP client/kasir, label helper text, dan tabel daftar IP yang diizinkan.

---

### Task 4: Penyelarasan Seluruh Modal Dialog (HTML & Dynamic JS Modals)

**Files:**
- Modify: `app/templates/kasir/components/modals.html`
- Modify: `app/static/js/kasir/components/modal-tambah.js`
- Modify: `app/static/js/kasir/components/modal-confirm-tambah.js`
- Modify: `app/static/js/kasir/core/modal.js`

- [x] **Step 1: Selaraskan Modal Statis di `modals.html`**
  - Update `modalStruk` (cetak struk transaksi) dan `modal-backup` (pilihan backup server/lokal) dengan skala responsif font dan tombol yang nyaman di layar besar.
- [x] **Step 2: Selaraskan Modal Tambah Billing di `modal-tambah.js`**
  - Update dropdown paket, input kustom durasi/nominal, label ringkasan total, dan tombol simpan billing.
- [x] **Step 3: Selaraskan Modal Konfirmasi di `modal-confirm-tambah.js` dan `modal.js`**
  - Update `Modal.confirm` dan `Modal.alert` dengan tipografi responsif `text-xs lg:max-xl:text-xs xl:text-base` dan tombol konfirmasi yang seragam.

---

### Task 5: Rebuild CSS, Automated Testing & Validasi MCP Codebase Memory

**Files:**
- Output: `app/static/css/tailwind.css`

- [x] **Step 1: Jalankan build Tailwind CSS**
  - Run `npm run build:css` dan pastikan seluruh utility class baru terkompilasi.
- [x] **Step 2: Jalankan automated unit tests pytest**
  - Run `.venv\Scripts\python -m pytest` untuk memverifikasi tidak ada regresi route dan template rendering.
- [x] **Step 3: Re-index & Verifikasi MCP `codebase-memory`**
  - Jalankan tool `index_repository` dan `search_code` untuk memvalidasi seluruh perbaikan di memory graph.

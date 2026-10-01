# Plan Penyederhanaan Sidebar Server (Direct Kantin & Game/Turnamen)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyederhanakan sidebar navigasi server kasir/admin dengan menghilangkan submenu bertingkat "Operasional & POS", menjadikan menu Kantin sebagai tombol langsung (direct top-level), dan menggabungkan Turnamen ke dalam dropdown "Game & Turnamen".

**Architecture:**
1. Template `sidebar.html`: Menempatkan tombol "Kantin / POS" langsung sebagai menu level utama.
2. Template `sidebar_kasir.html`: Menghapus dropdown `operasional`, memindahkan "Log Stok Menu" ke dalam kelompok "Laporan Keuangan".
3. Template `sidebar_admin.html`: Mengubah grup "Katalog Game" menjadi "Game & Turnamen" dan memasukkan tab "Turnamen" (`tournament`) ke dalamnya.
4. Script `app.js`: Memperbarui objek pemetaan `tabToSubmenu` dan daftar `submenus` agar sinkronisasi active tab dan expand/collapse submenu tetap presisi.

**Tech Stack:** Jinja2 HTML Templates, Vanilla JavaScript, TailwindCSS

---

### Task 1: Update Template Sidebar

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`
- Modify: `app/templates/kasir/components/sidebar_kasir.html`
- Modify: `app/templates/kasir/components/sidebar_admin.html`

- [ ] **Step 1: Tambahkan tombol direct "Kantin / POS" pada `sidebar.html`**
- [ ] **Step 2: Hapus dropdown `operasional` dan tempatkan `menu_stock_log` di grup `laporan` pada `sidebar_kasir.html`**
- [ ] **Step 3: Perbarui grup `game` menjadi "Game & Turnamen" dan tambahkan tab `tournament` pada `sidebar_admin.html`**

---

### Task 2: Update Script Navigasi `app.js`

**Files:**
- Modify: `app/static/js/kasir/app.js`

- [ ] **Step 1: Perbarui pemetaan `tabToSubmenu` (`tournament: 'game'`, `menu_stock_log: 'laporan'`)**
- [ ] **Step 2: Hapus `'operasional'` dari array `submenus` pada `switchTab`**

---

### Task 3: Build Asset & Verifikasi

**Files:**
- Modify/Build: `npm run build:css`
- Test: Pytest suite

- [ ] **Step 1: Jalankan `npm run build:css`**
- [ ] **Step 2: Jalankan pytest suite UI dan integrasi**
- [ ] **Step 3: Update index MCP `codebase-memory`**

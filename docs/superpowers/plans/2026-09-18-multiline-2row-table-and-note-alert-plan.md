# Implementation Plan: 2-Row Multi-Line Table Columns & Unified Catatan Alert Button

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform wide, clipped table columns across 7 key management pages into compact 2-row multi-line cells and unify the save/status alert button in Catatan.

**Architecture:** Update HTML `<thead>` structures and client-side JavaScript `render()` loops across Kasir Dashboard tabs to group related data into 2-row table cells with Tailwind utility classes (`flex flex-col`, font styling, and badges). Reconfigure Catatan's save button to dynamically act as the unified alert notification.

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+), Tailwind CSS v3.

## Global Constraints
- **Zero Dashboard Touch**: `dashboard.html`, `dashboard_compact.js`, `dashboard_detail_modal.js`, and `app/templates/kasir/index.html` must remain 100% untouched.
- **Dual-Screen Compatibility**: All updated 2-row cell layouts must render cleanly on 1024px (`lg:max-xl:`) and 1920px (`xl:`/`2xl:`).
- **Preserve Mobile**: Base mobile layouts (`<sm`, `sm:`, `md:`) remain fully functional.

---

### Task 1: Laporan Kantin / F&B 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/laporan_menu.html`
- Modify: `app/static/js/kasir/modules/laporan_menu/index.js`

- [ ] **Step 1: Update `laporan_menu.html` table header**
  - Condense `<thead>` columns into 5 columns: `Waktu & Nota`, `Item Menu & Qty`, `Total & Bayar/Kembali`, `Metode & Pemesanan`, `Kasir & Aksi`.
- [ ] **Step 2: Update `laporan_menu/index.js` render() function**
  - Render 2-row structured cells for each column.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 2: Laporan Perawatan 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/laporan_maintenance.html`
- Modify: `app/static/js/kasir/modules/laporan_maintenance/index.js`

- [ ] **Step 1: Update `laporan_maintenance.html` table header**
  - Update `<thead>` to: `PC & Tanggal`, `Kategori & Biaya`, `Detail Masalah & Resolusi`.
- [ ] **Step 2: Update `laporan_maintenance/index.js` renderReport() function**
  - Format ticket rows into 2-row cells.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 3: Pelacak Statistik PC (Uptime Tracker) 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/uptime.html`
- Modify: `app/static/js/kasir/modules/uptime/index.js`

- [ ] **Step 1: Update `uptime.html` table header & cell widths**
  - Update `<thead>` to 4 consolidated columns: `PC & Grup`, `Waktu / Rentang Aktif`, `Durasi Online & Billing`, `Tingkat Utilisasi`.
- [ ] **Step 2: Update `uptime/index.js` renderDaily() and renderRange()**
  - Change `px-6 py-3.5` to `px-3 py-2.5` and format cells as 2-row pairs.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 4: Perawatan PC (Maintenance Tickets) 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/maintenance.html`
- Modify: `app/static/js/kasir/modules/maintenance/index.js`

- [ ] **Step 1: Update `maintenance.html` table header**
  - Update `<thead>` to: `PC & Prioritas`, `Masalah & Detail`, `Pelapor & Tanggal`, `Status & Aksi`.
- [ ] **Step 2: Update `maintenance/index.js` renderTickets()**
  - Format ticket cells into 2 rows, with action buttons neatly flex-wrapped.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 5: Koneksi Cabang (Control Panel Outbound) 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/branch.html`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Update `branch.html` table header**
  - Update `<thead>` to: `No & Status`, `Nama & URL Cabang`, `Aksi Kontrol`.
- [ ] **Step 2: Update `branch/index.js` renderBranchesSettingsTable()**
  - Combine branch name + URL into 2 rows and wrap action buttons.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 6: List Koneksi Cabang (Inbound Security) 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/branch_inbound.html`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Update `branch_inbound.html` table header**
  - Update `<thead>` to: `No & Status`, `Cabang Pengontrol`, `Hardware (MAC) & IP`, `Operator & Waktu Akses`, `Total & Aksi`.
- [ ] **Step 2: Update `branch/index.js` renderInboundTable()**
  - Render 2-row multi-line cells for MAC/IP, Operator/Time, and Total/Actions.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 7: Akun Kasir Cabang (Remote Operators) 2-Row Columns
**Files:**
- Modify: `app/templates/kasir/tabs/branch_kasir.html`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [ ] **Step 1: Update `branch_kasir.html` table header**
  - Update `<thead>` to: `No & Status`, `Identitas Kasir & Cabang`, `Statistik Transaksi`, `Aktivitas & Aksi`.
- [ ] **Step 2: Update `branch/index.js` renderOperatorsTable()**
  - Render 2-row structured cells for remote operators.
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

### Task 8: Catatan (Unified Alert & Save Button)
**Files:**
- Modify: `app/templates/kasir/tabs/catatan.html`
- Modify: `app/static/js/kasir/modules/catatan/index.js`

- [ ] **Step 1: Update `catatan.html` status and save buttons**
  - Unify save button and notification indicator into `#btn-save-note`.
- [ ] **Step 2: Update `catatan/index.js` setSaveStatus() and save handlers**
  - Dynamically style the save button for "Tersimpan", "Ada Perubahan", "Menyimpan", and "Gagal".
- [ ] **Step 3: Test & Verify build**
  - Run `npm run build:css`

---

## Verification Plan
1. Run `npm run build:css` to ensure full CSS compilation.
2. Verify all 8 components on both 1024px and 1920px viewports.

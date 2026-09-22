# Comprehensive 1024px (lg:max-xl) Dual-Layout Implementation Plan (Preserving xl & Mobile)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengoptimalkan seluruh halaman dan tab aplikasi kasir (kecuali tab Dashboard) agar pas, rapi, dan tidak terpotong pada resolusi **1024px** (viewport 1024x768 / tablet landscape) menggunakan `lg:max-xl:<utility>`, **tanpa menghapus/mengubah kelas `xl:` dan `2xl:` yang sudah pas untuk desktop 1920px**, serta **menjaga 100% keutuhan seluruh breakpoint mobile (`<sm`, `sm:`, `md:`)**.

**Architecture:** Mengikuti panduan resmi [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design):
- **Preserve Mobile**: Base styling tanpa prefix (`text-xs`, `p-3`, `block`, `overflow-x-auto`) dan breakpoint mobile (`sm:`, `md:`) tetap dipertahankan 100%.
- **Preserve Desktop (`xl:` & `2xl:`)**: Semua kelas `xl:` dan `2xl:` yang sudah pas di layar Full HD (≥1280px / 1920px) **DIPERTAHANKAN dan TIDAK DIHAPUS**.
- **1024px Targeted Range**: Hanya menambahkan modifier range Tailwind v3 `lg:max-xl:<utility>` (media query: `@media (min-width: 1024px) and (max-width: 1279px)`) untuk menyesuaikan ukuran font, padding, dan grid khusus rentang 1024px–1279px.
- **Table Containment**: Seluruh pembungkus tabel di dalam tab menggunakan `overflow-x-auto w-full`.

**Tech Stack:** Tailwind CSS v3.4.19, Jinja2 Templates, Vanilla JavaScript Modules.

## Global Constraints
1. **EXCLUDE DASHBOARD**: Jangan ubah `app/templates/kasir/tabs/dashboard.html`, `dashboard_compact.js`, `dashboard_detail_modal.js`, atau layout utama `app/templates/kasir/index.html`.
2. **PRESERVE `xl:` & `2xl:` BREAKPOINTS**: Jangan hapus atau ubah kelas `xl:` dan `2xl:` yang sudah pas untuk desktop 1920px. Jika ada elemen yang perlu penyesuaian 1024px, sisipkan `lg:max-xl:...` dan pastikan `xl:...` tetap ada.
3. **PROTECT MOBILE BREAKPOINTS**: Jangan hapus atau modifikasi kelas mobile yang sudah ada (`text-xs`, `md:hidden`, `sm:flex-row`, dsb).
4. **TAILWIND RANGE SYNTAX**: Gunakan `lg:max-xl:<utility>` untuk rentang 1024px–1279px.
5. **BUILD VERIFICATION**: Selalu jalankan `npm run build:css` di setiap akhir task untuk memvalidasi utility class.

---

### Task 1: Member & Paket Tabs (Data Master Billing)
**Files:**
- Modify: `app/templates/kasir/tabs/member.html:4-42`
- Modify: `app/static/js/kasir/modules/member/member_table.js:18-96`
- Modify: `app/templates/kasir/tabs/paket.html:4-44`
- Modify: `app/static/js/kasir/modules/paket/paket_table.js:28-80`

**Interfaces:**
- Consumes: `MemberTable.render(members, meta)`, `PaketTable.render(paketList, meta)`
- Produces: Responsive table containers dengan `overflow-x-auto w-full`, compact styling `lg:max-xl:text-xs` pada 1024px, tetap mempertahankan `xl:text-base` pada 1920px.

- [ ] **Step 1: Update `app/templates/kasir/tabs/member.html` & `paket.html`**
  - Ubah `#member-table` dan `#paket-table` dari `overflow-x-hidden` menjadi `overflow-x-auto w-full`.
  - Header actions: `text-sm lg:max-xl:text-lg xl:text-[22px]`, subtitle `text-[10px] lg:max-xl:text-xs xl:text-base`.
  - Inputs & search buttons: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 2: Update `app/static/js/kasir/modules/member/member_table.js` & `paket_table.js`**
  - Wrapper tabel: `overflow-x-auto w-full`.
  - Table typography: `text-xs lg:max-xl:text-xs xl:text-base`.
  - Padding cell & header: `lg:max-xl:px-3 lg:max-xl:py-2 xl:px-4 xl:py-2.5`.
  - Avatar badge member: `lg:max-xl:w-7 lg:max-xl:h-7 xl:w-8 xl:h-8`.

- [ ] **Step 3: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 4: Commit**
  - Run: `git add app/templates/kasir/tabs/member.html app/static/js/kasir/modules/member/member_table.js app/templates/kasir/tabs/paket.html app/static/js/kasir/modules/paket/paket_table.js app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for member and paket tabs, preserving xl"`

---

### Task 2: Laporan Billing & Laporan Kantin / F&B Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/laporan.html:3-32`
- Modify: `app/static/js/kasir/modules/laporan/index.js:137-230`
- Modify: `app/templates/kasir/tabs/laporan_menu.html:3-28`
- Modify: `app/static/js/kasir/modules/laporan_menu/index.js:145-230`

**Interfaces:**
- Consumes: `Laporan.render(data)`, `LaporanMenu.render()`
- Produces: 8-column billing report table & 11-column POS report table with smooth scrolling on 1024px and retaining `xl:` classes for 1920px.

- [ ] **Step 1: Update `laporan.html` & `laporan_menu.html`**
  - Headers: `text-xs lg:max-xl:text-lg xl:text-[22px]`.
  - Select filter & buttons: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 2: Update `laporan/index.js` & `laporan_menu/index.js`**
  - Table wrapper: `overflow-x-auto w-full mb-6`.
  - Table typography: `text-xs lg:max-xl:text-xs xl:text-base`.
  - Table cell padding: `lg:max-xl:px-2.5 lg:max-xl:py-2 xl:px-4 xl:py-3`.
  - Action buttons: `text-[10px] lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 3: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 4: Commit**
  - Run: `git add app/templates/kasir/tabs/laporan.html app/static/js/kasir/modules/laporan/index.js app/templates/kasir/tabs/laporan_menu.html app/static/js/kasir/modules/laporan_menu/index.js app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for laporan tabs, preserving xl"`

---

### Task 3: User, Grup & Game Management Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/user.html:4-26`
- Modify: `app/static/js/kasir/modules/user/index.js:27-80`
- Modify: `app/templates/kasir/tabs/grup.html:4-27`
- Modify: `app/static/js/kasir/modules/grup/index.js:191-233`
- Modify: `app/templates/kasir/tabs/game.html:4-65`
- Modify: `app/static/js/kasir/modules/game/index.js:200-240`

**Interfaces:**
- Consumes: `User.render(users)`, `Grup.render(list)`, `GameManagement.render()`
- Produces: Responsive staff, user group, and game launcher management views with `lg:max-xl:` and preserved `xl:`.

- [ ] **Step 1: Update `user.html` & `user/index.js`**
  - Wrapper table `#user-table`: `overflow-x-auto w-full`.
  - Headers & cells: `text-xs lg:max-xl:text-xs xl:text-base`, padding `lg:max-xl:px-4 lg:max-xl:py-2.5 xl:px-6 xl:py-4`.

- [ ] **Step 2: Update `grup.html` & `grup/index.js`**
  - Wrapper table `#grup-table`: `overflow-x-auto w-full`.
  - Headers & cells: `text-xs lg:max-xl:text-xs xl:text-base`, padding `lg:max-xl:px-4 lg:max-xl:py-2.5 xl:px-6 xl:py-4`.

- [ ] **Step 3: Update `game.html` & `game/index.js`**
  - Wrapper table: `overflow-x-auto w-full`.
  - Headers & cells: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/user.html app/static/js/kasir/modules/user/index.js app/templates/kasir/tabs/grup.html app/static/js/kasir/modules/grup/index.js app/templates/kasir/tabs/game.html app/static/js/kasir/modules/game/index.js app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for user, grup, and game tabs, preserving xl"`

---

### Task 4: Unit PC Grid, Monitor Hardware & Screenshot Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/pc.html:4-51`
- Modify: `app/static/js/kasir/modules/pc/pc_grid.js:28-55`
- Modify: `app/templates/kasir/tabs/monitor.html:4-14`
- Modify: `app/static/js/kasir/modules/monitor/index.js:236-261`
- Modify: `app/templates/kasir/tabs/screenshot.html:4-52`

**Interfaces:**
- Consumes: `PCGrid.render(groupedData, meta)`, `Monitor.render(data)`, `Screenshot.renderGrid()`
- Produces: 4-column PC card grid on 1024px (`lg:max-xl:grid-cols-4`) and preserving 6-column on 1920px (`xl:grid-cols-6`), responsive monitor and screenshot views.

- [ ] **Step 1: Update `pc.html` & `pc_grid.js`**
  - Container `#pc-table`: `overflow-x-auto w-full`.
  - Grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:max-xl:grid-cols-4 xl:grid-cols-6 gap-3`.
  - Item typography: `text-xs lg:max-xl:text-xs xl:text-base` for code, `text-[9px] lg:max-xl:text-[10px] xl:text-sm` for IP.

- [ ] **Step 2: Update `monitor.html` & `monitor/index.js`**
  - Container `#monitor-table`: `overflow-x-auto w-full`.
  - Table wrapper: `hidden xl:block overflow-x-auto w-full border border-[#1c1c1c] rounded` (mempertahankan `xl:block` dan card view mobile/tablet).

- [ ] **Step 3: Update `screenshot.html`**
  - Header actions & filter dropdowns: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/pc.html app/static/js/kasir/modules/pc/pc_grid.js app/templates/kasir/tabs/monitor.html app/static/js/kasir/modules/monitor/index.js app/templates/kasir/tabs/screenshot.html app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for pc, monitor, and screenshot tabs, preserving xl"`

---

### Task 5: POS Menu, Catatan, Struk & Tournament Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/menu.html:4-70`
- Modify: `app/static/js/kasir/modules/menu/index.js:45-105`
- Modify: `app/templates/kasir/tabs/catatan.html:4-65`
- Modify: `app/templates/kasir/tabs/struk.html:4-46`
- Modify: `app/templates/kasir/tabs/tournament.html:4-65`

**Interfaces:**
- Consumes: `Menu.renderCatalog()`, `Catatan.renderList()`, `Struk.loadHistory()`, `Tournament.renderList()`
- Produces: Responsive 2-column layout on 1024px with balanced sidebar/cart widths while preserving `xl:` styling for Full HD.

- [ ] **Step 1: Update `menu.html` & `menu/index.js`**
  - Header & search: `text-xs lg:max-xl:text-xs xl:text-base`, `text-sm lg:max-xl:text-lg xl:text-[22px]`.
  - Catalog card typography: `text-xs lg:max-xl:text-xs xl:text-base` for item names & prices.

- [ ] **Step 2: Update `catatan.html`**
  - Sidebar width: `w-full md:w-80 lg:max-xl:w-72 xl:w-96`.
  - Header: `text-xs lg:max-xl:text-lg xl:text-[22px]`.

- [ ] **Step 3: Update `struk.html` & `tournament.html`**
  - Headers & inputs: `text-xs lg:max-xl:text-xs xl:text-base`, `text-sm lg:max-xl:text-lg xl:text-[22px]`.
  - Tournament grid: `grid grid-cols-1 md:grid-cols-2 lg:max-xl:grid-cols-2 xl:grid-cols-3 gap-6`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/menu.html app/static/js/kasir/modules/menu/index.js app/templates/kasir/tabs/catatan.html app/templates/kasir/tabs/struk.html app/templates/kasir/tabs/tournament.html app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for menu, catatan, struk, and tournament tabs, preserving xl"`

---

### Task 6: Owner Analytics, Maintenance, Laporan Maintenance & Uptime Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/analytics.html:10-59`
- Modify: `app/templates/kasir/tabs/maintenance.html:50-98`
- Modify: `app/templates/kasir/tabs/laporan_maintenance.html:4-125`
- Modify: `app/templates/kasir/tabs/uptime.html:8-114`

**Interfaces:**
- Consumes: `OwnerAnalytics.load()`, `Maintenance.renderTickets()`, `LaporanMaintenance.loadReport()`, `UptimeTracker.load()`
- Produces: 2-column analytics card grid on 1024px (`lg:max-xl:grid-cols-2 xl:grid-cols-3`), 1-column category breakdown on 1024px for laporan maintenance while retaining `xl:grid-cols-3`.

- [ ] **Step 1: Update `analytics.html`**
  - Grid cards: `grid grid-cols-1 sm:grid-cols-2 lg:max-xl:grid-cols-2 xl:grid-cols-3 gap-4`.
  - KPI titles & values: `text-xs lg:max-xl:text-lg xl:text-[22px]`.

- [ ] **Step 2: Update `maintenance.html` & `laporan_maintenance.html`**
  - Breakdown vs Table: `grid grid-cols-1 lg:max-xl:grid-cols-1 xl:grid-cols-3 gap-6`.
  - Table typography: `text-xs lg:max-xl:text-xs xl:text-base`.
  - Header actions: `text-xs lg:max-xl:text-xs xl:text-base`, `text-sm lg:max-xl:text-lg xl:text-[22px]`.

- [ ] **Step 3: Update `uptime.html`**
  - Table wrapper: `overflow-x-auto scrollbar-thin w-full`.
  - Table typography & padding: `text-xs lg:max-xl:text-xs xl:text-base`, `lg:max-xl:px-2.5 lg:max-xl:py-2 xl:px-4 xl:py-3`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/analytics.html app/templates/kasir/tabs/maintenance.html app/templates/kasir/tabs/laporan_maintenance.html app/templates/kasir/tabs/uptime.html app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for analytics, maintenance, and uptime tabs, preserving xl"`

---

### Task 7: Branching (Cabang), Inbound, Blackout, Hardware Checker, MikroTik & Remote Server Tabs
**Files:**
- Modify: `app/templates/kasir/tabs/branch_kasir.html:50-82`
- Modify: `app/templates/kasir/tabs/branch.html:45-100`
- Modify: `app/templates/kasir/tabs/branch_inbound.html:45-100`
- Modify: `app/templates/kasir/tabs/blackout.html:4-48`
- Modify: `app/static/js/kasir/modules/blackout/index.js:150-170`
- Modify: `app/templates/kasir/tabs/hardware_checker.html:4-24`
- Modify: `app/templates/kasir/tabs/mikrotik.html:4-52`
- Modify: `app/templates/kasir/tabs/remote_server.html:4-58`

**Interfaces:**
- Consumes: `BranchManager`, `Blackout`, `HardwareChecker`, `MikrotikModule`, `VNCClient`
- Produces: Clean action bars, forms, and tables for branch management, network, blackout recovery, and remote control with `lg:max-xl:` and preserved `xl:`.

- [ ] **Step 1: Update `branch_kasir.html`, `branch.html`, `branch_inbound.html`**
  - Table typography: `text-xs lg:max-xl:text-xs xl:text-base`.
  - Buttons & badges: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 2: Update `blackout.html`, `blackout/index.js`, `hardware_checker.html`**
  - Headers: `text-xs lg:max-xl:text-lg xl:text-[22px]`.
  - Buttons & selects: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 3: Update `mikrotik.html` & `remote_server.html`**
  - Headers & inputs: `text-xs lg:max-xl:text-xs xl:text-base`, `text-xs lg:max-xl:text-lg xl:text-[22px]`.
  - Action buttons: `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/branch_kasir.html app/templates/kasir/tabs/branch.html app/templates/kasir/tabs/branch_inbound.html app/templates/kasir/tabs/blackout.html app/static/js/kasir/modules/blackout/index.js app/templates/kasir/tabs/hardware_checker.html app/templates/kasir/tabs/mikrotik.html app/templates/kasir/tabs/remote_server.html app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for branch, blackout, hardware, mikrotik, and remote tabs, preserving xl"`

---

### Task 8: Settings (Sub-tabs), File Explorer, Log Audit & Documentation CMS Pages
**Files:**
- Modify: `app/templates/kasir/tabs/settings.html:10-720`
- Modify: `app/templates/kasir/tabs/fileexplorer.html:4-65`
- Modify: `app/templates/kasir/tabs/log.html:4-65`
- Modify: `app/templates/kasir/documentation.html:260-305`

**Interfaces:**
- Consumes: `Settings`, `FileExplorer`, `Log`, `Tutorials`
- Produces: Dual-resolution layout across all setting forms, backup tables, web file explorer, log audit filters, and documentation CMS with `lg:max-xl:` and preserved `xl:`.

- [ ] **Step 1: Update `settings.html`**
  - Sub-tab headers: `text-xs lg:max-xl:text-lg xl:text-[22px]`.
  - Subtitle: `text-[9px] lg:max-xl:text-xs xl:text-base`.
  - Form inputs & buttons: `text-xs lg:max-xl:text-xs xl:text-base`.
  - Local backup & whitelist tables: `overflow-x-auto w-full`, `text-xs lg:max-xl:text-xs xl:text-base`.

- [ ] **Step 2: Update `fileexplorer.html` & `log.html`**
  - Headers & buttons: `text-xs lg:max-xl:text-xs xl:text-base`, `text-xs lg:max-xl:text-lg xl:text-[22px]`.
  - Left panel widths & log category bar: `overflow-x-auto w-full`.

- [ ] **Step 3: Update `documentation.html`**
  - Wiki sidebar: `w-full lg:max-xl:w-64 xl:w-72`.
  - Headers & actions: `text-xs lg:max-xl:text-xs xl:text-base`, `text-xs lg:max-xl:text-lg xl:text-[22px]`.

- [ ] **Step 4: Run CSS Build**
  - Run: `npm run build:css`
  - Expected: Build berhasil.

- [ ] **Step 5: Commit**
  - Run: `git add app/templates/kasir/tabs/settings.html app/templates/kasir/tabs/fileexplorer.html app/templates/kasir/tabs/log.html app/templates/kasir/documentation.html app/static/css/tailwind.css`
  - Run: `git commit -m "fix(responsive): 1024px range layout for settings, fileexplorer, log, and documentation, preserving xl"`

---

## Verification Plan
1. **Automated Verification:**
   - Execute `npm run build:css` to verify valid compilation of all Tailwind classes.
2. **Viewport 1024x768 (`@media (min-width: 1024px) and (max-width: 1279px)`)**:
   - Verify every tab: no clipping, clean font sizes (`lg:max-xl:text-xs`/`text-sm`), compact paddings, smooth scrolling in table containers.
3. **Viewport 1920x1080 (`@media (min-width: 1280px)` / 1920px)**:
   - Verify wide spacious layout, all existing `xl:` styling fully active, `text-base` / `text-[22px]`, full card grids, no font shrinkage.
4. **Mobile Breakpoints (<640px, 768px)**:
   - Verify mobile card toggles, responsive menus, bottom navigation, and search bars work identically without regressions.

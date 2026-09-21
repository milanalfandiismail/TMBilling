# Card-to-Card Multi-Selection & Context Menu Batch Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti marquee drag selection menjadi Card-to-Card Range Swipe/Drag Selection, menyederhanakan floating indicator bawah hanya sebagai penanda jumlah PC terpilih, memusatkan seluruh batch actions ke Context Menu (Buka Sesi Guest jika semua kosong, Tambah Sesi jika semua aktif, tidak ada jika campuran), membatasi buka sesi batch khusus Guest (bukan Member), dan merapikan visual centang/glow pada breakpoint `LG`, `XL`, `2XL` agar tidak menutupi isi kartu PC.

**Architecture:** Frontend controller `DashboardSelection` mendeteksi `mousedown` pada kartu awal, melacak `mouseenter` pada kartu hover untuk menghitung range slice pada list PC terurut di grid, dan menyeleksi kartu. Context menu menangani batch actions dengan aturan visibilitas cerdas. Toolbar bawah hanya berfungsi sebagai badge info ringkas PC terpilih + cancel button.

**Tech Stack:** JavaScript (Vanilla ES6+), Tailwind CSS, Flask / Python backend.

---

## Global Constraints
- Breakpoint desktop eksklusif: `LG` (1024px), `XL` (1280px), `2XL` (1536px) — `window.innerWidth >= 1024`.
- Tidak melakukan commit Git otomatis tanpa instruksi eksplisit user.
- Menggunakan MCP `codebase-memory` untuk setiap inspeksi dan verifikasi.
- Buka sesi batch khusus untuk Guest (Member tidak didukung untuk batch buka sesi).

---

### Task 1: Refactor `dashboard_selection.js` to Card-to-Card Drag, Info-Only Pill, & Smart Context Menu

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_selection.js`

**Interfaces:**
- Produces: `DashboardSelection.handleCardMouseDown(event, pcId)`, `DashboardSelection.handleCardMouseEnter(pcId)`, `DashboardSelection.handleCardMouseUp(event, pcId)`, `DashboardSelection.showBatchContextMenu(event)`

- [ ] **Step 1: Remove Marquee DOM creation & Refactor Floating Toolbar into a minimalist Info Indicator Pill (showing only count + PC codes + Esc button)**
- [ ] **Step 2: Implement Card-to-Card drag state tracking (`dragStartPcId`, `isDraggingRange`, `dragOverPcId`)**
- [ ] **Step 3: Implement Smart Context Menu Visibility Rules** (All-Kosong -> Buka Sesi Guest, All-Aktif -> Tambah Sesi, Mixed -> Neither, Hide Detail PC)
- [ ] **Step 4: Support both Left Click & Right Click on selected cards to show Context Menu**

---

### Task 2: Update `dashboard_compact.js` Card Layout & Selection Event Listeners

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`

- [ ] **Step 1: Relocate checkmark badge from absolute corner overlay to clean inline badge next to PC code**
- [ ] **Step 2: Attach `mousedown`, `mouseenter`, `mouseup`, `click`, and `contextmenu` event listeners delegating to `DashboardSelection`**
- [ ] **Step 3: Update `render()` and `updateUI()` to ensure consistent styling without blocking text**

---

### Task 3: Build CSS and Verify End-to-End

**Files:**
- Verify: `npm run build:css`
- Run: `.venv\Scripts\python -m pytest tests/test_batch_sesi_routes.py -v`
- Run: `.venv\Scripts\python -m pytest tests/ -v`

- [ ] **Step 1: Run Tailwind CSS build**
- [ ] **Step 2: Run pytest test suite**
- [ ] **Step 3: Re-index with `codebase-memory` MCP**

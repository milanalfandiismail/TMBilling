# Comprehensive Repository Documentation Update v1.5.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and update all 19 documentation files in `docs/` and root `README.md` to cover all recent v1.5.1 features and ALL 24 Flask route packages, 26 frontend JS modules, and C#/Rust background services, while excluding `docs/superpowers/` in `.gitignore`.

**Architecture:** Full repository documentation synchronization covering:
1. v1.5.1 features: Member Refund via Dashboard Context Menu (`showMemberRefundModal`, `refundMemberPaket`), Refund Duration Breakdown (Total Waktu Sekarang, Potongan Refund, Total Akhir Waktu), Time Addition Terminology Alignment, Member Portal UI cleanup, API endpoint payloads, and version footer bumps (`v1.5.1`).
2. Complete Audit of Omitted Modules in `CODEBASE_DOCUMENTATION.md` & `TECHNICAL_DOCS.md`:
   - Route Packages: Game Launcher (`game`), Hardware Serials (`hardware`), Server Monitor (`server_monitor` / `TMLHMService.cs`), MikroTik Router (`mikrotik`), TightVNC Remote (`vnc`), Plugin System (`settings/plugin_routes.py`), IP Whitelist, PDF Export Service.
   - JS Modules: `laporan_maintenance`, `laporan_menu`, `screenshot`, `server_monitor`, `uptime`, `remote`, `hardware_checker`, `mikrotik`, `vnc`, `game`, `owner/analytics`.
3. Git exclusion rule for superpowers artifacts (`docs/superpowers/`).

**Tech Stack:** Markdown (`.md`), Git (`.gitignore`)

## Global Constraints

- Language: Indonesian for detailed guides, Markdown syntax.
- Target Version: v1.5.1 across all documentation footers.
- All file paths and API signatures must match codebase verbatim.
- Superpowers plans and specs in `docs/superpowers/` MUST be ignored by `.gitignore` and NEVER committed.

---

### Task 1: Update `.gitignore` to exclude `docs/superpowers/`

**Files:**
- Modify: `.gitignore:35-40`

**Interfaces:**
- Consumes: `.gitignore` rules.
- Produces: Exclusion rule `docs/superpowers/`.

- [ ] **Step 1: Edit `.gitignore` to add `docs/superpowers/`**

Add `docs/superpowers/` under internal design documents in `.gitignore`.

- [ ] **Step 2: Commit `.gitignore` change**

```bash
git add .gitignore
git commit -m "chore: add docs/superpowers/ to .gitignore"
```

---

### Task 2: Update `docs/NEW_FEATURES_GUIDE.md` & `README.md`

**Files:**
- Modify: `docs/NEW_FEATURES_GUIDE.md:130-139`
- Modify: `README.md:55-85, 1290-1295`

**Interfaces:**
- Consumes: Existing v1.5.0 guide sections.
- Produces: Section 9 detailing v1.5.1 features and updated README feature cards & version footer.

- [ ] **Step 1: Write Section 9 for v1.5.1 in `docs/NEW_FEATURES_GUIDE.md`**

Append Section 9 covering:
1. Refund Paket Member via Context Menu Dashboard (`showMemberRefundModal`, `refundMemberPaket`).
2. Breakdown Rincian Kalkulasi Durasi pada Modal Refund (*Total Waktu Sekarang*, *Potongan Refund*, *Total Akhir Waktu*).
3. Penyelarasan Istilah & Rincian Modal Tambah Waktu (*Total Waktu Saat Ini*, *Total Tambahan Waktu*, *Total Setelah Ditambah*).
4. Pembersihan & Perbaikan UI Portal Member (pembersihan ganti password, padding/text adjustment, `whitespace-nowrap` durasi).

- [ ] **Step 2: Update `README.md` feature cards and version footer to `v1.5.1`**

- [ ] **Step 3: Commit `docs/NEW_FEATURES_GUIDE.md` and `README.md` changes**

```bash
git add docs/NEW_FEATURES_GUIDE.md README.md
git commit -m "docs: update NEW_FEATURES_GUIDE.md and README.md for v1.5.1 release"
```

---

### Task 3: Update `docs/CODEBASE_DOCUMENTATION.md` & `docs/TECHNICAL_DOCS.md`

**Files:**
- Modify: `docs/CODEBASE_DOCUMENTATION.md:73-130, 440-446`
- Modify: `docs/TECHNICAL_DOCS.md:150-185, 645-650`

**Interfaces:**
- Consumes: All 24 Flask route packages, 26 frontend JS modules, C# TMLHMService, and v1.5.1 endpoints.
- Produces: 100% complete documentation table of all routes and JS modules in the codebase.

- [ ] **Step 1: Update routes & JS modules tables in `docs/CODEBASE_DOCUMENTATION.md`**

Add entries for:
- Game Launcher (`app/routes/game/`, `modules/game/index.js`)
- Hardware Serials & Specs (`app/routes/hardware/`, `modules/hardware_checker/index.js`)
- Server Hardware Monitor Service (`app/routes/server_monitor/`, `TMLHMService.cs`, `modules/server_monitor/`)
- MikroTik Router Integration (`app/routes/mikrotik/`, `modules/mikrotik/index.js`)
- TightVNC Remote Desktop (`app/routes/vnc/`, `modules/vnc/index.js`)
- Plugin System (`app/routes/settings/plugin_routes.py`, `plugin_manager.py`)
- Laporan Maintenance, Laporan Menu, Screenshot, Uptime, Remote modules.
- Dashboard Member Refund (`showMemberRefundModal`, `refundMemberPaket`)
- Bump footer to `*TMBilling v1.5.1*`.

- [ ] **Step 2: Update `docs/TECHNICAL_DOCS.md` for Member Refund & omitted module endpoints**

Document request payload `{ "member_id": 1, "transaksi_id": 5 }` and response structure for `POST /api/v1/kasir/member/refund-paket`.
Document endpoints for Game, Hardware Serials, Server Monitor, MikroTik, TightVNC, and Plugins.
Bump footer to `*TMBilling v1.5.1*`.

- [ ] **Step 3: Commit `docs/CODEBASE_DOCUMENTATION.md` and `docs/TECHNICAL_DOCS.md` changes**

```bash
git add docs/CODEBASE_DOCUMENTATION.md docs/TECHNICAL_DOCS.md
git commit -m "docs: update CODEBASE_DOCUMENTATION.md and TECHNICAL_DOCS.md with complete 24 routes & 26 modules audit"
```

---

### Task 4: Update `docs/ARCHITECTURE.md`, `docs/FRONTEND_GUIDE.md`, `docs/BACKEND_GUIDE.md`, and `docs/PRD.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md:40-75, 265-271`
- Modify: `docs/FRONTEND_GUIDE.md:210-219`
- Modify: `docs/BACKEND_GUIDE.md:485-491`
- Modify: `docs/PRD.md:1-10, 130-140`

**Interfaces:**
- Consumes: Data flow diagrams and version footers.
- Produces: Updated architecture data flow and version footers to `v1.5.1`.

- [ ] **Step 1: Update `docs/ARCHITECTURE.md` data flow diagram & version footer**

Add Member Refund from Dashboard Context Menu to the end-to-end data flow section. Bump footer to `*TMBilling v1.5.1*`.

- [ ] **Step 2: Update `docs/FRONTEND_GUIDE.md`, `docs/BACKEND_GUIDE.md`, and `docs/PRD.md` footers to `v1.5.1`**

- [ ] **Step 3: Commit architecture & guide changes**

```bash
git add docs/ARCHITECTURE.md docs/FRONTEND_GUIDE.md docs/BACKEND_GUIDE.md docs/PRD.md
git commit -m "docs: update ARCHITECTURE.md, FRONTEND_GUIDE.md, BACKEND_GUIDE.md, and PRD.md to v1.5.1"
```

---

### Task 5: Bump Version Footers on All Feature Specification Files in `docs/`

**Files:**
- Modify: `docs/FEATURE_IP_WHITELIST.md`
- Modify: `docs/FEATURE_FLOOR_PLAN.md`
- Modify: `docs/FEATURE_OWNER_ANALYTICS.md`
- Modify: `docs/FEATURE_PLUGIN_SYSTEM.md`
- Modify: `docs/FEATURE_MULTI_TIMEZONE.md`
- Modify: `docs/UPGRADE_RUPIAH_AND_POS.md`
- Modify: `docs/DIAGRAMS.md`
- Modify: `docs/DESIGN_IP_WHITELIST_SESSION_DESTROY.md`
- Modify: `docs/design_metode_pembayaran.md`
- Modify: `docs/CLOUD_BACKUP_DESIGN.md`
- Modify: `docs/laporan_tugas_akhir.md`

**Interfaces:**
- Consumes: Documentation version footers.
- Produces: Updated `*TMBilling v1.5.1*` version footers.

- [ ] **Step 1: Update version footers across all remaining feature documentation files to `*TMBilling v1.5.1*`**

- [ ] **Step 2: Commit version footer updates**

```bash
git add docs/*.md
git commit -m "docs: bump version footers to v1.5.1 across all feature specification documentation files"
```

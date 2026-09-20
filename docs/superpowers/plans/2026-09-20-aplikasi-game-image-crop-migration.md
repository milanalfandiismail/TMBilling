# Aplikasi & Game, Image Zoom/Crop, Multi-Genre, Paket 8-Card, & Backward-Compatible Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the game management system into a robust "Aplikasi & Game" platform featuring multi-genre tagging (10+ categories), interactive 3:4 image zoom & crop in admin/cashier modal, zero-leak state management, 8-package display on `lg`/`xl`/`2xl` public `/paket`, fully responsive public portal on `sm`/`md`/`lg`/`xl`/`2xl`, and 100% backward-compatible database migration via the "Migrasi & Update" workflow.

**Architecture:** 
- Backend: Flask SQLAlchemy models with extended `tipe` column and comma-separated multi-genre `kategori` for zero-friction backward compatibility. Official Alembic migration revision with safety net in `migration_routes.py` upon ZIP update upload.
- Frontend Admin: Vanilla JS state-managed Modal with embedded interactive HTML5 Canvas 3:4 image cropper (zoom + pan) and dynamic chip-based multi-category tag input.
- Frontend Public: Space Grotesk / Dark Theme responsive cards matching the design system of `/paket` and `/livepc` across all breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).

**Tech Stack:** Python, Flask, SQLAlchemy, Alembic, HTML5 Canvas, TailwindCSS, Vanilla JavaScript.

**Spec:** User requirements for 8-card packages on lg/xl/2xl, Aplikasi & Game renaming + responsive UI, Admin Image Zoom/Crop + state reset, Multi-category/unlimited genres per game, and Safe backward-compatible migration via sidebar Migrasi & Update.

## Global Constraints
- Must maintain 100% backward compatibility with legacy database versions (v1.0.0, v1.5.8, v1.6.0).
- Must avoid external heavy JS dependencies for image cropping (use clean vanilla HTML5 Canvas implementation).
- Must follow established dark theme design tokens (`#050505`, `#0a0a0a`, `#111`, `#1f1f1f`, `#2a2a2a`).
- Must strictly reset state on modal open/close to prevent image leaking between different items.
- All migration safety net blocks must include clear version comments (e.g. `# v1.6.1 Migration Safety`).

---

### Task 1: Database Model & Repository Layer (Tipe & Multi-Genre Support)

**Files:**
- Modify: `app/models/game/game.py`
- Modify: `app/repositories/game/game_repository.py`
- Modify: `app/services/game/game_service.py`

**Interfaces:**
- Consumes: `Game` SQLAlchemy model, `GameRepository`, `GameService`
- Produces:
  - `Game.tipe`: `String(50)` (default `'game'`)
  - `Game.to_dict()`: includes `"tipe"` and `"kategori_list"` (list of strings)
  - `GameRepository.get_all(aktif_only=False, category=None, tipe=None, search_query=None)`
  - `GameService.create(data, icon_file=None, operator=None)`
  - `GameService.update(game_id, data, icon_file=None, operator=None)`

- [ ] **Step 1: Update Game model in `app/models/game/game.py`**
  Add `tipe = db.Column(db.String(50), default='game', nullable=True)` and widen `kategori` to `db.String(500)`. Update `to_dict()` to include `"tipe"` and `"kategori_list"`.

- [ ] **Step 2: Update GameRepository in `app/repositories/game/game_repository.py`**
  Support filtering by `tipe` (if not 'all'), multi-category matching via `Game.kategori.ilike(f"%{category}%")`, and multi-field search (nama & kategori).

- [ ] **Step 3: Update GameService in `app/services/game/game_service.py`**
  Support `tipe` and list/string category normalization in `create()` and `update()`.

- [ ] **Step 4: Verify Python syntax and model behavior**
  Run: `python -m py_compile app/models/game/game.py app/repositories/game/game_repository.py app/services/game/game_service.py`

---

### Task 2: Alembic Migration & Migration Manager Update Safety Net

**Files:**
- Create: `migrations/versions/8f7e6d5c4b3a_add_tipe_and_multigenre_to_game.py`
- Modify: `app/routes/settings/migration_routes.py`

**Interfaces:**
- Consumes: Alembic revision chaining (`down_revision = 'f3a1b2c4d5e6'`), SQLAlchemy engine inspector
- Produces: Alembic upgrade step & safe column verification in migration update endpoint

- [ ] **Step 1: Create Alembic Migration File `migrations/versions/8f7e6d5c4b3a_add_tipe_and_multigenre_to_game.py`**
  Create revision `8f7e6d5c4b3a` with `down_revision = 'f3a1b2c4d5e6'` adding `tipe` column to `game`.

- [ ] **Step 2: Update Safety Net in `app/routes/settings/migration_routes.py`**
  Update `upload_update()` in `migration_routes.py` with explicit comment `# v1.6.1 Migration Safety: Kolom 'tipe' pada tabel 'game' dan tabel 'game_kategori'` to ensure that when a ZIP package is uploaded from sidebar Migrasi & Update:
  1. `flask_migrate.upgrade()` runs the Alembic migration.
  2. Safety net checks `inspector.has_table('game')` and ensures column `tipe` is present (executing `ALTER TABLE game ADD COLUMN tipe VARCHAR(50) DEFAULT 'game'` if upgrading from an unversioned legacy database).
  3. Safety net checks `inspector.has_table('game_kategori')` and creates table if missing.

- [ ] **Step 3: Verify Migration and App Loading**
  Run: `python -c "from app import create_app; app = create_app(); print('App & Migration check OK')"`

---

### Task 3: Backend Routes & API Endpoints

**Files:**
- Modify: `app/routes/game/game_kasir_routes.py`
- Modify: `app/routes/game/game_public_routes.py`

**Interfaces:**
- Consumes: `GameService`, `GameKategoriService`
- Produces:
  - `GET /api/v1/kasir/game/?tipe=...&category=...&q=...`
  - `POST /api/v1/kasir/game/` (accepts `tipe`, `kategori`, `nama`, `icon`, etc.)
  - `POST /api/v1/kasir/game/<id>` (accepts `tipe`, `kategori`, `nama`, `icon`, etc.)
  - `GET /api/v1/public/game/all?tipe=...&category=...&q=...`

- [ ] **Step 1: Update `app/routes/game/game_kasir_routes.py`**
  Pass `tipe` argument in `list_games()`, `tambah_game()`, and `edit_game()`.

- [ ] **Step 2: Update `app/routes/game/game_public_routes.py`**
  Pass `tipe` argument in `get_public_games()`.

- [ ] **Step 3: Verify Python syntax**
  Run: `python -m py_compile app/routes/game/game_kasir_routes.py app/routes/game/game_public_routes.py`

---

### Task 4: Public Packages Page Expansion (`/paket`)

**Files:**
- Modify: `app/templates/public/paket/index.html`

**Interfaces:**
- Consumes: `groups` context variable with `active_paket_list`
- Produces: Responsive expanded card layout displaying 8 packages per card cleanly on `lg`, `xl`, and `2xl` breakpoints.

- [ ] **Step 1: Update `app/templates/public/paket/index.html`**
  - Increase package list max height on desktop breakpoints: `max-h-[380px] lg:max-h-[600px] xl:max-h-[640px] 2xl:max-h-[720px]`.
  - Widen container `max-w-7xl 2xl:max-w-[1600px]` with refined padding and spacing so 8 packages display without cramped vertical scrolling.

---

### Task 5: Public Portal UI - Daftar Aplikasi & Game (`/games`)

**Files:**
- Modify: `app/templates/public/game/index.html`
- Modify: `app/templates/public/components/_navbar_public.html`
- Modify: `app/static/js/public/games.js`

**Interfaces:**
- Consumes: `/api/v1/public/game/all`, `/api/v1/public/game/kategori`
- Produces:
  - Navigation link: "Daftar Aplikasi & Game"
  - Type Filter Tabs: "Semua", "Game", "Aplikasi"
  - Responsive Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`
  - Card Box-Art with 3:4 aspect ratio, Type badge (Game vs App), and multi-genre chips.

- [ ] **Step 1: Update Navbar Link in `app/templates/public/components/_navbar_public.html`**
  Change "Daftar Game" to "Daftar Aplikasi & Game" in desktop and mobile nav drawers.

- [ ] **Step 2: Update Public Template in `app/templates/public/game/index.html`**
  - Page title: `Daftar Aplikasi & Game | {{ warnet_title }}`
  - Header title & subtitle: "Daftar Aplikasi & Game"
  - Type Filter Pills container + Category Filter container
  - Search input placeholder: "Cari aplikasi atau game..."
  - Responsive grid layout aligned with `/paket`.

- [ ] **Step 3: Update Public JS in `app/static/js/public/games.js`**
  - Add `currentType` state (`all`, `game`, `aplikasi`).
  - Render Type filter buttons and Genre buttons.
  - Render 3:4 cards with Type badges (`GAME` emerald, `APLIKASI` cyan) and multi-genre chip tags.

---

### Task 6: Admin/Cashier Modal (Image Zoom/Crop, State Reset, & Multi-Genre Tag Input)

**Files:**
- Modify: `app/templates/kasir/tabs/game.html`
- Modify: `app/static/js/kasir/modules/game/index.js`

**Interfaces:**
- Consumes: Modal DOM elements, File input, HTML5 Canvas API, `/api/v1/kasir/game/`
- Produces:
  - Type select (`game` vs `aplikasi`)
  - Multi-category tag chip selector with interactive badge picker
  - Interactive Canvas Cropper with Zoom slider (1.0x to 3.0x) and Pan adjustment (aspect ratio 3:4)
  - Zero-leak form reset lifecycle (`resetForm()`) on add, edit, and close.

- [ ] **Step 1: Update Cashier Game Template in `app/templates/kasir/tabs/game.html`**
  - Header: "Kelola Aplikasi & Game"
  - Add Tipe dropdown (Game / Aplikasi) in form and table filter.
  - Replace single category `<select>` with Multi-Select Tag Input container + category quick-add chips.
  - Add Image Preview & Zoom/Crop container (viewport 3:4, zoom slider range, pan canvas, reset/change image button).

- [ ] **Step 2: Update Cashier Game JS in `app/static/js/kasir/modules/game/index.js`**
  - Implement `CanvasCropper`:
    - Reads selected image file into `Image` object.
    - Draws on 3:4 aspect ratio canvas with zoom & pan offsets.
    - Exports cropped `Blob` for form submission.
  - Implement `resetForm()`:
    - Resets all inputs, clears image input, destroys cropped blob, resets canvas preview, clears selected categories array.
  - Ensure `openAddModal()` and `openEditModal(game)` both invoke `resetForm()` before setting initial state.
  - Implement multi-category tag management: `selectedCategories` array, add tag, remove tag, toggle from existing list.
  - In `handleSubmit()`: attach `tipe`, comma-joined `kategori`, and cropped image blob (or skip if not changed during edit).

---

### Task 7: End-to-End Verification & Validation

**Files:**
- All modified files

- [ ] **Step 1: Python Compilation & Linter Check**
  Run: `python -m py_compile app/models/game/game.py app/repositories/game/game_repository.py app/services/game/game_service.py app/routes/game/game_kasir_routes.py app/routes/game/game_public_routes.py app/routes/settings/migration_routes.py migrations/versions/8f7e6d5c4b3a_add_tipe_and_multigenre_to_game.py`

- [ ] **Step 2: App Context & Database Schema Test**
  Verify database tables, columns, and relations with a test script verifying that `Game.query.all()` and `to_dict()` work seamlessly.

- [ ] **Step 3: Verification of Public Pages & Cashier Modules**
  Verify HTML/JS syntax and test responses.

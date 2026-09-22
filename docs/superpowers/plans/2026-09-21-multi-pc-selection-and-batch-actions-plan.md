# Multi-PC Selection & Batch Actions Plan (Desktop Breakpoints: LG, XL, 2XL)

## User Review Required

> [!IMPORTANT]
> **Breakpoint Scope**: Multi-selection and Marquee box drag are strictly enabled on **LG (1024px), XL (1280px), and 2XL (1536px)** breakpoints. On smaller mobile/tablet screens (< 1024px), normal single-tap touch behavior is preserved without interference.

> [!IMPORTANT]
> **No Automatic Git Commit**: As requested, changes will not be committed until explicit approval is given.

---

## 1. Overview & Objectives

In modern internet cafe / cybercafe environments, groups of players (e.g., 5 friends entering together for a party/tournament) frequently arrive at the same time to rent adjacent PCs for the same duration. Currently, kasir operators must open sessions, add time, send WOL, or shutdown PCs one by one.

This feature introduces **Desktop-grade Multi-PC Card Selection** on Kasir Dashboard:
1. **Selection Modes**:
   - `Ctrl + Left Click` / `Cmd + Left Click`: Toggle select individual PC cards.
   - `Shift + Left Click`: Select contiguous ranges of PC cards.
   - `Left Click + Hold / Drag (Marquee Box Selection)`: Drag across the grid to select multiple cards with a visible rectangle selection box.
2. **Context Menu & Floating Batch Toolbar**:
   - Right-click Context Menu dynamically adapts when multiple cards are selected.
   - Floating bottom Action Bar shows total selected PCs and quick-action buttons.
3. **Batch Operations**:
   - **Buka Sesi Bersama**: Open guest sessions on multiple empty PCs simultaneously with 1 package choice, auto-generating guest names (e.g. `Guest-1`, `Guest-2`) and aggregated total bill.
   - **Tambah Waktu Bersama**: Add time/package to all selected active sessions at once.
   - **Wake-on-LAN Bersama**: Send WOL magic packets to all selected PCs with MAC addresses in a single click.
   - **Shutdown / Restart Bersama**: Remote shutdown or restart multiple online PCs with 1 confirmation.
   - **Tutup Sesi Bersama**: Close multiple active sessions simultaneously.

---

## 2. Architecture & Component Design

```
+-----------------------------------------------------------------------------------+
| Kasir Dashboard (LG / XL / 2XL)                                                   |
|                                                                                   |
|  [TM-01 (Selected)]   [TM-02 (Selected)]   [TM-03 (Selected)]   [TM-04]   [TM-05] |
|  +----------------+   +----------------+   +----------------+                     |
|  | ring-2 indigo  |   | ring-2 indigo  |   | ring-2 indigo  |                     |
|  | [✓ Badge]      |   | [✓ Badge]      |   | [✓ Badge]      |                     |
|  +----------------+   +----------------+   +----------------+                     |
|                                                                                   |
|  Marquee Drag Box: ┌--------------------------------┐                             |
|                    | bg-indigo-500/10 border-indigo |                             |
|                    └--------------------------------┘                             |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Floating Batch Bar & Context Menu                                                 |
| 3 PC Terpilih (TM-01, TM-02, TM-03)                                               |
| [🟢 Buka Sesi (3)]  [➕ Tambah Waktu]  [⚡ WOL (3)]  [🛑 Tutup Sesi]  [⏻ Shutdown] |
+-----------------------------------------------------------------------------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
  +---------------------------+                     +---------------------------+
  | BukaModal.openBatch(pcs)  |                     | TambahModal.openBatch(pcs)|
  | - Target: TM-01..03       |                     | - Target: Active Sessions |
  | - Prefix: Guest-          |                     | - Add package to all      |
  | - 1 Paket -> Total Harga  |                     | - Aggregated Billing      |
  | - Concurrent API Sesi     |                     | - Concurrent API Tambah   |
  +---------------------------+                     +---------------------------+
```

---

## 3. Proposed Changes

### Component 1: Multi-Selection Core (`DashboardSelection`)

#### [NEW] [dashboard_selection.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_selection.js)
- Manages `selectedPcIds` Set, marquee drag tracking, and keyboard events (`Ctrl`, `Shift`, `Escape`).
- Bounding-box intersection algorithm for marquee drag rectangle vs `.pc-card` elements.
- Renders and updates `#batch-action-toolbar` floating bar.
- Disables interaction on screens `< 1024px` (`isDesktopBreakpoint()`).
- Preserves selection state across periodic `Dashboard.load()` polling data refreshes.

#### [MODIFY] [dashboard_compact.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_compact.js)
- Updates `renderCompactCard(pc)` to check `DashboardSelection.isSelected(pc.id)` and render selection classes (`ring-2 ring-indigo-500 border-indigo-400 bg-indigo-950/20`) and selection check badge `[✓]`.
- Updates click/contextmenu event routing to delegate to `DashboardSelection`.

#### [MODIFY] [index.js (Dashboard)](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/index.js)
- Integrates `DashboardSelection.init()`.
- Updates `showContextMenu(event, pcId)` to display **Batch Context Menu** if multiple PCs are selected.
- Adds batch handler methods:
  - `tutupSesiBatch(sesiIds)`
  - `remoteActionBatch(pcIds, action)`
  - `wolBatch(pcIds)`

---

### Component 2: Batch Modals (`BukaModal` & `TambahModal`)

#### [MODIFY] [modal-buka.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/components/modal-buka.js)
- Supports `BukaModal.openBatch(pcList)`:
  - Header displays multiple PC tags (e.g. `TM-01`, `TM-02`, `TM-03`, `TM-04`, `TM-05` — 5 PC).
  - Guest name input supports prefix pattern with dynamic preview (e.g. `Guest-1`, `Guest-2`, etc.).
  - Total price displays `N × Rp X = Rp Total`.
  - Batch submit executes session creation sequentially/concurrently with progress reporting.

#### [MODIFY] [modal-tambah.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/components/modal-tambah.js)
- Supports `TambahModal.openBatch(pcList)`:
  - Header displays all target active sessions & PCs.
  - Adds chosen billing package / custom duration to each active session simultaneously.
  - Aggregated invoice and receipt summary.

---

### Component 3: Backend Routes & Batch Endpoints

#### [MODIFY] [monitor_routes.py](file:///c:/Project%20GIT/TMBilling/app/routes/monitor/monitor_routes.py)
- Adds batch remote endpoint: `POST /api/v1/kasir/monitor/remote/batch` accepting `{ pc_ids: [1, 2, 3], action: "shutdown"|"restart" }` with audit logging.

#### [MODIFY] [sesi_routes.py](file:///c:/Project%20GIT/TMBilling/app/routes/sesi/sesi_routes.py)
- Adds batch open endpoint: `POST /api/v1/kasir/sesi/buka-guest-batch` accepting `{ pc_kodes: ["TM-01", "TM-02"], paket_id: 1, nama_guest_prefix: "Guest", metode_pembayaran: "Tunai" }`.
- Adds batch close endpoint: `POST /api/v1/kasir/sesi/tutup-batch` accepting `{ sesi_ids: [10, 11, 12] }`.

#### [MODIFY] [api.js](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/core/api.js)
- Exposes `API.sesi.bukaGuestBatch(...)`, `API.sesi.tutupBatch(...)`, `API.monitor.remoteBatch(...)`.

---

## 4. Verification Plan

### Automated Tests
1. `tests/test_batch_sesi_routes.py`:
   - Test opening multiple guest sessions concurrently via `buka-guest-batch`.
   - Test batch closing of active sessions.
   - Test error handling when one PC is already in use while others are empty.
2. `tests/test_batch_remote_routes.py`:
   - Test batch remote shutdown and restart queuing commands for multiple PCs.
   - Test WOL batch endpoint.
3. Run test command:
   ```bash
   .venv\Scripts\python -m pytest tests/test_batch_sesi_routes.py tests/test_batch_remote_routes.py tests/test_google_maps_helper.py tests/test_gmaps_settings_integration.py -v
   ```

### Manual & UI Verification
1. Open Kasir Dashboard on desktop display (>= 1024px).
2. Test `Ctrl + Click` on 3 PC cards -> verify glowing borders, check badges, and floating batch bar.
3. Test `Left Click + Drag` marquee box across 5 PC cards -> verify dynamic rectangle and selection highlight.
4. Right-click on selected cards -> verify Batch Context Menu.
5. Click **Buka Sesi (5 PC)** -> verify modal displays 5 PCs, pick package, submit -> all 5 PCs become active.
6. Select the 5 active PCs -> Right click -> **Tambah Waktu Bersama** -> add 1 hour -> verify all timers updated.
7. Select PCs -> **Shutdown Bersama** -> verify commands dispatched.
8. Switch viewport to mobile (< 1024px) -> verify multi-select marquee is disabled and default touch behavior remains responsive.

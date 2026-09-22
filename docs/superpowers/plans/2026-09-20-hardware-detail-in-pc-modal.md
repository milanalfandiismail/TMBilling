# Implementasi Detail Hardware di Modal PC Dashboard Kasir

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengaktifkan dan mengimplementasikan tampilan informasi Hardware Telemetry & Baseline Spesifikasi pada Modal Detail PC di Dashboard Kasir dengan UI/UX modern dan responsif di seluruh breakpoint (`sm`, `md`, `lg`, `xl`, `2xl`).

**Architecture:** 
- Menambahkan method API client `API.monitor.registerBaseline` pada `api.js`.
- Mengaktifkan tombol "Hardware" pada `#view-action-menu` di `dashboard_detail_modal.js`.
- Menambahkan container `#view-hardware-specs` di dalam modal PC detail dengan sub-komponen: Header Navigasi, Status Protection Badge, Alert Mismatch (jika ada indikasi pencurian/tukar komponen), Grid 2 Kolom untuk breakpoint besar (`lg/xl/2xl`) berisi Metrik Real-time, Komponen Utama, Baseline Terkunci, dan Spesifikasi Terdeteksi Saat Ini.
- Menyediakan tombol aksi cepat "🔄 Update Baseline" dan "Segarkan Data".

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS, Flask Backend REST API (`/api/v1/kasir/monitor/*`).

**Spec:** Permintaan pengguna untuk mengaktifkan tombol hardware pada detail PC dashboard dan membuat tampilan responsif `sm`, `md`, `lg`, `xl`, `2xl`.

## Global Constraints

- Menggunakan design token, font mono (`JetBrains Mono`), dan skema warna gelap (`#111`, `#0f0f0f`, `#1a1a1a`, `#2a2a2a`) yang konsisten dengan Process Monitor dan Remote View.
- Responsif penuh di breakpoint `sm` (<640px), `md` (768px), `lg` (1024px), `xl` (1280px), dan `2xl` (1536px).
- Tidak boleh merusak fungsi yang sudah ada (Process Monitor, Remote View, Wol, Screenshot, Pindah PC, Restart/Shutdown).
- Tetap menjalankan `npm run build:css` setelah menambahkan class Tailwind baru.
- Menggunakan MCP `codebase-memory` untuk memvalidasi coverage dan keterkaitan file.

---

### Task 1: Tambahkan API Client Helper untuk Baseline Hardware

**Files:**
- Modify: `app/static/js/kasir/core/api.js`

**Interfaces:**
- Consumes: Backend endpoint `POST /api/v1/kasir/monitor/register/<pc_id>`
- Produces: `API.monitor.registerBaseline(pcId)`

- [ ] **Step 1: Tambahkan method `registerBaseline` pada object `monitor` di `app/static/js/kasir/core/api.js`**

```javascript
    // 🖥️ HARDWARE MONITOR
    monitor: {
        all: () => API.request('/api/v1/kasir/monitor/all'),
        delete: (id) => API.request(`/api/v1/kasir/monitor/${id}`, { method: 'DELETE' }),
        processesKill: (pcId, processName) => API.request(`/api/v1/kasir/monitor/processes/${pcId}/kill`, {
            method: 'POST',
            body: JSON.stringify({ process_name: processName })
        }),
        registerBaseline: (pcId) => API.request(`/api/v1/kasir/monitor/register/${pcId}`, { method: 'POST' })
    },
```

---

### Task 2: Implementasikan Tampilan & Logika Hardware di `dashboard_detail_modal.js`

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`

**Interfaces:**
- Consumes: `API.monitor.all()`, `API.monitor.registerBaseline(pcId)`, `Modal`, `Toast`
- Produces:
  - `DashboardDetailModal.showHardwareView(pcId, pcKode)`
  - `DashboardDetailModal.backFromHardware()`
  - `DashboardDetailModal.loadHardwareData(pcId, pcKode)`
  - `DashboardDetailModal.renderHardwareView(pcId, pcKode, hardwareData)`
  - `DashboardDetailModal.registerBaselineFromModal(pcId, pcKode)`

- [ ] **Step 1: Aktifkan Tombol Hardware pada `#view-action-menu`**

Ubah tombol disabled hardware (baris 94-99) menjadi tombol interaktif:

```javascript
<button onclick="DashboardDetailModal.showHardwareView(${pc.id}, '${pc.kode}')"
    class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 hover:bg-[#141414] rounded-lg transition-colors group">
    <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] group-hover:border-neutral-500 flex items-center justify-center transition-colors">
        <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
    </div>
    <span class="text-[10px] lg:text-base font-bold text-neutral-400 group-hover:text-neutral-200 uppercase tracking-wider text-center leading-tight transition-colors">Hardware</span>
</button>
```

- [ ] **Step 2: Tambahkan container markup `#view-hardware-specs` ke dalam `#modal-view-container`**

Tambahkan container tampilan hardware di samping `#view-action-menu`, `#view-process-list`, dan `#view-remote-client`:

```html
<div id="view-hardware-specs" class="hidden flex-1 flex flex-col overflow-hidden">
    <!-- Header Sub-View -->
    <div class="px-5 md:px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between shrink-0 bg-[#0c0c0c]">
        <button onclick="DashboardDetailModal.backFromHardware()" class="text-xs lg:text-sm text-neutral-400 hover:text-neutral-200 font-bold transition-colors flex items-center gap-1.5">
            &larr; Kembali
        </button>
        <div id="modal-hw-header-status" class="flex items-center gap-2">
            <!-- Dynamic Status Badge (Protected/Mismatch/Pending) -->
        </div>
    </div>

    <!-- Content Scrollable Body -->
    <div id="modal-hw-content" class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 md:p-6 space-y-4">
        <!-- Dynamic Cards rendered via JS -->
    </div>

    <!-- Footer Action Bar -->
    <div class="p-3.5 md:p-4 border-t border-[#2a2a2a] flex items-center justify-between shrink-0 bg-[#0c0c0c]">
        <button id="btn-hw-update-baseline" onclick="DashboardDetailModal.registerBaselineFromModal(${pc.id}, '${pc.kode}')" class="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs lg:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 font-mono">
            <span>🔄</span> Update Baseline
        </button>
        <button id="btn-hw-refresh" onclick="DashboardDetailModal.loadHardwareData(${pc.id}, '${pc.kode}')" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors font-mono">
            Segarkan Data
        </button>
    </div>
</div>
```

- [ ] **Step 3: Implementasikan fungsi-fungsi kontrol hardware di `DashboardDetailModal`**

Implementasikan:
1. `showHardwareView(pcId, pcKode)`: Sembunyikan `#view-action-menu`, tampilkan `#view-hardware-specs`, lalu panggil `loadHardwareData(pcId, pcKode)`.
2. `backFromHardware()`: Kembalikan tampilan ke `#view-action-menu`.
3. `loadHardwareData(pcId, pcKode)`: Mengambil data dari `API.monitor.all()`, menemukan record yang sesuai dengan `pcId`, lalu memanggil `renderHardwareView`.
4. `renderHardwareView(pcId, pcKode, hwData)`:
   - Render status badge di header (🚨 Swapped / 🛡️ Protected / ⚙️ Menunggu Telemetry).
   - Render mismatch alert banner jika ada indikasi hardware ditukar.
   - Render 2-Column Responsive Grid (`grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5`):
     - **Card 1: Real-time Telemetry & Health** (CPU Usage bar + %, CPU Temp, GPU Temp, Active Window, Last Telemetry Sync).
     - **Card 2: Spesifikasi Komponen Utama** (Processor, Graphic Card, Total RAM, Motherboard, NIC Speed).
     - **Card 3: Baseline Terkunci (Locked Hardware Baseline)** (Motherboard Serial, CPU ID, GPU PNP ID, RAM Serials, Disk Serials).
     - **Card 4: Terdeteksi Saat Ini (Currently Detected Hardware)** (Motherboard Serial, CPU ID, GPU PNP ID, RAM Serials, Disk Serials).
5. `registerBaselineFromModal(pcId, pcKode)`: Konfirmasi admin/owner lalu panggil `API.monitor.registerBaseline(pcId)` dan reload data modal.

---

### Task 3: Build CSS dan Verifikasi Responsivitas Seluruh Breakpoint

**Files:**
- Execute: `npm run build:css`

- [ ] **Step 1: Jalankan kompilasi CSS Tailwind**
- [ ] **Step 2: Verifikasi class responsive `sm`, `md`, `lg`, `xl`, `2xl`**

---

### Task 4: Validasi dengan MCP Codebase Memory

- [ ] **Step 1: Cek coverage dengan `check_index_coverage`**
- [ ] **Step 2: Update reindex jika diperlukan dengan `index_repository`**

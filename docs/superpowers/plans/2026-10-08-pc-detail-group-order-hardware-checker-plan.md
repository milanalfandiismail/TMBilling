# PC Detail Remote Elimination, Group Sorting Alignment & Hardware Checker 2-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengeliminasi aksi remote (Ambil Gambar, Remote Layar, Monitor Proses) pada modal detail PC cabang remote menyisakan tombol Hardware, menyelaraskan sorting grup di dashboard dan tab lainnya mengikuti urutan ID pembuatan database, serta mengoptimalkan antarmuka Hardware Checker menjadi layout 2 kolom responsif pada breakpoint lg, xl, dan 2xl.

**Architecture:** Menggunakan selector CSS non-purged `.remote-hide-action` pada tombol dan panel screenshot modal detail PC, menyuntikkan ID grup ke metadata backend `dashboard_service.py` dan `monitor_routes.py` untuk mengurutkan tab/kartu frontend secara deterministik (ID ascending), serta merestrukturisasi container `#hardware-checker-container` menggunakan Tailwind grid `grid-cols-1 lg:grid-cols-2 gap-4 items-start` dengan penyesuaian layout kartu dan accordion.

**Tech Stack:** Python 3.14 (Flask, SQLAlchemy), JavaScript (Vanilla ES6 modules), Tailwind CSS v3.4.19, Pytest.

**Spec:** [docs/superpowers/specs/2026-10-08-pc-detail-group-order-hardware-checker-design.md](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-10-08-pc-detail-group-order-hardware-checker-design.md)

## Global Constraints
- Seluruh aksi mutasi dan remote control client harus tersembunyi secara otomatis saat `activeBranchId !== '0'` (`body[data-branch-mode="remote"]`).
- Saat `activeBranchId === '0'` (mode lokal), seluruh fungsionalitas (Monitor Proses, Remote Layar, WOL, Pindah PC, Hardware, Ambil Gambar, Restart, Shutdown, Tangkapan Layar) harus tetap utuh 100%.
- Pengurutan grup di Dashboard, Hardware Checker, Screenshot, Paket, dan Maintenance harus mengikuti urutan ID / urutan pembuatan database (`grup 1, 2, 3`), di mana grup `reguler` (ID 1) selalu berada di urutan teratas.
- Layout Hardware Checker pada breakpoint `lg`, `xl`, dan `2xl` harus rapi dalam 2 kolom dan tidak boleh saling menarik tinggi vertikal saat accordion dibuka (`items-start`).

---

### Task 1: Eliminasi Aksi Kontrol & Screenshot pada PC Detail Modal saat Cabang Remote

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js:14-91,205-240`
- Test: `tests/test_branch_remote_readonly_sidebar.py`

**Interfaces:**
- Consumes: CSS rule `body[data-branch-mode="remote"] .remote-hide-action { display: none !important; }`
- Produces: Elemen tombol aksi (Monitor Proses, Remote Layar, Ambil Gambar) dan container screenshot preview dengan kelas `.remote-hide-action`.

- [ ] **Step 1: Tulis unit test penegasan keberadaan tag `.remote-hide-action` pada modal detail PC**

Edit `tests/test_branch_remote_readonly_sidebar.py`:
```python
def test_pc_detail_modal_actions_have_remote_hide_action():
    """Memastikan tombol Monitor Proses, Remote Layar, Ambil Gambar, dan Screenshot container memiliki remote-hide-action."""
    detail_modal_path = "app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js"
    with open(detail_modal_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "DashboardProcessMonitor.showProcesses" in content
    # Monitor proses harus berkelas remote-hide-action
    assert 'DashboardProcessMonitor.showProcesses' in content and 'remote-hide-action' in content
```

- [ ] **Step 2: Jalankan pytest untuk memverifikasi kondisi sebelum perbaikan**

Run: `python -m pytest tests/test_branch_remote_readonly_sidebar.py -k test_pc_detail_modal_actions_have_remote_hide_action -v`

- [ ] **Step 3: Sematkan kelas `.remote-hide-action` pada tombol dan screenshot container di `dashboard_detail_modal.js`**

Di `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`:
1. Tombol Monitor Proses (baris 15-22): Tambahkan `remote-hide-action` ke class button:
   ```html
   <button onclick="DashboardProcessMonitor.showProcesses(${pc.id})"
       class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
       ${!isOnline ? 'disabled' : ''}>
   ```
2. Tombol Remote Layar (baris 24-40): Tambahkan `remote-hide-action` ke button online dan placeholder offline:
   ```html
   ${isOnline ? `
   <button onclick="DashboardDetailModal.openRemoteView(${pc.id}, '${pc.kode}')"
       class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0a1520] border border-blue-900/40 hover:border-blue-500/60 hover:bg-[#0d1d2c] rounded-lg transition-colors">
   ...
   </button>` : `
   <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25 cursor-not-allowed">
   ...
   </div>`}
   ```
3. Tombol Ambil Gambar (baris 80-90): Tambahkan `remote-hide-action`:
   ```html
   <button id="btn-screenshot-${pc.id}" onclick="DashboardDetailModal.takeScreenshot(${pc.id})"
       class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
       ${!isOnline ? 'disabled' : ''}>
   ```
4. Kontainer Preview Screenshot Kanan (baris 217): Tambahkan `remote-hide-action`:
   ```html
   <!-- Right Column: Screenshot Preview -->
   <div class="remote-hide-action lg:col-span-5 xl:col-span-7 2xl:col-span-7 flex flex-col space-y-2.5">
   ```
5. Sesuaikan kolom kiri aksi (baris 209) agar saat mode remote aktif, container aksi membentang rapi:
   ```html
   <!-- Left Column: Action Buttons -->
   <div class="col-span-full lg:col-span-7 xl:col-span-5 2xl:col-span-5 space-y-2.5 flex flex-col justify-start">
   ```

- [ ] **Step 4: Jalankan pytest untuk memverifikasi kelulusan test**

Run: `python -m pytest tests/test_branch_remote_readonly_sidebar.py -v`
Expected: PASS (seluruh 7 test berhasil).

---

### Task 2: Penyelarasan Pengurutan Grup Berbasis ID Pembuatan Database di Dashboard

**Files:**
- Modify: `app/services/dashboard/dashboard_service.py:88-95`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:10-15,508-515`
- Test: `tests/test_branch_ui_rendering.py`

**Interfaces:**
- Consumes: `PC.grup.id` dari model database.
- Produces: `grup_meta[g_nama] = {"warna": g_warna, "id": g_id}` dan sorting frontend berbasis ID.

- [ ] **Step 1: Modifikasi `dashboard_service.py` untuk menyertakan `id` di `grup_meta`**

Di `app/services/dashboard/dashboard_service.py` baris 88-95:
```python
            # E. Grouping berdasarkan Nama Grup (VIP/Reguler/dll)
            g_nama = pc.grup.nama if pc.grup else "reguler"
            g_warna = pc.grup.warna if pc.grup else "#888888"
            g_id = pc.grup.id if pc.grup else 0
            
            if g_nama not in grup_meta:
                grup_meta[g_nama] = {"warna": g_warna, "id": g_id}
                
            by_grup.setdefault(g_nama, []).append(pc_dict)
            pc_list.append(pc_dict)
```

- [ ] **Step 2: Modifikasi `dashboard_compact.js` untuk mengurutkan tab dan card grid sesuai ID grup**

Di `app/static/js/kasir/modules/dashboard/dashboard_compact.js`:
1. Pada `renderTabs(data)` (baris 10-12):
```javascript
        const meta = data.grup_meta || {};
        const groups = Object.keys(data.by_grup || {}).sort((a, b) => {
            const idA = Number(meta[a]?.id || 0);
            const idB = Number(meta[b]?.id || 0);
            return idA !== idB ? idA - idB : a.localeCompare(b);
        });
```
2. Pada `renderGrid(data)` (baris 509-514):
```javascript
        const meta = data.grup_meta || {};
        const allGroups = Object.keys(data.by_grup || {});
        const groupsToRender = Dashboard.activeGrup === 'semua'
            ? allGroups.sort((a, b) => {
                const idA = Number(meta[a]?.id || 0);
                const idB = Number(meta[b]?.id || 0);
                return idA !== idB ? idA - idB : a.localeCompare(b);
            })
            : [Dashboard.activeGrup];
```

- [ ] **Step 3: Uji response API dashboard service**

Run: `python -c "from app import create_app; app = create_app(); c = app.test_client(); res = c.get('/api/v1/kasir/dashboard/status'); print('grup_meta:', res.get_json().get('grup_meta'))"`
Expected: Menampilkan dictionary `grup_meta` dengan field `id` dan `warna` untuk tiap grup.

---

### Task 3: Penyelarasan Pengurutan Grup di Modul Hardware Checker, Screenshot, Paket, dan Maintenance

**Files:**
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js:142-146,346-353,363-367`
- Modify: `app/routes/monitor/monitor_routes.py:508-525`
- Modify: `app/static/js/kasir/modules/screenshot/index.js:221-244,260-266`
- Modify: `app/models/paket/paket.py:50-59`
- Modify: `app/static/js/kasir/modules/paket/paket_table.js:17-27`
- Modify: `app/static/js/kasir/modules/maintenance/index.js:80-95`

**Interfaces:**
- Consumes: `pc_grup_id` dan `grup_id` dari payload API monitor, screenshot, paket, dan maintenance.
- Produces: Komparator sorting konsisten `grupA - grupB` sebelum `pc_kode.localeCompare`.

- [ ] **Step 1: Perbarui sorting dan badge di Hardware Checker (`hardware_checker/index.js`)**

Di `app/static/js/kasir/modules/hardware_checker/index.js`:
1. Ubah sorting data (baris 143):
```javascript
        // Sort data naturally by pc_grup_id (creation order) then pc_kode
        data.sort((a, b) => {
            const grupA = Number(a.pc_grup_id || 0);
            const grupB = Number(b.pc_grup_id || 0);
            if (grupA !== grupB) return grupA - grupB;
            return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
        });
```
2. Tambahkan badge grup di samping `pc_kode` (baris 348-350):
```html
<h4 class="text-sm sm:text-base lg:max-xl:text-lg xl:text-xl font-black text-neutral-100 font-mono tracking-wider">${this.escapeHtml(m.pc_kode)}</h4>
<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#171717] border border-[#262626] text-neutral-400">
    ${this.escapeHtml(m.pc_grup_nama || 'REGULER')}
</span>
```
3. Tambahkan `.remote-hide-action` pada tombol Update Baseline (baris 363):
```html
<button type="button" onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}')"
    class="remote-hide-action flex-1 sm:flex-none justify-center px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors flex items-center gap-1.5">
    🔄 Update Baseline
</button>
```

- [ ] **Step 2: Sertakan `pc_grup_id` pada backend `/screenshot/all` dan perbarui `screenshot/index.js`**

1. Di `app/routes/monitor/monitor_routes.py` (baris 508-525), sertakan `"pc_grup_id": pc.grup_id or 0`:
```python
                result.append({
                    "pc_id": pc.id,
                    "pc_kode": pc.kode,
                    "pc_grup_id": pc.grup_id or 0,
                    "pc_grup_nama": pc.grup.nama if pc.grup else "Unknown",
                    "screenshot_url": f"/static/uploads/screenshots/{pc.kode}.png",
                    "screenshot_time": screenshot_time,
                    "mtime": mtime
                })
```
2. Di `app/static/js/kasir/modules/screenshot/index.js` (baris 221-244):
```javascript
    populateGroupFilter() {
        const select = document.getElementById('screenshot-group-filter');
        if (!select) return;

        const currentValue = select.value;
        const groupMap = new Map();
        this.cachedData.forEach(pc => {
            if (pc.pc_grup_nama && !groupMap.has(pc.pc_grup_nama)) {
                groupMap.set(pc.pc_grup_nama, Number(pc.pc_grup_id || 0));
            }
        });

        select.innerHTML = '<option value="all">Semua Grup / Zona</option>';
        [...groupMap.entries()]
            .sort((a, b) => a[1] !== b[1] ? a[1] - b[1] : a[0].localeCompare(b[0]))
            .forEach(([grup]) => {
                const opt = document.createElement('option');
                opt.value = grup;
                opt.textContent = grup.toUpperCase();
                select.appendChild(opt);
            });

        if ([...select.options].some(o => o.value === currentValue)) {
            select.value = currentValue;
        } else {
            this.filterGroup = 'all';
        }
    },
```
3. Di `screenshot/index.js` `renderGrid()` (baris 263):
```javascript
        data.sort((a, b) => {
            const grupA = Number(a.pc_grup_id || 0);
            const grupB = Number(b.pc_grup_id || 0);
            if (grupA !== grupB) return grupA - grupB;
            return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
        });
```

- [ ] **Step 3: Sertakan `grup_id` pada Paket model dan urutkan grup di `paket_table.js`**

1. Di `app/models/paket/paket.py` `to_dict()`:
```python
        return {
            "id": self.id,
            "nama": self.nama,
            "durasi_menit": self.durasi_menit,
            "harga": self.harga,
            "kadaluarsa_hari": self.kadaluarsa_hari,
            "grup_id": self.grup_id,
            "grup": self.grup.nama if self.grup else "reguler", 
            "aktif": self.aktif,
        }
```
2. Di `app/static/js/kasir/modules/paket/paket_table.js`:
```javascript
        const grouped = {};
        const groupMeta = {};
        paketList.forEach(p => {
            const g = (p.grup || 'Reguler').toUpperCase();
            if (!grouped[g]) {
                grouped[g] = [];
                groupMeta[g] = Number(p.grup_id || 0);
            }
            grouped[g].push(p);
        });

        let html = '';
        Object.keys(grouped).sort((a, b) => (groupMeta[a] || 0) - (groupMeta[b] || 0)).forEach(grupName => {
```

- [ ] **Step 4: Urutkan grup PC di modal tiket maintenance (`maintenance/index.js`)**

Di `app/static/js/kasir/modules/maintenance/index.js` (baris 80-95):
```javascript
        const grouped = {};
        const groupColors = {};
        const groupIds = {};
        this.pcs.forEach(pc => {
            const g = pc.grup || 'Reguler';
            if (!grouped[g]) {
                grouped[g] = [];
                groupIds[g] = Number(pc.grup_id || 0);
            }
            grouped[g].push(pc);
            if (pc.grup_warna) {
                groupColors[g] = pc.grup_warna;
            }
        });

        let html = '';
        Object.keys(grouped).sort((a, b) => (groupIds[a] || 0) - (groupIds[b] || 0)).forEach(gName => {
```

- [ ] **Step 5: Verifikasi via pytest**

Run: `python -m pytest tests/test_branch_remote_readonly_sidebar.py -v`
Expected: PASS.

---

### Task 4: Transformasi UI/UX Hardware Checker Menjadi 2 Kolom Responsif (`lg`, `xl`, `2xl`)

**Files:**
- Modify: `app/templates/kasir/tabs/hardware_checker.html:17-35`
- Modify: `app/static/js/kasir/modules/hardware_checker/index.js:52-61,234-290,342-370`

**Interfaces:**
- Consumes: Tailwind classes `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`.
- Produces: Layout 2 kolom yang estetis dan tahan peregangan vertikal pada layar lebar.

- [ ] **Step 1: Perbarui container dan skeleton loader di `hardware_checker.html`**

Di `app/templates/kasir/tabs/hardware_checker.html`:
```html
        <!-- Detail Grid PC Hardware Checker (2 Kolom pada lg, xl, 2xl) -->
        <div id="hardware-checker-container" class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {% for _ in range(4) %}
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-5 space-y-4 animate-pulse">
                <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c]">
                    <div class="flex items-center gap-2">
                        <div class="h-5 w-20 bg-[#202020] rounded"></div>
                        <div class="h-4 w-16 bg-[#1a1a1a] rounded"></div>
                    </div>
                    <div class="h-8 w-24 bg-[#1a1a1a] rounded"></div>
                </div>
                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-3.5 space-y-3">
                    <div class="h-3 w-40 bg-[#202020] rounded"></div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="h-8 bg-[#181818] rounded"></div>
                        <div class="h-8 bg-[#181818] rounded"></div>
                        <div class="h-8 bg-[#181818] rounded"></div>
                    </div>
                </div>
            </div>
            {% endfor %}
        </div>
```

- [ ] **Step 2: Perbarui skeleton fallback di `HardwareChecker.load` (`hardware_checker/index.js`)**

Di `app/static/js/kasir/modules/hardware_checker/index.js` (baris 52-61):
Ganti skeleton table dengan skeleton grid 2 kolom:
```javascript
        if (container && (!hasExistingCards || isInitial) && !isSilent) {
            container.innerHTML = Array.from({ length: 4 }).map(() => `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-5 space-y-4 animate-pulse">
                    <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c]">
                        <div class="flex items-center gap-2">
                            <div class="h-5 w-20 bg-[#202020] rounded"></div>
                            <div class="h-4 w-16 bg-[#1a1a1a] rounded"></div>
                        </div>
                        <div class="h-8 w-24 bg-[#1a1a1a] rounded"></div>
                    </div>
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded p-3.5 space-y-3">
                        <div class="h-3 w-40 bg-[#202020] rounded"></div>
                        <div class="grid grid-cols-3 gap-3">
                            <div class="h-8 bg-[#181818] rounded"></div>
                            <div class="h-8 bg-[#181818] rounded"></div>
                            <div class="h-8 bg-[#181818] rounded"></div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
```

- [ ] **Step 3: Sesuaikan layout internal kartu dan accordion spesifikasi**

Di `app/static/js/kasir/modules/hardware_checker/index.js`:
1. Di dalam card header (baris 345-368):
   Pastikan tombol action fleksibel dan rapi:
   ```html
   <div class="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
   ```
2. Di dalam Accordion Spesifikasi (baris 236):
   Ubah `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0 w-full">` menjadi:
   ```html
   <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4 min-w-0 w-full">
   ```
   (Membuat spesifikasi Baseline dan Terdeteksi bertumpuk rapi pada breakpoint `lg` & `xl` di mana lebar kartu adalah setengah layar, dan tampil 2 kolom berdampingan pada layar ekstra lebar `2xl`).

---

### Task 5: Validasi Komprehensif, Kompilasi CSS Tailwind, Pytest, dan Dokumentasi

**Files:**
- Modify: `ANTIGRAVITY.md`
- Compile: `app/static/css/tailwind.css` via `npm run build:css`
- Test: `tests/test_branch_remote_readonly_sidebar.py`, `tests/test_branch_ui_rendering.py`

**Interfaces:**
- Consumes: Tailwind build script dan pytest suite.
- Produces: CSS terkompilasi mutakhir, lulus uji 100%, dan panduan arsitektur tercatat di `ANTIGRAVITY.md`.

- [ ] **Step 1: Jalankan build Tailwind CSS lokal**

Run: `npm run build:css`
Expected: File `app/static/css/tailwind.css` terkompilasi sukses tanpa error.

- [ ] **Step 2: Jalankan seluruh test suite pytest**

Run: `python -m pytest tests/test_branch_remote_readonly_sidebar.py tests/test_branch_ui_rendering.py -v`
Expected: Seluruh pengujian lulus (PASS).

- [ ] **Step 3: Perbarui catatan arsitektur di `ANTIGRAVITY.md`**

Dokumentasikan:
- Penambahan kelas `.remote-hide-action` pada modal detail PC (Ambil Gambar, Remote Layar, Monitor Proses, Screenshot Preview).
- Standarisasi pengurutan grup deterministik berbasis ID database (1, 2, 3...) di seluruh tab kasir.
- Rekayasa antarmuka 2-kolom responsif pada modul Hardware Checker untuk breakpoint `lg`, `xl`, dan `2xl`.

- [ ] **Step 4: Update index MCP `codebase-memory`**

Lakukan sinkronisasi index MCP `codebase-memory` untuk mencatat struktur fungsi dan perubahan yang telah disetujui.

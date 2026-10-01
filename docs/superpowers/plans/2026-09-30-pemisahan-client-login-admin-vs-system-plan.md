# Pemisahan Client Login Admin vs System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membedakan identitas client login antara Administrator (`ADMIN`) dan Emergency Maintenance (`SYSTEM`), membatasi context menu dan aksi operasional (restart, shutdown, dll.) pada PC berstatus `SYSTEM`, serta menyediakan aksi tunggal "Clear Sesi System" di dashboard kasir agar tidak tersangkut.

**Architecture:** 
1. Pada backend (Python/Flask), sesi emergency login diidentifikasi sebagai `SYSTEM` (`is_system_mode: true`), membedakannya dari login admin DB resmi (`ADMIN`, `is_admin_mode: true`). Endpoint remote action backend memblokir perintah shutdown/restart jika target PC berada dalam mode `SYSTEM`.
2. Pada frontend dashboard kasir (Vanilla JS/Tailwind), kartu PC merender label dan styling khusus untuk `SYSTEM` (Indigo/Violet) vs `ADMIN` (Amber/Orange). Context menu klik kanan untuk PC `SYSTEM` secara eksklusif hanya menampilkan tombol "Clear Sesi System" dan "Detail PC", tanpa opsi operasional lain (Restart, Shutdown, Buka, Tambah, Refund, Pindah PC, Wake-on-LAN).
3. Client Tauri (Rust) memperlakukan status `system` secara selaras dengan mode admin tanpa memicu error polling.

**Tech Stack:** Python 3.11, Flask, SQLAlchemy, JavaScript (Vanilla ES6), Tailwind CSS, Rust / Tauri v1.

**Spec:** Requirement dari User: Membedakan client login admin vs system, menonaktifkan aksi operasional (restart, shutdown) untuk system, membatasi context menu hanya untuk "Clear Sesi System" agar PC tidak tersangkut.

## Global Constraints
- Bahasa yang digunakan untuk dokumentasi dan komunikasi: Bahasa Indonesia.
- Jangan melakukan git commit sebelum mendapat izin eksplisit dari pengguna.
- Tampilan UI responsif pada breakpoint `lg`, `xl`, dan `2xl`.
- Tidak boleh menggunakan generic AI-slop comments.
- Semua aksi perubahan didukung oleh unit tests (TDD).

---

### Task 1: Backend Model & Service Distinction (Admin vs System)

**Files:**
- Modify: `app/models/pc/pc.py:82-125`
- Modify: `app/services/dashboard/dashboard_service.py:45-80`
- Modify: `app/services/client/client_service.py:200-220`
- Test: `tests/test_system_mode_separation.py`

**Interfaces:**
- Consumes: `Sesi.nama_guest`, `Sesi.tipe`, `PC.is_admin_mode`, `PC.sesi_aktif`
- Produces: `pc_dict['is_system_mode']`, `pc_dict['is_admin_mode']`, `pc_dict['status']` (bernilai `"system"` jika mode system), `pc_dict['is_system']`, `pc_dict['is_admin']`

- [ ] **Step 1: Write the failing test for model & service system mode distinction**

Buat file test `tests/test_system_mode_separation.py`:

```python
import pytest
from app.models import db, PC, Sesi, User, now_local
from app.services import ClientService, SesiService, DashboardService, PCService

def test_system_mode_distinction_in_pc_to_dict_and_dashboard(app_context):
    # Buat PC uji
    pc = PC(kode="PC-TEST-SYS", nama="PC Test System", ip_address="10.10.10.98", mac_address="AA:BB:CC:DD:EE:98")
    db.session.add(pc)
    db.session.commit()

    # Sesi Emergency / System
    token_sys = "sys-token-12345"
    pc.is_admin_mode = True
    sesi_sys = SesiService.buka_admin(pc.id, token_sys, admin_nama="SYSTEM")
    db.session.commit()

    # Cek to_dict
    d = pc.to_dict()
    assert d["is_system_mode"] is True
    assert d["is_admin_mode"] is False
    assert d["status"] == "system"

    # Cek DashboardService get_pc_list
    res = DashboardService.get_pc_list()
    target = next((p for p in res["pc_list"] if p["id"] == pc.id), None)
    assert target is not None
    assert target["is_system_mode"] is True
    assert target["is_admin_mode"] is False
    assert target["status"] == "system"

    # Bersihkan sesi system via reset_admin_mode
    PCService.reset_admin_mode(pc.id, operator="admin")
    d_after = pc.to_dict()
    assert d_after["is_system_mode"] is False
    assert d_after["is_admin_mode"] is False
    assert d_after["status"] == "kosong"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_system_mode_separation.py -v`
Expected: FAIL with KeyError or AssertionError ("is_system_mode" not present or status != "system")

- [ ] **Step 3: Implement model and service changes**

Modifikasi `app/models/pc/pc.py` pada method `to_dict`:
```python
        is_system = False
        is_admin = False
        if s and s.tipe == "admin":
            if (s.nama_guest or "").upper() == "SYSTEM":
                is_system = True
            else:
                is_admin = True
        elif self.is_admin_mode:
            is_admin = True

        status_val = "kosong"
        if s:
            if is_system:
                status_val = "system"
            elif is_admin:
                status_val = "admin"
            else:
                status_val = "terpakai"
        elif is_admin:
            status_val = "admin"

        return {
            "id": self.id,
            "kode": self.kode,
            "nama": self.nama,
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "grup": self.grup.nama if self.grup else "reguler", 
            "grup_warna": self.grup.warna if self.grup else "#888888",
            "zona": self.zona_nama,
            "aktif": self.aktif,
            "status": status_val,
            "sesi_id": s.id if s else None,
            "is_admin_mode": is_admin,
            "is_system_mode": is_system,
            "is_afk": s.is_afk if s else False,
            "screenshot_url": f"/static/uploads/screenshots/{self.kode}.png" if has_screenshot else None,
            "screenshot_time": screenshot_time,
            "pos_x": self.pos_x if self.pos_x is not None else -1,
            "pos_y": self.pos_y if self.pos_y is not None else -1
        }
```

Modifikasi `app/services/dashboard/dashboard_service.py`:
```python
            # Status Admin & System diambil dari DB/to_dict
            pc_dict['is_admin'] = pc_dict.get('is_admin_mode', False)
            pc_dict['is_system'] = pc_dict.get('is_system_mode', False)
```

Modifikasi `app/services/client/client_service.py` di `get_status`:
```python
                if pc.is_admin_mode:
                    is_sys_session = (sesi and (sesi.nama_guest or "").upper() == "SYSTEM")
                    res = {
                        "status": "system" if is_sys_session else "admin",
                        "pc_kode": pc.kode,
                        "shutdown_timer": 0
                    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_system_mode_separation.py -v`
Expected: PASS

---

### Task 2: Backend Operational Protection (Block Remote Restart/Shutdown on SYSTEM)

**Files:**
- Modify: `app/routes/monitor/monitor_routes.py:321-370`
- Test: `tests/test_system_mode_separation.py`

**Interfaces:**
- Consumes: `pc_id`, `action` ("restart", "shutdown")
- Produces: HTTP 403 Forbidden with error message jika PC sedang dalam status SYSTEM

- [ ] **Step 1: Write the failing test for operational blocking on SYSTEM**

Tambahkan fungsi test di `tests/test_system_mode_separation.py`:

```python
def test_remote_action_blocked_on_system_mode(client, app_context):
    pc = PC(kode="PC-TEST-SYS2", nama="PC Test System 2", ip_address="10.10.10.99", mac_address="AA:BB:CC:DD:EE:99")
    db.session.add(pc)
    db.session.commit()

    token_sys = "sys-token-67890"
    pc.is_admin_mode = True
    SesiService.buka_admin(pc.id, token_sys, admin_nama="SYSTEM")
    db.session.commit()

    # Login sebagai kasir/admin di session test
    with client.session_transaction() as sess:
        sess["user_id"] = 1
        sess["user_role"] = "admin"
        sess["shift_id"] = 1
        sess["kasir_username"] = "admin"

    # Test trigger remote restart
    res_restart = client.post(f"/api/v1/kasir/monitor/remote/{pc.id}/restart")
    assert res_restart.status_code == 403
    data_restart = res_restart.get_json()
    assert data_restart["success"] is False
    assert "tidak diizinkan pada PC dalam mode SYSTEM" in data_restart["error"]

    # Test trigger remote shutdown
    res_shutdown = client.post(f"/api/v1/kasir/monitor/remote/{pc.id}/shutdown")
    assert res_shutdown.status_code == 403
    data_shutdown = res_shutdown.get_json()
    assert data_shutdown["success"] is False
    assert "tidak diizinkan pada PC dalam mode SYSTEM" in data_shutdown["error"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_system_mode_separation.py::test_remote_action_blocked_on_system_mode -v`
Expected: FAIL (returns 200 instead of 403)

- [ ] **Step 3: Implement protection in monitor_routes.py**

Modifikasi `app/routes/monitor/monitor_routes.py` pada route `trigger_remote_action`:
```python
        from app.repositories import PCRepository, SesiRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        # Cegah aksi operasional (shutdown/restart) jika PC sedang dalam sesi SYSTEM
        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        is_system = pc.is_admin_mode and sesi and (sesi.nama_guest or "").upper() == "SYSTEM"
        if is_system:
            return jsonify({"success": False, "error": "Aksi operasional (Restart/Shutdown) tidak diizinkan pada PC dalam mode SYSTEM"}), 403
```
Dan pada `trigger_remote_action_batch`:
```python
        # Filter keluar PC yang dalam mode SYSTEM
        filtered_pc_ids = []
        for pid in pc_ids:
            p = PCRepository.get_by_id(pid)
            if not p:
                continue
            s = SesiRepository.get_aktif_by_pc(p.id)
            if p.is_admin_mode and s and (s.nama_guest or "").upper() == "SYSTEM":
                continue
            filtered_pc_ids.append(pid)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_system_mode_separation.py -v`
Expected: PASS

---

### Task 3: Dashboard Card UI Distinction (Admin Mode vs System Mode)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:170-240`
- Modify: `app/static/js/kasir/modules/dashboard/map_view.js:239-255`

**Interfaces:**
- Consumes: `pc.is_system_mode`, `pc.is_admin_mode`, `pc.status`, `sesi.nama_guest`
- Produces: Indigo card & badge "SYSTEM" / "SYSTEM MODE" untuk sesi system, Amber card & badge "ADMIN" / "ADMIN MODE" untuk sesi admin.

- [ ] **Step 1: Update dashboard_compact.js logic**

Perbarui blok render sesi di `app/static/js/kasir/modules/dashboard/dashboard_compact.js`:
```javascript
            } else if (sesi.tipe === 'admin') {
                const isSystem = pc.is_system_mode || pc.status === 'system' || (sesi.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi.member_nama || '').toUpperCase() === 'SYSTEM';
                if (isSystem) {
                    indicatorColorClass = 'text-indigo-400';
                    cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
                    timerStr = 'SYSTEM MODE';
                    memberName = 'SYSTEM';
                    activeAppName = '-';
                } else {
                    indicatorColorClass = 'text-amber-500';
                    cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                    timerStr = 'ADMIN MODE';
                    memberName = sesi.member_nama || 'ADMIN';
                    activeAppName = '-';
                }
            }
```
Dan pada fallback `is_admin_mode` / `is_system_mode`:
```javascript
        } else if (pc.is_system_mode || pc.status === 'system') {
            statusIndicator = '●';
            indicatorColorClass = 'text-indigo-400';
            cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
            timerStr = 'SYSTEM';
            memberName = 'SYSTEM';
            activeAppName = '-';
        } else if (pc.is_admin_mode || pc.status === 'admin') {
            statusIndicator = '●';
            indicatorColorClass = 'text-amber-500';
            cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
            timerStr = 'ADMIN';
            memberName = pc.sesi_detail?.member_nama || pc.sesi_detail?.nama_guest || 'ADMIN';
            activeAppName = '-';
        }
```

- [ ] **Step 2: Update map_view.js status label & color**

Di `app/static/js/kasir/modules/dashboard/map_view.js`:
```javascript
        if (pc.status==='terpakai'&&pc.sesi_detail) {
            var sesi=pc.sesi_detail;
            if ((sesi.tipe||'').toLowerCase()==='admin') {
                var isSys = pc.is_system_mode || pc.status === 'system' || (sesi.nama_guest||'').toUpperCase() === 'SYSTEM' || (sesi.member_nama||'').toUpperCase() === 'SYSTEM';
                return isSys ? { dot:'bg-indigo-400', text:'text-indigo-300', label:'SYSTEM' } : { dot:'bg-amber-400', text:'text-amber-300', label:'ADMIN' };
            }
            ...
        }
        if(pc.is_system_mode || pc.status === 'system') return { dot:'bg-indigo-400', text:'text-indigo-300', label:'SYSTEM' };
        if(pc.is_admin_mode || pc.status === 'admin') return { dot:'bg-amber-400', text:'text-amber-300', label:'ADMIN' };
```

---

### Task 4: Context Menu & Modal Detail Customization for SYSTEM

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js:450-595`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js:155-188`

**Interfaces:**
- Consumes: PC status & flags (`is_system_mode`, `is_admin_mode`)
- Produces: Context menu khusus mode SYSTEM dengan opsi tunggal "Clear Sesi System" dan "Detail PC", tanpa restart/shutdown/operasional lainnya. Fungsi `Dashboard.clearSesiSystem(pcId, sesiId)`.

- [ ] **Step 1: Implement Dashboard.clearSesiSystem in index.js**

Tambahkan method di `app/static/js/kasir/modules/dashboard/index.js`:
```javascript
    async clearSesiSystem(pcId, sesiId = null) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-indigo-400 font-bold uppercase tracking-wider">Clear Sesi System?</p>
                <p class="text-[10px] lg:text-base text-neutral-400 mt-1">Sesi system darurat pada PC ini akan dibersihkan dan PC dikembalikan ke mode Kiosk (Terkunci).</p>
            </div>
        `, async () => {
            try {
                if (sesiId) {
                    await API.sesi.tutup(sesiId);
                }
                const res = await API.request(`/api/v1/kasir/pc/reset-admin/${pcId}`, {
                    method: 'POST'
                });
                if (res && res.error) throw new Error(res.error);
                Toast.success('Sesi system berhasil dibersihkan & PC dikunci');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal membersihkan sesi system');
            }
        });
    },
```

- [ ] **Step 2: Restrict Context Menu for SYSTEM in index.js**

Perbarui `showContextMenu(event, pcId)` di `app/static/js/kasir/modules/dashboard/index.js`:
```javascript
        const pc = this.lastData?.pc_list?.find(p => p.id === pcId);
        if (!pc) return;

        const isSystemMode = pc.is_system_mode || pc.status === 'system' || (pc.sesi_detail?.tipe === 'admin' && ((pc.sesi_detail?.nama_guest || '').toUpperCase() === 'SYSTEM' || (pc.sesi_detail?.member_nama || '').toUpperCase() === 'SYSTEM'));
        const isAdminMode = !isSystemMode && (pc.is_admin_mode || pc.status === 'admin' || pc.sesi_detail?.tipe === 'admin');
        const hasMac = !!pc.mac_address;
        const hasSesi = !isSystemMode && !isAdminMode && !!(pc.sesi_detail && pc.sesi_detail.tipe !== 'admin');

        const menu = document.createElement('div');
        menu.id = 'pc-context-menu';
        menu.className = [
            'fixed z-[9999] min-w-[200px] py-1.5',
            'bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl',
            'animate-in fade-in slide-in-from-top-1 duration-100'
        ].join(' ');

        // JIKA SYSTEM MODE: Context menu eksklusif hanya untuk Clear Sesi System & Detail PC
        if (isSystemMode) {
            menu.innerHTML = `
                <div class="px-4 py-2 border-b border-[#222] mb-1">
                    <div class="flex items-center justify-between">
                        <span class="text-xs lg:text-base font-bold text-indigo-300 font-mono">${pc.kode}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold">SYSTEM</span>
                    </div>
                    <div class="text-[10px] lg:text-xs text-neutral-500 font-mono mt-0.5">${pc.ip_address || 'Tidak ada IP'}</div>
                </div>

                <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.showDetail(${pcId})">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Detail PC</span>
                </button>

                <div class="border-t border-[#222] my-1"></div>

                <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition-colors text-left font-mono"
                        onclick="Dashboard.closeContextMenu(); Dashboard.clearSesiSystem(${pcId}, ${pc.sesi_detail ? pc.sesi_detail.id : 'null'})">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <span class="font-bold">Clear Sesi System</span>
                </button>
            `;
            document.body.appendChild(menu);
            // posisi menu disesuaikan
            ...
            return;
        }
```

- [ ] **Step 3: Update DashboardDetailModal buttons for SYSTEM mode**

Di `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`:
- Jika `isSystemMode`:
  - Tombol aksi admin diganti tombol "Clear Sesi System" (`Dashboard.clearSesiSystem(pc.id, sesi ? sesi.id : null)`).
  - Tombol Restart PC dan Shutdown PC ditampilkan dalam keadaan disabled dengan keterangan `title="Aksi operasional tidak tersedia untuk mode SYSTEM"`.

---

### Task 5: Client Tauri Compatibility Alignment

**Files:**
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/utils/api.rs:355-455`
- Modify: `WarnetAgent/TMBillingTauri/src-tauri/src/commands/auth_commands.rs:30-50`

**Interfaces:**
- Consumes: `emergency_login` response
- Produces: `status: "system"` didukung di client Tauri tanpa error parsing atau polling mismatch.

- [ ] **Step 1: Check emergency response and status parsing in api.rs**

Di `WarnetAgent/TMBillingTauri/src-tauri/src/utils/api.rs`:
- Pastikan pada `emergency_login`, status response dapat mengembalikan `"system"` atau `"admin"`.
- Pada `get_status`, izinkan `status.status == "system"` untuk menjaga `SESSION_ACTIVE = true` dan unlimited remaining seconds.

- [ ] **Step 2: Cargo check validation**

Jalankan `cargo check` di folder `WarnetAgent/TMBillingTauri/src-tauri` untuk memastikan tidak ada kesalahan kompilasi Rust.

---

### Task 6: Comprehensive Verification & Regression Testing

**Files:**
- Test: `tests/test_system_mode_separation.py`
- Test: `tests/test_sorting_ckeditor_admin_session.py`
- Test: `tests/test_emergency_login_auth.py`

- [ ] **Step 1: Run all related backend tests**

Jalankan:
`pytest tests/test_system_mode_separation.py tests/test_sorting_ckeditor_admin_session.py tests/test_emergency_login_auth.py -v`
Expected: All tests PASS.

- [ ] **Step 2: Update index repository in codebase-memory**

Panggil MCP `codebase-memory` `index_repository` untuk menyegarkan graph index codebase setelah perubahan file.

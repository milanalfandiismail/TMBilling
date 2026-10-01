# Rencana Implementasi: Peringatan Penurunan Kecepatan NIC (100 Mbps) pada Card PC Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan efek visual peringatan pada Card PC Dashboard Kasir saat kecepatan LAN PC klien turun (< 1 Gbps, misal 100 Mbps) dengan animasi latar belakang card berdenyut oranye (`animate-pulse-orange-bg` mirip disconnect tapi oranye) serta menggantikan judul proses di Baris 2 dengan label `⚠️ LAN 100 Mbps` berkedip. Ketika kecepatan Gigabit (1 Gbps) kembali normal, card dan judul proses otomatis kembali seperti semula.

**Architecture:** 
1. `tailwind.config.js`: Menambahkan keyframe dan class animasi `animate-pulse-orange-bg` yang menganimasikan background (`#161616` ke `#78350f`) dan border (`#f59e0b` ke `#d97706`).
2. Backend `DashboardService.get_pc_list`: Menyertakan `nic_speed` dari relasi hardware (`pc.hardware.nic_speed`) ke dalam dictionary setiap PC.
3. Frontend `dashboard_compact.js`:
   - Menambahkan deteksi `isNicSpeedDrop(speed)`.
   - Jika PC Online dan mengalami drop speed (< 1 Gbps):
     - `cardBgClass` menggunakan `animate-pulse-orange-bg` (kartu berdenyut oranye).
     - `cardBorderClass = 'border'`.
     - Baris 2 (`row2Html`): Judul proses digantikan dengan teks berkedip oranye `⚠️ LAN [speed]` (contoh: `⚠️ LAN 100 Mbps`).
   - Jika kecepatan normal (≥ 1 Gbps): Efek oranye otomatis hilang dan card kembali ke tampilan normal (hijau/abu-abu dengan judul aplikasi aktif).

**Tech Stack:** Python (Flask, SQLAlchemy), JavaScript (ES6 Vanilla Modules), Tailwind CSS.

---

## Global Constraints

- **Warna Peringatan**: Menggunakan tema oranye/amber (`animate-pulse-orange-bg`, `text-amber-400`, `border-amber-500`), bukan merah (karena merah khusus untuk status PC Terputus / No Heartbeat).
- **Prioritas Tampilan Card**:
  1. `isLostConnection` (Merah berdenyut `animate-pulse-red-bg`, Baris 2: `⚠️ TERPUTUS`).
  2. `isSpeedDrop` (Oranye berdenyut `animate-pulse-orange-bg`, Baris 2: `⚠️ LAN [speed]`).
  3. Status normal (`terpakai` hijau, `afk` amber gelap, `admin` oranye gelap, `kosong` abu-abu).
- **Aturan Eksekusi**: TDD (Test-Driven Development), tidak merusak kompatibilitas data existing, tanpa git commit tanpa persetujuan user.

---

### Task 1: Tailwind CSS - Tambahkan Keyframes & Class Animasi `animate-pulse-orange-bg`

**Files:**
- Modify: `tailwind.config.js:35-44`
- Execute: `npm run build:css`

- [x] **Step 1: Tambahkan keyframe dan animation `pulse-orange-bg` di `tailwind.config.js`**

```javascript
            keyframes: {
                'pulse-red-bg': {
                    '0%, 100%': { backgroundColor: '#161616', borderColor: '#ef4444' },
                    '50%': { backgroundColor: '#7f1d1d', borderColor: '#b91c1c' },
                },
                'pulse-orange-bg': {
                    '0%, 100%': { backgroundColor: '#161616', borderColor: '#f59e0b' },
                    '50%': { backgroundColor: '#78350f', borderColor: '#d97706' },
                }
            },
            animation: {
                'pulse-red-bg': 'pulse-red-bg 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'pulse-orange-bg': 'pulse-orange-bg 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
```

- [x] **Step 2: Jalankan `npm run build:css` untuk mengompilasi CSS**

Jalankan: `npm run build:css`
Ekspektasi: `Done in ... ms` tanpa error.

---

### Task 2: Backend - Tambahkan `nic_speed` pada Payload PC List Dashboard

**Files:**
- Modify: `app/services/dashboard/dashboard_service.py:70-76`
- Test: `tests/test_dashboard_nic_speed.py`

**Interfaces:**
- Produces: `pc_dict['nic_speed']` bertipe `Optional[str]` (contoh: `"100 Mbps"`, `"1.0 Gbps"`, `None`).

- [x] **Step 1: Tulis unit test untuk verifikasi field `nic_speed` di `get_pc_list`**

```python
# tests/test_dashboard_nic_speed.py
import unittest
from app import create_app
from app.models import db, PC, Grup, HardwareMonitor
from app.services.dashboard.dashboard_service import DashboardService

class TestDashboardNicSpeed(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        self.grup = Grup(nama="vip", warna="#8b5cf6")
        db.session.add(self.grup)
        db.session.commit()

        self.pc = PC(kode="PC01", nama="PC 01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=self.grup.id, aktif=True)
        db.session.add(self.pc)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_get_pc_list_includes_nic_speed_when_hardware_present(self):
        hw = HardwareMonitor(pc_id=self.pc.id, nic_speed="100 Mbps", active_window="Dota 2")
        db.session.add(hw)
        db.session.commit()

        res = DashboardService.get_pc_list()
        pc_item = next(p for p in res["pc_list"] if p["id"] == self.pc.id)
        self.assertIn("nic_speed", pc_item)
        self.assertEqual(pc_item["nic_speed"], "100 Mbps")

    def test_get_pc_list_handles_none_nic_speed_when_hardware_absent(self):
        res = DashboardService.get_pc_list()
        pc_item = next(p for p in res["pc_list"] if p["id"] == self.pc.id)
        self.assertIn("nic_speed", pc_item)
        self.assertIsNone(pc_item["nic_speed"])
```

- [x] **Step 2: Jalankan unit test dan pastikan gagal**

Jalankan: `.\.venv\Scripts\python -m pytest tests/test_dashboard_nic_speed.py -v`
Ekspektasi: FAIL dengan KeyError: `'nic_speed'`

- [x] **Step 3: Implementasikan penambahan field `nic_speed` di `dashboard_service.py`**

Modifikasi file `app/services/dashboard/dashboard_service.py`:
```python
            # --- Active Window & Hardware Telemetry for Dashboard Card ---
            pc_dict['active_window'] = pc.hardware.active_window if pc.hardware else ""
            pc_dict['nic_speed'] = pc.hardware.nic_speed if pc.hardware else None
```

- [x] **Step 4: Jalankan unit test dan pastikan lulus**

Jalankan: `.\.venv\Scripts\python -m pytest tests/test_dashboard_nic_speed.py -v`
Ekspektasi: PASS (2 passed)

---

### Task 3: Frontend - Integrasi `animate-pulse-orange-bg` & Peringatan Speed Drop di Card PC

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js`

**Interfaces:**
- Consumes: `pc.nic_speed`, `pc.online`, `pc.status_koneksi`.
- Produces: Card PC dengan background oranye berdenyut dan Baris 2 teks `⚠️ LAN [speed]` saat koneksi drop ke < 1 Gbps.

- [x] **Step 1: Tambahkan helper fungsi `isNicSpeedDrop` pada modul `dashboard_compact.js`**

```javascript
    isNicSpeedDrop(speed) {
        if (!speed || speed === '-' || speed === 'Unknown') return false;
        const s = String(speed).toLowerCase();
        let isGigabitOrMore = false;
        if (s.includes('gbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1.0;
        } else if (s.includes('mbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1000.0;
        }
        return !isGigabitOrMore;
    },
```

- [x] **Step 2: Terapkan efek oranye berdenyut pada Card PC dan Baris 2 di `renderCompactCard`**

```javascript
        const isSpeedDrop = !isLostConnection && isOnline && this.isNicSpeedDrop(pc.nic_speed);

        // Jika koneksi drop ke 100 Mbps dan tidak terputus, aktifkan animasi card oranye berdenyut
        if (isSpeedDrop) {
            cardBgClass = 'animate-pulse-orange-bg';
            cardBorderClass = 'border';
            borderStyle = '';
        }

        // Row 2 styling: Prioritas Terputus (Merah) -> Speed Drop (Oranye) -> AFK -> Judul Proses Normal
        let row2Html = '';
        if (isLostConnection) {
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-red-400 font-bold truncate mt-0.5 animate-pulse" title="⚠️ TERPUTUS">⚠️ TERPUTUS</div>`;
        } else if (isSpeedDrop) {
            const displaySpeed = pc.nic_speed || '100 Mbps';
            const tooltipTitle = `⚠️ Kecepatan LAN Drop: ${displaySpeed} (Normal: 1 Gbps) | Proses: ${pc.active_window || '-'}`;
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5 animate-pulse" title="${tooltipTitle}">⚠️ LAN ${displaySpeed}</div>`;
        } else if (isActive && sesi && isAfk) {
            const afkText = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5" title="${afkText}">${afkText}</div>`;
        } else {
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-neutral-400 truncate mt-0.5" title="${activeAppName || '-'}">${activeAppName || '-'}</div>`;
        }
```

---

### Task 4: Verifikasi Penuh, Build CSS & Uji Regresi

**Files:**
- Execute: `npm run build:css`
- Test: Seluruh unit test suite `pytest`
- Codebase-memory: `index_repository`

- [x] **Step 1: Jalankan build asset CSS**
Jalankan: `npm run build:css`

- [x] **Step 2: Jalankan seluruh test suite pytest**
Jalankan: `.\.venv\Scripts\python -m pytest`
Ekspektasi: Seluruh test (251+) passed 100%.

- [x] **Step 3: Update index codebase-memory**
Panggil `index_repository` via MCP `codebase-memory`.

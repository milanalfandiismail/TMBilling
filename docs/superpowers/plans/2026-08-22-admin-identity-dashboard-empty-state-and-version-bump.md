# Admin Identity, Dashboard Empty State & Version Bump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan identitas admin sebenarnya dari database (dan `SYSTEM` untuk emergency user), menangani empty state dashboard tanpa error merah saat PC/grup belum ada data, serta melakukan version bump terpadu (Web 155, Tauri 1.5.5, Rust 1.5.5).

**Architecture:** 
- Identitas Admin: Mengalirkan `nama_lengkap` dari model database `User` (`role == 'admin'`) ke session, sesi admin PC, client Tauri, dan dashboard card. Untuk Emergency User, identitas diseragamkan menjadi `SYSTEM`.
- Dashboard Empty State: Menghapus pelemparan error sintetis di frontend (`index.js`), sehingga payload kosong (`by_grup: {}`) menghasilkan render komponen empty state bernada netral (`text-neutral-400` / `text-neutral-500`) tanpa memicu banner error merah.
- Version Bump: Sinkronisasi seluruh asset cache-busting web ke `?v=155`, source version Flask ke `1.5.5`, serta konfigurasi Tauri dan Cargo ke `1.5.5`.

**Tech Stack:** Python (Flask, SQLAlchemy, Pytest), JavaScript (Vanilla ES6, Tailwind CSS), Rust (Tauri 1.5).

**Spec Reference:** User Requirements in `# PLAN — Admin Identity, Dashboard Empty State & Version Bump`.

## Global Constraints

- Wajib menggunakan Plugin Superpowers + MCP untuk seluruh fase pengerjaan.
- Hak akses dan validasi role server-side tidak boleh diubah (kasir tetap tidak memiliki izin admin bypass).
- Emergency user wajib beridentitas `SYSTEM`.
- Empty state bukan merupakan error aplikasi dan dilarang menggunakan warna merah (`text-red-*`).
- Versioning: Web = `155`, Tauri = `1.5.5`, Rust package = `1.5.5`.

---

### Task 1: Backend Admin Identity & Emergency User Refinement

**Files:**
- Modify: `app/services/client/client_service.py:270-320`
- Modify: `app/services/sesi/sesi_service.py:118-132`
- Modify: `app/services/dashboard/dashboard_service.py:70-85`
- Test: `tests/test_admin_identity_and_emergency.py`

**Interfaces:**
- `ClientService.admin_login(ip_address, mac_address, username, password)`: Mengembalikan dictionary dengan data `user`: `id`, `username`, `nama_lengkap`, `role`.
- `ClientService.emergency_login(ip_address, mac_address)`: Mengaktifkan mode admin dengan nama `SYSTEM`.
- `SesiService.buka_admin(pc_id, token_sesi, admin_nama)`: Menyimpan `admin_nama` ke dalam kolom nama sesi.

- [ ] **Step 1: Write the failing unit tests for admin identity and emergency user**

```python
# tests/test_admin_identity_and_emergency.py
import pytest
from app.models import db, PC, User, Sesi, Grup
from app.services.client.client_service import ClientService
from app.services.dashboard.dashboard_service import DashboardService

def test_admin_login_returns_real_database_name(app, client):
    with app.app_context():
        grup = Grup(nama="reguler", tarif_per_jam=5000, warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-99", ip_address="192.168.1.99", mac_address="AA:BB:CC:DD:EE:99", grup_id=grup.id, aktif=True)
        admin = User(username="milan_admin", nama_lengkap="Milan Alfandi", role="admin", aktif=True)
        admin.set_password("password123")
        db.session.add_all([pc, admin])
        db.session.commit()

        res = ClientService.admin_login("192.168.1.99", "AA:BB:CC:DD:EE:99", "milan_admin", "password123")
        assert res["success"] is True
        assert "user" in res
        assert res["user"]["nama_lengkap"] == "Milan Alfandi"
        assert res["user"]["username"] == "milan_admin"
        assert res["user"]["role"] == "admin"

        # Verifikasi data sesi admin di dashboard
        data = DashboardService.get_pc_list()
        pc_item = next(p for p in data["pc_list"] if p["kode"] == "PC-99")
        assert pc_item["is_admin"] is True
        assert pc_item["sesi_detail"]["member_nama"] == "Milan Alfandi"

def test_kasir_role_cannot_perform_admin_login(app, client):
    with app.app_context():
        grup = Grup.query.first() or Grup(nama="reguler", tarif_per_jam=5000)
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-98", ip_address="192.168.1.98", mac_address="AA:BB:CC:DD:EE:98", grup_id=grup.id, aktif=True)
        kasir = User(username="kasir_user", nama_lengkap="Staff Kasir", role="kasir", aktif=True)
        kasir.set_password("password123")
        db.session.add_all([pc, kasir])
        db.session.commit()

        with pytest.raises(ValueError, match="Invalid admin credentials"):
            ClientService.admin_login("192.168.1.98", "AA:BB:CC:DD:EE:98", "kasir_user", "password123")

def test_emergency_login_sets_system_identity(app, client):
    with app.app_context():
        grup = Grup.query.first() or Grup(nama="reguler", tarif_per_jam=5000)
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-97", ip_address="192.168.1.97", mac_address="AA:BB:CC:DD:EE:97", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        res = ClientService.emergency_login("192.168.1.97", "AA:BB:CC:DD:EE:97")
        assert res["success"] is True

        data = DashboardService.get_pc_list()
        pc_item = next(p for p in data["pc_list"] if p["kode"] == "PC-97")
        assert pc_item["is_admin"] is True
        if pc_item.get("sesi_detail"):
            assert pc_item["sesi_detail"]["member_nama"] == "SYSTEM"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_admin_identity_and_emergency.py`
Expected: FAIL (missing `user` key or `member_nama` mismatch)

- [ ] **Step 3: Implement minimal backend code in services**

Update `app/services/sesi/sesi_service.py`:
```python
    @staticmethod
    def buka_admin(pc_id, token_sesi, admin_nama="ADMIN"):
        """Membuka sesi khusus admin untuk maintenance PC."""
        sesi_baru = Sesi(
            tipe="admin",
            pc_id=pc_id,
            status="aktif",
            is_admin=True,
            nama_guest=admin_nama,
            token_sesi=token_sesi,
            waktu_mulai_sesi=now_local()
        )
        db.session.add(sesi_baru)
        db.session.commit()
        return sesi_baru
```

Update `app/services/client/client_service.py`:
```python
        display_name = user.nama_lengkap or user.username
        SesiService.buka_admin(pc.id, token, admin_nama=display_name)
        ...
        return {
            "success": True, 
            "token_sesi": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "nama_lengkap": display_name,
                "role": user.role
            }
        }
```

Update `app/models/sesi/sesi.py` `to_dict()`:
Pastikan ketika `tipe == 'admin'`, `member_nama` mengembalikan `self.nama_guest or 'ADMIN'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest tests/test_admin_identity_and_emergency.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_admin_identity_and_emergency.py app/services/client/client_service.py app/services/sesi/sesi_service.py app/models/sesi/sesi.py
git commit -m "feat(auth): return real admin database identity and set SYSTEM identity on emergency sessions"
```

---

### Task 2: Tauri Client & Dashboard Admin Display Updates

**Files:**
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/utils/api.rs:305-395`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/commands/auth_commands.rs:15-40`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/src/services/polling.rs:30-45`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:115-130`

**Interfaces:**
- `AdminLoginResponse`: Struct deserialisasi menyertakan `user` info.
- Tauri `auth_commands.rs`: Mengembalikan `member_name: "SYSTEM"` saat mode emergency login.
- `dashboard_compact.js`: Menampilkan nama admin/SYSTEM asli pada kartu PC di mode admin.

- [ ] **Step 1: Update Tauri Rust API structs and emergency identity**

Di `WarnetClient/TMBillingTauri/src-tauri/src/utils/api.rs`:
```rust
#[derive(Debug, Deserialize)]
pub struct AdminUserData {
    pub id: Option<i64>,
    pub username: Option<String>,
    pub nama_lengkap: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub token_sesi: Option<String>,
    pub user: Option<AdminUserData>,
}
```
Dan pada `emergency_login` di `api.rs` dan `auth_commands.rs`, pastikan nama diset `"SYSTEM"`.

- [ ] **Step 2: Update dashboard compact card display**

Di `app/static/js/kasir/modules/dashboard/dashboard_compact.js`:
```javascript
        } else if (pc.is_admin_mode) {
            statusIndicator = '●';
            indicatorColorClass = 'text-amber-500';
            cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
            timerStr = 'ADMIN';
            memberName = pc.sesi_detail?.member_nama || pc.sesi_detail?.nama_guest || 'ADMIN';
            activeAppName = '-';
        }
```

- [ ] **Step 3: Commit**

```bash
git add WarnetClient/TMBillingTauri/src-tauri/src/utils/api.rs WarnetClient/TMBillingTauri/src-tauri/src/commands/auth_commands.rs WarnetClient/TMBillingTauri/src-tauri/src/services/polling.rs app/static/js/kasir/modules/dashboard/dashboard_compact.js
git commit -m "feat(ui): display real admin name and SYSTEM on Tauri overlay and dashboard cards"
```

---

### Task 3: Dashboard Empty State Handling (Neutral & Error-Free)

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js:30-46`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:290-302`
- Test: Manual browser check & API mock test

**Interfaces:**
- `Dashboard.load()`: Berhasil memuat tanpa exception saat `data.by_grup` kosong (`{}`).
- `CompactGrid.render()`: Merender UI empty state netral bertema noir (`text-neutral-400` / `text-neutral-500`).

- [ ] **Step 1: Remove artificial exception in Dashboard.load()**

Di `app/static/js/kasir/modules/dashboard/index.js`:
```javascript
    async load() {
        const container = document.getElementById('pc-area');
        try {
            const data = await API.dashboard.pcList();
            if (!data || typeof data.by_grup === 'undefined') throw new Error('Data format invalid - missing by_grup');
            this.lastData = data;
            this._render(data);
            this.updateTime();
        } catch (err) {
            console.error('[Dashboard] Error:', err);
            if (container) {
                container.innerHTML = `<div class="text-center py-20 text-red-400 text-sm">Gagal memuat dashboard: ${err.message}<br><button onclick="Dashboard.load()" class="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs lg:text-base font-semibold">Coba Lagi</button></div>`;
            }
        }
    },
```

- [ ] **Step 2: Enhance empty state UI in CompactGrid.render()**

Di `app/static/js/kasir/modules/dashboard/dashboard_compact.js`:
```javascript
        const emptyStateHtml = `
            <div class="flex flex-col items-center justify-center py-24 text-neutral-500">
                <div class="w-12 h-12 rounded-full bg-[#141414] border border-[#222] flex items-center justify-center mb-3 text-neutral-500 text-xl">
                    🖥️
                </div>
                <p class="text-xs lg:text-base font-bold uppercase tracking-wider text-neutral-400">Belum Ada Data PC</p>
                <p class="text-[10px] lg:text-base text-neutral-600 mt-1">Tambahkan unit PC dan grup di tab pengaturan untuk mulai memonitor</p>
            </div>
        `;

        container.innerHTML = html || emptyStateHtml;
```

- [ ] **Step 3: Verify with empty data scenario and commit**

```bash
git add app/static/js/kasir/modules/dashboard/index.js app/static/js/kasir/modules/dashboard/dashboard_compact.js
git commit -m "fix(dashboard): handle empty PC data gracefully with neutral empty-state UI instead of error"
```

---

### Task 4: Global Version Bump (Web 155, Tauri 1.5.5, Rust 1.5.5)

**Files:**
- Modify: `app/config.py:38`
- Modify: `app/templates/kasir/base.html:9-165`
- Modify: `app/templates/public/member/login.html:104`
- Modify: `app/templates/public/member/dashboard.html:361`
- Modify: `package.json:3`
- Modify: `package-lock.json:3,9`
- Modify: `WarnetClient/TMBillingTauri/package.json:3`
- Modify: `WarnetClient/TMBillingTauri/package-lock.json:3,9`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/tauri.conf.json:11`
- Modify: `WarnetClient/TMBillingTauri/src-tauri/Cargo.toml:3`

**Interfaces:**
- Web cache-busting query strings: `?v=155`.
- Python Backend Config: `VERSION = "1.5.5"`.
- Tauri App & Rust Cargo: `version = "1.5.5"`.

- [ ] **Step 1: Update asset version queries in HTML templates**
Ganti seluruh `?v=153` dan `?v=154` pada script/link tags di `base.html`, `login.html`, dan `dashboard.html` menjadi `?v=155`.

- [ ] **Step 2: Update configuration files**
- `app/config.py`: `VERSION = "1.5.5"`
- `package.json` & `package-lock.json`: `"version": "1.5.5"`
- `WarnetClient/TMBillingTauri/src-tauri/Cargo.toml`: `version = "1.5.5"`
- `WarnetClient/TMBillingTauri/src-tauri/tauri.conf.json`: `"version": "1.5.5"`

- [ ] **Step 3: Rebuild Tailwind CSS**
Run: `node node_modules\tailwindcss\lib\cli.js -i ./app/static/css/input.css -o ./app/static/css/tailwind.css --minify`

- [ ] **Step 4: Commit**

```bash
git add app/config.py app/templates/kasir/base.html app/templates/public/member/login.html app/templates/public/member/dashboard.html package.json package-lock.json WarnetClient/TMBillingTauri/package.json WarnetClient/TMBillingTauri/package-lock.json WarnetClient/TMBillingTauri/src-tauri/tauri.conf.json WarnetClient/TMBillingTauri/src-tauri/Cargo.toml app/static/css/tailwind.css
git commit -m "chore(release): bump version to 1.5.5 (web asset cache v155, tauri/rust 1.5.5)"
```

---

### Task 5: Full Test Suite, Repository Indexing & Final Verification

**Files:**
- All tests in `tests/`
- MCP `index_repository`

- [ ] **Step 1: Run complete Pytest test suite**
Run: `& "C:\Project GIT\TMBilling\.venv\Scripts\python.exe" -m pytest`
Expected: 100% tests pass.

- [ ] **Step 2: Execute MCP index_repository**
Call MCP `codebase-memory:index_repository` on `c:\Project GIT\TMBilling`.

- [ ] **Step 3: Push changes to branch**
Run: `git push origin feature/vnc-auth-and-web-file-explorer`

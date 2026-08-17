# Audit Log Human-Readable Engine & Role Kasir RBAC Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun formatter human-readable untuk Audit Log (menghilangkan tampilan raw JSON pada refund dan seluruh event lainnya baik di web UI maupun PDF export) serta melakukan hardening RBAC untuk membatasi sidebar dan akses role Kasir hanya pada 5 menu resmi dengan proteksi frontend & backend yang ketat.

**Architecture:** Frontend Modular Formatter Engine (`LogFormatter` di `log/index.js`) yang memproses payload `detail_json` secara rekursif dan terstruktur. Backend route protection menggunakan decorator `@admin_required` pada blueprint routes Flask, dan sidebar Jinja2 conditional rendering berdasarkan `session.kasir_role`.

**Tech Stack:** Python (Flask), Vanilla JavaScript, Jinja2, HTML5, Tailwind CSS, ReportLab (PDF Export).

**Spec:** [`docs/superpowers/specs/2026-08-15-audit-log-and-kasir-rbac-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-15-audit-log-and-kasir-rbac-design.md)

---

## Global Constraints
- **Sidebar & Tab `Dashboard` TIDAK BOLEH DIUBAH SAMA SEKALI.**
- **Sidebar Role Kasir Hanya 5 Menu:**
  1. `Dashboard`
  2. `Operasional & POS`
  3. `Data Master`
  4. `Laporan Keuangan`
  5. `Dokumentasi & Tutorial`
- **Permission Data Master Kasir TIDAK BOLEH DIPERLUAS:** Member tetap CRU (tidak bisa hapus), Paket/PC/Grup/Game tetap Read-Only.
- **Audit Log Human-Readable:** Tidak boleh menampilkan raw JSON di UI utama untuk `refund`, `delete_struk`, `edit_paket`, maupun event umum lainnya.
- **Robustness:** Formatter wajib menangani payload `Object`, `Array`, `JSON string`, `null`, `undefined`, empty payload, dan nested data tanpa error.

---

### Task 1: Bangun Modular `LogFormatter` di Frontend (`log/index.js`)

**Files:**
- Modify: `app/static/js/kasir/modules/log/index.js:50-80`

**Interfaces:**
- Produces: `LogFormatter.format(detailJson, action, detail)` -> Returns HTML string formatted cleanly.

- [x] **Step 1: Definisikan objek `LogFormatter` dengan helper parsing & formatters**
Implementasikan fungsi:
1. `normalize(detailJson)`: mengurai string JSON menjadi object/array jika berupa string.
2. `formatCurrency(val)`: memformat angka menjadi format rupiah `Rp XX.XXX`.
3. `formatKey(key)`: mengubah snake_case/camelCase menjadi Title Case yang mudah dibaca.
4. `formatRefund(data)`: handler spesifik event `REFUND_PAKET` & `TRANSAKSI (REFUND)` yang menampilkan No Nota Refund, No Nota Asli, Jumlah Pengembalian, Saldo/Durasi Sebelum $\rightarrow$ Sesudah, dan Identitas Pelanggan.
5. `formatDeleteStruk(data)`: handler spesifik `DELETE_STRUK`.
6. `formatEditPaket(data)`: handler spesifik diff perubahan paket.
7. `formatGenericObject(obj, depth)`: recursive key-value formatter dengan card/badge berbingkai lembut.
8. `formatGenericArray(arr, depth)`: list tag / badge formatter.
9. `renderRawToggle(rawStr)`: subtle expandable accordion `[+ Raw JSON]` untuk kebutuhan audit teknis.

- [x] **Step 2: Hubungkan `LogFormatter.format()` ke dalam method `Log.render()`**
Ganti baris `detailJsonHtml` di `app/static/js/kasir/modules/log/index.js` agar memanggil `LogFormatter.format(log.detail_json, log.action, log.detail)`.

- [x] **Step 3: Uji visual rendering `LogFormatter`**
Pastikan event dengan dan tanpa `detail_json` ter-render sempurna tanpa error JavaScript di console.

- [x] **Step 4: Commit perubahan Task 1**
```bash
git add app/static/js/kasir/modules/log/index.js
git commit -m "feat(log): implement human-readable LogFormatter engine for audit log"
```

---

### Task 2: Human-Readable Formatting pada PDF Export (`pdf_export_service.py`)

**Files:**
- Modify: `app/services/report/pdf_export_service.py:480-495`

- [x] **Step 1: Perbaiki parser `detail_json` di `export_audit_pdf`**
Alih-alih langsung melakukan `json.dumps(det_json, indent=2)`, lakukan parsing:
- Jika dict `REFUND_PAKET` / `TRANSAKSI`: Formatkan `Nota Refund: {nota}, Jumlah: Rp {jumlah:,}, Saldo/Durasi: {sebelum}m -> {sesudah}m`.
- Jika dict generik: Iterasi key-value pairs dan formatkan ke baris teks `<b>Key:</b> Value`.
- Jika string/list: Konversi secara bersih tanpa kurung kurawal berantakan.

- [x] **Step 2: Verifikasi syntax Python**
```bash
python -m py_compile app/services/report/pdf_export_service.py
```

- [x] **Step 3: Commit perubahan Task 2**
```bash
git add app/services/report/pdf_export_service.py
git commit -m "feat(report): format audit log detail_json human-readable in PDF export"
```

---

### Task 3: Isolasi Sidebar Kasir Menjadi 5 Menu (`sidebar.html`)

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`

- [x] **Step 1: Kunci section `Sistem & Utilitas` (`system`)**
Bungkus blok `<!-- 7. Sistem & Utilitas -->` (baris 186–231) dengan `{% if session.get('kasir_role') == 'admin' %} ... {% endif %}`.

- [x] **Step 2: Kunci section `Ekstensi & Plugin` (`plugins`)**
Bungkus blok `<!-- 9. Ekstensi & Plugins -->` (baris 318–348) dengan `{% if session.get('kasir_role') == 'admin' %} ... {% endif %}`.

- [x] **Step 3: Verifikasi 5 menu tersisa untuk Kasir**
Pastikan urutan menu yang tampil untuk role Kasir hanya:
1. `Dashboard`
2. `Operasional & POS`
3. `Data Master`
4. `Laporan Keuangan`
5. `Dokumentasi & Tutorial`

- [x] **Step 4: Commit perubahan Task 3**
```bash
git add app/templates/kasir/components/sidebar.html
git commit -m "security(sidebar): restrict kasir sidebar visibility to 5 core menus only"
```

---

### Task 4: Frontend Navigation Guard di `App.switchTab()` (`app.js`)

**Files:**
- Modify: `app/static/js/kasir/app.js:91-106`

- [x] **Step 1: Perluas daftar `kasirOnlyRestricted` di `App.switchTab`**
Tambahkan tab-tab berikut ke dalam array `kasirOnlyRestricted`:
```javascript
const kasirOnlyRestricted = [
    'user', 'log',
    'server_statistic', 'monitor', 'hardware_checker', 'uptime', 'maintenance', 'screenshot', 'blackout', 'remote_server',
    'settings', 'settings_general', 'settings_payment', 'settings_kiosk', 'settings_tv', 
    'settings_cloudflare_tunnel', 'settings_cloud_backup', 'settings_local_backup', 
    'settings_db_cleanup', 'settings_scheduler', 'settings_migration', 'whitelist_ip',
    'mikrotik', 'analytics', 'plugins', 'plugin-spa'
];
```

- [x] **Step 2: Uji guard `switchTab`**
Pastikan jika user ber-role `kasir` mencoba memanggil `App.switchTab('server_statistic')` atau tab admin lainnya, akses ditolak dengan `Toast.error` dan kembali ke tab `dash`.

- [x] **Step 3: Commit perubahan Task 4**
```bash
git add app/static/js/kasir/app.js
git commit -m "security(navigation): harden frontend tab switching guard for kasir role"
```

---

### Task 5: Backend API Route Hardening (`@admin_required`)

**Files:**
- Modify: `app/routes/report/report_routes.py`
- Modify: `app/routes/dashboard/dashboard_routes.py`
- Modify: `app/routes/monitor/monitor_routes.py`

- [x] **Step 1: Pasang `@admin_required` pada endpoint log & blackout di `report_routes.py`**
- `@report_api_bp.route("/log", methods=["GET"])` -> tambahkan `@admin_required`
- `@report_api_bp.route("/log/clear", methods=["POST"])` -> tambahkan `@admin_required`
- `@report_api_bp.route("/log/export", methods=["GET"])` -> tambahkan `@admin_required`
- `@report_api_bp.route("/export/audit-pdf", methods=["GET"])` -> tambahkan `@admin_required`
- `@report_api_bp.route("/blackout-log", methods=["GET"])` -> tambahkan `@admin_required`

- [x] **Step 2: Pasang `@admin_required` pada server monitor di `dashboard_routes.py`**
- `@dashboard_api_bp.route("/server-metrics", methods=["GET"])` -> tambahkan `@admin_required`

- [x] **Step 3: Pasang `@admin_required` pada kontrol hardware/remote di `monitor_routes.py`**
- `/processes/<int:pc_id>/kill` -> tambahkan `@admin_required`
- `/<int:hardware_id>` (DELETE) -> tambahkan `@admin_required`
- `/screenshot/trigger/<int:pc_id>` -> tambahkan `@admin_required`
- `/remote/<int:pc_id>/<string:action>` -> tambahkan `@admin_required`
- `/register/<int:pc_id>` -> tambahkan `@admin_required`

- [x] **Step 4: Verifikasi kompilasi Python**
```bash
python -m py_compile app/routes/report/report_routes.py app/routes/dashboard/dashboard_routes.py app/routes/monitor/monitor_routes.py
```

- [x] **Step 5: Commit perubahan Task 5**
```bash
git add app/routes/report/report_routes.py app/routes/dashboard/dashboard_routes.py app/routes/monitor/monitor_routes.py
git commit -m "security(api): add admin_required decorators to audit log and system utility endpoints"
```

---

### Task 6: Testing Menyeluruh & Verifikasi RBAC & Audit Log

**Files:**
- Test execution script / manual verification checklist

- [x] **Step 1: Test Formatter Audit Log**
- Uji payload Refund Guest & Member.
- Uji payload Delete Struk & Edit Paket.
- Uji payload generic Object, Array, JSON string, null/undefined, dan empty.
- Verifikasi tidak ada raw JSON berantakan di UI utama log.

- [x] **Step 2: Negative Security Testing Role Kasir**
- Verifikasi sidebar Kasir hanya menampilkan 5 menu resmi.
- Verifikasi tab admin ditolak oleh frontend guard `App.switchTab`.
- Verifikasi endpoint API admin me-return status `403 Forbidden` saat diakses dengan session Kasir.
- Verifikasi permission Data Master Kasir tetap konsisten (Member = CRU, lainnya = Read-Only).

- [x] **Step 3: Regression Testing Role Admin**
- Verifikasi seluruh menu, tab, dan fungsi untuk Admin tetap bekerja normal tanpa degradasi fitur.

- [x] **Step 4: Commit dokumentasi & checklist plan final**
```bash
git add docs/superpowers/plans/2026-08-15-audit-log-and-kasir-rbac-plan.md
git commit -m "docs(superpowers): complete plan for audit log formatter and kasir rbac"
```

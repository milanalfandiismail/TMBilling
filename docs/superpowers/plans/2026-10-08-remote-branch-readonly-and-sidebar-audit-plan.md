# Rencana Implementasi: Audit Cabang Remote, Penataan Sidebar & Mode Read-Only Terpadu

> **Untuk Pekerja Agen:** REQUIRED SUB-SKILL: Gunakan superpowers:subagent-driven-development atau superpowers:executing-plans untuk mengimplementasikan rencana ini tugas demi tugas. Setiap langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Menerapkan penataan visibilitas menu sidebar saat mengontrol cabang remote, menegakkan mode Read-Only menyeluruh (anti-mutasi) di frontend & backend relay, serta memperbaiki tuntas bug pagination hantu (`1 / 63`) dan sinkronisasi data pada tab Riwayat & Struk.

**Arsitektur:** 
1. Penambahan selektor kelas CSS `.sidebar-remote-hidden` dan `.remote-hide-action` pada template sidebar dan komponen aksi CRUD kasir.
2. Dinamisasi visibilitas via `BranchManager.updateBrandAndSidebarVisibility()` dan penambahan atribut `data-branch-mode="remote"` pada `document.body`.
3. Pencegahan operasi mutasi (POST, PUT, DELETE, PATCH) di backend reverse proxy relay (`BranchProxyService.relay_request`).
4. Perbaikan logika reset dan render pagination pada `app/static/js/kasir/modules/struk/index.js`.

**Tech Stack:** JavaScript (ES6+), Flask (Python 3), Jinja2 HTML, Tailwind CSS, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-08-remote-branch-readonly-and-sidebar-audit-design.md`](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-10-08-remote-branch-readonly-and-sidebar-audit-design.md)

## Batasan Global
- Dilarang merusak kompatibilitas menu pada mode cabang lokal (Admin lokal wajib tetap melihat seluruh fitur secara lengkap).
- Dilarang melakukan git commit atau push sebelum ada instruksi eksplisit dari user.
- Semua 264 unit dan integration test harus tetap lulus 100%.

---

### Tugas 1: Penandaan Tag & Kelas Selektor pada Sidebar (`sidebar_admin.html`, `sidebar.html`)

**File Terkait:**
- Modify: `app/templates/kasir/components/sidebar.html`
- Modify: `app/templates/kasir/components/sidebar_admin.html`

- [x] **Langkah 1: Tambahkan kelas `.sidebar-remote-hidden` pada elemen sidebar yang harus dihilangkan saat di cabang remote**
  - Pada `sidebar.html`:
    - Tab Catatan (`catatan`): tambahkan class `sidebar-remote-hidden`
    - Tab Pemulihan Mati Lampu (`blackout`): tambahkan class `sidebar-remote-hidden`
  - Pada `sidebar_admin.html`:
    - Seluruh grup `Manajemen Staff`: bungkus atau tambahkan class `sidebar-remote-hidden`
    - Hardware Checker (`hardware_checker`): tambahkan class `sidebar-remote-hidden`
    - Remote Server (`remote_server`): tambahkan class `sidebar-remote-hidden`
    - Seluruh grup `Multi Cabang`: class `sidebar-branch-group` (sudah ada)
    - Pada grup `Sistem & Utilitas`:
      - MikroTik Hotspot (`mikrotik`): tambahkan class `sidebar-remote-hidden`
      - File Explorer (`fileexplorer`): tambahkan class `sidebar-remote-hidden`
      - Log Sistem (`log`): tambahkan class `sidebar-remote-hidden`
      - Ekstensi & Plugin (`plugins`, `plugin-spa`): tambahkan class `sidebar-remote-hidden`
      - Dokumentasi (`documentation`): tambahkan class `sidebar-remote-hidden`
      - **Analitik Owner (`analytics`)**: JANGAN diberi kelas ini (tetap tampil)
    - Seluruh grup `Pengaturan Server`: bungkus dengan pembungkus berkelas `sidebar-remote-hidden`

---

### Tugas 2: Dinamisasi Visibilitas Sidebar & Penanda Body Mode Remote (`branch/index.js`)

**File Terkait:**
- Modify: `app/static/js/kasir/modules/branch/index.js`
- Modify: `app/static/css/input.css`

- [x] **Langkah 1: Perbarui fungsi `updateBrandAndSidebarVisibility()` di `BranchManager`**
  - Mengambil semua elemen dengan selector `.sidebar-remote-hidden, .sidebar-branch-group`.
  - Jika `activeBranchId === '0'` (Lokal):
    - Setel `document.body.setAttribute('data-branch-mode', 'local')`
    - Hapus class `hidden` dari seluruh elemen `.sidebar-remote-hidden` dan `.sidebar-branch-group`.
  - Jika `activeBranchId !== '0'` (Remote):
    - Setel `document.body.setAttribute('data-branch-mode', 'remote')`
    - Tambahkan class `hidden` ke seluruh elemen `.sidebar-remote-hidden` dan `.sidebar-branch-group`.
    - Jika tab yang sedang aktif termasuk yang di-hide, otomatis alihkan ke `dash` (Dashboard).

---

### Tugas 3: Perbaikan Tuntas Bug Riwayat & Struk (`struk/index.js`)

**File Terkait:**
- Modify: `app/static/js/kasir/modules/struk/index.js`
- Modify: `app/templates/kasir/tabs/struk.html`

- [x] **Langkah 1: Bersihkan pagination saat data kosong atau saat `resetState()`**
  - Di `Struk.resetState()`:
    - Bersihkan elemen `#struk-pagination` (`pagContainer.innerHTML = ''`).
    - Setel `this._lastFingerprint = null`.
    - Bersihkan `localStorage.removeItem('lastStrukData')`.
  - Di `Struk.loadHistory()`:
    - Di awal sebelum fetch atau saat `listData.length === 0`: kosongkan `#struk-pagination`.
- [x] **Langkah 2: Sinkronkan opsi tanggal pada perpindahan cabang**
  - Di `BranchManager.refreshAllModulesAfterBranchSwitch()`:
    - Jalankan `await Struk.loadDateOptions()` dan `await Struk.loadHistory()` jika tab aktif adalah `struk`.
- [x] **Langkah 3: Proteksi tombol aksi mutasi di Struk**
  - Sembunyikan tombol hapus struk saat `activeBranchId !== '0'`.

---

### Tugas 4: Penegakan Mode Read-Only (Katalog, Dashboard, dan Relay API)

**File Terkait:**
- Modify: `app/static/js/kasir/modules/dashboard/index.js` (atau modal detail PC)
- Modify: `app/services/branch/branch_proxy_service.py`
- Modify: `app/static/css/input.css`

- [x] **Langkah 1: Aturan CSS Read-Only Mode**
  - Tambahkan utilitas CSS agar saat `body[data-branch-mode="remote"]`, seluruh tombol CRUD mutasi (`.remote-hide-action`) disembunyikan secara visual.
- [x] **Langkah 2: Backend Protection di `BranchProxyService.relay_request`**
  - Jika `request_obj.method` adalah `POST`, `PUT`, `DELETE`, `PATCH`:
    - Tolak dengan respon JSON 403 Forbidden: `"Akses Ditolak: Server cabang remote hanya dapat diakses dalam mode pantau (Read-Only). Tindakan mutasi data tidak diizinkan."`
- [x] **Langkah 3: Kompilasi ulang CSS (`npm run build:css`)**

---

### Tugas 5: Penambahan Automated Tests & Verifikasi Keseluruhan

**File Terkait:**
- Modify/Create: `tests/test_branch_remote_readonly_sidebar.py`
- Modify: `tests/test_branch_ui_rendering.py`

- [x] **Langkah 1: Buat unit test pengujian pembatasan mutasi dan sidebar remote**
  - Uji relay request method `POST` / `DELETE` dengan `X-Branch-ID` menghasilkan 403 Forbidden.
  - Uji relay request method `GET` tetap diizinkan.
  - Uji template rendering sidebar memiliki penanda kelas `.sidebar-remote-hidden`.
- [x] **Langkah 2: Jalankan pytest keseluruhan (264+ specs)**
  - Pastikan 100% test lulus tanpa kegagalan.
- [x] **Langkah 3: Sinkronkan catatan pembaruan ke `ANTIGRAVITY.md`**

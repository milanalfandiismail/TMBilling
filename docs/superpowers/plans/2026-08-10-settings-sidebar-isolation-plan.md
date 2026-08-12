# Settings Sidebar Isolation Implementation Plan (1 Subtab = 1 Fungsi)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memecah (mengisolasi) subtab di grup Pengaturan dari gabungan multi-fungsi menjadi 1 item sidebar per 1 fungsi terfokus (Cloud Backup, Berkas Backup Lokal, Pembersihan Database, Info Warnet, Metode Pembayaran, TV Signage, dsb).

**Architecture:** Meng-update sidebar layout di `app/templates/kasir/components/sidebar.html`, memisah container `#subtab-X` di `app/templates/kasir/tabs/settings.html`, serta memperbarui routing handler di `app/static/js/kasir/app.js` & `app/static/js/kasir/modules/settings/index.js`.

**Tech Stack:** HTML5, Jinja2, Vanilla JS, Tailwind CSS, Python 3.13 / Flask.

## Global Constraints

- Subtab ID Naming: `#subtab-general`, `#subtab-payment`, `#subtab-kiosk`, `#subtab-tv`, `#subtab-whitelist_ip`, `#subtab-cloud_backup`, `#subtab-local_backup`, `#subtab-db_cleanup`, `#subtab-scheduler`, `#subtab-migration`
- Sidebar App Route: `settings_payment`, `settings_kiosk`, `settings_tv`, `settings_cloud_backup`, `settings_local_backup`, `settings_db_cleanup`
- Single Responsibility: 1 Subtab hanya berisi 1 kelompok fungsi utama tanpa tercampur fungsi lain

---

### Task 1: Update `sidebar.html` Settings Submenu Buttons

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html:172-178`

**Interfaces:**
- Consumes: `App.switchTab('settings_X')`
- Produces: 10 item menu sidebar terisolasi di bawah `#settings-submenu`

- [ ] **Step 1: Edit `#settings-submenu` dalam `sidebar.html`**

Perbarui `<div id="settings-submenu">` dengan 10 button subtab terisolasi:
- `settings_general` -> ⚙️ Umum & Keamanan
- `settings_payment` -> 💳 Metode Pembayaran
- `settings_kiosk` -> 🖥️ Info Warnet & Kiosk
- `settings_tv` -> 📺 TV Signage Display
- `whitelist_ip` -> 🛡️ Whitelist IP
- `settings_cloud_backup` -> ☁️ Cloud Backup
- `settings_local_backup` -> 📂 Berkas Backup Lokal
- `settings_db_cleanup` -> 🧹 Pembersihan Database
- `settings_scheduler` -> 🤖 Auto Scheduler
- `settings_migration` -> 🗄️ Migrasi & Update

- [ ] **Step 2: Commit perombakan sidebar.html**

```bash
git add app/templates/kasir/components/sidebar.html
git commit -m "feat: isolate Settings sidebar submenu items into 1-function-per-subtab"
```

---

### Task 2: Split Container `#subtab-X` dalam `settings.html`

**Files:**
- Modify: `app/templates/kasir/tabs/settings.html:7-686`

**Interfaces:**
- Consumes: Komponen kartu settings
- Produces: 7 subtab container terisolasi baru (`#subtab-general`, `#subtab-payment`, `#subtab-kiosk`, `#subtab-tv`, `#subtab-cloud_backup`, `#subtab-local_backup`, `#subtab-db_cleanup`)

- [ ] **Step 1: Pisahkan `#subtab-general` menjadi 4 subtab terpisah**

- `#subtab-general`: Auto Shutdown, Uninstall Token, API Key, Timezone
- `#subtab-payment`: Kelola Metode Pembayaran & QRIS
- `#subtab-kiosk`: Konfigurasi Info Warnet (Judul, Alamat, Telepon, Struk Footer, Pengumuman)
- `#subtab-tv`: TV Signage (Running text & Slide Promosi)

- [ ] **Step 2: Pisahkan `#subtab-backup` menjadi 3 subtab terpisah**

- `#subtab-cloud_backup`: Card Database & Cloud Backup Settings (Discord, GDrive, NAS, Nextcloud)
- `#subtab-local_backup`: Card Berkas Cadangan Lokal (Tabel file ZIP)
- `#subtab-db_cleanup`: Card Pembersihan Histori Database (Retensi data & vacuum purge)

- [ ] **Step 3: Commit perombakan settings.html**

```bash
git add app/templates/kasir/tabs/settings.html
git commit -m "refactor: split settings.html multi-function subtabs into isolated single-function containers"
```

---

### Task 3: Update JS Routing di `app.js` & `settings/index.js`

**Files:**
- Modify: `app/static/js/kasir/app.js:170-200`
- Modify: `app/static/js/kasir/modules/settings/index.js:150-165,765-785`

**Interfaces:**
- Consumes: `App.switchTab('settings_X')`
- Produces: Dynamic subtab switcher & load handlers untuk subtab terisolasi

- [ ] **Step 1: Update `updatePageTitle` & `loadTab` di `app.js`**

Tambahkan judul halaman untuk `settings_payment`, `settings_kiosk`, `settings_tv`, `settings_cloud_backup`, `settings_local_backup`, `settings_db_cleanup`.

- [ ] **Step 2: Update `switchSubTab` di `settings/index.js`**

Pastikan `switchSubTab(subTab)` memuat data berkas backup saat `subTab === 'local_backup'` atau `subTab === 'cloud_backup'`, dan mengelola visibilitas `#subtab-X` secara tepat.

- [ ] **Step 3: Commit perombakan JS**

```bash
git add app/static/js/kasir/app.js app/static/js/kasir/modules/settings/index.js
git commit -m "feat: add JS routing and handlers for isolated settings subtabs"
```

---

### Task 4: Recompile Tailwind CSS & Final Verification

**Files:**
- Modify: `app/static/css/tailwind.css`

- [ ] **Step 1: Kompilasi ulang Tailwind CSS bundle**

Run: `cmd.exe /c "npm run build:css"`
Expected: Rebuilding complete in ~600ms without errors.

- [ ] **Step 2: Uji coba Flask app**

Run: `C:\Users\lannnn\AppData\Local\Programs\Python\Python313\python.exe -c "from app import create_app; app = create_app(); print('App clean!')"`
Expected: App clean!

- [ ] **Step 3: Commit CSS bundle**

```bash
git add app/static/css/tailwind.css
git commit -m "build: recompile Tailwind CSS bundle for isolated settings subtabs"
```

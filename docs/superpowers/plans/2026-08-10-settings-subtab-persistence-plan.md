# Settings Subtab State Persistence & Whitelist Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Memperbaiki bug di mana menyimpan pengaturan pada subtab tertentu (`Metode Pembayaran`, `Info Warnet & Kiosk`, `TV Signage Display`, `Cloud Backup`, dll) menyebabkan antarmuka reset/melompat kembali ke subtab default `Umum & Keamanan` (`#subtab-general`).
2. Menambahkan notifikasi Toast interaktif untuk semua aksi pada **Whitelist IP** (toggle centang aktif/nonaktif, tambah IP, hapus IP, simpan URL publik).

**Architecture:** 
- Menyimpan state `currentSubTab` pada objek `Settings` di `app/static/js/kasir/modules/settings/index.js`.
- Memperbarui `Settings.load(preserveSubTab = true)` dan `Settings.switchSubTab(subTab)` agar `load()` mempertahankan subtab aktif yang sedang dibuka saat ini.
- Memperbarui `savePaymentMethods()`, `saveKioskSettings()`, `saveTVSignageSettings()`, dan `saveProviderConfig()` untuk memanggil `await this.load(true)` agar tidak mereset ke subtab default.
- Memperbarui `_wlToggle()`, `_wlAddIp()`, `_wlRemove()`, dan `_wlSavePublicUrl()` untuk menampilkan `Toast.success` / `Toast.info` / `Toast.error`.

**Tech Stack:** HTML5, Vanilla JS, Tailwind CSS, Python 3.13 / Flask.

---

### Task 1: Preserve Active Subtab State on Settings Reload

**Files:**
- Modify: `app/static/js/kasir/modules/settings/index.js:1-10,130,712,749,755-785`
- Modify: `app/static/js/kasir/app.js:192-200`

- [ ] **Step 1: Modifikasi `Settings.load()` dan `Settings.switchSubTab()` di `index.js`**

Di `index.js`:
- Inisialisasi `currentSubTab: 'general'` pada objek `Settings`.
- Ubah signature `async load(preserveSubTab = false)`: Jika `preserveSubTab === true` dan `this.currentSubTab` ada, panggil `this.switchSubTab(this.currentSubTab)` bukannya mereset ke `'general'`.
- Ubah `switchSubTab(subTab)`: Simpan `this.currentSubTab = subTab`.
- Di fungsi `savePaymentMethods()`, `saveKioskSettings()`, `saveTVSignageSettings()`, dan `saveProviderConfig()`, panggil `await this.load(true)`.

- [ ] **Step 2: Modifikasi `loadTab()` di `app.js`**

Di `app.js`:
- Pada blok `if (tab.startsWith('settings_') || tab === 'whitelist_ip')`, panggil `await Settings.load(true);` diikuti `Settings.switchSubTab(sub);`.

- [ ] **Step 3: Commit perbaikan perpindahan subtab**

```bash
git add app/static/js/kasir/modules/settings/index.js app/static/js/kasir/app.js
git commit -m "fix: preserve active subtab state when saving settings or switching subtabs"
```

---

### Task 2: Add Toast Notifications for Whitelist IP Toggling & Actions

**Files:**
- Modify: `app/static/js/kasir/modules/settings/index.js:953-985`
- Modify: `app/static/js/kasir/modules/settings/whitelist_ip.js:121-129`

- [ ] **Step 1: Tambahkan Toast pada `_wlToggle(enabled)`, `_wlAddIp()`, `_wlRemove()`, dan `_wlSavePublicUrl()` di `index.js` & `whitelist_ip.js`**

- Toggle Status: `Toast.success('Whitelist IP berhasil diaktifkan')` jika `enabled === true`, dan `Toast.info('Whitelist IP dinonaktifkan')` jika `enabled === false`.
- Tambah IP: `Toast.success('IP berhasil ditambahkan ke Whitelist')`.
- Hapus IP: `Toast.info('IP berhasil dihapus dari Whitelist')`.
- URL Publik: `Toast.success('URL Publik aplikasi berhasil disimpan')`.

- [ ] **Step 2: Commit perubahan Toast Whitelist IP**

```bash
git add app/static/js/kasir/modules/settings/index.js app/static/js/kasir/modules/settings/whitelist_ip.js
git commit -m "feat: add Toast notifications for Whitelist IP toggle and actions"
```

---

### Task 3: Verification & Recompile

**Files:**
- Verify: `app/static/js/kasir/modules/settings/index.js`

- [ ] **Step 1: Recompile Tailwind CSS & Test App Factory**

Run: `cmd.exe /c "npm run build:css"`
Run: `C:\Users\lannnn\AppData\Local\Programs\Python\Python313\python.exe -c "from app import create_app; app = create_app(); print('App clean!')"`

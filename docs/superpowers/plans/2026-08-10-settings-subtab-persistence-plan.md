# Settings Subtab State Persistence & Whitelist Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. Memperbaiki bug di mana menyimpan pengaturan di subtab tertentu (seperti Info Warnet & Kiosk, TV Signage, Metode Pembayaran, dll) menyebabkan layar melompat kembali ke subtab default `Umum & Keamanan` (`#subtab-general`).
2. Menambahkan notifikasi Toast saat status **Whitelist IP** dicentang (diaktifkan/dinonaktifkan).

**Architecture:** 
- Menyimpan state `currentSubTab` di objek `Settings` pada `app/static/js/kasir/modules/settings/index.js`.
- Memperbarui `Settings.load(preserveSubTab = true)` dan `Settings.switchSubTab(subTab)` agar `load()` mempertahankan subtab aktif yang sedang dibuka.
- Memperbarui `_wlToggle(enabled)` dan `_wlAddIp()`, `_wlRemove()`, `_wlRegenerate()` untuk menampilkan `Toast.success` / `Toast.info` / `Toast.error`.

**Tech Stack:** HTML5, Vanilla JS, Tailwind CSS, Python/Flask.

---

### Task 1: Preserve Active Subtab State on Settings Reload

**Files:**
- Modify: `app/static/js/kasir/modules/settings/index.js:1-10,712,749,755-785`
- Modify: `app/static/js/kasir/app.js:192-200`

- [ ] **Step 1: Modifikasi `Settings.load()` dan `Settings.switchSubTab()` di `index.js`**

Di `index.js`:
- Inisialisasi `currentSubTab: 'general'` pada objek `Settings`.
- Ubah `load(preserveSubTab = false)`: Jika `preserveSubTab` bernilai true dan `this.currentSubTab` ada, panggil `this.switchSubTab(this.currentSubTab)`.
- Ubah `switchSubTab(subTab)`: Simpan `this.currentSubTab = subTab`.
- Di fungsi `saveKioskSettings()`, `saveTVSignageSettings()`, dan `savePaymentMethods()`, panggil `await this.load(true)`.

- [ ] **Step 2: Modifikasi `loadTab()` di `app.js`**

Di `app.js`:
- Pada blok `if (tab.startsWith('settings_') || tab === 'whitelist_ip')`, panggil `await Settings.load(true);` diikuti `Settings.switchSubTab(sub);`.

- [ ] **Step 3: Commit perubahan perpindahan subtab**

```bash
git add app/static/js/kasir/modules/settings/index.js app/static/js/kasir/app.js
git commit -m "fix: preserve active subtab state when saving settings or switching subtabs"
```

---

### Task 2: Add Toast Notifications for Whitelist IP Toggling & Actions

**Files:**
- Modify: `app/static/js/kasir/modules/settings/index.js:953-985`
- Modify: `app/static/js/kasir/modules/settings/whitelist_ip.js:121-129`

- [ ] **Step 1: Tambahkan Toast pada `_wlToggle(enabled)` di `index.js` & `whitelist_ip.js`**

Tampilkan `Toast.success('Whitelist IP berhasil diaktifkan')` jika `enabled === true`, dan `Toast.info('Whitelist IP dinonaktifkan')` jika `enabled === false`.

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

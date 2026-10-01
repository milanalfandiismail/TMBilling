# Rombak Sidebar Menjadi Flat 100% Berdasarkan Fungsi (No Child Sidebar) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah seluruh struktur sidebar pada kasir & admin menjadi 100% flat (direct 1-click buttons) yang terbagi rapi berdasarkan FUNGSI KERJA menggunakan Section Header (`OPERASIONAL`, `KATALOG & MASTER`, `LAPORAN KEUANGAN`, `MANAJEMEN STAFF`, `HARDWARE & MONITORING`, `SISTEM & PENGATURAN`), tanpa ada dropdown/child accordion sama sekali (`no child sidebar`), dengan pemisahan `Kelola Game` dan `Turnamen` sebagai tombol langsung.

**Architecture:**
1. **Header Kategori Fungsional (Section Dividers)**: Menggunakan label teks uppercase halus (`text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2.5 pt-3 pb-1`) sebagai penanda visual tanpa accordion toggle.
2. **Pengelompokan Fungsional**:
   - **OPERASIONAL (Kasir & Admin)**:
     - 🖥️ Dashboard (`dash`)
     - 🛒 Kantin / POS (`menu`)
     - 👤 Member (`member`)
     - ⚡ Pemulihan Mati Lampu (`blackout`)
     - 🧾 Riwayat & Struk (`struk`)
     - 📝 Catatan Shift (`catatan`)
   - **KATALOG & MASTER (Kasir & Admin)**:
     - 💳 Paket Billing (`paket`)
     - 🖥️ Unit PC (`pc`)
     - 🏷️ Grup PC / Zona (`grup`)
     - 🎮 Kelola Game (`game_management`)
     - 🏆 Turnamen (`tournament`)
   - **LAPORAN KEUANGAN (Kasir & Admin)**:
     - 💵 Laporan Billing (`laporan`)
     - 🍜 Laporan Kantin (`laporan_menu`)
     - 📦 Log Stok Menu (`menu_stock_log`)
     - 🛠️ Laporan Perawatan (`laporan_maintenance`)
   - **MANAJEMEN STAFF (Khusus Admin)**:
     - 👥 Akun Kasir & Admin (`user`)
     - 📋 Riwayat Serah Terima Shift (`shift_history`)
     - 🛡️ Log & Audit Staff (`user_logs`)
   - **HARDWARE & MONITORING (Khusus Admin)**:
     - 📊 Statistik Server (`server_statistic`)
     - 🖥️ Monitor Hardware (`monitor`)
     - 🛡️ Hardware Checker (`hardware_checker`)
     - 🕐 Pelacak Uptime PC (`uptime`)
     - 📋 Perawatan PC (`maintenance`)
     - 📷 Monitor Screenshot (`screenshot`)
     - 📡 Kendali Jarak Jauh Server (`remote_server`)
   - **SISTEM & PENGATURAN (Khusus Admin)**:
     - 🌐 Multi Cabang (`branch`)
     - 📶 MikroTik Hotspot (`mikrotik`)
     - 📈 Analitik Owner (`analytics`)
     - 📁 File Explorer (`fileexplorer`)
     - 📜 Log Aktivitas Sistem (`log`)
     - ⚙️ Pengaturan Server (`settings` - direct ke tab settings)
     - 🧩 Ekstensi & Plugin (`plugins`)
     - 📖 Dokumentasi (Link `/kasir/documentation`)
3. **Template Modularity**:
   - `app/templates/kasir/components/sidebar.html`: Container utama nav dan grup `OPERASIONAL`.
   - `app/templates/kasir/components/sidebar_kasir.html`: Grup `KATALOG & MASTER` dan `LAPORAN KEUANGAN`.
   - `app/templates/kasir/components/sidebar_admin.html`: Grup `MANAJEMEN STAFF`, `HARDWARE & MONITORING`, dan `SISTEM & PENGATURAN`.
4. **JavaScript Navigation Synchronization**:
   - `app/static/js/kasir/app.js`: Membersihkan logic accordion dropdown `Sidebar.toggleDropdown`, menjaga active state `.tab-btn` tetap mulus dan bebas error.

**Tech Stack:** Jinja2 HTML Templates, TailwindCSS, JavaScript (Kasir App SPA).

---

### Task 1: Rombak `sidebar_kasir.html` (KATALOG & MASTER + LAPORAN KEUANGAN)

**Files:**
- Modify: `app/templates/kasir/components/sidebar_kasir.html`

- [x] **Step 1: Hapus seluruh wrapper dropdown toggle (`Sidebar.toggleDropdown('master')` & `'laporan'`)**
- [x] **Step 2: Buat Section Header `KATALOG & MASTER` dengan tombol flat: Paket Billing, Unit PC, Grup PC / Zona, Kelola Game, Turnamen**
- [x] **Step 3: Buat Section Header `LAPORAN KEUANGAN` dengan tombol flat: Laporan Billing, Laporan Kantin, Log Stok Menu, Laporan Perawatan**

---

### Task 2: Rombak `sidebar_admin.html` (STAFF + HARDWARE + SISTEM/PENGATURAN)

**Files:**
- Modify: `app/templates/kasir/components/sidebar_admin.html`

- [x] **Step 1: Hapus seluruh wrapper dropdown accordion (`game`, `staff`, `sistemlog`, `system`, `branch`, `settings`, `plugins`)**
- [x] **Step 2: Buat Section Header `MANAJEMEN STAFF` dengan tombol: Akun Kasir & Admin, Riwayat Shift, Log Audit Staff**
- [x] **Step 3: Buat Section Header `HARDWARE & MONITORING` dengan tombol: Statistik Server, Monitor Hardware, Hardware Checker, Pelacak Uptime, Perawatan PC, Screenshot, Remote Server**
- [x] **Step 4: Buat Section Header `SISTEM & PENGATURAN` dengan tombol: Multi Cabang, MikroTik Hotspot, Analitik Owner, File Explorer, Log Aktivitas Sistem, Pengaturan Server, Ekstensi & Plugin, Dokumentasi**

---

### Task 3: Rombak `sidebar.html` (OPERASIONAL & Penyatuan Navigasi)

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`

- [x] **Step 1: Buat Section Header `OPERASIONAL` di paling atas navigasi**
- [x] **Step 2: Masukkan tombol-tombol operasional harian: Dashboard, Kantin / POS, Member, Pemulihan Mati Lampu, Riwayat & Struk, Catatan**
- [x] **Step 3: Rapikan susunan include: include `sidebar_kasir.html` lalu include `sidebar_admin.html` (khusus role admin)**
- [x] **Step 4: Hapus duplikasi tombol luar yang sudah dipindahkan ke dalam group fungsional**

---

### Task 4: Sinkronisasi JavaScript `app.js` & Rebuild CSS

**Files:**
- Modify: `app/static/js/kasir/app.js`

- [x] **Step 1: Hapus/bersihkan logic auto-expand accordion yang sudah tidak digunakan di `switchTab` agar aman dan bebas null element**
- [x] **Step 2: Jalankan `npm run build:css` untuk mengompilasi CSS terbaru**
- [x] **Step 3: Jalankan pytest untuk memverifikasi tidak ada route atau rendering yang rusak**

# Rencana Implementasi: Optimasi Layout Responsif Mobile (Perawatan PC, Cabang, Umum & Keamanan, TV, Backup, & Pembersihan DB)

> **Untuk Pekerja Agentik:** SUB-SKILL YANG DIBUTUHKAN: Gunakan superpowers:subagent-driven-development (direkomendasikan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini task-by-task. Langkah menggunakan checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Mengoptimalkan seluruh tata letak (layout), komponen tombol, form input, filter, modal dialog, dan tabel data pada 8 area antarmuka kasir agar responsif dan rapi pada breakpoint mobile (< 640px & < 1024px) sesuai panduan Tailwind CSS Mobile-First Design.

**Batasan Ketat (Constraints & Boundaries):**
1. **Hanya Breakpoint Mobile:** Penyesuaian HANYA berlaku untuk tampilan breakpoint mobile (`< lg` / `< sm`). Styling compact laptop (`lg:max-xl:`) dan desktop besar (`xl:`) yang telah distandarisasi sebelumnya tetap dipertahankan 100% dan tidak diubah.
2. **Tidak Ada Modifikasi Endpoint:** Tidak mengubah atau menambah endpoint backend/API apa pun. Seluruh perubahan murni berfokus pada layer presentasi HTML & JavaScript frontend pada 8 komponen target.
3. **Isolasi Cakupan:** Hanya berlaku untuk 8 area yang ditentukan (Perawatan PC, Koneksi Cabang, List Koneksi Cabang, Akun Kasir Cabang, Umum & Keamanan, Tombol Buka TV, Berkas Backup Lokal, dan Pembersihan Database).

**Arsitektur:** Menggunakan pendekatan Tailwind CSS Mobile-First (`w-full sm:w-auto`, `flex-col sm:flex-row`, `block lg:table`, `<thead class="hidden lg:table-header-group">`, `flex lg:table-cell justify-between`), memastikan tidak ada elemen fixed-width kaku yang meluap (overflow), tombol aksi dapat di-tap dengan mudah pada layar sentuh, dan tabel bertransformasi menjadi kartu informatif yang rapi di layar mobile.

**Tech Stack:** HTML5, Tailwind CSS 3.4+, Vanilla JavaScript Modules (Kasir App), Jinja2 Templates.

---

## 🎯 Area & Komponen Sasaran

1. **Tab Perawatan PC (`maintenance.html` & `maintenance/index.js`)**:
   - Header tombol "Lapor Masalah" & "Refresh" responsif mobile (`w-full sm:w-auto`).
   - Baris filter (status, pilih unit PC, tombol Cari) responsif mobile (`w-full sm:w-auto flex-col sm:flex-row`).
   - Grid 4 mini status cards disesuaikan (`grid-cols-2 lg:max-xl:grid-cols-4 xl:grid-cols-4 gap-2.5 sm:gap-3`).
   - Transformasi tabel tiket perawatan menjadi mobile card blocks dengan label field responsif (`block lg:table`, `flex lg:table-cell`).
   - Modal Lapor Masalah, Update Status, Detail Tiket, dan Pilih PC dilengkapi padding dan `max-h-[90vh] overflow-y-auto` agar aman di layar ponsel.

2. **Tab Koneksi Cabang (`branch.html` & `branch/index.js`)**:
   - Card Kunci API Server: Input token & tombol aksi disesuaikan menjadi `w-full sm:w-auto flex-col sm:flex-row` tanpa overflow.
   - Card Cabang Terhubung: Tombol "Tambah Cabang" responsif dan tabel kontrol cabang menggunakan layout mobile card.
   - Modal tambah cabang & modal konfirmasi regenerate API key responsif mobile.

3. **Tab List Koneksi Cabang (`branch_inbound.html` & `branch/index.js`)**:
   - Filter sub-tab (Semua, Terhubung, Diblokir) & kotak pencarian responsif wrap pada mobile.
   - Tabel cabang inbound bertransformasi ke mobile card layout dengan label deskriptif.

4. **Tab Akun Kasir Cabang (`branch_kasir.html` & `branch/index.js`)**:
   - Tombol filter status operator & kotak pencarian responsif mobile.
   - Tabel akun operator remote mobile card layout.

5. **Tab Umum & Keamanan (`settings.html`)**:
   - Card Auto Shutdown, Token Uninstall, API Key System, & Timezone diubah dari layout horizontal kaku (`flex justify-between`) menjadi stack responsif mobile (`flex-col sm:flex-row items-start sm:items-center gap-3`) dengan input fleksibel (`w-full sm:w-64` / `w-full sm:w-80`).
   - Seluruh tombol simpan kartu disesuaikan `w-full sm:w-auto`.

6. **Tampilan TV pada Button Buka TV (`settings.html`)**:
   - Container URL Link Akses Smart TV LAN dirombak agar `<code>` URL (`break-all`) dan tombol `<a>` "Buka TV" menyusun secara vertikal/horizontal fleksibel (`flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3`) tanpa meluap keluar layar ponsel.

7. **Berkas Backup Lokal (`settings.html` & `settings/index.js`)**:
   - Tabel 5 berkas cadangan lokal ditransformasikan ke format mobile card (`break-all` untuk nama file panjang .sql.gz, tombol unduh & hapus mudah di-tap pada mobile).

8. **Pembersihan Database (`settings.html`)**:
   - Box data retention pembersihan riwayat database diubah menjadi `flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3`.
   - Dropdown bulan dan tombol "Backup & Bersihkan Sekarang" responsif penuh pada mobile tanpa text-overflow.

---

## 📋 Task 1: Optimasi Mobile Breakpoint Tab Perawatan PC
**Files:**
- Modify: `app/templates/kasir/tabs/maintenance.html`
- Modify: `app/static/js/kasir/modules/maintenance/index.js`

- [x] **Step 1: Update layout header, filter bar, dan modal di `maintenance.html` khusus mobile**
- [x] **Step 2: Update rendering tabel tiket di `maintenance/index.js` dengan layout mobile cards (`block lg:table-row`, `flex lg:table-cell`)**
- [x] **Step 3: Uji visual & build Tailwind CSS**

---

## 📋 Task 2: Optimasi Mobile Breakpoint Tab Ekosistem Cabang (Koneksi, Inbound, & Kasir Remote)
**Files:**
- Modify: `app/templates/kasir/tabs/branch.html`
- Modify: `app/templates/kasir/tabs/branch_inbound.html`
- Modify: `app/templates/kasir/tabs/branch_kasir.html`
- Modify: `app/static/js/kasir/modules/branch/index.js`

- [x] **Step 1: Update layout form API key, filter subtab, dan tabel di `branch.html`, `branch_inbound.html`, dan `branch_kasir.html` khusus mobile**
- [x] **Step 2: Update fungsi `renderBranchesSettingsTable()`, `renderInboundTable()`, dan `renderOperatorsTable()` di `branch/index.js` ke mobile cards**
- [x] **Step 3: Uji visual & build Tailwind CSS**

---

## 📋 Task 3: Optimasi Mobile Breakpoint Tab Umum & Keamanan, Tombol Buka TV, Berkas Backup, & Pembersihan DB
**Files:**
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`

- [x] **Step 1: Update form cards Umum & Keamanan di `settings.html` (Auto Shutdown, Uninstall Token, API Key, Timezone) khusus mobile**
- [x] **Step 2: Update box Buka TV pada subtab TV Signage di `settings.html` khusus mobile**
- [x] **Step 3: Update subtab Berkas Backup Lokal & Pembersihan Database di `settings.html` dan `settings/index.js` khusus mobile**
- [x] **Step 4: Jalankan `npm run build:css`**

---

## 🔍 Rencana Verifikasi
1. **Kompilasi Tailwind CSS**: Jalankan `npm run build:css` dan pastikan tidak ada error sintaks.
2. **Pengujian Responsif Mobile**:
   - Layar Mobile Sempit (320px - 480px / Smartphone): Tidak ada horizontal overflow, teks tertata rapi, tombol mudah di-tap.
   - Layar Tablet / sm-md (640px - 768px): Tampilan fleksibel.
   - Layar Laptop (1024px / lg:max-xl:) & Desktop (1280px+ / xl:): Tetap sesuai standarisasi tanpa regresi.
3. **Penyelarasan Repositori**: Lakukan Git commit dalam bahasa Indonesia dan jalankan MCP `index_repository`.

# Desain Spesifikasi: PC Detail Remote Elimination, Group Sorting Alignment & Hardware Checker 2-Column UI/UX

## 1. Ringkasan & Latar Belakang
Berdasarkan arahan kebutuhan terkini:
1. **Modal Detail PC pada Mode Cabang Remote (`activeBranchId !== '0'`)**:
   - Fitur "Ambil Gambar" (tombol screenshot dan panel preview screenshot), "Remote Control" (tombol remote layar), dan "Monitor Proses" masih muncul ketika kasir sedang memantau cabang remote.
   - Tombol-tombol kontrol tersebut harus dieliminasi saat berada di mode remote branch, menyisakan **hanya tombol "Hardware"** ("cukup hardware aja").
   - Pada mode lokal (`activeBranchId === '0'`), seluruh fungsionalitas harus tetap tampil lengkap dan normal tanpa regresi.

2. **Pengurutan Grup (Group Sorting Alignment) Sesuai ID Database**:
   - Di dashboard dan tab-tab lainnya, pengelompokan card PC per grup masih menggunakan pengurutan alfabetis JavaScript (`.sort()` atau `.localeCompare()`).
   - Seharusnya susunan grup mengikuti urutan ID / waktu pembuatan database (`grup 1, 2, 3`), seperti yang ada di dropdown filter grup Member dan PC (misalnya grup `reguler` yang dibuat pertama kali selalu berada paling atas).
   - Penyesuaian ini mencakup: Dashboard (tab zona dan card grid per grup), Hardware Checker, Screenshot, Paket Billing, dan Modal Pemilihan PC di Tiket Maintenance.

3. **Optimasi UI/UX Hardware Checker (`lg`, `xl`, `2xl`)**:
   - Container kartu Hardware Checker saat ini menggunakan `space-y-4` 1 kolom penuh selebar layar.
   - Pada layar monitor kasir / admin (`lg`, `xl`, `2xl`), card PC menjadi terlalu lebar dan tidak proporsional.
   - Layout ditransformasikan menjadi **2 kolom responsif** (`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`) dengan penataan tipografi, badge, dan konten accordion yang rapi dan elegan.

---

## 2. Arsitektur & Analisis Solusi

### Bagian 1: Eliminasi Aksi pada PC Detail Modal di Remote Branch
- **File**: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`
- **Mekanisme**:
  - Tombol-tombol berikut disematkan kelas CSS `.remote-hide-action`:
    1. Tombol "Monitor Proses" (`DashboardProcessMonitor.showProcesses`)
    2. Tombol "Remote Layar" (`DashboardDetailModal.openRemoteView`) dan placeholder offline-nya
    3. Tombol "Ambil Gambar" (`DashboardDetailModal.takeScreenshot`)
    4. Kontainer preview screenshot kanan (`<!-- Right Column: Screenshot Preview -->`)
  - Aksi lain (WOL, Pindah PC, Restart, Shutdown) sudah memiliki `.remote-hide-action`.
  - Hasil pada mode remote branch: Sisi aksi hanya menampilkan tombol **Hardware**, sedangkan panel screenshot tersembunyi.
  - Untuk menjaga kerapian tampilan saat remote branch aktif, kolom kiri kartu aksi disesuaikan agar membentang proporsional (`col-span-full` atau rapi di tengah).

### Bagian 2: Penyelarasan Pengurutan Grup Berbasis ID (Database Creation Order)
1. **Backend Dashboard Service (`app/services/dashboard/dashboard_service.py`)**:
   - Pada pembentukan `grup_meta`, sertakan nilai `id`:
     ```python
     g_id = pc.grup.id if pc.grup else 0
     if g_nama not in grup_meta:
         grup_meta[g_nama] = {"warna": g_warna, "id": g_id}
     ```
   - Catatan: `PCService.get_all()` sudah mengurutkan PC dengan `(g_id, split_parts)`.

2. **Frontend Dashboard (`app/static/js/kasir/modules/dashboard/dashboard_compact.js`)**:
   - Pada `renderTabs(data)`: Ganti `.sort()` alfabetis dengan pengurutan berdasarkan `grup_meta[group].id`:
     ```javascript
     const meta = data.grup_meta || {};
     const groups = Object.keys(data.by_grup || {}).sort((a, b) => {
         const idA = Number(meta[a]?.id || 0);
         const idB = Number(meta[b]?.id || 0);
         return idA !== idB ? idA - idB : a.localeCompare(b);
     });
     ```
   - Pada `renderGrid(data)`: Ganti `allGroups.sort()` dengan comparator berbasis ID yang sama.

3. **Hardware Checker (`app/static/js/kasir/modules/hardware_checker/index.js`)**:
   - Backend `monitor_routes.py` (`/kasir/monitor/all`) sudah menyertakan `pc_grup_id`.
   - Di frontend `render(data)`, ubah sorting data:
     ```javascript
     data.sort((a, b) => {
         const grupA = Number(a.pc_grup_id || 0);
         const grupB = Number(b.pc_grup_id || 0);
         if (grupA !== grupB) return grupA - grupB;
         return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
     });
     ```
   - Tambahkan badge nama grup di header kartu di samping `pc_kode`.
   - Tambahkan kelas `.remote-hide-action` pada tombol "Update Baseline" (`HardwareChecker.registerBaseline`).

4. **Monitoring Screenshot (`app/routes/monitor/monitor_routes.py` & `screenshot/index.js`)**:
   - Endpoint `/kasir/monitor/screenshot/all`: Tambahkan `"pc_grup_id": pc.grup_id or 0` pada setiap dictionary PC.
   - Frontend `screenshot/index.js`:
     - Di `populateGroupFilter()`, petakan grup ke ID dan urutkan opsi dropdown berdasarkan ID grup terkecil ke terbesar.
     - Di `renderGrid()`, urutkan data screenshot berdasarkan `pc_grup_id` kemudian `pc_kode`.

5. **Paket Billing (`app/models/paket/paket.py` & `paket_table.js`)**:
   - Pada `Paket.to_dict()`, sertakan `"grup_id": self.grup_id`.
   - Di `paket_table.js`, kumpulkan `grup_id` per grup, lalu urutkan baris tabel paket per grup berdasarkan `grup_id`.

6. **Maintenance Modal PC Selection (`maintenance/index.js`)**:
   - Di `renderPcModal()`, urutkan grup PC berdasarkan `pc.grup_id` bukan alfabetis.

### Bagian 3: Optimasi UI/UX Hardware Checker untuk Breakpoint `lg`, `xl`, `2xl`
1. **Container Grid 2 Kolom**:
   - Di `app/templates/kasir/tabs/hardware_checker.html`:
     Ubah `<div id="hardware-checker-container" class="space-y-4">` menjadi:
     `<div id="hardware-checker-container" class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">`
   - Penggunaan `items-start` memastikan jika salah satu kartu membuka accordion detail, kartu pasangannya di kolom sebelah tidak terdistorsi atau memanjang kosong.

2. **Pembaruan Skeleton Loader**:
   - Ganti skeleton table di `hardware_checker.html` dan `Skeleton.tableRows` fallback di `index.js` dengan grid skeleton card 2 kolom (4 card) yang menyerupai bentuk asli kartu hardware checker untuk mencegah Cumulative Layout Shift (CLS).

3. **Tata Letak Kartu Internal**:
   - Header Card: `pc_kode`, badge grup, badge status mismatch/aman, dan tombol aksi (Spesifikasi Lengkap & Update Baseline) dibuat responsif dan fleksibel (`flex flex-wrap items-center gap-2`).
   - Ringkasan Komponen Internal (Chassis): Grid 3 kolom (Processor, GPU, RAM) dioptimalkan dengan padding dan font mono yang pas untuk kartu setengah lebar.
   - Accordion Detail Spesifikasi (Baseline vs Live): Pada breakpoint `lg` dan `xl`, Baseline dan Live Specs ditampilkan bertumpuk (`grid grid-cols-1 2xl:grid-cols-2 gap-3.5`) agar teks panjang seperti Serial Number, GPU PNP ID, RAM Pills, dan Disk Pills tidak sesak atau terpotong. Pada breakpoint `2xl`, keduanya tampil berdampingan secara proporsional.

---

## 3. Rincian Berkas yang Dimodifikasi

| No | Berkas | Perubahan |
|---|---|---|
| 1 | `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js` | Tag `.remote-hide-action` pada Monitor Proses, Remote Layar, Ambil Gambar, dan Screenshot Preview container; penyesuaian layout mode remote |
| 2 | `app/services/dashboard/dashboard_service.py` | Sertakan `"id": g_id` pada dictionary `grup_meta` |
| 3 | `app/static/js/kasir/modules/dashboard/dashboard_compact.js` | Urutkan tab grup dan kartu zona di dashboard berdasarkan ID grup |
| 4 | `app/templates/kasir/tabs/hardware_checker.html` | Ubah container menjadi `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start` dan modernize skeleton loader |
| 5 | `app/static/js/kasir/modules/hardware_checker/index.js` | Sorting by `pc_grup_id`, badge grup di kartu, `.remote-hide-action` pada Update Baseline, responsive card layout 2 kolom |
| 6 | `app/routes/monitor/monitor_routes.py` | Sertakan `pc_grup_id` pada output `/kasir/monitor/screenshot/all` |
| 7 | `app/static/js/kasir/modules/screenshot/index.js` | Urutkan filter grup dan kartu screenshot berdasarkan ID grup |
| 8 | `app/models/paket/paket.py` | Sertakan `grup_id` pada `Paket.to_dict()` |
| 9 | `app/static/js/kasir/modules/paket/paket_table.js` | Urutkan grup tabel paket berdasarkan ID grup |
| 10 | `app/static/js/kasir/modules/maintenance/index.js` | Urutkan grup PC di modal pilih PC tiket maintenance berdasarkan ID grup |
| 11 | `tests/test_branch_remote_readonly_sidebar.py` | Tambahkan pengujian assert untuk kelas `.remote-hide-action` pada tombol detail PC dan sorting grup |

---

## 4. Rencana Pengujian & Verifikasi
1. **Verifikasi Tombol Detail PC**:
   - Buka mode remote branch (`activeBranchId !== '0'`), buka modal detail PC.
   - Pastikan tombol Ambil Gambar, Remote Layar, Monitor Proses, dan Screenshot Preview container hilang.
   - Pastikan tombol **Hardware** tetap muncul dan dapat diklik untuk melihat spesifikasi PC.
   - Buka mode lokal (`activeBranchId === '0'`), buka modal detail PC.
   - Pastikan seluruh tombol (Ambil Gambar, Remote Layar, Monitor Proses, WOL, Pindah PC, Restart, Shutdown, Hardware) dan screenshot preview tampil 100% lengkap.
2. **Verifikasi Urutan Grup**:
   - Periksa tab dan card dashboard: Grup ber-ID 1 (misal `reguler`) muncul paling atas, diikuti ID 2, dst.
   - Periksa Hardware Checker: Unit PC dikelompokkan dan diurutkan sesuai grup ID 1, 2, dst.
   - Periksa Screenshot: Dropdown filter grup dan urutan PC berurutan berdasarkan ID grup.
   - Periksa Paket Billing: Baris paket dikelompokkan berdasarkan urutan ID grup.
3. **Verifikasi UI/UX Hardware Checker**:
   - Di resolusi monitor desktop (`lg` 1024px+, `xl` 1280px+, `2xl` 1536px+), layout tampil rapi dalam 2 kolom.
   - Buka accordion "Spesifikasi Lengkap" pada salah satu PC: kartu tetangga tidak mengalami peregangan vertikal kosong (`items-start`).
   - Kompilasi Tailwind CSS (`npm run build:css`) jika ada kelas styling baru.
   - Jalankan `python -m pytest tests/` dan pastikan seluruh test suite pass.

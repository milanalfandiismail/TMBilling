# Spesifikasi Desain: Audit Multi-Cabang, Penataan Sidebar & Mode Read-Only Cabang Remote

## 1. Ringkasan Eksekutif
Dokumen ini mendefinisikan arsitektur dan spesifikasi implementasi untuk pengelolaan cabang remote (Multi-Branch Nexus) di TMBilling:
1. **Penataan & Eliminasi Elemen Sidebar**: Menyembunyikan menu-menu lokal/administratif yang tidak relevan saat panel kasir/admin sedang mengontrol server cabang remote.
2. **Penegakan Mode Read-Only Terpadu (Dual-Layer)**: Memastikan bahwa saat terhubung ke cabang remote, antarmuka kasir dan API backend hanya mengizinkan operasi pembacaan data (Read-Only) tanpa kemampuan Create, Update, atau Delete.
3. **Penyempurnaan Tab Riwayat & Struk (`struk`)**: Mengeliminasi bug pagination phantom (`1 / 63`), menyelaraskan sinkronisasi dropdown tanggal, preview struk, dan pembersihan state lokal saat beralih cabang.
4. **Audit Sinkronisasi Data Cabang Penuh**: Memastikan seluruh data modul (Dashboard PC, Grup, Paket, Menu, Member, Laporan, Analitik) di-refresh 100% tanpa menyisakan data lokal atau cache cabang sebelumnya.

---

## 2. Analisis Audit Sidebar (Lokal vs Remote)

### A. Inventarisasi Menu Sidebar Saat Mode Cabang Remote (`activeBranchId !== '0'`)

| Grup Sidebar | Menu / Tab | Status di Remote | Tindakan & Alasan |
| :--- | :--- | :--- | :--- |
| **Navigasi Atas** | Dashboard (`dash`) | **TAMPIL** | Mode Pantau (Read-Only), tidak ada aksi mulai/stop sesi |
| | Kantin / POS (`menu`) | **TAMPIL** | Read-Only (Katalog & stok saja, tanpa kasir POS checkout) |
| | Member (`member`) | **TAMPIL** | Read-Only (Lihat daftar member, tanpa CRUD / deposit) |
| | Riwayat & Struk (`struk`) | **TAMPIL** | Read-Only & Fixed (Lihat & cetak struk cabang, tanpa hapus) |
| | Pemulihan Mati Lampu (`blackout`) | **DISEMBUNYIKAN** | Khusus operasional darurat lokal |
| | Catatan Shift (`catatan`) | **DISEMBUNYIKAN** | Sesuai permintaan user: Catatan dihilangkan |
| **Katalog & Master** | Paket Billing (`paket`) | **TAMPIL** | Read-Only (Hanya lihat paket cabang, tombol CRUD disembunyikan) |
| | Unit PC (`pc`) | **TAMPIL** | Read-Only (Hanya lihat daftar PC cabang, tombol CRUD disembunyikan) |
| | Grup PC / Zona (`grup`) | **TAMPIL** | Read-Only (Hanya lihat zona cabang, tombol CRUD disembunyikan) |
| | Kelola Game (`game_management`) | **TAMPIL** | Read-Only (Hanya lihat game cabang) |
| | Turnamen (`tournament`) | **TAMPIL** | Read-Only (Hanya lihat turnamen cabang) |
| **Laporan Keuangan** | Laporan Billing (`laporan`) | **TAMPIL** | Read-Only (Laporan keuangan cabang remote) |
| | Laporan Kantin (`laporan_menu`) | **TAMPIL** | Read-Only (Laporan penjualan kantin cabang remote) |
| | Log Stok Menu (`menu_stock_log`) | **TAMPIL** | Read-Only (Riwayat pergerakan stok cabang) |
| | Laporan Perawatan (`laporan_maintenance`)| **TAMPIL** | Read-Only (Log riwayat maintenance cabang) |
| **Hardware & Monitoring**| Statistik Server (`server_statistic`)| **TAMPIL** | Read-Only telemetri server cabang |
| | Monitor Hardware (`monitor`) | **TAMPIL** | Read-Only sensor PC cabang |
| | Hardware Checker (`hardware_checker`)| **DISEMBUNYIKAN** | Sesuai permintaan user: Hardware checker dihilangkan |
| | Pelacak Uptime PC (`uptime`) | **TAMPIL** | Read-Only jam terbang PC cabang |
| | Perawatan PC (`maintenance`) | **TAMPIL** | Read-Only jadwal servis cabang |
| | Monitor Screenshot (`screenshot`) | **TAMPIL** | Read-Only snapshot layar PC cabang |
| | Remote Server (`remote_server`) | **DISEMBUNYIKAN** | Sesuai permintaan user: Remote server dihilangkan |
| **Multi Cabang** | Pengaturan Cabang (`branch`) | **DISEMBUNYIKAN** | Khusus server lokal pusat |
| | List Koneksi Cabang (`branch_inbound`)| **DISEMBUNYIKAN** | Khusus server lokal pusat |
| | Akun Kasir Cabang (`branch_kasir`) | **DISEMBUNYIKAN** | Khusus server lokal pusat |
| **Sistem & Utilitas** | MikroTik Hotspot (`mikrotik`) | **DISEMBUNYIKAN** | Sesuai permintaan: Hanya sisakan Analitik Owner |
| | **Analitik Owner (`analytics`)** | **TAMPIL** | **SATU-SATUNYA menu Sistem & Utilitas yang tampil** |
| | File Explorer (`fileexplorer`) | **DISEMBUNYIKAN** | Sesuai permintaan user: File Explorer dihilangkan |
| | Log Sistem (`log`) | **DISEMBUNYIKAN** | Sesuai permintaan: Hanya sisakan Analitik Owner |
| | Ekstensi & Plugin (`plugins`, `plugin-spa`)| **DISEMBUNYIKAN** | Sesuai permintaan: Hanya sisakan Analitik Owner |
| | Dokumentasi (`documentation`) | **DISEMBUNYIKAN** | Sesuai permintaan: Hanya sisakan Analitik Owner |
| **Manajemen Staff** | Seluruh Grup Manajemen Staff | **DISEMBUNYIKAN** | Sesuai permintaan user: Manajemen Staff dihilangkan |
| **Pengaturan Server** | Seluruh Grup Pengaturan Server | **DISEMBUNYIKAN** | Sesuai permintaan user: Pengaturan Server dihilangkan |

---

## 3. Desain Mode Read-Only Terpadu (Dual-Layer)

### A. Layer Frontend (DOM & CSS Protection)
1. **Atribut State Body**:
   - Saat beralih ke remote (`activeBranchId !== '0'`), `BranchManager` menyetel:
     `document.body.setAttribute('data-branch-mode', 'remote')`
   - Saat kembali ke lokal (`activeBranchId === '0'`), menyetel:
     `document.body.setAttribute('data-branch-mode', 'local')`
2. **Indikator Banner Visual**:
   - Menambahkan banner informatif di bagian atas panel atau navbar:
     `"👁️ Mode Pantau Cabang (Read-Only) — Anda sedang mengamati cabang remote. Perubahan data dinonaktifkan."`
3. **Penyembunyian Tombol Aksi Mutasi (CSS Utility & Class Hook)**:
   - Menambahkan class `.remote-hide-action` pada seluruh tombol Create, Update, Delete di halaman:
     - Dashboard: Tombol buka sesi, tambah durasi, transfer meja, force shutdown/lock.
     - PC: Tombol "Tambah PC", edit PC, hapus PC.
     - Paket: Tombol "Tambah Paket", edit paket, hapus paket.
     - Grup: Tombol "Tambah Grup", edit grup, hapus grup.
     - Menu: Tombol "Tambah Item", tombol checkout POS kantin.
     - Member: Tombol "Tambah Member", deposit saldo, edit member.
     - Riwayat Struk: Tombol hapus struk, hapus per tanggal, kosongkan riwayat.

### B. Layer Backend (Reverse Proxy Defense-in-Depth)
1. **Intercept Mutasi di `BranchProxyService.relay_request`**:
   - Mencegah eksekusi method `POST`, `PUT`, `DELETE`, `PATCH` pada relay multi-cabang (kecuali telemetry ping).
   - Mengembalikan response standard:
     ```json
     {
       "success": false,
       "error": "Operasi Ditolak: Server cabang remote hanya dapat diakses dalam mode pantau (Read-Only)"
     }
     ```
     dengan HTTP Status `403 Forbidden`.

---

## 4. Root Cause & Solusi Tab Riwayat & Struk (`struk`)

### A. Akar Masalah (Root Cause)
1. **Ghost Pagination `1 / 63`**:
   - Di `app/static/js/kasir/modules/struk/index.js` baris 187, ketika `listData.length === 0`, fungsi `loadHistory` melakukan `return;` tanpa mereset elemen `#struk-pagination`.
   - Fungsi `resetState()` pada `Struk` juga tidak mengosongkan `#struk-pagination`. Akibatnya, pagination dari server lokal tetap tertinggal di layar DOM.
2. **Penyimpanan Cache Lokal di `localStorage`**:
   - `Struk.init()` memuat `lastStrukData` dari `localStorage` yang berasal dari transaksi lokal warnet sebelumnya.
3. **Dropdown Tanggal Tidak Sinkron**:
   - `Struk.loadDateOptions()` hanya dipanggil saat init halaman, bukan saat `refreshAllModulesAfterBranchSwitch()`.

### B. Solusi
1. Kosongkan `#struk-pagination` baik di `Struk.resetState()` maupun di `loadHistory()` saat `listData.length === 0` atau `res.pages <= 1`.
2. Panggil `Struk.loadDateOptions()` dan `Struk.loadHistory()` secara eksplisit pada `refreshAllModulesAfterBranchSwitch()`.
3. Bersihkan `localStorage.removeItem('lastStrukData')` saat berpindah cabang dan reset preview struk ke placeholder default.
4. Sembunyikan tombol hapus struk (`deleteReceipt`, `deleteByDate`, `clearAllHistory`) saat `activeBranchId !== '0'`.

---

## 5. Strategi Verifikasi & Testing
1. **Unit Test UI Rendering**:
   - Memastikan saat role admin lokal membuka `/kasir/`, semua tombol sidebar normal tersedia.
   - Memastikan verifikasi selector helper untuk tombol-tombol yang disembunyikan saat remote.
2. **Integration Test Relay API**:
   - Menguji bahwa relay request dengan `POST` / `DELETE` ke remote server mengembalikan HTTP 403 Forbidden (Read-Only Protection).
3. **Manual Simulation Verification**:
   - Memastikan transisi switch ke cabang remote (port 7016) membersihkan pagination struk menjadi kosong ("Tidak ada transaksi") tanpa ghost `1 / 63`.
   - Memastikan menu sidebar langsung terpotong rapi sesuai daftar eliminasi di Bab 2.

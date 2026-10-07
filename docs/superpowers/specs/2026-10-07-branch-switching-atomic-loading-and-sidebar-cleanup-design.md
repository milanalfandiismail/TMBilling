# Design Spec: Multi-Branch Atomic Loading Handshake & Sidebar Cleanup v1.6.4

**Tanggal:** 2026-10-07  
**Branch:** `v1.6.4`  
**Status:** Draf Perencanaan Disetujui  
**Target Rilis:** v1.6.4  

---

## 1. Latar Belakang & Masalah

### A. Polusi Menu Multi Cabang di Sidebar Admin
Pada versi sebelumnya (v1.6.1 - v1.6.3), terdapat grup navigasi tersendiri di `sidebar_admin.html`:
- `sidebar-branch-section` ("MULTI CABANG")
- Tombol `Pengaturan Cabang` (`branch`)
- Tombol `List Koneksi Cabang` (`branch_inbound`)
- Tombol `Akun Kasir Cabang` (`branch_kasir`)

Hal ini menyebabkan sidebar menjadi terlalu padat dan tidak seragam dengan estetika sidebar lama. Pengelolaan cabang sejatinya telah memiliki tempat tersendiri pada dropdown navigasi navbar (`branch-selector-dropdown` -> tombol **"Kelola Cabang"**). Selain itu, terdapat bug struktural di mana tombol-tombol cabang berada di luar elemen pembungkus `#sidebar-branch-section`, sehingga tombol-tombol tersebut tetap muncul saat kasir beralih ke cabang remote.

### B. Glitch Transisi Pergantian Cabang (Race Condition Notifikasi & Data)
Saat admin berpindah cabang (baik dari Lokal ke Remote, antar-Remote, maupun kembali ke Lokal):
1. Sistem saat ini langsung memunculkan toast `Berhasil beralih ke [Nama Cabang]` **sebelum** proses sinkronisasi dan pengambilan data (`refreshAllModulesAfterBranchSwitch`) selesai dijalankan.
2. Tidak terdapat indikator loading transisi layar penuh (overlay loader / skeleton state) selama proses pergantian konteks dan pengambilan data berlangsung.
3. Akibatnya, antarmuka kasir sempat menampilkan data usang (stale data) dari cabang sebelumnya selama 1–3 detik setelah notifikasi sukses muncul, yang membingungkan kasir/operator.
4. Hal serupa terjadi saat cabang remote mengalami putus koneksi (disconnect failover); perpindahan kembali ke lokal tidak memiliki transisi loading yang terproteksi.

---

## 2. Tujuan Desain (Goals)

1. **Pembersihan Sidebar (Kembali ke Standar Flat Lama)**:
   - Menghapus grup menu `Multi Cabang` (`sidebar-branch-section` beserta sub-tombolnya) dari `sidebar_admin.html`.
   - Mengembalikan pengelolaan cabang secara terpusat melalui tombol **"Kelola Cabang"** pada dropdown Branch Selector di Navbar dan tab Pengaturan.
   - Memastikan saat berada di Cabang Remote, fitur-fitur lokal yang tidak relevan (seperti File Explorer lokal, Dokumentasi/Tutorial lokal) disembunyikan dengan rapi dan dimunculkan kembali saat kembali ke Cabang Lokal.

2. **Atomic Branch Loading Handshake (Zero-Glitch Transition)**:
   - Mengimplementasikan `BranchSwitchOverlay` (transisi loading layar penuh modern dengan status dinamis dan animasi halus).
   - Menata ulang alur eksekusi `switchBranch`:
     $$\text{Trigger Switch} \longrightarrow \text{Show Overlay} \longrightarrow \text{Handshake Context} \longrightarrow \text{Fetch All Branch Data} \longrightarrow \text{Render UI} \longrightarrow \text{Hide Overlay} \longrightarrow \text{Show Success Toast}$$
   - Notifikasi sukses HANYA boleh dipicu setelah 100% data cabang target diterima dan berhasil dirender di DOM.
   - Menangani skenario kegagalan koneksi (timeout/offline) dengan mengembalikan status tanpa merusak data aktif.
   - Mengintegrasikan mekanisme yang sama pada alur `handleActiveBranchDisconnect` (failover lokal yang aman dan mulus).

---

## 3. Rincian Arsitektur & Komponen

### A. Pembersihan & Penyelarasan Sidebar (`sidebar_admin.html` & `branch/index.js`)
- Menghapus blok HTML grup `MULTI CABANG` dari `app/templates/kasir/components/sidebar_admin.html`:
  - Menghapus `#sidebar-branch-section`
  - Menghapus tombol `sidebar-tab-branch`, `branch_inbound`, dan `branch_kasir`.
- Menyesuaikan fungsi `updateBrandAndSidebarVisibility()` di `app/static/js/kasir/modules/branch/index.js` agar tidak lagi mencari `#sidebar-branch-section` yang sudah dihapus, sekaligus memperkuat penyembunyian item lokal saat remote aktif:
  - Menyembunyikan `#sidebar-fileexplorer-btn` (File Explorer lokal).
  - Menyembunyikan `#sidebar-documentation-btn` (Dokumentasi lokal).
  - Menyembunyikan `#sidebar-remote-server-btn` atau tombol remote server jika ada.

### B. Komponen Overlay Loading Transisi Cabang (`BranchSwitchOverlay`)
Komponen visual transisi diletakkan di `app/templates/kasir/components/modals.html` atau di-render secara dinamis oleh JavaScript:
```html
<div id="branch-switch-overlay" class="fixed inset-0 z-50 hidden bg-black/80 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300">
    <div class="flex flex-col items-center text-center p-6 max-w-sm">
        <div class="relative w-16 h-16 mb-4">
            <div class="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping"></div>
            <div class="w-16 h-16 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin flex items-center justify-center">
                <svg class="w-6 h-6 text-emerald-400" ...></svg>
            </div>
        </div>
        <h3 id="branch-switch-title" class="text-base font-bold text-neutral-100">Menghubungkan ke Cabang...</h3>
        <p id="branch-switch-status" class="text-xs text-neutral-400 mt-1">Mengautentikasi kunci enkripsi & verifikasi jaringan...</p>
    </div>
</div>
```

### C. Alur Asinkron Terurut (Sequential Asynchronous Handshake)
Dalam `BranchManager.switchBranch(targetBranchId)`:
```javascript
async switchBranch(branchId) {
    // 1. Validasi role admin & cegah duplikasi switch
    if (String(branchId) === this.activeBranchId) return;

    // 2. Tampilkan BranchSwitchOverlay dengan status awal
    this.showSwitchLoading(targetBranchName, "Menguji koneksi & verifikasi kunci API...");

    try {
        // 3. Handshake ke backend switch-context
        const res = await API.branch.switchContext(targetId);
        if (!res || !res.success) throw new Error(res?.error || "Gagal switch context");

        // 4. Update status overlay: Memuat data cabang
        this.updateSwitchStatus("Menyinkronkan data PC, grup & transaksi...");

        // 5. Update state sesi lokal
        this.activeBranchId = targetIdStr;
        this.activeBranchName = targetName;
        sessionStorage.setItem('active_branch_id', this.activeBranchId);
        sessionStorage.setItem('active_branch_name', this.activeBranchName);

        // 6. Alihkan tab jika sedang membuka tab terlarang di remote
        if (this.activeBranchId !== '0' && ['branch', 'branch_inbound', 'branch_kasir', 'fileexplorer'].includes(App.currentTab)) {
            App.switchTab('dash');
        }

        // 7. Await tuntas seluruh modul termuat dan dirender di DOM
        await this.refreshAllModulesAfterBranchSwitch();

        // 8. Perbarui elemen UI navbar & sidebar
        this.renderNavbarDropdown();
        this.updateBrandAndSidebarVisibility();

        // 9. Tutup overlay loading
        this.hideSwitchLoading();

        // 10. TAMPILKAN TOAST SUKSES (Hanya setelah data 100% siap)
        if (window.Toast) {
            window.Toast.show(targetIdStr === '0' ? `Kembali ke ${this.localWarnetTitle} (Lokal)` : `Berhasil terhubung ke ${this.activeBranchName}`, "success");
        }
    } catch (err) {
        this.hideSwitchLoading();
        // Rollback state & tampilkan notifikasi error
        this.renderNavbarDropdown();
        if (window.Toast) window.Toast.show(err.message, "error");
    }
}
```

### D. Disconnect / Failover Handling
Mekanisme yang sama diimplementasikan pada `handleActiveBranchDisconnect`:
- Tampilkan loading overlay dengan pesan `"Koneksi ke [Cabang] terputus. Mengembalikan ke Cabang Lokal..."`.
- Jalankan failover ke `switchBranch('0')`.
- Data lokal termuat 100% baru overlay ditutup dan peringatan dimunculkan.

---

## 4. Kriteria Pengujian & Verifikasi (Acceptance Criteria)

1. **Sidebar Bersih**:
   - Menu `Multi Cabang`, `List Koneksi Cabang`, dan `Akun Kasir Cabang` tidak ada lagi di sidebar admin.
   - Sidebar admin dan kasir kembali ramping dan flat 100%.
2. **Akses Pengelolaan Cabang Tetap Berjalan**:
   - Tombol "Kelola Cabang" di dropdown navbar membuka tab/modal pengelolaan cabang dengan lancar saat di mode lokal.
3. **Zero-Glitch Loading Overlay**:
   - Saat mengklik cabang di dropdown navbar, overlay loading langsung muncul.
   - Toast sukses TIDAK muncul di awal, melainkan hanya muncul setelah overlay tertutup dan data PC/transaksi cabang target telah tampil di layar.
4. **Perpindahan Cabang Mulus**:
   - Berpindah dari Lokal ke Cabang Remote $\rightarrow$ data PC cabang remote langsung tampil saat loading selesai.
   - Berpindah kembali ke Lokal $\rightarrow$ data PC lokal langsung tampil saat loading selesai.
   - Berpindah antar-cabang remote $\rightarrow$ data cabang baru langsung tampil tanpa flicker.
5. **Failover Terproteksi**:
   - Jika cabang offline saat dicoba connect, overlay ditutup dan pesan error yang jelas muncul tanpa merusak tampilan data aktif.
6. **Seluruh Test Suite Backend Tetap Lulus**:
   - `python -m pytest tests/ -q` tetap menghasilkan 264 passed (100%).

// app/static/js/kasir/modules/branch/index.js
/**
 * Modul BranchManager untuk mengelola fitur Multi-Cabang di Kasir TMBilling.
 * Facade terpadu yang menggabungkan sub-modul:
 * - BranchCore: State cabang aktif, dropdown navbar switcher, auto-refresh live, dan sync data.
 * - BranchCrud: Manajemen konfigurasi outbound cabang, modal tambah/edit/hapus, dan uji koneksi.
 * - BranchOperators: Manajemen akun kasir cabang remote.
 * - BranchInbound: Manajemen koneksi masuk (inbound), approval, blokir, dan hapus.
 */

const BranchManager = {
    ...(window.BranchCore || {}),
    ...(window.BranchCrud || {}),
    ...(window.BranchOperators || {}),
    ...(window.BranchInbound || {})
};

window.BranchManager = BranchManager;

// Auto-init saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    BranchManager.init();
});

// app/static/js/kasir/modules/shift/index.js
/**
 * Modul Handover Shift Kasir TMBilling
 * Facade terpadu yang menggabungkan sub-modul:
 * - ShiftCore: Buka/tutup shift, validasi kasir, rekonsiliasi kas, dan cetak handover.
 * - ShiftHistory: Riwayat shift sebelumnya, filter periode, dan audit user log.
 */

const Shift = {
    ...(window.ShiftCore || {}),
    ...(window.ShiftHistory || {})
};

window.Shift = Shift;

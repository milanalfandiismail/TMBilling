// app/static/js/kasir/modules/menu/index.js
/**
 * Modul Menu POS Kasir TMBilling
 * Facade terpadu yang menggabungkan sub-modul:
 * - MenuCatalog: State katalog, view switcher, filter stok, dan render produk.
 * - MenuCart: Keranjang kasir, kalkulasi total/kembalian, dan proses checkout/bayar.
 * - MenuCrud: Modal tambah/edit produk, upload/crop gambar 4:3, dan lightbox.
 */

const Menu = {
    ...(window.MenuCatalog || {}),
    ...(window.MenuCart || {}),
    ...(window.MenuCrud || {})
};

window.Menu = Menu;

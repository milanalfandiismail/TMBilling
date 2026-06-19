# Dokumentasi Pembaruan UI/UX: Format Rupiah, POS F&B Menu & Layout Mobile

Dokumen ini menjelaskan spesifikasi dan implementasi dari rangkaian pembaruan UI/UX yang diterapkan pada sistem **TMBilling** (Kasir & POS). Pembaruan ini dirancang untuk meningkatkan responsivitas antarmuka pada perangkat mobile, mengoptimalkan proses input kasir, serta menyamakan visual mata uang di seluruh ekosistem aplikasi sesuai dengan standar nasional Indonesia.

---

## 🪙 1. Standardisasi Format Mata Uang (`Rp10.000`)

Sebelumnya, penulisan nominal mata uang di aplikasi bervariasi (misalnya `Rp 10.000`, `Rp10,000`, atau `RP 10.000`). Seluruh sistem kini diselaraskan mengikuti **Standar Nasional Indonesia (EYD/PUEBI)**:
*   **Format Standar**: `Rp[nominal]` (lambang "Rp" diawali huruf R kapital, p kecil, diikuti langsung oleh nominal angka tanpa spasi, menggunakan tanda titik `.` sebagai pemisah ribuan). Contoh: `Rp10.000`, `Rp150.000`.

### Implementasi Teknis:
1.  **Javascript Utility (`app/static/js/kasir/core/utils.js`)**:
    Fungsi global `Utils.formatRupiah(angka)` diubah untuk melakukan pembulatan dan pemisahan ribuan secara manual menggunakan ekspresi reguler daripada mengandalkan default browser:
    ```javascript
    formatRupiah(angka) {
        if (angka === undefined || angka === null) angka = 0;
        const formatted = Math.round(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `Rp${formatted}`;
    }
    ```
2.  **Python Helper (`app/utils/helpers.py`)**:
    Fungsi `format_rupiah(nominal)` diperbarui agar mengganti koma ribuan default Python menjadi tanda titik ribuan khas Indonesia:
    ```python
    def format_rupiah(nominal):
        if nominal is None:
            nominal = 0
        formatted = f"{int(nominal):,}".replace(",", ".")
        return f"Rp{formatted}"
    ```
3.  **Refaktor Skrip Modul**:
    Semua modul Javascript kasir (`shift`, `menu`, `dashboard`, `struk`, `member`, `laporan`, dll) yang sebelumnya memformat mata uang secara manual via `toLocaleString('id-ID')` atau string literal `Rp ${...}` kini didelegasikan sepenuhnya ke `Utils.formatRupiah()`.
4.  **Jinja Templates (`dashboard.html` & `paket/index.html`)**:
    Format rendering HTML publik/member yang menggunakan format Jinja `{:,}` diselaraskan dengan menambahkan `.replace(',', '.')` di belakangnya agar mematuhi tanda pemisah titik.

---

## 📱 2. Perbaikan Layout Filter Laporan pada Mobile

Pada layar HP atau tablet (viewport sempit), filter laporan billing dan laporan kantin sebelumnya meluap (overflow) keluar dari batas kartu (card) karena susunan flexbox horizontal yang kaku.

### Solusi Responsif:
*   Mengubah container filter di [laporan.html](file:///c:/Milan/GIT/TMBilling/app/templates/kasir/tabs/laporan.html) dan [laporan_menu.html](file:///c:/Milan/GIT/TMBilling/app/templates/kasir/tabs/laporan_menu.html) menggunakan Tailwind CSS flex-wrap:
    `class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end"`
*   Menambahkan class `flex-1 sm:flex-initial` pada elemen select dropdown (`#laporan-kasir-select`, `#laporan-tanggal-select`) dan class `w-full sm:w-auto` pada tombol **Tampilkan**.
*   **Hasil**: Pada mobile, dropdown akan membagi ruang baris atas secara proporsional dan tombol Tampilkan akan memanjang penuh di baris bawahnya. Di layar desktop, layout otomatis kembali horizontal rapat secara rapi.

---

## 🛒 3. Pembaruan Form & POS F&B Menu (`Kantin / POS`)

### 3.1 Checkbox "Stok Unlimited"
Kasir tidak perlu lagi mengetik nilai `-1` secara manual di kolom stok untuk menandakan stok barang tak terbatas.
*   **Komponen UI**: Ditambahkan checkbox `#menu-stok-unlimited` langsung di bawah input stok awal pada modal Tambah/Edit Menu.
*   **Perilaku Interaktif**:
    *   Jika dicentang, input field stok otomatis menjadi `disabled = true` dan `required = false`, isinya dikosongkan, serta menampilkan placeholder `Unlimited (∞)`. Saat data disubmit, JS mengirim nilai stok `-1` ke REST API.
    *   Jika tidak dicentang, input field stok menjadi aktif kembali (`disabled = false` dan `required = true`) dengan nilai minimum `0` (angka tidak boleh negatif).
    *   Pada modal Edit Menu, sistem secara cerdas memeriksa nilai stok dari database. Jika stok bernilai `< 0` (seperti `-1`), checkbox unlimited otomatis tercentang secara visual.

### 3.2 Real-time Auto-Format Ribuan Input Harga
Input harga makanan/minuman dan paket billing diubah agar memformat ribuan secara instan saat pengguna mengetik:
*   **Peralihan Elemen**: Elemen input diubah dari `type="number"` menjadi `type="text" inputmode="numeric"`. Atribut `inputmode="numeric"` tetap memicu keyboard angka pada smartphone.
*   **Fungsi Format**: `Utils.formatInputRupiah(this)` dipicu pada event `oninput`. Fungsi ini menyaring karakter non-angka, mengubahnya ke format ribuan bertitik (`10.000`), dan secara cerdas menghitung selisih posisi kursor agar kursor pengetikan tidak melompat.
*   **Sanitasi Sisi Klien**: Sebelum data payload dikirim ke API backend Flask, nilai input teks harga dibersihkan dari tanda titik pemisah menggunakan `.replace(/\./g, '')` lalu diparse menggunakan `parseInt()`.

### 3.3 Default Tipe Pemesanan POS
Pada keranjang belanja kasir, pilihan **Tipe Pemesanan** (`#menu-order-pc-select`) disetel default ke **"Makan di Tempat"** (Tempat) daripada "Take Away", untuk mempercepat transaksi kasir karena mayoritas pesanan warnet dimakan di tempat.

---

## 🐛 4. Perbaikan Bug Soft-Delete Menu & Restorasi Otomatis

Sebelumnya, jika sebuah menu yang memiliki riwayat transaksi penjualan dihapus, sistem akan mengalami error integrity constraint database karena kunci asing (foreign key) `menu_id` pada tabel `transaksi_menu` dilanggar.

### Mekanisme Solusi Baru:
1.  **Skema database (Soft-Delete)**:
    Ditambahkan kolom boolean `is_active` pada model `MenuItem` (via migrasi Alembic `378524089e68_add_is_active_to_menu_item.py`). Secara default, kolom ini bernilai `True` (`1`).
2.  **Logika Penghapusan Cerdas (`MenuService.delete_menu`)**:
    *   Sistem memeriksa apakah item menu tersebut sudah pernah terjual.
    *   Jika **belum pernah terjual**, menu langsung didelete permanen dari database.
    *   Jika **sudah memiliki transaksi historis**, menu tidak dihapus secara fisik melainkan diarsipkan secara lunak (`is_active = False`). Menu yang tidak aktif ini tidak akan muncul di katalog POS kasir, tetapi transaksi lamanya tetap valid dan struk lamanya tetap dapat dicetak dengan benar.
3.  **Restorasi Otomatis saat Pembuatan Ulang**:
    Jika admin membuat menu baru dengan **nama yang persis sama** dengan menu yang telah diarsipkan (`is_active = False`), sistem tidak akan memicu error "Nama unik terduplikasi". Sebaliknya, sistem secara otomatis merestorasi menu lama tersebut (`is_active = True`), memperbarui harga, stok baru, dan path gambar terbarunya secara transparan.
4.  **Endpoint Hard-Delete Permanen**:
    Disediakan opsi penghapusan total beserta seluruh riwayat transaksinya melalui REST API khusus:
    `DELETE /api/menu/<menu_id>/permanent`
    *(Membutuhkan konfirmasi ganda dari kasir sebelum dieksekusi untuk mencegah hilangnya data keuangan historis).*

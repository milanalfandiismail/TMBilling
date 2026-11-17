# Kasus POS Kantin & Struk — Task 4

Dijalankan lewat MCP Playwright headed di sandbox Rust 2.0.0 port 7017.

| ID | Hasil | Bukti |
|---|---|---|
| K-POS-01 | LULUS | `Menu.addToCart(1)` → 1 baris keranjang Nasi Goreng Rp15.000. |
| K-POS-02 | LULUS | Qty 2 → Rp30.000; tombol − → Rp15.000; hapus item → keranjang kosong. |
| K-POS-03 | LULUS | Filter tersedia 3 kartu; Air Mineral (id 3, stok 0) tampil sebagai habis. |
| K-POS-04 | LULUS | Checkout Tunai 15.000 → `transaksi_menu` id 2 `TMM-20261117-001-c07917`, kembalian 0, stok 20→19. |
| K-POS-05 | LULUS | Tunai 1.000 → `#btn-submit-payment` disabled, tidak ada baris transaksi baru. |
| K-POS-06 | LULUS | Metode QRIS → nota `TMM-20261117-002-a47157`, total 15.000 (kolom tunai tetap 15.000, sama Python). |
| K-POS-07 | LULUS | Qty Mie Instan ke-4 → toast "Stok 'Mie Instan' hanya tersedia 3", qty tetap 3. |
| K-POS-08 | LULUS | Restock Air Mineral +10 catatan "E2E restock" → `menu_stock_log` id 3 `stok_sebelum 0 → stok_sesudah 10`. |
| K-POS-09 | LULUS | Tanpa shift: checkout → 400 gate shift, modal buka shift muncul otomatis, keranjang kosong, DB tidak berubah. |
| K-POS-10 | LULUS | Kasir tidak melihat tombol tambah menu; admin melihat 1 tombol → tambah `E2E Kopi` id 5 stok 8. |
| K-POS-11 | LULUS | Arsip menu via `Menu.deleteItem(5)` → hilang katalog; restore via pill arsip MENU FNB → `is_active=1`. |
| K-POS-12 | LULUS* | Tab Struk kosong sampai patch `alias_data` (`history_struk`/`history_menu`); klik nota kantin error sampai patch `"id": r.id` di `app-rust/src/services/report/report_service.rs`. Setelah itu preview nota tampil (Tunai Rp15.000, 17/11/2026 17:23 WITA) + tombol cetak. |

Bug yang dipatch di Task 4: kunci payload struk (`alias_data`), `id` nota kantin untuk preview, dan verifikasi tidak ada regresi stok/kembalian.

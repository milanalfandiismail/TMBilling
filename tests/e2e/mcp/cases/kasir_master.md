# Kasus Master Data (K-MST)

Dijalankan lewat browser MCP terlihat pada sandbox Rust `http://127.0.0.1:7017`
(root `instance/e2e/mcp-rust`), 2026-11-17.

| ID | Hasil | Bukti |
|---|---|---|
| K-MST-01 | LULUS | `grup` id 4 `e2e vip2` (nama di-lowercase validasi) |
| K-MST-02 | LULUS | edit `e2e vip2 edit`; arsip `aktif=0`; pulihkan `aktif=1`; dropdown filter grup memuat id 4 |
| K-MST-03 | LULUS (beda UI) | modal memakai `#modal-pc-prefix`+`#modal-pc-number` (kode dibentuk), bukan `#modal-pc-nama`; hasil `PC-1` id 6, ip 10.10.0.99, grup 4 |
| K-MST-04 | LULUS setelah fix | batch 20–21 membuat `PC-20`/`PC-21`; bug SQL `unrecognized token "\"` di `pc_service.rs` + `repositories/game.rs` diperbaiki |
| K-MST-05 | LULUS | edit nama `PC Satu Edit`; arsip `aktif=0`; kartu `data-pc-id=6` hilang dari denah |
| K-MST-06 | LULUS | hapus permanen `PC-21` id 8; modal `#modal-confirm-check` wajib dicentang; baris hilang |
| K-MST-07 | LULUS (beda UI) | nama paket dibentuk otomatis `REGULER - 45 Menit` dari grup+durasi; `paket` id 5 durasi 45 harga 7000 |
| K-MST-08 | LULUS | arsip `aktif=0`; hilang dari katalog modal Buka Sesi; pulihkan `aktif=1` |
| K-MST-09 | LULUS (beda field) | `#modal-mem-user|pass|nama|email`; `member` id 5 `e2emember`, hash scrypt, waktu 0 |
| K-MST-10 | LULUS | edit nama+password (hash berubah), arsip lalu pulihkan; login member diuji di Task 9 |
| K-MST-11 | LULUS | refill paket 5 qty 1 + paket 1 qty 2 → menit 45→165, transaksi 105 (7000/45) + 106 (16000/120) satu waktu commit |
| K-MST-12 | LULUS | refund transaksi 105 → transaksi 107 `refund_paket` −7000/−45, `is_refunded=1`, menit 165→120 |
| K-MST-13 | LULUS (beda UI) | konfirmasi checkbox, bukan ketik nama; `e2edel` terhapus, `e2emember` tetap |
| K-MST-14 | LULUS | user id 3 `e2ekasir` role kasir, hash scrypt |
| K-MST-15 | LULUS | edit nama; arsip `aktif=0`; login `e2ekasir` ditolak ("Username atau password salah") |
| K-MST-16 | LULUS | hapus admin terakhir → 400 "Tidak dapat menghapus satu-satunya Admin tersisa!"; baris tetap |
| K-MST-17 | LULUS | game id 3 `E2E Game`, kategori FPS, `aktif=1`, ikon null (opsional) |
| K-MST-18 | LULUS | edit `E2E Game Edit`; filter tipe `game` + pencarian; arsip `aktif=0` hilang dari daftar |
| K-MST-19 | LULUS | kategori `E2E Cat` dibuat id 2 lalu dihapus (dialog konfirmasi native) |
| K-MST-20 | LULUS | 7 kategori arsip berpindah; pulihkan game id 3 (`aktif=1`), arsip ulang, hapus permanen (baris hilang) |
| K-MST-21 | LULUS | pencarian member menyaring 1 baris; Next disabled saat semua baris satu halaman; toggle view aktif/arsip |
| K-MST-22 | LULUS | shift ditutup → tambah grup tetap 200; aksi uang tetap 400 gate shift (K-POS-09) |

## Perbedaan UI vs plan (bukan bug)

- PC add: prefix+nomor membentuk kode, nama tampil terpisah.
- Paket add: nama dibentuk otomatis.
- Hapus permanen memakai checkbox (`requireCheck`), bukan mengetik nama.
- Hapus kategori game memakai `window.confirm` native.

## Bug diperbaiki saat Task 5

1. SQL batch PC & game memakai `\\` + newline → `unrecognized token: "\"` (`app-rust/src/services/pc/pc_service.rs`, `app-rust/src/repositories/game.rs`).
2. Daftar struk kosong: respons memakai kunci `data`, UI membaca `history_struk`/`history_menu` (`app-rust/src/routes/report/report_routes.rs`).
3. Detail nota kantin "Gagal memuat data": meta grup tanpa `id` (`app-rust/src/services/report/report_service.rs`).

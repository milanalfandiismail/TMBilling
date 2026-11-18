# Kasus Lanjutan — 2026-11-18

Bukti run MCP headed (sandbox 7017, admin + kasir1). Semua aksi lewat UI; angka dicek ke DB
(`tests/e2e/rust/scenario.py`). Gate: `GATE LULUS` (352 handler, 0 unclassified, 0 missing case,
0 missing evidence).

## Dashboard (K-DSH)
- Detail PC: 8 aksi; MONITOR PROSES menampilkan 3 proses seed; kill proses 403 untuk kasir
  (paritas `@admin_required`), AMBIL GAMBAR 403 kasir / 200 admin.
- HARDWARE: toast "Data hardware berhasil diperbarui!" + baseline tersimpan (168 B).
- Denah: drag simpan posisi `pc.pos_x/pos_y`, hapus set -1, grid Reguler dipulihkan.
- Pengaturan: interval polling 3000 ms + deteksi LAN drop tersimpan di localStorage.
- Regresi waktu kartu: 60m → 120m setelah tambah 1 Jam (tidak ada 0m/undefined/NaN).

## Master data & pagination
- Grup/Paket/User/Member/Catatan/PC/Menu: edit, hapus, pagination, filter, toggle arsip.
- Paket.edit(6) harga 6100; Paket.delete(6) 16→15; Grup.changePage(2) baris #10→#6;
  User.resetKuota(4) sisa 0; Catatan.openDeleteModal/closeDeleteModal; Menu.clearCart total Rp0.
- Member.delete(hapus permanen) hanya admin, wajib checkbox.

## Laporan, log, struk, stok
- Struk: 8 nota, cari TMM-/TM-, preview, cetak (window.print), export PDF 2313 B, reprint.
- LaporanMenu: ringkasan Rp45.000 (alias `total_pendapatan_menu`), detail per nota, export PDF 1880 B.
- LaporanMaintenance: filter tanggal/kategori, export PDF 1795 B (rows kosong tidak 500 lagi).
- Log: filter kategori, detail JSON, TXT/PDF, bersihkan → `logs/warnet.log` dibuat ulang.
- MenuStockLog: detail, reset filter, pagination.
- Menu.quickAddRestock(5) → qty 15.

## Shift & gate uang
- Buka/tutup shift, force close admin, selisih laci (DEFISIT -199.000, SESUAI), riwayat shift
  (`limit>100` 400, tanggal invalid 400), cetak serah terima.
- Tanpa shift: buka sesi/POS ditolak 400 + modal buka shift otomatis; tambah grup tetap boleh.
- 20 endpoint uang memakai `shift_required`.

## Turnamen, maintenance, blackout, monitor
- Playoff 4 tim: skor semifinal + final membentuk juara, status jadi selesai; swiss finishStage,
  qualify, next swiss, delete turnamen.
- Maintenance: buat tiket (prioritas RENDAH/SEDANG/TINGGI/KRITIS), proses, selesai + resolusi/biaya,
  hapus; tiket KRITIS menonaktifkan PC dan SELESAI mengaktifkan lagi.
- Blackout: filter status, deteksi, resolve guest tutup, clear resolved.
- Uptime: preset 7/30 hari, custom rentang, filter grup, pagination.
- Screenshot: trigger grup/PC, lightbox, cari; gambar privat hanya admin (kasir 403).
- MikroTik: test koneksi (pesan error satu prefix), simpan, syncAllMembers.

## Settings (10 sub-tab)
- General: judul/telepon/alamat/gmaps/pengumuman/TV signage/polling/auto shutdown, QRIS, API key,
  whitelist URL token (`_wl*`), toggle visibilitas.
- Payment: tambah/hapus metode. Kiosk: footer. Cloudflare: validasi token kosong.
- Scheduler: preset 6 jam tersimpan (`auto_backup_value/unit`). Cloud backup: test + unggah
  (BACKUP_CLOUD_SUCCESS). Local backup: daftar + ukuran, hapus (checkbox). DB cleanup: purge +
  backup + statistik ukuran. Migration: SKEMA AKTIF/HEAD + riwayat.

## Migrasi/update & VNC
- MigrationModule: detail revisi, copy revision, upload tanpa file (validasi), cek GitHub.
  `executeGitHubUpdate` sengaja tidak dijalankan (update destruktif, tanpa rilis baru) — exempt.
- VNC: 14 handler UI (toggle skala/fullscreen/clipboard/keyboard/joystick, connect/disconnect).
  Tanpa TightVNC hasilnya toast "VNC Server lokal (port 5900) tidak aktif." (graceful).

## Invariant
- 30 tab disapu: tidak ada teks `undefined`, `NaN`, "Render gagal", atau "Gagal memuat".
- Kasir tidak melihat tab admin (shift_history, analytics, settings sensitif); endpoint admin 403.
- Sesi/cookie: login ulang wajib setelah cutover Flask→Rust (cookie tidak kompatibel) — diketahui.

## Dead code dibuang
- `app/templates/kasir/components/modals.html`: blok `#modal-backup` (3 handler tak pernah ada).
- `app/templates/kasir/settings/whitelist_ip.html` + `app/static/js/kasir/modules/settings/whitelist_ip.js`
  (8 handler; sidebar memakai `Settings._wl*`).

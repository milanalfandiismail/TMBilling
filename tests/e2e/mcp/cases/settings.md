# Kasus Settings (10 Sub-tab) — Task 8

Semua sub-tab diakses via `App.switchTab('settings_…')`; kesepuluh pane render tanpa "render gagal".

| ID | Hasil | Bukti |
|---|---|---|
| K-SET-01 | LULUS* | UI Rust tidak punya field nama/alamat warnet; timezone `#timezone-select` Asia/Jakarta → `Settings.saveTimezone()` → DB `settings.timezone='Asia/Jakarta'`, dikembalikan ke Asia/Makassar. |
| K-SET-02 | N/A | Tidak ada field alamat/telepon/announcement di UI settings Rust (hanya footer kiosk + timezone). |
| K-SET-03 | LULUS* | Payment: tambah "E2E Pay" → `payment_methods` bertambah; hapus via `Settings.confirmRemovePaymentMethod(3)` → chip kembali. Upload QRIS PNG 1×1 valid → `qris_path=/static/uploads/qris/qris_1794915637.png`, berkas ada. |
| K-SET-04 | LULUS | Upload byte non-gambar (File text/plain via input) → 400, `qris_path` tidak berubah, berkas tidak bertambah. |
| K-SET-05 | LULUS | Kiosk `#warnet-footer-input` "E2E footer pengumuman" → DB `warnet_footer`. |
| K-SET-06 | LULUS | IP invalid 999.1.1.1 → toast "Gagal menambahkan IP Whitelist"; IP 192.168.50.10 label E2E LAN tersimpan; hapus via native confirm → hilang. Toggle on/off tidak diuji terpisah. |
| K-SET-07 | LULUS* | Token kosong → toast "Masukkan token Cloudflare Tunnel yang baru"; token nyata tidak diuji (butuh akun Cloudflare). |
| K-SET-08 | LULUS | Discord webhook diisi + toggle; `Settings.testProviderConnection('discord')` → "Koneksi ke Discord Webhook Berhasil!". |
| K-SET-09 | LULUS | `Settings.triggerBackupNow()` → `backup_20261117_190421.zip` + log `BACKUP_CLOUD_SUCCESS`. |
| K-SET-10 | LULUS | Daftar backup + ukuran `0.01 MB`; Unduh `/backup/download/...` 200 13.180 B; Hapus satu berkas → hilang dari folder. |
| K-SET-11 | LULUS | Restore `manual_backup_20261117_190421.zip` dengan `{confirm:true}` → 200; DB 18 transaksi/7 PC utuh, timezone Makassar, /paket tetap 200, sesi login admin bertahan. |
| K-SET-12 | LULUS | Zip berisi readme.txt → 400 "Arsip tidak berisi database TMBilling"; file hilang → 404 "File tidak ditemukan". |
| K-SET-13 | LULUS | Purge 12 bulan → backup otomatis `backup_20261117_185421.zip`; modal "UKURAN AWAL 224.00 KB / AKHIR 224.00 KB / HEMAT 0.00 B" + rincian 7 tabel. |
| K-SET-14 | PARTIAL | Status scheduler tampil (AKTIF, backup 1 hari, cleanup 30 hari, screenshot nonaktif); tidak ada tombol "jalankan sekarang" di UI. |
| K-SET-15 | LULUS* | Tab migrasi: `SKEMA AKTIF a2b3c4d5`, `SKEMA HEAD a2b3c4d5`, status Sinkron. Update GitHub tanpa jaringan tidak dijalankan (anti-SSRF whitelist). |
| K-SET-16 | N/A | API-only (spoof IP non-whitelist); tidak bisa dilakukan dari browser UI. |
| K-SET-17 | LULUS | `#client-apikey-input` `e2e-client-key-123456` → `Settings.saveClientApiKey()` → DB `client_api_key` 21 B. |
| K-SET-18 | PARTIAL | `Settings.saveUninstallToken()` → PUT `/settings/uninstall_token` ditolak (key di luar allowlist generik; Python juga tidak punya handler PUT untuk key ini) → UI toast gagal. Regenerasi emergency token tidak ada di UI. |
| K-SET-19 | LULUS | Login kasir1 → `GET /api/v1/kasir/settings/` 200 `{success,settings:{}}`; tidak ada `vnc_password`/`client_api_key` (redaksi). |
| K-SET-20 | PARTIAL | Simpan tanpa perubahan diuji pada general/scheduler; tidak semua 10 sub-tab disimpan ulang. |
| K-SET-21 | LULUS | Timezone WITA→WIB tersimpan di DB dan tampilan; batas hari laporan WITA sudah diverifikasi di K-RPT/K-SHF. Dikembalikan ke WITA. |
| K-SET-22 | PARTIAL | Auto-backup interval kecil tidak dijalankan (mengubah jadwal global sandbox); scheduler aktif dan nilai tersimpan. |
| K-SET-23 | N/A | Maintenance mode hanya aktif selama restore; restore sukses tidak meninggalkan gerbang terbuka (halaman kasir tetap melayani). |
| K-SET-24 | PARTIAL | Restore file tidak ada → 404; hapus berkas tidak ada tidak diuji terpisah. |
| K-SET-25 | LULUS | Dengan 1 sesi aktif → restore 409 "Masih ada 1 sesi aktif…", `active_sessions:1` (patch guard baru di `app-rust/src/routes/backup/backup_routes.rs`). |
| K-SET-26 | LULUS | Setelah restore + logout/login, footer, scheduler, payment methods, timezone, apikey tetap ada di DB. |

Bug yang ditemukan & dipatch di Task 8: `__D__` corruption di `settings_general.js`, kontrak test-connection cloud, kontrak scheduler 7 kunci, `storage_stats` purge, `size_mb` daftar backup, status migrasi, guard restore sesi aktif, duplikasi handler di `database_routes.rs`.

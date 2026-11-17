# Kasus E2E: Siklus Sesi dari Dashboard

Semua langkah memakai browser MCP Playwright terlihat, akun `kasir1/kasir123`, sandbox `127.0.0.1:7017`.

Prasyarat: login kasir → `#shift-info button[onclick="Shift.showBukaShiftModal()"]` → `#modal-awal-input` 200000 → `button[onclick="Shift.submitBukaShift()"]`.

| ID | Aksi user | Verifikasi |
|---|---|---|
| K-SES-01 | klik kanan `#tab-dash .pc-card-item[data-pc-id="1"]` → menu "Buka Sesi" → `[data-paket-id="1"]` → `button[onclick="BukaModal.submit()"]` → `#modal-confirm-submit-btn` | sesi guest aktif, transaksi 8000 |
| K-SES-02 | pill `button[onclick="Dashboard.setGrup('VIP')"]` → buka sesi PC-04 | hanya paket VIP; sesi 3 Jam 21000 |
| K-SES-03 | N/A di UI (tidak ada pembukaan sesi member/postpaid) | API saja |
| K-SES-04 | klik kanan PC yang sedang aktif | menu tidak memuat "Buka Sesi" |
| K-SES-05 | klik kanan PC aktif → "Tambah Waktu" → klik baris `[data-paket-id="1"]` → `button[onclick="TambahModal.submit()"]` → `#modal-confirm-submit-btn` | durasi +60, transaksi `tambah_waktu_*` |
| K-SES-06 | "Tambah Waktu" → baris paket 1 + baris paket 2 → submit | satu submit 2 transaksi, total durasi bertambah |
| K-SES-07 | klik kanan PC aktif → "Tutup Sesi" → `#modal-confirm-btn` | sesi selesai, transaksi `tutup_sesi` 0 |
| K-SES-08 | klik kanan PC dengan riwayat paket → "Refund Paket" → tombol "REFUND" → `#modal-confirm-btn` | transaksi refund negatif, durasi dipotong |
| K-SES-09 | buka refund lagi setelah refund | "TIDAK ADA RIWAYAT PAKET REFUNDABLE" |
| K-SES-10 | klik kanan PC aktif → "Pindah PC" → pilih PC tujuan | `sesi.pc_id` berubah, PC lama bebas |
| K-SES-11 | klik kanan PC → "Wake-on-LAN" | log `WOL_PACKET` |
| K-SES-12 | klik kanan PC → "Restart PC" / "Shutdown PC" → `#modal-confirm-btn` | perintah antre; tanpa agent hanya terlihat status terkirim |
| K-SES-13 | N/A tanpa sesi admin di PC | API reset-admin teruji unit test |
| K-SES-14 | pill grup + `[onclick="Dashboard.showSettingsModal()"]` → `#btn-poll-1000|2000|3000|5000`, toggle `#setting-nic-drop-toggle` + div | kartu terfilter, localStorage `dashboard_refresh_interval` |
| K-SES-15 | tab blackout → `button[onclick="Blackout.deteksi()"]` → `button[onclick="Blackout.forceAllAndDetect()"]` → dialog native OK | sesi suspect; force close semua jadi `tutup_sesi` 0 |
| K-SES-16 | tombol "Sama" / "Pindah" pada baris suspect → konfirmasi | sesi baru aktif di PC sama/tujuan, sesi lama resolved |

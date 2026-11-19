# Kasus E2E Dashboard Dalam (Task 3)

Sandbox: biner Rust 2.0.0, port 7017, root instance/e2e/mcp-rust.
Login bergantian: kasir1 (shift 200.000) untuk alur operasional, admin untuk aksi khusus admin.

| ID | Kasus | Hasil | Bukti |
|---|---|---|---|
| K-DSH-01 | Detail PC dari menu konteks kartu | LULUS | modal AKSI & KONTROL PC PC-01 berisi 8 aksi + panel screenshot |
| K-DSH-02 | Monitor Proses | LULUS | panel 3 PROSES: Discord.exe, TMBilling.exe, chrome.exe (sesuai seed pc_process) |
| K-DSH-03 | Segarkan daftar proses | LULUS | GET /api/v1/kasir/monitor/processes/1 200 |
| K-DSH-04 | Akhiri proses | PARTIAL | dialog konfirmasi tampil; POST /processes/1/kill 403 untuk kasir, sama dengan Python (@admin_required) |
| K-DSH-05 | Kembali dari panel proses | LULUS | kembali ke menu aksi tanpa error |
| K-DSH-06 | Hardware real-time | LULUS | CPU 5%, suhu 45/50 C, window TMBilling.exe, sinkron terakhir terisi |
| K-DSH-07 | Register baseline dari modal | LULUS | DashboardDetailModal.registerBaselineFromModal(1) selesai tanpa error |
| K-DSH-08 | Ambil gambar (admin) | LULUS | POST /api/v1/kasir/monitor/screenshot/trigger/1 200 |
| K-DSH-09 | Ambil gambar (kasir) | LULUS | toast Akses Ditolak. Hanya Admin yang diizinkan. (paritas Python) |
| K-DSH-10 | Remote layar: mulai sesi | PARTIAL | endpoint /vnc_client/1/start 200 pending; sesi RFB penuh butuh websockify/TightVNC di sandbox |
| K-DSH-11 | Toggle remote: Fit Layar/Keyboard/Clipboard/Fullscreen | LULUS | keempat tombol mengubah state panel tanpa exception |
| K-DSH-12 | Keyboard virtual + layout + modifier + special key | LULUS | switchKeyboardLayout(symbols), toggleModifier(Ctrl), sendSpecialKey(0xff51) |
| K-DSH-13 | Clipboard: tempel/kirim/salin | PARTIAL | ketiga aksi selesai tanpa exception; isi tidak terkirim tanpa sesi RFB |
| K-DSH-14 | Stop/disconnect remote | LULUS | state kembali Terputus tanpa error |
| K-DSH-15 | Pengaturan dashboard | LULUS | interval 3000 tersimpan (dashboard_refresh_interval=3000), toggle deteksi LAN tersimpan |
| K-DSH-16 | Sidebar toggle | LULUS | Dashboard.toggleSidebar() tanpa error |
| K-DSH-17 | Muat ulang data dashboard | LULUS | Dashboard.load() memicu GET /dashboard/pc 200 |
| K-DSH-18 | Editor denah: pilih PC + klik cell | LULUS | PC-02 pindah ke (3,2) di grid 12x7 |
| K-DSH-19 | Simpan denah | LULUS | DB pc id 2 pos_x=2,pos_y=1 |
| K-DSH-20 | Terapkan grid | LULUS | MapView._applyGrid(Reguler) tanpa error |
| K-DSH-21 | Keluarkan dari denah | LULUS | DB pc id 2 pos_x=-1,pos_y=-1; dikembalikan ke (2,1) setelah uji |
| K-DSH-22 | Auto-Sort per grup | LULUS | map_autosort_Reguler=false di localStorage |
| K-DSH-23 | Auto-Sort halaman kolom | N/A | prev/next/goTo hanya dirender bila meja per grup melebihi satu halaman (seed 4 PC) |
| K-DSH-24 | Bersihkan seleksi kartu | LULUS | DashboardSelection.clearSelection() tanpa error |
| K-DSH-25 | Tambah waktu / refund member dari kartu | N/A | tidak ada sesi member aktif; UI kasir tidak membuka sesi member (K-SES-03) |

Catatan paritas: aksi khusus admin (Akhiri proses, Ambil gambar, Remote layar) tetap tampil untuk kasir lalu ditolak 403, sama seperti template Python.

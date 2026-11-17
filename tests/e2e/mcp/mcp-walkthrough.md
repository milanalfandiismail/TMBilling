# Walkthrough E2E pakai MCP Playwright (browser terlihat)

Prasyarat: biner `app-rust/target/release/tmbilling-server.exe` sudah dibuild, sandbox hidup:

```
.venv\Scripts\python.exe tests/e2e\rust\rust_sandbox.py --port 7017 --keep
```

Semua langkah dijalankan lewat MCP Playwright, bukan skrip: `browser_navigate`, `browser_click`,
`browser_fill_form`, `browser_evaluate`, `browser_take_screenshot`. Viewport `browser_resize(1600x900)`.
Screenshot wajib `{type:"png", scale:"css"}`.

## 1. Login + shift

1. `/kasir/login`, isi `#username` = `kasir1`, `#password` = `kasir123`, klik `#btn-login`.
2. Tunggu `#shift-info` memuat. Kasir melihat `#shift-info button[onclick="Shift.showBukaShiftModal()"]`.
3. Klik, isi `#modal-awal-input` = 200000, klik `button[onclick="Shift.submitBukaShift()"]`.
   Sukses bila `#shift-info` berisi "Shift Aktif".

## 2. Sesi + POS (uang)

1. Klik kartu `#tab-dash .pc-card-item[data-pc-id="1"]` (kiri) -> `#pc-context-menu`.
2. `#pc-context-menu button:nth-of-type(2)` = "Buka Sesi". Pilih `[onclick="BukaModal.selectPaket(1)"]`,
   submit `button[onclick="BukaModal.submit()"]`, lalu konfirmasi `#modal-confirm-submit-btn`.
3. `App.switchTab('menu')` -> `[onclick="Menu.addToCart(1)"]` ->
   `button.remote-hide-action[onclick="Menu.checkout()"]` (ada tombol kembar, selector wajib sempit).
4. `#payment-tunai-input` = 20000, `#btn-submit-payment`, tutup dialog cetak dengan `#modal-cancel-btn`.
5. `App.switchTab('dash')`, klik kanan kartu -> `#pc-context-menu button:nth-of-type(4)` ("Tutup Sesi")
   -> `#modal-confirm-btn`.
6. `#shift-info button[onclick="Shift.showTutupShiftModal()"]`, `#uang-fisik-input` = 223000,
   klik `button[onclick="Shift.submitTutupShift()"]`.
7. Baca modal "Rekapitulasi Shift Kasir": `Kantin / F&B Tunai` harus Rp15.000, laci `SESUAI / PAS`.

Cek DB (UTC, bukan waktu lokal):

```
instance/e2e/mcp-rust/instance/warnet.db
SELECT tanggal FROM transaksi_menu ORDER BY id DESC LIMIT 1;   -- UTC
SELECT total_kantin FROM shift_record ORDER BY id DESC LIMIT 1; -- 15000
```

## 3. Semua tab

Kasir: 15 tab sidebar terlihat. Admin: tambah 14 tab (`App.switchTab('<id>')`).
Settings: `App.switchTab('settings')` + sub-tab `settings_general|payment|kiosk|cloudflare_tunnel|
cloud_backup|local_backup|db_cleanup|scheduler|migration`.
Daftar id lengkap ada di `tests/e2e/lib/coverage_manifest.js`.

Cek tiap tab: `document.querySelector('#tab-<id>')` ada dan `innerText` tidak memuat "Render gagal".

## 4. Portal publik

`/`, `/tv`, `/tv/static`, `/livepc`, `/member/login`, `/games`, `/paket`, `/spesifikasi`.
Gagal bila body memuat "Render gagal" - dulu `/livepc` dan `/paket` jatuh karena method str Python
(`.lower()`, `.format()`), sudah ditangani di `app-rust/src/templates.rs`.

## 5. Catat hasil

Tulis `tests/e2e/mcp/results/<tanggal>/RESULTS.md` + screenshot bernomor. Folder `results/` di-ignore Git.

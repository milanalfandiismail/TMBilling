# Kasus Operasional Kasir & Admin — Task 6

Sumber plan: `docs/superpowers/plans/2026-11-17-e2e-full-user-flows.md` (Task 6).
Dijalankan lewat MCP Playwright headed di sandbox Rust 2.0.0 port 7017, login `admin/admin123` dan `kasir1/kasir123`.

| ID | Hasil | Bukti (UI + DB) |
|---|---|---|
| K-SHF-01 | LULUS | Kasir tanpa shift klik kartu PC → modal "Buka Shift Kasir" muncul; `sesi` tetap 6 baris. |
| K-SHF-02 | LULUS | `#modal-awal-input` 200000 → shift id 4 aktif, "Shift Aktif 18:07". |
| K-SHF-03 | LULUS | `POST /shift/start` kedua → 400 "Tidak dapat membuka shift baru: Masih ada shift aktif oleh 'Kasir Satu' sejak … (ID #4)". |
| K-SHF-04 | LULUS | Setelah POS 15.000: `total_billing 0`, `total_kantin 15000`, `total_pendapatan 15000`, `total_seharusnya 215000`. |
| K-SHF-05 | LULUS | Tutup shift uang fisik 1000 → "Selisih Laci DEFISIT (-) Rp 199.000", status SELESAI. |
| K-SHF-06 | LULUS | Tutup shift uang pas 200000 → "SESUAI / PAS Rp 0". |
| K-SHF-07 | LULUS | Kasir tanpa tab `shift_history`; admin melihat #2–#6. `limit=500` → 400; `tanggal_mulai=abc` → 400 "Format tanggal tidak valid: abc". |
| K-SHF-08 | LULUS | Admin force close shift #4 → tidak ada shift aktif; ringkasan dihitung sebelum commit. |
| K-MON-01 | LULUS | `setPreset('today'/'7days'/'30days')`; baris PC-01 "Mulai 17.13 Akhir 17.13 Online 1j". |
| K-MON-02 | LULUS* | UI hanya `#screenshot-search` + `Screenshot.triggerActiveGroup` + `selectGroup` (tanpa `#screenshot-filter` seperti plan). Admin image PC-01 → 404 "Screenshot tidak tersedia"; kasir → 403 "Akses Ditolak. Hanya Admin". |
| K-MON-03 | LULUS | Trigger grup REGULER → confirm "Picu screenshot untuk 3 PC di grup REGULER?" → toast "Perintah screenshot dikirim ke 3 PC (REGULER)". |
| K-MON-04 | LULUS | Modal PC-01: "PENDING, BASELINE RESMI KOSONG, LIVE TELEMETRY KOSONG" (seed awal tanpa spesifikasi). |
| K-MON-05 | LULUS | Setelah seed `hardware_current_specs` (168 B): "Baseline PC-01 berhasil diperbarui!", `length(hardware_baseline)=168`, mismatch 0. |
| K-MON-06 | PARTIAL | Panel "MONITOR PROSES" terbuka, tampil "0 PROSES". Kill process tidak bisa diuji: `pc_process` kosong tanpa agent. |
| K-MON-07 | LULUS | "Hubungkan" tanpa agent → toast "Gagal memulai service VNC: VNC Server lokal (port 5900) tidak aktif." |
| K-MON-08 | LULUS | Toggle LHM → 400 "TMLHMService.exe tidak ditemukan …", checkbox revert; tanpa crash. |
| K-MON-09 | LULUS | Simpan konfigurasi → toast; test host 127.0.0.1:9999 → "Koneksi gagal: … actively refused it. (os error 10061)"; `syncAll` 400 satu prefix (bug kosmetik dipatch di `app-rust/src/routes/mikrotik/mikrotik_routes.rs:187`). |

Catatan: bug yang ditemukan & diperbaiki saat blok ini: prefix ganda pesan MikroTik. Bug lain (requirement telemetry baseline) bukan regresi — Python juga mensyaratkan `hardware_current_specs`.

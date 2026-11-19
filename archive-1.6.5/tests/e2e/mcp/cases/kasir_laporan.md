# Kasus Laporan, Turnamen & Perawatan — Task 7

Dijalankan lewat MCP Playwright headed, sandbox Rust 2.0.0 port 7017.

| ID | Hasil | Bukti |
|---|---|---|
| K-RPT-01 | LULUS | Tab Laporan memuat 8 baris; filter kasir/metode/tanggal ada; total mengikuti transaksi hari lokal WITA. |
| K-RPT-02 | LULUS | Export P&L PDF 1795 B, kantin PDF 1880 B (%PDF), audit PDF 6643 B; filter `operator:kasir1` 200 2261 B; `tanggal=abc` 400 JSON. |
| K-RPT-03 | LULUS* | Sebelum patch: total Rp0 padahal breakdown Tunai 30.000 + QRIS 15.000. Rust hanya kirim `total_pendapatan`; UI baca `total_pendapatan_menu`. Patch `app-rust/src/services/report/report_service.rs` → Rp45.000, export kantin 200 1880 B %PDF. |
| K-RPT-04 | LULUS | Laporan Perawatan kosong sebelum patch; setelah patch `tanggal`/`pc_id`/kunci `report` diperbaiki, baris PC-02 Rp50.000 tampil; filter kategori SELECT `#maint-report-kategori`. |
| K-RPT-05 | LULUS | Analytics 7 hari: billing Rp107.000 (17/11 Rp31.000); 16–17/11 Rp99.000; start>end API 400 "Tanggal awal harus sebelum tanggal akhir". Top paket 1 Jam 7×; per kasir Rp114.000; refund 18.2%. |
| K-RPT-06 | LULUS | Filter `#filter-log` "PINDAH_PC" → 1 baris; TXT/PDF/Bersihkan/Cari/Reset ada; clear mengarsipkan berkas. |
| K-RPT-07 | LULUS* | `/kasir/documentation` kosong karena respons list tanpa `success:true`; dipatch di `app-rust/src/routes/tutorial/tutorial_routes.rs` (list + categories). 2 artikel tampil; edit + simpan → toast sukses. Buat artikel baru tidak ada tombol di UI (N/A). |
| K-RPT-08 | LULUS | Catatan: editor disabled sampai "Catatan Baru"; simpan → berkas `instance/notes/E2E Catatan Shift.txt` 39 B; pin, duplikat, hapus via `Catatan.confirmDeleteNote()`; cari tersedia. |
| K-RPT-09 | LULUS | Tiket baru id 2 PC-02 SOFTWARE SEDANG; prioritas wajib RENDAH/SEDANG/TINGGI/KRITIS. |
| K-RPT-10 | LULUS | Tiket → DIPROSES → SELESAI dengan resolusi/biaya; PC re-aktif hanya bila tidak ada KRITIS lain (diuji juga dengan KRITIS: PC-03 `aktif=0` lalu 1). |
| K-RPT-11 | LULUS | Tab `user_logs` menampilkan LOGIN (admin/kasir1), filter cari/kategori, tombol Detail membuka modal audit. |
| K-TRN-01 | LULUS | Bua turnamen playoff "E2E Turnamen Baru", 3 tim → `turnamen` id 3 + `turnamen_tahap`. |
| K-TRN-02 | LULUS | Bracket semifinal: Match #1 Alpha–Bravo, #2 Charlie–BYE (1-0 otomatis), final menunggu. |
| K-TRN-03 | LULUS | Skor semifinal 2-1 → Alpha lolos; final 1-3 → Charlie juara; status turnamen `selesai`. |
| K-TRN-04 | N/A | UI hanya menawarkan tim yang bertanding; skor tim luar match tidak bisa dikirim lewat UI. |
| K-TRN-05 | LULUS | `next_match_id` mengisi final otomatis; BYE menang tanpa skor manual. |
| K-TRN-06 | LULUS | Juara + status selesai tersimpan; daftar menampilkan "SELESAI". |
| K-MTN-01 | LULUS | Tiket baru PC-02 SOFTWARE SEDANG "E2E Tiket Software" BARU. |
| K-MTN-02 | LULUS | Ubah ke DIPROSES → SELESAI; resolusi/biaya tersimpan; report maintenance menampilkan baris. |
| K-MTN-03 | LULUS | Tiket KRITIS PC-03 → `pc.aktif=0`; selesai → `aktif=1`. |
| K-MTN-04 | LULUS | Menyelesaikan tiket ringan pada PC arsip tidak menghidupkan PC (sql guard sama Python). |
| K-MTN-05 | LULUS | Hapus tiket via `Maintenance.deleteTicket(3)` + confirm → baris hilang. |
| K-MTN-06 | PARTIAL | Tiket KRITIS kedua pada PC yang sama: aturan "status SELESAI hanya aktif bila tidak ada KRITIS lain" diverifikasi lewat logika service (bukan dua tiket KRITIS simultan di UI). |

Catatan: 5 bug Rust diperbaiki di Task 7 — export PDF `kasir_id` string, kolom kasir `kasir_nama`, payload struk kantin, `pc_id` string tiket, laporan maintenance `tanggal`/`pc_id`/`report`, CMS `success:true`, dan `total_pendapatan_menu`.

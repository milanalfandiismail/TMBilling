# Kasus Portal Publik & Member — Task 9

Dijalankan langsung di browser (tanpa login staf jika tidak perlu), sandbox Rust 2.0.0 port 7017.

| ID | Hasil | Bukti |
|---|---|---|
| P-PUB-01 | LULUS | `/` beranda: nav lengkap (livepc/paket/games/spesifikasi/member), tidak ada "undefined"/"NaN". |
| P-PUB-02 | PARTIAL | Tautan nav menuju `/paket` bekerja; CTA kartu paket tidak diuji klik-satu-per-satu. |
| P-PUB-03 | LULUS | `/paket` menampilkan 5 paket aktif (8000/15000/21000/20000/7000) berkelompok REGULER/VIP/VVIP. |
| P-PUB-04 | LULUS | `/games`: pill Semua/Game/Aplikasi + genre FPS; FPS → CS2 + Valorant; Aplikasi → empty state; `#search-game` "zzz" → tidak ditemukan, "CS2" → 1 kartu. |
| P-PUB-05 | N/A | Tidak ada lightbox/detail game di UI Rust (kartu statis); tidak ada tombol yang bisa diklik. |
| P-PUB-06 | LULUS | `GET /api/v1/public/game/all?limit=1&offset=1` → 200, 1 item. |
| P-PUB-07 | N/A | `tv.js`/template tidak merender turnamen; payload punya `tournament` double-nested. Promo 5 paket + announcement tampil (bagian promo lulus). |
| P-PUB-08 | LULUS | `/tv/static` memuat `tv_static.js`, 6 PC, paket, kantin, pengumuman. |
| P-PUB-09 | LULUS | `/livepc` → `/pc-status` array; dengan sesi aktif PC-05 tampil "5 / 6 PC Tersedia" dan PC-05 terpakai. |
| P-PUB-10 | LULUS | Setelah sesi PC-05 ditutup dan reload → "6 / 6 PC Tersedia". |
| P-PUB-11 | LULUS | `/spesifikasi` 6 kartu; `#specs-search-input` "PC-05" menyaring 1 kartu; `openSpecModal('PC-01')` modal CPU/GPU/RAM terisi. |
| P-PUB-12 | LULUS | Reset pencarian → 6 kartu kembali; pencarian tanpa hasil menampilkan empty state. |
| P-PUB-13 | LULUS | `GET /api/health` → 200 `{"status":"ok","checks":{"db":"ok","disk":"ok","backup":"unknown"}}`. |
| P-PUB-14 | LULUS | Semua portal di atas diakses tanpa sesi login staf; HTML tidak memuat "transaksi|password|kasir1" (cek kebocoran `False`). |
| P-MEM-01 | LULUS | `member1/pass123` via `/member/login` → dashboard tampil. |
| P-MEM-02 | LULUS | 5 password salah untuk `throttle_probe` → percobaan ke-6 benar tetap 429 "Terlalu banyak percobaan login…". |
| P-MEM-03 | LULUS | `member_expired/pass123` → 403 "Masa aktif member sudah kadaluarsa". |
| P-MEM-04 | LULUS | Dashboard `#profile-form` mengubah nama/email/HP → DB member 5 berubah ("E2E Member Edit", e2e@example.com, 08123456789). |
| P-MEM-05 | LULUS | Dashboard `e2emember` menampilkan "2 Jam 0 Menit", Total Rp16.000, 3 transaksi (refund −7.000 + 2 pembelian), riwayat sesi. |
| P-MEM-06 | LULUS | Logout → `/member/login`; akses `/member/dashboard` tanpa sesi → redirect login. |

Bug yang ditemukan & dipatch di Task 9: throttle terbalik (`if !check`), `redirect` hilang, argumen `verify_password` terbalik, dashboard SSR stub, global `format_display`, katalog `specs_catalog_json` sebagai map per kode, `/pc-status` mengembalikan array + `sisa_waktu_display`.

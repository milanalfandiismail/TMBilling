# Hasil Uji Kontrak & Keamanan API Klien — 2026-11-18

## Lingkungan
- Biner: app-rust/target/release/tmbilling-server.exe (2.0.2), build release.
- Sandbox: instance/e2e/client-agent, port dinamis, seed 24 tabel + PC PC-C1 (127.0.0.1).
- Klien nyata: WEW-1 / 192.168.180.10 (VM subnet 192.168.180.0/24), server produksi http://127.0.0.1:7015.

## Hasil otomatis
- pytest tests/e2e/client -q → 28 lulus, 0 gagal.
- cargo test --release -j 16 --manifest-path app-rust/Cargo.toml → 87 lulus, 0 gagal.

## Bug ditemukan & diperbaiki
1. PC arsip tetap dilayani — status/identify/screenshot_upload memakai pc_repo::find_by_ip yang tidak memfilter aktif, sehingga PC nonaktif masih bisa melanjutkan sesi dan mengunggah gambar (Python PCRepository.get_by_ip memfilter aktif=True). Fix: find_aktif_by_ip di app-rust/src/repositories/pc.rs + dipakai di services/client/client_service.rs, routes/client/client_routes.rs, routes/monitor/monitor_routes.rs.
2. AFK unlock selalu gagal — afk_unlock memanggil verify_password(kredensial, pin) dengan argumen terbalik (signature (stored, password)); PIN benar pun ditolak 401. Fix: urutan argumen dibalik, termasuk cabang password member.
3. Test versi usang — app-rust/tests/unit/config_test.rs dan tests/contract/ops_test.rs masih mematok 2.0.0 setelah rilis 2.0.2; kini memakai env!("CARGO_PKG_VERSION").

## Kontrak yang terverifikasi (bukan bug)
- PC tak dikenal → HTTP 200 {"status":"kosong","message":"PC tidak dikenal"} (paritas Python), bukan 404.
- Emergency login dari PC terdaftar sah hanya dengan IP (tanpa token) — perilaku Python ip_ok; risiko tercatat.
- /api/v1/public/client/vnc_poll adalah alias fast_poll.
- Upload screenshot memakai body biner mentah (bukan multipart), disimpan sebagai instance/uploads/screenshots/<KODE>.png.
- image crate menolak PNG 1x1 70 byte hasil uji; PNG valid dari Pillow 8x8 diterima.

## Smoke klien nyata
live_probe.py terhadap PC WEW-1:
```
PASS identify 200 {"valid":true,"pc_kode":"WEW-1","grup":"reguler","polling_interval":1}
PASS status   200 {"status":"aktif","sisa_waktu":52,"nama":"Guest6901",...}
PASS warnet   200 {"title":"...","announcement":"<h2>..."}
```
Dashboard produksi: GET /api/v1/kasir/dashboard/pc → WEW-1 online:true, status terpakai, sesi_id 575.

## Sisa risiko
- Server produksi 7015 masih menjalankan salinan biner lama (app-rust/tmbilling-server.exe), belum memuat dua perbaikan hari ini sampai disalin + restart.
- Dashboard PC nyata: MONITOR PROSES menampilkan 58 proses dari agent. AMBIL GAMBAR mengirim perintah, tetapi berkas screenshot belum muncul dalam 8 detik (perlu cek konfigurasi screenshot di klien).

## Perbaikan 2026-11-18 (3 bug lapangan)

| Bug | Akar masalah | Perbaikan | Bukti |
|---|---|---|---|
| Ambil gambar tidak menghasilkan screenshot | perintah `screenshot` diantrekan ke `commands.fast` (dibaca TMMonitor, yang tidak mengenal `screenshot`) | `app-rust/src/routes/monitor/monitor_routes.rs` mengantre ke `commands.regular` (dibaca klien Tauri) | `test_screenshot_queue.py` |
| Remote control VNC gagal | proxy hanya start setelah laporan `vnc_ready`, rapuh bila monitor lama/tidak ada | fallback probe TCP 5900 di `app-rust/src/routes/vnc/vnc_routes.rs::client_status` | `test_vnc_fallback.py` |
| Login member kiosk langsung mengakhiri sesi | `/api/v1/public/auth/login` menunjuk login web (cookie `tm_member`, tanpa sesi billing) | handler baru `app-rust/src/routes/public/client_auth.rs`: member → `sesi_service::buka_member`, admin → mode admin | `test_client_member_login.py` |

Total: `pytest tests/e2e/client -q` 34 lulus; `cargo test --release -j 16` 87 lulus.

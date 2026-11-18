# Checklist Smoke Klien Nyata

Lingkungan: klien VM subnet `192.168.180.0/24` (PC `WEW-1`, `192.168.180.10`), server `http://127.0.0.1:7015`.

| # | Langkah | Cara | Hasil |
|---|---|---|---|
| 1 | Probe API | `python tests/e2e/client/live_probe.py --server http://127.0.0.1:7015 --key <client_api_key> --ip 192.168.180.10 --mac 00:0C:29:15:EA:AE` | PASS identify/status/warnet (2026-11-18, sesi 52m) |
| 2 | Kartu dashboard online | login admin → dashboard, cari `WEW-1` | PASS (API online:true, kartu menampilkan sesi 48m) |
| 3 | Detail PC + proses | klik kartu → MONITOR PROSES (butuh agent mengirim telemetri) | PASS 58 proses (MsMpEng/explorer/TiWorker) |
| 4 | Screenshot | AMBIL GAMBAR → berkas `instance/uploads/screenshots/WEW-1.png` | perintah terkirim, berkas screenshot belum muncul |
| 5 | Remote layar | REMOTE LAYAR → status VNC | perintah terkirim, berkas screenshot belum muncul |

Catatan: probe berjalan dari host server (loopback), jadi server mempercayai `ip_address` yang dikirim. Jalur peer nyata tetap divalidasi oleh test kontrak.

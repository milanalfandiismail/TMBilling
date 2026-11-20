# TMBilling Client (GPUI) — dev notes

Mode uji untuk desktop developer. Jangan dipakai di PC pelanggan.

## Menjalankan

    # server (dari folder app-rust)
    target\release\tmbilling-server.exe

    # klien terhadap server lokal
    set TM_SERVER_URL=http://127.0.0.1:7015
    set TM_CLIENT_KEY=TM2026
    set TM_DEV_SAFE=1
    target\debug\TMBilling.exe

## Variabel lingkungan

| Variabel | Efek |
|---|---|
| TM_DEV_SAFE=1 | Mematikan keyboard hook dan tidak menyembunyikan taskbar. Jendela tetap fullscreen dan selalu on-top. |
| TM_SERVER_URL | Override alamat server (default dari registry/config.ini). |
| TM_CLIENT_KEY | Override client API key. |
| TM_OVERLAY_TAB, TM_MODAL, TM_INFO_TAB, TM_LOGIN_ERROR | Membuka layar/modal tertentu saat start, dipakai untuk screenshot. |
| --overlay | Sesi demo: kartu overlay dengan data contoh, tanpa server. |
| --size WxH | Ukuran jendela awal (default 1920x1080). |

## Harness interaksi

    py tools/harness.py

Menjalankan server asli, lalu klien dalam mode overlay dan kiosk, mengklik tiap kontrol dan
memeriksa hasilnya. Screenshot ditulis ke X:\Temp\opencode\harness.

Kontrol yang diuji: kartu overlay muncul, tombol Logout membuka modal, Batal menutup modal,
tombol Lock membuka PIN, Escape tidak menutup PIN, tab Alat dan QRIS tanpa area putih, kiosk
fullscreen, tombol Masuk dengan field kosong menampilkan galat, F11 tidak membuat aplikasi keluar.

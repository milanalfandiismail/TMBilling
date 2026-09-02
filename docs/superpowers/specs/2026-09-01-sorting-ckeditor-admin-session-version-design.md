# Spesifikasi Desain: Perbaikan Sorting PC, CKEditor Murni untuk Pengumuman & Aturan, Kontrol Sesi Admin PC Client (Admin & SYSTEM), dan Upgrade Versi 1.5.8

## 1. Ringkasan Perubahan
1. **Natural Sorting PC**:
   - Terapkan natural sorting (`localeCompare(..., { numeric: true, sensitivity: 'base' })`) pada Ketersediaan PC (`livepc.js`) dan TV Signage (`tv.js`, `tv_static.js`).
2. **CKEditor Murni untuk Pengumuman & Aturan (Hapus Seluruh Teks Default Hardcoded)**:
   - **Hapus Teks Default**: Hapus semua string aturan default hardcoded di `app/__init__.py`, `settings_service.py`, `client_routes.py`, dan `tv_service.py`. Nilai fallback adalah string kosong `""`.
   - **Kasir (Settings)**: Field input Pengumuman & Aturan menggunakan CKEditor 5 dark theme.
   - **Backend**: Sanitasi server-side anti-XSS (`sanitize_html` di `helpers.py`).
   - **Client PC (WarnetClient Kiosk)**: Render murni HTML hasil CKEditor di `#rules-container` dengan CSS rich text styling.
   - **Public Landing Page (`landing/index.html`)**: Render murni HTML hasil CKEditor (`{{ warnet_rules | safe }}`) di dalam container `prose prose-invert`.
   - **TV Signage (`tv.js`, `tv_static.js`)**: Render HTML aturan secara dinamis jika tersedia.
3. **Sesi Admin di Client PC (Logout / Tutup Sesi Administrator & SYSTEM via Dashboard Kasir)**:
   - Ketika PC Client sedang aktif dalam mode Admin (baik login oleh user `administrator` maupun mode `emergency` / `SYSTEM`):
     - Di Kasir Dashboard, PC terdeteksi dalam status Admin.
     - Kasir Dashboard menyediakan opsi **"Logout Sesi Admin" / "Tutup Sesi Admin"** pada Context Menu dan Modal Detail PC.
     - Saat diklik, sesi admin ditutup, status `pc.is_admin_mode` di-reset ke `False`, dan audit log `TUTUP_SESI` / `REMOTE_LOGOUT` dicatat.
     - Pada polling heartbeat berikutnya dari client PC (baik role `admin` maupun `emergency`), server merespons dengan `{"command": "lock"}`, sehingga client PC terkunci kembali ke mode Kiosk.
4. **Upgrade Versi Aplikasi ke 1.5.8**:
   - Update nomor versi aplikasi dari `1.5.7` ke `1.5.8` pada `app/config.py`, `package.json`, Cargo manifests (`WarnetClient` & `WarnetAgent`), Tauri config, dan template cache asset busters (`?v=158`).

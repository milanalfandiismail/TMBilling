# Spesifikasi Desain: Isolasi Sidebar Menu Pengaturan (1 Subtab = 1 Fungsi)

**Tanggal**: 2026-08-10  
**Tujuan**: Memecah (mengisolasi) item menu sidebar pada grup **Pengaturan** dari gabungan multi-fungsi menjadi 1 item sidebar per 1 fungsi terfokus.

---

## 1. Latar Belakang & Masalah
Saat ini, menu sidebar Pengaturan memiliki subtab yang menggabungkan banyak fungsi terpisah dalam satu halaman panjang (misalnya `#subtab-backup` berisi Cloud Backup, Tabel Berkas Lokal, dan Pembersihan Histori Database). Pengguna meminta agar setiap fungsi diisolasi menjadi 1 item menu tersendiri di sidebar Pengaturan.

---

## 2. Struktur Menu Sidebar Pengaturan Baru (Isolated Subtabs)

Dalam sidebar menu **Pengaturan** (`#settings-submenu` di `sidebar.html`), subtab akan dipecah menjadi:

| Icon | Nama Menu Sidebar | ID Subtab (`#subtab-X`) | Fungsi Terisolasi |
| :--- | :--- | :--- | :--- |
| ⚙️ | **Umum & Keamanan** | `#subtab-general` | Auto Shutdown, Token Uninstall, API Key, Timezone |
| 💳 | **Metode Pembayaran** | `#subtab-payment` | Kelola Metode Pembayaran & QRIS |
| 🖥️ | **Info Warnet & Kiosk** | `#subtab-kiosk` | Nama Warnet, Alamat, Telepon, Struk Footer, Pengumuman |
| 📺 | **TV Signage** | `#subtab-tv` | Running Text TV & Slide Promosi |
| 🛡️ | **Whitelist IP** | `#subtab-whitelist_ip` | Proteksi Whitelist Akses IP Dashboard |
| ☁️ | **Cloud Backup** | `#subtab-cloud_backup` | Integrasi Backup Discord, GDrive, NAS, Nextcloud |
| 📂 | **Berkas Backup Lokal** | `#subtab-local_backup` | Tabel Berkas Cadangan ZIP & Aksi |
| 🧹 | **Pembersihan Database** | `#subtab-db_cleanup` | Retensi Data & Pembersihan Histori Server (Admin) |
| 🤖 | **Auto Scheduler** | `#subtab-scheduler` | Penjadwalan Otomatis Backup & Cleanup |
| 🗄️ | **Migrasi & Update** | `#subtab-migration` | Migrasi Skema Database & Pembaruan Sistem |

---

## 3. Komponen HTML & JS yang Diubah

1. **`app/templates/kasir/components/sidebar.html`**:
   - Memperbarui daftar `<button>` di bawah `#settings-submenu` sesuai 10 item menu terisolasi di atas.
2. **`app/templates/kasir/tabs/settings.html`**:
   - Memecah kartu-kartu di `#subtab-general` menjadi `#subtab-general`, `#subtab-payment`, `#subtab-kiosk`, `#subtab-tv`.
   - Memecah kartu-kartu di `#subtab-backup` menjadi `#subtab-cloud_backup`, `#subtab-local_backup`, `#subtab-db_cleanup`.
3. **`app/static/js/kasir/app.js`**:
   - Menambahkan pemetaan nama judul halaman (`updatePageTitle`) untuk seluruh subtab baru (`settings_cloud_backup`, `settings_local_backup`, `settings_db_cleanup`, `settings_payment`, `settings_kiosk`, `settings_tv`).
4. **`app/static/js/kasir/modules/settings/index.js`**:
   - Penyesuaian `switchSubTab(subTab)` untuk mendukung inisialisasi dan pemuatan data terisolasi.

---

## 4. Rencana Pengujian
1. Rebuild Tailwind CSS (`npm run build:css`).
2. Uji klik seluruh menu sidebar Pengaturan di browser untuk memastikan setiap fungsi berpindah dengan mulus dan fokus ke 1 halaman.

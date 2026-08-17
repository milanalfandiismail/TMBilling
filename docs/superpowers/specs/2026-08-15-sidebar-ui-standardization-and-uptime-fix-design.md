# Design Spec: Standardisasi Sidebar, Bahasa Indonesia, UI/UX Baseline, Uptime Tracker Fix, dan `/livepc` Privacy

**Tanggal**: 2026-08-15  
**Status**: Completed & Verified  
**Sistem**: TMBilling Kasir SPA & Public Portal

---

## 1. Ikhtisar Masalah & Kebutuhan

1. **Konsistensi Bahasa & UI/UX**:
   - Sidebar dan berbagai tab kasir sebelumnya menggunakan istilah bahasa Inggris atau translasi yang tidak seragam.
   - Variasi styling antar tab (seperti border radius `rounded-xl`, bayangan `shadow-xl`, heading non-uppercase) tidak seragam dengan baseline tab **`Umum & Keamanan`** (`bg-[#0c0c0c] border-[#1c1c1c] rounded p-6`).
   - Sidebar `Dashboard` adalah pengecualian keras dan tidak boleh diubah.
2. **Bug Uptime Tracker (Pelacak Statistik PC)**:
   - Nama grup PC pada mode Harian menampilkan `undefined` karena serialisasi model `PCUptimeLog.to_dict()` kehilangan key `"grup"`.
3. **Privasi `/livepc`**:
   - Status live PC pada portal publik memaparkan `nama_lengkap` member aktif yang berisiko privasi.
4. **Responsivitas Multi-Device**:
   - Tabel dan filter pada beberapa tab terpotong atau berdempetan ketika diakses melalui layar mobile (<640px) atau tablet.

---

## 2. Rincian Desain & Standar Implementasi

### A. Standardisasi Istilah & Label Menu
- `Server Statistic` → `📊 Statistik Server`
- `Hardware Monitor` → `🖥️ Monitor Hardware`
- `Pemeriksa Hardware` → `🛡️ Hardware Checker` (Istilah universal dipertahankan)
- `Uptime Tracker` / `Uptime tracker` → `🕐 Pelacak Statistik PC`
- `Screenshot Monitor` → `📷 Monitor Screenshot`
- `Blackout Recovery` / `Pemulihan Blackout` → `⚡ Pemulihan Mati Lampu`
- `Remote Control Server` → `📡 Kendali Jarak Jauh Server`
- `TV Signage Display` → `📺 Tampilan TV`
- `Auto Scheduler` → `🤖 Penjadwalan Otomatis`
- `Analytics Owner` → `Analitik Owner`
- `Plugins & Ekstensi` → `Ekstensi & Plugin`

### B. Perbaikan Bug Uptime Tracker
- `PCUptimeLog.to_dict()` di `app/models/pc/pc_uptime.py`:
  - Menyertakan field `"grup": self.pc.grup.nama if self.pc and self.pc.grup else "reguler"`.
- Frontend `app/static/js/kasir/modules/uptime/index.js`:
  - Ditambahkan defense-in-depth `item.grup || 'Reguler'` untuk mencegah string `undefined`.
- Heading tab di `uptime.html` diubah menjadi `Pelacak Statistik PC`.

### C. Proteksi Privasi `/livepc`
- Endpoint `/pc-status` di `app/routes/member/member_portal_routes.py`:
  - Untuk sesi member aktif, hanya `s.member.username` yang dikembalikan sebagai `nama`.
  - Untuk sesi guest, mengembalikan `"Guest"`.
  - `nama_lengkap` tidak lagi dikirimkan dalam payload API publik.

### D. Penyelarasan UI/UX ke Baseline `Umum & Keamanan`
- **Container**: `bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6` (menghilangkan `rounded-xl` dan `shadow-xl` yang tidak standar).
- **Typography Heading**: `text-xs lg:text-[22px] font-bold text-neutral-200 uppercase tracking-wider`.
- **Action Header CRUD**: Tab User (`user.html`) mengadopsi pola Action Header CRUD (`bg-[#111] border border-[#1f1f1f] rounded-xl p-5`) seragam dengan tab Member & Paket.
- **Button Styling**:
  - Tombol Primer: `bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded`.
  - Tombol Sekunder: `bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 rounded font-semibold`.
- **Subtab Settings**: Standardisasi panel Cloudflare Tunnel dan lokalisasi heading scheduler (`Backup Otomatis`, `Pembersihan Log Otomatis`, `Screenshot Otomatis`).

### E. Responsivitas Multi-Device
- Container tabel dilengkapi `overflow-x-auto scrollbar-thin w-full` dan `min-w-[800px]` pada tabel data.
- Input filter dan dropdown select menggunakan utility class responsif `w-full sm:w-auto` / `w-full sm:w-48`.
- Layout grid KPI dan monitoring menggunakan breakpoint adaptif: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.

### F. Sinkronisasi Versi & Asset Cache
- Penyeragaman versi ke **1.5.3** pada `app/config.py`, root `package.json`, `package-lock.json`, serta Tauri client (`WarnetClient/TMBillingTauri/package.json`, `package-lock.json`, `tauri.conf.json`).
- Bumping query string cache frontend menjadi `?v=153` pada seluruh script dan stylesheet di `base.html`, `login.html`, dan `dashboard.html`.

---

## 3. Rencana Pengujian & Verifikasi

1. **Uji Kompilasi Python**: Syntax checking seluruh file route, model, dan service backend dengan `py_compile`.
2. **Uji Build CSS**: Menjalankan `npm run build:css` untuk memastikan Tailwind CSS terkompilasi sempurna.
3. **Uji Responsivitas & Tampilan**: Memverifikasi tidak ada layout overflow pada breakpoint mobile, tablet, laptop, dan desktop.

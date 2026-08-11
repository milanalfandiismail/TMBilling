# Fitur: Cloudflare Tunnel Auto-Manager

> **Status:** Selesai & Terverifikasi 🟢  
> **Kategori:** Otomatisasi Network & Remote Access  
> **Service Location:** `app/services/cloudflare_tunnel/cloudflare_tunnel_service.py`  
> **Route Location:** `app/routes/settings/settings_routes.py`  

---

## 1. Ringkasan & Tujuan

Fitur **Cloudflare Tunnel Auto-Manager** memungkinkan pemilik/kasir warnet mengakses dashboard web TMBilling secara aman dari luar jaringan (remote access) menggunakan domain milik sendiri (misal: `https://billing.warnetku.com`), **tanpa memerlukan IP Publik Statis atau Port Forwarding di Router/Modem**.

### Keunggulan Utama:
- 🚀 **Otomatisasi Penuh**: Mengunduh dan memverifikasi biner `cloudflared.exe` secara otomatis jika belum tersedia di server.
- 🔄 **Auto-Start Server Boot**: Daemon `cloudflared` otomatis berjalan di latar belakang saat server TMBilling dinyalakan jika statusnya `enabled`.
- 📊 **Real-time Live Progress Toast**: Indikator pengunduhan biner `cloudflared.exe` (0%-100%) ditampilkan secara real-time dengan Toast Progress Bar di dashboard.
- 🔐 **Secure & Encrypted**: Koneksi terenkripsi HTTPS secara otomatis oleh infrastruktur Cloudflare Zero Trust.

---

## 2. Panduan Langkah-demi-Langkah (Step-by-Step Setup)

### Langkah 1: Buat Tunnel di Cloudflare Zero Trust Dashboard
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) dan masuk ke akun Cloudflare Anda.
2. Pada menu navigasi kiri, pilih **Zero Trust** (atau buka langsung [one.dash.cloudflare.com](https://one.dash.cloudflare.com/)).
3. Buka menu **Networks** -> **Tunnels** -> Klik tombol **Create a Tunnel**.
4. Pilih tipe **Cloudflared**, beri nama tunnel (contoh: `TMBilling-Server`), lalu klik **Save Tunnel**.

### Langkah 2: Konfigurasi Routing Public Hostname
1. Di halaman konfigurasi Tunnel, buka tab **Public Hostname**.
2. Isikan detail routing berikut:
   - **Subdomain**: `billing` (atau nama lain pilihan Anda)
   - **Domain**: Pilih domain terdaftar Anda di Cloudflare (contoh: `warnetku.com`)
   - **Type**: `HTTP`
   - **URL**: `localhost:7015` *(atau port berjalan TMBilling Server)*
3. Klik **Save Hostname**.

### Langkah 3: Dapatkan Cloudflare Tunnel Token
1. Di bagian **Install and run cloudflared**, pilih sistem operasi **Windows**.
2. Perhatikan perintah yang diberikan oleh Cloudflare:
   ```cmd
   cloudflared.exe service install eyJhYmdjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw...
   ```
3. Salin seluruh string token unik panjang yang diawali dengan `eyJh...` (tanpa kata `cloudflared.exe service install`).

### Langkah 4: Masukkan Token & Aktifkan di TMBilling
1. Buka dashboard web **TMBilling Kasir/Admin**.
2. Masuk ke menu **Pengaturan** pada sidebar -> Klik sub-tab **🌐 Cloudflare Tunnel**.
3. Tempelkan (paste) token `eyJh...` ke dalam kolom **Cloudflare Tunnel Token** -> Klik **Simpan Token**.
4. Aktifkan saklar **Status Daemon Cloudflare Tunnel** ke posisi **ON (Hijau)**.
5. Jika biner `cloudflared.exe` belum terunduh, sistem akan otomatis menampilkan **Toast Progress Bar** dan mengunduhnya di latar belakang. Setelah unduhan selesai, tunnel akan langsung aktif!

---

## 3. Arsitektur Teknis & Alur Kerja

```
[Browser Client/HP Owner] 
       │ (HTTPS: billing.warnetku.com)
       ▼
 [Cloudflare Edge Network]
       │ (Encrypted Tunnel)
       ▼
 [cloudflared.exe Daemon (Subprocess)]
       │ (Local HTTP: 127.0.0.1:7015)
       ▼
 [Flask Server TMBilling]
```

### Key Service Methods (`CloudflareTunnelService`):
- `ensure_binary()`: Memeriksa keberadaan & keutuhan biner `bin/cloudflared.exe` (>45MB). Mengunduh biner resmi rilis Cloudflare via chunked streaming jika terpotong/rusak.
- `start_tunnel()`: Menjalankan daemon `cloudflared.exe tunnel --no-autoupdate run --token <token>` via `subprocess.Popen` (tanpa jendela konsol/hidden window).
- `get_status()`: Mengembalikan JSON status running, enabled, token masked (`••••••••`), dan persentase download terkini.
- `stop_tunnel()`: Menghentikan proses `cloudflared` secara aman.
- `init_app(app)`: Dipanggil saat startup Flask untuk mengeksekusi auto-start jika `cloudflare_tunnel_enabled` bernilai `"true"`.

---

## 4. Penanganan Error & Troubleshooting

| Gejala Error | Penyebab | Solusi |
|---|---|---|
| **"Token Cloudflare Tunnel tidak valid."** | Token yang dimasukkan salah, kedaluwarsa, atau terpotong. | Pastikan token diawali `eyJh...` dan disalin utuh dari dashboard Cloudflare. |
| **"Biner cloudflared.exe tidak tersedia"** | Terjadi kegagalan koneksi internet saat mengunduh biner. | Periksa koneksi internet server, lalu klik ulang toggle untuk mencoba pengunduhan otomatis kembali. |
| **Pesan `WinError 193`** | File biner terputus saat diunduh sebelumnya. | TMBilling v1.5.2+ otomatis mendeteksi ukuran biner minimal 45MB dan mengunduh ulang jika file terpotong. |

---

## 5. Panduan Setup VNC Remote Desktop (noVNC Integration)

Fitur Remote Desktop TMBilling menggunakan kombinasi **TightVNC Server** di PC Client/Server dan **Websockify Proxy** (`0.0.0.0:8081` -> `127.0.0.1:5900`) untuk rendering web browser via HTML5 noVNC.

### Langkah Setup VNC:
1. **Install TightVNC Server**:
   - Unduh dan install TightVNC dari rilis resmi ([tightvnc.com](https://www.tightvnc.com/)).
   - Saat instalasi, aktifkan pilihan **Register TightVNC Service**.
   - Set password **Primary Password** & **Administrative Password**.
2. **Pengaturan Loopback**:
   - Buka *TightVNC Service Configuration* -> Tab *Access Control*.
   - Centang **Allow loopback connections** dan **Allow loopback only** jika hanya diakses via Websockify local (`127.0.0.1:5900`).
3. **Install Dependensi Websockify (Python)**:
   - Jalankan perintah berikut di terminal server:
     ```cmd
     pip install websockify
     ```
4. **Jalankan Proxy VNC**:
   - Buka menu Remote Control VNC di dashboard TMBilling.
   - Klik **Start Websockify Proxy**. Server akan otomatis mengikat port `8081` dan menyambungkan streaming layar ke browser kasir.


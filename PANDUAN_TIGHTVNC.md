# Panduan Instalasi & Konfigurasi TightVNC Server untuk TMBilling

Dokumen ini berisi panduan penginstalan dan konfigurasi **TightVNC Server** di PC Server Windows agar dapat di-remote dari halaman **Remote Control Server (VNC)** di TMBilling.

---

## 1. Unduh & Instalasi TightVNC Server

1. **Unduh Installer**:
   Unduh installer resmi TightVNC gratis untuk Windows (64-bit / 32-bit):
   👉 [https://www.tightvnc.com/download.php](https://www.tightvnc.com/download.php)

2. **Jalankan Installer (`tightvnc-setup-64bit.msi`)**:
   - Klik **Next** -> Centang persetujuan lisensi -> Klik **Next**.
   - Pilih jenis penginstalan: **Custom** atau **Typical**.
   - Pastikan fitur **TightVNC Server** terpilih.
   - **PENTING**: Centang opsi **"Register TightVNC Server as a System Service"** agar TightVNC otomatis aktif di latar belakang setiap kali Windows dinyalakan.

3. **Pengaturan Password Awal**:
   Saat muncul jendela pengaturan password TightVNC:
   - **Primary Password**: Masukkan password VNC (Password ini yang akan dimasukkan di toolbar halaman Web TMBilling).
   - **Administrative Password**: Masukkan password untuk mengunci pengaturan TightVNC.

---

## 2. Pengaturan Wajib (Access Control & Loopback)

Agar service proxy `websockify` lokal dapat menghubungkan browser ke TightVNC, Anda **wajib** mengaktifkan opsi koneksi Loopback di TightVNC:

1. Buka Start Menu Windows -> Cari dan buka **TightVNC Server Service Configuration**.
2. Masuk ke tab **Access Control**:
   - Centang checkbox **"Allow loopback connections"** (Izin koneksi dari `127.0.0.1`).
   - Pada bagian *Query Settings*, pilih **Accept connection** (agar koneksi langsung diterima tanpa menunggu konfirmasi popup di PC Server).
3. Masuk ke tab **Server**:
   - Pastikan *Main VNC port* terisi **`5900`**.
4. Klik **Apply** lalu **OK**.

---

## 3. Uji Coba di TMBilling

1. Buka Dashboard Kasir TMBilling di web browser.
2. Di sidebar utama, buka menu **Sistem & Utilitas** -> klik **📡 Remote Control Server**.
3. Ketikkan password TightVNC Anda pada kolom input password di atas toolbar.
4. Klik **▶ Hubungkan**.
5. Layar PC Server Kasir akan langsung tampil interaktif di dalam browser tanpa scrollbar.

---

## 4. Akses Remote via Cloudflare Tunnel / HTTPS Reverse Proxy

Ketika TMBilling diakses dari luar jaringan lokal menggunakan domain HTTPS (seperti Cloudflare Tunnel atau Nginx Reverse Proxy), browser akan mencoba menghubungkan WebSocket VNC secara aman via sub-path `/ws/vnc` (misalnya: `wss://kasir.domainanda.com/ws/vnc`).

Agar koneksi VNC berhasil masuk melewati tunnel, Anda perlu merutekan traffic WebSocket tersebut ke port **`8081`** (port proxy websockify TMBilling).

### Opsi A: Menggunakan Nginx di Server (Sangat Direkomendasikan)
Jika Anda menggunakan Nginx sebagai reverse proxy di depan TMBilling, tambahkan blok konfigurasi berikut di dalam konfigurasi server block Nginx Anda:

```nginx
server {
    listen 80;
    server_name kasir.domainanda.com;

    # 1. Route utama ke Dashboard TMBilling
    location / {
        proxy_pass http://127.0.0.1:7015;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Route khusus WebSocket VNC (Websockify)
    location /ws/vnc {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

*Setelah itu, di dashboard Cloudflare Tunnel (Zero Trust), cukup arahkan Public Hostname `kasir.domainanda.com` ke Nginx lokal Anda (`http://localhost:80` atau `http://127.0.0.1`).*

### Opsi B: Menggunakan File Konfigurasi CLI (`config.yml` cloudflared)
Jika Anda menjalankan Cloudflare Tunnel secara lokal menggunakan file konfigurasi `config.yml`, Anda dapat merutekan path secara langsung dengan aturan ingress berikut:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_ID>.json

ingress:
  # 1. Rutekan traffic WebSocket VNC ke port websockify 8081
  - hostname: kasir.domainanda.com
    path: /ws/vnc
    service: ws://localhost:8081
  
  # 2. Rutekan traffic utama web ke port dashboard 7015
  - hostname: kasir.domainanda.com
    service: http://localhost:7015

  # Catch-all rule (wajib ada di baris terakhir)
  - service: http_status:404
```

> [!IMPORTANT]
> Pastikan port firewall **8081** (websockify) dan **5900** (TightVNC) diperbolehkan (Allowed) dalam Windows Defender Firewall jika diakses melintasi interface jaringan yang berbeda.


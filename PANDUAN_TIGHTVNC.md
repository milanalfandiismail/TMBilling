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

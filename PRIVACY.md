# Kebijakan Privasi / Privacy Policy for TMBilling

### [Bahasa Indonesia]
TMBilling adalah sistem manajemen billing warnet berbasis open-source.

1. Pengolahan Data Lokal: Aplikasi klien memproses data telemetri perangkat keras (seperti suhu CPU/GPU, penggunaan RAM, IP lokal, dan MAC Address) hanya untuk keperluan pemantauan real-time oleh administrator warnet secara lokal di dalam jaringan LAN.
2. Fitur Online dan Cloud: Jika administrator mengaktifkan fitur opsional berbasis cloud (seperti backup otomatis ke Google Drive, Discord, NAS, atau WebDAV) serta integrasi pembayaran online (seperti kode QRIS), sistem hanya akan mengirimkan data terenkripsi langsung ke penyedia layanan yang dikonfigurasi secara mandiri oleh pengguna.
3. Skenario Self-Hosting Publik: Jika administrator memilih untuk menghosting server backend TMBilling menggunakan penyedia pihak ketiga (seperti Cloud VPS, hosting eksternal, atau layanan tunneling seperti Cloudflare/Ngrok), maka data operasional warnet berikut akan dikirimkan melalui jaringan internet menuju server hosting mandiri Anda:
   - Sesi aktif bermain (nama user, durasi bermain, paket yang dipilih).
   - Log transaksi keuangan keuangan dan audit shift kasir.
   - Data monitoring perangkat keras klien (suhu, RAM, identitas PC).
   Seluruh lalu lintas data ini dikelola sepenuhnya oleh administrator warnet selaku pemilik hosting. Aplikasi ini tidak memiliki server pusat pihak ketiga dan tidak mengumpulkan data Anda ke server luar mana pun.

---

### [English Version]
TMBilling is an open-source, cybercafe billing management system.

1. Local Data Processing: The desktop client processes hardware telemetry (such as CPU/GPU temperature, RAM usage, local IP, and MAC addresses) strictly for the local administrator's real-time monitoring dashboard within the local area network (LAN).
2. Cloud and Online Features: If the administrator enables optional cloud services (such as automated cloud backups to Google Drive, Discord, NAS, or WebDAV) or online payment integrations (such as QRIS dynamic codes), the system will transmit the required data packets strictly to the user-configured providers.
3. Public Self-Hosting Scenario: If the administrator chooses to host the TMBilling backend server using a third-party hosting provider (such as Cloud VPS, external hosting, or tunneling services like Cloudflare/Ngrok), the following cybercafe operational data will be transmitted over the internet to your self-hosted instance:
   - Active play sessions (username, play duration, selected package).
   - Financial transaction logs and cashier shift audit history.
   - Client hardware monitoring telemetry (temperature, RAM, PC identity).
   All data traffic is completely managed by the cybercafe administrator who owns the hosting. This application does not have a centralized server and does not collect or transmit any data to unauthorized third-party databases.

# Rencana Implementasi: Optimasi Performa & Caching Telemetri Agen Monitor (Eliminasi Lonjakan CPU)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menurunkan penggunaan CPU agen client (`TMMonitor.exe` & `WmiPrvSE.exe`) dari ~5%–10% ke < 0.2% dengan mengganti query WMI jaringan ke Win32 native `GetAdaptersAddresses` (deteksi dinamis IP & speed LAN 100 Mbps real-time tanpa WMI), menerapkan in-memory caching untuk data serial hardware statis (1x saat startup), dan mengubah `HardwareHelper` menjadi resident daemon (`computer.Open()` 1x di awal) sehingga seluruh fungsi dinamis berjalan setiap 5 detik dengan 0% CPU.

**Architecture:** 
1. **Deteksi Dinamis Jaringan Native Win32 (`GetAdaptersAddresses`)**: Mengganti pemanggilan WMI `Win32_NetworkAdapterConfiguration` dan `Win32_NetworkAdapter` dengan Win32 API native `GetAdaptersAddresses`. Berjalan setiap 5 detik untuk mendeteksi IP yang berubah secara instan (DHCP/reconnect) dan kecepatan LAN (100 Mbps vs 1 Gbps) dalam waktu < 0.05 ms dengan 0.00% CPU.
2. **In-Memory Caching Serial Hardware Statis (1x Saat Startup)**: Serial Motherboard, CPU ID, GPU PNP ID, Serial RAM, Serial Disk, Nama CPU, dan Nama GPU dibaca tepat **1 kali saat startup agen** di Rust dan disimpan di struct static RAM. Tidak ada lagi query WMI berulang seumur hidup aplikasi.
3. **C# `HardwareHelper` Resident Daemon (`computer.Open()` 1x)**: Mengubah `HardwareHelper.cs` agar mendukung mode daemon (`--daemon`), di mana `computer.Open()` dan inisialisasi driver kernel `.sys` dijalankan **hanya 1 kali saat startup**. Setiap 5 detik, ia memperbarui sensor suhu dalam 1 ms (turun dari 647 ms ke 1 ms, 600x lebih cepat) dan menuliskan snapshot suhu ke file `hardware_temp.json` / shared memory.
4. **All-Dynamic 5-Second Telemetry Loop**: Loop utama Rust berjalan setiap 5 detik mengeksekusi semua data dinamis (IP aktif, speed LAN, judul aplikasi aktif, CPU %, RAM %, suhu, daftar proses), menggabungkannya dengan data serial dari cache RAM, lalu mengirimkannya ke server kasir (`/api/v1/public/monitor`) dan fast poll (`/api/v1/public/client/fast_poll`).

**Tech Stack:** Rust (Native Win32 API, `iphlpapi`, `sysinfo`, `once_cell`, `winreg`, `ureq`), C# .NET (`HardwareHelper.cs`, `LibreHardwareMonitorLib.dll`).

---

## Global Constraints

- **Deteksi Perubahan IP Real-time**: Jika IP PC klien berubah (ganti router / DHCP renewal), agen harus langsung mendeteksinya pada siklus 5 detik berikutnya tanpa perlu restart agen.
- **Deteksi Drop LAN 100 Mbps Real-time**: Penurunan kecepatan kabel LAN ke 100 Mbps dan pemulihan ke 1 Gbps harus langsung terdeteksi dalam 5 detik di dashboard kasir.
- **Beban CPU Target**: CPU `TMMonitor.exe` konstan di 0.0% – 0.2%, dan `WmiPrvSE.exe` di Windows tidak terpicu secara berulang.
- **Anti-Cheat Safety**: 100% aman dari Riot Vanguard, EAC, BattlEye, dan VAC (tanpa DLL injection, tanpa memory tampering, tanpa reload driver berulang).
- **Kompatibilitas Payload Server**: Struktur payload JSON yang dikirim ke `/api/v1/public/monitor` dan `/api/v1/public/client/fast_poll` tetap identik 100% sehingga tidak merusak backend kasir.

---

### Task 1: Rust Win32 Native Network Detection (Ganti WMI dengan `GetAdaptersAddresses`)

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/Cargo.toml:19`
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:80-135`

**Interfaces:**
- Produces: `fn get_active_network_telemetry() -> (String, String, String)`
  - Returns `(ip_address, mac_address, nic_speed)`.
  - Eksekusi instan (< 0.05 ms, 0% CPU, no WMI, no `WmiPrvSE.exe`).
  - Dinamis: mendeteksi pergantian IP seketika dan mendeteksi drop speed 100 Mbps seketika.

- [x] **Step 1: Tambahkan fitur `iphlpapi` dan `iptypes` pada dependencies `winapi` di `Cargo.toml`**

```toml
winapi = { version = "0.3.9", features = ["winuser", "stringapiset", "iphlpapi", "iptypes", "netioapi", "ws2def", "ws2ipdef"] }
```

- [x] **Step 2: Implementasikan `get_active_network_telemetry()` berbasis `GetAdaptersAddresses` di `main.rs`**

Membaca adapter yang aktif (`IfOperStatusUp`), menyaring loopback (127.0.0.1), mengambil IPv4 primer, MAC address fisik, dan menghitung `TransmitLinkSpeed` (Mbps / Gbps).

- [x] **Step 3: Ganti fungsi lama `get_active_ip_and_mac()` dan `get_nic_speed()`**

Hapus query WMI `Win32_NetworkAdapterConfiguration` dan `Win32_NetworkAdapter`. Arahkan semua pemanggil ke `get_active_network_telemetry()`.

---

### Task 2: In-Memory Caching untuk Serial Hardware Statis & Konfigurasi

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:135-220, 300-398, 850-880`

**Interfaces:**
- Produces:
  - `static STATIC_SERIALS: Lazy<CachedHardwareSerials>` (Motherboard, CPU ID, GPU PNP ID, RAM Serials, Disk Serials).
  - `static STATIC_SPECS: Lazy<(String, String, String)>` (Motherboard Name, CPU Name, GPU Name).
  - `static CACHED_CONFIG: Lazy<RwLock<Option<ClientConfig>>>` (URL, API Key, Token).

- [x] **Step 1: Definisikan struct cache statis untuk serial dan spesifikasi perangkat keras**

Query WMI untuk CPU ID, GPU PNP ID, RAM Serials, Disk Serials dibungkus dalam `Lazy::new(...)` sehingga dieksekusi **hanya 1 kali seumur hidup aplikasi saat startup**.

- [x] **Step 2: Baca Nama CPU & GPU langsung dari Registry Windows (0 ms, no WMI)**

- Nama CPU: `HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0\ProcessorNameString`
- Nama GPU: `HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000\DriverDesc`

- [x] **Step 3: Caching konfigurasi `load_config()` di memori RAM**

Hindari membuka Registry dan disk file `config.ini` setiap 2 detik. Gunakan `CACHED_CONFIG` dengan pembacaan pertama di memori.

---

### Task 3: C# `HardwareHelper` Resident Daemon Mode (`computer.Open()` 1x)

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/HardwareHelper.cs:1-120`
- Recompile: `csc.exe ... HardwareHelper.cs` ➡️ `HardwareHelper.exe`

**Interfaces:**
- Produces: `HardwareHelper.exe --daemon`
  - Memanggil `computer.Open()` satu kali di awal startup.
  - Berjalan di background dan memperbarui suhu CPU & GPU setiap 5 detik ke file `hardware_temp.json`.
  - Waktu eksekusi turun dari 647 ms ke 1 ms (0.0% CPU).

- [x] **Step 1: Tambahkan argumen `--daemon` pada `HardwareHelper.cs`**

```csharp
if (args.Contains("--daemon"))
{
    while (true)
    {
        try {
            float cpuTemp = 0;
            float gpuTemp = 0;
            foreach (IHardware hardware in computer.Hardware)
            {
                hardware.Update();
                if (hardware.HardwareType == HardwareType.Cpu) {
                    var tempSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && (s.Name.Contains("Package") || s.Name.Contains("Tdie"))) 
                                  ?? hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    if (tempSensor != null) cpuTemp = tempSensor.Value.GetValueOrDefault();
                }
                if (hardware.HardwareType.ToString().Contains("Gpu")) {
                    var gpuSensor = hardware.Sensors.FirstOrDefault(s => s.SensorType == SensorType.Temperature && s.Name.Contains("Core"));
                    if (gpuSensor != null) gpuTemp = gpuSensor.Value.GetValueOrDefault();
                }
            }
            string json = string.Format(CultureInfo.InvariantCulture, "{{\"CpuTemp\":{0},\"GpuTemp\":{1}}}", cpuTemp, gpuTemp);
            File.WriteAllText("hardware_temp.json", json);
        } catch { }
        Thread.Sleep(5000);
    }
}
```

- [x] **Step 2: Kompilasi ulang `HardwareHelper.exe`**

Jalankan kompilasi menggunakan `csc.exe` dengan referensi `LibreHardwareMonitorLib.dll`.

---

### Task 4: Integrasi Loop Telemetri Dinamis 5 Detik di Rust

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:815-900, 1100-1160`

**Interfaces:**
- Produces: Siklus 5 detik terpadu yang menjalankan seluruh fungsi dinamis:
  - Deteksi IP & LAN Speed dinamis (`get_active_network_telemetry()`)
  - Active Window (`GetForegroundWindow`)
  - CPU Usage & RAM (`sysinfo`)
  - Suhu CPU & GPU (dari `hardware_temp.json` / cache)
  - Pengiriman JSON ke `/api/v1/public/monitor`
  - Polling perintah kasir `/api/v1/public/client/fast_poll`

- [x] **Step 1: Auto-spawn `HardwareHelper.exe --daemon` saat `TMMonitor` startup**

Jalankan `HardwareHelper.exe --daemon` sebagai background child process (1x saja) dan kelola shutdown saat agen berhenti.

- [x] **Step 2: Implementasikan pembacaan cepat `hardware_temp.json` di Rust**

Rust membaca file JSON kecil (~40 bytes) atau in-memory fallback tanpa men-spawn proses baru.

- [x] **Step 3: Satukan pengiriman telemetri dan fast-poll dalam interval 5 detik**

Setiap 5 detik:
1. Ambil IP, MAC, dan NIC Speed terbaru via Win32.
2. Ambil judul window aktif & CPU usage.
3. Ambil suhu terbaru.
4. Gabungkan dengan `STATIC_SERIALS` & `STATIC_SPECS`.
5. Kirim snapshot ke kasir.
6. Cek perintah remote dari kasir.

- [x] **Step 4: Kompilasi release `TMBilling_Monitor` (`cargo build --release`)**

Pastikan kompilasi Rust berhasil 100% tanpa error.

---

### Task 5: Verifikasi Penuh, Tolok Ukur CPU & Uji Regresi

**Files:**
- Execute: Benchmark `Measure-Command` dan Task Manager CPU monitor.
- Test: Unit test suite server `tests/` (`pytest`).
- Codebase-memory: `index_repository`.

- [x] **Step 1: Ukur konsumsi CPU dan waktu eksekusi**
Pastikan waktu per-siklus < 2 milidetik dan konsumsi CPU < 0.2%.

- [x] **Step 2: Jalankan pytest pada server**
Jalankan: `.\.venv\Scripts\python -m pytest`
Ekspektasi: Seluruh test (252+) passed 100%.

- [x] **Step 3: Update indeks codebase-memory via MCP**
Panggil `index_repository` pada project `C-Project-GIT-TMBilling`.

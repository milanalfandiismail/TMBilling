# Perencanaan: HardwareHelper Pure Engine (Motherboard & GPU), 1-Detik Suhu Realtime, dan Pembersihan Mismatch Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menggunakan LibreHardwareMonitor (`HardwareHelper`) sebagai sumber utama nama lengkap Motherboard dan GPU fisik, mengunci (cache) hasilnya sekali di memori Rust, menjalankan update suhu daemon setiap 1 detik, serta menghapus peringatan hardware mismatch dari kartu PC dashboard kasir.

**Architecture:** 
1. **Motherboard & GPU Pure Engine (`HardwareHelper`)**:
   - `HardwareHelper.cs` (LibreHardwareMonitor) membaca nama lengkap Motherboard (Merek + Seri dari SMBIOS DMI fisik) dan GPU fisik (dari driver GPU langsung).
   - Rust monitor menangkap nama Motherboard dan GPU fisik dari `HardwareHelper`, lalu menguncinya permanen di in-memory cache `STATIC_SPECS`.
   - Tidak lagi bergantung pada registry Windows yang bisa tidak ada, kosong, atau menumpuk di warnet diskless.
2. **Daemon Suhu 1 Detik**:
   - `HardwareHelper.cs` mode daemon memperbarui sensor suhu setiap 1000 ms (1 detik), memakan waktu < 0.5 ms per siklus (< 0.1% CPU).
   - Snapshot `hardware_temp.json` selalu segar setiap detik, sehingga kapan pun server meminta data (1s, 5s, atau 10s), datanya selalu realtime dan akurat.
3. **Pembersihan Dashboard Kasir**:
   - Hapus visual alert `isHwMismatch` dari kartu PC di [`dashboard_compact.js`](file:///c:/Project%20GIT/TMBilling/app/static/js/kasir/modules/dashboard/dashboard_compact.js) agar kartu PC kembali bersih.

**Tech Stack:** Rust (Sysinfo, Once_cell RwLock in-memory cache, Ureq), C# .NET (`HardwareHelper.cs`, `LibreHardwareMonitorLib.dll`, `csc.exe`), JavaScript (Vanilla Dashboard Compact Grid).

---

## Global Constraints
- Beban CPU daemon dan agent monitor harus tetap mendekati 0%.
- Nama Motherboard dan GPU yang sudah terbaca valid di Rust tidak boleh ditimpa menjadi "Unknown" atau generic adapter.
- Seluruh 356+ unit test backend dan `cargo check` harus tetap lulus 100%.

---

### Task 1: Hapus Peringatan Hardware Mismatch dari Kartu Dashboard Kasir

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:170-325`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_compact.js:375-495`

**Interfaces:**
- Menghapus badge/efek `isHwMismatch` dari `renderCompactCard(pc)` dan `syncLiveCards(data)`.
- Mengembalikan kartu PC di dashboard kasir ke tampilan normal.

- [ ] **Step 1: Bersihkan `renderCompactCard` dari `isHwMismatch`**
  Hapus kode yang menambahkan border merah berdenyut dan teks `🚨 MISMATCH` di kartu PC dashboard.

- [ ] **Step 2: Bersihkan `syncLiveCards` dari `isHwMismatch`**
  Hapus kode yang memperbarui status `isHwMismatch` saat polling realtime di dashboard.

---

### Task 2: Jadikan HardwareHelper Sumber Utama Motherboard & GPU dengan In-Memory Cache di Rust

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:1130-1175`
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:45-55`

**Interfaces:**
- `read_cached_hardware_specs() -> (f32, f32, Option<String>, Option<String>, Option<String>)`:
  Membaca `hardware_temp.json` untuk mendapatkan suhu (`CpuTemp`, `GpuTemp`) dan nama hardware (`Motherboard`, `CpuName`, `GpuName`).
- In-memory lock: Begitu `STATIC_SPECS.motherboard` dan `STATIC_SPECS.gpu_name` terisi nama valid dari `HardwareHelper`, nilai tersebut dikunci permanen di memori Rust (tidak perlu query ulang).

- [ ] **Step 1: Perbarui pembacaan `hardware_temp.json` di Rust**
  Ekstrak `Motherboard`, `GpuName`, dan `CpuName` dari `hardware_temp.json` jika ada.

- [ ] **Step 2: Kunci nama Motherboard dan GPU di `STATIC_SPECS` Rust**
  Jika `STATIC_SPECS.motherboard` atau `STATIC_SPECS.gpu_name` belum terisi atau masih generic/unknown, ambil dari `HardwareHelper` dan kunci permanen di memori.

- [ ] **Step 3: Uji `cargo check`**
  Pastikan kompilasi Rust berhasil tanpa error.

---

### Task 3: Set Interval Daemon HardwareHelper ke 1 Detik

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/HardwareHelper.cs:115-135`
- Recompile: `HardwareHelper.exe` via `csc.exe`

**Interfaces:**
- `HardwareHelper.cs` mode `--daemon`: Tidur `Thread.Sleep(1000)` (1 detik) di setiap putaran.
- Nilai suhu di `hardware_temp.json` selalu segar setiap detik.

- [ ] **Step 1: Ubah interval sleep di `HardwareHelper.cs` menjadi 1000 ms**
  Ganti `Thread.Sleep(5000);` menjadi `Thread.Sleep(1000);`.

- [ ] **Step 2: Kompilasi ulang `HardwareHelper.exe`**
  Gunakan `csc.exe` untuk membangun `HardwareHelper.exe` baru.

- [ ] **Step 3: Rebuild Rust binary & validasi**
  Kompilasi Rust untuk memastikan embedded binary `HardwareHelper.exe` terintegrasi.

---

### Task 4: Pengujian & Validasi

- [ ] **Step 1: Jalankan pytest suite**
  `python -m pytest`
- [ ] **Step 2: Reindex codebase memory**
  Jalankan `index_repository` pada MCP `codebase-memory`.



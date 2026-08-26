# Plan Debugging: Robust VNC Agent Diagnostics & Multi-Path Execution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki sistem eksekusi dan logging pada agen Rust `TMMonitor.exe` agar logging bekerja 100% menggunakan absolute path, mendeteksi TightVNC di semua kemungkinan lokasi path, mengonfigurasi registry HKLM & HKCU, serta memberikan visibilitas penuh terhadap status lifecycle VNC client.

**Root Causes Discovered:**
1. `log_debug` menggunakan relative path `"agent_debug.log"`. Jika working directory berbeda (misal `C:\Windows\System32`), file tidak dapat dibuat atau gagal izin tulis.
2. `log_debug` tidak dipanggil di awal `main()`. Jika instance lama sedang berjalan, proses baru keluar seketika di `acquire_self_lock` tanpa pernah mencatat apa pun.
3. `find_tvnserver_path()` hanya memeriksa 3 path sempit dan melewatkan `C:\Program Files\TightVNC\tvnserver.exe` serta `C:\TMBilling\tvnserver.exe`.
4. `tvnserver.exe` di-spawn dengan `CREATE_NO_WINDOW (0x08000000)` yang dapat membekukan aplikasi GUI Win32 TightVNC yang membutuhkan message loop.
5. Konfigurasi registry hanya ditulis ke `HKCU`, padahal jika TightVNC berjalan sebagai service atau membaca dari `HKLM`, pengaturan port/loopback/password tidak terbaca.

**Architecture:**
- **Layer 1 (Bulletproof Logger):** `log_debug` menulis ke `C:\TMBilling\agent_debug.log` dan fallback ke `%TEMP%\tmb_agent_debug.log` dengan timestamp ISO.
- **Layer 2 (Extended Path Resolver):** `find_tvnserver_path` memeriksa 6 lokasi berbeda termasuk Program Files dan direktori biner.
- **Layer 3 (Dual Registry Provisioning):** `write_vnc_password_to_registry` menulis konfigurasi ke `HKCU` dan `HKLM` (`Software\TightVNC\Server`).
- **Layer 4 (Safe Win32 Spawning):** Menghilangkan `CREATE_NO_WINDOW` pada spawn `tvnserver.exe` dan menambahkan `DETACHED_PROCESS` yang aman.

---

### Task 1: Bulletproof File Logger & Startup Lifecycle Logging in Rust Agent

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs`

- [ ] **Step 1: Implement robust absolute-path `log_debug` with timestamp in `main.rs`**
Update `log_debug`:
```rust
fn log_debug(msg: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::time::SystemTime;

    let now_str = match SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        Ok(d) => {
            let secs = d.as_secs();
            let hours = (secs / 3600) % 24;
            let mins = (secs / 60) % 60;
            let s = secs % 60;
            format!("{:02}:{:02}:{:02}", hours, mins, s)
        }
        Err(_) => "00:00:00".to_string(),
    };

    let log_line = format!("[{}] {}\n", now_str, msg);

    // 1. Coba tulis ke direktori C:\TMBilling\agent_debug.log
    let primary_path = std::path::PathBuf::from(r"C:\TMBilling\agent_debug.log");
    if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&primary_path) {
        let _ = file.write_all(log_line.as_bytes());
        return;
    }

    // 2. Fallback ke folder exe saat ini
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let fallback_path = exe_dir.join("agent_debug.log");
        if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&fallback_path) {
            let _ = file.write_all(log_line.as_bytes());
            return;
        }
    }

    // 3. Fallback ke folder Temp pengguna
    let mut temp_path = std::env::temp_dir();
    temp_path.push("tmb_agent_debug.log");
    if let Ok(mut file) = OpenOptions::new().create(true).write(true).append(true).open(&temp_path) {
        let _ = file.write_all(log_line.as_bytes());
    }
}
```

- [ ] **Step 2: Log immediately on agent startup before and after lock acquisition in `main()`**
Update `main()` in `WarnetAgent/TMBilling_Monitor/src/main.rs`:
```rust
    log_debug("=========================================");
    log_debug("=== TMBilling Monitor Starting Up... ===");
    log_debug(&format!("Current exe: {:?}", std::env::current_exe()));

    let _my_lock = acquire_self_lock("tmmonitor.lock");
    if _my_lock.is_none() {
        log_debug("STARTUP ABORTED: Instance lain sedang berjalan (tmmonitor.lock terkunci).");
        return;
    }
    log_debug("Single-instance lock (tmmonitor.lock) berhasil didapatkan.");
```

- [ ] **Step 3: Test compilation with `cargo check`**
Run: `cargo check` in `WarnetAgent/TMBilling_Monitor`
Expected: 0 errors.

---

### Task 2: Extended Path Resolution, Dual Registry, and Safe Spawning

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs`

- [ ] **Step 1: Extend `find_tvnserver_path` to search 6 locations**
```rust
fn find_tvnserver_path() -> Option<std::path::PathBuf> {
    let candidates = [
        std::path::PathBuf::from(r"C:\TMBilling\TightVNC\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\TMBilling\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\Program Files\TightVNC\tvnserver.exe"),
        std::path::PathBuf::from(r"C:\Program Files (x86)\TightVNC\tvnserver.exe"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.clone());
        }
    }

    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let local_tightvnc = exe_dir.join("TightVNC").join("tvnserver.exe");
        if local_tightvnc.exists() {
            return Some(local_tightvnc);
        }
        let same_dir = exe_dir.join("tvnserver.exe");
        if same_dir.exists() {
            return Some(same_dir);
        }
    }
    None
}
```

- [ ] **Step 2: Provision both `HKCU` and `HKLM` in `write_vnc_password_to_registry`**
```rust
fn write_vnc_password_to_registry(password: &str) -> Result<(), std::io::Error> {
    let encrypted = obfuscate_vnc_password(password);
    
    // Tulis ke HKCU
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(subkey) = hkcu.create_subkey(r"Software\TightVNC\Server") {
        let reg_val = winreg::RegValue {
            vtype: winreg::enums::REG_BINARY,
            bytes: encrypted.clone(),
        };
        let _ = subkey.set_raw_value("Password", &reg_val);
        let _ = subkey.set_value("RfbPort", &5900u32);
        let _ = subkey.set_value("AcceptRfbConnections", &1u32);
        let _ = subkey.set_value("AllowLoopback", &1u32);
    }

    // Tulis ke HKLM (jika elevated)
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(subkey) = hklm.create_subkey(r"Software\TightVNC\Server") {
        let reg_val = winreg::RegValue {
            vtype: winreg::enums::REG_BINARY,
            bytes: encrypted,
        };
        let _ = subkey.set_raw_value("Password", &reg_val);
        let _ = subkey.set_value("RfbPort", &5900u32);
        let _ = subkey.set_value("AcceptRfbConnections", &1u32);
        let _ = subkey.set_value("AllowLoopback", &1u32);
    }
    Ok(())
}
```

- [ ] **Step 3: Safe Win32 Spawning in `start_tightvnc_portable`**
Use standard process creation without `CREATE_NO_WINDOW (0x08000000)`:
```rust
        let spawn_res = Command::new(&tvn_path)
            .arg("-run")
            .current_dir(&tvn_dir)
            .creation_flags(0x00000008) // DETACHED_PROCESS
            .spawn();
```

- [ ] **Step 4: Build release binary & deploy**
Run: `cargo build --release` in `WarnetAgent/TMBilling_Monitor`
Copy binary: `Copy-Item -Path "target\release\TMMonitor.exe" -Destination "..\Deploy\TMMonitor.exe" -Force`

- [ ] **Step 5: Commit changes**
```bash
git add WarnetAgent/TMBilling_Monitor/src/main.rs WarnetAgent/Deploy/TMMonitor.exe
git commit -m "fix(agent): implement bulletproof absolute-path logger, 6-path VNC search, and dual registry"
```

---

### Task 3: Verification & Sanity Check

- [ ] **Step 1: Run complete backend pytest suite**
Run: `.venv\Scripts\python -m pytest -v`
Expected: All 40 tests pass.

- [ ] **Step 2: Final verification commit**
```bash
git commit --allow-empty -m "chore: complete verification for robust VNC agent diagnostics"
```

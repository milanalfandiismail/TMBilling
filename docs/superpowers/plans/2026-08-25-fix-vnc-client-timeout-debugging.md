# Fix VNC Client Timeout (408) & Execution Failure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki masalah timeout 15 detik (HTTP 408) saat memulai Remote Control PC Client dengan mengatasi root cause pada IP/MAC resolution backend, perbaikan CLI & registry TightVNC di Rust agent, pemisahan polling loop ke thread independen, peningkatan timeout window, dan penambahan diagnostic logging yang detail.

**Architecture:** 
1. Backend `vnc_poll`, `vnc_ready`, dan `vnc_stopped` diseragamkan dengan normalisasi IP, sanitasi string `"Unknown"`, fallback `request.remote_addr`, dan `find_by_mac`.
2. Rust agent `TMBilling_Monitor` menjalankan portable `tvnserver.exe` dengan argumen valid (`-run`), mengkonfigurasi port 5900 & loopback di registry `HKCU\Software\TightVNC\Server`, serta menggunakan process flags yang kompatibel dengan desktop session Windows.
3. Polling loop VNC pada Rust agent dipindahkan ke lightweight thread mandiri (interval 2-3 detik) agar tidak terblokir oleh operasi WMI/telemetry yang memakan waktu lama.
4. Timeout dinaikkan dari 15.0 detik menjadi 25.0 detik, dan diagnostic logging ditambahkan pada setiap tahapan handshake.

**Tech Stack:** Python (Flask, SQLAlchemy, Pytest), Rust (`ureq`, `winreg`, `std::process::Command`), noVNC (JavaScript).

**Spec:** `docs/superpowers/specs/2026-08-25-remote-control-per-client-design.md`

## Global Constraints
- Harus backward-compatible dan tidak mengganggu polling status Tauri client.
- Password VNC tetap di-hash dengan DES standard VNC sebelum ditulis ke registry.
- Registry password TightVNC wajib dibersihkan saat sesi dihentikan (`vnc_stop` / `vnc_stopped`).
- Semua unit test backend (`pytest`) harus 100% lulus.

---

### Task 1: Backend Client Route Resiliency & MAC Fallback

**Files:**
- Modify: `app/routes/client/client_routes.py:160-220`
- Test: `tests/test_client_vnc_commands.py`

**Interfaces:**
- `vnc_poll`: Menerima `ip_address`, `mac_address`. Sanitasi `"Unknown"`, fallback ke `request.remote_addr`, fallback ke `PCRepository.find_by_mac`.
- `vnc_ready`: Menerima `ip_address`, `mac_address`, `ready`. Validasi IP/MAC identik dengan `vnc_poll`.
- `vnc_stopped`: Menerima `ip_address`, `mac_address`. Validasi IP/MAC identik dengan `vnc_poll`.

- [ ] **Step 1: Write the failing unit test for fallback IP/MAC and Unknown sanitization**

Add test cases in `tests/test_client_vnc_commands.py`:
```python
def test_vnc_ready_and_stopped_mac_fallback(client, db_session, test_pc):
    """Test bahwa vnc_ready dan vnc_stopped berhasil mengenali PC via MAC jika IP Unknown."""
    # Test vnc_ready via MAC
    res_ready = client.post("/api/v1/public/client/vnc_ready", json={
        "ip_address": "Unknown",
        "mac_address": test_pc.mac_address,
        "ready": True
    }, headers={"X-Client-Key": "TM2026QWERTY-api-key"})
    assert res_ready.status_code == 200
    assert res_ready.json["success"] is True

    # Test vnc_stopped via MAC
    res_stop = client.post("/api/v1/public/client/vnc_stopped", json={
        "ip_address": "Unknown",
        "mac_address": test_pc.mac_address
    }, headers={"X-Client-Key": "TM2026QWERTY-api-key"})
    assert res_stop.status_code == 200
    assert res_stop.json["success"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_client_vnc_commands.py -v`
Expected: FAIL with status code 404 != 200.

- [ ] **Step 3: Implement IP sanitization and MAC fallback in `client_routes.py`**

Modify helper PC resolver and endpoints in `app/routes/client/client_routes.py`:
```python
def _resolve_client_pc(data):
    """Helper untuk meresolve PC dari request payload atau remote header."""
    from app.repositories import PCRepository
    raw_ip = data.get("ip_address")
    if raw_ip in ["Unknown", "unknown", "", None]:
        raw_ip = None
        
    ip_address = raw_ip or request.headers.get("X-IP-Address") or request.remote_addr
    mac_address = data.get("mac_address", "").upper().strip()
    
    pc = PCRepository.get_by_ip(ip_address)
    if not pc and mac_address:
        pc = PCRepository.find_by_mac(mac_address)
    return pc, ip_address, mac_address
```
Update `vnc_ready`, `vnc_stopped`, and `vnc_poll` to use `_resolve_client_pc`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_client_vnc_commands.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/client/client_routes.py tests/test_client_vnc_commands.py
git commit -m "fix(client-api): add robust IP sanitization and MAC address fallback for VNC endpoints"
```

---

### Task 2: Rust Agent TightVNC Registry Configuration & CLI Execution Fix

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:515-585`

**Interfaces:**
- `write_vnc_password_to_registry(password: &str)`: Tulis `Password` (REG_BINARY), `RfbPort` (REG_DWORD = 5900), `AcceptRfbConnections` (REG_DWORD = 1), `AllowLoopback` (REG_DWORD = 1).
- `start_tightvnc_portable(password: &str)`: Jalankan `tvnserver.exe -run` (tanpa flag `-rfbport` yang tidak valid) dan gunakan flag proses standar `0x08000000` (CREATE_NO_WINDOW) tanpa `DETACHED_PROCESS`.
- `stop_tightvnc_portable()`: Hentikan `tvnserver.exe` dan bersihkan registry password.

- [ ] **Step 1: Update `write_vnc_password_to_registry` in `main.rs`**

```rust
fn write_vnc_password_to_registry(password: &str) -> Result<(), std::io::Error> {
    let encrypted = obfuscate_vnc_password(password);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(subkey) = hkcu.create_subkey(r"Software\TightVNC\Server") {
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

- [ ] **Step 2: Update `start_tightvnc_portable` and CLI arguments**

```rust
fn start_tightvnc_portable(password: &str) -> bool {
    if is_port_open_local(5900) {
        return true;
    }
    let _ = write_vnc_password_to_registry(password);
    if let Some(tvn_path) = find_tvnserver_path() {
        let mut tvn_dir = tvn_path.clone();
        tvn_dir.pop();
        // Jalankan tvnserver.exe hanya dengan parameter -run
        let _ = Command::new(&tvn_path)
            .arg("-run")
            .current_dir(&tvn_dir)
            .creation_flags(0x08000000) // CREATE_NO_WINDOW saja
            .spawn();
        for _ in 0..12 {
            thread::sleep(Duration::from_millis(500));
            if is_port_open_local(5900) {
                return true;
            }
        }
    }
    false
}
```

- [ ] **Step 3: Include `mac_address` in `vnc_ready` and `vnc_stopped` payloads in `main.rs`**

```rust
let vnc_ready_url = format!("{}/api/v1/public/client/vnc_ready", server_base_url.trim_end_matches('/'));
let _ = ureq::post(&vnc_ready_url)
    .set("X-Client-Key", api_key)
    .send_json(json!({
        "ip_address": ip_address,
        "mac_address": mac_address,
        "ready": true
    }));
```

- [ ] **Step 4: Verify build**

Run: `cargo check` in `WarnetAgent/TMBilling_Monitor`
Expected: Finished with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add WarnetAgent/TMBilling_Monitor/src/main.rs
git commit -m "fix(agent): correct TightVNC registry settings, CLI arguments and payload MAC inclusion"
```

---

### Task 3: Dedicated Non-Blocking VNC Polling Thread in Rust Agent

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:720-760`

**Interfaces:**
- Spawning dedicated thread: Menjalankan polling VNC setiap 2 detik di thread terpisah sehingga tidak terpengaruh oleh delay WMI / sysinfo refresh di main loop telemetry.

- [ ] **Step 1: Implement background thread for VNC command polling**

In `main.rs`, spawn thread sebelum loop telemetry:
```rust
    // Thread mandiri untuk polling VNC command setiap 2 detik (bebas lag WMI)
    thread::spawn(move || {
        loop {
            let (server_base_url, api_key, _, _) = load_config();
            if !server_base_url.is_empty() {
                poll_and_execute_vnc_commands(&server_base_url, &api_key);
            }
            thread::sleep(Duration::from_secs(2));
        }
    });
```
Hapus `poll_and_execute_vnc_commands` dari loop telemetry utama untuk menghindari duplicate polling.

- [ ] **Step 2: Verify build and release binary compilation**

Run: `cargo build --release` in `WarnetAgent/TMBilling_Monitor`
Expected: Finished with 0 errors.

- [ ] **Step 3: Copy new binary to Deploy folder**

Run: `Copy-Item -Path "target\release\TMMonitor.exe" -Destination "..\Deploy\TMMonitor.exe" -Force`

- [ ] **Step 4: Commit**

```bash
git add WarnetAgent/TMBilling_Monitor/src/main.rs WarnetAgent/Deploy/TMMonitor.exe
git commit -m "perf(agent): run VNC command polling in dedicated 2-second background thread"
```

---

### Task 4: Timeout Resilience & Diagnostic Logging

**Files:**
- Modify: `app/routes/monitor/monitor_routes.py:320-350`
- Modify: `app/services/vnc/vnc_service.py:100-130`

**Interfaces:**
- `wait_vnc_ready(pc_id, timeout=25.0)`: Meningkatkan default timeout menjadi 25.0 detik.
- Diagnostic logs via `write_log`:
  - `VNC_COMMAND_QUEUED`: Log saat command VNC start masuk antrean.
  - `VNC_CLIENT_POLL`: Log saat agent melakukan pop antrean VNC.
  - `VNC_CLIENT_READY`: Log saat agent melaporkan port 5900 siap.
  - `VNC_WAIT_TIMEOUT`: Log detail jika timeout terjadi (mencatat apakah command sudah di-poll atau belum).

- [ ] **Step 1: Update timeout in `monitor_routes.py` and `vnc_service.py`**

In `monitor_routes.py`:
```python
        # Tunggu ready flag dari agent dengan timeout 25 detik
        ready = VNCClientProxyService.wait_vnc_ready(pc.id, timeout=25.0)
        if not ready:
            write_log("VNC_WAIT_TIMEOUT", f"Timeout 25 detik: PC {pc.kode} (ID {pc.id}) tidak mengirim konfirmasi VNC ready", level="WARNING")
            return jsonify({"success": False, "error": f"PC {pc.kode} tidak merespon/gagal mengaktifkan VNC dalam 25 detik. Pastikan agen monitor berjalan pada client."}), 408
```

- [ ] **Step 2: Add diagnostic logging to `vnc_poll` and `vnc_ready` in `client_routes.py`**

```python
    if cmd:
        write_log("VNC_COMMAND_DISPATCHED", f"Perintah VNC [{cmd}] diambil oleh PC {pc.kode} ({ip_address})", detail_json={"pc_id": pc.id, "cmd": cmd})
```

- [ ] **Step 3: Run pytest suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: All 39 tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/routes/monitor/monitor_routes.py app/services/vnc/vnc_service.py app/routes/client/client_routes.py
git commit -m "feat(monitor): increase VNC ready timeout to 25s and add rich diagnostic logging"
```

---

### Task 5: End-to-End Verification & Sanity Check

**Files:**
- Test files: `tests/`
- Build outputs: `WarnetAgent/Deploy/`

- [ ] **Step 1: Run complete backend pytest suite**
Run: `.venv\Scripts\python -m pytest -v`
Expected: 39+ tests passing (0 failures).

- [ ] **Step 2: Verify uninstaller and monitor release builds**
Run: `cargo build --release` in `WarnetAgent/TMBilling_Monitor` and `WarnetAgent/TMBilling_Uninstaller`
Expected: 0 errors.

- [ ] **Step 3: Final verification commit**
```bash
git commit --allow-empty -m "chore: complete verification for VNC client timeout debugging fixes"
```

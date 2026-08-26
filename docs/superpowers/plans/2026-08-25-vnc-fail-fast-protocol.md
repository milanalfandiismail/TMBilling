# VNC Fail-Fast Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan protokol fail-fast pada VNC handshake agar jika agen gagal mendeteksi/menjalankan TightVNC Server, agen langsung melaporkan error spesifik kembali ke backend, yang kemudian akan segera diteruskan ke dashboard kasir tanpa harus menunggu timeout 25 detik.

**Architecture:**
1. Backend `VNCClientProxyService` diperbarui menggunakan status map `_vnc_status = {pc_id: {"ready": bool, "error": str}}` yang disinkronisasi menggunakan `threading.Event()`.
2. Endpoint `/vnc_ready` menerima `error` parameter tambahan jika `ready` bernilai `false`.
3. Rust agent `TMBilling_Monitor` mendeteksi jika `tvnserver.exe` tidak ditemukan atau jika port 5900 gagal dibuka setelah 12 kali percobaan, lalu mengirimkan payload `ready: false` beserta pesan error detail.
4. UI kasir langsung menampilkan error detail secara instan.

**Tech Stack:** Python (Flask, Pytest), Rust (`ureq`).

**Spec:** `docs/superpowers/specs/2026-08-25-remote-control-per-client-design.md`

## Global Constraints
- Harus backward-compatible.
- Semua unit test backend harus 100% lulus.

---

### Task 1: Backend Fail-Fast Service & Route Integration

**Files:**
- Modify: `app/services/vnc/vnc_service.py:155-180`
- Modify: `app/routes/client/client_routes.py:180-195`
- Modify: `app/routes/monitor/monitor_routes.py:325-335`
- Test: `tests/test_client_vnc_commands.py`

- [ ] **Step 1: Implement status tracking in `vnc_service.py`**

Modify `VNCClientProxyService` in `app/services/vnc/vnc_service.py`:
```python
    _vnc_events = {}
    _vnc_events_lock = threading.Lock()
    _vnc_status = {}  # pc_id -> {"ready": bool, "error": str}
```
Update `set_vnc_ready` and `wait_vnc_ready`:
```python
    @classmethod
    def set_vnc_ready(cls, pc_id, ready=True, error_msg=None):
        with cls._vnc_events_lock:
            cls._vnc_status[pc_id] = {"ready": ready, "error": error_msg}
            if pc_id not in cls._vnc_events:
                cls._vnc_events[pc_id] = threading.Event()
            cls._vnc_events[pc_id].set()

    @classmethod
    def wait_vnc_ready(cls, pc_id, timeout=25.0):
        event = None
        with cls._vnc_events_lock:
            if pc_id not in cls._vnc_events:
                cls._vnc_events[pc_id] = threading.Event()
            event = cls._vnc_events[pc_id]
            cls._vnc_status.pop(pc_id, None)  # Reset status lama
            
        success = event.wait(timeout)
        
        status = None
        with cls._vnc_events_lock:
            cls._vnc_events.pop(pc_id, None)
            status = cls._vnc_status.pop(pc_id, None)
            
        if not success:
            return False, "PC client tidak merespon dalam batas waktu."
            
        if status and not status["ready"]:
            return False, status.get("error") or "Gagal mengaktifkan VNC di client."
            
        return True, None
```

- [ ] **Step 2: Update `/vnc_ready` endpoint in `client_routes.py` to parse error message**

Modify `vnc_ready` in `app/routes/client/client_routes.py`:
```python
@client_api_bp.route("/vnc_ready", methods=["POST"])
@api_key_required
def vnc_ready():
    """Client melapor bahwa VNC Server sudah aktif di port 5900."""
    data = request.get_json() or {}
    pc, ip_address, mac_address = _resolve_client_pc(data)
    ready = data.get("ready", True)
    error_msg = data.get("error")
    
    if not pc:
        write_log("VNC_READY_REJECTED", f"Laporan VNC ready ditolak: PC tidak dikenal (IP={ip_address}, MAC={mac_address})")
        return jsonify({"success": False, "error": "PC tidak dikenal"}), 404
        
    if ready:
        write_log("VNC_CLIENT_READY", f"Client PC {pc.kode} melaporkan VNC server aktif di port 5900", detail_json={"pc_id": pc.id, "ip": ip_address})
    else:
        write_log("VNC_CLIENT_FAILED", f"Client PC {pc.kode} gagal mengaktifkan VNC: {error_msg}", level="WARNING", detail_json={"pc_id": pc.id, "error": error_msg})
        
    from app.services.vnc.vnc_service import VNCClientProxyService
    VNCClientProxyService.set_vnc_ready(pc.id, ready, error_msg)
    
    return jsonify({"success": True, "message": "Status VNC ready diperbarui"}), 200
```
*(Note: Hapus kata kunci `level="WARNING"` karena `write_log` tidak memilikinya)* -> Gunakan:
`write_log("VNC_CLIENT_FAILED", f"Client PC {pc.kode} gagal mengaktifkan VNC: {error_msg}", detail_json={"pc_id": pc.id, "error": error_msg})`

- [ ] **Step 3: Update `monitor_routes.py` to handle wait_vnc_ready return tuple**

Modify `start_vnc_client` in `app/routes/monitor/monitor_routes.py`:
```python
        # Tunggu ready flag dari agent
        success, error_msg = VNCClientProxyService.wait_vnc_ready(pc.id, timeout=25.0)
        if not success:
            write_log("VNC_WAIT_TIMEOUT", f"Gagal mengaktifkan VNC untuk PC {pc.kode} (ID {pc.id}): {error_msg}")
            return jsonify({"success": False, "error": f"PC {pc.kode} gagal mengaktifkan VNC: {error_msg}"}), 408
```

- [ ] **Step 4: Update test cases in `tests/test_client_vnc_commands.py` and `tests/test_vnc_client_proxy.py`**

Verify that all VNC-related test calls to `wait_vnc_ready` expect a `(success, error_msg)` tuple instead of a single boolean.
Update test `test_vnc_ready_endpoint` in `tests/test_client_vnc_commands.py`:
```python
    res = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5)
    assert res[0] is True
```

- [ ] **Step 5: Run tests to verify**

Run: `.venv\Scripts\python -m pytest tests/test_client_vnc_commands.py tests/test_vnc_client_proxy.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/vnc/vnc_service.py app/routes/client/client_routes.py app/routes/monitor/monitor_routes.py tests/
git commit -m "feat(vnc): implement fail-fast protocol for VNC ready status handshake"
```

---

### Task 2: Rust Agent VNC Startup Error Reporting

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs:610-640`

**Interfaces:**
- Menerima `vnc_start`, mendeteksi jika `tvnserver.exe` tidak ditemukan atau jika port 5900 tidak aktif setelah loop timeout.
- Mengirim payload JSON `{"ready": false, "error": "tvnserver.exe tidak ditemukan"}` jika gagal.

- [ ] **Step 1: Check start_tightvnc_portable status and report detailed error in `main.rs`**

Update VNC poll handler in `main.rs`:
```rust
                        if type_val == "vnc_start" {
                            let password = cmd_obj.get("vnc_password").and_then(|v| v.as_str()).unwrap_or("");
                            println!("Menerima perintah VNC START...");
                            
                            let mut error_msg = None;
                            if find_tvnserver_path().is_none() {
                                error_msg = Some("tvnserver.exe tidak ditemukan di folder C:\\TMBilling\\TightVNC atau folder aplikasi.");
                            } else {
                                let started = start_tightvnc_portable(password);
                                if !started {
                                    error_msg = Some("Gagal mengaktifkan tvnserver.exe atau port 5900 diblokir oleh proses lain.");
                                }
                            }

                            let vnc_ready_url = format!("{}/api/v1/public/client/vnc_ready", server_base_url.trim_end_matches('/'));
                            if let Some(err) = error_msg {
                                println!("Gagal memulai VNC: {}", err);
                                let _ = ureq::post(&vnc_ready_url)
                                    .set("X-Client-Key", api_key)
                                    .send_json(json!({
                                        "ip_address": ip_address,
                                        "mac_address": mac_address,
                                        "ready": false,
                                        "error": err
                                    }));
                            } else {
                                println!("VNC server berhasil dijalankan!");
                                let _ = ureq::post(&vnc_ready_url)
                                    .set("X-Client-Key", api_key)
                                    .send_json(json!({
                                        "ip_address": ip_address,
                                        "mac_address": mac_address,
                                        "ready": true
                                    }));
                            }
                        }
```

- [ ] **Step 2: Verify compilation**

Run: `cargo check` in `WarnetAgent/TMBilling_Monitor`
Expected: Finished with 0 errors.

- [ ] **Step 3: Build release binary**

Run: `cargo build --release` in `WarnetAgent/TMBilling_Monitor`
Expected: Finished.

- [ ] **Step 4: Copy compiled binary to Deploy folder**

Run: `Copy-Item -Path "target\release\TMMonitor.exe" -Destination "..\Deploy\TMMonitor.exe" -Force`

- [ ] **Step 5: Commit**

```bash
git add WarnetAgent/TMBilling_Monitor/src/main.rs WarnetAgent/Deploy/TMMonitor.exe
git commit -m "fix(agent): report detailed startup errors to server in fail-fast protocol"
```

---

### Task 3: Verification & Sanity Check

- [ ] **Step 1: Run complete backend pytest suite**
Run: `.venv\Scripts\python -m pytest -v`
Expected: All 40 tests pass.

- [ ] **Step 2: Final empty verification commit**
```bash
git commit --allow-empty -m "chore: complete verification for VNC fail-fast debugging fixes"
```

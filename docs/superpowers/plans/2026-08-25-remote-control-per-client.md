# Remote Control Per Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun fitur Remote Control per PC Client yang ringan, stabil, responsif, dan terintegrasi langsung di Dashboard PC Detail Modal dengan TightVNC Server portable on-demand dan Websockify proxy terpusat di server Flask.

**Architecture:** Kasir memicu remote dari Dashboard PC Detail Modal → Server Flask mengalokasikan port proxy (8090-8150) dan mengirim instruksi `vnc_start` via antrean command polling ke `TMBilling_Monitor` (Rust agent) → Agent client menyalakan `tvnserver.exe` portable dan melapor `vnc_ready` → Server Flask menjalankan Websockify proxy menuju `client_ip:5900` → Browser menghubungkan noVNC Canvas langsung di dalam modal detail PC.

**Tech Stack:** Python 3.14 / Flask (Backend & Websockify Process Manager), Rust (TMBilling_Monitor Agent), Vanilla JavaScript / noVNC RFB.js (Frontend Remote Canvas), TightVNC Server Portable (Win32).

**Spec:** [docs/superpowers/specs/2026-08-25-remote-control-per-client-design.md](file:///c:/Project%20GIT/TMBilling/docs/superpowers/specs/2026-08-25-remote-control-per-client-design.md)

## Global Constraints

- TightVNC Server di Client berjalan secara **portable** tanpa instalasi service dan tanpa startup (`C:\TMBilling\TightVNC\tvnserver.exe`).
- Proxy Websockify dikelola terpusat di server Flask dengan alokasi port dinamis (8090-8150).
- Backward compatibility 100% untuk Remote Control Server (`/remote_server`, port 8081) dan format antrean perintah `PENDING_COMMANDS`.
- Keamanan: Endpoint remote dikontrol ketat oleh `@admin_required`, dan komunikasi client dilindungi `X-Client-Key`.
- Bahasa dokumentasi dan user-facing feedback menggunakan Bahasa Indonesia yang profesional.

---

### Task 1: VNCClientProxyService Backend Implementation

**Files:**
- Create: `tests/test_vnc_client_proxy.py`
- Modify: `app/services/vnc/vnc_service.py`

**Interfaces:**
- Consumes: Python standard library (`subprocess`, `socket`, `threading`, `time`), `app.utils.logger.write_log`
- Produces: `VNCClientProxyService` with methods:
  - `allocate_port() -> int | None`
  - `start_proxy(pc_id: int, client_ip: str) -> tuple[bool, str, int | None]`
  - `stop_proxy(pc_id: int) -> tuple[bool, str]`
  - `get_proxy(pc_id: int) -> dict | None`
  - `set_vnc_ready(pc_id: int, ready: bool = True) -> None`
  - `wait_vnc_ready(pc_id: int, timeout: float = 15.0) -> bool`
  - `cleanup_stale_proxies(max_idle_seconds: int = 600) -> int`

- [ ] **Step 1: Write the failing tests for VNCClientProxyService**

Create `tests/test_vnc_client_proxy.py` testing port allocation, proxy lifecycle data structures, readiness signaling, and stale cleanup logic.

```python
import pytest
import time
from app.services.vnc.vnc_service import VNCClientProxyService

def test_port_allocation_within_range():
    port = VNCClientProxyService.allocate_port()
    assert port is not None
    assert VNCClientProxyService.PORT_RANGE_START <= port <= VNCClientProxyService.PORT_RANGE_END

def test_readiness_flag_signaling():
    pc_id = 9991
    assert VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.1) is False
    
    VNCClientProxyService.set_vnc_ready(pc_id, True)
    assert VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5) is True
    
    VNCClientProxyService.set_vnc_ready(pc_id, False)
    assert VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.1) is False

def test_proxy_lifecycle_tracking():
    pc_id = 9992
    VNCClientProxyService._active_proxies[pc_id] = {
        "port": 8095,
        "client_ip": "192.168.1.50",
        "process": None,
        "started_at": time.time()
    }
    
    proxy = VNCClientProxyService.get_proxy(pc_id)
    assert proxy is not None
    assert proxy["port"] == 8095
    assert proxy["client_ip"] == "192.168.1.50"
    
    success, msg = VNCClientProxyService.stop_proxy(pc_id)
    assert success is True
    assert VNCClientProxyService.get_proxy(pc_id) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_vnc_client_proxy.py -v`
Expected: FAIL with `AttributeError: type object 'VNCClientProxyService' has no attribute...` or `ImportError`

- [ ] **Step 3: Implement VNCClientProxyService in `app/services/vnc/vnc_service.py`**

Add `VNCClientProxyService` class with thread-safe lock, port pool allocation (8090-8150), websockify process spawning (`subprocess.Popen([sys.executable, "-m", "websockify", f"0.0.0.0:{port}", f"{client_ip}:5900"])`), readiness condition variables, and termination routines.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_vnc_client_proxy.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/services/vnc/vnc_service.py tests/test_vnc_client_proxy.py
git commit -m "feat(vnc): implement VNCClientProxyService for dynamic client websockify management"
```

---

### Task 2: Client Service & Command Protocol Extension

**Files:**
- Create: `tests/test_client_vnc_commands.py`
- Modify: `app/services/client/client_service.py`
- Modify: `app/routes/client/client_routes.py`

**Interfaces:**
- Consumes: `app.services.vnc.vnc_service.VNCClientProxyService`, `app.repositories.PCRepository`
- Produces:
  - `ClientService.queue_command(pc_id, command)` supporting both `str` and `dict`
  - `POST /api/v1/client/vnc_ready` (Agent signals VNC server port 5900 is listening)
  - `POST /api/v1/client/vnc_stopped` (Agent signals VNC server port 5900 is stopped)

- [ ] **Step 1: Write the failing tests for command protocol and readiness endpoints**

Create `tests/test_client_vnc_commands.py` validating that dict commands serialize properly in `/api/v1/client/status`, string commands remain backward-compatible, and `/api/v1/client/vnc_ready` updates the readiness state.

```python
import pytest
from app import create_app, db
from app.models import PC, Grup
from app.services.client.client_service import ClientService, PENDING_COMMANDS
from app.services.vnc.vnc_service import VNCClientProxyService

@pytest.fixture
def client_app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        grup = Grup(nama="VIP", tarif_per_jam=5000)
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        yield app.test_client(), pc.id
        db.session.remove()
        db.drop_all()

def test_queue_command_dict_payload(client_app):
    client, pc_id = client_app
    cmd_payload = {"type": "vnc_start", "vnc_password": "secret_vnc_pass"}
    ClientService.queue_command(pc_id, cmd_payload)
    
    headers = {"X-Client-Key": "TM2026QWERTY-api-key"}
    res = client.post("/api/v1/client/status", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("command") == cmd_payload

def test_vnc_ready_endpoint(client_app):
    client, pc_id = client_app
    headers = {"X-Client-Key": "TM2026QWERTY-api-key"}
    res = client.post("/api/v1/client/vnc_ready", json={"ip_address": "192.168.1.101", "ready": True}, headers=headers)
    assert res.status_code == 200
    assert VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_client_vnc_commands.py -v`
Expected: FAIL (404 on `/api/v1/client/vnc_ready`)

- [ ] **Step 3: Update `app/services/client/client_service.py` and `app/routes/client/client_routes.py`**

- Ensure `PENDING_COMMANDS` pop returns either dict or string directly.
- Add route `POST /api/v1/client/vnc_ready` with `@api_key_required` to map client IP/MAC to `pc.id` and call `VNCClientProxyService.set_vnc_ready(pc.id, ready)`.
- Add route `POST /api/v1/client/vnc_stopped` with `@api_key_required` to notify stopping.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_client_vnc_commands.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/services/client/client_service.py app/routes/client/client_routes.py tests/test_client_vnc_commands.py
git commit -m "feat(client): add vnc_ready status endpoint and structured command queue support"
```

---

### Task 3: Monitor Routes for Remote Control per Client

**Files:**
- Create: `tests/test_monitor_vnc_routes.py`
- Modify: `app/routes/monitor/monitor_routes.py`

**Interfaces:**
- Consumes: `app.services.vnc.vnc_service.VNCClientProxyService`, `app.services.client.client_service.ClientService`, `app.repositories.PCRepository`, `app.services.settings.settings_service.SettingsService`
- Produces:
  - `POST /api/v1/kasir/monitor/remote/<int:pc_id>/vnc_start`
  - `POST /api/v1/kasir/monitor/remote/<int:pc_id>/vnc_stop`
  - `GET /api/v1/kasir/monitor/remote/<int:pc_id>/vnc_status`

- [ ] **Step 1: Write the failing tests for monitor VNC routes**

Create `tests/test_monitor_vnc_routes.py` testing permissions (`@admin_required`), valid starting sequence, stopping sequence, and status querying.

```python
import pytest
from app import create_app, db
from app.models import PC, Grup, User
from app.services.vnc.vnc_service import VNCClientProxyService

@pytest.fixture
def admin_client():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        grup = Grup(nama="VIP", tarif_per_jam=5000)
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-02", ip_address="192.168.1.102", mac_address="AA:BB:CC:DD:EE:02", grup_id=grup.id)
        admin = User(username="admin", role="admin")
        admin.set_password("admin123")
        db.session.add_all([pc, admin])
        db.session.commit()
        
        client = app.test_client()
        with client.session_transaction() as sess:
            sess["kasir_user_id"] = admin.id
            sess["kasir_username"] = "admin"
            sess["kasir_role"] = "admin"
            
        yield client, pc.id
        db.session.remove()
        db.drop_all()

def test_vnc_start_non_admin_forbidden(admin_client):
    client, pc_id = admin_client
    with client.session_transaction() as sess:
        sess["kasir_role"] = "kasir"  # Non-admin
        
    res = client.post(f"/api/v1/kasir/monitor/remote/{pc_id}/vnc_start")
    assert res.status_code == 403

def test_vnc_status_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.get(f"/api/v1/kasir/monitor/remote/{pc_id}/vnc_status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["active"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_monitor_vnc_routes.py -v`
Expected: FAIL (404 on endpoint)

- [ ] **Step 3: Implement monitor VNC endpoints in `app/routes/monitor/monitor_routes.py`**

- `vnc_start`: Validate PC exists & online. Queue command `{"type": "vnc_start", "vnc_password": vnc_password}` via `ClientService.queue_command(pc.id, ...)`. In a helper or background check, spawn websockify proxy via `VNCClientProxyService.start_proxy(pc.id, pc.ip_address)` once ready or on-demand. Return `{ success: True, listen_port: port, vnc_password: vnc_password, pc_kode: pc.kode }`.
- `vnc_stop`: Queue `{"type": "vnc_stop"}` to client, call `VNCClientProxyService.stop_proxy(pc.id)`.
- `vnc_status`: Return current active proxy status and port for the PC.
- Add audit logging via `write_log`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_monitor_vnc_routes.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add app/routes/monitor/monitor_routes.py tests/test_monitor_vnc_routes.py
git commit -m "feat(monitor): add vnc_start, vnc_stop, and vnc_status routes for remote client control"
```

---

### Task 4: TMBilling_Monitor (Rust Agent) On-Demand TightVNC Handler

**Files:**
- Modify: `WarnetAgent/TMBilling_Monitor/src/main.rs`

**Interfaces:**
- Consumes: Win32 process execution, TCP socket connection check, ureq HTTP client
- Produces:
  - Command interpreter for `vnc_start` and `vnc_stop` (handling JSON command object and string)
  - Portable launcher for `C:\TMBilling\TightVNC\tvnserver.exe`
  - Port 5900 verification loop (max 5s)
  - HTTP callback to `/api/v1/client/vnc_ready` and `/api/v1/client/vnc_stopped`

- [ ] **Step 1: Check existing command handling in `WarnetAgent/TMBilling_Monitor/src/main.rs`**

Review how `TMBilling_Monitor` polls server status and executes system commands (e.g. screenshot, reboot, shutdown).

- [ ] **Step 2: Add portable TightVNC helper functions in `main.rs`**

Add functions in `WarnetAgent/TMBilling_Monitor/src/main.rs`:
```rust
fn find_tvnserver_path() -> Option<std::path::PathBuf> {
    let standard = std::path::PathBuf::from(r"C:\TMBilling\TightVNC\tvnserver.exe");
    if standard.exists() {
        return Some(standard);
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

fn is_port_open_local(port: u16) -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

fn start_tightvnc_portable() -> bool {
    if is_port_open_local(5900) {
        return true;
    }
    if let Some(tvn_path) = find_tvnserver_path() {
        let mut tvn_dir = tvn_path.clone();
        tvn_dir.pop();
        
        let _ = Command::new(&tvn_path)
            .args(&["-run", "-rfbport", "5900"])
            .current_dir(&tvn_dir)
            .creation_flags(0x08000000 | 0x00000008 | 0x01000000)
            .spawn();
            
        for _ in 0..10 {
            thread::sleep(Duration::from_millis(500));
            if is_port_open_local(5900) {
                return true;
            }
        }
    }
    false
}

fn stop_tightvnc_portable() {
    // Kill tvnserver.exe process quietly
    let _ = Command::new("taskkill")
        .args(&["/F", "/IM", "tvnserver.exe"])
        .creation_flags(0x08000000)
        .output();
}
```

- [ ] **Step 3: Integrate with Polling Loop in `main.rs`**

Handle command received from `/api/v1/client/status`:
- If command contains `"vnc_start"`: call `start_tightvnc_portable()`, then send POST `/api/v1/client/vnc_ready` with `{ "ip_address": my_ip, "ready": true }`.
- If command contains `"vnc_stop"`: call `stop_tightvnc_portable()`, then send POST `/api/v1/client/vnc_stopped` with `{ "ip_address": my_ip, "ready": false }`.

- [ ] **Step 4: Verify agent compilation with Cargo**

Run: `cargo check` in `WarnetAgent/TMBilling_Monitor`
Expected: Zero compilation errors.

- [ ] **Step 5: Commit changes**

```bash
git add WarnetAgent/TMBilling_Monitor/src/main.rs
git commit -m "feat(agent): add on-demand portable TightVNC launch and stop command handler"
```

---

### Task 5: Frontend VNC Client Modularization & Coordinate/Scaling Engine

**Files:**
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`

**Interfaces:**
- Consumes: noVNC RFB.js library (`@novnc/novnc@1.4.0`)
- Produces:
  - `VNCClient.connect()` (Legacy/Server Remote tab compatibility)
  - `VNCClient.createSession(options)` or parameterized `connectTo(options)` supporting multiple instances/modals:
    - `screenContainer`: DOM element to mount canvas
    - `wsUrl`: WebSocket endpoint (`ws://...` or `wss://...`)
    - `password`: VNC authentication password
    - `scaleViewport`: boolean (true = Fit, false = 1:1)
    - callbacks: `onConnect`, `onDisconnect`, `onError`, `onResolution`

- [ ] **Step 1: Inspect and refactor `vnc_client.js` structure**

Extract instance state from static singleton into a reusable `VNCSession` class or instance manager so both Server Remote tab and Modal Remote can run cleanly without crosstalk.

- [ ] **Step 2: Implement precision coordinate transformation & scaling logic**

Ensure:
- Mode Scaling ON: CSS letterbox/pillarbox compensated, `scaleViewport = true`, mouse coordinates mapped via `(clientX - rect.left) / scale`.
- Mode Scaling OFF: `scaleViewport = false`, container `overflow-auto scrollbar-mono`, mouse coordinates mapped directly via `clientX - rect.left` + scroll offset.
- Modifier Keys (Ctrl, Alt, Win, Shift): send discrete keydown/keyup on press/release or latching mode with visual state.
- Mobile Touch: pinch-zoom updates transform matrix without dispatching stray mouse clicks; single tap & double tap dispatch synthesized mouse events accurately.

- [ ] **Step 3: Ensure backward compatibility for `VNCClient.connect()`**

Verify `VNCClient.connect()`, `VNCClient.disconnect()`, and server tab elements (`#tab-remote_server`) work seamlessly using the new session engine.

- [ ] **Step 4: Commit changes**

```bash
git add app/static/js/kasir/modules/remote/vnc_client.js
git commit -m "refactor(vnc): modularize VNC client session engine with accurate coordinate scaling"
```

---

### Task 6: Dashboard Detail Modal UI Integration

**Files:**
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`

**Interfaces:**
- Consumes: `API.request('/api/v1/kasir/monitor/remote/.../vnc_start')`, `VNCClient`, `Modal`, `Toast`
- Produces:
  - Active "Remote Layar" button in action menu grid for online PCs
  - Embedded remote control panel view `#view-remote-client` inside `DashboardDetailModal`
  - Controls: Fit/1:1 toggle, Virtual Keyboard toggle, Fullscreen, Disconnect button
  - State management: `actionMenu` ↔ `remoteView` with proper cleanup on modal close

- [ ] **Step 1: Replace disabled placeholder with active Remote button in `dashboard_detail_modal.js`**

Change line 42 in `dashboard_detail_modal.js`:
For online PCs (`isOnline === true`), render:
```html
<button onclick="DashboardDetailModal.startRemote(${pc.id}, '${pc.kode}')"
    class="flex flex-col items-center gap-2 p-4 bg-[#0a1520] border border-blue-900/40 hover:border-blue-500/60 hover:bg-[#0d1d2c] rounded-lg transition-colors">
    <div class="w-9 h-9 rounded-lg bg-blue-950/50 border border-blue-900/50 flex items-center justify-center">
        <svg class="w-[18px] h-[18px] text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
    </div>
    <span class="text-[10px] lg:text-base font-bold text-blue-400 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
</button>
```

- [ ] **Step 2: Add Remote View container in `dashboard_detail_modal.js` HTML template**

Add `#view-remote-client` sibling to `#view-action-menu` and `#view-process-list`:
- Header with PC title, resolution HUD badge (`#modal-vnc-resolution`), and Back/Disconnect button.
- Canvas container (`#modal-vnc-container` & `#modal-vnc-screen`) with loading indicator.
- Toolbar: Scaling mode toggle (`Fit Layar` / `1:1 Asli`), Fullscreen button, Virtual Keyboard toggle, Disconnect button.
- Embed virtual keyboard dock for mobile/tablet kasir use.

- [ ] **Step 3: Implement `startRemote(pcId, pcKode)` and `stopRemote(pcId)` functions**

```javascript
startRemote: async function(pcId, pcKode) {
    // 1. Expand modal size for widescreen remote view
    // 2. Show loading spinner in remote container
    // 3. POST /api/v1/kasir/monitor/remote/<pcId>/vnc_start
    // 4. Connect via VNCClient session
    // 5. Setup auto-cleanup on Modal.close
},
stopRemote: async function(pcId) {
    // 1. Disconnect VNC session
    // 2. POST /api/v1/kasir/monitor/remote/<pcId>/vnc_stop
    // 3. Return modal to standard size & action menu view
}
```

- [ ] **Step 4: Add modal close hook to stop remote proxy**

Ensure that if kasir closes the modal (`&times;` or clicking backdrop or `ESC`), `stopRemote()` is automatically called to avoid leaving dangling websockify / tvnserver processes.

- [ ] **Step 5: Commit changes**

```bash
git add app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js
git commit -m "feat(dashboard): integrate Remote Control per client into PC Detail Modal"
```

---

### Task 7: End-to-End Verification & Test Suite Execution

**Files:**
- Test files: `tests/`
- Agent: `WarnetAgent/TMBilling_Monitor/`

- [ ] **Step 1: Run complete backend test suite**

Run: `.venv\Scripts\python -m pytest -v`
Expected: All tests pass (32 existing + new VNC tests, 0 failures).

- [ ] **Step 2: Verify Rust agent build**

Run: `cargo build` in `WarnetAgent/TMBilling_Monitor`
Expected: Successful build.

- [ ] **Step 3: Verify JS syntax & bundling**

Check that `vnc_client.js` and `dashboard_detail_modal.js` have valid syntax and no console errors.

- [ ] **Step 4: Final commit & tag if appropriate**

```bash
git commit --allow-empty -m "chore: complete verification for Remote Control per Client feature"
```

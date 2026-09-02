# VNC Token Multiplexing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki masalah Remote PC Client yang terdeteksi sebagai Remote PC Server saat menggunakan Cloudflare Tunnel / HTTPS dengan mengimplementasikan Token-Based Target Multiplexing pada Websockify.

**Architecture:** Menggunakan satu daemon Websockify terpusat pada Port 8081 dengan plugin `TokenFile` (`instance/vnc_tokens.cfg`). Setiap sesi Remote Server dan Remote Client mendaftarkan target endpoint (`server: 127.0.0.1:5900` atau `client_<id>: <client_ip>:5900`) ke dalam file konfigurasi token. Frontend noVNC menghubungkan WebSocket dengan query parameter `?token=...` sehingga satu port 8081 / subpath `/ws/vnc` dapat merutekan traffic ke PC yang tepat secara akurat di jaringan lokal maupun tunnel.

**Tech Stack:** Python 3.14 (Flask, Websockify TokenPlugin), Vanilla JS (noVNC RFB.js), Pytest.

**Spec:** `docs/superpowers/specs/2026-08-28-tunnel-vnc-token-multiplexing-design.md`

## Global Constraints

- Kompatibel penuh dengan koneksi Direct LAN (HTTP) dan Tunnel (HTTPS).
- Menghilangkan kebutuhan alokasi port dinamis 8090-8150 dan pembukaan banyak port di firewall.
- Menjaga thread-safety saat memodifikasi file `instance/vnc_tokens.cfg`.
- Seluruh tes backend (41+ tests) wajib lulus 100%.

---

### Task 1: Token File Management in `VNCService` & `VNCClientProxyService`

**Files:**
- Modify: `app/services/vnc/vnc_service.py`
- Test: `tests/test_vnc_client_proxy.py`

**Interfaces:**
- Consumes: Python standard libraries (`os`, `threading`, `time`)
- Produces:
  - `VNCService.TOKEN_FILE_PATH` -> Path ke file `instance/vnc_tokens.cfg`
  - `VNCService.set_token(token: str, host: str, port: int) -> None`
  - `VNCService.remove_token(token: str) -> None`
  - `VNCService.ensure_default_tokens() -> None` (mendaftarkan `server: 127.0.0.1:5900`)
  - `VNCClientProxyService.start_proxy(pc_id: int, client_ip: str) -> tuple[bool, str, int, str]` (mengembalikan `(success, msg, 8081, token)`)
  - `VNCClientProxyService.stop_proxy(pc_id: int) -> tuple[bool, str]`

- [ ] **Step 1: Write unit tests for Token File Management**

Update `tests/test_vnc_client_proxy.py`:
```python
import pytest
import os
import time
from app.services.vnc.vnc_service import VNCService, VNCClientProxyService

def test_token_file_management(tmp_path):
    token_file = str(tmp_path / "vnc_tokens.cfg")
    VNCService.TOKEN_FILE_PATH = token_file
    
    # 1. Pastikan token server terdaftar
    VNCService.ensure_default_tokens()
    with open(token_file, "r") as f:
        content = f.read()
    assert "server: 127.0.0.1:5900" in content

    # 2. Tambah token client
    VNCService.set_token("client_1", "192.168.1.101", 5900)
    with open(token_file, "r") as f:
        content = f.read()
    assert "client_1: 192.168.1.101:5900" in content

    # 3. Hapus token client
    VNCService.remove_token("client_1")
    with open(token_file, "r") as f:
        content = f.read()
    assert "client_1" not in content
    assert "server: 127.0.0.1:5900" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python -m pytest tests/test_vnc_client_proxy.py -k test_token_file_management -v`
Expected: FAIL with missing attributes or methods.

- [ ] **Step 3: Implement Token File Management in `vnc_service.py`**

Tambahkan fungsi-fungsi token file management thread-safe di `VNCService` dan perbarui `VNCClientProxyService.start_proxy` / `stop_proxy`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python -m pytest tests/test_vnc_client_proxy.py -v`
Expected: PASS.

---

### Task 2: Launch Websockify with TokenFile Plugin in `VNCService`

**Files:**
- Modify: `app/services/vnc/vnc_service.py`

**Interfaces:**
- Consumes: `sys.executable`, `subprocess.Popen`, `VNCService.TOKEN_FILE_PATH`
- Produces: `VNCService.ensure_websockify_running()` dengan argumen `--token-plugin=TokenFile --token-source=<TOKEN_FILE_PATH> 0.0.0.0:8081`

- [ ] **Step 1: Update `ensure_websockify_running` command**

Ubah perintah `cmd` di `VNCService.ensure_websockify_running`:
```python
cls.ensure_default_tokens()
cmd = [
    sys.executable, "-m", "websockify",
    "--token-plugin=TokenFile",
    f"--token-source={cls.TOKEN_FILE_PATH}",
    f"0.0.0.0:{cls.LISTEN_PORT}"
]
```

- [ ] **Step 2: Update `VNCClientProxyService.start_proxy`**

Alih-alih menjalankan proses websockify baru per client, `VNCClientProxyService.start_proxy`:
1. Memastikan websockify utama aktif (`VNCService.ensure_websockify_running()`).
2. Mendaftarkan token `client_{pc_id}: {client_ip}:5900` via `VNCService.set_token()`.
3. Mengembalikan `(True, "Proxy aktif", 8081, f"client_{pc_id}")`.

- [ ] **Step 3: Update `VNCClientProxyService.stop_proxy`**

1. Menghapus token `client_{pc_id}` via `VNCService.remove_token()`.
2. Mengirim sinyal `vnc_stop` ke client.

- [ ] **Step 4: Verify with pytest**

Run: `.venv\Scripts\python -m pytest tests/test_vnc_client_proxy.py -v`
Expected: PASS.

---

### Task 3: Backend API Routes Token Support

**Files:**
- Modify: `app/routes/vnc/vnc_routes.py`
- Modify: `app/routes/monitor/monitor_routes.py`
- Test: `tests/test_monitor_vnc_routes.py`

**Interfaces:**
- Consumes: `VNCService`, `VNCClientProxyService`
- Produces: JSON responses containing `token: str` dan `listen_port: 8081`

- [ ] **Step 1: Update `app/routes/vnc/vnc_routes.py`**

Tambahkan `token: "server"` ke response `/api/v1/kasir/vnc/start`:
```python
return jsonify({
    "success": True,
    "message": msg,
    "listen_port": VNCService.LISTEN_PORT,
    "token": "server",
    "vnc_password": vnc_password
})
```

- [ ] **Step 2: Update `app/routes/monitor/monitor_routes.py`**

Perbarui response `start_vnc_client`:
```python
success, msg, port, token = VNCClientProxyService.start_proxy(pc.id, pc.ip_address)
...
return jsonify({
    "success": True,
    "message": "Remote control berhasil disiapkan",
    "port": port,
    "token": token,
    "vnc_password": vnc_password,
    "pc_kode": pc.kode
}), 200
```

- [ ] **Step 3: Update unit tests in `tests/test_monitor_vnc_routes.py`**

Periksa assertion response route agar mencakup `token`.

- [ ] **Step 4: Run pytest on monitor routes**

Run: `.venv\Scripts\python -m pytest tests/test_monitor_vnc_routes.py -v`
Expected: PASS.

---

### Task 4: Frontend WebSocket URL Construction with Token

**Files:**
- Modify: `app/static/js/kasir/modules/remote/vnc_client.js`
- Modify: `app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js`

**Interfaces:**
- Consumes: API response `startRes.token`, `startRes.listen_port` / `res.port`
- Produces: Correct WebSocket URLs containing `?token=...`

- [ ] **Step 1: Update `vnc_client.js` (Remote Server tab)**

Ubah logika pembuatan URL:
```javascript
const token = (startRes && startRes.token) || 'server';
let url;
if (window.location.protocol === 'https:') {
    url = `wss://${window.location.host}/ws/vnc?token=${encodeURIComponent(token)}`;
} else {
    url = `ws://${window.location.hostname}:${listenPort}/?token=${encodeURIComponent(token)}`;
}
```

- [ ] **Step 2: Update `dashboard_detail_modal.js` (Remote Client modal)**

Ubah baris 456–462 di `dashboard_detail_modal.js`:
```javascript
const token = res.token || `client_${pcId}`;
const port = res.port || 8081;
let url;
if (window.location.protocol === 'https:') {
    url = `wss://${window.location.host}/ws/vnc?token=${encodeURIComponent(token)}`;
} else {
    url = `ws://${window.location.hostname}:${port}/?token=${encodeURIComponent(token)}`;
}
```

---

### Task 5: Full Regression Testing & Verification

**Files:**
- Run complete test suite: `tests/`

- [ ] **Step 1: Run pytest across the entire project**

Run: `.venv\Scripts\python -m pytest -v`
Expected: All 41+ tests pass without errors.

- [ ] **Step 2: Build CSS assets if necessary**

Run: `npm run build:css`
Expected: Success.

- [ ] **Step 3: Verification of Direct and Tunnel Connection URLs**

Verifikasi bahwa pada mode direct (HTTP) maupun tunnel (HTTPS), URL yang dihasilkan mengarah ke token yang tepat (`?token=server` untuk server, dan `?token=client_<id>` untuk client).

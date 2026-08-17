# Full Audit Log Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menginstrumentasi log audit terstruktur (`write_log`) dengan canonical schema JSON Lines ke seluruh endpoint, service, remote control, otentikasi, konfigurasi metode pembayaran, master data, dan pembersihan log di TMBilling.

**Architecture:** Menerapkan pencatatan log berbasis *service-layer* dan *route-layer* dengan parameter `operator` dan metadata `detail_json` terstruktur, memastikan integritas *audit trail* tanpa *blind spots*.

**Tech Stack:** Python 3.14, Flask, SQLite, Pytest.

**Spec:** `docs/superpowers/specs/2026-08-15-full-audit-log-overhaul-design.md`

## Global Constraints
- Seluruh pencatatan log audit wajib menggunakan `app.utils.logger.write_log(aksi, detail, user, detail_json)`.
- Metadata `detail_json` wajib berupa `dict` valid serializable.
- Backward compatibility dengan frontend log formatter dan format JSONL existing harus dipertahankan.

---

### Task 1: Konfigurasi Pembayaran & Pengaturan Sistem (Settings & Payment Methods Logging)

**Files:**
- Modify: `app/routes/settings/settings_routes.py`
- Modify: `app/services/settings/settings_service.py`
- Test: `tests/test_audit_settings_logging.py`

**Interfaces:**
- Consumes: `write_log(aksi, detail, user, detail_json)`
- Produces: Log audit event `PAYMENT_METHOD_CONFIG`, `SETTINGS_AUTO_SHUTDOWN`, `SETTINGS_UPDATE`, `SETTINGS_QRIS_CHANGE`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audit_settings_logging.py
import pytest
import json
from app import create_app
from app.utils.logger import LOG_FILE

def test_settings_and_payment_methods_logging():
    app = create_app()
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_username"] = "admin_test"
        sess["kasir_role"] = "admin"

    # 1. Test update auto shutdown
    res = client.put("/api/v1/kasir/settings/auto-shutdown", json={"timer_seconds": 240})
    assert res.status_code == 200

    # 2. Test update generic setting / payment methods
    res = client.put("/api/v1/kasir/settings/payment_methods", json={"value": "Tunai,QRIS,Transfer Bank,Debit"})
    assert res.status_code == 200

    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
    actions = [l["action"] for l in logs]
    assert "SETTINGS_AUTO_SHUTDOWN" in actions
    assert "PAYMENT_METHOD_CONFIG" in actions or "SETTINGS_UPDATE" in actions
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_settings_logging.py -v`
Expected: FAIL (actions not found in logs)

- [ ] **Step 3: Write minimal implementation**

Di `app/routes/settings/settings_routes.py`:
Tambahkan `write_log` pada endpoint `update_auto_shutdown`, `update_setting`, dan lengkapi `upload_qris`:
```python
# update_auto_shutdown:
old_val = SettingsService.get("auto_shutdown_timer_seconds", "180")
SettingsService.set("auto_shutdown_timer_seconds", str(timer_seconds))
operator = session.get("kasir_username", "admin")
write_log(
    "SETTINGS_AUTO_SHUTDOWN",
    f"Timer auto-shutdown diubah dari {old_val}s menjadi {timer_seconds}s",
    user=operator,
    detail_json={"timer_sebelum": old_val, "timer_baru": timer_seconds}
)

# update_setting:
old_val = SettingsService.get(key, "-")
SettingsService.set(key, str(value))
operator = session.get("kasir_username", "admin")
action_name = "PAYMENT_METHOD_CONFIG" if key == "payment_methods" else "SETTINGS_UPDATE"
write_log(
    action_name,
    f"Pengaturan '{key}' diperbarui",
    user=operator,
    detail_json={"key": key, "old_value": old_val, "new_value": value}
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_settings_logging.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_audit_settings_logging.py app/routes/settings/settings_routes.py
git commit -m "feat(settings): instrument audit logging for payment methods and configuration updates"
```

---

### Task 2: Autentikasi Web & Klien (Auth & Client Bypass Logging)

**Files:**
- Modify: `app/services/auth/auth_kasir_service.py`
- Modify: `app/services/client/client_service.py`
- Test: `tests/test_audit_auth_client_logging.py`

**Interfaces:**
- Consumes: `write_log(aksi, detail, user, detail_json)`
- Produces: Log audit event `LOGIN`, `LOGOUT`, `LOGIN_GAGAL`, `CLIENT_ADMIN_LOGIN`, `ADMIN_CHECK_SUCCESS`, `ADMIN_CHECK_FAILED`, `ADMIN_CHECK_DENIED`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audit_auth_client_logging.py
import pytest
import json
from app import create_app
from app.services.auth.auth_kasir_service import AuthKasirService
from app.services.client.client_service import ClientService
from app.utils.logger import LOG_FILE

def test_auth_and_client_admin_login_logging():
    app = create_app()
    with app.app_context():
        # Test validate admin check
        try:
            AuthKasirService.validate_admin("invalid_user", "wrong_pass")
        except ValueError:
            pass

        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

        logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
        actions = [l["action"] for l in logs]
        assert "ADMIN_CHECK_FAILED" in actions
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_auth_client_logging.py -v`
Expected: FAIL atau missing fields

- [ ] **Step 3: Write minimal implementation**

Lengkapi `AuthKasirService` dan `ClientService.admin_login` dengan `write_log` terstruktur:
```python
# app/services/auth/auth_kasir_service.py:
write_log("LOGIN", f"Kasir:{username} ({user.nama_lengkap or ''}) login", user=username, detail_json={"role": user.role, "nama_lengkap": user.nama_lengkap})
write_log("LOGOUT", f"Kasir {username} logout", user=username, detail_json={"username": username})
write_log("LOGIN_GAGAL", f"Username:{username} - Password salah / tidak ditemukan", user=username, detail_json={"attempted_username": username})

# app/services/client/client_service.py::admin_login:
write_log(
    "CLIENT_ADMIN_LOGIN",
    f"Admin {username} login langsung di PC {pc.kode}",
    user=username,
    detail_json={"pc_kode": pc.kode, "ip_address": ip_address, "mac_address": mac_address, "admin_user": username}
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_auth_client_logging.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_audit_auth_client_logging.py app/services/auth/auth_kasir_service.py app/services/client/client_service.py
git commit -m "feat(auth): standardize auth audit events and client admin bypass logging"
```

---

### Task 3: Remote Control, Hardware Monitor & VNC (Remote Actions & VNC Logging)

**Files:**
- Modify: `app/routes/monitor/monitor_routes.py`
- Modify: `app/routes/vnc/vnc_routes.py`
- Test: `tests/test_audit_remote_logging.py`

**Interfaces:**
- Consumes: `write_log(aksi, detail, user, detail_json)`
- Produces: Log audit event `REMOTE_KILL`, `REMOTE_ACTION`, `REMOTE_SCREENSHOT_TRIGGER`, `VNC_START`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audit_remote_logging.py
import pytest
import json
from app import create_app
from app.utils.logger import LOG_FILE

def test_remote_actions_logging():
    app = create_app()
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_username"] = "admin_remote"
        sess["kasir_role"] = "admin"

    res = client.post("/api/v1/kasir/vnc/start")
    
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
    actions = [l["action"] for l in logs]
    assert "VNC_START" in actions or res.status_code in [200, 400]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_remote_logging.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Di `app/routes/monitor/monitor_routes.py`:
```python
# trigger_screenshot:
operator = session.get("kasir_username", "admin")
write_log("REMOTE_SCREENSHOT_TRIGGER", f"Permintaan Screenshot dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode})

# kill_pc_process:
operator = session.get("kasir_username", "admin")
write_log("REMOTE_KILL", f"Perintah Kill Process '{process_name}' dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "process_name": process_name})

# trigger_remote_action:
operator = session.get("kasir_username", "admin")
write_log("REMOTE_ACTION", f"Perintah {action_label} dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "action": action})
```

Di `app/routes/vnc/vnc_routes.py`:
```python
# start_vnc_proxy:
from app.utils.logger import write_log
operator = session.get("kasir_username", "admin")
write_log("VNC_START", f"Proxy Websockify VNC dijalankan pada port {VNCService.LISTEN_PORT}", user=operator, detail_json={"listen_port": VNCService.LISTEN_PORT, "status": success})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_remote_logging.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_audit_remote_logging.py app/routes/monitor/monitor_routes.py app/routes/vnc/vnc_routes.py
git commit -m "feat(remote): instrument audit logs for remote actions, screenshots, and VNC proxy"
```

---

### Task 4: Master Data Turnamen & Game Launcher (Tournament & Game CRUD Logging)

**Files:**
- Modify: `app/services/tournament/tournament_service.py`
- Modify: `app/services/game/game_service.py`
- Test: `tests/test_audit_tournament_game_logging.py`

**Interfaces:**
- Consumes: `write_log(aksi, detail, user, detail_json)`
- Produces: Log audit event `TOURNAMENT_CREATE`, `TOURNAMENT_SCORE_UPDATE`, `TOURNAMENT_STAGE_UPDATE`, `TOURNAMENT_DELETE`, `GAME_CREATE`, `GAME_UPDATE`, `GAME_DELETE`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audit_tournament_game_logging.py
import pytest
import json
from app import create_app
from app.services.tournament.tournament_service import TournamentService
from app.services.game.game_service import GameService
from app.utils.logger import LOG_FILE

def test_tournament_and_game_logging():
    app = create_app()
    with app.app_context():
        # Test Tournament creation logging
        try:
            t = TournamentService.create_tournament({
                "nama": "Turnamen Audit Test 2026",
                "teams": ["Tim A", "Tim B"],
                "tipe_jalur": "playoff"
            })
            TournamentService.delete_tournament(t["tournament_id"])
        except Exception:
            pass

        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

        logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
        actions = [l["action"] for l in logs]
        assert "TOURNAMENT_CREATE" in actions
        assert "TOURNAMENT_DELETE" in actions
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_tournament_game_logging.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Di `app/services/tournament/tournament_service.py`:
Tambahkan `write_log` pada `create_tournament`, `update_match_skor`, `next_swiss_round`, `finish_stage`, dan `delete_tournament`.

Di `app/services/game/game_service.py`:
Tambahkan `write_log` pada `create`, `update`, dan `delete`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_tournament_game_logging.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_audit_tournament_game_logging.py app/services/tournament/tournament_service.py app/services/game/game_service.py
git commit -m "feat(tournament-game): add audit logging for tournament management and game catalog"
```

---

### Task 5: Keamanan IP Whitelist, Backup, Pembersihan & Test Coverage Komprehensif

**Files:**
- Modify: `app/routes/settings/settings_routes.py`
- Modify: `app/routes/backup/backup_routes.py`
- Modify: `app/services/report/log_audit_service.py`
- Modify: `tools/seed_audit_logs.py`
- Create: `tests/test_audit_logging_coverage.py`

**Interfaces:**
- Consumes: All audit logging endpoints & services
- Produces: Complete audit trail test verification across all 10 domains

- [ ] **Step 1: Write the failing test**

```python
# tests/test_audit_logging_coverage.py
import pytest
import json
from app import create_app
from tools.seed_audit_logs import seed_logs
from app.services.report.log_audit_service import LogAuditService

def test_full_coverage_of_audit_logging():
    app = create_app()
    with app.app_context():
        seed_logs(include_legacy=True)
        logs_data = LogAuditService.get_system_logs(limit=1000)
        logs = logs_data["logs"]
        
        actions = {l["action"] for l in logs if l.get("action")}
        required_actions = {
            "PAYMENT_METHOD_CONFIG", "SETTINGS_AUTO_SHUTDOWN", "LOGIN", "CLIENT_ADMIN_LOGIN",
            "REMOTE_KILL", "VNC_START", "TOURNAMENT_CREATE", "GAME_CREATE", "IP_WHITELIST_ADD",
            "CLEAR_LOG", "BLACKOUT_DETECT", "TRANSAKSI_MENU", "TAMBAH_MEMBER"
        }
        for req in required_actions:
            assert req in actions, f"Missing required action: {req}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_audit_logging_coverage.py -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

1. Tambahkan `write_log` pada `add_whitelist_ip`, `remove_whitelist_ip`, dan `regenerate_whitelist_token` di `app/routes/settings/settings_routes.py`.
2. Tambahkan `write_log` pada `test_connection` di `app/routes/backup/backup_routes.py`.
3. Perbaiki field `tipe_pembayaran` -> `metode_pembayaran` pada `delete_transaction` di `app/services/report/log_audit_service.py`.
4. Update `tools/seed_audit_logs.py` untuk menyuntikkan seluruh aksi audit baru.

- [ ] **Step 4: Run test to verify it passes**

Run: `.\.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS (all tests pass 100%)

- [ ] **Step 5: Commit**

```bash
git add app/routes/settings/settings_routes.py app/routes/backup/backup_routes.py app/services/report/log_audit_service.py tools/seed_audit_logs.py tests/test_audit_logging_coverage.py
git commit -m "feat(security-backup): complete IP whitelist, backup integration logging, and full test suite"
```

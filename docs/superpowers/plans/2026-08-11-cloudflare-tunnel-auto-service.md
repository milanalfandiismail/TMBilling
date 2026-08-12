# Otomatisasi Cloudflare Tunnel (Token-based Auto-Service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur integrasi Cloudflare Tunnel berbasis token di TMBilling sebagai **subtab/sidebar terisolasi tersendiri** (`🌐 Cloudflare Tunnel`), sehingga admin cukup memasukkan Token Cloudflare Zero Trust dan TMBilling secara otomatis mengunduh `cloudflared.exe` (bila belum ada), mengaktifkan daemon `cloudflared`, serta memantau status kesehatannya di latar belakang.

**Architecture:** Python service daemon `CloudflareTunnelService` di [app/services/cloudflare_tunnel_service.py](file:///c:/Project%20GIT/TMBilling/app/services/cloudflare_tunnel_service.py) bertugas mendownload biner `bin/cloudflared.exe` dari rilis resmi, mengelola siklus hidup proses `subprocess.Popen("cloudflared.exe tunnel run --token <TOKEN>")`, dan menyimpan status ke SQLite. Di REST API [settings_routes.py](file:///c:/Project%20GIT/TMBilling/app/routes/settings/settings_routes.py) disediakan endpoint status & kontrol, di [sidebar.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/components/sidebar.html) ditambahkan item sidebar terisolasi `🌐 Cloudflare Tunnel`, dan di UI [settings.html](file:///c:/Project%20GIT/TMBilling/app/templates/kasir/tabs/settings.html) dibuatkan subtab terpisah `#subtab-cloudflare_tunnel`.

**Tech Stack:** Python 3.13 (Flask, `subprocess`, `urllib.request`), JavaScript (ES6 Vanilla JS, Fetch API), HTML5, Tailwind CSS, SQLite.

## Global Constraints

- Pilihan commit wajib menggunakan Bahasa Indonesia (sesuai aturan `.agents/AGENTS.md`).
- `git commit` dan `git push` hanya dilakukan atas izin/perintah pengguna.
- Biner `cloudflared.exe` ditempatkan di folder `bin/cloudflared.exe` di workspace.
- Mengikuti aturan **1 sidebar item = 1 fungsi terisolasi** untuk subtab Pengaturan.

---

### Task 1: Backend Service — CloudflareTunnelService

**Files:**
- Create: `app/services/cloudflare_tunnel_service.py`
- Modify: `app/__init__.py`

**Interfaces:**
- Consumes: `app.models.Settings` (DB setting)
- Produces: `CloudflareTunnelService.get_status()`, `CloudflareTunnelService.start_tunnel()`, `CloudflareTunnelService.stop_tunnel()`, `CloudflareTunnelService.ensure_binary()`

- [ ] **Step 1: Write backend service code**

Create `app/services/cloudflare_tunnel_service.py`:
```python
# app/services/cloudflare_tunnel_service.py
import subprocess
import os
import sys
import logging
import urllib.request
import threading
from app.models import Settings

logger = logging.getLogger(__name__)

class CloudflareTunnelService:
    _process = None
    _lock = threading.Lock()
    BIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "bin")
    BIN_PATH = os.path.join(BIN_DIR, "cloudflared.exe")
    DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

    @classmethod
    def ensure_binary(cls):
        """Memastikan bin/cloudflared.exe tersedia, jika belum ada akan diunduh dari rilis resmi."""
        if os.path.exists(cls.BIN_PATH):
            return True, cls.BIN_PATH
        try:
            os.makedirs(cls.BIN_DIR, exist_ok=True)
            logger.info(f"[CloudflareTunnel] Unduh biner cloudflared.exe dari {cls.DOWNLOAD_URL}...")
            urllib.request.urlretrieve(cls.DOWNLOAD_URL, cls.BIN_PATH)
            logger.info("[CloudflareTunnel] Biner cloudflared.exe berhasil diunduh!")
            return True, cls.BIN_PATH
        except Exception as e:
            logger.error(f"[CloudflareTunnel] Gagal mengunduh biner: {e}")
            return False, str(e)

    @classmethod
    def get_status(cls):
        """Mengembalikan status terkini dari Cloudflare Tunnel daemon."""
        with cls._lock:
            is_running = cls._process is not None and cls._process.poll() is None
            token = Settings.get_value("cloudflare_tunnel_token", "")
            enabled = Settings.get_value("cloudflare_tunnel_enabled", "false") == "true"
            binary_exists = os.path.exists(cls.BIN_PATH)
            return {
                "running": is_running,
                "enabled": enabled,
                "token_set": bool(token.strip()),
                "token_masked": (token[:8] + "..." + token[-8:]) if len(token) > 16 else token,
                "binary_exists": binary_exists
            }

    @classmethod
    def start_tunnel(cls):
        """Menjalankan daemon cloudflared tunnel run --token <token>."""
        with cls._lock:
            if cls._process is not None and cls._process.poll() is None:
                return True, "Cloudflare Tunnel sudah berjalan"

            token = Settings.get_value("cloudflare_tunnel_token", "").strip()
            if not token:
                return False, "Cloudflare Tunnel Token belum dikonfigurasi"

            ok, err_or_path = cls.ensure_binary()
            if not ok:
                return False, f"Biner cloudflared.exe tidak tersedia: {err_or_path}"

            try:
                cmd = [cls.BIN_PATH, "tunnel", "--no-autoupdate", "run", "--token", token]
                cls._process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )
                import time
                time.sleep(1.0)
                if cls._process.poll() is not None:
                    _, err = cls._process.communicate()
                    return False, f"Proses tunnel gagal start: {err.decode('utf-8', errors='ignore')}"
                
                Settings.set_value("cloudflare_tunnel_enabled", "true")
                return True, "Cloudflare Tunnel berhasil dijalankan"
            except Exception as e:
                return False, f"Gagal menjalankan Cloudflare Tunnel: {e}"

    @classmethod
    def stop_tunnel(cls):
        """Menghentikan daemon cloudflared."""
        with cls._lock:
            Settings.set_value("cloudflare_tunnel_enabled", "false")
            if cls._process is not None and cls._process.poll() is None:
                try:
                    cls._process.terminate()
                    cls._process.wait(timeout=3)
                except Exception:
                    try:
                        cls._process.kill()
                    except Exception:
                        pass
                cls._process = None
                return True, "Cloudflare Tunnel dihentikan"
            cls._process = None
            return True, "Cloudflare Tunnel sudah nonaktif"

    @classmethod
    def init_app(cls, app):
        """Otomatis panggil saat server boot jika setting enabled = true."""
        enabled = Settings.get_value("cloudflare_tunnel_enabled", "false") == "true"
        if enabled:
            logger.info("[CloudflareTunnel] Auto-starting Cloudflare Tunnel daemon...")
            cls.start_tunnel()
```

- [ ] **Step 2: Connect CloudflareTunnelService to Flask App initialization**

Modify `app/__init__.py`:
Memanggil `CloudflareTunnelService.init_app(app)` di dalam `create_app()`.

---

### Task 2: REST API Endpoints untuk Cloudflare Tunnel

**Files:**
- Modify: `app/routes/settings/settings_routes.py`

**Interfaces:**
- Consumes: `CloudflareTunnelService`
- Produces: API endpoints `/api/v1/kasir/settings/cloudflare-tunnel/*`

- [ ] **Step 1: Add Cloudflare Tunnel API routes in `settings_routes.py`**

Menambahkan endpoint:
- `GET /api/v1/kasir/settings/cloudflare-tunnel/status`
- `POST /api/v1/kasir/settings/cloudflare-tunnel/save-token`
- `POST /api/v1/kasir/settings/cloudflare-tunnel/toggle`

---

### Task 3: UI Subtab Terisolasi `🌐 Cloudflare Tunnel` & Navigation

**Files:**
- Modify: `app/templates/kasir/components/sidebar.html`
- Modify: `app/templates/kasir/tabs/settings.html`
- Modify: `app/static/js/kasir/app.js`
- Modify: `app/static/js/kasir/modules/settings/index.js`

- [ ] **Step 1: Add Cloudflare Tunnel item in `sidebar.html`**

Tambah tombol sidebar di `settings-submenu`:
```html
<button onclick="App.switchTab('settings_cloudflare_tunnel')" data-tab="settings_cloudflare_tunnel" class="tab-btn w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] text-neutral-400 hover:text-neutral-100 hover:bg-[#121212] transition-all text-left">🌐 Cloudflare Tunnel</button>
```

- [ ] **Step 2: Create `#subtab-cloudflare_tunnel` in `settings.html`**

Menambahkan subtab terpisah `#subtab-cloudflare_tunnel` berisi:
- Card **🌐 Cloudflare Tunnel Auto-Manager**
- Field Token Input
- Status Indicator Badge (🟢 **Tunnel Aktif**, 🔴 **Tunnel Nonaktif**)
- Tombol `Simpan Token` & `Saklar Toggle On/Off`

- [ ] **Step 3: Update `app.js` title, RBAC, and Submenu mapping**

- Tambahkan `'settings_cloudflare_tunnel'` ke `kasirOnlyRestricted`
- Tambahkan `'settings_cloudflare_tunnel': 'settings'` ke `tabToSubmenu`
- Tambahkan `settings_cloudflare_tunnel: 'Pengaturan Cloudflare Tunnel'` ke `updatePageTitle`

- [ ] **Step 4: Add JS event handlers in `index.js`**

Menambahkan handler JS `_loadCloudflareTunnelStatus()`, `_saveCloudflareToken()`, dan `_toggleCloudflareTunnel()` dengan notifikasi Toast interaktif saat pindah subtab atau klik aksi.

# app/services/cloudflare_tunnel/cloudflare_tunnel_service.py
import subprocess
import os
import sys
import logging
import urllib.request
import threading
from app.services.settings.settings_service import SettingsService

logger = logging.getLogger(__name__)

class CloudflareTunnelService:
    _process = None
    _lock = threading.Lock()
    _download_status = {
        "downloading": False,
        "downloaded_bytes": 0,
        "total_bytes": 0,
        "percent": 0,
        "error": None
    }
    BIN_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "bin")
    BIN_PATH = os.path.join(BIN_DIR, "cloudflared.exe")
    DOWNLOAD_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

    @classmethod
    def ensure_binary(cls):
        """Memastikan bin/cloudflared.exe tersedia & utuh (>45MB). Jika terpotong/belum ada, unduh dari rilis resmi."""
        MIN_SIZE_BYTES = 45 * 1024 * 1024

        if os.path.exists(cls.BIN_PATH):
            if os.path.getsize(cls.BIN_PATH) >= MIN_SIZE_BYTES:
                return True, cls.BIN_PATH
            logger.warning("[CloudflareTunnel] File cloudflared.exe terpotong/rusak. Mengunduh ulang...")
            try:
                os.remove(cls.BIN_PATH)
            except Exception:
                pass

        try:
            os.makedirs(cls.BIN_DIR, exist_ok=True)
            logger.info(f"[CloudflareTunnel] Unduh biner cloudflared.exe dari {cls.DOWNLOAD_URL}...")
            
            cls._download_status = {
                "downloading": True,
                "downloaded_bytes": 0,
                "total_bytes": 0,
                "percent": 0,
                "error": None
            }

            req = urllib.request.Request(cls.DOWNLOAD_URL, headers={'User-Agent': 'Mozilla/5.0'})
            res = urllib.request.urlopen(req)
            total = int(res.headers.get('Content-Length', 0))
            cls._download_status["total_bytes"] = total

            tmp_path = cls.BIN_PATH + ".tmp"
            downloaded = 0
            with open(tmp_path, 'wb') as f:
                while True:
                    chunk = res.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    cls._download_status["downloaded_bytes"] = downloaded
                    if total > 0:
                        cls._download_status["percent"] = min(99, int((downloaded / total) * 100))

            if total > 0 and downloaded < total:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                cls._download_status = {
                    "downloading": False,
                    "downloaded_bytes": downloaded,
                    "total_bytes": total,
                    "percent": 0,
                    "error": "Unduhan terpotong"
                }
                return False, f"Unduhan terpotong: {downloaded}/{total} bytes"

            if os.path.exists(cls.BIN_PATH):
                os.remove(cls.BIN_PATH)
            os.rename(tmp_path, cls.BIN_PATH)
            
            cls._download_status = {
                "downloading": False,
                "downloaded_bytes": downloaded,
                "total_bytes": total,
                "percent": 100,
                "error": None
            }

            logger.info("[CloudflareTunnel] Biner cloudflared.exe berhasil diunduh dan diverifikasi!")
            return True, cls.BIN_PATH
        except Exception as e:
            cls._download_status = {
                "downloading": False,
                "downloaded_bytes": 0,
                "total_bytes": 0,
                "percent": 0,
                "error": str(e)
            }
            logger.error(f"[CloudflareTunnel] Gagal mengunduh biner: {e}")
            return False, str(e)

    @classmethod
    def get_status(cls):
        """Mengembalikan status terkini dari Cloudflare Tunnel daemon."""
        with cls._lock:
            is_running = cls._process is not None and cls._process.poll() is None
            token = SettingsService.get("cloudflare_tunnel_token", "")
            enabled = SettingsService.get("cloudflare_tunnel_enabled", "false") == "true"
            binary_exists = os.path.exists(cls.BIN_PATH)
            return {
                "running": is_running,
                "enabled": enabled,
                "token_set": bool(token.strip()),
                "token_masked": (token[:8] + "..." + token[-8:]) if len(token) > 16 else token,
                "binary_exists": binary_exists,
                "download": cls._download_status
            }

    _app = None

    @classmethod
    def start_tunnel(cls):
        """Menjalankan daemon cloudflared tunnel run --token <token>."""
        with cls._lock:
            if cls._process is not None and cls._process.poll() is None:
                return True, "Cloudflare Tunnel sudah berjalan"

            token = SettingsService.get("cloudflare_tunnel_token", "").strip()
            if not token:
                return False, "Cloudflare Tunnel Token belum dikonfigurasi"

            MIN_SIZE_BYTES = 45 * 1024 * 1024
            binary_ok = os.path.exists(cls.BIN_PATH) and os.path.getsize(cls.BIN_PATH) >= MIN_SIZE_BYTES

            if not binary_ok:
                if not cls._download_status.get("downloading"):
                    from flask import current_app
                    app = None
                    try:
                        app = current_app._get_current_object()
                    except Exception:
                        app = cls._app

                    t = threading.Thread(target=cls._bg_download_and_start, args=(token, app), daemon=True)
                    t.start()
                return True, "File biner cloudflared.exe belum ada, memulai pengunduhan..."

            return cls._do_start_process(token)

    @classmethod
    def _bg_download_and_start(cls, token, app=None):
        if app:
            with app.app_context():
                cls._exec_bg_download_and_start(token)
        else:
            cls._exec_bg_download_and_start(token)

    @classmethod
    def _exec_bg_download_and_start(cls, token):
        ok, err_or_path = cls.ensure_binary()
        if ok:
            with cls._lock:
                enabled = SettingsService.get("cloudflare_tunnel_enabled", "false") == "true"
                if enabled:
                    cls._do_start_process(token)

    @classmethod
    def _do_start_process(cls, token):
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
                err_str = err.decode('utf-8', errors='ignore').strip()
                if "token is not valid" in err_str.lower() or "invalid tunnel token" in err_str.lower():
                    return False, "Token Cloudflare Tunnel tidak valid."
                return False, f"Proses tunnel gagal start: {err_str}"
            
            SettingsService.set("cloudflare_tunnel_enabled", "true")
            return True, "Cloudflare Tunnel berhasil dijalankan"
        except Exception as e:
            return False, f"Gagal menjalankan Cloudflare Tunnel: {e}"

    @classmethod
    def stop_tunnel(cls):
        """Menghentikan daemon cloudflared."""
        with cls._lock:
            SettingsService.set("cloudflare_tunnel_enabled", "false")
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
        cls._app = app
        enabled = SettingsService.get("cloudflare_tunnel_enabled", "false") == "true"
        if enabled:
            logger.info("[CloudflareTunnel] Auto-starting Cloudflare Tunnel daemon...")
            cls.start_tunnel()

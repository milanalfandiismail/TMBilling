# app/services/vnc_service.py
import subprocess
import socket
import sys
import os
import logging

logger = logging.getLogger(__name__)

class VNCService:
    _process = None
    LISTEN_PORT = 8081
    VNC_HOST = '127.0.0.1'
    VNC_PORT = 5900

    @classmethod
    def is_port_open(cls, host, port):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0

    @classmethod
    def is_vnc_server_active(cls):
        """Memeriksa apakah TightVNC / VNC Server berjalan pada port 5900 local."""
        return cls.is_port_open(cls.VNC_HOST, cls.VNC_PORT)

    @classmethod
    def is_websockify_active(cls):
        """Memeriksa apakah daemon proxy Websockify aktif pada port 8081."""
        return cls.is_port_open('127.0.0.1', cls.LISTEN_PORT)

    @classmethod
    def ensure_websockify_running(cls):
        """Menjalankan proses Websockify jika belum berjalan."""
        if cls.is_websockify_active():
            return True, "Websockify sudah aktif"

        if not cls.is_vnc_server_active():
            return False, "VNC Server (TightVNC) tidak terdeteksi pada 127.0.0.1:5900. Pastikan TightVNC Server sudah berjalan."

        try:
            # Perintah untuk menjalankan websockify proxy: 0.0.0.0:8081 -> 127.0.0.1:5900
            cmd = [sys.executable, "-m", "websockify", f"0.0.0.0:{cls.LISTEN_PORT}", f"{cls.VNC_HOST}:{cls.VNC_PORT}"]
            cls._process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            logger.info(f"Proses Websockify berhasil dijalankan pada port {cls.LISTEN_PORT}")
            return True, "Websockify berhasil dinyalakan"
        except Exception as e:
            logger.error(f"Gagal menjalankan Websockify: {e}")
            return False, f"Gagal menjalankan Websockify: {str(e)}"

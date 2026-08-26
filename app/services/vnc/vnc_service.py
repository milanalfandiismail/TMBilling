# app/services/vnc/vnc_service.py
import subprocess
import socket
import sys
import os
import logging
import threading
import time

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
            return False, "VNC Server (TightVNC) tidak terdeteksi pada 127.0.0.1:5900. Pastikan TightVNC Server sudah berjalan dan mengizinkan Loopback (127.0.0.1)."

        try:
            import importlib.util
            if importlib.util.find_spec("websockify") is None:
                return False, "Modul Python 'websockify' belum terinstal. Silakan jalankan 'pip install websockify' di PC Server."

            # Perintah untuk menjalankan websockify proxy: 0.0.0.0:8081 -> 127.0.0.1:5900
            cmd = [sys.executable, "-m", "websockify", f"0.0.0.0:{cls.LISTEN_PORT}", f"{cls.VNC_HOST}:{cls.VNC_PORT}"]
            cls._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            import time
            time.sleep(0.5)

            # Cek jika proses langsung mati
            if cls._process.poll() is not None:
                _, err = cls._process.communicate()
                err_msg = err.decode('utf-8', errors='ignore').strip()
                return False, f"Proses websockify gagal berjalan: {err_msg or 'Unknown error'}"

            logger.info(f"Proses Websockify berhasil dijalankan pada port {cls.LISTEN_PORT}")
            return True, "Websockify berhasil dinyalakan"
        except Exception as e:
            logger.error(f"Gagal menjalankan Websockify: {e}")
            return False, f"Gagal menjalankan Websockify: {str(e)}"


class VNCClientProxyService:
    PORT_RANGE_START = 8090
    PORT_RANGE_END = 8150
    
    _active_proxies = {}  # pc_id -> {port, client_ip, process, started_at}
    _proxies_lock = threading.Lock()
    
    _vnc_events = {}
    _vnc_events_lock = threading.Lock()
    _vnc_status = {}  # pc_id -> {"ready": bool, "error": str}
    
    @classmethod
    def allocate_port(cls):
        with cls._proxies_lock:
            used_ports = {info["port"] for info in cls._active_proxies.values()}
            for port in range(cls.PORT_RANGE_START, cls.PORT_RANGE_END + 1):
                if port not in used_ports:
                    # Double-check if the port is open in the system
                    if not VNCService.is_port_open('127.0.0.1', port):
                        return port
            return None

    @classmethod
    def start_proxy(cls, pc_id, client_ip):
        port = cls.allocate_port()
        if port is None:
            return False, "Port pool websockify penuh", None
            
        try:
            # Perintah untuk menjalankan websockify proxy: 0.0.0.0:port -> client_ip:5900
            cmd = [sys.executable, "-m", "websockify", f"0.0.0.0:{port}", f"{client_ip}:5900"]
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            time.sleep(0.2)
            
            # Cek jika proses langsung mati
            if process.poll() is not None:
                _, err = process.communicate()
                err_msg = err.decode('utf-8', errors='ignore').strip()
                return False, f"Proses websockify client gagal berjalan: {err_msg or 'Unknown error'}", None
                
            with cls._proxies_lock:
                cls._active_proxies[pc_id] = {
                    "port": port,
                    "client_ip": client_ip,
                    "process": process,
                    "started_at": time.time()
                }
                
            logger.info(f"Proses Websockify client {pc_id} ({client_ip}) berhasil dijalankan pada port {port}")
            return True, "Proxy websockify client berhasil dinyalakan", port
        except Exception as e:
            logger.error(f"Gagal menjalankan Websockify client: {e}")
            return False, f"Gagal menjalankan Websockify client: {str(e)}", None

    @classmethod
    def stop_proxy(cls, pc_id):
        with cls._proxies_lock:
            proxy = cls._active_proxies.pop(pc_id, None)
            
        if not proxy:
            # Symmetrical backup queueing to make sure client stops
            try:
                from app.services import ClientService
                ClientService.queue_vnc_command(pc_id, "vnc_stop")
            except Exception:
                pass
            return True, "Proxy tidak aktif"
            
        process = proxy.get("process")
        if process:
            try:
                process.terminate()
                process.wait(timeout=1.0)
            except Exception as e:
                logger.warning(f"Gagal mematikan proses websockify client {pc_id}: {e}")

        try:
            from app.services import ClientService
            ClientService.queue_vnc_command(pc_id, "vnc_stop")
        except Exception as e:
            logger.error(f"Gagal mengantrekan vnc_stop untuk PC {pc_id}: {e}")
                
        logger.info(f"Proxy websockify client {pc_id} dihentikan dan port {proxy['port']} dibebaskan")
        return True, "Proxy websockify client berhasil dihentikan"

    @classmethod
    def get_proxy(cls, pc_id):
        with cls._proxies_lock:
            return cls._active_proxies.get(pc_id)

    @classmethod
    def reset_vnc_status(cls, pc_id):
        with cls._vnc_events_lock:
            cls._vnc_status.pop(pc_id, None)
            if pc_id in cls._vnc_events:
                cls._vnc_events[pc_id].clear()
            else:
                cls._vnc_events[pc_id] = threading.Event()

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

    @classmethod
    def cleanup_stale_proxies(cls, max_idle_seconds=600):
        now = time.time()
        stale_pc_ids = []
        with cls._proxies_lock:
            for pc_id, info in cls._active_proxies.items():
                if now - info["started_at"] > max_idle_seconds:
                    stale_pc_ids.append(pc_id)
                    
        count = 0
        for pc_id in stale_pc_ids:
            success, _ = cls.stop_proxy(pc_id)
            if success:
                count += 1
        return count

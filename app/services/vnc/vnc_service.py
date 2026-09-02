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
    TOKEN_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "instance", "vnc_tokens.cfg")
    _token_lock = threading.Lock()

    @classmethod
    def ensure_default_tokens(cls):
        """Memastikan file token ada dan setidaknya memiliki token server default."""
        with cls._token_lock:
            dir_name = os.path.dirname(cls.TOKEN_FILE_PATH)
            if dir_name:
                os.makedirs(dir_name, exist_ok=True)
            
            # Jika file tidak ada atau kosong, buat default server token
            if not os.path.exists(cls.TOKEN_FILE_PATH) or os.path.getsize(cls.TOKEN_FILE_PATH) == 0:
                with open(cls.TOKEN_FILE_PATH, "w") as f:
                    f.write("server: 127.0.0.1:5900\n")
                logger.info(f"Membuat token file default di: {cls.TOKEN_FILE_PATH}")

    @classmethod
    def set_token(cls, token, host, port):
        """Menambahkan atau memperbarui token target secara thread-safe."""
        cls.ensure_default_tokens()
        with cls._token_lock:
            targets = {}
            if os.path.exists(cls.TOKEN_FILE_PATH):
                with open(cls.TOKEN_FILE_PATH, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            if ":" in line:
                                parts = line.split(":", 1)
                                targets[parts[0].strip()] = parts[1].strip()

            targets[token.strip()] = f"{host}:{port}"

            with open(cls.TOKEN_FILE_PATH, "w") as f:
                for t, target in targets.items():
                    f.write(f"{t}: {target}\n")
            logger.info(f"Token VNC diperbarui: {token} -> {host}:{port}")

    @classmethod
    def remove_token(cls, token):
        """Menghapus token target secara thread-safe."""
        cls.ensure_default_tokens()
        with cls._token_lock:
            targets = {}
            if os.path.exists(cls.TOKEN_FILE_PATH):
                with open(cls.TOKEN_FILE_PATH, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            if ":" in line:
                                parts = line.split(":", 1)
                                targets[parts[0].strip()] = parts[1].strip()

            if token.strip() in targets:
                targets.pop(token.strip())
                with open(cls.TOKEN_FILE_PATH, "w") as f:
                    for t, target in targets.items():
                        f.write(f"{t}: {target}\n")
                logger.info(f"Token VNC dihapus: {token}")

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

        cls.ensure_default_tokens()

        try:
            import importlib.util
            if importlib.util.find_spec("websockify") is None:
                return False, "Modul Python 'websockify' belum terinstal. Silakan jalankan 'pip install websockify' di PC Server."

            # Perintah untuk menjalankan websockify proxy dengan TokenFile
            cmd = [
                sys.executable, "-m", "websockify",
                "--token-plugin=TokenFile",
                f"--token-source={cls.TOKEN_FILE_PATH}",
                f"0.0.0.0:{cls.LISTEN_PORT}"
            ]
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

            logger.info(f"Proses Websockify dengan TokenFile berhasil dijalankan pada port {cls.LISTEN_PORT}")
            return True, "Websockify berhasil dinyalakan"
        except Exception as e:
            logger.error(f"Gagal menjalankan Websockify: {e}")
            return False, f"Gagal menjalankan Websockify: {str(e)}"


class VNCClientProxyService:
    PORT_RANGE_START = 8090
    PORT_RANGE_END = 8150
    
    _active_proxies = {}  # pc_id -> {port, client_ip, token, started_at}
    _proxies_lock = threading.Lock()
    
    _vnc_events = {}
    _vnc_events_lock = threading.Lock()
    _vnc_status = {}  # pc_id -> {"ready": bool, "error": str}
    
    @classmethod
    def allocate_port(cls):
        # Deprecated: We now route all traffic via Port 8081 using Token Multiplexing
        return VNCService.LISTEN_PORT

    @classmethod
    def start_proxy(cls, pc_id, client_ip):
        success, msg = VNCService.ensure_websockify_running()
        if not success:
            return False, f"Gagal mengaktifkan daemon websockify terpusat: {msg}", None, None
            
        try:
            token = f"client_{pc_id}"
            # Daftarkan token target client_ip:5900
            VNCService.set_token(token, client_ip, 5900)
            
            with cls._proxies_lock:
                cls._active_proxies[pc_id] = {
                    "port": VNCService.LISTEN_PORT,
                    "client_ip": client_ip,
                    "token": token,
                    "started_at": time.time()
                }
                
            logger.info(f"Token websockify untuk client {pc_id} ({client_ip}) berhasil didaftarkan: {token}")
            return True, "Proxy websockify client berhasil dinyalakan", VNCService.LISTEN_PORT, token
        except Exception as e:
            logger.error(f"Gagal mendaftarkan token websockify client: {e}")
            return False, f"Gagal mendaftarkan token websockify client: {str(e)}", None, None

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
            
        token = proxy.get("token")
        if token:
            VNCService.remove_token(token)

        try:
            from app.services import ClientService
            ClientService.queue_vnc_command(pc_id, "vnc_stop")
        except Exception as e:
            logger.error(f"Gagal mengantrekan vnc_stop untuk PC {pc_id}: {e}")
                
        logger.info(f"Proxy websockify client {pc_id} dihentikan dan token {token} dibebaskan")
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

"""VNC: proxy harus start walau monitor klien tidak melapor vnc_ready (probe port 5900)."""

import socket
import threading


def test_proxy_start_tanpa_laporan_vnc_ready(h):
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 5900))
    srv.listen(4)
    stop = threading.Event()

    def terima():
        while not stop.is_set():
            try:
                srv.settimeout(0.3)
                c, _ = srv.accept()
                c.close()
            except OSError:
                pass

    th = threading.Thread(target=terima, daemon=True)
    th.start()
    try:
        h.db_exec("UPDATE pc SET ip_address='127.0.0.1', aktif=1 WHERE id=90")
        r = h.kasir_get("/api/v1/kasir/vnc/client/90/status")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True, body
        assert body.get("port") and body.get("token"), body
    finally:
        stop.set()
        srv.close()
        h.kasir_post("/api/v1/kasir/vnc/client/90/stop", {})

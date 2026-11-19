"""client_start harus langsung membuka proxy bila port 5900 target terbuka."""

import socket
import threading


def test_start_langsung_membuka_proxy(h):
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

    threading.Thread(target=terima, daemon=True).start()
    try:
        h.db_exec("UPDATE pc SET ip_address='127.0.0.1', aktif=1 WHERE id=90")
        r = h.kasir_post("/api/v1/kasir/vnc/client/90/start", {})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["port"] == 8081 and body.get("token"), body
    finally:
        stop.set()
        srv.close()
        h.kasir_post("/api/v1/kasir/vnc/client/90/stop", {})

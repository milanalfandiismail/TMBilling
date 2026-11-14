import http.server
import socket
import threading

import pytest

from install_scripts import flush_uptime


def _port_tertutup():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_resolve_api_key_dari_environment(monkeypatch):
    monkeypatch.setenv("CLIENT_API_KEY", "kunci-env")
    assert flush_uptime.resolve_api_key("tidak-ada.env") == "kunci-env"


def test_tanpa_api_key_gagal(monkeypatch, tmp_path):
    monkeypatch.delenv("CLIENT_API_KEY", raising=False)
    assert flush_uptime.flush(port=1, env_path=str(tmp_path / "kosong.env")) == 1


def test_server_tidak_menjawab_dianggap_gagal(monkeypatch):
    monkeypatch.setenv("CLIENT_API_KEY", "kunci-env")
    assert flush_uptime.flush(port=_port_tertutup(), timeout=1) == 1


def test_http_401_dianggap_gagal(monkeypatch):
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            self.send_response(401)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()
    try:
        monkeypatch.setenv("CLIENT_API_KEY", "kunci-salah")
        assert flush_uptime.flush(port=server.server_port, timeout=2) == 1
    finally:
        server.server_close()


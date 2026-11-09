from app.services.vnc.vnc_service import VNCClientProxyService, VNCService


def test_start_proxy_revokes_previous_token(tmp_path, monkeypatch):
    token_file = tmp_path / "tokens.cfg"
    monkeypatch.setattr(VNCService, "TOKEN_FILE_PATH", str(token_file))
    monkeypatch.setattr(VNCService, "ensure_websockify_running", classmethod(lambda cls: (True, "ok")))
    VNCClientProxyService._active_proxies.clear()

    ok, _, _, token1 = VNCClientProxyService.start_proxy(1, "10.0.0.1")
    assert ok and token1
    ok, _, _, token2 = VNCClientProxyService.start_proxy(1, "10.0.0.1")
    assert ok and token2 and token2 != token1

    content = token_file.read_text(encoding="utf-8")
    assert token2 in content
    assert token1 not in content

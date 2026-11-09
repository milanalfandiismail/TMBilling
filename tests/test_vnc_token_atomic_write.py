import os

import pytest

from app.services.vnc.vnc_service import VNCService


def test_set_token_keeps_old_file_when_replace_fails(tmp_path, monkeypatch):
    path = tmp_path / "tokens.cfg"
    path.write_text("server: 127.0.0.1:5900\n", encoding="utf-8")
    monkeypatch.setattr(VNCService, "TOKEN_FILE_PATH", str(path))
    monkeypatch.setattr(os, "replace", lambda *a: (_ for _ in ()).throw(OSError("disk")))
    with pytest.raises(OSError):
        VNCService.set_token("abc", "10.0.0.1", 5900)
    assert "abc" not in path.read_text(encoding="utf-8")

from types import SimpleNamespace

from app.services.cloudflare_tunnel.cloudflare_tunnel_service import CloudflareTunnelService


def test_stop_pid_abaikan_proses_bukan_cloudflared(monkeypatch):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        return SimpleNamespace(stdout="notepad.exe 4321 Console 1 10.000 K")

    monkeypatch.setattr("app.services.cloudflare_tunnel.cloudflare_tunnel_service.subprocess.run", fake_run)
    CloudflareTunnelService._stop_pid(4321)
    assert all("taskkill" not in cmd for cmd in calls)


def test_stop_pid_membunuh_cloudflared(monkeypatch):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        return SimpleNamespace(stdout="cloudflared.exe 4321 Console 1 10.000 K")

    monkeypatch.setattr("app.services.cloudflare_tunnel.cloudflare_tunnel_service.subprocess.run", fake_run)
    CloudflareTunnelService._stop_pid(4321)
    assert ["taskkill", "/PID", "4321", "/T", "/F"] in calls


def test_cleanup_orphan_memakai_pid_file(monkeypatch, tmp_path):
    pid_file = tmp_path / "cloudflared.pid"
    pid_file.write_text("4321", encoding="utf-8")
    monkeypatch.setattr(CloudflareTunnelService, "PID_PATH", str(pid_file))
    dipanggil = []
    monkeypatch.setattr(
        CloudflareTunnelService, "_stop_pid",
        classmethod(lambda cls, pid: dipanggil.append(pid)),
    )
    CloudflareTunnelService._cleanup_orphan()
    assert dipanggil == [4321]
    assert not pid_file.exists()


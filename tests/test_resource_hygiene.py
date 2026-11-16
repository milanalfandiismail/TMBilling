import inspect
from app.services.cloudflare_tunnel import cloudflare_tunnel_service as cfs
from app.services.pc.pc_service import PCService


def test_unduh_cloudflared_punya_timeout():
    assert "urlopen(req, timeout=" in inspect.getsource(cfs.CloudflareTunnelService)


def test_hapus_pc_membersihkan_cache():
    assert "cleanup_pc_cache(pc_id)" in inspect.getsource(PCService.delete)

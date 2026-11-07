from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService


def test_cidr_menutup_semua_ip_dalam_subnet(monkeypatch):
    store = []
    monkeypatch.setattr(IpWhitelistService, "_load_entries", staticmethod(lambda: store))
    monkeypatch.setattr(
        IpWhitelistService,
        "_save_entries",
        staticmethod(lambda entries: store.__setitem__(slice(None), list(entries))),
    )
    IpWhitelistService.add("192.168.1.0/24")
    assert IpWhitelistService.is_ip_whitelisted("192.168.1.55") is True
    assert IpWhitelistService.is_ip_whitelisted("192.168.2.1") is False

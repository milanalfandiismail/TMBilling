"""Unit tests untuk app.services.cache.system_cache_store."""

import pytest
from app import create_app
from app.models import db, PC, Grup, Settings
from app.services.cache.system_cache_store import (
    SettingsCacheStore,
    PCNetworkCacheStore
)


@pytest.fixture
def app_system():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-SYS-1", ip_address="192.168.1.150", mac_address="AA:BB:CC:DD:EE:FF", grup_id=grup.id)
        db.session.add(pc)
        s1 = Settings(key="app_title", value="TMBilling Test")
        db.session.add(s1)
        db.session.commit()
        yield app, pc
        db.session.remove()
        db.drop_all()


def test_settings_cache_store_write_through(app_system):
    app, pc = app_system
    SettingsCacheStore.invalidate()

    with app.app_context():
        # First read warms up cache from DB
        val = SettingsCacheStore.get("app_title")
        assert val == "TMBilling Test"

        # Update cache
        SettingsCacheStore.set("app_title", "New Title")
        assert SettingsCacheStore.get("app_title") == "New Title"

        # Invalidate clears cache
        SettingsCacheStore.invalidate()
        assert SettingsCacheStore._cache is None


def test_pc_network_cache_store_resolution(app_system):
    app, pc = app_system
    PCNetworkCacheStore.invalidate()

    with app.app_context():
        # Resolve by IP
        res_ip = PCNetworkCacheStore.resolve_pc(ip="192.168.1.150")
        assert res_ip is not None
        assert res_ip["id"] == pc.id
        assert res_ip["kode"] == "PC-SYS-1"

        # Resolve by MAC (with lowercase or hyphens)
        res_mac = PCNetworkCacheStore.resolve_pc(mac="aa-bb-cc-dd-ee-ff")
        assert res_mac is not None
        assert res_mac["id"] == pc.id

        # Unknown IP/MAC
        assert PCNetworkCacheStore.resolve_pc(ip="192.168.1.254") is None

        # Invalidate
        PCNetworkCacheStore.invalidate()
        assert PCNetworkCacheStore._initialized is False

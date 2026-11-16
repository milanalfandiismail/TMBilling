"""Unit tests untuk arsitektur In-Memory Telemetry & Anti-Theft Grace Period."""

import time
import json
import pytest
from datetime import datetime, timedelta
from app import create_app
from app.models import db, PC, Grup, HardwareMonitor, Settings, PCUptimeLog
from app.services.cache.memory_store import (
    ProcessMemoryStore,
    HardwareMetricsStore,
    OnlineStatusStore,
    SettingsCacheStore,
    AntiTheftGraceTracker,
    UptimeMemoryStore,
)
from app.repositories import ProcessRepository, HardwareRepository
from app.services import HardwareService, SettingsService
from app.services.hardware.uptime_service import UptimeService


@pytest.fixture
def test_app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_process_memory_store_zero_disk(test_app):
    """Pastikan ProcessMemoryStore bekerja 100% in-memory tanpa write ke DB."""
    with test_app.app_context():
        grup = Grup.query.first()
        pc = PC(kode="TEST-PC-MEM", ip_address="192.168.1.99", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        # Sync processes
        dummy_procs = [
            {"Name": "game.exe", "Title": "Mem: 50 MB"},
            {"Name": "discord.exe", "Title": "Mem: 30 MB"}
        ]
        ProcessRepository.sync_processes(pc.id, dummy_procs)

        # Ambil data dari repository
        procs = ProcessRepository.get_by_pc(pc.id)
        assert len(procs) == 2
        assert procs[0].name == "game.exe"
        assert procs[0].to_dict()["name"] == "game.exe"
        assert procs[1].name == "discord.exe"

        # Cleanup
        ProcessMemoryStore.remove(pc.id)
        assert len(ProcessRepository.get_by_pc(pc.id)) == 0


def test_settings_write_through_cache(test_app):
    """Pastikan SettingsService menggunakan Write-Through RAM cache."""
    with test_app.app_context():
        SettingsCacheStore.invalidate()

        # Set setting
        SettingsService.set("test_cache_key", "hello_ram")
        assert SettingsCacheStore.get("test_cache_key") == "hello_ram"
        assert SettingsService.get("test_cache_key") == "hello_ram"

        # Update setting
        SettingsService.set("test_cache_key", "hello_updated")
        assert SettingsCacheStore.get("test_cache_key") == "hello_updated"


def test_uptime_accumulator_and_flush(test_app):
    """Pastikan UptimeMemoryStore mengakumulasikan detik dan flush ke DB."""
    with test_app.app_context():
        grup = Grup.query.first()
        pc = PC(kode="TEST-PC-UPTIME", ip_address="192.168.1.98", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        # Record heartbeat 2 kali dengan jeda simulasi
        UptimeMemoryStore._last_seen_ts[pc.id] = time.time() - 10.0
        UptimeMemoryStore.record_heartbeat(pc.id, is_billing=False)

        # Flush ke DB
        UptimeService.flush_uptime_to_db(app=test_app)

        # Verifikasi data di tabel pc_uptime_log
        today = datetime.now().date()
        log = PCUptimeLog.query.filter_by(pc_id=pc.id, tanggal=today).first()
        assert log is not None
        assert log.total_online_seconds >= 9


def test_antitheft_grace_period_prevents_false_alarm(test_app):
    """Pastikan toleransi 60 detik mencegah false alarm saat cold start booting."""
    with test_app.app_context():
        grup = Grup.query.first()
        pc = PC(kode="TEST-PC-GPU", ip_address="192.168.1.97", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()

        hw = HardwareRepository.get_by_pc_id(pc.id)
        if not hw:
            hw = HardwareMonitor(pc_id=pc.id)
            db.session.add(hw)

        # Set baseline RX 5700
        baseline_data = {
            "MotherboardSerial": "MB-12345",
            "CpuId": "CPU-12345",
            "GpuPnpId": "PCI\\VEN_1002&DEV_731F",
            "GpuName": "AMD Radeon RX 5700",
            "RamSerials": ["RAM-1"],
            "DiskSerials": ["DISK-1"]
        }
        hw.hardware_baseline = json.dumps(baseline_data)
        hw.hardware_mismatch = False
        db.session.commit()

        # 1. Kasus Cold Start (dalam masa toleransi 60 detik):
        AntiTheftGraceTracker._boot_timestamps[pc.id] = time.time()  # Baru 0 detik boot
        cold_start_payload = {
            "IpAddress": pc.ip_address,
            "GpuName": "Unknown",
            "Motherboard": "MB-12345",
            "CpuName": "Intel Core i5",
            "HardwareSerials": {
                "MotherboardSerial": "MB-12345",
                "CpuId": "CPU-12345",
                "GpuPnpId": "Unknown",
                "RamSerials": ["RAM-1"],
                "DiskSerials": ["DISK-1"]
            }
        }
        HardwareService.process_hardware_metric(pc.ip_address, cold_start_payload)
        # Verifikasi TIDAK ADA mismatch!
        hw_after = HardwareRepository.get_by_pc_id(pc.id)
        assert hw_after.hardware_mismatch is False

        # 2. Kasus setelah 60 detik lewat: GPU masih Unknown / dicopot
        AntiTheftGraceTracker._boot_timestamps[pc.id] = time.time() - 70.0  # Sudah 70 detik
        HardwareService.process_hardware_metric(pc.ip_address, cold_start_payload)
        # Verifikasi SEKARANG memicu mismatch pencurian!
        hw_mismatch = HardwareRepository.get_by_pc_id(pc.id)
        assert hw_mismatch.hardware_mismatch is True
        assert "GPU/VGA fisik dicopot atau hilang" in hw_mismatch.hardware_mismatch_desc

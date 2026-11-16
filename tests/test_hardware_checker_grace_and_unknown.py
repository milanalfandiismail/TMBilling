import time
import json
import pytest
from app import create_app
from app.models import db, PC, Grup, HardwareMonitor
from app.services.hardware.hardware_service import HardwareService
from app.services.cache.client_state_store import AntiTheftGraceTracker, OnlineStatusStore


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


def test_cold_boot_unknown_gpu_within_grace_no_mismatch(test_app):
    """Saat PC baru boot dan GpuName masih 'Unknown', sistem tidak boleh memicu alarm."""
    with test_app.app_context():
        AntiTheftGraceTracker.clear_all()
        OnlineStatusStore.clear()

        grup = Grup.query.first()
        pc = PC(
            kode="TM-99",
            nama="PC Testing 99",
            ip_address="192.168.1.199",
            mac_address="AA:BB:CC:DD:EE:99",
            grup_id=grup.id
        )
        db.session.add(pc)
        db.session.commit()

        hw = HardwareMonitor(
            pc_id=pc.id,
            gpu_name="AMD Radeon RX 580 2048SP",
            motherboard="Gigabyte H81M-DS2",
            cpu_name="Intel Core i5-4590",
            hardware_baseline=json.dumps({
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "GpuName": "AMD Radeon RX 580 2048SP",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }),
            hardware_mismatch=False
        )
        db.session.add(hw)
        db.session.commit()

        # Simulasikan PC baru menyala setelah offline (was_offline = True)
        cold_boot_payload = {
            "IpAddress": pc.ip_address,
            "GpuName": "Unknown",
            "CpuName": "Intel Core i5-4590",
            "Motherboard": "Gigabyte H81M-DS2",
            "HardwareSerials": {
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }
        }
        HardwareService.process_hardware_metric(pc.ip_address, cold_boot_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
        assert hw.hardware_mismatch is False
        assert hw.hardware_mismatch_desc is None
        # Pastikan database tidak tertimpa dengan 'Unknown'
        assert hw.gpu_name == "AMD Radeon RX 580 2048SP"


def test_post_grace_same_pnp_id_unknown_name_no_mismatch(test_app):
    """Setelah 60 detik lewat, jika PNP ID kartu fisik sama persis tapi nama masih 'Unknown', kartu fisik tidak ditukar."""
    with test_app.app_context():
        AntiTheftGraceTracker.clear_all()
        OnlineStatusStore.clear()

        grup = Grup.query.first()
        pc = PC(
            kode="TM-99",
            nama="PC Testing 99",
            ip_address="192.168.1.199",
            mac_address="AA:BB:CC:DD:EE:99",
            grup_id=grup.id
        )
        db.session.add(pc)
        db.session.commit()

        hw = HardwareMonitor(
            pc_id=pc.id,
            gpu_name="AMD Radeon RX 580 2048SP",
            motherboard="Gigabyte H81M-DS2",
            cpu_name="Intel Core i5-4590",
            hardware_baseline=json.dumps({
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "GpuName": "AMD Radeon RX 580 2048SP",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }),
            hardware_mismatch=False
        )
        db.session.add(hw)
        db.session.commit()

        # Set boot timestamp 70 detik lalu dan biarkan PC aktif online
        AntiTheftGraceTracker._boot_timestamps[pc.id] = time.time() - 70.0
        OnlineStatusStore.mark_active(pc.id)

        payload = {
            "IpAddress": pc.ip_address,
            "GpuName": "Unknown",
            "HardwareSerials": {
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }
        }
        HardwareService.process_hardware_metric(pc.ip_address, payload)

        hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
        assert hw.hardware_mismatch is False
        assert hw.hardware_mismatch_desc is None


def test_swapped_gpu_triggers_mismatch(test_app):
    """Jika GPU ditukar fisik (PNP ID berbeda), alarm anti-theft harus meletup akurat."""
    with test_app.app_context():
        AntiTheftGraceTracker.clear_all()
        OnlineStatusStore.clear()

        grup = Grup.query.first()
        pc = PC(
            kode="TM-99",
            nama="PC Testing 99",
            ip_address="192.168.1.199",
            mac_address="AA:BB:CC:DD:EE:99",
            grup_id=grup.id
        )
        db.session.add(pc)
        db.session.commit()

        hw = HardwareMonitor(
            pc_id=pc.id,
            gpu_name="AMD Radeon RX 580 2048SP",
            motherboard="Gigabyte H81M-DS2",
            cpu_name="Intel Core i5-4590",
            hardware_baseline=json.dumps({
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "GpuName": "AMD Radeon RX 580 2048SP",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }),
            hardware_mismatch=False
        )
        db.session.add(hw)
        db.session.commit()

        swapped_payload = {
            "IpAddress": pc.ip_address,
            "GpuName": "NVIDIA GeForce GTX 1050 Ti",
            "HardwareSerials": {
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_10DE&DEV_1C82&SUBSYS_00000000&REV_A1",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }
        }
        HardwareService.process_hardware_metric(pc.ip_address, swapped_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
        assert hw.hardware_mismatch is True
        assert "GPU/VGA ditukar" in hw.hardware_mismatch_desc


def test_missing_gpu_post_grace_triggers_theft_alarm(test_app):
    """Jika GPU dicopot fisik (ke Microsoft Basic / generic) dan lewat masa grace 60s, alarm pencurian berbunyi."""
    with test_app.app_context():
        AntiTheftGraceTracker.clear_all()
        OnlineStatusStore.clear()

        grup = Grup.query.first()
        pc = PC(
            kode="TM-99",
            nama="PC Testing 99",
            ip_address="192.168.1.199",
            mac_address="AA:BB:CC:DD:EE:99",
            grup_id=grup.id
        )
        db.session.add(pc)
        db.session.commit()

        hw = HardwareMonitor(
            pc_id=pc.id,
            gpu_name="AMD Radeon RX 580 2048SP",
            motherboard="Gigabyte H81M-DS2",
            cpu_name="Intel Core i5-4590",
            hardware_baseline=json.dumps({
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"PCI\VEN_1002&DEV_6FDF&SUBSYS_00000000&REV_EF",
                "GpuName": "AMD Radeon RX 580 2048SP",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }),
            hardware_mismatch=False
        )
        db.session.add(hw)
        db.session.commit()

        # Pasca grace period (70s) dan PC dalam status online
        AntiTheftGraceTracker._boot_timestamps[pc.id] = time.time() - 70.0
        OnlineStatusStore.mark_active(pc.id)

        missing_payload = {
            "IpAddress": pc.ip_address,
            "GpuName": "Microsoft Basic Display Adapter",
            "HardwareSerials": {
                "MotherboardSerial": "MB-TEST-99",
                "CpuId": "CPU-TEST-99",
                "GpuPnpId": r"ROOT\BASICDISPLAY\0000",
                "RamSerials": ["RAM-TEST-1"],
                "DiskSerials": ["DISK-TEST-1"]
            }
        }
        HardwareService.process_hardware_metric(pc.ip_address, missing_payload)

        hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
        assert hw.hardware_mismatch is True
        assert "GPU/VGA fisik dicopot atau hilang" in hw.hardware_mismatch_desc

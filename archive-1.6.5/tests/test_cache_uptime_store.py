"""Unit tests untuk app.services.cache.uptime_store."""

import time
import pytest
from datetime import datetime, date, timedelta
from app import create_app
from app.models import db, PC, Grup, PCUptimeLog
from app.services.cache.uptime_store import UptimeMemoryStore


@pytest.fixture
def app_uptime():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-UP-TEST", ip_address="192.168.1.80", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        yield app, pc.id
        db.session.remove()
        db.drop_all()


def test_uptime_record_heartbeat_and_flush(app_uptime):
    app, pc_id = app_uptime
    UptimeMemoryStore.clear()

    # Record first heartbeat
    UptimeMemoryStore.record_heartbeat(pc_id, is_billing=True)
    # Simulate 5 seconds later
    UptimeMemoryStore._last_seen_ts[pc_id] = time.time() - 5.0
    UptimeMemoryStore.record_heartbeat(pc_id, is_billing=True)

    # Flush to SQLite
    UptimeMemoryStore.flush_to_database(app=app)

    with app.app_context():
        today = datetime.now().date()
        log = PCUptimeLog.query.filter_by(pc_id=pc_id, tanggal=today).first()
        assert log is not None
        assert log.total_online_seconds >= 4
        assert log.total_billing_seconds >= 4


def test_uptime_auto_prune_past_dates(app_uptime):
    app, pc_id = app_uptime
    UptimeMemoryStore.clear()

    # Entry tanggal kemarin yang sudah di-flush (delta = 0)
    yesterday = date.today() - timedelta(days=1)
    UptimeMemoryStore._accumulator[(pc_id, yesterday)] = {
        "online_delta": 0,
        "billing_delta": 0,
        "first_seen": datetime.now(),
        "last_seen": datetime.now()
    }

    # Entry hari ini yang aktif
    today = date.today()
    UptimeMemoryStore._accumulator[(pc_id, today)] = {
        "online_delta": 10,
        "billing_delta": 0,
        "first_seen": datetime.now(),
        "last_seen": datetime.now()
    }

    # Run flush
    UptimeMemoryStore.flush_to_database(app=app)

    # Kemarin harus ter-prune, hari ini tetap ada dengan delta 0
    assert (pc_id, yesterday) not in UptimeMemoryStore._accumulator
    assert (pc_id, today) in UptimeMemoryStore._accumulator


def test_uptime_bulk_flush_multiple_pcs(app_uptime):
    app, pc_id1 = app_uptime
    with app.app_context():
        grup = Grup.query.first()
        pc2 = PC(kode="PC-UP-TEST-2", ip_address="192.168.1.81", grup_id=grup.id)
        db.session.add(pc2)
        db.session.commit()
        pc_id2 = pc2.id

    UptimeMemoryStore.clear()
    today = date.today()
    now = datetime.now()

    # Pre-existing record for pc_id1
    with app.app_context():
        existing_log = PCUptimeLog(
            pc_id=pc_id1,
            tanggal=today,
            first_seen=now,
            last_seen=now,
            total_online_seconds=100,
            total_billing_seconds=50
        )
        db.session.add(existing_log)
        db.session.commit()

    # Accumulate delta for both pc_id1 and pc_id2
    UptimeMemoryStore._accumulator[(pc_id1, today)] = {
        "online_delta": 20,
        "billing_delta": 10,
        "first_seen": now,
        "last_seen": now
    }
    UptimeMemoryStore._accumulator[(pc_id2, today)] = {
        "online_delta": 60,
        "billing_delta": 30,
        "first_seen": now,
        "last_seen": now
    }

    # Flush bulk
    UptimeMemoryStore.flush_to_database(app=app)

    with app.app_context():
        log1 = PCUptimeLog.query.filter_by(pc_id=pc_id1, tanggal=today).first()
        log2 = PCUptimeLog.query.filter_by(pc_id=pc_id2, tanggal=today).first()
        assert log1 is not None and log1.total_online_seconds == 120 and log1.total_billing_seconds == 60
        assert log2 is not None and log2.total_online_seconds == 60 and log2.total_billing_seconds == 30

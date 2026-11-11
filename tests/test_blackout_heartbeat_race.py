from datetime import timedelta

import pytest

from app import create_app
from app.models import db, Sesi, now_local
from app.repositories import SesiRepository
from app.services.blackout.blackout_service import BlackoutService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'blackout.db'}",
    })
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


def test_stale_candidate_query_runs_under_write_lock(app_ctx, monkeypatch):
    from app.services.blackout import blackout_service as module

    state = {"held": False, "queried_under_lock": False}

    class TrackingLock:
        def __enter__(self):
            state["held"] = True

        def __exit__(self, *exc):
            state["held"] = False
            return False

    def tracked_query(batas_waktu):
        state["queried_under_lock"] = state["held"]
        return []

    monkeypatch.setattr(module, "WRITE_LOCK", TrackingLock())
    monkeypatch.setattr(SesiRepository, "get_aktif_belum_suspect_lama_sync", tracked_query)

    assert BlackoutService.deteksi(menit_threshold=1) == 0
    assert state["queried_under_lock"] is True


def test_deteksi_tidak_menutup_sesi_yang_baru_sync(app_ctx, monkeypatch):
    sesi = Sesi(
        tipe="guest", nama_guest="Tamu", status="aktif",
        mulai_pada=now_local() - timedelta(minutes=90),
        last_sync=now_local() - timedelta(minutes=30),
        durasi_beli_menit=60, total_bayar=6000,
    )
    db.session.add(sesi)
    db.session.commit()

    original = SesiRepository.get_aktif_belum_suspect_lama_sync

    def fake(batas_waktu):
        rows = original(batas_waktu)
        db.session.execute(
            db.update(Sesi).where(Sesi.id == rows[0].id).values(last_sync=now_local())
        )
        db.session.commit()
        return rows

    monkeypatch.setattr(SesiRepository, "get_aktif_belum_suspect_lama_sync", fake)

    assert BlackoutService.deteksi(menit_threshold=1) == 0
    db.session.refresh(sesi)
    assert sesi.status == "aktif"

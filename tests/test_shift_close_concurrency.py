import threading

import pytest

from app import create_app, db
from app.models import ShiftRecord, User
from app.services.shift.shift_service import ShiftService


@pytest.fixture
def race_ctx(tmp_path):
    db_path = (tmp_path / "shift_close.db").as_posix()
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
    })
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_race", nama_lengkap="Kasir Race", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        shift = ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="AKTIF")
        db.session.add(shift)
        db.session.commit()
        shift_id = shift.id
    yield app, shift_id
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_end_shift_dari_dua_thread_hanya_satu_menang(race_ctx):
    app, shift_id = race_ctx
    results = []
    barrier = threading.Barrier(2)

    def close(uang_fisik):
        with app.app_context():
            barrier.wait()
            try:
                ShiftService.end_shift(shift_id, uang_fisik, operator="kasir_race")
                results.append(("ok", uang_fisik))
            except ValueError as exc:
                results.append(("error", str(exc)))
            finally:
                db.session.remove()

    threads = [threading.Thread(target=close, args=(nominal,)) for nominal in (1000, 2000)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    kinds = sorted(kind for kind, _ in results)
    assert kinds == ["error", "ok"], results
    pesan = next(value for kind, value in results if kind == "error")
    assert "Shift sudah ditutup sebelumnya" in pesan

    with app.app_context():
        stored = db.session.get(ShiftRecord, shift_id)
        assert stored.status == "SELESAI"
        pemenang = next(value for kind, value in results if kind == "ok")
        assert stored.uang_fisik == pemenang

import pytest

from app import create_app, db
from app.models import Grup, PC, HardwareMonitor


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="vip")
        db.session.add(grup)
        db.session.commit()
        aktif = PC(kode="TM-01", grup_id=grup.id, aktif=True)
        arsip = PC(kode="TM-02", grup_id=grup.id, aktif=False)
        db.session.add_all([aktif, arsip])
        db.session.commit()
        db.session.add(HardwareMonitor(
            pc_id=aktif.id, cpu_name="Intel & Co",
            gpu_name="</script><script>alert(1)</script>",
        ))
        db.session.commit()
        app.config["_SPECS_CACHE"] = {"body": None, "expires": 0.0}
        yield app.test_client()


def test_katalog_spesifikasi_tidak_bisa_menutup_script(client):
    body = client.get("/spesifikasi").get_data(as_text=True)
    assert "</script><script>alert(1)" not in body
    assert r"\u003c/script>" in body

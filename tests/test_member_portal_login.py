# tests/test_member_portal_login.py
"""Regresi: portal member menolak akun yang masa aktifnya sudah kadaluarsa.

Ditemukan saat E2E Task 7: POST /member/login hanya memeriksa username, status
aktif, dan password, sehingga member kadaluarsa tetap mendapat sesi portal.
"""
from datetime import timedelta

import pytest

from app import create_app
from app.models import db, Grup, Member, now_local

EXPIRED = "regresi_portal_expired"
ACTIVE = "regresi_portal_aktif"


@pytest.fixture
def client(tmp_path):
    test_instance = tmp_path / "instance"
    test_instance.mkdir()
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'portal_login_warnet.db'}",
        "INSTANCE_PATH": str(test_instance),
        "PROJECT_ROOT": str(tmp_path),
        "WTF_CSRF_ENABLED": False,
    })
    with app.app_context():
        db.create_all()
        if not Grup.query.filter_by(nama="reguler").first():
            db.session.add(Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888"))
            db.session.commit()

        grup = Grup.query.filter_by(nama="reguler").first()
        for username, kadaluarsa in (
            (EXPIRED, now_local() - timedelta(days=1)),
            (ACTIVE, now_local() + timedelta(days=30)),
        ):
            member = Member.query.filter_by(username=username).first()
            if not member:
                member = Member(username=username, grup_id=grup.id, waktu_tersimpan=30)
                db.session.add(member)
            member.kadaluarsa_pada = kadaluarsa
            member.aktif = True
            member.set_password("pass123")
        db.session.commit()

        yield app.test_client()

        db.session.remove()
        db.drop_all()


def test_member_kadaluarsa_ditolak_login_portal(client):
    resp = client.post("/member/login", json={"username": EXPIRED, "password": "pass123"})

    assert resp.status_code == 403
    body = resp.get_json()
    assert "kadaluarsa" in body["error"].lower()
    assert "success" not in body

    # Tidak ada sesi portal yang terbentuk: dashboard memantul ke halaman login.
    dashboard = client.get("/member")
    assert dashboard.status_code == 302
    assert "/member/login" in dashboard.headers["Location"]


def test_member_aktif_tetap_bisa_login_portal(client):
    resp = client.post("/member/login", json={"username": ACTIVE, "password": "pass123"})

    assert resp.status_code == 200
    assert resp.get_json()["success"] is True
    assert client.get("/member").status_code == 200

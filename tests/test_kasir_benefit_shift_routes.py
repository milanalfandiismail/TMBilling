# tests/test_kasir_benefit_shift_routes.py

import pytest
from app import create_app, db
from app.models import User, ShiftRecord

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "test-secret"
    with app.app_context():
        db.create_all()
        with app.test_client() as c:
            yield c
        db.session.remove()
        db.drop_all()

def test_user_reset_kuota_endpoint(client):
    admin = User.query.filter_by(username="admin").first()
    kasir = User(
        username="kasir_joko",
        role="kasir",
        kuota_main_bulanan=1200,
        sisa_kuota_menit=100
    )
    kasir.set_password("joko123")
    db.session.add(kasir)
    db.session.commit()

    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = "admin"
        sess["kasir_role"] = "admin"

    res = client.post(f"/api/v1/kasir/user/{kasir.id}/reset-kuota")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["user"]["sisa_kuota_menit"] == 1200

def test_shift_end_with_catatan_and_receipt(client):
    kasir = User(username="kasir_rudi", role="kasir")
    kasir.set_password("rudi123")
    db.session.add(kasir)
    db.session.commit()

    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir.id
        sess["kasir_username"] = "kasir_rudi"
        sess["kasir_role"] = "kasir"

    # Start shift
    res_start = client.post("/api/v1/kasir/shift/start", json={"modal_awal": 50000})
    assert res_start.status_code == 201
    shift_id = res_start.get_json()["shift"]["id"]

    # End shift with catatan
    res_end = client.post("/api/v1/kasir/shift/end", json={
        "uang_fisik": 50000,
        "catatan": "Shift aman, selisih 0"
    })
    assert res_end.status_code == 200
    end_data = res_end.get_json()
    assert end_data["success"] is True
    assert end_data["result"]["catatan"] == "Shift aman, selisih 0"

    # Get receipt
    res_rcpt = client.get(f"/api/v1/kasir/shift/receipt/{shift_id}")
    assert res_rcpt.status_code == 200
    rcpt_data = res_rcpt.get_json()
    assert rcpt_data["success"] is True
    assert "STRUK SERAH TERIMA SHIFT" in rcpt_data["receipt_text"]
    assert "Shift aman, selisih 0" in rcpt_data["receipt_text"]

    # Get single shift summary
    res_summ = client.get(f"/api/v1/kasir/shift/{shift_id}/summary")
    assert res_summ.status_code == 200
    summ_data = res_summ.get_json()
    assert summ_data["success"] is True
    assert summ_data["summary"]["kasir_nama"] == "kasir_rudi"
    assert summ_data["summary"]["shift_id"] == shift_id

    # Get history with filters
    res_hist = client.get(f"/api/v1/kasir/shift/history?limit=5&offset=0&kasir_id={kasir.id}")
    assert res_hist.status_code == 200
    hist_data = res_hist.get_json()
    assert hist_data["success"] is True
    assert hist_data["shifts"]["total"] == 1
    assert len(hist_data["shifts"]["data"]) == 1

def test_user_reset_kuota_errors(client):
    admin = User.query.filter_by(username="admin").first()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = "admin"
        sess["kasir_role"] = "admin"

    # User not found
    res = client.post("/api/v1/kasir/user/99999/reset-kuota")
    assert res.status_code == 400

    # User is admin (not kasir)
    res_admin = client.post(f"/api/v1/kasir/user/{admin.id}/reset-kuota")
    assert res_admin.status_code == 400
    assert "Hanya akun kasir" in res_admin.get_json()["error"]


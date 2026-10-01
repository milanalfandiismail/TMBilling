import pytest
from app import create_app, db
from app.models import PC, Grup, User, MenuItem, Turnamen, TurnamenTahap, TurnamenTim, TurnamenMatch
from app.services.pc.pc_service import PCService
from app.services.tournament.tournament_service import TournamentService
from app.services.menu.menu_service import MenuService


@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        db.create_all()

        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin")
            admin.set_password("admin123")
            db.session.add(admin)

        grup = Grup(nama="Reguler", warna="#112233")
        db.session.add(grup)
        db.session.flush()

        pc = PC(kode="PC-01", nama="PC 01", grup_id=grup.id, ip_address="192.168.1.10", mac_address="AA:BB:CC:DD:EE:01")
        db.session.add(pc)

        menu = MenuItem(nama="Kopi Susu", harga=10000, stok=20, is_active=True)
        db.session.add(menu)

        # Buat Turnamen untuk test
        turnamen = Turnamen(nama="Cup 2026", status="aktif")
        db.session.add(turnamen)
        db.session.flush()

        tahap = TurnamenTahap(turnamen_id=turnamen.id, nama="Group Stage", urutan=1, tipe_format="swiss", status="aktif")
        db.session.add(tahap)
        db.session.flush()

        tim1 = TurnamenTim(turnamen_id=turnamen.id, nama_tim="Tim Alpha")
        tim2 = TurnamenTim(turnamen_id=turnamen.id, nama_tim="Tim Beta")
        db.session.add_all([tim1, tim2])
        db.session.flush()

        match = TurnamenMatch(turnamen_id=turnamen.id, tahap_id=tahap.id, tim1_id=tim1.id, tim2_id=tim2.id, round_number=1, match_number=1)
        db.session.add(match)

        db.session.commit()

        yield app, pc.id, menu.id, tahap.id, match.id, admin.id

        db.session.remove()
        db.drop_all()


def test_pc_service_validates_ip_and_mac(app_ctx):
    app, pc_id, *_ = app_ctx

    with app.app_context():
        # Valid create
        new_pc = PCService.create({
            "kode": "PC-02",
            "nama": "PC 02",
            "grup": "Reguler",
            "ip_address": "192.168.1.20",
            "mac_address": "aa-bb-cc-dd-ee-02"
        })
        assert new_pc.ip_address == "192.168.1.20"
        assert new_pc.mac_address == "AA:BB:CC:DD:EE:02"

        # Invalid IP in create
        with pytest.raises(ValueError, match="Format alamat IP tidak valid"):
            PCService.create({
                "kode": "PC-03",
                "nama": "PC 03",
                "grup": "Reguler",
                "ip_address": "invalid-ip"
            })

        # Invalid MAC in create
        with pytest.raises(ValueError, match="Format alamat MAC address tidak valid"):
            PCService.create({
                "kode": "PC-04",
                "nama": "PC 04",
                "grup": "Reguler",
                "mac_address": "ZZ:ZZ:ZZ:ZZ:ZZ:ZZ"
            })

        # Invalid IP in update
        with pytest.raises(ValueError, match="Format alamat IP tidak valid"):
            PCService.update(pc_id, {"ip_address": "999.999.999.999"})

        # Invalid MAC in update
        with pytest.raises(ValueError, match="Format alamat MAC address tidak valid"):
            PCService.update(pc_id, {"mac_address": "123"})


def test_pc_service_validates_position(app_ctx):
    app, pc_id, *_ = app_ctx

    with app.app_context():
        # Valid update_position
        pc = PCService.update_position(pc_id, 150, 300)
        assert pc.pos_x == 150
        assert pc.pos_y == 300

        # Out of bounds X
        with pytest.raises(ValueError, match="Posisi X"):
            PCService.update_position(pc_id, -5, 300)

        with pytest.raises(ValueError, match="Posisi X"):
            PCService.update_position(pc_id, 20000, 300)

        # Out of bounds Y
        with pytest.raises(ValueError, match="Posisi Y"):
            PCService.update_position(pc_id, 150, -1)

        with pytest.raises(ValueError, match="Posisi Y"):
            PCService.update_position(pc_id, 150, 15000)


def test_tournament_score_validation(app_ctx):
    app, _, _, _, match_id, _ = app_ctx

    with app.app_context():
        # Negative score
        with pytest.raises(ValueError, match="Skor tim 1"):
            TournamentService.update_match_skor(match_id=match_id, data={"skor1": -1, "skor2": 2})

        # Score exceeding max 999
        with pytest.raises(ValueError, match="Skor tim 2"):
            TournamentService.update_match_skor(match_id=match_id, data={"skor1": 1, "skor2": 1000})


def test_tournament_finish_stage_validation(app_ctx):
    app, _, _, stage_id, _, _ = app_ctx

    with app.app_context():
        with pytest.raises(ValueError, match="Harap pilih tim"):
            TournamentService.finish_stage(stage_id=stage_id, selected_team_ids="not-a-list")


def test_menu_checkout_validation(app_ctx):
    app, _, menu_id, _, _, _ = app_ctx

    with app.app_context():
        cart = [{"menu_id": menu_id, "jumlah": 2}]

        # Invalid payment method
        with pytest.raises(ValueError, match="Metode pembayaran tidak valid"):
            MenuService.checkout_menu_order(
                cart_items=cart,
                pc_kode="PC-01",
                kasir_username="admin",
                metode_pembayaran="Bitcoin"
            )

        # Valid non-cash checkout
        orders = MenuService.checkout_menu_order(
            cart_items=cart,
            pc_kode="PC-01",
            kasir_username="admin",
            metode_pembayaran="QRIS"
        )
        assert len(orders) == 1
        assert orders[0]["total_harga"] == 20000

        # Tunai kurang dari total tagihan
        with pytest.raises(ValueError, match="Uang tunai"):
            MenuService.checkout_menu_order(
                cart_items=cart,
                pc_kode="PC-01",
                kasir_username="admin",
                metode_pembayaran="Tunai",
                tunai=10000  # Total 20.000
            )


def test_settings_auto_shutdown_route_returns_400_on_invalid_range(app_ctx):
    app, _, _, _, _, admin_id = app_ctx
    client = app.test_client()

    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_username"] = "admin"
        sess["kasir_role"] = "admin"

    # Out of range (under 30)
    res = client.put("/api/v1/kasir/settings/auto-shutdown", json={"timer_seconds": 10})
    assert res.status_code == 400
    assert "Timer Auto-Shutdown" in res.get_json()["error"]

    # Out of range (over 600)
    res = client.put("/api/v1/kasir/settings/auto-shutdown", json={"timer_seconds": 700})
    assert res.status_code == 400
    assert "Timer Auto-Shutdown" in res.get_json()["error"]

    # Valid
    res = client.put("/api/v1/kasir/settings/auto-shutdown", json={"timer_seconds": 120})
    assert res.status_code == 200
    assert res.get_json()["success"] is True

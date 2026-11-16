import pytest
from app import create_app
from app.models import db, MenuItem, TransaksiMenu
from app.services.report.log_audit_service import LogAuditService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        menu = MenuItem(nama="Kopi", harga=5000, stok=10)
        db.session.add(menu); db.session.commit()
        db.session.add(TransaksiMenu(menu_id=menu.id, jumlah=1, total_harga=5000,
                                     no_nota="TMM-20260101-1", operator="kasir1"))
        db.session.commit()
        yield app


def test_clear_all_menghapus_transaksi_kantin(ctx):
    with ctx.app_context():
        assert LogAuditService.clear_all_transactions(operator="admin") is True
        assert TransaksiMenu.query.count() == 0

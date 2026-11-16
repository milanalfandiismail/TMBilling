import pytest
from app import create_app, db
from app.models import User
from app.services.shift.shift_service import ShiftService


def test_inactive_cashier_cannot_start_shift():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-shift-active"})
    with app.app_context():
        db.create_all()
        u = User(username="kasir", nama_lengkap="Kasir", role="kasir", aktif=False)
        u.set_password("x"); db.session.add(u); db.session.commit()
        with pytest.raises(ValueError, match="tidak aktif"):
            ShiftService.start_shift("kasir", 0)

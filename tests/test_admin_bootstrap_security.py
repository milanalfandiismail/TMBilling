import os
import pytest
from app import create_app, db
from app.models import User

def test_bootstrap_admin_never_uses_hardcoded_admin123(tmp_path):
    """Memastikan inisialisasi database kosong tidak membuat admin dengan password default 'admin123'."""
    test_instance = tmp_path / "instance"
    test_instance.mkdir()
    test_db = tmp_path / "clean_warnet.db"

    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{test_db}",
        "INSTANCE_PATH": str(test_instance),
        "PROJECT_ROOT": str(tmp_path),
    })

    with app.app_context():
        # Karena create_app() sudah menjalankan bootstrap di DB kosong clean_warnet.db:
        admin = User.query.filter_by(username="admin").first()
        assert admin is not None
        assert not admin.check_password("admin123")
        
        info_file = tmp_path / "initial_admin.txt"
        assert info_file.exists()
        content = info_file.read_text(encoding="utf-8")
        assert "Username: admin" in content
        assert "Password:" in content
        db.session.remove()
        db.drop_all()

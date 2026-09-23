# tests/test_system_routes_validation.py
import pytest
from app import create_app, db
from app.services.settings.db_maintenance_service import DBMaintenanceService
from app.utils.validators import validate_filename, validate_integer_range, validate_choice, validate_string_length


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_db_maintenance_retention_validation(app_context):
    # Invalid retention choice (e.g. 5 months)
    with pytest.raises(ValueError, match="Masa Retensi"):
        DBMaintenanceService.purge_and_vacuum(5)

    # Valid retention numbers
    assert validate_choice(1, [1, 3, 6, 12], "Masa Retensi") == 1
    assert validate_choice(6, [1, 3, 6, 12], "Masa Retensi") == 6


def test_backup_validation():
    # Valid backup zip
    assert validate_filename("warnet_backup_2026.zip", allowed_extensions={"zip"}, field_name="Berkas Backup") == "warnet_backup_2026.zip"

    # Traversal in backup filename
    with pytest.raises(ValueError, match="Akses tidak sah"):
        validate_filename("../etc/passwd.zip", allowed_extensions={"zip"}, field_name="Berkas Backup")

    # Invalid provider
    with pytest.raises(ValueError, match="Provider Backup"):
        validate_choice("dropbox", ["discord", "webdav", "gdrive", "nas"], field_name="Provider Backup")


def test_mikrotik_validation():
    # Valid port & username
    assert validate_integer_range(8728, 1, 65535, "Port MikroTik") == 8728
    assert validate_string_length("admin_mt", min_len=1, max_len=64, field_name="Username MikroTik") == "admin_mt"

    # Out of range port
    with pytest.raises(ValueError, match="Port MikroTik"):
        validate_integer_range(70000, 1, 65535, "Port MikroTik")


def test_settings_auto_shutdown_validation():
    # Valid auto shutdown timer (30 - 600 detik)
    assert validate_integer_range(180, 30, 600, "Timer Auto-Shutdown") == 180

    with pytest.raises(ValueError, match="Timer Auto-Shutdown"):
        validate_integer_range(10, 30, 600, "Timer Auto-Shutdown")


def test_client_api_key_validation():
    # Valid (4 to 128 characters)
    assert validate_string_length("TM01", min_len=4, max_len=128, field_name="Client API Key") == "TM01"
    assert validate_string_length("TM2026QWERTY-api-key", min_len=4, max_len=128, field_name="Client API Key") == "TM2026QWERTY-api-key"

    # Too short (< 4 chars)
    with pytest.raises(ValueError, match="Client API Key minimal 4 karakter"):
        validate_string_length("TM1", min_len=4, max_len=128, field_name="Client API Key")

    # Empty
    with pytest.raises(ValueError, match="Client API Key tidak boleh kosong"):
        validate_string_length("   ", min_len=4, max_len=128, field_name="Client API Key")

    # Too long (> 128 chars)
    with pytest.raises(ValueError, match="Client API Key maksimal 128 karakter"):
        validate_string_length("A" * 129, min_len=4, max_len=128, field_name="Client API Key")

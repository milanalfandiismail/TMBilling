from pathlib import Path
import app as app_module


def test_application_factory_tidak_memakai_alter_table():
    source = Path(app_module.__file__).read_text(encoding="utf-8")
    assert "ALTER TABLE" not in source

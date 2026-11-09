from pathlib import Path


def test_migration_polls_existing_auth_endpoint():
    source = Path("app/static/js/kasir/modules/settings/migration.js").read_text(encoding="utf-8")
    assert "/api/v1/kasir/auth/check" in source
    assert "fetch('/api/v1/auth/check'" not in source

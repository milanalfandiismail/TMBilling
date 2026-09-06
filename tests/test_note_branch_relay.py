# tests/test_note_branch_relay.py
import pytest
import os
import shutil
import tempfile
from app import create_app
from app.models import db, User
from app.services.settings.settings_service import SettingsService
from app.services.notes.note_service import NoteService

@pytest.fixture
def note_app():
    test_dir = tempfile.mkdtemp()
    notes_test_dir = os.path.join(test_dir, 'instance', 'notes')
    os.makedirs(notes_test_dir, exist_ok=True)

    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False

    orig_notes_dir = NoteService.get_notes_dir
    NoteService.get_notes_dir = classmethod(lambda cls: os.path.realpath(notes_test_dir))

    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        client = app.test_client()
        yield client, app

        db.session.remove()
        db.drop_all()

    NoteService.get_notes_dir = orig_notes_dir
    shutil.rmtree(test_dir, ignore_errors=True)

def test_notes_api_accepts_bearer_branch_key(note_app):
    """Memastikan endpoint /api/v1/kasir/notes dapat diakses via Bearer API Key cabang tanpa session cookie."""
    client, app = note_app
    with app.app_context():
        branch_key = SettingsService.get_or_create_branch_api_key()

    headers = {
        "Authorization": f"Bearer {branch_key}",
        "X-Operator-Username": "admin_remote",
        "X-Origin-Branch-Name": "Cabang Barat"
    }

    res = client.get('/api/v1/kasir/notes', headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "notes" in data

def test_notes_api_rejects_invalid_bearer_key(note_app):
    """Memastikan Bearer key palsu ditolak 403."""
    client, app = note_app
    headers = {"Authorization": "Bearer invalid-wrong-key-xyz"}
    res = client.get('/api/v1/kasir/notes', headers=headers)
    assert res.status_code == 403

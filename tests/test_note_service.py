import sys
import os
import shutil
import tempfile
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import create_app
from app.services.notes.note_service import NoteService

@pytest.fixture
def app():
    test_dir = tempfile.mkdtemp()
    notes_test_dir = os.path.join(test_dir, 'instance', 'notes')
    os.makedirs(notes_test_dir, exist_ok=True)
    
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    
    # Simpan instance_path asli & override ke test_dir
    orig_notes_dir = NoteService.get_notes_dir
    NoteService.get_notes_dir = classmethod(lambda cls: os.path.realpath(notes_test_dir))
    
    yield app
    
    # Cleanup
    NoteService.get_notes_dir = orig_notes_dir
    shutil.rmtree(test_dir, ignore_errors=True)

@pytest.fixture
def client(app):
    with app.test_client() as client:
        yield client

def test_note_service_crud_lifecycle():
    # 1. Create Note
    note = NoteService.create_note("Catatan Operasional Shift Pagi", "Uang kas kecil awal: Rp 200.000\nPC-04 keyboard dicek.")
    assert note is not None
    assert note['filename'] == "Catatan Operasional Shift Pagi.txt"
    assert note['title'] == "Catatan Operasional Shift Pagi"
    assert "Uang kas kecil" in note['content']
    assert note['size'] > 0

    # 2. List Notes
    notes = NoteService.list_notes()
    assert len(notes) >= 1
    found = any(n['filename'] == "Catatan Operasional Shift Pagi.txt" for n in notes)
    assert found is True

    # 3. Get Note
    fetched = NoteService.get_note("Catatan Operasional Shift Pagi.txt")
    assert fetched['title'] == "Catatan Operasional Shift Pagi"
    assert "PC-04 keyboard dicek" in fetched['content']

    # 4. Save & Update Note (Content + Rename)
    updated = NoteService.save_note(
        "Catatan Operasional Shift Pagi.txt",
        "Uang kas kecil awal: Rp 200.000\nPC-04 keyboard sudah diganti baru.",
        new_title="Catatan Shift Pagi Final"
    )
    assert updated['filename'] == "Catatan Shift Pagi Final.txt"
    assert "sudah diganti baru" in updated['content']

    # Old file should no longer exist
    with pytest.raises(FileNotFoundError):
        NoteService.get_note("Catatan Operasional Shift Pagi.txt")

    # 5. Delete Note
    deleted = NoteService.delete_note("Catatan Shift Pagi Final.txt")
    assert deleted is True

    # After delete, get should raise FileNotFoundError
    with pytest.raises(FileNotFoundError):
        NoteService.get_note("Catatan Shift Pagi Final.txt")

def test_note_service_directory_traversal_prevention():
    # Attempting to read or delete file outside notes dir should be blocked
    sanitized = NoteService.sanitize_filename("windows_system32_cmd.exe")
    assert sanitized == "windows_system32_cmd.exe.txt"

    # Target path validation directly rejecting traversal
    with pytest.raises(ValueError):
        NoteService.validate_path("../outside.txt")

    with pytest.raises(ValueError):
        NoteService.validate_path("../../etc/passwd")

def test_note_routes_authenticated(client):
    # Set session login
    with client.session_transaction() as sess:
        sess['kasir_id'] = 1
        sess['kasir_username'] = 'operator_test'
        sess['kasir_role'] = 'kasir'

    # 1. POST /api/v1/kasir/notes
    create_res = client.post('/api/v1/kasir/notes', json={
        "title": "Daftar Belanja Kantin",
        "content": "- Indomie Goreng 2 Dus\n- Kopi Kapal Api 1 Renteng"
    })
    assert create_res.status_code == 201
    created_json = create_res.get_json()
    assert created_json['success'] is True
    filename = created_json['note']['filename']
    assert filename == "Daftar Belanja Kantin.txt"

    # 2. GET /api/v1/kasir/notes
    list_res = client.get('/api/v1/kasir/notes')
    assert list_res.status_code == 200
    list_json = list_res.get_json()
    assert list_json['success'] is True
    assert len(list_json['notes']) >= 1

    # 3. GET /api/v1/kasir/notes/<filename>
    get_res = client.get(f'/api/v1/kasir/notes/{filename}')
    assert get_res.status_code == 200
    get_json = get_res.get_json()
    assert "Indomie Goreng" in get_json['note']['content']

    # 4. PUT /api/v1/kasir/notes/<filename>
    put_res = client.put(f'/api/v1/kasir/notes/{filename}', json={
        "title": "Daftar Belanja Kantin Minggu Ini",
        "content": "- Indomie Goreng 2 Dus\n- Kopi Kapal Api 1 Renteng\n- Teh Kotak 1 Dus"
    })
    assert put_res.status_code == 200
    new_filename = put_res.get_json()['note']['filename']
    assert new_filename == "Daftar Belanja Kantin Minggu Ini.txt"

    # 5. POST /api/v1/kasir/notes/<filename>/pin
    pin_res = client.post(f'/api/v1/kasir/notes/{new_filename}/pin')
    assert pin_res.status_code == 200
    pin_json = pin_res.get_json()
    assert pin_json['success'] is True
    assert pin_json['result']['is_pinned'] is True

    # 6. POST /api/v1/kasir/notes/<filename>/duplicate
    dup_res = client.post(f'/api/v1/kasir/notes/{new_filename}/duplicate')
    assert dup_res.status_code == 201
    dup_json = dup_res.get_json()
    assert dup_json['success'] is True
    dup_filename = dup_json['note']['filename']
    assert "(Salinan)" in dup_filename

    # 7. GET /api/v1/kasir/notes/<filename>/download
    dl_res = client.get(f'/api/v1/kasir/notes/{new_filename}/download')
    assert dl_res.status_code == 200
    assert b"Teh Kotak" in dl_res.data
    assert "text/plain" in dl_res.content_type
    dl_res.close()

    # 8. DELETE /api/v1/kasir/notes/<filename>
    del_res = client.delete(f'/api/v1/kasir/notes/{new_filename}')
    assert del_res.status_code == 200
    assert del_res.get_json()['success'] is True

    del_dup_res = client.delete(f'/api/v1/kasir/notes/{dup_filename}')
    assert del_dup_res.status_code == 200

def test_note_service_pin_sorting_and_duplicate():
    n1 = NoteService.create_note("Zebra Normal", "Konten zebra biasa")
    n2 = NoteService.create_note("Alpha Penting", "SOP penting warnet")

    # Awalnya Zebra lebih baru daripada Alpha karena dibuat setelahnya
    notes_init = NoteService.list_notes()
    assert notes_init[0]['filename'] == "Alpha Penting.txt" or notes_init[0]['filename'] == "Zebra Normal.txt"

    # Pin Alpha Penting -> Harus selalu di index 0
    pinned_res = NoteService.toggle_pin("Alpha Penting.txt")
    assert pinned_res['is_pinned'] is True

    notes_after_pin = NoteService.list_notes()
    assert notes_after_pin[0]['filename'] == "Alpha Penting.txt"
    assert notes_after_pin[0]['is_pinned'] is True

    # Duplicate Alpha Penting
    copy_note = NoteService.duplicate_note("Alpha Penting.txt")
    assert "Alpha Penting (Salinan).txt" == copy_note['filename']
    assert "SOP penting warnet" in copy_note['content']

    # Search filter by content
    searched = NoteService.list_notes(query="zebra biasa")
    assert len(searched) == 1
    assert searched[0]['filename'] == "Zebra Normal.txt"

    # Cleanup
    NoteService.delete_note("Zebra Normal.txt")
    NoteService.delete_note("Alpha Penting.txt")
    NoteService.delete_note(copy_note['filename'])

def test_note_routes_unauthenticated(client):
    # Without session, should return 401
    res = client.get('/api/v1/kasir/notes')
    assert res.status_code == 401
    assert res.get_json()['success'] is False

# tests/test_fileexplorer_api.py
import json
import tempfile
import pytest
from app import create_app, db
from app.models import User
from app.services.fileexplorer.fileexplorer_service import FileExplorerService

@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            admin = User.query.filter_by(username="admin").first()
            if not admin:
                admin = User(username="admin", nama_lengkap="Admin", role="admin", aktif=True)
                admin.set_password("admin123")
                db.session.add(admin)
                db.session.commit()
            
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
                sess["kasir_username"] = admin.username
                sess["kasir_role"] = "admin"
                sess["kasir_nama"] = admin.nama_lengkap
            yield client
            db.session.remove()

def test_api_roots_get_and_post(client_with_admin):
    # GET Roots
    res = client_with_admin.get("/api/v1/kasir/fileexplorer/roots")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "roots" in data
    
    # POST Roots
    with tempfile.TemporaryDirectory() as tmpdir:
        import os
        real_tmpdir = os.path.realpath(tmpdir)
        post_res = client_with_admin.post("/api/v1/kasir/fileexplorer/roots", json={"roots": [real_tmpdir]})
        assert post_res.status_code == 200
        post_data = post_res.get_json()
        assert post_data["success"] is True
        assert real_tmpdir in post_data["roots"]

def test_api_list_read_save_cycle(client_with_admin):
    with tempfile.TemporaryDirectory() as tmpdir:
        import os
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Create file via API
        c_res = client_with_admin.post("/api/v1/kasir/fileexplorer/create", json={
            "parent_path": real_tmpdir,
            "name": "sample.py",
            "is_dir": False
        })
        assert c_res.status_code == 200
        file_path = c_res.get_json()["path"]
        
        # Save file via API
        s_res = client_with_admin.post("/api/v1/kasir/fileexplorer/save", json={
            "path": file_path,
            "content": "print('hello from api test')"
        })
        assert s_res.status_code == 200
        
        # Read file via API
        r_res = client_with_admin.get(f"/api/v1/kasir/fileexplorer/read?path={file_path}")
        assert r_res.status_code == 200
        assert r_res.get_json()["content"] == "print('hello from api test')"

def test_api_unauthorized_access(client_with_admin):
    # Log out session / change role to kasir
    with client_with_admin.session_transaction() as sess:
        sess["kasir_role"] = "kasir"
        
    res = client_with_admin.get("/api/v1/kasir/fileexplorer/roots")
    assert res.status_code == 403
    assert res.get_json()["success"] is False

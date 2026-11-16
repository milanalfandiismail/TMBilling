from app import create_app
from app.services.notes.note_service import NoteService


def test_rename_to_existing_note_uses_unique_name(tmp_path, monkeypatch):
    monkeypatch.setenv("TM_NOTES_DIR", str(tmp_path))
    app = create_app({"TESTING": True, "SECRET_KEY": "test-notes"})
    with app.app_context():
        NoteService.create_note("A", "isi A")
        NoteService.create_note("B", "isi B")
        result = NoteService.save_note("B.txt", "isi B baru", new_title="A")
        assert result["filename"] == "A_1.txt"
        assert (tmp_path / "A.txt").read_text(encoding="utf-8") == "isi A"

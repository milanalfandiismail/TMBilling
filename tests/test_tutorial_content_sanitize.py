import pytest

from app import create_app, db
from app.services.tutorial.tutorial_service import TutorialService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_tutorial_menyanitasi_konten(ctx):
    tutorial = TutorialService.create({
        "title": "Panduan XSS",
        "category": "Umum",
        "content": "<p>Aman</p><script>alert(1)</script>",
    })
    assert "<script>" not in tutorial.content
    assert "alert(1)" not in tutorial.content
    assert "<p>Aman</p>" in tutorial.content


def test_update_tutorial_menyanitasi_konten(ctx):
    tutorial = TutorialService.create({
        "title": "Panduan Update",
        "category": "Umum",
        "content": "<p>Awal</p>",
    })
    hasil = TutorialService.update(tutorial.id, {"content": "<p>Baru</p><img src=x onerror=alert(1)>"})
    assert "onerror" not in hasil.content
    assert "<p>Baru</p>" in hasil.content

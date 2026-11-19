import pathlib
import re

import pytest

from app import create_app, db


@pytest.fixture()
def app():
    application = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                              "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


ROOT = pathlib.Path(__file__).resolve().parent.parent / "app"
POLA = re.compile(r"\.query\.get\(")


def test_tidak_ada_api_query_get_legacy():
    offenders = []
    for path in ROOT.rglob("*.py"):
        for i, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if POLA.search(line):
                offenders.append(f"{path.relative_to(ROOT.parent).as_posix()}:{i}")
    assert offenders == []


def test_db_session_get_menerima_id_string(app):
    from app.models import User

    user = User(username="u-string", role="kasir", aktif=True)
    user.set_password("rahasia123")
    db.session.add(user)
    db.session.commit()

    assert db.session.get(User, str(user.id)).id == user.id
    assert db.session.get(User, 10**9) is None

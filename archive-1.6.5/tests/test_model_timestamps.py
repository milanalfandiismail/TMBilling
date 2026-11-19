"""Semua model memakai now_local(); tidak ada datetime.utcnow yang deprecated."""

import pathlib

from app.models import now_local
from app.models.tutorial.tutorial_model import SystemTutorial

ROOT = pathlib.Path(__file__).resolve().parents[1] / "app" / "models"


def test_tidak_ada_datetime_utcnow_di_model():
    pelanggar = []
    for path in ROOT.rglob("*.py"):
        isi = path.read_text(encoding="utf-8-sig")
        if "datetime.utcnow" in isi:
            pelanggar.append(str(path))
    assert pelanggar == []


def test_tutorial_memakai_now_local():
    # SQLAlchemy membungkus callable (wrap_callable), jadi bandingkan namanya.
    assert SystemTutorial.created_at.default.arg.__name__ == now_local.__name__
    assert SystemTutorial.updated_at.onupdate.arg.__name__ == now_local.__name__

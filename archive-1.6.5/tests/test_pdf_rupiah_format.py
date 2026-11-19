"""Format rupiah pada PDF harus seragam memakai titik ribuan."""
import pathlib

from app.services.report.pdf_export_service import _format_rupiah


def test_format_rupiah_memakai_titik():
    assert _format_rupiah(1234567) == "Rp 1.234.567"
    assert _format_rupiah(0) == "Rp 0"
    assert _format_rupiah(-2500) == "Rp -2.500"


def test_tidak_ada_format_rupiah_lokal():
    sumber = pathlib.Path("app/services/report/pdf_export_service.py").read_text(encoding="utf-8")
    lokal = [baris.strip() for baris in sumber.splitlines()
             if 'f"Rp {' in baris and "_format_rupiah" not in baris]
    assert lokal == []

import pytest

from tests.e2e import run_all_e2e as orchestrator


def test_jobs_auto_mengikuti_cpu(monkeypatch):
    monkeypatch.setattr(orchestrator.os, "cpu_count", lambda: 8)
    assert orchestrator.resolve_jobs(0, 11) == 8
    assert orchestrator.resolve_jobs(0, 3) == 3


def test_jobs_manual_dibatasi_jumlah_suite():
    assert orchestrator.resolve_jobs(2, 11) == 2
    assert orchestrator.resolve_jobs(99, 11) == 11


def test_jobs_tidak_valid_ditolak():
    with pytest.raises(ValueError):
        orchestrator.resolve_jobs(-1, 11)
    with pytest.raises(ValueError):
        orchestrator.resolve_jobs(0, 0)

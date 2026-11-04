"""Test verifikasi entrypoint run.py dan scheduler jobs."""

import pytest


def test_run_module_import_and_scheduler_jobs():
    """Pastikan run.py dapat di-import tanpa NameError dan seluruh job scheduler terdaftar dengan benar."""
    import run

    assert hasattr(run, "app")
    assert hasattr(run, "scheduler")
    assert run.scheduler is not None

    jobs = {j.id: j for j in run.scheduler.get_jobs()}

    expected_jobs = [
        "cleanup_expired",
        "database_backup",
        "cleanup_logs",
        "auto_screenshots",
        "flush_uptime",
        "cleanup_vnc_proxies",
    ]

    for job_id in expected_jobs:
        assert job_id in jobs, f"Job '{job_id}' tidak terdaftar pada scheduler run.py"
        assert callable(jobs[job_id].func), f"Job func '{job_id}' bukan callable"

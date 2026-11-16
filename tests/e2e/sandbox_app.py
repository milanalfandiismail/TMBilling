"""Factory aplikasi untuk sandbox E2E.

Dua tugas:
1. Mengisolasi `instance_path` per suite lewat env `E2E_INSTANCE_PATH`, sehingga
   screenshot/kunci/berkas runtime tidak menulis ke `instance/` produksi.
2. Mencatat setiap `endpoint METHOD` yang benar-benar dipanggil ke `E2E_API_LOG`,
   dipakai `tests/e2e/check_coverage_gate.py` untuk membuktikan tidak ada rute
   yang tertinggal.
"""

import os

from flask import request

from app import create_app as _create_app


def create_app(config_override=None):
    override = dict(config_override or {})
    instance = os.environ.get("E2E_INSTANCE_PATH")
    if instance:
        override.setdefault("INSTANCE_PATH", instance)
    app = _create_app(override or None)

    log_path = os.environ.get("E2E_API_LOG")
    if log_path:
        @app.before_request
        def _log_route():
            if request.url_rule is not None and request.endpoint != "static":
                with open(log_path, "a", encoding="utf-8") as fh:
                    fh.write(f"{request.endpoint} {request.method}\n")

    return app

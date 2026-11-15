import sys

import pytest

pytestmark = pytest.mark.skipif(sys.platform != 'win32', reason='batch Windows')


def test_updater_survives_self_swap(tmp_path):
    from tests.update_sandbox.sandbox import build_sandbox, run_update_bat, assert_clean

    root, _ = build_sandbox(tmp_path)
    res = run_update_bat(root)
    assert_clean(res, root)


def test_update_bat_arg_tidak_klaim_ganda(tmp_path):
    from tests.update_sandbox.sandbox import build_sandbox, run_update_bat, assert_clean

    root, pkg = build_sandbox(tmp_path, zip_mode='arg')
    res = run_update_bat(root, [str(pkg)])
    assert_clean(res, root)

def test_paket_tanpa_verify_versions_tetap_jalan(tmp_path):
    from tests.update_sandbox.sandbox import build_sandbox, run_update_bat, assert_clean

    root, _ = build_sandbox(tmp_path, dengan_verify=False)
    res = run_update_bat(root)
    assert_clean(res, root)
    assert "[PERINGATAN] Paket tidak menyertakan verify_versions.py" in res.stdout

from app.utils import instance_lock


def test_klaim_kedua_ditolak_dan_bisa_diambil_setelah_release(tmp_path):
    assert instance_lock.claim(str(tmp_path)) is True
    try:
        assert instance_lock.claim(str(tmp_path)) is False
    finally:
        instance_lock.release()
    assert instance_lock.claim(str(tmp_path)) is True
    instance_lock.release()
    assert (tmp_path / "server.lock").exists()

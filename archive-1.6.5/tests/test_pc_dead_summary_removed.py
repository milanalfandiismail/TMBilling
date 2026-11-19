from app.services.pc.pc_service import PCService


def test_get_status_summary_sudah_dihapus():
    assert not hasattr(PCService, "get_status_summary")
    assert hasattr(PCService, "get_sesi_map")

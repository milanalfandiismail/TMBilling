from app.utils.helpers import remove_quiet


def test_remove_quiet_menghapus_berkas(tmp_path):
    p = tmp_path / "sisa.png"
    p.write_text("x")
    remove_quiet(str(p))
    assert not p.exists()


def test_remove_quiet_gagal_dicatat(tmp_path, monkeypatch):
    p = tmp_path / "terkunci.png"
    p.write_text("x")
    tercatat = []
    monkeypatch.setattr("app.utils.logger.write_log",
                        lambda kode, pesan, **kw: tercatat.append(kode))

    def gagal_hapus(path):
        raise PermissionError("read-only")

    monkeypatch.setattr("app.utils.helpers.os.remove", gagal_hapus)
    remove_quiet(str(p))
    assert tercatat == ["FILE_REMOVE_ERROR"]

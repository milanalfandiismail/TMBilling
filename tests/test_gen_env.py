from install_scripts.gen_env import build_env


def test_ganti_nilai_walau_placeholder_berubah():
    contoh = "DEBUG_MODE=True\r\nSECRET_KEY=placeholder-lama\r\nCLIENT_API_KEY=placeholder-lama\r\nLAIN=simpan"
    hasil = build_env(contoh, "rahasia-baru", "kunci-baru")
    assert "SECRET_KEY=rahasia-baru" in hasil
    assert "CLIENT_API_KEY=kunci-baru" in hasil
    assert "DEBUG_MODE=False" in hasil
    assert "LAIN=simpan" in hasil
    assert hasil.splitlines() == ["DEBUG_MODE=False", "SECRET_KEY=rahasia-baru", "CLIENT_API_KEY=kunci-baru", "LAIN=simpan"]


def test_tidak_menambah_baris_ganda():
    hasil = build_env("SECRET_KEY=a", "b", "c")
    assert hasil.count("SECRET_KEY=") == 1

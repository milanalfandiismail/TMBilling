from pathlib import Path


def test_updater_tidak_membunuh_semua_pythonw():
    root = Path(__file__).resolve().parents[1]
    teks = (root / "install_scripts" / "updater.bat").read_text(encoding="utf-8")

    assert "taskkill /f /im pythonw.exe" not in teks.lower()
    assert "*run.py*" in teks


def test_update_claim_is_single_flight(tmp_path, monkeypatch):
    from install_scripts import update_claim

    claim_dir = tmp_path / "update.lock"
    monkeypatch.setattr(update_claim, "claim_dir", str(claim_dir))
    monkeypatch.setattr(update_claim, "owner_path", str(claim_dir / "owner"))

    assert update_claim.acquire("web") is True
    assert update_claim.acquire("web") is False
    # Runner mengadopsi klaim milik route, bukan membuat klaim kedua.
    assert update_claim.claim_runner() is True
    assert update_claim.acquire("web") is False
    assert update_claim.is_active() is True

    update_claim.release()
    assert update_claim.is_active() is False
    assert update_claim.acquire("runner") is True
    update_claim.release()

"""Pastikan paket terpasang sama persis dengan pin requirements.txt."""
import sys
from pathlib import Path


def _parse(requirements_path):
    pin = {}
    for line in Path(requirements_path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "==" not in line:
            continue
        nama, versi = line.split("==", 1)
        pin[nama.strip()] = versi.strip()
    return pin


def mismatches(requirements_path, installed=None):
    """Kembalikan daftar paket yang terpasang tidak sesuai pin."""
    pin = _parse(requirements_path)
    if installed is None:
        from importlib import metadata
        installed = {}
        for nama in pin:
            try:
                installed[nama] = metadata.version(nama)
            except metadata.PackageNotFoundError:
                pass
    hasil = []
    for nama, versi in pin.items():
        terpasang = installed.get(nama)
        if terpasang is None:
            hasil.append(f"{nama}=={versi} (tidak terpasang)")
        elif terpasang != versi:
            hasil.append(f"{nama}=={versi} (terpasang {terpasang})")
    return hasil


def main():
    acuan = Path(__file__).resolve().parents[1] / "requirements.txt"
    salah = mismatches(acuan)
    for baris in salah:
        print(f"[VERSI] tidak sesuai: {baris}")
    if salah:
        print("[VERSI] Lingkungan tidak sesuai requirements.txt; migrasi dibatalkan.")
        return 1
    print("[VERSI] Semua paket sesuai requirements.txt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

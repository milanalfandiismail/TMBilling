"""Sinkronisasi / upgrade dependensi Python dari requirements.txt.

Pemakaian:
    .venv\\Scripts\\python.exe scripts\\upgrade_packages.py            # pasang sesuai pin
    .venv\\Scripts\\python.exe scripts\\upgrade_packages.py --latest   # upgrade ke versi terbaru + tulis pin
    .venv\\Scripts\\python.exe scripts\\upgrade_packages.py --check    # lihat paket usang
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQ_PATH = ROOT / "requirements.txt"
BACKUP_DIR = ROOT / "backups"

PIN_RE = re.compile(r"^(?P<name>[A-Za-z0-9][A-Za-z0-9_.-]*)(?P<sep>\s*==\s*)(?P<version>[^\s#;]+)(?P<rest>\s*(?:#.*)?)$")
NAME_RE = re.compile(r"^(?P<name>[A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?:[<>=!~].*)?$")


def requirement_names(text):
    """Nama paket pada requirements.txt (abaikan komentar dan opsi -r/--)."""
    names = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = NAME_RE.match(stripped)
        if match:
            names.append(match.group("name"))
    return names


def parse_pins(text):
    pins = {}
    for line in text.splitlines():
        match = PIN_RE.match(line.strip())
        if match:
            pins[match.group("name").lower()] = match.group("version")
    return pins


def rewrite_pins(text, installed):
    """Ganti versi pin yang berubah; baris dengan operator lain dibiarkan apa adanya."""
    changes = []
    lines = []
    for line in text.splitlines(keepends=True):
        match = PIN_RE.match(line.strip())
        current = installed.get(match.group("name").lower()) if match else None
        if not match or not current or current == match.group("version"):
            lines.append(line)
            continue
        changes.append((match.group("name"), match.group("version"), current))
        newline = "\r\n" if line.endswith("\r\n") else "\n"
        lines.append(f"{match.group('name')}{match.group('sep')}{current}{match.group('rest')}{newline}")
    return "".join(lines), changes


def run(cmd, dry_run):
    print("> " + " ".join(cmd))
    if dry_run:
        return 0
    return subprocess.call(cmd)


def freeze_versions():
    output = subprocess.check_output([sys.executable, "-m", "pip", "freeze"], text=True)
    versions = {}
    for line in output.splitlines():
        if "==" in line and not line.startswith("-"):
            name, version = line.split("==", 1)
            versions[name.strip().lower()] = version.strip()
    return versions


def main():
    parser = argparse.ArgumentParser(description="Upgrade dependensi Python TMBilling")
    parser.add_argument("--latest", action="store_true",
                        help="upgrade semua paket ke versi terbaru lalu perbarui pin requirements.txt")
    parser.add_argument("--check", action="store_true",
                        help="tampilkan paket usang tanpa mengubah apa pun")
    parser.add_argument("--dry-run", action="store_true",
                        help="cetak perintah pip tanpa menjalankannya")
    args = parser.parse_args()

    if sys.prefix == sys.base_prefix:
        print("[GAGAL] Jalankan dengan Python virtual environment: .venv\\Scripts\\python.exe", file=sys.stderr)
        return 1
    if not REQ_PATH.exists():
        print(f"[GAGAL] {REQ_PATH} tidak ditemukan", file=sys.stderr)
        return 1

    pip = [sys.executable, "-m", "pip"]
    if args.check:
        return run(pip + ["list", "--outdated"], args.dry_run)

    if run(pip + ["install", "--upgrade", "pip"], args.dry_run) != 0:
        return 1

    if not args.latest:
        return run(pip + ["install", "-r", str(REQ_PATH)], args.dry_run)

    text = REQ_PATH.read_text(encoding="utf-8")
    names = requirement_names(text)
    if not names:
        print("[GAGAL] Tidak ada paket yang bisa dibaca dari requirements.txt", file=sys.stderr)
        return 1
    if run(pip + ["install", "--upgrade"] + names, args.dry_run) != 0:
        return 1
    if args.dry_run:
        return 0

    new_text, changes = rewrite_pins(text, freeze_versions())
    if not changes:
        print("Semua pin sudah versi terbaru.")
        return 0
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"requirements_{stamp}.txt"
    backup.write_text(text, encoding="utf-8")
    REQ_PATH.write_text(new_text, encoding="utf-8")
    for name, old, new in changes:
        print(f"  {name}: {old} -> {new}")
    print(f"requirements.txt diperbarui ({len(changes)} pin). Salinan lama: {backup.relative_to(ROOT)}")
    print("Lanjutkan dengan: npm run test:unit")
    return 0


if __name__ == "__main__":
    sys.exit(main())

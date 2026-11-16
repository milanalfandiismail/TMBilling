# install_scripts/update_claim.py
"""Klaim tunggal lintas-proses untuk pembaruan server (route dashboard & update.bat).

Direktori `instance/update.lock` dipakai sebagai mutex atomik. Pemilik "web"
dibuat route sebelum paket ZIP dipublikasikan; runner mengadopsinya sehingga
hanya satu updater yang boleh menyentuh staging & rollback.
"""
import os
import shutil
import sys
import time

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
claim_dir = os.path.join(root_dir, "instance", "update.lock")
owner_path = os.path.join(claim_dir, "owner")

# shortcut: klaim basi dinilai dari mtime (30 menit), bukan liveness PID;
# upgrade ke heartbeat bila update resmi bisa melebihi 30 menit.
STALE_SECONDS = 1800


def _stale() -> bool:
    try:
        return time.time() - os.path.getmtime(claim_dir) > STALE_SECONDS
    except OSError:
        return False


def _write_owner(owner: str) -> None:
    with open(owner_path, "w", encoding="utf-8") as f:
        f.write(owner)


def owner() -> str:
    try:
        with open(owner_path, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def acquire(owner_name: str = "web") -> bool:
    """Ambil klaim; False bila pembaruan lain masih berjalan."""
    for _ in range(2):
        try:
            os.makedirs(claim_dir)
        except FileExistsError:
            if _stale():
                shutil.rmtree(claim_dir, ignore_errors=True)
                continue
            return False
        _write_owner(owner_name)
        return True
    return False


def claim_runner() -> bool:
    """Klaim untuk updater.bat; adopsi klaim route web yang belum dijalankan."""
    if not os.path.isdir(claim_dir):
        return acquire("runner")
    if owner() == "web" and not _stale():
        _write_owner("runner")
        os.utime(claim_dir)
        return True
    if _stale():
        shutil.rmtree(claim_dir, ignore_errors=True)
        return acquire("runner")
    return False


def is_active() -> bool:
    return os.path.isdir(claim_dir) and not _stale()


def release() -> None:
    shutil.rmtree(claim_dir, ignore_errors=True)


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "claim"
    if action == "claim":
        ok = claim_runner()
        if not ok:
            print("[UPDATER] Pembaruan lain masih berjalan; klaim ditolak.")
        sys.exit(0 if ok else 1)
    if action == "release":
        release()
        sys.exit(0)
    if action == "active":
        sys.exit(0 if is_active() else 1)
    print(f"[UPDATER] Aksi tidak dikenal: {action}")
    sys.exit(2)

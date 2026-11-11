# install_scripts/extract_update.py
"""Skrip ekstraksi update aman & backup database sebelum migrasi."""
import json
import os
import shutil
import sys
import zipfile
from datetime import datetime

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
instance_dir = os.path.join(root_dir, "instance")
temp_zip = os.path.join(instance_dir, "temp_update.zip")
staging_dir = os.path.join(instance_dir, "staging_update")
journal_path = os.path.join(instance_dir, "update_journal.json")
backups_dir = os.path.join(root_dir, "backups")
db_path = os.path.join(instance_dir, "warnet.db")

SKIP_PREFIXES = (".env", "instance/", "backups/", ".git/")

def is_safe_path(base, path):
    base_abs = os.path.abspath(base)
    target_abs = os.path.abspath(os.path.join(base, path))
    return os.path.commonpath([base_abs]) == os.path.commonpath([base_abs, target_abs])

def backup_database():
    """Cadangkan DB lewat SQLite Backup API agar isi `-wal` ikut tersalin.

    Return False bila backup gagal, supaya pembaruan dibatalkan sebelum
    berkas aplikasi ditimpa.
    """
    if not os.path.exists(db_path):
        return True
    import sqlite3
    os.makedirs(backups_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backups_dir, f"warnet_backup_before_update_{ts}.db")
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(backup_file)
        try:
            src.backup(dst)
        finally:
            src.close()
            dst.close()
        with sqlite3.connect(backup_file) as check:
            if check.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("integrity_check gagal")
        print(f"[UPDATER] Database dicadangkan ke: {backup_file}")
        return True
    except Exception as e:
        print(f"[UPDATER ERROR] Gagal backup database: {e}")
        if os.path.exists(backup_file):
            os.remove(backup_file)
        return False

def _remove_path(path):
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
    elif os.path.exists(path):
        os.remove(path)


def _write_journal(journal):
    tmp = journal_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(journal, f)
    os.replace(tmp, journal_path)


def recover_interrupted_swap() -> bool:
    """Pulihkan pohon aplikasi bila penukaran berkas terputus (kill/power loss).

    Return True bila tidak ada jurnal atau rollback berhasil; False bila
    cadangan yang dibutuhkan hilang sehingga pemulihan otomatis tidak aman.
    """
    if not os.path.exists(journal_path):
        return True
    try:
        with open(journal_path, encoding="utf-8") as f:
            journal = json.load(f)
        rollback_dir = journal["rollback_dir"]
        for entry in reversed(journal["entries"]):
            name = entry["name"]
            dst = os.path.join(root_dir, name)
            backup = os.path.join(rollback_dir, name)
            if entry.get("had_old"):
                if not os.path.exists(backup):
                    if os.path.exists(dst):
                        continue  # pohon lama belum tersentuh
                    print(f"[UPDATER ERROR] Recovery: cadangan {name} tidak ditemukan.")
                    return False
                if os.path.exists(dst):
                    _remove_path(dst)
                os.replace(backup, dst)
            elif entry.get("new_installed"):
                _remove_path(dst)  # path yang sebelumnya tidak ada
        os.remove(journal_path)
        shutil.rmtree(rollback_dir, ignore_errors=True)
        print("[UPDATER] Pemulihan penukaran berkas dari pembaruan sebelumnya selesai.")
        return True
    except Exception as e:
        print(f"[UPDATER ERROR] Pemulihan penukaran berkas gagal: {e}")
        return False


def swap_staging_into_tree(staging):
    """Tukar isi top-level hasil staging ke root_dir, rollback bila gagal di tengah.

    Jurnal `instance/update_journal.json` ditulis sebelum tiap langkah agar
    pemulihan bisa dilanjutkan setelah proses terbunuh atau listrik padam.
    """
    rollback_dir = os.path.join(instance_dir, f"rollback_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    os.makedirs(rollback_dir, exist_ok=True)
    journal = {"rollback_dir": rollback_dir, "staging_dir": staging, "entries": [
        {
            "name": entry,
            "had_old": os.path.exists(os.path.join(root_dir, entry)),
            "old_moved": False,
            "new_installed": False,
        }
        for entry in sorted(os.listdir(staging))
    ]}
    _write_journal(journal)

    try:
        for entry in journal["entries"]:
            name = entry["name"]
            src = os.path.join(staging, name)
            dst = os.path.join(root_dir, name)
            if entry["had_old"]:
                os.replace(dst, os.path.join(rollback_dir, name))
                entry["old_moved"] = True
                _write_journal(journal)
            os.replace(src, dst)
            entry["new_installed"] = True
            _write_journal(journal)
    except Exception:
        recover_interrupted_swap()
        raise

    os.remove(journal_path)
    shutil.rmtree(rollback_dir, ignore_errors=True)


def main():
    if not os.path.exists(temp_zip):
        print("[UPDATER] temp_update.zip tidak ditemukan. Selesai.")
        return 0

    # 0. Pulihkan penukaran berkas yang terputus sebelum menyentuh apa pun
    if not recover_interrupted_swap():
        print("[UPDATER ERROR] Pemulihan file dari pembaruan sebelumnya gagal.")
        print("                 Periksa instance/update_journal.json dan instance/rollback_*, lalu ulangi.")
        return 3

    # 1. Backup database warnet.db — batalkan bila gagal, jangan timpa kode tanpa cadangan
    if not backup_database():
        print("[UPDATER ERROR] Pembaruan dibatalkan karena backup database gagal.")
        return 2

    # 2. Ekstraksi ke folder staging; kode live belum disentuh sampai ekstraksi utuh
    print(f"[UPDATER] Mengekstrak pembaruan ke staging...")
    success = False
    try:
        if os.path.isdir(staging_dir):
            shutil.rmtree(staging_dir)
        os.makedirs(staging_dir, exist_ok=True)

        with zipfile.ZipFile(temp_zip, "r") as zf:
            all_files = zf.namelist()
            norm_files = [f.replace("\\", "/") for f in all_files]
            has_run = any(f == "run.py" for f in norm_files)
            has_app = any(f.startswith("app/") for f in norm_files)
            has_config = any(f == "app/config.py" for f in norm_files)

            if not has_run or not has_app or not has_config:
                print("[UPDATER ERROR] ZIP bukan paket rilis TMBilling yang valid (wajib memuat run.py dan app/config.py).")
                return 1

            for member in all_files:
                norm = member.replace("\\", "/")
                if norm.startswith(SKIP_PREFIXES):
                    continue
                if not is_safe_path(staging_dir, member):
                    continue
                zf.extract(member, staging_dir)

        print("[UPDATER] Staging siap, menukar berkas aplikasi...")
        swap_staging_into_tree(staging_dir)
        print("[UPDATER] Ekstraksi selesai.")
        success = True
    except Exception as e:
        print(f"[UPDATER ERROR] Ekstraksi/pemasangan gagal: {e}")
        return 1
    finally:
        # Simpan ZIP bila gagal agar bisa diperiksa/diulang; hapus hanya setelah sukses
        if success and os.path.exists(temp_zip):
            try:
                os.remove(temp_zip)
            except Exception:
                pass

    return 0

if __name__ == "__main__":
    sys.exit(main())

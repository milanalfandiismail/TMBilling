# install_scripts/extract_update.py
"""Skrip ekstraksi update aman & backup database sebelum migrasi."""
import os
import sys
import shutil
import zipfile
from datetime import datetime

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
instance_dir = os.path.join(root_dir, "instance")
temp_zip = os.path.join(instance_dir, "temp_update.zip")
backups_dir = os.path.join(root_dir, "backups")
db_path = os.path.join(instance_dir, "warnet.db")

def is_safe_path(base, path):
    base_abs = os.path.abspath(base)
    target_abs = os.path.abspath(os.path.join(base, path))
    return os.path.commonpath([base_abs]) == os.path.commonpath([base_abs, target_abs])

def main():
    if not os.path.exists(temp_zip):
        print("[UPDATER] temp_update.zip tidak ditemukan. Selesai.")
        return 0

    # 1. Backup database warnet.db
    if os.path.exists(db_path):
        os.makedirs(backups_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(backups_dir, f"warnet_backup_before_update_{ts}.db")
        try:
            shutil.copy2(db_path, backup_file)
            print(f"[UPDATER] Database dicadangkan ke: {backup_file}")
        except Exception as e:
            print(f"[UPDATER ERROR] Gagal backup database: {e}")

    # 2. Ekstraksi berkas rilis
    print(f"[UPDATER] Mengekstrak pembaruan ke {root_dir}...")
    try:
        with zipfile.ZipFile(temp_zip, "r") as zf:
            all_files = zf.namelist()
            norm_files = [f.replace("\\", "/") for f in all_files]
            has_run = any(f == "run.py" for f in norm_files)
            has_app = any(f.startswith("app/") for f in norm_files)
            has_config = any(f == "app/config.py" for f in norm_files)

            if not has_run or not has_app or not has_config:
                print("[UPDATER ERROR] ZIP bukan paket rilis TMBilling yang valid (wajib memuat run.py dan app/config.py).")
                return 1

            skip_prefixes = (".env", "instance/", "backups/", ".git/")
            for member in all_files:
                norm = member.replace("\\", "/")
                if norm.startswith(skip_prefixes):
                    continue
                if not is_safe_path(root_dir, member):
                    continue
                zf.extract(member, root_dir)

        print("[UPDATER] Ekstraksi selesai.")
    except Exception as e:
        print(f"[UPDATER ERROR] Ekstraksi gagal: {e}")
        return 1
    finally:
        if os.path.exists(temp_zip):
            try:
                os.remove(temp_zip)
            except Exception:
                pass

    # 3. Jalankan migrasi skema
    try:
        from install_scripts.run_migration import run as run_migration
        run_migration()
    except Exception as mig_err:
        print(f"[UPDATER WARNING] Migrasi: {mig_err}")

    return 0

if __name__ == "__main__":
    sys.exit(main())

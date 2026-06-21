"""Routes untuk Database Migration Manager & Dashboard Update.

Blueprint: migration_api_bp
Subtab Settings: "Migrasi & Update"

Fitur:
1. Upload & extract update ZIP (update aplikasi)
2. Upgrade skema database (flask_migrate.upgrade)
3. Rollback skema (flask_migrate.downgrade)
4. Restore database dari backup ZIP
5. Status migrasi & versi aplikasi
"""

import os
import sys
import zipfile
import subprocess
import threading
import json
from flask import Blueprint, request, jsonify, session, current_app
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.utils.logger import write_log

migration_api_bp = Blueprint("migration", __name__)


# =========================================================================
# 1. STATUS MIGRASI
# =========================================================================

@migration_api_bp.route("/status", methods=["GET"])
@login_required
@admin_required
def get_migration_status():
    """Mendapatkan status versi skema database & aplikasi.

    Response: { success, current, head, needs_upgrade, app_version, history }
    """
    try:
        from alembic.script import ScriptDirectory

        migrations_dir = os.path.join(current_app.root_path, '..', 'migrations')
        # Gunakan Flask-Migrate's get_config untuk baca konfigurasi yang benar
        migrate = current_app.extensions['migrate'].migrate
        alembic_cfg = migrate.get_config(migrations_dir)
        script = ScriptDirectory.from_config(alembic_cfg)

        # Dapatkan head revision
        head = script.get_current_head()
        head_label = head[:8] if head else None

        # Dapatkan current revision yang ter-aplikasi
        current_revision = _get_current_revision()

        needs_upgrade = current_revision != head_label if (current_revision and head_label) else False

        # History
        history_list = []
        try:
            revisions = list(script.walk_revisions())
            for rev in revisions:
                history_list.append({
                    "revision": rev.revision[:8] if rev.revision else None,
                    "down_revision": rev.down_revision[:8] if rev.down_revision else None,
                    "description": rev.doc or rev.message or "-",
                    "is_current": rev.revision.startswith(current_revision) if current_revision else False,
                    "is_head": rev.revision == head if head else False,
                })
        except Exception:
            pass

        return jsonify({
            "success": True,
            "current": current_revision,
            "head": head_label,
            "needs_upgrade": needs_upgrade,
            "app_version": current_app.config.get("VERSION", "v1.0"),
            "history": history_list,
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Gagal membaca status migrasi: {str(e)}",
            "app_version": current_app.config.get("VERSION", "v1.0"),
            "current": None,
            "head": None,
            "needs_upgrade": False,
            "history": [],
        }), 200  # Tetap 200 biar UI gak error


def _get_current_revision():
    """Helper: ambil current revision dari database (alembic_version table)."""
    try:
        from app import db
        result = db.session.execute(db.text("SELECT version_num FROM alembic_version")).scalar()
        return result[:8] if result else None
    except Exception:
        return None


# =========================================================================
# 2. UPLOAD UPDATE APLIKASI (ZIP RILIS)
# =========================================================================

@migration_api_bp.route("/upload", methods=["POST"])
@login_required
@admin_required
def upload_update():
    """Menerima berkas ZIP rilis penuh, validasi, ekstrak, lalu restart server."""
    try:
        file = request.files.get("update_file")
        if not file or file.filename == "":
            return jsonify({"error": "File update wajib dipilih"}), 400

        # Simpan sementara
        temp_path = os.path.join(current_app.instance_path, "temp_update.zip")
        file.save(temp_path)

        # Validasi isi ZIP
        try:
            with zipfile.ZipFile(temp_path, 'r') as zf:
                all_files = zf.namelist()
                has_run_py = any(f.replace('\\', '/') == 'run.py' for f in all_files)
                has_app_folder = any(f.replace('\\', '/').startswith('app/') for f in all_files)

                if not has_run_py or not has_app_folder:
                    os.remove(temp_path)
                    return jsonify({
                        "error": "Berkas ZIP bukan paket rilis TMBilling yang valid. Pastikan file berisi run.py dan folder app/."
                    }), 400

                # Proteksi: skip .env, instance/, backups/ dan path traversal
                root_dir = os.path.abspath(os.path.join(current_app.root_path, '..'))
                for member in zf.namelist():
                    normalized = member.replace('\\', '/')
                    # Lewati path traversal
                    if normalized.startswith('../') or normalized.startswith('..\\'):
                        continue
                    # Lewati file/folder yang dilindungi
                    skip_prefixes = ('.env', 'instance/', 'backups/', '.git/')
                    if normalized.startswith(skip_prefixes):
                        continue
                    zf.extract(member, root_dir)

        except zipfile.BadZipFile:
            os.remove(temp_path)
            return jsonify({"error": "File bukan format ZIP yang valid"}), 400

        # Cek apakah ada folder migrations/ di ZIP — auto migrate
        migrations_dir = os.path.join(root_dir, 'migrations')
        zip_migrations_dir = None
        for member in zf.namelist():
            normalized = member.replace('\\', '/')
            if normalized.startswith('migrations/'):
                zip_migrations_dir = True
                break

        if zip_migrations_dir and os.path.exists(migrations_dir):
            # Backup database sebelum migrasi
            _auto_backup_before_migration()

            try:
                from flask_migrate import upgrade
                upgrade(directory=migrations_dir)
                operator = session.get("kasir_username", "admin")
                write_log("DATABASE_MIGRATION_UPGRADE", "Skema database auto-upgrade ke HEAD setelah update", user=operator)
            except Exception as e:
                write_log("DATABASE_MIGRATION_ERROR", f"Auto-upgrade gagal: {str(e)}", user=operator)

        # Hapus file temp
        os.remove(temp_path)

        # Install dependencies di background
        def _install_deps():
            import time
            time.sleep(0.5)
            try:
                pip_path = os.path.join(root_dir, '.venv', 'Scripts', 'pip')
                if os.path.exists(pip_path):
                    subprocess.Popen(
                        [pip_path, 'install', '-r', os.path.join(root_dir, 'requirements.txt')],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                    )
            except Exception:
                pass

        operator = session.get("kasir_username", "admin")
        write_log("APPLICATION_UPDATE", f"Aplikasi berhasil diperbarui melalui dashboard", user=operator)

        threading.Thread(target=_install_deps, daemon=True).start()

        # Kirim response dulu sebelum restart
        resp = jsonify({"success": True, "message": "Update berhasil! Server akan restart..."})
        _schedule_restart()
        return resp

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# HELPER: Restart Server
# =========================================================================

def _schedule_restart():
    """Restart server di background setelah response terkirim."""
    def _do_restart():
        import time
        time.sleep(1.5)
        env = os.environ.copy()
        env.pop('WERKZEUG_SERVER_FD', None)
        env.pop('WERKZEUG_RUN_MAIN', None)
        subprocess.Popen([sys.executable] + sys.argv, env=env)
        os._exit(0)

    threading.Thread(target=_do_restart, daemon=True).start()


def _auto_backup_before_migration():
    """Backup otomatis database sebelum migrasi."""
    try:
        db_path = os.path.join(current_app.instance_path, 'warnet.db')
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        from app.services import BackupService
        manager = BackupService(db_path=db_path, backup_dir=backup_dir)
        manager.create_backup()
        manager.cleanup_old_backups(max_keep=5)
    except Exception:
        pass  # Backup gagal bukan halangan untuk lanjut migrasi

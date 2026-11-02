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
from app.config import Config
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

        needs_upgrade = (current_revision != head_label) if head_label else False

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
        except Exception as rev_err:
            write_log("MIGRATION_STATUS", f"Gagal membaca riwayat revisi alembic: {rev_err}")

        return jsonify({
            "success": True,
            "current": current_revision,
            "head": head_label,
            "needs_upgrade": needs_upgrade,
            "app_version": current_app.config.get("VERSION", Config.get_version_tag()),
            "history": history_list,
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Gagal membaca status migrasi: {str(e)}",
            "app_version": current_app.config.get("VERSION", Config.get_version_tag()),
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
    except Exception as e:
        write_log("MIGRATION_STATUS", f"Gagal membaca version_num: {e}")
        return None


# =========================================================================
# =========================================================================
# 2. HELPER & EXTERNAL RUNNER DISPATCHER
# =========================================================================

def _parse_version(v_str: str):
    """Mengurai format versi semver/rc menjadi tuple untuk perbandingan akurat."""
    if not v_str:
        return (0, 0, 0, 0, 0)
    v_clean = v_str.lstrip("vV").strip()
    parts = v_clean.split("-")
    core = tuple(int(x) if x.isdigit() else 0 for x in parts[0].split("."))
    # Padding tuple core ke 3 elemen (major, minor, patch)
    while len(core) < 3:
        core = core + (0,)
    if len(parts) == 1:
        prerelease = (999, 0)  # Versi final lebih tinggi dari rc
    else:
        pre = parts[1].lower()
        num = int("".join(c for c in pre if c.isdigit()) or 0)
        prerelease = (1, num)
    return core + prerelease


def _safe_remove_temp(path: str):
    """Menghapus berkas sementara dengan proteksi error dan audit log."""
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception as e:
            write_log("UPDATE_CLEANUP", f"Gagal menghapus temp file {path}: {e}")


def _launch_updater():
    """Menjalankan updater.bat secara detached dari proses Flask."""
    root_dir = os.path.abspath(os.path.join(current_app.root_path, ".."))
    updater_bat = os.path.join(root_dir, "install_scripts", "updater.bat")
    if not os.path.exists(updater_bat):
        raise FileNotFoundError("Skrip updater.bat tidak ditemukan di install_scripts/")

    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    creation_flags = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP

    subprocess.Popen(
        ["cmd.exe", "/c", updater_bat],
        cwd=root_dir,
        creationflags=creation_flags,
        close_fds=True,
    )


# =========================================================================
# 3. GITHUB RELEASES AUTO-UPDATE
# =========================================================================

@migration_api_bp.route("/check_github", methods=["GET"])
@login_required
@admin_required
def check_github_update():
    """Mengecek rilis terbaru dari repositori GitHub."""
    import urllib.request
    from app.models.sesi.sesi import Sesi

    try:
        url = "https://api.github.com/repos/milanalfandiismail/TMBilling/releases/latest"
        req = urllib.request.Request(url, headers={"User-Agent": "TMBilling-Update-Check"})
        with urllib.request.urlopen(req, timeout=8) as res:
            if res.status != 200:
                return jsonify({"success": False, "error": f"GitHub API mengembalikan status {res.status}"}), 502
            data = json.loads(res.read().decode("utf-8"))

        tag_name = data.get("tag_name", "")
        current_v = current_app.config.get("VERSION", Config.get_version_tag())
        is_newer = _parse_version(tag_name) > _parse_version(current_v)

        server_asset = None
        for asset in data.get("assets", []):
            name = asset.get("name", "")
            if name.startswith("TMBilling_Server_") and name.endswith(".zip"):
                server_asset = asset
                break

        active_sessions = Sesi.query.filter_by(status="aktif").count()

        return jsonify({
            "success": True,
            "current_version": current_v,
            "latest_version": tag_name,
            "is_newer": is_newer,
            "release_name": data.get("name") or tag_name,
            "release_notes": data.get("body") or "",
            "published_at": data.get("published_at", ""),
            "asset_name": server_asset.get("name") if server_asset else None,
            "asset_size": server_asset.get("size") if server_asset else 0,
            "asset_url": server_asset.get("browser_download_url") if server_asset else None,
            "active_sessions_count": active_sessions,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Gagal mengecek pembaruan GitHub: {str(e)}"}), 500


@migration_api_bp.route("/update_github", methods=["POST"])
@login_required
@admin_required
def update_github():
    """Mengunduh paket rilis server dari GitHub dan mendelegasikan eksekusi ke updater.bat."""
    import urllib.request

    try:
        operator = session.get("kasir_username", "admin")
        body = request.get_json(silent=True) or {}
        asset_url = body.get("asset_url")

        if not asset_url:
            url = "https://api.github.com/repos/milanalfandiismail/TMBilling/releases/latest"
            req = urllib.request.Request(url, headers={"User-Agent": "TMBilling-Update-Check"})
            with urllib.request.urlopen(req, timeout=8) as res:
                data = json.loads(res.read().decode("utf-8"))
            for asset in data.get("assets", []):
                name = asset.get("name", "")
                if name.startswith("TMBilling_Server_") and name.endswith(".zip"):
                    asset_url = asset.get("browser_download_url")
                    break

        if not asset_url:
            return jsonify({"error": "Asset paket pembaruan server tidak ditemukan di rilis GitHub"}), 400

        temp_path = os.path.join(current_app.instance_path, "temp_update.zip")
        os.makedirs(current_app.instance_path, exist_ok=True)

        req = urllib.request.Request(asset_url, headers={"User-Agent": "TMBilling-Update-Download"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(temp_path, "wb") as out_file:
            while True:
                chunk = resp.read(64 * 1024)
                if not chunk:
                    break
                out_file.write(chunk)

        # Validasi integritas berkas ZIP
        is_valid_structure = False
        try:
            with zipfile.ZipFile(temp_path, "r") as zf:
                all_files = zf.namelist()
                has_run = any(f.replace("\\", "/") == "run.py" for f in all_files)
                has_app = any(f.replace("\\", "/").startswith("app/") for f in all_files)
                if has_run and has_app:
                    is_valid_structure = True
        except zipfile.BadZipFile:
            _safe_remove_temp(temp_path)
            return jsonify({"error": "Berkas ZIP dari GitHub rusak / bukan format ZIP valid"}), 400

        if not is_valid_structure:
            _safe_remove_temp(temp_path)
            return jsonify({"error": "Berkas ZIP dari GitHub bukan paket rilis TMBilling yang valid"}), 400

        write_log("APPLICATION_UPDATE", "Pembaruan otomatis dari GitHub dipicu melalui dashboard", user=operator)
        _launch_updater()

        return jsonify({
            "success": True,
            "message": "Pembaruan berhasil diunduh. Server sedang memperbarui dan akan dimulai ulang...",
        }), 200
    except Exception as e:
        return jsonify({"error": f"Gagal memproses pembaruan GitHub: {str(e)}"}), 500


# =========================================================================
# 4. UPLOAD UPDATE APLIKASI MANUAL (ZIP RILIS)
# =========================================================================

@migration_api_bp.route("/upload", methods=["POST"])
@login_required
@admin_required
def upload_update():
    """Menerima berkas ZIP rilis manual, validasi, lalu delegasikan ke updater.bat."""
    try:
        operator = session.get("kasir_username", "admin")
        file = request.files.get("update_file")
        if not file or file.filename == "":
            return jsonify({"error": "File update wajib dipilih"}), 400

        temp_path = os.path.join(current_app.instance_path, "temp_update.zip")
        os.makedirs(current_app.instance_path, exist_ok=True)
        file.save(temp_path)

        is_valid_structure = False
        is_safe = True
        try:
            with zipfile.ZipFile(temp_path, "r") as zf:
                all_files = zf.namelist()
                has_run = any(f.replace("\\", "/") == "run.py" for f in all_files)
                has_app = any(f.replace("\\", "/").startswith("app/") for f in all_files)
                if has_run and has_app:
                    is_valid_structure = True

                for member in all_files:
                    norm = member.replace("\\", "/")
                    if norm.startswith("/") or ".." in norm.split("/"):
                        is_safe = False
                        break
        except zipfile.BadZipFile:
            _safe_remove_temp(temp_path)
            return jsonify({"error": "Berkas bukan format ZIP yang valid"}), 400

        if not is_valid_structure:
            _safe_remove_temp(temp_path)
            return jsonify({
                "error": "Berkas ZIP bukan paket rilis TMBilling yang valid (wajib memuat run.py dan folder app/)."
            }), 400

        if not is_safe:
            _safe_remove_temp(temp_path)
            return jsonify({"error": "Path traversal terdeteksi pada berkas ZIP"}), 400

        write_log("APPLICATION_UPDATE", "Pembaruan manual melalui upload ZIP dipicu melalui dashboard", user=operator)
        _launch_updater()

        return jsonify({
            "success": True,
            "message": "Berkas berhasil diunggah. Server sedang memperbarui dan akan dimulai ulang...",
        }), 200
    except Exception as e:
        return jsonify({"error": f"Gagal memproses upload update: {str(e)}"}), 500


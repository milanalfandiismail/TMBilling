# app/routes/branch/branch_routes.py
"""Routes API untuk manajemen koneksi cabang warnet (Multi-Cabang)."""

from flask import Blueprint, request, jsonify, session
from app.middleware.auth import login_required, admin_required
from app.services.branch.branch_service import BranchService
from app.services.settings.settings_service import SettingsService
from app.models import db, now_local
from app.models.branch import Branch

branch_api_bp = Blueprint("branch_api", __name__)


@branch_api_bp.before_request
def enforce_admin_permission():
    """Validasi server-side mutlak: Seluruh endpoint multi-cabang hanya untuk Admin/Owner."""
    # Izinkan jika request membawa Bearer token antar cabang (akan diverifikasi oleh auth middleware)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return None

    if not session.get("kasir_id"):
        return jsonify({"success": False, "error": "Silakan login terlebih dahulu"}), 401
    if session.get("kasir_role") != "admin":
        return jsonify({"success": False, "error": "Akses Ditolak: Hanya Admin yang memiliki izin kelola multi-cabang"}), 403


@branch_api_bp.route("/my-key", methods=["GET"])
@login_required
@admin_required
def get_my_branch_key():
    """Mengambil API Key rahasia cabang lokal ini."""
    api_key = SettingsService.get_or_create_branch_api_key()
    return jsonify({
        "success": True,
        "data": {
            "api_key": api_key
        }
    }), 200


@branch_api_bp.route("/my-key/regenerate", methods=["POST"])
@login_required
@admin_required
def regenerate_my_branch_key():
    """Membuat ulang API Key rahasia cabang lokal ini."""
    new_key = SettingsService.regenerate_branch_api_key()
    return jsonify({
        "success": True,
        "message": "API Key cabang berhasil di-regenerate",
        "data": {
            "api_key": new_key
        }
    }), 200


@branch_api_bp.route("/list", methods=["GET"])
@login_required
@admin_required
def list_branches():
    """Mengambil daftar seluruh cabang yang terhubung."""
    include_key = request.args.get("include_key", "0") == "1"
    branches = BranchService.get_all_branches(include_key=include_key)
    return jsonify({
        "success": True,
        "data": branches
    }), 200


@branch_api_bp.route("/add", methods=["POST"])
@login_required
@admin_required
def add_branch():
    """Mendaftarkan koneksi cabang baru."""
    payload = request.get_json() or {}
    url = payload.get("url", "")
    api_key = payload.get("api_key", "")
    nama = payload.get("nama")

    ok, result = BranchService.add_branch(url=url, api_key=api_key, nama=nama)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "message": "Cabang berhasil ditambahkan",
        "data": result
    }), 200


@branch_api_bp.route("/<int:branch_id>", methods=["PUT"])
@login_required
@admin_required
def update_branch(branch_id: int):
    """Memperbarui informasi koneksi cabang."""
    payload = request.get_json() or {}
    ok, result = BranchService.update_branch(branch_id, payload)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "message": "Cabang berhasil diperbarui",
        "data": result
    }), 200


@branch_api_bp.route("/<int:branch_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_branch(branch_id: int):
    """Menghapus koneksi cabang."""
    ok, message = BranchService.delete_branch(branch_id)
    if not ok:
        return jsonify({
            "success": False,
            "error": message
        }), 400

    return jsonify({
        "success": True,
        "message": message
    }), 200


@branch_api_bp.route("/test", methods=["POST"])
@login_required
@admin_required
def test_branch_connection():
    """Menguji koneksi ke URL & API Key target tanpa menyimpannya."""
    payload = request.get_json() or {}
    url = payload.get("url", "")
    api_key = payload.get("api_key", "")

    ok, result = BranchService.test_connection(url=url, api_key=api_key)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "data": result
    }), 200


@branch_api_bp.route("/<int:branch_id>/test", methods=["POST"])
@login_required
@admin_required
def test_saved_branch_connection(branch_id: int):
    """Menguji koneksi cabang yang tersimpan dan memperbarui status_online & latensi di database."""
    branch = Branch.query.get(branch_id)
    if not branch:
        return jsonify({"success": False, "error": "Cabang tidak ditemukan"}), 404

    ok, result = BranchService.test_connection(url=branch.url, api_key=branch.api_key, timeout=4)
    try:
        branch.status_online = ok
        branch.terakhir_dicek = now_local()
        if ok and isinstance(result, dict) and "latency_ms" in result:
            branch.latensi_ms = result["latency_ms"]
        db.session.commit()
    except Exception:
        db.session.rollback()

    if not ok:
        err_detail = result if isinstance(result, str) else "Gagal terhubung ke cabang target"
        return jsonify({
            "success": False,
            "error": err_detail,
            "data": {"online": False}
        }), 400

    return jsonify({
        "success": True,
        "data": result
    }), 200


@branch_api_bp.route("/operators", methods=["GET"])
@login_required
@admin_required
def get_remote_operators():
    """Mengambil daftar akun kasir remote yang tercatat di sistem."""
    data = BranchService.get_remote_operators()
    return jsonify({
        "success": True,
        "data": data
    }), 200


@branch_api_bp.route("/operators/hide", methods=["POST"])
@login_required
@admin_required
def hide_remote_operator():
    """Menonaktifkan / mengarsipkan operator remote dari dropdown kasir aktif."""
    payload = request.get_json() or {}
    operator_name = payload.get("operator", "")
    admin_op = session.get("kasir_username", "admin")
    ok, msg = BranchService.hide_remote_operator(operator_name, admin_operator=admin_op)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400
    return jsonify({"success": True, "message": msg}), 200


@branch_api_bp.route("/operators/restore", methods=["POST"])
@login_required
@admin_required
def restore_remote_operator():
    """Mengaktifkan kembali operator remote dari arsip ke dropdown kasir aktif."""
    payload = request.get_json() or {}
    operator_name = payload.get("operator", "")
    admin_op = session.get("kasir_username", "admin")
    ok, msg = BranchService.restore_remote_operator(operator_name, admin_operator=admin_op)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400
    return jsonify({"success": True, "message": msg}), 200


@branch_api_bp.route("/operators/delete", methods=["POST"])
@login_required
@admin_required
def delete_remote_operator():
    """Menghapus permanen identitas kasir remote (reset operator & user_id ke NULL / 'Kasir Lama')."""
    payload = request.get_json() or {}
    operator_name = payload.get("operator", "")
    admin_op = session.get("kasir_username", "admin")
    ok, msg = BranchService.delete_remote_operator(operator_name, admin_operator=admin_op)
    if not ok:
        return jsonify({"success": False, "error": msg}), 400
    return jsonify({"success": True, "message": msg}), 200


@branch_api_bp.route("/inbound", methods=["GET"])
@login_required
@admin_required
def list_inbound_branches():
    """Mengambil daftar riwayat koneksi cabang pengontrol yang masuk (Inbound)."""
    from app.services.branch.branch_inbound_service import BranchInboundService
    items = BranchInboundService.get_all_inbound()
    return jsonify({
        "success": True,
        "data": items
    }), 200


@branch_api_bp.route("/inbound/<int:inbound_id>/block", methods=["POST"])
@login_required
@admin_required
def block_inbound_branch(inbound_id):
    """Memblokir akses server cabang pengontrol."""
    from app.services.branch.branch_inbound_service import BranchInboundService
    ok, res = BranchInboundService.toggle_block(inbound_id, block=True)
    if not ok:
        return jsonify({"success": False, "error": res}), 404
    return jsonify({
        "success": True,
        "message": "Koneksi cabang berhasil diblokir",
        "data": res
    }), 200


@branch_api_bp.route("/inbound/<int:inbound_id>/unblock", methods=["POST"])
@login_required
@admin_required
def unblock_inbound_branch(inbound_id):
    """Membuka blokir akses server cabang pengontrol."""
    from app.services.branch.branch_inbound_service import BranchInboundService
    ok, res = BranchInboundService.toggle_block(inbound_id, block=False)
    if not ok:
        return jsonify({"success": False, "error": res}), 404
    return jsonify({
        "success": True,
        "message": "Blokir koneksi cabang berhasil dibuka",
        "data": res
    }), 200


@branch_api_bp.route("/inbound/<int:inbound_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_inbound_branch(inbound_id):
    """Menghapus riwayat koneksi cabang pengontrol."""
    from app.services.branch.branch_inbound_service import BranchInboundService
    ok, res = BranchInboundService.delete_inbound(inbound_id)
    if not ok:
        return jsonify({"success": False, "error": res}), 404
    return jsonify({
        "success": True,
        "message": res
    }), 200


@branch_api_bp.route("/switch-context", methods=["POST"])
@login_required
@admin_required
def switch_branch_context():
    """Mengubah konteks aktif cabang yang dikontrol di server session secara aman."""
    payload = request.get_json() or {}
    branch_id_raw = payload.get("branch_id", 0)
    try:
        branch_id = int(branch_id_raw)
    except (ValueError, TypeError):
        branch_id = 0

    if branch_id == 0:
        session.pop("active_branch_id", None)
        session.pop("active_branch_name", None)
        return jsonify({
            "success": True,
            "data": {
                "active_branch_id": 0,
                "is_remote": False,
                "branch_name": "Cabang Lokal"
            }
        }), 200

    branch = Branch.query.get(branch_id)
    if not branch or not branch.aktif:
        return jsonify({
            "success": False,
            "error": "Cabang target tidak ditemukan atau tidak aktif"
        }), 404

    # Verifikasi konektivitas langsung (Live Health-Check) sebelum mengizinkan pergantian cabang
    ok, test_res = BranchService.test_connection(url=branch.url, api_key=branch.api_key, timeout=4)
    try:
        branch.status_online = ok
        branch.terakhir_dicek = now_local()
        if ok and isinstance(test_res, dict) and "latency_ms" in test_res:
            branch.latensi_ms = test_res["latency_ms"]
        db.session.commit()
    except Exception:
        db.session.rollback()

    if not ok:
        err_detail = test_res if isinstance(test_res, str) else "Server cabang offline atau tidak dapat dijangkau"
        return jsonify({
            "success": False,
            "is_offline": True,
            "error": f"Cabang '{branch.nama}' tidak dapat terhubung ({err_detail}). Pergantian cabang dibatalkan."
        }), 400

    session["active_branch_id"] = branch.id
    session["active_branch_name"] = branch.nama
    return jsonify({
        "success": True,
        "data": {
            "active_branch_id": branch.id,
            "is_remote": True,
            "branch_name": branch.nama
        }
    }), 200



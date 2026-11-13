# app/routes/grup_routes.py

"""Routes untuk manajemen grup/kategori.

Blueprint ini menyediakan endpoint CRUD untuk grup yang digunakan
untuk mengelompokkan PC, Member, dan Paket.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import GrupService

grup_api_bp = Blueprint("grup", __name__)


# =========================================================================
# 1. PENGAMBILAN DATA (READ)
# =========================================================================
# Fokus: Menampilkan daftar grup untuk kebutuhan dropdown atau tabel manajemen.

@grup_api_bp.route("/", methods=["GET"])
@login_required
def list_grup():
    """Ambil semua daftar grup yang tersedia di sistem."""
    try:
        include_arsip = request.args.get("include_arsip") == "1"
        grup_list = GrupService.get_all(aktif_only=not include_arsip)
        return jsonify({
            "grup": [
                {
                    "id": g.id,
                    "nama": g.nama,
                    "keterangan": g.keterangan,
                    "warna": g.warna,
                    "aktif": g.aktif
                } for g in grup_list
            ]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. OPERASI DATA (WRITE & DELETE)
# =========================================================================
# Fokus: Membuat grup baru dan menghapus grup dengan validasi integritas.

@grup_api_bp.route("/", methods=["POST"])
@login_required
@admin_required
def tambah_grup():
    """Buat grup kategori baru (e.g., VIP, Reguler, Streaming)."""
    try:
        kasir = session.get("kasir_username", "kasir")
        grup = GrupService.create(request.get_json() or {}, operator=kasir)
        return jsonify({
            "success": True, 
            "message": f"Grup {grup.nama} berhasil dibuat"
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@grup_api_bp.route("/<int:grup_id>/archive", methods=["POST"])
@login_required
@admin_required
def arsipkan_grup(grup_id):
    """Arsipkan grup tanpa menghapus relasinya."""
    try:
        kasir = session.get("kasir_username", "kasir")
        GrupService.archive(grup_id, operator=kasir)
        return jsonify({"success": True, "message": "Grup berhasil diarsipkan"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@grup_api_bp.route("/<int:grup_id>/restore", methods=["POST"])
@login_required
@admin_required
def pulihkan_grup(grup_id):
    """Pulihkan grup dari arsip."""
    try:
        kasir = session.get("kasir_username", "kasir")
        GrupService.restore(grup_id, operator=kasir)
        return jsonify({"success": True, "message": "Grup berhasil dipulihkan"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@grup_api_bp.route("/<int:grup_id>", methods=["DELETE"])
@login_required
@admin_required
def hapus_grup(grup_id):
    """Hapus grup berdasarkan ID (Akan gagal jika grup masih memiliki relasi)."""
    try:
        kasir = session.get("kasir_username", "kasir")
        GrupService.delete(grup_id, operator=kasir)
        return jsonify({
            "success": True, 
            "message": "Grup berhasil dihapus"
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@grup_api_bp.route("/<int:grup_id>", methods=["PUT"])
@login_required
@admin_required
def update_grup(grup_id):
    """Update data grup berdasarkan ID."""
    try:
        kasir = session.get("kasir_username", "kasir")
        grup = GrupService.update(grup_id, request.get_json() or {}, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Grup {grup.nama} berhasil diperbarui"
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# app/routes/pc_routes.py

"""Routes untuk manajemen unit komputer (PC).

Blueprint ini menyediakan endpoint CRUD untuk PC termasuk
bulk creation untuk penambahan massal unit.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth_kasir_routes import login_required
from app.services.pc_service import PCService

pc_bp = Blueprint("pc", __name__)


# =========================================================================
# 1. PENGAMBILAN DATA & MONITORING (READ)
# =========================================================================
# Fokus: Menampilkan daftar PC baik secara flat maupun grouping per zona.

@pc_bp.route("/pc", methods=["GET"])
@login_required
def list_pc():
    """Ambil daftar lengkap PC beserta pengelompokan per grup dengan filter & paginasi."""
    try:
        # Parsing Query Parameters
        q = request.args.get("q")
        if q:
            q = q.strip()
            
        grup_id_raw = request.args.get("grup_id")
        
        # Determine group_id
        grup_id = None
        if grup_id_raw and grup_id_raw not in ("null", "undefined", ""):
            try:
                grup_id = int(grup_id_raw)
            except ValueError:
                grup_id = grup_id_raw
                
        # Non-paginated flat list response with filters
        pcs = PCService.get_all(aktif_only=False, grup_id=grup_id, search_query=q)
        grouped = PCService.group_by_grup(pcs)
        return jsonify({
            "pc_list": [pc.to_dict() for pc in pcs],
            "grouped": grouped
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. MANAJEMEN UNIT (CREATE, UPDATE, DELETE)
# =========================================================================
# Fokus: Operasi pengelolaan unit PC secara individu maupun massal.

@pc_bp.route("/pc", methods=["POST"])
@login_required
def tambah_pc():
    """Daftarkan satu unit PC baru ke sistem."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        pc = PCService.create(data, operator=kasir)

        return jsonify({
            "success": True,
            "message": f"PC {pc.kode} berhasil ditambahkan",
            "pc": pc.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pc_bp.route("/pc/batch", methods=["POST"])
@login_required
def tambah_batch():
    """Daftarkan banyak unit PC sekaligus menggunakan IP Range."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        # Kirim mentah-mentah ke service biar diolah disana
        result = PCService.create_batch(data, operator=kasir)

        return jsonify({
            "success": True,
            "added": len(result["added"]),
            "errors": result["errors"]
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pc_bp.route("/pc/<int:pc_id>", methods=["PUT"])
@login_required
def edit_pc(pc_id):
    """Update informasi teknis PC (IP, MAC, atau Zona/Grup)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        pc = PCService.update(pc_id, data, operator=kasir)

        return jsonify({
            "success": True,
            "message": f"Data PC {pc.kode} berhasil diperbarui",
            "pc": pc.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pc_bp.route("/pc/<int:pc_id>", methods=["DELETE"])
@login_required
def hapus_pc(pc_id):
    """Hapus unit PC dari database secara permanen."""
    try:
        kasir = session.get("kasir_username", "kasir")
        result = PCService.delete(pc_id, operator=kasir)
        return jsonify({"success": True, "message": result['message']}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pc_bp.route("/pc/reset-admin/<int:pc_id>", methods=["POST"])
@login_required
def reset_admin(pc_id):
    """Matiin mode admin secara paksa di PC."""
    try:
        kasir = session.get("kasir_username", "kasir")
        from app.services.pc_service import PCService
        PCService.reset_admin_mode(pc_id, operator=kasir)
        return jsonify({"success": True, "message": "Mode Admin dimatikan"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 3. WAKE-ON-LAN (WoL)
# =========================================================================
# Fokus: Mengirim Magic Packet UDP ke satu atau beberapa PC agar menyala.

@pc_bp.route("/pc/wol", methods=["POST"])
@login_required
def wol_pc():
    """Kirim Magic Packet WoL ke satu atau beberapa PC berdasarkan ID atau MAC Address."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")

        # Mode 1: Daftar PC ID (paling umum digunakan dari UI)
        pc_ids = data.get("pc_ids", [])
        if pc_ids:
            result = PCService.wake_by_pc_ids(pc_ids, operator=kasir)
            total_ok = len(result["success"])
            total_err = len(result["errors"])

            if total_ok == 0 and total_err > 0:
                err_msg = "; ".join([e["error"] for e in result["errors"]])
                return jsonify({"error": err_msg}), 400

            return jsonify({
                "success": True,
                "message": f"Magic Packet terkirim ke {total_ok} PC",
                "result": result
            }), 200

        # Mode 2: Daftar MAC Address langsung
        mac_addresses = data.get("mac_addresses", [])
        if mac_addresses:
            result = PCService.wake_on_lan(mac_addresses, operator=kasir)
            total_ok = len(result["success"])
            total_err = len(result["errors"])

            if total_ok == 0 and total_err > 0:
                err_msg = "; ".join([e["error"] for e in result["errors"]])
                return jsonify({"error": err_msg}), 400

            return jsonify({
                "success": True,
                "message": f"Magic Packet terkirim ke {total_ok} MAC",
                "result": result
            }), 200

        return jsonify({"error": "Tidak ada pc_ids atau mac_addresses yang diberikan"}), 400

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
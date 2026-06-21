# app/routes/paket_routes.py

"""Routes untuk manajemen paket harga.

Blueprint ini menyediakan endpoint CRUD untuk paket yang tersedia
dalam sistem billing.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import PaketService

paket_api_bp = Blueprint("paket", __name__)


# =========================================================================
# 1. PENGAMBILAN DATA & FILTERING (READ)
# =========================================================================
# Fokus: Mengambil daftar paket dengan dukungan filter status dan grup.

@paket_api_bp.route("/", methods=["GET"])
@login_required
def list_paket():
    """Ambil semua paket dengan filter opsional dan dukungan paginasi."""
    try:
        # Parsing Query Parameters dari URL
        aktif_only = request.args.get('aktif', 'false').lower() == 'true'
        grup_id_raw = request.args.get('grup_id')
        grup_nama = request.args.get('grup') # legacy compatibility
        search_query = request.args.get('q')
        
        # Check if page is sent for pagination
        page_raw = request.args.get('page')
        per_page = request.args.get('per_page', 10, type=int)
        
        # Determine which group identifier to use
        grup_id = None
        if grup_id_raw and grup_id_raw not in ("null", "undefined", ""):
            try:
                grup_id = int(grup_id_raw)
            except ValueError:
                grup_id = grup_id_raw
        elif grup_nama:
            grup_id = grup_nama # will be resolved in service
            
        # Unpaginated flat list response with filters
        paket = PaketService.get_all(aktif_only, grup_id, search_query)
        return jsonify({"paket": [p.to_dict() for p in paket]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. OPERASI DATA (CREATE, UPDATE, DELETE)
# =========================================================================
# Fokus: Mengelola siklus hidup paket harga dalam sistem.

@paket_api_bp.route("/", methods=["POST"])
@login_required
@admin_required
def tambah_paket():
    """Buat paket harga baru untuk Member/Guest."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        
        paket = PaketService.create(data, operator=kasir)
        return jsonify({
            "success": True, 
            "message": f"Paket '{paket.nama}' berhasil dibuat"
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@paket_api_bp.route("/<int:paket_id>", methods=["PUT"])
@login_required
@admin_required
def edit_paket(paket_id):
    """Update data paket (harga, durasi, status aktif, dll)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        
        paket = PaketService.update(paket_id, data, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Paket '{paket.nama}' berhasil diupdate",
            "paket": paket.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@paket_api_bp.route("/<int:paket_id>", methods=["DELETE"])
@login_required
@admin_required
def hapus_paket(paket_id):
    """Hapus paket (Proteksi otomatis jika paket sedang digunakan di sesi aktif)."""
    try:
        kasir = session.get("kasir_username", "kasir")
        
        PaketService.delete(paket_id, operator=kasir)
        return jsonify({
            "success": True, 
            "message": "Paket berhasil dihapus"
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
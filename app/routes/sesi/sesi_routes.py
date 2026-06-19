# app/routes/sesi_routes.py

"""Routes untuk operasi sesi bermain.

Blueprint ini menyediakan endpoint untuk membuka, menutup,
memindah, dan menambah waktu sesi bermain di dashboard kasir.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required
from app.services import SesiService
from app.services import PaketService

sesi_bp = Blueprint("sesi", __name__)


# =========================================================================
# 1. PEMBUKAAN SESI (SESSION INITIATION)
# =========================================================================
# Fokus: Melayani pendaftaran sesi baru baik untuk Guest maupun Member.

@sesi_bp.route("/buka-guest", methods=["POST"])
@login_required
def buka_guest():
    """Buka sesi baru untuk guest di PC tertentu."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        sesi = SesiService.buka_guest(
            pc_kode=data.get("pc_kode"),
            paket_id=data.get("paket_id"),
            nama_guest=data.get("nama_guest", "Guest"),
            operator=kasir
        )
        return jsonify({
            "success": True,
            "sesi_id": sesi.id,
            "token_sesi": sesi.token_sesi,
            "sisa_menit": sesi.sisa_menit()
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_bp.route("/buka-member", methods=["POST"])
@login_required
def buka_member():
    """Buka sesi baru untuk member menggunakan saldo waktu tersimpan."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        sesi = SesiService.buka_member(
            pc_kode=data.get("pc_kode"),
            username=data.get("username"),
            operator=kasir
        )
        return jsonify({
            "success": True,
            "message": f"Sesi member {sesi.member.username} dibuka",
            "sesi_id": sesi.id,
            "token_sesi": sesi.token_sesi,
            "waktu_tersimpan": sesi.member.waktu_tersimpan
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. OPERASI SESI BERJALAN (ACTIVE OPERATIONS)
# =========================================================================
# Fokus: Perubahan pada sesi yang sedang aktif (Pindah PC & Tambah Waktu).

@sesi_bp.route("/tambah-waktu-sesi/<int:sesi_id>", methods=["POST"])
@login_required
def tambah_waktu_sesi(sesi_id):
    """Tambah durasi pada sesi yang sedang aktif bermain (mendukung multiple paket)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        
        selections = data.get("selections")
        if selections:
            for sel in selections:
                paket_id = sel.get("paket_id")
                qty = int(sel.get("qty", 1))
                if qty <= 0:
                    raise ValueError("Kuantitas harus minimal 1")
                paket = PaketService.get_by_id(paket_id)
                SesiService.tambah_waktu_sesi(sesi_id, paket, operator=kasir, qty=qty)
            return jsonify({
                "success": True,
                "message": "Waktu berhasil ditambahkan"
            }), 200
        else:
            paket_id = data.get("paket_id")
            qty = int(data.get("qty", 1))
            if qty <= 0:
                raise ValueError("Kuantitas harus minimal 1")
            paket = PaketService.get_by_id(paket_id)
            result = SesiService.tambah_waktu_sesi(sesi_id, paket, operator=kasir, qty=qty)
            return jsonify({
                "success": True,
                "message": f"Ditambahkan {paket.durasi_menit * qty} menit",
                "tipe": result["tipe"],
                "waktu_baru": result.get("waktu_tersimpan") or result.get("sisa_menit")
            }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_bp.route("/pindah-pc/<int:sesi_id>", methods=["POST"])
@login_required
def pindah_pc(sesi_id):
    """Pindahkan sesi bermain ke unit PC lain dalam zona yang sama."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        result = SesiService.pindah_pc(sesi_id, data.get("pc_kode_baru"), operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Sesi dipindah ke {result['pc_baru']}",
            "pc_lama": result['pc_lama'],
            "pc_baru": result['pc_baru']
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 3. PENYELESAIAN & INFORMASI (TERMINATION & INFO)
# =========================================================================
# Fokus: Mengakhiri sesi dan mengambil data detail sesi.

@sesi_bp.route("/tutup/<int:sesi_id>", methods=["POST"])
@login_required
def tutup_sesi(sesi_id):
    """Mengakhiri sesi bermain secara manual dari dashboard kasir."""
    try:
        kasir = session.get("kasir_username", "kasir")
        SesiService.tutup_sesi(sesi_id, operator=kasir)
        return jsonify({"success": True, "message": "Sesi berhasil ditutup"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_bp.route("/sesi/<int:sesi_id>", methods=["GET"])
@login_required
def get_sesi(sesi_id):
    """Ambil data detail sesi aktif/selesai berdasarkan ID."""
    try:
        result = SesiService.get_detail(sesi_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
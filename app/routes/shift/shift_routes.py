"""Routes untuk manajemen shift kasir (Handover).

Blueprint ini menangani buka shift, tutup shift (hitung buta),
ringkasan pendapatan, dan riwayat shift.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required
from app.services import ShiftService

shift_api_bp = Blueprint("shift", __name__)


@shift_api_bp.route("/start", methods=["POST"])
@login_required
def start_shift():
    """Buka shift baru untuk kasir yang login."""
    try:
        data = request.get_json() or {}
        modal_awal = int(data.get("modal_awal", 0))
        kasir_username = session.get("kasir_username", "kasir")

        result = ShiftService.start_shift(
            kasir_username=kasir_username,
            modal_awal=modal_awal,
            operator=kasir_username,
        )
        return jsonify({"success": True, "shift": result.to_dict()}), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/active", methods=["GET"])
@login_required
def get_active_shift():
    """Cek apakah kasir punya shift aktif."""
    try:
        kasir_username = session.get("kasir_username", "kasir")
        shift = ShiftService.get_active_shift(kasir_username)

        if not shift:
            return jsonify({"success": True, "shift": None}), 200

        return jsonify({"success": True, "shift": shift.to_dict()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/summary", methods=["GET"])
@login_required
def get_shift_summary():
    """Ringkasan pendapatan shift aktif (HANYA untuk admin preview, bukan blind count)."""
    try:
        kasir_username = session.get("kasir_username", "kasir")
        shift = ShiftService.get_active_shift(kasir_username)

        if not shift:
            return jsonify({"error": "Tidak ada shift aktif"}), 400

        summary = ShiftService.get_shift_summary(shift.id)
        return jsonify({"success": True, "summary": summary}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/end", methods=["POST"])
@login_required
def end_shift():
    """Tutup shift dengan hitung buta (blind count).

    Kasir hanya memasukkan uang_fisik dan catatan serah terima, sistem menghitung selisih.
    """
    try:
        data = request.get_json() or {}
        uang_fisik = int(data.get("uang_fisik", 0))
        catatan = data.get("catatan")
        kasir_username = session.get("kasir_username", "kasir")

        shift = ShiftService.get_active_shift(kasir_username)
        if not shift:
            return jsonify({"error": "Tidak ada shift aktif"}), 400

        result = ShiftService.end_shift(
            shift_id=shift.id,
            uang_fisik=uang_fisik,
            catatan=catatan,
            operator=kasir_username,
        )
        return jsonify({"success": True, "result": result}), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/receipt/<int:shift_id>", methods=["GET"])
@login_required
def get_shift_receipt(shift_id):
    """Generate struk teks serah terima shift untuk printer thermal 58mm/80mm."""
    try:
        receipt_text = ShiftService.generate_shift_receipt_text(shift_id)
        return jsonify({"success": True, "receipt_text": receipt_text}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/<int:shift_id>/summary", methods=["GET"])
@login_required
def get_single_shift_summary(shift_id):
    """Ambil ringkasan detail shift tertentu."""
    try:
        summary = ShiftService.get_shift_summary(shift_id)
        return jsonify({"success": True, "summary": summary}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/history", methods=["GET"])
@login_required
def get_shift_history():
    """Riwayat shift yang sudah selesai (untuk admin/kasir)."""
    try:
        limit = request.args.get("limit", 10, type=int)
        offset = request.args.get("offset", 0, type=int)
        tanggal_mulai = request.args.get("tanggal_mulai")
        tanggal_selesai = request.args.get("tanggal_selesai")
        kasir_id = request.args.get("kasir_id", type=int)

        shifts = ShiftService.get_shift_history(
            limit=limit,
            offset=offset,
            tanggal_mulai=tanggal_mulai,
            tanggal_selesai=tanggal_selesai,
            kasir_id=kasir_id
        )
        return jsonify({"success": True, "shifts": shifts}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

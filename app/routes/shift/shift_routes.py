"""Routes untuk manajemen shift kasir (Handover).

Blueprint ini menangani buka shift, tutup shift (hitung buta),
ringkasan pendapatan, dan riwayat shift.
"""

from flask import Blueprint, request, jsonify, session
from app.middleware.auth import login_required, admin_required
from app.services import ShiftService

shift_api_bp = Blueprint("shift", __name__)


@shift_api_bp.route("/start", methods=["POST"])
@login_required
def start_shift():
    """Buka shift baru untuk kasir yang login."""
    try:
        data = request.get_json() or {}
        modal_awal = int(data.get("modal_awal", 0))
        
        kasir_id = session.get("kasir_id")
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id) if kasir_id else None
        kasir_username = user.username if user else session.get("kasir_username", "kasir")

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
    """Cek status shift aktif.
    
    Untuk kasir: cek shift aktif miliknya sendiri.
    Untuk admin: cek shift aktif warnet (shift kasir mana pun yang sedang bertugas).
    """
    try:
        kasir_id = session.get("kasir_id")
        role = session.get("kasir_role", "kasir")
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id) if kasir_id else None
        kasir_username = user.username if user else session.get("kasir_username", "kasir")
        
        if role == "admin":
            from app.models.shift.shift_record import ShiftRecord
            shift = ShiftRecord.query.filter_by(status="AKTIF").first()
        else:
            shift = ShiftService.get_active_shift(kasir_username)

        if not shift:
            return jsonify({"success": True, "shift": None}), 200

        return jsonify({"success": True, "shift": shift.to_dict()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@shift_api_bp.route("/summary", methods=["GET"])
@shift_api_bp.route("/<int:shift_id>/summary", methods=["GET"])
@login_required
def get_shift_summary(shift_id=None):
    """Ringkasan pendapatan shift aktif (HANYA untuk admin preview, bukan blind count)."""
    try:
        if not shift_id:
            role = session.get("kasir_role", "kasir")
            if role == "admin":
                from app.models.shift.shift_record import ShiftRecord
                active_s = ShiftRecord.query.filter_by(status="AKTIF").first()
                shift_id = active_s.id if active_s else None
            else:
                kasir_id = session.get("kasir_id")
                from app.repositories import UserRepository
                user = UserRepository.get_by_id(kasir_id) if kasir_id else None
                kasir_username = user.username if user else session.get("kasir_username", "kasir")
                shift = ShiftService.get_active_shift(kasir_username)
                shift_id = shift.id if shift else None

        if not shift_id:
            return jsonify({"error": "Tidak ada shift aktif"}), 400

        summary = ShiftService.get_shift_summary(shift_id)
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
        
        kasir_id = session.get("kasir_id")
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id) if kasir_id else None
        kasir_username = user.username if user else session.get("kasir_username", "kasir")

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


@shift_api_bp.route("/force-close", methods=["POST"])
@login_required
@admin_required
def force_close_shift():
    """Tutup paksa shift aktif oleh admin (Emergency Handover)."""
    try:
        data = request.get_json() or {}
        shift_id = data.get("shift_id")
        alasan = data.get("alasan", "").strip()
        admin_username = session.get("kasir_username", "admin")

        if not shift_id:
            return jsonify({"error": "Shift ID wajib diisi"}), 400

        result = ShiftService.force_close_shift(
            shift_id=int(shift_id),
            admin_username=admin_username,
            alasan=alasan
        )
        return jsonify({"success": True, "result": result, "message": "Shift berhasil ditutup paksa"}), 200

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


@shift_api_bp.route("/kasir-list", methods=["GET"])
@login_required
def get_shift_kasir_list():
    """Ambil daftar akun kasir aktif untuk filter riwayat shift (hanya role kasir, admin tidak dimasukkan)."""
    try:
        from app.repositories import UserRepository
        users = UserRepository.get_all_active_kasir()
        result = [{"id": u.id, "nama": u.nama_lengkap or u.username, "username": u.username} for u in users]
        return jsonify({"success": True, "kasir": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

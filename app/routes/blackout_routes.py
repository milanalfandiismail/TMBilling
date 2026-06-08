# app/routes/blackout_routes.py

"""Routes untuk manajemen insiden blackout/mati lampu.

Blueprint ini menyediakan endpoint untuk deteksi, audit,
dan resolusi sesi yang terkena gangguan listrik.
"""

from flask import Blueprint, jsonify, request, session
from app.routes.auth_kasir_routes import login_required
from app.services.blackout_service import BlackoutService

blackout_bp = Blueprint("blackout", __name__)


# =========================================================================
# 1. DETECTION & MONITORING (SCANNING)
# =========================================================================
# Fokus: Mencari sesi yang 'tewas' dan melihat daftar audit blackout.

@blackout_bp.route("/deteksi", methods=["POST"])
@login_required
def deteksi():
    """Deteksi sesi aktif yang macet (last_sync > threshold)."""
    try:
        data = request.get_json(silent=True) or {}
        threshold = data.get("threshold_menit", None)
        count = BlackoutService.deteksi(threshold)
        return jsonify({
            "success": True,
            "total": count,
            "message": f"{count} sesi terdeteksi blackout" if count > 0 else "Tidak ada sesi terdeteksi"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@blackout_bp.route("/list", methods=["GET"])
@login_required
def list_audit():
    """Daftar sesi suspect blackout berdasarkan tanggal."""
    try:
        selected_date = request.args.get("date")
        sesi_list = BlackoutService.get_audit_list(selected_date)
        return jsonify({
            "data": [s.to_dict_audit() for s in sesi_list],
            "total": len(sesi_list)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@blackout_bp.route("/dates", methods=["GET"])
@login_required
def get_dates():
    """Daftar tanggal unik yang memiliki catatan audit blackout."""
    try:
        dates = BlackoutService.get_audit_dates()
        return jsonify({"dates": dates}), 200
    except Exception as e:
        return jsonify({"dates": []}), 200


# =========================================================================
# 2. INCIDENT RESOLUTION (REFUND & RESUME)
# =========================================================================
# Fokus: Menyelesaikan status blackout baik untuk Member maupun Guest.

@blackout_bp.route("/resolve/member/<int:sesi_id>", methods=["POST"])
@login_required
def resolve_member(sesi_id):
    """Resolve member: Kembalikan saldo menit ke akun."""
    try:
        kasir = session.get("kasir_username", "kasir")
        result = BlackoutService.resolve_member(sesi_id, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Saldo {result['saldo_kembali']}m dikembalikan ke {result['username']}"
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@blackout_bp.route("/resolve/guest/sama/<int:sesi_id>", methods=["POST"])
@login_required
def resolve_guest_sama(sesi_id):
    """Resolve guest: Lanjutkan di PC yang sama."""
    try:
        kasir = session.get("kasir_username", "kasir")
        result = BlackoutService.resolve_guest_sama(sesi_id, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Guest {result['nama_guest']} lanjut di PC {result['pc']} ({result['sisa_menit']}m)"
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@blackout_bp.route("/resolve/guest/lanjut/<int:sesi_id>", methods=["POST"])
@login_required
def resolve_guest_lanjut(sesi_id):
    """Resolve guest: Pindahkan ke PC lain yang satu grup zona."""
    try:
        kasir = session.get("kasir_username", "kasir")
        data = request.get_json(silent=True) or {}
        pc_baru_id = data.get("pc_baru_id")
        if not pc_baru_id:
            return jsonify({"success": False, "error": "PC tujuan wajib diisi"}), 400

        result = BlackoutService.resolve_guest_lanjut(sesi_id, int(pc_baru_id), operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Guest {result['nama_guest']} pindah ke {result['pc_baru']} ({result['sisa_menit']}m)"
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@blackout_bp.route("/resolve/guest/tutup/<int:sesi_id>", methods=["POST"])
@login_required
def resolve_guest_tutup(sesi_id):
    """Resolve guest/member: Tutup sesi tanpa kompensasi."""
    try:
        kasir = session.get("kasir_username", "kasir")
        result = BlackoutService.resolve_tutup_tanpa_kompensasi(sesi_id, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Catatan blackout {result['target']} ditutup"
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================================
# 3. MAINTENANCE & BULK OPERATIONS (CLEANUP)
# =========================================================================
# Fokus: Pembersihan data audit dan penutupan massal saat server mati.

@blackout_bp.route("/force-all-and-detect", methods=["POST"])
@login_required
def force_all_and_detect():
    """Tutup paksa semua sesi aktif dan masukkan ke daftar blackout."""
    try:
        kasir = session.get("kasir_username", "kasir")
        result = BlackoutService.force_all_and_detect(operator=kasir)
        return jsonify({
            "success": True,
            "message": f"{result['tutup']} sesi ditutup, {result['deteksi']} sesi masuk blackout"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@blackout_bp.route("/clear", methods=["POST"])
@login_required
def clear_audit():
    """Hapus history audit blackout yang sudah diselesaikan (Resolved)."""
    try:
        kasir = session.get("kasir_username", "kasir")
        data = request.get_json(silent=True) or {}
        selected_date = data.get("date")
        if not selected_date:
            return jsonify({"success": False, "error": "Pilih tanggal terlebih dahulu"}), 400
        deleted = BlackoutService.clear_resolved(selected_date, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"{deleted} record audit pada {selected_date} telah dihapus"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
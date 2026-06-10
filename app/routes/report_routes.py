# app/routes/report_routes.py

"""Routes untuk laporan dan audit.

Blueprint ini menyediakan endpoint untuk laporan keuangan,
system logs, dan manajemen struk/nota.
"""

from flask import Blueprint, request, jsonify, Response, session
from app.routes.auth_kasir_routes import login_required, admin_required
from app.services.report_service import ReportService

report_bp = Blueprint("report", __name__)


# =========================================================================
# 1. FINANCIAL REPORTS (LAPORAN KEUANGAN)
# =========================================================================
# Fokus: Menyajikan data pendapatan harian dan statistik operasional.

@report_bp.route("/laporan", methods=["GET"])
@login_required
def get_laporan():
    """Ambil laporan detail berdasarkan parameter tanggal (YYYY-MM-DD)."""
    try:
        tanggal = request.args.get("tanggal")
        kasir_id = request.args.get("kasir_id")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        
        # RULE: Kasir hanya boleh lihat laporan diri sendiri
        if session.get("kasir_role") == "kasir":
            kasir_id = session.get("kasir_id")
            
        laporan = ReportService.get_laporan_by_tanggal(tanggal, kasir_id, page, per_page)
        return jsonify(laporan), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/laporan-harian", methods=["GET"])
@login_required
def laporan_harian():
    """Ringkasan cepat pendapatan, total sesi, dan sesi aktif hari ini."""
    try:
        laporan = ReportService.get_laporan_harian()
        return jsonify(laporan), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/tanggal", methods=["GET"])
@login_required
def get_tanggal_list():
    """Ambil daftar tanggal unik yang memiliki catatan transaksi (untuk filter)."""
    try:
        tanggal_list = ReportService.get_tanggal_list()
        return jsonify({"tanggal": tanggal_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/kasir-list", methods=["GET"])
@login_required
def get_kasir_list():
    """Ambil daftar semua kasir untuk filter laporan."""
    try:
        # Gunakan service untuk mendapatkan list kasir
        kasir_id = session.get("kasir_id")
        kasir_role = session.get("kasir_role")
        users = ReportService.get_kasir_list(kasir_id, kasir_role)
            
        return jsonify({"kasir": users}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. RECEIPT & TRANSACTION SEARCH (STRUK)
# =========================================================================
# Fokus: Pencarian nota dan penyajian data untuk kebutuhan cetak struk.

@report_bp.route("/struk/<identifier>", methods=["GET"])
@login_required
def get_struk(identifier):
    """Ambil data struk lengkap untuk preview/cetak berdasarkan ID atau No. Nota."""
    try:
        identifier_str = str(identifier)
        kasir = session.get("kasir_username", "Kasir")
        
        # Coba parse sebagai integer ID
        try:
            t_id = int(identifier_str)
            data = ReportService.get_struk_data(t_id, kasir_name=kasir)
        except ValueError:
            # Jika bukan integer, cari berdasarkan no_nota
            from app.repositories.transaksi_repository import TransaksiRepository
            t = TransaksiRepository.get_by_no_nota(identifier_str)
            if t:
                data = ReportService.get_struk_data(t.id, kasir_name=kasir)
            else:
                # Fallback: strip prefix 'T' atau 'S' jika ada
                clean = identifier_str.lstrip('TS')
                try:
                    data = ReportService.get_struk_data(int(clean), kasir_name=kasir)
                except ValueError:
                    data = None
        
        if not data:
            return jsonify({"error": "Data transaksi tidak ditemukan"}), 404
            
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/struk/by-no", methods=["POST"])
@login_required
def get_struk_by_no():
    """Cari nota berdasarkan nomor struk (Mendukung TM- baru & TRX- lama)."""
    data = request.get_json()
    no_input = data.get("no_struk", "").strip()
    
    if not no_input:
        return jsonify({"error": "Nomor nota wajib diisi"}), 400
    
    t = ReportService.find_transaction(no_input)

    if not t:
        return jsonify({"error": "Nota tidak ditemukan"}), 404

    # Panggil get_struk (Re-use logic)
    return get_struk(f"T{t.id}")


@report_bp.route("/struk/menu/<int:t_menu_id>", methods=["GET"])
@login_required
def get_struk_menu(t_menu_id):
    """Ambil data struk lengkap untuk transaksi menu/F&B."""
    try:
        kasir = session.get("kasir_username", "Kasir")
        data = ReportService.get_struk_menu_data(t_menu_id, kasir_name=kasir)
        if not data:
            return jsonify({"error": "Data transaksi menu tidak ditemukan"}), 404
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 3. SYSTEM LOGS & AUDIT (MONITORING)
# =========================================================================
# Fokus: Monitoring aktivitas sistem, blackout, dan fitur export log.

@report_bp.route("/log", methods=["GET"])
@login_required
def get_logs():
    """Ambil daftar log sistem dengan filter teks dan kategori."""
    try:
        filter_text = request.args.get("filter", "")
        kategori = request.args.get("kategori", "")
        limit = request.args.get("limit", 500, type=int)
        result = ReportService.get_system_logs(limit, filter_text, kategori)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/log/clear", methods=["POST"])
@login_required
def clear_logs_endpoint():
    """Bersihkan file log sistem."""
    try:
        kasir = session.get("kasir_username", "kasir")
        if ReportService.clear_system_logs(operator=kasir):
            return jsonify({"success": True, "message": "Log dibersihkan"}), 200
        return jsonify({"error": "Gagal membersihkan log"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/transaksi/clear", methods=["POST"])
@login_required
@admin_required
def clear_transactions_endpoint():
    """Bersihkan seluruh riwayat transaksi."""
    try:
        kasir = session.get("kasir_username", "kasir")
        if ReportService.clear_all_transactions(operator=kasir):
            return jsonify({"success": True, "message": "Seluruh riwayat transaksi berhasil dikosongkan"}), 200
        return jsonify({"error": "Gagal mengosongkan riwayat"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/transaksi/<int:t_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_transaction_endpoint(t_id):
    """Hapus satu transaksi berdasarkan ID."""
    try:
        kasir = session.get("kasir_username", "kasir")
        if ReportService.delete_transaction(t_id, operator=kasir):
            return jsonify({"success": True, "message": "Struk berhasil dihapus"}), 200
        return jsonify({"error": "Gagal menghapus struk"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/transaksi/by-date/<string:tanggal>", methods=["DELETE"])
@login_required
@admin_required
def clear_date_transactions_endpoint(tanggal):
    """Hapus seluruh transaksi pada tanggal tertentu."""
    try:
        kasir = session.get("kasir_username", "kasir")
        if ReportService.clear_transactions_by_date(tanggal, operator=kasir):
            return jsonify({"success": True, "message": f"Transaksi tanggal {tanggal} berhasil dihapus"}), 200
        return jsonify({"error": "Gagal menghapus transaksi"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/log/export", methods=["GET"])
@login_required
def export_logs():
    """Download system logs dalam format .txt."""
    try:
        filter_text = request.args.get("filter", "")
        content, timestamp = ReportService.prepare_export_data(filter_text)
        return Response(
            content,
            mimetype="text/plain",
            headers={"Content-Disposition": f"attachment;filename=warnet_log_{timestamp}.txt"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@report_bp.route("/blackout-log", methods=["GET"])
@login_required
def blackout_log():
    """Log khusus terkait kejadian mati lampu (Blackout) & Server Restart."""
    try:
        result = ReportService.get_system_logs(limit=200, filter_text="BLACKOUT")
        restart = ReportService.get_system_logs(limit=10, filter_text="SERVER_RESTART")
        return jsonify({
            "blackout_logs": result["logs"],
            "restart_logs": restart["logs"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
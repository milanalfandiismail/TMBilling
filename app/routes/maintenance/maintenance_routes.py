# app/routes/maintenance/maintenance_routes.py

"""Blueprint API untuk manajemen tiket perawatan dan pelaporan masalah PC.

Menyediakan endpoint untuk membuat tiket, merubah status, mengambil list tiket,
serta mengunduh laporan analitik biaya perbaikan warnet.
"""

import csv
from io import StringIO
from flask import Blueprint, request, jsonify, session, make_response
from app.routes.auth.auth_kasir_routes import login_required
from app.services import MaintenanceService

maintenance_api_bp = Blueprint("maintenance", __name__)

@maintenance_api_bp.route("/create", methods=["POST"])
@login_required
def create_ticket():
    try:
        data = request.get_json() or {}
        pc_id = data.get("pc_id")
        kategori = data.get("kategori")
        prioritas = data.get("prioritas")
        judul = data.get("judul")
        deskripsi = data.get("deskripsi")
        reporter = session.get("kasir_username", "kasir")

        if not pc_id or not kategori or not prioritas or not judul:
            return jsonify({"error": "pc_id, kategori, prioritas, dan judul harus diisi"}), 400

        ticket = MaintenanceService.create_ticket(
            pc_id=int(pc_id),
            reporter=reporter,
            kategori=kategori,
            prioritas=prioritas,
            judul=judul,
            deskripsi=deskripsi
        )
        return jsonify({"success": True, "ticket": ticket.to_dict()}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@maintenance_api_bp.route("/list", methods=["GET"])
@login_required
def list_tickets():
    try:
        status = request.args.get("status")
        pc_id = request.args.get("pc_id", type=int)
        grup = request.args.get("grup")
        limit = request.args.get("limit", 50, type=int)

        tickets = MaintenanceService.get_tickets(status=status, pc_id=pc_id, grup=grup, limit=limit)
        return jsonify({"success": True, "tickets": tickets}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@maintenance_api_bp.route("/<int:ticket_id>/status", methods=["PUT"])
@login_required
def update_status(ticket_id):
    try:
        data = request.get_json() or {}
        status = data.get("status")
        resolusi = data.get("resolusi")
        biaya = data.get("biaya", 0)
        resolved_by = session.get("kasir_username", "kasir")

        if not status:
            return jsonify({"error": "Status harus diisi"}), 400

        ticket_data = MaintenanceService.update_status(
            ticket_id=ticket_id,
            status=status,
            resolved_by=resolved_by,
            resolusi=resolusi,
            biaya=biaya
        )
        return jsonify({"success": True, "ticket": ticket_data}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@maintenance_api_bp.route("/report", methods=["GET"])
@login_required
def get_report():
    try:
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        pc_id = request.args.get("pc_id", type=int)
        grup = request.args.get("grup")
        kategori = request.args.get("kategori")

        report_data = MaintenanceService.get_report_data(
            start_date=start_date,
            end_date=end_date,
            pc_id=pc_id,
            grup=grup,
            kategori=kategori
        )
        return jsonify({"success": True, "report": report_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@maintenance_api_bp.route("/export", methods=["GET"])
@login_required
def export_report():
    try:
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        pc_id = request.args.get("pc_id", type=int)
        grup = request.args.get("grup")
        kategori = request.args.get("kategori")

        report_data = MaintenanceService.get_report_data(
            start_date=start_date,
            end_date=end_date,
            pc_id=pc_id,
            grup=grup,
            kategori=kategori
        )
        
        # Create CSV in memory
        si = StringIO()
        cw = csv.writer(si)
        cw.writerow(["ID Tiket", "Kode PC", "Pelapor", "Kategori", "Prioritas", "Judul Masalah", "Deskripsi", "Status", "Resolusi/Catatan", "Biaya (Rp)", "Tanggal Lapor", "Tanggal Selesai", "Teknisi"])
        
        for t in report_data["list_tiket"]:
            cw.writerow([
                t["id"],
                t["pc_kode"],
                t["reporter"],
                t["kategori"],
                t["prioritas"],
                t["judul"],
                t["deskripsi"],
                t["status"],
                t["resolusi"],
                t["biaya"],
                t["created_at"],
                t["resolved_at"],
                t["resolved_by"]
            ])

        response = make_response(si.getvalue())
        response.headers["Content-Disposition"] = "attachment; filename=laporan_perawatan.csv"
        response.headers["Content-type"] = "text/csv"
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@maintenance_api_bp.route("/<int:ticket_id>", methods=["DELETE"])
@login_required
def delete_ticket(ticket_id):
    try:
        if session.get("kasir_role") != "admin":
            return jsonify({"error": "Akses ditolak. Hanya administrator yang dapat menghapus tiket."}), 403

        MaintenanceService.delete_ticket(ticket_id)
        return jsonify({"success": True, "message": f"Tiket #{ticket_id} berhasil dihapus."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

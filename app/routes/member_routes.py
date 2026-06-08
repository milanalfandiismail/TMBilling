# app/routes/member_routes.py

"""Routes untuk manajemen member/pelanggan.

Blueprint ini menyediakan endpoint CRUD member dan operasi
tambah waktu/saldo serta sistem refund paket.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth_kasir_routes import login_required
from app.services.member_service import MemberService
from app.services.paket_service import PaketService

member_bp = Blueprint("member", __name__)


# =========================================================================
# 1. MEMBER CRUD OPERATIONS (BASIC DATA)
# =========================================================================
# Fokus: Pengelolaan data profil member (List, Detail, Tambah, Edit, Hapus).

@member_bp.route("/member", methods=["GET"])
@login_required
def list_member():
    """Ambil daftar member dengan fitur search & pagination."""
    try:
        q = request.args.get("q")
        if q:
            q = q.strip()
            
        grup_id_raw = request.args.get("grup_id")
        grup_id = None
        if grup_id_raw and grup_id_raw not in ("null", "undefined", ""):
            try:
                grup_id = int(grup_id_raw)
            except ValueError:
                grup_id = grup_id_raw
                
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        
        result = MemberService.get_paginated_members(q, page, per_page, grup_id=grup_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@member_bp.route("/member/<int:member_id>", methods=["GET"])
@login_required
def get_member_detail(member_id):
    """Ambil data lengkap satu member berdasarkan ID (untuk form edit)."""
    try:
        member = MemberService.get_by_id(member_id)
        if not member:
            return jsonify({"error": "Member tidak ditemukan"}), 404
        return jsonify({"member": member.to_dict()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@member_bp.route("/member", methods=["POST"])
@login_required
def tambah_member():
    """Registrasi member baru ke database."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        member = MemberService.create(data, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Member '{member.username}' berhasil ditambahkan"
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@member_bp.route("/member/<int:member_id>", methods=["PUT"])
@login_required
def edit_member(member_id):
    """Perbarui informasi profil member (Nama, Email, No HP, Grup)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        member = MemberService.update(member_id, data, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Member '{member.username}' berhasil diupdate",
            "member": member.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@member_bp.route("/member/<int:member_id>", methods=["DELETE"])
@login_required
def delete_member(member_id):
    """Hapus akun member (Akan gagal jika member sedang aktif bermain)."""
    try:
        kasir = session.get("kasir_username", "kasir")
        MemberService.delete(member_id, operator=kasir)
        return jsonify({"success": True, "message": "Member berhasil dihapus"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. BILLING & TIME OPERATIONS (SALDO)
# =========================================================================
# Fokus: Proses transaksi penambahan waktu/saldo ke akun member.

@member_bp.route("/tambah-waktu", methods=["POST"])
@login_required
def tambah_waktu():
    """Proses pembelian paket untuk menambah saldo waktu member (mendukung multiple paket)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        member_id = data.get("member_id")
        
        selections = data.get("selections")
        if selections:
            for sel in selections:
                paket_id = sel.get("paket_id")
                qty = int(sel.get("qty", 1))
                if qty <= 0:
                    raise ValueError("Kuantitas harus minimal 1")
                paket = PaketService.get_by_id(paket_id)
                MemberService.tambah_waktu(member_id, paket, operator=kasir, qty=qty)
        else:
            paket_id = data.get("paket_id")
            qty = int(data.get("qty", 1))
            if qty <= 0:
                raise ValueError("Kuantitas harus minimal 1")
            paket = PaketService.get_by_id(paket_id)
            MemberService.tambah_waktu(member_id, paket, operator=kasir, qty=qty)
            
        return jsonify({"success": True, "message": "Waktu berhasil ditambah"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 3. HISTORY & RECOVERY (REFUND)
# =========================================================================
# Fokus: Melihat histori pembelian dan melakukan pembatalan transaksi (Refund).

@member_bp.route("/member/<int:member_id>/paket", methods=["GET"])
@login_required
def get_riwayat_paket(member_id):
    """Ambil histori pembelian paket member untuk keperluan audit/refund kasir."""
    try:
        paket_list = MemberService.get_riwayat_paket(member_id)
        return jsonify({"paket": paket_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@member_bp.route("/member/refund-paket", methods=["POST"])
@login_required
def refund_paket():
    """Batalkan transaksi paket: Potong saldo waktu dan tandai transaksi direfund."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        result = MemberService.refund_paket(
            member_id=data.get("member_id"),
            transaksi_id=data.get("transaksi_id"),
            operator=kasir
        )
        return jsonify({
            "success": True,
            "message": f"Refund berhasil: -{result['durasi_dikurangi']} Menit |  Member {result['username']}."
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# app/routes/sesi_routes.py

"""Routes untuk operasi sesi bermain.

Blueprint ini menyediakan endpoint untuk membuka, menutup,
memindah, dan menambah waktu sesi bermain di dashboard kasir.
"""

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required
from app.services import SesiService
from app.services import PaketService

sesi_api_bp = Blueprint("sesi", __name__)


# =========================================================================
# 1. PEMBUKAAN SESI (SESSION INITIATION)
# =========================================================================
# Fokus: Melayani pendaftaran sesi baru baik untuk Guest maupun Member.

@sesi_api_bp.route("/buka-guest", methods=["POST"])
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
            operator=kasir,
            metode_pembayaran=data.get("metode_pembayaran", "Tunai")
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

@sesi_api_bp.route("/buka-member", methods=["POST"])
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

@sesi_api_bp.route("/buka-guest-batch", methods=["POST"])
@login_required
def buka_guest_batch():
    """Buka sesi baru untuk banyak guest di beberapa PC sekaligus."""
    try:
        data = request.get_json() or {}
        pc_kodes = data.get("pc_kodes") or []
        paket_id = data.get("paket_id")
        prefix = (data.get("nama_guest_prefix") or "Guest").strip()
        metode_pembayaran = data.get("metode_pembayaran", "Tunai")
        kasir = session.get("kasir_username", "kasir")

        if not pc_kodes or not isinstance(pc_kodes, list):
            return jsonify({"error": "Daftar PC (pc_kodes) harus berupa array non-kosong"}), 400
        if not paket_id:
            return jsonify({"error": "Paket harus dipilih"}), 400

        created = []
        errors = []

        for idx, pc_kode in enumerate(pc_kodes):
            nama_guest = f"{prefix}-{idx + 1}" if len(pc_kodes) > 1 and "-" not in prefix else (prefix if len(pc_kodes) == 1 else f"{prefix} {idx + 1}")
            try:
                sesi = SesiService.buka_guest(
                    pc_kode=pc_kode,
                    paket_id=paket_id,
                    nama_guest=nama_guest,
                    operator=kasir,
                    metode_pembayaran=metode_pembayaran
                )
                created.append({
                    "pc_kode": pc_kode,
                    "sesi_id": sesi.id,
                    "token_sesi": sesi.token_sesi,
                    "nama_guest": nama_guest
                })
            except Exception as e:
                errors.append({"pc_kode": pc_kode, "error": str(e)})

        return jsonify({
            "success": len(created) > 0,
            "created": created,
            "errors": errors,
            "total_success": len(created),
            "total_failed": len(errors)
        }), 201 if len(created) > 0 else 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. OPERASI SESI BERJALAN (ACTIVE OPERATIONS)
# =========================================================================
# Fokus: Perubahan pada sesi yang sedang aktif (Pindah PC & Tambah Waktu).

@sesi_api_bp.route("/tambah-waktu-batch", methods=["POST"])
@login_required
def tambah_waktu_batch():
    """Tambah durasi pada beberapa sesi bermain aktif sekaligus."""
    try:
        data = request.get_json() or {}
        sesi_ids = data.get("sesi_ids") or []
        selections = data.get("selections")
        paket_id = data.get("paket_id")
        qty = int(data.get("qty", 1))
        metode_pembayaran = data.get("metode_pembayaran", "Tunai")
        kasir = session.get("kasir_username", "kasir")

        if not sesi_ids or not isinstance(sesi_ids, list):
            return jsonify({"error": "Daftar sesi (sesi_ids) harus berupa array non-kosong"}), 400

        success_list = []
        errors = []

        for sesi_id in sesi_ids:
            try:
                if selections:
                    for sel in selections:
                        p_id = sel.get("paket_id")
                        q = int(sel.get("qty", 1))
                        if q <= 0: raise ValueError("Kuantitas minimal 1")
                        p = PaketService.get_by_id(p_id)
                        SesiService.tambah_waktu_sesi(sesi_id, p, operator=kasir, qty=q, metode_pembayaran=metode_pembayaran)
                elif paket_id:
                    p = PaketService.get_by_id(paket_id)
                    SesiService.tambah_waktu_sesi(sesi_id, p, operator=kasir, qty=qty, metode_pembayaran=metode_pembayaran)
                else:
                    raise ValueError("Paket belum dipilih")
                success_list.append(sesi_id)
            except Exception as e:
                errors.append({"sesi_id": sesi_id, "error": str(e)})

        return jsonify({
            "success": len(success_list) > 0,
            "success_ids": success_list,
            "errors": errors,
            "total_success": len(success_list),
            "total_failed": len(errors)
        }), 200 if len(success_list) > 0 else 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_api_bp.route("/tambah-waktu-sesi/<int:sesi_id>", methods=["POST"])
@login_required
def tambah_waktu_sesi(sesi_id):
    """Tambah durasi pada sesi yang sedang aktif bermain (mendukung multiple paket)."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        metode_pembayaran = data.get("metode_pembayaran", "Tunai")
        
        selections = data.get("selections")
        if selections:
            for sel in selections:
                paket_id = sel.get("paket_id")
                qty = int(sel.get("qty", 1))
                if qty <= 0:
                    raise ValueError("Kuantitas harus minimal 1")
                paket = PaketService.get_by_id(paket_id)
                SesiService.tambah_waktu_sesi(sesi_id, paket, operator=kasir, qty=qty, metode_pembayaran=metode_pembayaran)
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
            result = SesiService.tambah_waktu_sesi(sesi_id, paket, operator=kasir, qty=qty, metode_pembayaran=metode_pembayaran)
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

@sesi_api_bp.route("/pindah-pc/<int:sesi_id>", methods=["POST"])
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

@sesi_api_bp.route("/tutup/<int:sesi_id>", methods=["POST"])
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

@sesi_api_bp.route("/tutup-batch", methods=["POST"])
@login_required
def tutup_sesi_batch():
    """Mengakhiri beberapa sesi bermain aktif sekaligus secara batch."""
    try:
        data = request.get_json() or {}
        sesi_ids = data.get("sesi_ids") or []
        kasir = session.get("kasir_username", "kasir")

        if not sesi_ids or not isinstance(sesi_ids, list):
            return jsonify({"error": "Daftar sesi (sesi_ids) harus berupa array non-kosong"}), 400

        closed = []
        errors = []

        for sesi_id in sesi_ids:
            try:
                SesiService.tutup_sesi(sesi_id, operator=kasir)
                closed.append(sesi_id)
            except Exception as e:
                errors.append({"sesi_id": sesi_id, "error": str(e)})

        return jsonify({
            "success": len(closed) > 0,
            "closed_ids": closed,
            "errors": errors,
            "total_success": len(closed),
            "total_failed": len(errors)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_api_bp.route("/<int:sesi_id>", methods=["GET"])
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

@sesi_api_bp.route("/<int:sesi_id>/riwayat-paket", methods=["GET"])
@login_required
def get_riwayat_paket(sesi_id):
    """Ambil histori pembelian paket guest untuk audit/refund kasir."""
    try:
        paket_list = SesiService.get_riwayat_paket_sesi(sesi_id)
        return jsonify({"paket": paket_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@sesi_api_bp.route("/refund-paket", methods=["POST"])
@login_required
def refund_paket():
    """Batalkan transaksi paket guest: Potong saldo waktu sesi guest dan tandai transaksi direfund."""
    try:
        data = request.get_json() or {}
        kasir = session.get("kasir_username", "kasir")
        result = SesiService.refund_paket_guest(
            sesi_id=data.get("sesi_id"),
            transaksi_id=data.get("transaksi_id"),
            operator=kasir
        )
        return jsonify({
            "success": True,
            "message": f"Refund berhasil: -{result['durasi_dikurangi']} Menit | Guest {result['nama_guest']}."
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
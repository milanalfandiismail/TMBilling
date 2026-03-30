# app/routes/paket.py - HARD DELETE

from flask import Blueprint, request, jsonify
from app import db
from app.models import Paket, Sesi  # Import Sesi untuk cek

paket_bp = Blueprint("paket", __name__)

KASIR_KEY = "kasir-rahasia-ganti-ini"

def cek_kasir(req):
    key = req.headers.get("X-Kasir-Key")
    if key != KASIR_KEY:
        return jsonify({"error": "Akses ditolak"}), 403
    return None


@paket_bp.route("/", methods=["GET"])
def list_paket():
    """List semua paket (aktif saja untuk dropdown)"""
    aktif_only = request.args.get('aktif', 'false').lower() == 'true'
    
    query = Paket.query
    if aktif_only:
        query = query.filter_by(aktif=True)
    
    paket = query.order_by(Paket.harga).all()
    return jsonify({
        "paket": [p.to_dict() for p in paket]
    }), 200

@paket_bp.route("/", methods=["POST"])
def tambah_paket():
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    nama = data.get("nama", "").strip()
    durasi = data.get("durasi_menit")
    harga = data.get("harga")
    kadaluarsa_hari = data.get("kadaluarsa_hari", 30)  # default 30 hari
    
    if not nama or durasi is None or harga is None:
        return jsonify({"error": "nama, durasi_menit, harga wajib diisi"}), 400
    
    # VALIDASI: kadaluarsa_hari minimal 1 hari
    if kadaluarsa_hari <= 0:
        return jsonify({"error": "Kadaluarsa minimal 1 hari"}), 400
    
    paket = Paket(
        nama=nama,
        durasi_menit=int(durasi),
        harga=int(harga),
        kadaluarsa_hari=int(kadaluarsa_hari),
        aktif=True
    )
    db.session.add(paket)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Paket ditambahkan",
        "paket": paket.to_dict()
    }), 201


@paket_bp.route("/<int:paket_id>", methods=["PUT"])
def edit_paket(paket_id):
    err = cek_kasir(request)
    if err: return err
    
    paket = Paket.query.get_or_404(paket_id)
    data = request.get_json() or {}
    
    if "nama" in data:
        paket.nama = data["nama"]
    if "durasi_menit" in data:
        paket.durasi_menit = int(data["durasi_menit"])
    if "harga" in data:
        paket.harga = int(data["harga"])
    if "kadaluarsa_hari" in data:
        kadaluarsa = int(data["kadaluarsa_hari"])
        if kadaluarsa <= 0:
            return jsonify({"error": "Kadaluarsa minimal 1 hari"}), 400
        paket.kadaluarsa_hari = kadaluarsa
    
    db.session.commit()
    return jsonify({
        "success": True,
        "message": "Paket diupdate",
        "paket": paket.to_dict()
    }), 200


@paket_bp.route("/<int:paket_id>", methods=["DELETE"])
def hapus_paket(paket_id):
    """HARD DELETE paket"""
    err = cek_kasir(request)
    if err: return err
    
    paket = Paket.query.get_or_404(paket_id)
    
    # Cek kalau paket pernah dipakai di sesi
    pernah_dipakai = Sesi.query.filter_by(paket_id=paket.id).first() is not None
    
    if pernah_dipakai:
        # Soft delete - nonaktifkan saja
        paket.aktif = False
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Paket dinonaktifkan (sudah pernah dipakai)",
            "soft_deleted": True
        }), 200
    else:
        # Hard delete - hapus permanen
        db.session.delete(paket)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Paket dihapus permanen",
            "deleted": True
        }), 200
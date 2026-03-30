# app/routes/layout.py - SEDERHANA

from flask import Blueprint, request, jsonify
from app import db
from app.models import PC, Sesi, now_local
import re

now_local()

layout_bp = Blueprint("layout", __name__)

KASIR_KEY = "kasir-rahasia-ganti-ini"

def cek_kasir(req):
    key = req.headers.get("X-Kasir-Key")
    if key != KASIR_KEY:
        return jsonify({"error": "Akses ditolak"}), 403
    return None


@layout_bp.route("/pc", methods=["GET"])
def list_pc():
    """List semua PC"""
    err = cek_kasir(request)
    if err: return err
    
    pcs = PC.query.filter_by(aktif=True).order_by(PC.grup, PC.kode).all()
    
    # Group by grup
    grouped = {}
    for pc in pcs:
        g = pc.grup or "reguler"
        if g not in grouped:
            grouped[g] = []
        grouped[g].append(pc.to_dict())
    
    return jsonify({
        "pc_list": [pc.to_dict() for pc in pcs],
        "grouped": grouped
    }), 200


@layout_bp.route("/pc", methods=["POST"])
def tambah_pc():
    """Tambah PC baru"""
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    kode = data.get("kode", "").strip().upper()
    nama = data.get("nama", "").strip()
    ip = data.get("ip_address", "").strip()
    grup = data.get("grup", "reguler").lower()
    
    if not kode:
        return jsonify({"error": "Kode PC wajib diisi"}), 400
    
    if grup not in ["reguler", "vip", "vvip"]:
        return jsonify({"error": "Grup: reguler/vip/vvip"}), 400
    
    # Validasi IP
    if ip:
        if not re.match(r'^(\d{1,3}\.){3}\d{1,3}$', ip):
            return jsonify({"error": "Format IP salah"}), 400
    
    # Cek duplikat
    if PC.query.filter_by(kode=kode).first():
        return jsonify({"error": f"Kode '{kode}' sudah ada"}), 409
    
    if ip and PC.query.filter_by(ip_address=ip).first():
        return jsonify({"error": f"IP '{ip}' sudah dipakai"}), 409
    
    pc = PC(
        kode=kode,
        nama=nama or kode,
        ip_address=ip or None,
        grup=grup,
        zona=grup,
        aktif=True
    )
    db.session.add(pc)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "PC ditambahkan",
        "pc": pc.to_dict()
    }), 201


@layout_bp.route("/pc/<int:pc_id>", methods=["DELETE"])
def hapus_pc(pc_id):
    """Hapus PC"""
    err = cek_kasir(request)
    if err: return err
    
    pc = PC.query.get_or_404(pc_id)
    
    # Cek kalau sedang dipakai
    if Sesi.query.filter_by(pc_id=pc.id, status="aktif").first():
        return jsonify({"error": "PC sedang dipakai, tidak bisa hapus"}), 409
    
    # Hard delete kalau belum pernah dipakai, soft delete kalau sudah
    pernah_dipakai = Sesi.query.filter_by(pc_id=pc.id).first() is not None
    
    if pernah_dipakai:
        pc.aktif = False
        db.session.commit()
        return jsonify({"success": True, "message": "PC dinonaktifkan"}), 200
    else:
        db.session.delete(pc)
        db.session.commit()
        return jsonify({"success": True, "message": "PC dihapus"}), 200


@layout_bp.route("/pc/batch", methods=["POST"])
def tambah_batch():
    """Tambah banyak PC sekaligus"""
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    prefix = data.get("prefix", "PC").upper()
    start = int(data.get("start", 1))
    end = int(data.get("end", 5))
    grup = data.get("grup", "reguler").lower()
    ip_base = data.get("ip_base", "").strip()
    
    added = []
    errors = []
    
    for i in range(start, end + 1):
        kode = f"{prefix}-{i:02d}"
        
        if PC.query.filter_by(kode=kode).first():
            errors.append(f"{kode} sudah ada")
            continue
        
        ip = None
        if ip_base:
            ip = f"{ip_base}.{100 + i}"
            if PC.query.filter_by(ip_address=ip).first():
                errors.append(f"IP {ip} sudah dipakai")
                continue
        
        pc = PC(kode=kode, nama=f"{prefix} {i}", ip_address=ip, grup=grup, zona=grup, aktif=True)
        db.session.add(pc)
        added.append(kode)
    
    if added:
        db.session.commit()
    
    return jsonify({
        "success": True,
        "added": len(added),
        "pc_list": added,
        "errors": errors
    }), 201
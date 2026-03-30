# app/routes/kasir.py - FIX LENGKAP

from flask import Blueprint, request, jsonify, render_template, send_from_directory
from app import db
from app.models import Sesi, PC, Member, Paket, Transaksi, now_local
from datetime import datetime, timezone, timedelta  # FIX: timedelta di sini
from sqlalchemy import func
import pytz
import os

kasir_bp = Blueprint("kasir", __name__, static_folder='../../static')

KASIR_KEY = "kasir-rahasia-ganti-ini"

def cek_kasir(req):
    key = req.headers.get("X-Kasir-Key")
    if key != KASIR_KEY:
        return jsonify({"error": "Akses ditolak"}), 403
    return None


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------
@kasir_bp.route("/", methods=["GET"])
def dashboard():
    return render_template("kasir/index.html")


@kasir_bp.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory(
        os.path.join(os.path.dirname(__file__), '..', '..', 'static'),
        filename
    )

# ---------------------------------------------------------------------------
# LIST PC - Dengan cleanup
# ---------------------------------------------------------------------------
@kasir_bp.route("/pc", methods=["GET"])
def list_pc():
    err = cek_kasir(request)
    if err:
        return err
    
    # FIX: Cleanup sesi habis dulu
    cleanup_sesi_habis()
    
    pcs = PC.query.filter_by(aktif=True).order_by(PC.grup, PC.kode).all()
    
    result = {}
    for pc in pcs:
        g = pc.grup or "reguler"
        if g not in result:
            result[g] = []
        
        pc_data = pc.to_dict()
        
        # FIX: Cek ulang sesi aktif setelah cleanup
        if pc_data["sesi_id"]:
            sesi = Sesi.query.get(pc_data["sesi_id"])
            if sesi and sesi.status == "aktif":
                pc_data["sesi_detail"] = sesi.to_dict()
                pc_data["status"] = "terpakai"
            else:
                # Sesi sudah tidak aktif
                pc_data["sesi_id"] = None
                pc_data["sesi_detail"] = None
                pc_data["status"] = "kosong"
        
        result[g].append(pc_data)
    
    return jsonify({
        "pc_list": [pc.to_dict() for pc in pcs],
        "by_grup": result
    }), 200


# ---------------------------------------------------------------------------
# BUKA GUEST
# ---------------------------------------------------------------------------
@kasir_bp.route("/buka-guest", methods=["POST"])
def buka_guest():
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    pc_kode = data.get("pc_kode")
    paket_id = data.get("paket_id")
    nama_guest = data.get("nama_guest", "Guest")
    
    if not pc_kode or not paket_id:
        return jsonify({"error": "pc_kode dan paket_id wajib diisi"}), 400
    
    pc = PC.query.filter_by(kode=pc_kode, aktif=True).first()
    if not pc:
        return jsonify({"error": f"PC '{pc_kode}' tidak ditemukan"}), 404
    
    # Cek PC kosong
    sesi_aktif = Sesi.query.filter_by(pc_id=pc.id, status="aktif").first()
    if sesi_aktif:
        return jsonify({"error": f"PC '{pc_kode}' sedang dipakai"}), 409
    
    paket = Paket.query.filter_by(id=paket_id, aktif=True).first()
    if not paket:
        return jsonify({"error": "Paket tidak ditemukan"}), 404
    
    sesi = Sesi(
        tipe="guest",
        nama_guest=nama_guest,
        pc_id=pc.id,
        paket_id=paket.id,
        menit_dibeli=paket.durasi_menit,
        total_bayar=paket.harga,
        status="aktif"
    )
    db.session.add(sesi)
    db.session.flush()
    
    log = Transaksi(
        sesi_id=sesi.id,
        paket_id=paket.id,
        jenis="beli_paket",
        jumlah=paket.harga,
        menit=paket.durasi_menit,
        keterangan=f"Guest '{nama_guest}' di {pc_kode}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Sesi guest dibuka",
        "sesi_id": sesi.id,
        "sisa_menit": sesi.sisa_menit()
    }), 201


# ---------------------------------------------------------------------------
# BUKA MEMBER
# ---------------------------------------------------------------------------
@kasir_bp.route("/buka-member", methods=["POST"])
def buka_member():
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    pc_kode = data.get("pc_kode")
    paket_id = data.get("paket_id")
    username = data.get("username")
    
    if not pc_kode or not paket_id or not username:
        return jsonify({"error": "pc_kode, paket_id, dan username wajib diisi"}), 400
    
    pc = PC.query.filter_by(kode=pc_kode, aktif=True).first()
    if not pc:
        return jsonify({"error": f"PC '{pc_kode}' tidak ditemukan"}), 404
    
    if Sesi.query.filter_by(pc_id=pc.id, status="aktif").first():
        return jsonify({"error": f"PC '{pc_kode}' sedang dipakai"}), 409
    
    member = Member.query.filter_by(username=username, aktif=True).first()
    if not member:
        return jsonify({"error": f"Member '{username}' tidak ditemukan"}), 404
    
    paket = Paket.query.filter_by(id=paket_id, aktif=True).first()
    if not paket:
        return jsonify({"error": "Paket tidak ditemukan"}), 404
    
    # CEK dan KURANGI SALDO
    total_saldo = member.total_saldo
    if total_saldo >= paket.durasi_menit:
        # Pakai saldo
        success, _ = member.kurangi_saldo(paket.durasi_menit)
        if success:
            menit_saldo_terpakai = paket.durasi_menit
            total_bayar = 0
        else:
            menit_saldo_terpakai = 0
            total_bayar = paket.harga
    else:
        # Bayar paket
        menit_saldo_terpakai = 0
        total_bayar = paket.harga
    
    sesi = Sesi(
        tipe="member",
        member_id=member.id,
        pc_id=pc.id,
        paket_id=paket.id,
        menit_dibeli=paket.durasi_menit,
        menit_saldo_terpakai=menit_saldo_terpakai,
        total_bayar=total_bayar,
        status="aktif"
    )
    db.session.add(sesi)
    db.session.flush()
    
    log = Transaksi(
        sesi_id=sesi.id,
        member_id=member.id,
        paket_id=paket.id,
        jenis="beli_paket",
        jumlah=total_bayar,
        menit=paket.durasi_menit,
        keterangan=f"Member '{username}' di {pc_kode}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Sesi member dibuka",
        "sesi_id": sesi.id,
        "sisa_menit": sesi.sisa_menit(),
        "saldo_tersisa": member.total_saldo
    }), 201


# ---------------------------------------------------------------------------
# TUTUP SESSI - FIX: Route parameter benar
# ---------------------------------------------------------------------------
@kasir_bp.route("/tutup/<int:sesi_id>", methods=["POST"])
def tutup_sesi(sesi_id):
    err = cek_kasir(request)
    if err: return err
    
    sesi = Sesi.query.filter_by(id=sesi_id, status="aktif").first()
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan atau sudah selesai"}), 404
    
    sisa = sesi.sisa_menit()
    
    # Simpan sisa ke saldo member (dengan kadaluarsa dari paket)
    if sesi.tipe == "member" and sesi.member_id and sisa > 0:
        member = Member.query.get(sesi.member_id)
        if member:
            kadaluarsa_hari = sesi.paket.kadaluarsa_hari if sesi.paket else 30
            member.tambah_saldo(sisa, kadaluarsa_hari, sesi_id)
    
    sesi.status = "selesai"
    sesi.selesai_pada = now_local()
    
    log = Transaksi(
        sesi_id=sesi.id,
        member_id=sesi.member_id,
        jenis="selesai_sesi",
        menit=sesi.menit_terpakai(),
        jumlah=sesi.total_bayar,
        keterangan=f"Sesi selesai, sisa {sisa} menit"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Sesi ditutup",
        "sisa_menit_disimpan": sisa if sesi.tipe == "member" else 0
    }), 200

# ---------------------------------------------------------------------------
# TAMBAH WAKTU
# ---------------------------------------------------------------------------
@kasir_bp.route("/tambah-waktu/<int:sesi_id>", methods=["POST"])
def tambah_waktu(sesi_id):
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    paket_id = data.get("paket_id")
    
    if not paket_id:
        return jsonify({"error": "paket_id wajib diisi"}), 400
    
    sesi = Sesi.query.filter_by(id=sesi_id, status="aktif").first()
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan atau sudah selesai"}), 404
    
    paket = Paket.query.filter_by(id=paket_id, aktif=True).first()
    if not paket:
        return jsonify({"error": "Paket tidak ditemukan"}), 404
    
    sesi.menit_dibeli += paket.durasi_menit
    sesi.total_bayar += paket.harga
    
    log = Transaksi(
        sesi_id=sesi.id,
        member_id=sesi.member_id,
        paket_id=paket.id,
        jenis="tambah_waktu",
        jumlah=paket.harga,
        menit=paket.durasi_menit,
        keterangan=f"Tambah {paket.nama}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Ditambahkan {paket.durasi_menit} menit",
        "sisa_menit": sesi.sisa_menit()
    }), 200



# ---------------------------------------------------------------------------
# STATUS SESSI - Fix auto-stop
# ---------------------------------------------------------------------------
@kasir_bp.route("/status/<int:sesi_id>", methods=["GET"])
def status_sesi(sesi_id):
    sesi = Sesi.query.get(sesi_id)
    
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan"}), 404
    
    # Cek dan auto-stop kalau habis
    sisa = sesi.sisa_menit()
    
    if sesi.status != "aktif":
        return jsonify({
            "aktif": False,
            "status": "selesai"
        }), 200
    
    if sisa <= 0:
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()
        db.session.commit()
        
        return jsonify({
            "aktif": False,
            "status": "habis",
            "message": "Waktu habis, sesi dihentikan"
        }), 200
    
    # FIX: Kirim nama member yang benar
    nama = sesi.member.nama_lengkap if sesi.member else (sesi.nama_guest or "Guest")
    
    return jsonify({
        "aktif": True,
        "sesi_id": sesi.id,
        "sisa_menit": sisa,
        "menit_terpakai": sesi.menit_terpakai(),
        "tipe": sesi.tipe,
        "nama": nama  # Sekarang kirim nama lengkap
    }), 200

# ---------------------------------------------------------------------------
# PINDAH PC
# ---------------------------------------------------------------------------
@kasir_bp.route("/pindah", methods=["POST"])
def pindah_pc():
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    sesi_id = data.get("sesi_id")
    pc_kode_baru = data.get("pc_kode_baru")
    
    if not sesi_id or not pc_kode_baru:
        return jsonify({"error": "sesi_id dan pc_kode_baru wajib diisi"}), 400
    
    sesi = Sesi.query.filter_by(id=sesi_id, status="aktif").first()
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan"}), 404
    
    pc_baru = PC.query.filter_by(kode=pc_kode_baru, aktif=True).first()
    if not pc_baru:
        return jsonify({"error": f"PC '{pc_kode_baru}' tidak ditemukan"}), 404
    
    if Sesi.query.filter_by(pc_id=pc_baru.id, status="aktif").first():
        return jsonify({"error": f"PC '{pc_kode_baru}' sedang dipakai"}), 409
    
    sesi.pc_id = pc_baru.id
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Pindah ke {pc_kode_baru}"
    }), 200


# ---------------------------------------------------------------------------
# MEMBER CRUD
# ---------------------------------------------------------------------------
@kasir_bp.route("/member", methods=["GET"])
def list_member():
    err = cek_kasir(request)
    if err: return err
    
    members = Member.query.filter_by(aktif=True).all()
    return jsonify({
        "members": [m.to_dict() for m in members]
    }), 200


@kasir_bp.route("/member", methods=["POST"])
def tambah_member():
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    nama = data.get("nama_lengkap", "")
    
    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi"}), 400
    
    if Member.query.filter_by(username=username).first():
        return jsonify({"error": f"Username '{username}' sudah ada"}), 409
    
    member = Member(
        username=username,
        nama_lengkap=nama,
        email=data.get("email"),
        no_hp=data.get("no_hp")
    )
    member.set_password(password)
    db.session.add(member)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Member berhasil dibuat",
        "member": member.to_dict()
    }), 201



# ---------------------------------------------------------------------------
# CLEANUP SESSI HABIS - Panggil sebelum return list PC
# ---------------------------------------------------------------------------
def cleanup_sesi_habis():
    """Auto-stop semua sesi yang waktunya habis"""
    try:
        sesi_aktif = Sesi.query.filter_by(status="aktif").all()
        count = 0
        
        for sesi in sesi_aktif:
            if sesi.sisa_menit() <= 0:
                sesi.status = "selesai"
                sesi.selesai_pada = now_local()
                count += 1
        
        if count > 0:
            db.session.commit()
            print(f"[AUTO-STOP] {count} sesi dihentikan karena waktu habis")
        
        return count
    except Exception as e:
        print(f"[AUTO-STOP ERROR] {e}")
        return 0



# ---------------------------------------------------------------------------
# LAPORAN
# ---------------------------------------------------------------------------
@kasir_bp.route("/laporan-harian", methods=["GET"])
def laporan_harian():
    err = cek_kasir(request)
    if err: return err
    
    hari_ini = now_local().date()
    
    total = db.session.query(func.sum(Transaksi.jumlah)).filter(
        func.date(Transaksi.dibuat_pada) == hari_ini,
        Transaksi.jenis.in_(["beli_paket", "tambah_waktu"])
    ).scalar() or 0
    
    total_sesi = Sesi.query.filter(
        func.date(Sesi.mulai_pada) == hari_ini
    ).count()
    
    aktif_sekarang = Sesi.query.filter_by(status="aktif").count()
    
    return jsonify({
        "tanggal": str(hari_ini),
        "total_pendapatan": total,
        "total_sesi": total_sesi,
        "sesi_aktif": aktif_sekarang
    }), 200


    
@kasir_bp.route("/member/<int:member_id>", methods=["GET"])
def get_member_detail(member_id):
    """Get detail member termasuk saldo_details"""
    err = cek_kasir(request)
    if err: return err
    
    member = Member.query.get_or_404(member_id)
    return jsonify({
        "member": member.to_dict()
    }), 200


# app/routes/kasir.py - Hapus Utils.formatDuration

@kasir_bp.route("/member/<int:member_id>/topup", methods=["POST"])
def topup_member(member_id):
    """Topup saldo member dengan paket"""
    err = cek_kasir(request)
    if err: return err
    
    data = request.get_json() or {}
    paket_id = data.get("paket_id")
    metode = data.get("metode", "tunai")
    
    if not paket_id:
        return jsonify({"error": "paket_id wajib diisi"}), 400
    
    member = Member.query.get_or_404(member_id)
    paket = Paket.query.filter_by(id=paket_id, aktif=True).first()
    
    if not paket:
        return jsonify({"error": "Paket tidak ditemukan"}), 404
    
    # Tambah saldo dengan kadaluarsa dari paket
    member.tambah_saldo(paket.durasi_menit, paket.kadaluarsa_hari)
    
    # Catat transaksi
    transaksi = Transaksi(
        member_id=member.id,
        paket_id=paket.id,
        jenis="topup",
        jumlah=paket.harga,
        menit=paket.durasi_menit,
        keterangan=f"Topup via {metode} - {paket.nama}"
    )
    db.session.add(transaksi)
    db.session.commit()
    
    # Format manual tanpa Utils
    durasi_text = f"{paket.durasi_menit} menit"
    if paket.durasi_menit >= 60:
        jam = paket.durasi_menit // 60
        menit = paket.durasi_menit % 60
        if menit > 0:
            durasi_text = f"{jam} jam {menit} menit"
        else:
            durasi_text = f"{jam} jam"
    
    sisa_text = f"{member.total_saldo} menit"
    if member.total_saldo >= 60:
        jam = member.total_saldo // 60
        menit = member.total_saldo % 60
        if menit > 0:
            sisa_text = f"{jam} jam {menit} menit"
        else:
            sisa_text = f"{jam} jam"
    
    return jsonify({
        "success": True,
        "message": f"Topup {durasi_text} berhasil! Sisa saldo: {sisa_text}",
        "total_saldo": member.total_saldo
    }), 200
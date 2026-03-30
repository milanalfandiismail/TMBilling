# app/routes/session.py - UPDATE LENGKAP

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Sesi, PC, Member, Paket, Transaksi, now_local
from datetime import datetime, timezone
import secrets

session_bp = Blueprint("session", __name__)


def _require_token_sesi(data):
    """Helper: validasi token_sesi yang dikirim client C++"""
    token = data.get("token_sesi")
    if not token:
        return None, (jsonify({"error": "token_sesi wajib ada"}), 401)
    sesi = Sesi.query.filter_by(token_sesi=token, status="aktif").first()
    if not sesi:
        return None, (jsonify({"error": "Sesi tidak ditemukan atau sudah selesai"}), 404)
    return sesi, None


# ---------------------------------------------------------------------------
# STATUS  —  dipanggil client C++ tiap beberapa detik (polling)
# ---------------------------------------------------------------------------
@session_bp.route("/status", methods=["POST"])
def status():
    """
    Client C++ kirim token_sesi, server balas sisa menit.
    Jika sisa menit 0, server kasih perintah 'lock'.
    """
    data = request.get_json() or {}
    sesi, err = _require_token_sesi(data)
    if err:
        return err

    sisa = sesi.sisa_menit()

    if sisa <= 0 and sesi.status == "aktif":
        # Otomatis selesaikan sesi
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()
        db.session.commit()
        return jsonify({
            "status": "lock",
            "sisa_menit": 0,
            "pesan": "Waktu habis",
        }), 200

    return jsonify({
        "status": "aktif",
        "sisa_menit": sisa,
        "menit_terpakai": sesi.menit_terpakai(),
        "tipe": sesi.tipe,
        "nama": sesi.member.nama_lengkap if sesi.member else sesi.nama_guest,
    }), 200


# ---------------------------------------------------------------------------
# PINDAH PC  —  khusus member (login ulang di PC baru)
# ---------------------------------------------------------------------------
@session_bp.route("/pindah", methods=["POST"])
@jwt_required()
def pindah_pc():
    """
    Member login di PC baru saat masih ada sesi aktif di PC lama.
    Sesi lama di-pause (saldo dikembalikan ke akun), sesi baru dibuat.
    """
    member_id = int(get_jwt_identity())
    member = Member.query.get_or_404(member_id)

    data = request.get_json() or {}
    pc_kode = data.get("pc_kode")
    if not pc_kode:
        return jsonify({"error": "pc_kode wajib diisi"}), 400

    pc_baru = PC.query.filter_by(kode=pc_kode, aktif=True).first()
    if not pc_baru:
        return jsonify({"error": f"PC '{pc_kode}' tidak ditemukan"}), 404

    if pc_baru.sesi_aktif:
        return jsonify({"error": f"PC '{pc_kode}' sedang dipakai"}), 409

    # Hentikan sesi lama, kembalikan sisa menit ke saldo member
    sesi_lama = Sesi.query.filter_by(member_id=member.id, status="aktif").first()
    if sesi_lama:
        sisa = sesi_lama.sisa_menit()
        sesi_lama.status = "selesai"
        sesi_lama.selesai_pada = now_local()
        # Simpan sisa menit ke saldo
        member.saldo_menit = (member.saldo_menit or 0) + sisa
        db.session.flush()

    # Buat sesi baru di PC baru, gunakan saldo member
    sisa_saldo = member.saldo_menit
    sesi_baru = Sesi(
        tipe="member",
        member_id=member.id,
        pc_id=pc_baru.id,
        menit_dibeli=0,
        menit_saldo_terpakai=sisa_saldo,
        token_sesi=secrets.token_hex(32),
        status="aktif",
    )
    member.saldo_menit = 0
    db.session.add(sesi_baru)
    db.session.commit()

    return jsonify({
        "message": "Pindah PC berhasil",
        "sesi": sesi_baru.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# SELESAI  —  FIX: Bisa pakai token_sesi ATAU sesi_id
# ---------------------------------------------------------------------------
@session_bp.route("/selesai", methods=["POST"])
def selesai():
    """Akhiri sesi. Bisa dipanggil kasir (lewat token_sesi atau sesi_id)."""
    data = request.get_json() or {}
    
    # FIX: Support both token_sesi and sesi_id
    token = data.get("token_sesi")
    sesi_id = data.get("sesi_id")
    
    sesi = None
    if token:
        sesi = Sesi.query.filter_by(token_sesi=token, status="aktif").first()
    elif sesi_id:
        sesi = Sesi.query.filter_by(id=sesi_id, status="aktif").first()
    
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan atau sudah selesai"}), 404

    sisa = sesi.sisa_menit()

    # Kalau member dan masih ada sisa, simpan ke saldo
    if sesi.tipe == "member" and sesi.member and sisa > 0:
        member = sesi.member
        member.saldo_menit = (member.saldo_menit or 0) + sisa
        # Kadaluarsa saldo diambil dari paket, default 30 hari
        from datetime import timedelta
        kadaluarsa_hari = sesi.paket.kadaluarsa_hari if sesi.paket else 30
        if kadaluarsa_hari > 0:
            member.kadaluarsa_saldo = now_local() + timedelta(days=kadaluarsa_hari)

    sesi.status = "selesai"
    sesi.selesai_pada = now_local()

    log = Transaksi(
        sesi_id=sesi.id,
        member_id=sesi.member_id,
        jenis="selesai_sesi",
        menit=sesi.menit_terpakai(),
        jumlah=sesi.total_bayar,
        keterangan=f"Sesi selesai, sisa {sisa} menit",
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": "Sesi berhasil diakhiri",
        "sisa_menit_disimpan": sisa if sesi.tipe == "member" else 0,
        "sesi": sesi.to_dict(),
    }), 200


# ---------------------------------------------------------------------------
# TAMBAH MENIT  —  FIX: Bisa pakai token_sesi ATAU sesi_id + Dropdown paket
# ---------------------------------------------------------------------------
@session_bp.route("/tambah", methods=["POST"])
def tambah_menit():
    """Kasir tambah paket ke sesi yang sedang aktif."""
    data = request.get_json() or {}
    
    # FIX: Support both token_sesi and sesi_id
    token = data.get("token_sesi")
    sesi_id = data.get("sesi_id")
    
    sesi = None
    if token:
        sesi = Sesi.query.filter_by(token_sesi=token, status="aktif").first()
    elif sesi_id:
        sesi = Sesi.query.filter_by(id=sesi_id, status="aktif").first()
    
    if not sesi:
        return jsonify({"error": "Sesi tidak ditemukan atau sudah selesai"}), 404

    paket_id = data.get("paket_id")
    if not paket_id:
        return jsonify({"error": "paket_id wajib diisi"}), 400

    paket = Paket.query.filter_by(id=paket_id, aktif=True).first()
    if not paket:
        return jsonify({"error": "Paket tidak ditemukan"}), 404

    sesi.menit_dibeli += paket.durasi_menit
    sesi.total_bayar  += paket.harga

    log = Transaksi(
        sesi_id=sesi.id,
        member_id=sesi.member_id,
        paket_id=paket.id,
        jenis="beli_paket",
        jumlah=paket.harga,
        menit=paket.durasi_menit,
        keterangan=f"Tambah paket '{paket.nama}' saat sesi berlangsung",
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        "message": f"Ditambahkan {paket.durasi_menit} menit",
        "sesi": sesi.to_dict(),
    }), 200
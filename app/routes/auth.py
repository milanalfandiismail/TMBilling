# app/routes/auth.py

from flask import Blueprint, request, jsonify, session
from app import db
from app.models import Member, Sesi, now_local, SaldoDetail

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi"}), 400

    member = Member.query.filter_by(username=username, aktif=True).first()

    if not member or not member.check_password(password):
        return jsonify({"error": "Username atau password salah"}), 401

    # CLEANUP EXPIRED SALDO
    now = now_local()
    expired_details = SaldoDetail.query.filter(
        SaldoDetail.member_id == member.id,
        SaldoDetail.kadaluarsa_pada <= now,
        SaldoDetail.menit > 0
    ).all()
    
    expired_menit = 0
    for detail in expired_details:
        print(f"[EXPIRED] {detail.menit} menit from {detail.dibuat_pada}")
        expired_menit += detail.menit
        detail.menit = 0
    
    if expired_details:
        db.session.commit()

    sesi_aktif = Sesi.query.filter_by(member_id=member.id, status="aktif").first()
    session["member_id"] = member.id

    return jsonify({
        "success": True,
        "member": member.to_dict(),
        "sesi_aktif": sesi_aktif.to_dict() if sesi_aktif else None,
        "expired_menit": expired_menit,
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("member_id", None)
    return jsonify({"success": True, "message": "Logout berhasil"}), 200
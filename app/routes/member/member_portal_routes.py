# app/routes/member_portal_routes.py

"""Blueprint rute portal web member untuk pelanggan TMBilling.

Menyediakan halaman login, logout, dan dashboard statistik
bagi pelanggan member untuk memantau durasi main, sisa waktu,
riwayat login PC, dan transaksi billing mereka.
"""

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from app.models import db, now_local
from app.models import Member
from app.models import Sesi
from app.models import Transaksi
from functools import wraps

member_portal_bp = Blueprint("member_portal", __name__)


# =========================================================================
# SECURITY DECORATORS
# =========================================================================

def member_login_required(f):
    """Decorator untuk memproteksi halaman HTML portal member."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        member_id = session.get("member_id")
        if not member_id:
            return redirect(url_for("member_portal.login_page"))
            
        member = Member.query.get(member_id)
        if not member or not member.aktif:
            # Bersihkan session jika member dinonaktifkan/tidak ada
            session.pop("member_id", None)
            session.pop("member_username", None)
            session.pop("member_role", None)
            return redirect(url_for("member_portal.login_page"))
            
        return f(*args, **kwargs)
    return decorated_function


# =========================================================================
# MEMBER AUTHENTICATION
# =========================================================================

@member_portal_bp.route("/member/login", methods=["GET"])
def login_page():
    """Menampilkan halaman login portal member."""
    # Jika sudah login, langsung lempar ke dashboard
    if session.get("member_id"):
        return redirect(url_for("member_portal.dashboard_page"))
    return render_template("public/member/login.html")


@member_portal_bp.route("/member/login", methods=["POST"])
def login_action():
    """Proses login member menggunakan AJAX/Fetch."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi"}), 400
        
    try:
        member = Member.query.filter_by(username=username).first()
        if not member:
            return jsonify({"error": "Akun member tidak ditemukan"}), 404
            
        if not member.aktif:
            return jsonify({"error": "Akun member Anda dinonaktifkan oleh kasir"}), 403
            
        if not member.check_password(password):
            return jsonify({"error": "Password yang Anda masukkan salah"}), 401
            
        # Set session member
        session["member_id"] = member.id
        session["member_username"] = member.username
        session["member_role"] = "member"
        
        return jsonify({"success": True, "message": "Login berhasil", "redirect": url_for("member_portal.dashboard_page")}), 200
        
    except Exception as e:
        return jsonify({"error": f"Kesalahan sistem: {str(e)}"}), 500


@member_portal_bp.route("/member/logout", methods=["POST"])
def logout_action():
    """Keluar dari session member."""
    session.pop("member_id", None)
    session.pop("member_username", None)
    session.pop("member_role", None)
    return jsonify({"success": True, "redirect": url_for("member_portal.login_page")}), 200


@member_portal_bp.route("/api/public/pc-status", methods=["GET"])
def public_pc_status():
    """Mengambil status PC secara publik (untuk peta PC di landing page)."""
    try:
        from app.models import PC
        from app.models import Grup
        pcs = PC.query.join(Grup).order_by(Grup.nama, PC.kode).all()
        result = []
        for pc in pcs:
            s = pc.sesi_aktif
            is_occupied = not pc.aktif or s is not None or pc.is_admin_mode
            status_visual = "terpakai" if is_occupied else "kosong"
            
            sisa_menit = s.sisa_menit() if s else None
            sisa_waktu_display = None
            if not pc.aktif:
                sisa_waktu_display = "OFFLINE"
            elif pc.is_admin_mode:
                sisa_waktu_display = "ADMIN"
            elif sisa_menit is not None:
                h = sisa_menit // 60
                m = sisa_menit % 60
                if h > 0:
                    sisa_waktu_display = f"{h}j {m}m"
                else:
                    sisa_waktu_display = f"{m}m"
                    
            result.append({
                "id": pc.id,
                "kode": pc.kode,
                "nama": pc.nama or pc.kode,
                "grup": pc.grup.nama if pc.grup else "reguler",
                "status": status_visual,
                "aktif": pc.aktif,
                "sisa_menit": sisa_menit,
                "sisa_waktu_display": sisa_waktu_display
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": f"Gagal mengambil status PC: {str(e)}"}), 500


# =========================================================================
# MEMBER DASHBOARD
# =========================================================================

@member_portal_bp.route("/member", methods=["GET"])
@member_portal_bp.route("/member/dashboard", methods=["GET"])
@member_login_required
def dashboard_page():
    """Menampilkan halaman dashboard statistik pribadi member."""
    member_id = session.get("member_id")
    member = Member.query.get(member_id)
    
    # 1. Total menit bermain dari riwayat sesi
    total_play_minutes = sum(s.menit_terpakai() for s in member.sesi_list)
    total_play_hours = round(total_play_minutes / 60, 1)
    
    # 2. Total pengeluaran billing (jumlah Rupiah dari transaksi)
    total_spent = sum(t.jumlah for t in member.transaksi_list if not t.is_refunded)
    
    # 3. Riwayat Sesi Bermain (Maksimal 10 sesi terakhir)
    sesi_history = Sesi.query.filter_by(member_id=member.id).order_by(Sesi.mulai_pada.desc()).limit(10).all()
    
    # 4. Riwayat Transaksi Billing (Paginated, 10 transaksi per halaman)
    tx_page = request.args.get("tx_page", 1, type=int)
    tx_pagination = Transaksi.query.filter_by(member_id=member.id).order_by(Transaksi.dibuat_pada.desc()).paginate(page=tx_page, per_page=10, error_out=False)
    transaksi_history = tx_pagination.items
    
    return render_template(
        "public/member/dashboard.html",
        member=member,
        total_play_hours=total_play_hours,
        total_spent=total_spent,
        sesi_history=sesi_history,
        transaksi_history=transaksi_history,
        tx_pagination=tx_pagination
    )

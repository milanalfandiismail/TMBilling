# app/routes/menu_routes.py

"""Blueprint routes untuk POS Makanan & Minuman.

Menangani CRUD menu, upload file gambar secara aman, checkout belanjaan F&B,
dan riwayat transaksi penjualan makanan/minuman.
"""

import os
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
from app.services import MenuService
from app.routes.auth.auth_kasir_routes import login_required, admin_required

menu_bp = Blueprint("menu", __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def handle_image_upload(file):
    """Fungsi helper untuk menyimpan file gambar yang diupload ke static/uploads/menu."""
    if not file or file.filename == '':
        return None

    if not allowed_file(file.filename):
        raise ValueError("Ekstensi file tidak diizinkan (Gunakan: png, jpg, jpeg, gif, webp)")

    # Buat direktori upload jika belum ada
    upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'menu')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)

    filename = secure_filename(file.filename)
    # Tambahkan timestamp unik di nama file untuk mencegah tabrakan nama file
    base, ext = os.path.splitext(filename)
    unique_filename = f"{base}_{int(os.urandom(4).hex(), 16)}{ext}"
    
    file_path = os.path.join(upload_folder, unique_filename)
    file.save(file_path)
    
    # Kembalikan path URL statis
    return f"/static/uploads/menu/{unique_filename}"


@menu_bp.route("/menu", methods=["GET"])
@login_required
def get_menu_list():
    """Mengambil katalog semua makanan dan minuman."""
    try:
        menus = MenuService.get_all_menu()
        return jsonify({"success": True, "data": [m.to_dict() for m in menus]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu", methods=["POST"])
@login_required
@admin_required
def create_menu_item():
    """Membuat item menu baru beserta upload gambarnya."""
    try:
        nama = request.form.get("nama")
        harga = request.form.get("harga", 0)
        stok = request.form.get("stok", 0)
        
        # Validasi manual tipe data
        try:
            harga = int(harga)
            stok = int(stok)
        except ValueError:
            return jsonify({"success": False, "error": "Harga dan stok harus berupa angka"}), 400

        # Upload gambar
        file = request.files.get("gambar")
        gambar_path = None
        if file:
            gambar_path = handle_image_upload(file)

        operator = session.get("kasir_username", "system")
        menu = MenuService.create_menu({
            "nama": nama,
            "harga": harga,
            "stok": stok,
            "gambar_path": gambar_path
        }, operator=operator)

        return jsonify({"success": True, "data": menu.to_dict(), "message": f"Menu '{menu.nama}' berhasil dibuat!"}), 201
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu/<int:menu_id>", methods=["PUT"])
@login_required
@admin_required
def update_menu_item(menu_id):
    """Mengupdate item menu beserta upload gambar baru (jika ada)."""
    try:
        data = {}
        if "nama" in request.form:
            data["nama"] = request.form.get("nama")
        if "harga" in request.form:
            data["harga"] = int(request.form.get("harga", 0))
        if "stok" in request.form:
            data["stok"] = int(request.form.get("stok", 0))

        # Cek upload gambar baru
        file = request.files.get("gambar")
        if file:
            data["gambar_path"] = handle_image_upload(file)

        operator = session.get("kasir_username", "system")
        menu = MenuService.update_menu(menu_id, data, operator=operator)
        return jsonify({"success": True, "data": menu.to_dict(), "message": "Menu berhasil diperbarui!"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu/<int:menu_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_menu_item(menu_id):
    """Menghapus (arsip) item menu dari katalog.

    - Jika menu belum pernah terjual, dihapus permanen.
    - Jika memiliki transaksi historis, hanya diarsipkan (is_active=False) agar
      struk & laporan lama tetap valid (FK tidak dilanggar).
    """
    try:
        operator = session.get("kasir_username", "system")
        nama = MenuService.delete_menu(menu_id, operator=operator)
        return jsonify({
            "success": True,
            "message": f"Menu '{nama}' berhasil dihapus dari katalog!"
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu/<int:menu_id>/permanent", methods=["DELETE"])
@login_required
@admin_required
def hard_delete_menu_item(menu_id):
    """Menghapus menu permanen BERSAMA seluruh transaksi F&B terkait.

    Tindakan ini akan menghapus semua histori penjualan untuk menu tersebut.
    """
    try:
        operator = session.get("kasir_username", "system")
        result = MenuService.hard_delete_menu(menu_id, operator=operator)
        return jsonify({
            "success": True,
            "message": (
                f"Menu '{result['nama']}' dan {result['transaksi_dihapus']} "
                f"transaksi terkait berhasil dihapus permanen!"
            ),
            "transaksi_dihapus": result["transaksi_dihapus"],
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu/checkout", methods=["POST"])
@login_required
def checkout_order():
    """Checkout pesanan makanan/minuman."""
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"success": False, "error": "Payload JSON kosong"}), 400

        cart_items = payload.get("cart_items")
        pc_kode = payload.get("pc_kode")
        tunai = payload.get("tunai", 0)
        kembalian = payload.get("kembalian", 0)

        # Ambil identitas kasir dari session aktif
        kasir_username = session.get("kasir_username")
        if not kasir_username:
            return jsonify({"success": False, "error": "Kasir tidak terautentikasi"}), 401

        operator = kasir_username
        result = MenuService.checkout_menu_order(cart_items, pc_kode, kasir_username, operator=operator, tunai=tunai, kembalian=kembalian)

        return jsonify({"success": True, "data": result, "message": "Transaksi F&B berhasil diproses!"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_bp.route("/menu/transaksi", methods=["GET"])
@login_required
def get_all_transactions():
    """Mendapatkan riwayat seluruh transaksi menu."""
    try:
        transactions = MenuService.get_all_transactions()
        return jsonify({"success": True, "data": [t.to_dict() for t in transactions]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

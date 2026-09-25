# app/routes/menu_routes.py

"""Blueprint routes untuk POS Makanan & Minuman.

Menangani CRUD menu, upload file gambar secara aman, checkout belanjaan F&B,
dan riwayat transaksi penjualan makanan/minuman.
"""

import os
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
from app.services import MenuService
from app.middleware.auth import login_required, admin_required, shift_required
from app.utils.validators import validate_filename

menu_api_bp = Blueprint("menu", __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def handle_image_upload(file):
    """Fungsi helper untuk menyimpan file gambar yang diupload ke static/uploads/menu."""
    if not file or file.filename == '':
        return None

    validate_filename(file.filename, allowed_extensions=ALLOWED_EXTENSIONS, field_name="Gambar Menu")

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


@menu_api_bp.route("/", methods=["GET"])
@login_required
def get_menu_list():
    """Mengambil katalog semua makanan dan minuman aktif."""
    try:
        menus = MenuService.get_all_menu()
        return jsonify({"success": True, "data": [m.to_dict() for m in menus]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/archived", methods=["GET"])
@login_required
@admin_required
def get_archived_menu_list():
    """Mengambil daftar semua makanan dan minuman yang diarsipkan."""
    try:
        menus = MenuService.get_archived_menu()
        return jsonify({"success": True, "data": menus}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/", methods=["POST"])
@login_required
@admin_required
def create_menu_item():
    """Membuat item menu baru beserta upload gambarnya."""
    try:
        if request.is_json:
            json_data = request.get_json(silent=True) or {}
            nama = json_data.get("nama")
            harga = json_data.get("harga", 0)
            stok = json_data.get("stok", 0)
            gambar_path = json_data.get("gambar_path")
        else:
            nama = request.form.get("nama")
            harga = request.form.get("harga", 0)
            stok = request.form.get("stok", 0)
            file = request.files.get("gambar")
            gambar_path = handle_image_upload(file) if file else None

        # Validasi manual tipe data
        try:
            harga = int(harga) if harga is not None else 0
            stok = int(stok) if stok is not None else 0
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Harga dan stok harus berupa angka"}), 400

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


@menu_api_bp.route("/<int:menu_id>", methods=["PUT"])
@login_required
@admin_required
def update_menu_item(menu_id):
    """Mengupdate item menu beserta upload gambar baru (jika ada)."""
    try:
        data = {}
        if request.is_json:
            json_data = request.get_json(silent=True) or {}
            if "nama" in json_data:
                data["nama"] = json_data.get("nama")
            if "harga" in json_data:
                data["harga"] = int(json_data.get("harga", 0))
            if "stok" in json_data:
                data["stok"] = int(json_data.get("stok", 0))
            if json_data.get("hapus_gambar") is True or str(json_data.get("hapus_gambar")).lower() == "true":
                data["gambar_path"] = None
            elif "gambar_path" in json_data:
                data["gambar_path"] = json_data.get("gambar_path")
        else:
            if "nama" in request.form:
                data["nama"] = request.form.get("nama")
            if "harga" in request.form:
                data["harga"] = int(request.form.get("harga", 0))
            if "stok" in request.form:
                data["stok"] = int(request.form.get("stok", 0))

            # Cek penghapusan gambar atau upload gambar baru
            if request.form.get("hapus_gambar") == "true":
                data["gambar_path"] = None
            else:
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


@menu_api_bp.route("/<int:menu_id>/tambah-stok", methods=["POST"])
@login_required
@shift_required
def tambah_stok_menu(menu_id):
    """Menambahkan stok item menu (dapat dilakukan oleh kasir & admin saat shift aktif)."""
    try:
        payload = request.get_json(silent=True) or request.form.to_dict() or {}
        jumlah_tambah = payload.get("jumlah_tambah") if payload.get("jumlah_tambah") is not None else payload.get("jumlah")
        catatan = payload.get("catatan")

        if jumlah_tambah is None or str(jumlah_tambah).strip() == "":
            return jsonify({"success": False, "error": "Jumlah penambahan stok harus diisi"}), 400

        try:
            jumlah_tambah = int(jumlah_tambah)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Jumlah penambahan stok harus berupa angka valid"}), 400

        operator = session.get("kasir_username", "system")
        menu = MenuService.tambah_stok(menu_id, jumlah_tambah, operator=operator, catatan=catatan)
        return jsonify({
            "success": True,
            "data": menu.to_dict(),
            "message": f"Stok '{menu.nama}' berhasil ditambah sebanyak +{jumlah_tambah} (Total sekarang: {menu.stok})!"
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/<int:menu_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_menu_item(menu_id):
    """Mengarsipkan item menu dari katalog aktif ke arsip."""
    try:
        operator = session.get("kasir_username", "system")
        nama = MenuService.delete_menu(menu_id, operator=operator)
        return jsonify({
            "success": True,
            "message": f"Menu '{nama}' berhasil dipindahkan ke arsip!"
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/<int:menu_id>/restore", methods=["POST"])
@login_required
@admin_required
def restore_menu_item(menu_id):
    """Memulihkan item menu dari arsip kembali ke katalog aktif."""
    try:
        operator = session.get("kasir_username", "system")
        menu = MenuService.restore_menu(menu_id, operator=operator)
        return jsonify({
            "success": True,
            "data": menu.to_dict(),
            "message": f"Menu '{menu.nama}' berhasil dipulihkan dari arsip!"
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/<int:menu_id>/permanent", methods=["DELETE"])
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


@menu_api_bp.route("/checkout", methods=["POST"])
@login_required
@shift_required
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
        metode_pembayaran = payload.get("metode_pembayaran", "Tunai")

        # Ambil identitas kasir dari session aktif
        kasir_username = session.get("kasir_username")
        if not kasir_username:
            return jsonify({"success": False, "error": "Kasir tidak terautentikasi"}), 401

        operator = kasir_username
        result = MenuService.checkout_menu_order(cart_items, pc_kode, kasir_username, operator=operator, tunai=tunai, kembalian=kembalian, metode_pembayaran=metode_pembayaran)

        return jsonify({"success": True, "data": result, "message": "Transaksi F&B berhasil diproses!"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/transaksi", methods=["GET"])
@login_required
def get_all_transactions():
    """Mendapatkan riwayat seluruh transaksi menu."""
    try:
        transactions = MenuService.get_all_transactions()
        return jsonify({"success": True, "data": [t.to_dict() for t in transactions]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@menu_api_bp.route("/stock-logs", methods=["GET"])
@login_required
def get_stock_logs():
    """Mendapatkan riwayat mutasi / penambahan stok menu dengan filter dan pagination."""
    try:
        tanggal = request.args.get("tanggal")
        menu_id = request.args.get("menu_id")
        operator = request.args.get("operator")
        search = request.args.get("search")
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 15, type=int)

        data = MenuService.get_stock_logs(
            tanggal=tanggal,
            menu_id=menu_id,
            operator=operator,
            search=search,
            page=page,
            per_page=per_page
        )
        operators = MenuService.get_stock_log_operators()
        return jsonify({
            "success": True,
            "data": data["items"],
            "pagination": {
                "total": data["total"],
                "page": data["page"],
                "pages": data["pages"],
                "has_prev": data["has_prev"],
                "has_next": data["has_next"]
            },
            "operators": operators
        }), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


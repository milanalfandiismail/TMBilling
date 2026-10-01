# app/services/menu_service.py

"""Service untuk menangani business logic POS Makanan & Minuman.

Modul ini mengelola CRUD katalog makanan/minuman dan proses checkout transaksi F&B.
"""

from datetime import datetime
from app.models import db
from app.models import MenuItem, TransaksiMenu, MenuStockLog
from app.repositories import MenuRepository
from app.repositories import UserRepository
from app.utils.logger import write_log
from app.utils.validators import validate_string_length, validate_integer_range, validate_choice

class MenuService:
    """Service class untuk memproses data Menu dan Transaksinya."""

    @staticmethod
    def get_all_menu():
        """Mengambil semua menu di katalog."""
        return MenuRepository.get_all()

    @staticmethod
    def get_menu_by_id(menu_id):
        """Mengambil menu berdasarkan ID."""
        return MenuRepository.get_by_id(menu_id)

    @staticmethod
    def create_menu(data, operator="system"):
        """Membuat menu baru, atau me-restore menu arsip dengan nama yang sama.

        Alur: cek duplikat hanya pada menu aktif. Jika nama sudah ada di
        arsip (soft-deleted), kita restore + timpa stok/harga/gambar agar
        histori transaksi lama tetap konsisten dan kasir tidak perlu
        'hapus permanen' dulu sebelum buat menu dengan nama sama.
        """
        try:
            nama = validate_string_length(data.get("nama", ""), min_len=2, max_len=100, field_name="Nama menu", required=True)
            harga = validate_integer_range(data.get("harga", 0), 0, 1_000_000_000, "Harga menu")
            stok = validate_integer_range(data.get("stok", 0), -1, 1_000_000, "Stok menu")

            # 1. Tolak hanya jika ada menu AKTIF dengan nama yang sama
            active_dup = MenuRepository.get_by_name(nama)
            if active_dup:
                raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar")

            # 2. Cek apakah ada menu ARSIP dengan nama yang sama — jika ya, restore
            archived_dup = MenuRepository.get_by_name_including_archived(nama)
            if archived_dup and not archived_dup.is_active:
                archived_dup.is_active = True
                archived_dup.harga = harga
                archived_dup.stok = stok
                if data.get("gambar_path"):
                    archived_dup.gambar_path = data["gambar_path"]
                db.session.commit()
                detail_restore = {
                    "nama": nama,
                    "harga": archived_dup.harga,
                    "stok": archived_dup.stok
                }
                write_log(
                    "RESTORE_MENU",
                    f"Menu '{nama}' direstore dari arsip dengan data baru",
                    user=operator,
                    detail_json=detail_restore
                )
                return archived_dup

            # 3. Tidak ada duplikat sama sekali — buat baru
            menu = MenuItem(
                nama=nama,
                harga=harga,
                stok=stok,
                gambar_path=data.get("gambar_path")
            )
            MenuRepository.save(menu)
            db.session.commit()

            detail_tambah = {
                "nama": nama,
                "harga": menu.harga,
                "stok": menu.stok
            }
            write_log("TAMBAH_MENU", f"Menu '{nama}' berhasil ditambahkan ke katalog", user=operator, detail_json=detail_tambah)
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _delete_image_file(gambar_path):
        """Menghapus file fisik gambar menu dari disk secara aman."""
        if not gambar_path or not isinstance(gambar_path, str):
            return
        try:
            import os
            from flask import current_app
            
            try:
                root_dir = current_app.root_path
            except Exception:
                root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

            filename = os.path.basename(gambar_path.replace("\\", "/"))
            filepath = os.path.join(root_dir, "static", "uploads", "menu", filename)
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass

    @staticmethod
    def update_menu(menu_id, data, operator="system"):
        """Mengupdate data menu di katalog."""
        try:
            menu = MenuRepository.get_by_id(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")

            raw_nama = data.get("nama")
            nama = raw_nama.strip() if isinstance(raw_nama, str) else ""
            if nama and nama != menu.nama:
                nama = validate_string_length(nama, min_len=2, max_len=100, field_name="Nama menu", required=True)
                existing = MenuRepository.get_by_name(nama)
                if existing:
                    raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar")
                # Tolak rename ke nama yang ada di arsip juga (tetap menjaga konsistensi)
                archived_collision = MenuRepository.get_by_name_including_archived(nama)
                if archived_collision and archived_collision.id != menu.id:
                    raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar (di arsip)")
                menu.nama = nama

            if "harga" in data:
                menu.harga = validate_integer_range(data["harga"], 0, 1_000_000_000, "Harga menu")
            if "stok" in data:
                menu.stok = validate_integer_range(data["stok"], -1, 1_000_000, "Stok menu")
            if "gambar_path" in data:
                new_gambar = data["gambar_path"]
                # Hapus file gambar lama jika gambar diubah atau dihapus (None / path berbeda)
                if menu.gambar_path and menu.gambar_path != new_gambar:
                    MenuService._delete_image_file(menu.gambar_path)
                menu.gambar_path = new_gambar

            db.session.commit()
            
            detail_menu = {
                "nama": menu.nama,
                "harga": menu.harga,
                "stok": menu.stok
            }
            write_log("EDIT_MENU", f"Menu '{menu.nama}' berhasil diupdate", user=operator, detail_json=detail_menu)
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def tambah_stok(menu_id, jumlah_tambah, operator="system", catatan=None):
        """Menambahkan stok item menu dan mencatat log aktivitas audit secara rinci."""
        try:
            menu = MenuRepository.get_by_id(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan atau tidak aktif")

            jumlah = validate_integer_range(jumlah_tambah, 1, 1_000_000, "Jumlah penambahan stok")
            
            stok_lama = menu.stok
            if stok_lama < 0:
                raise ValueError(f"Menu '{menu.nama}' berstatus stok Unlimited (tidak terbatas)")

            stok_baru = stok_lama + jumlah
            if stok_baru > 1_000_000:
                raise ValueError("Akumulasi total stok tidak boleh melebihi 1.000.000 unit")

            menu.stok = stok_baru

            catatan_clean = catatan.strip() if isinstance(catatan, str) and catatan.strip() else None

            # Catat record mutasi stok ke tabel dedicated MenuStockLog
            log_entry = MenuStockLog(
                menu_id=menu.id,
                menu_nama=menu.nama,
                tipe="RESTOCK",
                jumlah_masuk=jumlah,
                stok_sebelum=stok_lama,
                stok_sesudah=stok_baru,
                operator=operator,
                catatan=catatan_clean
            )
            MenuRepository.save_stock_log(log_entry)
            db.session.commit()

            pesan_log = f"Penambahan stok '{menu.nama}' sebanyak +{jumlah} unit (Stok: {stok_lama} -> {stok_baru})"
            if catatan_clean:
                pesan_log += f" | Catatan: {catatan_clean}"

            detail_restock = {
                "menu_id": menu.id,
                "nama": menu.nama,
                "jumlah_tambah": jumlah,
                "stok_lama": stok_lama,
                "stok_baru": stok_baru,
                "catatan": catatan_clean or "-"
            }
            write_log("RESTOCK_MENU", pesan_log, user=operator, detail_json=detail_restock)
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_stock_logs(tanggal=None, menu_id=None, operator=None, search=None, page=1, per_page=15):
        """Mengambil data riwayat penambahan stok dengan filter & pagination."""
        page_val = validate_integer_range(page, 1, 100000, "Halaman")
        per_page_val = validate_integer_range(per_page, 1, 100, "Jumlah per halaman")
        
        pagination = MenuRepository.get_stock_logs_paginated(
            date_obj=tanggal,
            menu_id=menu_id,
            operator=operator,
            search=search,
            page=page_val,
            per_page=per_page_val
        )
        return {
            "items": [item.to_dict() for item in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
            "has_prev": pagination.has_prev,
            "has_next": pagination.has_next
        }

    @staticmethod
    def get_stock_log_operators():
        """Mengambil daftar operator yang tercatat di log stok menu."""
        return MenuRepository.get_distinct_stock_log_operators()

    @staticmethod
    def get_archived_menu():
        """Mengambil semua menu yang diarsipkan beserta jumlah transaksi historisnya."""
        menus = MenuRepository.get_archived()
        result = []
        for m in menus:
            data = m.to_dict()
            data["transaksi_count"] = MenuRepository.count_transaksi_by_menu(m.id)
            result.append(data)
        return result

    @staticmethod
    def restore_menu(menu_id, operator="system"):
        """Memulihkan menu dari arsip kembali ke katalog aktif."""
        try:
            menu = MenuRepository.get_by_id_including_archived(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")
            if menu.is_active:
                return menu

            active_dup = MenuRepository.get_by_name(menu.nama)
            if active_dup and active_dup.id != menu.id:
                raise ValueError(f"Menu aktif dengan nama '{menu.nama}' sudah ada di katalog")

            menu.is_active = True
            db.session.commit()

            detail_restore = {
                "nama": menu.nama,
                "harga": menu.harga,
                "stok": menu.stok
            }
            write_log(
                "RESTORE_MENU",
                f"Menu '{menu.nama}' berhasil dipulihkan dari arsip ke katalog aktif",
                user=operator,
                detail_json=detail_restore
            )
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def delete_menu(menu_id, operator="system"):
        """Mengarsipkan menu dari katalog (soft-delete).
        
        Menu dipindahkan ke arsip (is_active=False) agar struk & laporan lama
        tetap konsisten dan dapat dipulihkan kapan saja.
        """
        try:
            menu = MenuRepository.get_by_id_including_archived(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")
            if not menu.is_active:
                raise ValueError("Menu sudah diarsipkan sebelumnya")

            nama = menu.nama
            transaksi_count = MenuRepository.count_transaksi_by_menu(menu_id)

            menu.is_active = False
            detail_arsip = {
                "nama": nama,
                "transaksi_historis": transaksi_count
            }
            write_log(
                "ARSIP_MENU",
                f"Menu '{nama}' diarsipkan ke daftar arsip menu",
                user=operator,
                detail_json=detail_arsip
            )

            db.session.commit()
            return nama
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def hard_delete_menu(menu_id, operator="system"):
        """Menghapus menu permanen BERSAMA seluruh transaksi F&B terkait.

        Gunakan hanya jika histori F&B untuk menu ini memang sudah tidak diperlukan.
        """
        try:
            menu = MenuRepository.get_by_id_including_archived(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")

            nama = menu.nama
            gambar_path = menu.gambar_path
            transaksi_count = MenuRepository.count_transaksi_by_menu(menu_id)
            MenuRepository.delete_transaksi_by_menu(menu_id)
            MenuRepository.delete(menu)
            db.session.commit()

            if gambar_path:
                MenuService._delete_image_file(gambar_path)

            detail_hard = {
                "nama": nama,
                "transaksi_dihapus": transaksi_count
            }
            write_log(
                "HAPUS_MENU_PERMANEN",
                f"Menu '{nama}' beserta {transaksi_count} transaksi terkait dihapus permanen",
                user=operator,
                detail_json=detail_hard
            )
            return {"nama": nama, "transaksi_dihapus": transaksi_count}
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def generate_nota_menu():
        """Generate nomor nota transaksi menu unik dengan format TMM-YYYYMMDD-NNN."""
        from app.utils.timezone_utils import display_in_tz, now_utc
        today_local = display_in_tz(now_utc())
        date_str = today_local.strftime('%Y%m%d')
        prefix = f"TMM-{date_str}-"
        
        # Cari total transaksi hari ini untuk penomoran
        # Menggunakan pencarian prefix agar kebal terhadap isu timezone
        count_today = MenuRepository.count_transactions_by_prefix(prefix)
        new_num = count_today + 1
        return f"{prefix}{str(new_num).zfill(3)}"

    @staticmethod
    def checkout_menu_order(cart_items, pc_kode, kasir_username, operator="system", tunai=0, kembalian=0, metode_pembayaran="Tunai"):
        """Memproses transaksi pembelian F&B terpisah dari billing PC."""
        try:
            if not cart_items or not isinstance(cart_items, list):
                raise ValueError("Daftar belanjaan kosong atau tidak valid")

            base_kasir_username = kasir_username.split(" (")[0].strip() if " (" in kasir_username else kasir_username
            kasir = UserRepository.get_by_username(base_kasir_username)
            if not kasir:
                kasir = UserRepository.get_first_admin()
            if not kasir:
                raise ValueError("Kasir tidak valid")

            real_operator = operator if (operator and operator != "system") else kasir_username

            from app.utils.timezone_utils import display_in_tz, now_utc
            today_local = display_in_tz(now_utc())
            date_str = today_local.strftime('%Y%m%d')
            prefix = f"TMM-{date_str}-"
            count_today = MenuRepository.count_transactions_by_prefix(prefix)
            
            # Buat satu nomor nota untuk seluruh item dalam keranjang
            no_nota = f"{prefix}{str(count_today + 1).zfill(3)}"

            # Hitung total belanja dan validasi item
            parsed_items = []
            total_tagihan = 0

            for item in cart_items:
                menu_id = item.get("menu_id")
                jumlah = validate_integer_range(item.get("jumlah", 0), 1, 1000, "Kuantitas pesanan")

                menu = MenuRepository.get_by_id(menu_id)
                if not menu:
                    raise ValueError(f"Menu dengan ID {menu_id} tidak ditemukan")

                if menu.stok >= 0 and menu.stok < jumlah:
                    raise ValueError(f"Stok '{menu.nama}' tidak mencukupi (Tersedia: {menu.stok}, Diminta: {jumlah})")

                subtotal = menu.harga * jumlah
                total_tagihan += subtotal
                parsed_items.append({"menu": menu, "jumlah": jumlah, "subtotal": subtotal})

            if not parsed_items:
                raise ValueError("Daftar pesanan tidak boleh kosong")

            metode_pembayaran = validate_choice(
                metode_pembayaran or "Tunai",
                ["Tunai", "QRIS", "Transfer", "Transfer Bank", "Deposit"],
                field_name="Metode pembayaran",
                case_sensitive=False
            )

            # Validasi Pembayaran Tunai
            tunai_val = validate_integer_range(tunai or 0, min_val=0, max_val=1_000_000_000, field_name="Uang tunai")
            kembalian_val = 0
            if metode_pembayaran == "Tunai" and tunai_val > 0:
                if tunai_val < total_tagihan:
                    raise ValueError(f"Uang tunai (Rp {tunai_val:,}) kurang dari total tagihan (Rp {total_tagihan:,})".replace(",", "."))
                kembalian_val = tunai_val - total_tagihan

            transaksi_list = []

            for p_item in parsed_items:
                menu = p_item["menu"]
                jumlah = p_item["jumlah"]
                subtotal = p_item["subtotal"]

                # Kurangi stok jika tidak unlimited (stok >= 0)
                if menu.stok >= 0:
                    menu.stok -= jumlah

                transaksi = TransaksiMenu(
                    no_nota=no_nota,
                    menu_id=menu.id,
                    jumlah=jumlah,
                    total_harga=subtotal,
                    pc_kode=pc_kode if pc_kode else None,
                    kasir_id=kasir.id,
                    operator=real_operator,
                    tunai=tunai_val if tunai_val else None,
                    kembalian=kembalian_val if tunai_val else None,
                    metode_pembayaran=metode_pembayaran
                )
                MenuRepository.save(transaksi)
                transaksi_list.append(transaksi)

            db.session.commit()
            
            for t in transaksi_list:
                order_details = {
                    "no_nota": no_nota,
                    "nama_menu": t.menu.nama,
                    "jumlah_qty": t.jumlah,
                    "total_harga": t.total_harga,
                    "pc_kode": t.pc_kode,
                    "metode_pembayaran": t.metode_pembayaran,
                    "tunai": tunai_val if tunai_val else None,
                    "kembalian": kembalian_val if tunai_val else None
                }
                write_log("TRANSAKSI_MENU", f"Penjualan {t.menu.nama} x{t.jumlah} (Total: Rp{t.total_harga:,}) sukses via {no_nota}", user=operator, detail_json=order_details)

            return [t.to_dict() for t in transaksi_list]
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_all_transactions():
        """Mengambil seluruh riwayat transaksi menu."""
        return MenuRepository.get_transaksi_all()

# app/services/menu_service.py

"""Service untuk menangani business logic POS Makanan & Minuman.

Modul ini mengelola CRUD katalog makanan/minuman dan proses checkout transaksi F&B.
"""

from datetime import datetime
from app.models.base import db
from app.models.menu import MenuItem, TransaksiMenu
from app.repositories.menu_repository import MenuRepository
from app.repositories.user_repository import UserRepository
from app.utils.logger import write_log

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
        """Membuat menu baru di katalog."""
        try:
            nama = data.get("nama", "").strip()
            if not nama:
                raise ValueError("Nama menu tidak boleh kosong")

            existing = MenuRepository.get_by_name(nama)
            if existing:
                raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar")

            menu = MenuItem(
                nama=nama,
                harga=int(data.get("harga", 0)),
                stok=int(data.get("stok", 0)),
                gambar_path=data.get("gambar_path")
            )
            MenuRepository.save(menu)
            db.session.commit()

            write_log("TAMBAH_MENU", f"Menu '{nama}' berhasil ditambahkan ke katalog", user=operator)
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def update_menu(menu_id, data, operator="system"):
        """Mengupdate data menu di katalog."""
        try:
            menu = MenuRepository.get_by_id(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")

            nama = data.get("nama", "").strip()
            if nama and nama != menu.nama:
                existing = MenuRepository.get_by_name(nama)
                if existing:
                    raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar")
                menu.nama = nama

            if "harga" in data:
                menu.harga = int(data["harga"])
            if "stok" in data:
                menu.stok = int(data["stok"])
            if "gambar_path" in data:
                menu.gambar_path = data["gambar_path"]

            db.session.commit()
            write_log("EDIT_MENU", f"Menu '{menu.nama}' berhasil diupdate", user=operator)
            return menu
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def delete_menu(menu_id, operator="system"):
        """Menghapus menu dari katalog."""
        try:
            menu = MenuRepository.get_by_id(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")

            nama = menu.nama
            MenuRepository.delete(menu)
            db.session.commit()

            write_log("HAPUS_MENU", f"Menu '{nama}' dihapus dari katalog", user=operator)
            return nama
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def generate_nota_menu():
        """Generate nomor nota transaksi menu unik dengan format TMM-YYYYMMDD-NNN."""
        today = datetime.now()
        date_str = today.strftime('%Y%m%d')
        prefix = f"TMM-{date_str}-"
        
        # Cari total transaksi hari ini untuk penomoran
        # Menggunakan format hitungan hari ini sebagai suffix
        count_today = MenuRepository.count_transactions_today()
        new_num = count_today + 1
        return f"{prefix}{str(new_num).zfill(3)}"

    @staticmethod
    def checkout_menu_order(cart_items, pc_kode, kasir_username, operator="system"):
        """Memproses transaksi pembelian F&B terpisah dari billing PC."""
        try:
            if not cart_items or not isinstance(cart_items, list):
                raise ValueError("Daftar belanjaan kosong atau tidak valid")

            kasir = UserRepository.get_by_username(kasir_username)
            if not kasir:
                raise ValueError("Kasir tidak valid")

            transaksi_list = []
            for item in cart_items:
                menu_id = item.get("menu_id")
                jumlah = int(item.get("jumlah", 0))

                if jumlah <= 0:
                    continue

                menu = MenuRepository.get_by_id(menu_id)
                if not menu:
                    raise ValueError(f"Menu dengan ID {menu_id} tidak ditemukan")

                # Kurangi stok jika tidak unlimited (stok >= 0)
                if menu.stok >= 0:
                    if menu.stok < jumlah:
                        raise ValueError(f"Stok '{menu.nama}' tidak mencukupi (Tersedia: {menu.stok}, Diminta: {jumlah})")
                    menu.stok -= jumlah

                # Buat transaksi
                no_nota = MenuService.generate_nota_menu()
                total = menu.harga * jumlah

                transaksi = TransaksiMenu(
                    no_nota=no_nota,
                    menu_id=menu.id,
                    jumlah=jumlah,
                    total_harga=total,
                    pc_kode=pc_kode if pc_kode else None,
                    kasir_id=kasir.id
                )
                MenuRepository.save(transaksi)
                transaksi_list.append(transaksi)

            db.session.commit()
            
            for t in transaksi_list:
                write_log("TRANSAKSI_MENU", f"Penjualan {t.menu.nama} x{t.jumlah} (Total: Rp{t.total_harga:,}) sukses via {no_nota}", user=operator)

            return [t.to_dict() for t in transaksi_list]
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def get_all_transactions():
        """Mengambil seluruh riwayat transaksi menu."""
        return MenuRepository.get_transaksi_all()

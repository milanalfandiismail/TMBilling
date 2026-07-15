# app/services/menu_service.py

"""Service untuk menangani business logic POS Makanan & Minuman.

Modul ini mengelola CRUD katalog makanan/minuman dan proses checkout transaksi F&B.
"""

from datetime import datetime
from app.models import db
from app.models import MenuItem, TransaksiMenu
from app.repositories import MenuRepository
from app.repositories import UserRepository
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
        """Membuat menu baru, atau me-restore menu arsip dengan nama yang sama.

        Alur: cek duplikat hanya pada menu aktif. Jika nama sudah ada di
        arsip (soft-deleted), kita restore + timpa stok/harga/gambar agar
        histori transaksi lama tetap konsisten dan kasir tidak perlu
        'hapus permanen' dulu sebelum buat menu dengan nama sama.
        """
        try:
            nama = data.get("nama", "").strip()
            if not nama:
                raise ValueError("Nama menu tidak boleh kosong")

            # 1. Tolak hanya jika ada menu AKTIF dengan nama yang sama
            active_dup = MenuRepository.get_by_name(nama)
            if active_dup:
                raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar")

            # 2. Cek apakah ada menu ARSIP dengan nama yang sama — jika ya, restore
            archived_dup = MenuRepository.get_by_name_including_archived(nama)
            if archived_dup and not archived_dup.is_active:
                archived_dup.is_active = True
                archived_dup.harga = int(data.get("harga", 0))
                archived_dup.stok = int(data.get("stok", 0))
                if data.get("gambar_path"):
                    archived_dup.gambar_path = data["gambar_path"]
                db.session.commit()
                write_log(
                    "RESTORE_MENU",
                    f"Menu '{nama}' direstore dari arsip dengan data baru",
                    user=operator,
                )
                return archived_dup

            # 3. Tidak ada duplikat sama sekali — buat baru
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
                # Tolak rename ke nama yang ada di arsip juga (tetap menjaga konsistensi)
                archived_collision = MenuRepository.get_by_name_including_archived(nama)
                if archived_collision and archived_collision.id != menu.id:
                    raise ValueError(f"Menu dengan nama '{nama}' sudah terdaftar (di arsip)")
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
        """Mengarsipkan menu dari katalog (soft-delete).

        Jika menu memiliki transaksi historis, hanya diarsipkan (is_active=False)
        agar struk & laporan lama tetap konsisten. Menu hilang dari katalog POS
        namun histori F&B tidak hilang.
        """
        try:
            menu = MenuRepository.get_by_id_including_archived(menu_id)
            if not menu:
                raise ValueError("Menu tidak ditemukan")
            if not menu.is_active:
                raise ValueError("Menu sudah diarsipkan sebelumnya")

            nama = menu.nama
            transaksi_count = MenuRepository.count_transaksi_by_menu(menu_id)

            if transaksi_count > 0:
                # Menu sudah pernah terjual — arsipkan saja agar FK tidak dilanggar
                menu.is_active = False
                write_log(
                    "ARSIP_MENU",
                    f"Menu '{nama}' diarsipkan (memiliki {transaksi_count} transaksi historis)",
                    user=operator,
                )
            else:
                # Tidak ada transaksi terkait — hapus permanen aman
                MenuRepository.delete(menu)
                write_log("HAPUS_MENU", f"Menu '{nama}' dihapus permanen dari katalog", user=operator)

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
            transaksi_count = MenuRepository.count_transaksi_by_menu(menu_id)
            MenuRepository.delete_transaksi_by_menu(menu_id)
            MenuRepository.delete(menu)
            db.session.commit()

            write_log(
                "HAPUS_MENU_PERMANEN",
                f"Menu '{nama}' beserta {transaksi_count} transaksi terkait dihapus permanen",
                user=operator,
            )
            return {"nama": nama, "transaksi_dihapus": transaksi_count}
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

            kasir = UserRepository.get_by_username(kasir_username)
            if not kasir:
                raise ValueError("Kasir tidak valid")

            today = datetime.now()
            date_str = today.strftime('%Y%m%d')
            prefix = f"TMM-{date_str}-"
            count_today = MenuRepository.count_transactions_by_prefix(prefix)

            transaksi_list = []
            current_offset = 1

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

                # Buat transaksi dengan penomoran berurutan untuk 1 sesi checkout
                no_nota = f"{prefix}{str(count_today + current_offset).zfill(3)}"
                current_offset += 1
                total = menu.harga * jumlah

                transaksi = TransaksiMenu(
                    no_nota=no_nota,
                    menu_id=menu.id,
                    jumlah=jumlah,
                    total_harga=total,
                    pc_kode=pc_kode if pc_kode else None,
                    kasir_id=kasir.id,
                    tunai=tunai if tunai else None,
                    kembalian=kembalian if kembalian else None,
                    metode_pembayaran=metode_pembayaran
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

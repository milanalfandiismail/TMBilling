# app/services/branch/branch_service.py
"""Service untuk manajemen koneksi cabang warnet (Multi-Cabang)."""

import time
import requests
import json
from datetime import datetime
from app.models import db, now_local
from app.models.branch import Branch
from app.utils.logger import write_log


class BranchService:
    """Service untuk pengelolaan data cabang dan pengecekan koneksi."""

    @staticmethod
    def normalize_url(url: str) -> str:
        """Membersihkan dan menstandarkan format URL."""
        if not url:
            return ""
        url = url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        return url.rstrip("/")

    @staticmethod
    def test_connection(url: str, api_key: str, timeout: int = 5) -> tuple[bool, dict | str]:
        """Menguji koneksi ke server cabang remote dan mendeteksi nama warnet."""
        clean_url = BranchService.normalize_url(url)
        if not clean_url:
            return False, "URL cabang tidak boleh kosong"

        from flask import session, has_request_context
        from app.services.settings.settings_service import SettingsService
        origin_branch_title = (SettingsService.get("warnet_title") or "TMBilling").strip()
        origin_mac = (SettingsService.get_hardware_mac() or "").strip()
        current_op = "admin"
        if has_request_context():
            current_op = session.get("kasir_username") or "admin"

        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "User-Agent": "TMBilling-MultiBranch/1.6.0",
            "X-Origin-Branch-Name": origin_branch_title,
            "X-Origin-MAC": origin_mac,
            "X-Operator-Username": current_op
        }

        start_time = time.time()
        try:
            # Panggil endpoint settings / title remote server
            target_endpoint = f"{clean_url}/api/v1/kasir/settings/warnet_title"
            resp = requests.get(target_endpoint, headers=headers, timeout=timeout)
            latency_ms = int((time.time() - start_time) * 1000)

            # Jika status 404/405, coba fallback ke endpoint root /settings/
            if resp.status_code in (404, 405):
                fallback_endpoint = f"{clean_url}/api/v1/kasir/settings/"
                resp = requests.get(fallback_endpoint, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    settings_dict = data.get("settings", {}) if isinstance(data, dict) else {}
                    warnet_title = settings_dict.get("warnet_title", "TMBilling")
                    return True, {
                        "online": True,
                        "latency_ms": latency_ms,
                        "warnet_title": warnet_title
                    }

            if resp.status_code == 200:
                data = resp.json()
                warnet_title = "TMBilling"
                if isinstance(data, dict):
                    if "data" in data and isinstance(data["data"], dict):
                        warnet_title = data["data"].get("warnet_title") or data["data"].get("value") or warnet_title
                    elif "value" in data:
                        warnet_title = data["value"]
                    elif "warnet_title" in data:
                        warnet_title = data["warnet_title"]

                return True, {
                    "online": True,
                    "latency_ms": latency_ms,
                    "warnet_title": warnet_title
                }
            elif resp.status_code in (401, 403):
                return False, "Kunci API Cabang ditolak oleh server target (401/403 Unauthorized)"
            else:
                return False, f"Server remote merespons dengan status HTTP {resp.status_code}"

        except requests.exceptions.Timeout:
            return False, "Koneksi ke server cabang timeout (melebihi batas waktu)"
        except requests.exceptions.ConnectionError:
            return False, "Gagal menghubungi server cabang (Host tidak ditemukan atau offline)"
        except Exception as e:
            return False, f"Terjadi kesalahan saat tes koneksi: {str(e)}"

    @staticmethod
    def get_all_branches(include_key: bool = False) -> list[dict]:
        """Mengambil seluruh daftar cabang yang terdaftar."""
        branches = Branch.query.order_by(Branch.urutan.asc(), Branch.id.asc()).all()
        return [b.to_dict(include_key=include_key) for b in branches]

    @staticmethod
    def get_branch_by_id(branch_id: int) -> Branch | None:
        """Mengambil instance model Branch berdasarkan ID."""
        return Branch.query.get(branch_id)

    @staticmethod
    def add_branch(url: str, api_key: str, nama: str = None) -> tuple[bool, dict | str]:
        """Menambahkan koneksi cabang baru dengan auto-detect nama."""
        clean_url = BranchService.normalize_url(url)
        clean_key = (api_key or "").strip()

        if not clean_url or not clean_key:
            return False, "URL dan API Key cabang wajib diisi"

        # Cek apakah URL sudah pernah didaftarkan
        existing = Branch.query.filter_by(url=clean_url).first()
        if existing:
            return False, f"Cabang dengan URL '{clean_url}' sudah pernah terdaftar"

        # Test koneksi dan auto-detect nama jika nama belum ditentukan
        final_nama = (nama or "").strip()
        latency_ms = None
        is_online = False

        ok, test_res = BranchService.test_connection(clean_url, clean_key)
        if ok and isinstance(test_res, dict):
            is_online = True
            latency_ms = test_res.get("latency_ms")
            if not final_nama:
                final_nama = test_res.get("warnet_title")

        if not final_nama:
            # Fallback jika tidak terdeteksi
            final_nama = clean_url.replace("https://", "").replace("http://", "").split("/")[0]

        try:
            branch = Branch(
                nama=final_nama,
                url=clean_url,
                api_key=clean_key,
                aktif=True,
                status_online=is_online,
                latensi_ms=latency_ms,
                terakhir_dicek=now_local()
            )
            db.session.add(branch)
            db.session.commit()

            write_log("BRANCH", f"Koneksi cabang baru '{final_nama}' ({clean_url}) berhasil ditambahkan.")
            return True, branch.to_dict(include_key=False)

        except Exception as e:
            db.session.rollback()
            return False, f"Gagal menyimpan cabang ke database: {str(e)}"

    @staticmethod
    def update_branch(branch_id: int, data: dict) -> tuple[bool, dict | str]:
        """Memperbarui informasi cabang."""
        branch = Branch.query.get(branch_id)
        if not branch:
            return False, "Cabang tidak ditemukan"

        try:
            if "nama" in data and data["nama"]:
                branch.nama = data["nama"].strip()
            if "url" in data and data["url"]:
                branch.url = BranchService.normalize_url(data["url"])
            if "api_key" in data and data["api_key"]:
                branch.api_key = data["api_key"].strip()
            if "aktif" in data:
                branch.aktif = bool(data["aktif"])
            if "urutan" in data:
                branch.urutan = int(data["urutan"])

            db.session.commit()
            return True, branch.to_dict(include_key=False)

        except Exception as e:
            db.session.rollback()
            return False, f"Gagal memperbarui cabang: {str(e)}"

    @staticmethod
    def delete_branch(branch_id: int) -> tuple[bool, str]:
        """Menghapus koneksi cabang."""
        branch = Branch.query.get(branch_id)
        if not branch:
            return False, "Cabang tidak ditemukan"

        try:
            nama = branch.nama
            db.session.delete(branch)
            db.session.commit()
            write_log("BRANCH", f"Koneksi cabang '{nama}' berhasil dihapus.")
            return True, f"Cabang '{nama}' berhasil dihapus"

        except Exception as e:
            db.session.rollback()
            return False, f"Gagal menghapus cabang: {str(e)}"

    # =========================================================================
    # MANAJEMEN AKUN KASIR REMOTE (OPERATOR CABANG)
    # =========================================================================

    @staticmethod
    def get_hidden_operators() -> set:
        """Mengambil set nama operator remote yang diarsipkan/disembunyikan."""
        from app.services.settings.settings_service import SettingsService
        try:
            val = SettingsService.get("hidden_remote_operators", "[]")
            return set(json.loads(val))
        except Exception:
            return set()

    @staticmethod
    def set_hidden_operators(hidden_set: set):
        """Menyimpan set nama operator remote yang diarsipkan/disembunyikan."""
        from app.services.settings.settings_service import SettingsService
        SettingsService.set("hidden_remote_operators", json.dumps(sorted(list(hidden_set))))

    @staticmethod
    def get_remote_operators() -> list[dict]:
        """Mengambil daftar seluruh operator remote dengan statistik aktivitasnya."""
        from app.models.transaksi.transaksi import Transaksi
        from app.models.menu.menu import TransaksiMenu
        from sqlalchemy import func

        hidden_set = BranchService.get_hidden_operators()
        operator_map = {}

        # 1. Agregasi dari Transaksi Billing
        billing_stats = db.session.query(
            Transaksi.operator,
            func.count(Transaksi.id).label("total_trx"),
            func.sum(Transaksi.jumlah).label("total_nominal"),
            func.max(Transaksi.dibuat_pada).label("last_active")
        ).filter(
            Transaksi.operator.isnot(None),
            Transaksi.operator.like("%(Remote:%")
        ).group_by(Transaksi.operator).all()

        for op, cnt, nominal, last_act in billing_stats:
            if op not in operator_map:
                operator_map[op] = {
                    "operator": op,
                    "total_transaksi": 0,
                    "total_nominal": 0,
                    "terakhir_aktif": None
                }
            operator_map[op]["total_transaksi"] += (cnt or 0)
            operator_map[op]["total_nominal"] += (nominal or 0)
            if last_act and (not operator_map[op]["terakhir_aktif"] or last_act > operator_map[op]["terakhir_aktif"]):
                operator_map[op]["terakhir_aktif"] = last_act

        # 2. Agregasi dari Transaksi Menu (Kantin)
        menu_stats = db.session.query(
            TransaksiMenu.operator,
            func.count(TransaksiMenu.id).label("total_trx"),
            func.sum(TransaksiMenu.total_harga).label("total_nominal"),
            func.max(TransaksiMenu.tanggal).label("last_active")
        ).filter(
            TransaksiMenu.operator.isnot(None),
            TransaksiMenu.operator.like("%(Remote:%")
        ).group_by(TransaksiMenu.operator).all()

        for op, cnt, nominal, last_act in menu_stats:
            if op not in operator_map:
                operator_map[op] = {
                    "operator": op,
                    "total_transaksi": 0,
                    "total_nominal": 0,
                    "terakhir_aktif": None
                }
            operator_map[op]["total_transaksi"] += (cnt or 0)
            operator_map[op]["total_nominal"] += (nominal or 0)
            if last_act and (not operator_map[op]["terakhir_aktif"] or last_act > operator_map[op]["terakhir_aktif"]):
                operator_map[op]["terakhir_aktif"] = last_act

        # 3. Masukkan juga cabang terdaftar jika belum ada di record transaksi
        try:
            branches = Branch.query.filter_by(aktif=True).all()
            for b in branches:
                if b.nama:
                    default_op = f"admin (Remote: {b.nama})"
                    if default_op not in operator_map:
                        operator_map[default_op] = {
                            "operator": default_op,
                            "total_transaksi": 0,
                            "total_nominal": 0,
                            "terakhir_aktif": None
                        }
        except Exception:
            pass

        results = []
        for op, data in operator_map.items():
            username = op
            branch_name = "-"
            if "(Remote:" in op:
                parts = op.split("(Remote:")
                username = parts[0].strip()
                branch_name = parts[1].rstrip(")").strip()

            from app.utils.timezone_utils import format_display
            last_active_str = format_display(data["terakhir_aktif"]) if data["terakhir_aktif"] else "-"

            results.append({
                "operator": op,
                "username": username,
                "branch_name": branch_name,
                "total_transaksi": data["total_transaksi"],
                "total_nominal": data["total_nominal"],
                "terakhir_aktif": last_active_str,
                "is_hidden": op in hidden_set
            })

        # Sort: yang aktif terlebih dahulu, lalu berdasarkan jumlah transaksi
        results.sort(key=lambda x: (not x["is_hidden"], x["total_transaksi"]), reverse=True)
        return results

    @staticmethod
    def hide_remote_operator(operator_name: str, admin_operator: str = "admin") -> tuple[bool, str]:
        """Menonaktifkan / mengarsipkan operator remote dari dropdown aktif."""
        if not operator_name:
            return False, "Nama operator tidak valid"
        hidden = BranchService.get_hidden_operators()
        hidden.add(operator_name)
        BranchService.set_hidden_operators(hidden)
        write_log("REMOTE_OPERATOR_ARCHIVED", f"Akun kasir remote '{operator_name}' dinonaktifkan oleh admin", user=admin_operator)
        return True, f"Operator '{operator_name}' berhasil dinonaktifkan"

    @staticmethod
    def restore_remote_operator(operator_name: str, admin_operator: str = "admin") -> tuple[bool, str]:
        """Mengaktifkan kembali operator remote dari arsip ke dropdown aktif."""
        if not operator_name:
            return False, "Nama operator tidak valid"
        hidden = BranchService.get_hidden_operators()
        if operator_name in hidden:
            hidden.remove(operator_name)
            BranchService.set_hidden_operators(hidden)
        write_log("REMOTE_OPERATOR_RESTORED", f"Akun kasir remote '{operator_name}' diaktifkan kembali oleh admin", user=admin_operator)
        return True, f"Operator '{operator_name}' berhasil diaktifkan kembali"

    @staticmethod
    def delete_remote_operator(operator_name: str, admin_operator: str = "admin") -> tuple[bool, str]:
        """Menghapus permanen identitas operator remote (reset operator & user_id ke NULL).
        Data keuangan, no nota, dll tetap 100% utuh dengan fallback nama kasir 'Kasir Lama'.
        String operator benar-benar terhapus tuntas dan tidak disimpan di mana pun lagi.
        """
        if not operator_name:
            return False, "Nama operator tidak valid"

        from app.models.transaksi.transaksi import Transaksi
        from app.models.menu.menu import TransaksiMenu

        try:
            # 1. Reset kolom operator dan user_id di transaksi billing
            Transaksi.query.filter_by(operator=operator_name).update({
                "operator": None,
                "user_id": None
            }, synchronize_session=False)

            # 2. Reset kolom operator dan kasir_id di transaksi menu (kantin)
            TransaksiMenu.query.filter_by(operator=operator_name).update({
                "operator": None,
                "kasir_id": None
            }, synchronize_session=False)

            # 3. Bersihkan juga dari hidden_operators jika sebelumnya ada
            hidden = BranchService.get_hidden_operators()
            if operator_name in hidden:
                hidden.remove(operator_name)
                BranchService.set_hidden_operators(hidden)

            db.session.commit()
            write_log("REMOTE_OPERATOR_DELETED", f"Akun kasir remote '{operator_name}' dihapus permanen oleh admin (identitas di-reset ke 'Kasir Lama')", user=admin_operator)
            return True, f"Operator '{operator_name}' berhasil dihapus permanen"

        except Exception as e:
            db.session.rollback()
            return False, f"Gagal menghapus operator remote: {str(e)}"

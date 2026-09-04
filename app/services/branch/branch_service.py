# app/services/branch/branch_service.py
"""Service untuk manajemen koneksi cabang warnet (Multi-Cabang)."""

import time
import requests
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

        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "User-Agent": "TMBilling-MultiBranch/1.6.0"
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
                    warnet_title = settings_dict.get("warnet_title", "Cabang Remote")
                    return True, {
                        "online": True,
                        "latency_ms": latency_ms,
                        "warnet_title": warnet_title
                    }

            if resp.status_code == 200:
                data = resp.json()
                warnet_title = "Cabang Remote"
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

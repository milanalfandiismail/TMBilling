# app/services/branch/branch_proxy_service.py
"""Service untuk relay reverse proxy server-to-server antar cabang warnet."""

import uuid
import requests
from flask import request, jsonify, Response, session
from app.models import db, now_local
from app.models.branch import Branch
from app.services.settings.settings_service import SettingsService
from app.utils.logger import write_log


class BranchProxyService:
    """Service untuk meneruskan request API kasir ke server cabang remote."""

    @staticmethod
    def get_server_mac_address() -> str:
        """Mengambil MAC address fisik hardware server lokal sebagai identifier unik."""
        try:
            mac_num = uuid.getnode()
            mac_hex = f"{mac_num:012X}"
            return ":".join(mac_hex[i:i+2] for i in range(0, 12, 2))
        except Exception:
            return ""

    @staticmethod
    def should_relay(request_obj) -> int | None:
        """Memeriksa apakah request saat ini harus di-relay ke cabang remote.
        
        Returns:
            int | None: branch_id jika request harus di-relay, None jika diproses lokal.
        """
        # Hanya intercept API kasir
        path = request_obj.path
        if not path.startswith("/api/v1/kasir/"):
            return None

        # Jangan intercept route manajemen cabang itu sendiri, auth login, file explorer lokal, atau tutorial lokal
        if (path.startswith("/api/v1/kasir/branch/") or 
            path.startswith("/api/v1/kasir/auth/") or 
            path.startswith("/api/v1/kasir/fileexplorer/") or
            path.startswith("/api/v1/kasir/tutorials/")):
            return None

        branch_id_raw = request_obj.headers.get("X-Branch-ID")
        if not branch_id_raw or branch_id_raw in ("0", "null", "undefined", ""):
            return None

        try:
            branch_id = int(branch_id_raw)
            return branch_id if branch_id > 0 else None
        except (ValueError, TypeError):
            return None

    @staticmethod
    def relay_request(branch_id: int, request_obj) -> Response:
        """Mem-forward request HTTP saat ini ke server cabang tujuan secara aman."""
        # 100% Security: Hanya role admin yang diizinkan merelay ke cabang remote
        if session.get("kasir_role") != "admin":
            return jsonify({
                "success": False,
                "error": "Akses ditolak: Hanya Admin yang dapat mengontrol cabang lain"
            }), 403

        branch = Branch.query.get(branch_id)
        if not branch or not branch.aktif:
            return jsonify({
                "success": False,
                "error": "Cabang target tidak ditemukan atau dinonaktifkan"
            }), 404

        target_url = f"{branch.url.rstrip('/')}{request_obj.path}"
        if request_obj.query_string:
            target_url += f"?{request_obj.query_string.decode('utf-8')}"

        # Context operator & identitas server lokal
        raw_operator = session.get("kasir_username", "admin")
        operator_username = raw_operator.split(" (")[0].strip() if " (" in raw_operator else raw_operator
        origin_branch_title = (SettingsService.get("warnet_title") or "TMBilling").strip()
        if not origin_branch_title or origin_branch_title.lower() == "cabang":
            origin_branch_title = "TMBilling"
        origin_mac = BranchProxyService.get_server_mac_address()

        # Siapkan headers relay
        relay_headers = {
            "Authorization": f"Bearer {branch.api_key}",
            "User-Agent": "TMBilling-Relay/1.6.0",
            "X-Operator-Username": operator_username,
            "X-Origin-Branch-Name": origin_branch_title
        }
        if origin_mac:
            relay_headers["X-Origin-MAC"] = origin_mac

        if request_obj.content_type:
            relay_headers["Content-Type"] = request_obj.content_type
        if request_obj.headers.get("Accept"):
            relay_headers["Accept"] = request_obj.headers.get("Accept")

        try:
            data = request_obj.get_data()
            resp = requests.request(
                method=request_obj.method,
                url=target_url,
                headers=relay_headers,
                data=data if data else None,
                timeout=6
            )

            # Update health status jika sukses
            try:
                branch.status_online = True
                branch.terakhir_dicek = now_local()
                db.session.commit()
            except Exception:
                db.session.rollback()

            # Buat Flask response yang menyalin body, status, dan Content-Type dari remote
            content_type = resp.headers.get("Content-Type", "application/json")
            return Response(
                response=resp.content,
                status=resp.status_code,
                content_type=content_type
            )

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            # Update status offline
            try:
                branch.status_online = False
                branch.terakhir_dicek = now_local()
                db.session.commit()
            except Exception:
                db.session.rollback()

            write_log("BRANCH_PROXY", f"Gagal relay ke cabang '{branch.nama}' ({target_url}): {e}")
            return jsonify({
                "success": False,
                "is_branch_offline": True,
                "error": f"Cabang '{branch.nama}' sedang offline atau tidak dapat dijangkau"
            }), 503

        except Exception as e:
            write_log("BRANCH_PROXY", f"Kesalahan relay ke '{branch.nama}': {e}")
            return jsonify({
                "success": False,
                "error": f"Terjadi kesalahan saat relay ke cabang: {str(e)}"
            }), 500

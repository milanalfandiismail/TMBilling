# app/services/branch/branch_proxy_service.py
"""Service untuk relay reverse proxy server-to-server antar cabang warnet."""

import requests
from flask import request, jsonify, Response, session
from app.models import db, now_local
from app.models.branch import Branch
from app.utils.logger import write_log


class BranchProxyService:
    """Service untuk meneruskan request API kasir ke server cabang remote."""

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

        # Jangan intercept route manajemen cabang itu sendiri atau auth login
        if path.startswith("/api/v1/kasir/branch/") or path.startswith("/api/v1/kasir/auth/"):
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
        branch = Branch.query.get(branch_id)
        if not branch or not branch.aktif:
            return jsonify({
                "success": False,
                "error": "Cabang target tidak ditemukan atau dinonaktifkan"
            }), 404

        target_url = f"{branch.url.rstrip('/')}{request_obj.path}"
        if request_obj.query_string:
            target_url += f"?{request_obj.query_string.decode('utf-8')}"

        # Siapkan headers relay
        relay_headers = {
            "Authorization": f"Bearer {branch.api_key}",
            "User-Agent": "TMBilling-Relay/1.6.0"
        }
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

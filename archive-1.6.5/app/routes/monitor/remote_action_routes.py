# app/routes/monitor/remote_action_routes.py

"""Routes untuk perintah remote action ke PC client dari kasir.

Menyediakan endpoint untuk:
- Kunci / buka layar AFK dengan PIN
- Shutdown & restart individual
- Shutdown & restart batch ke banyak PC
"""

from flask import request, jsonify, session
from app.middleware.auth import login_required, admin_required, shift_required
from app.utils.logger import write_log


def register_remote_action_routes(bp):
    """Mendaftarkan route aksi remote ke Blueprint monitor_kasir."""

    @bp.route("/remote/<int:pc_id>/afk-lock", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def trigger_remote_afk_lock(pc_id):
        """Trigger remote AFK lock ke PC client dari Kasir dengan PIN."""
        try:
            from app.repositories import PCRepository, SesiRepository
            from app.models import db, now_local
            from app.services import ClientService
            from werkzeug.security import generate_password_hash

            data = request.get_json() or {}
            pin = str(data.get("pin", "")).strip()
            if not pin:
                return jsonify({"success": False, "error": "PIN / Password kunci layar tidak boleh kosong"}), 400

            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            if not sesi:
                return jsonify({"success": False, "error": "Tidak ada sesi aktif di PC ini"}), 400

            sesi.is_afk = True
            sesi.afk_pin = generate_password_hash(pin)
            sesi.afk_sejak = now_local()
            db.session.commit()

            ClientService.queue_command(pc.id, "afk_lock")
            operator = session.get("kasir_username", "admin")
            write_log("REMOTE_AFK_LOCK", f"PC {pc.kode} dikunci AFK secara remote oleh kasir dengan PIN", user=operator, detail_json={"pc_kode": pc.kode, "sesi_id": sesi.id})
            return jsonify({"success": True, "message": f"Perintah kunci AFK berhasil dikirim ke {pc.kode}"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/remote/<int:pc_id>/afk-unlock", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def trigger_remote_afk_unlock(pc_id):
        """Trigger master unlock AFK ke PC client dari Kasir."""
        try:
            from app.repositories import PCRepository, SesiRepository
            from app.models import db
            from app.services import ClientService

            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            if not sesi:
                return jsonify({"success": False, "error": "Tidak ada sesi aktif di PC ini"}), 400

            sesi.is_afk = False
            sesi.afk_pin = None
            sesi.afk_sejak = None
            db.session.commit()

            ClientService.queue_command(pc.id, "afk_unlock")
            operator = session.get("kasir_username", "admin")
            write_log("REMOTE_AFK_UNLOCK", f"PC {pc.kode} dibuka kunci AFK secara remote (Master Unlock) oleh kasir", user=operator, detail_json={"pc_kode": pc.kode, "sesi_id": sesi.id})
            return jsonify({"success": True, "message": f"Kunci AFK PC {pc.kode} berhasil dibuka oleh kasir"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/remote/<int:pc_id>/<string:action>", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def trigger_remote_action(pc_id, action):
        """Trigger remote action (shutdown atau restart) ke client PC berdasarkan PC ID."""
        try:
            if action not in ["shutdown", "restart"]:
                return jsonify({"success": False, "error": "Aksi tidak valid"}), 400

            from app.repositories import PCRepository, SesiRepository
            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

            # Cegah aksi operasional (shutdown/restart) jika PC sedang dalam sesi SYSTEM
            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            is_system = pc.is_admin_mode and sesi and (sesi.nama_guest or "").strip().upper() == "SYSTEM"
            if is_system:
                return jsonify({"success": False, "error": "Aksi operasional (Restart/Shutdown) tidak diizinkan pada PC dalam mode SYSTEM"}), 403

            from app.services import ClientService
            ClientService.queue_command(pc.id, action)

            action_label = "Shutdown" if action == "shutdown" else "Restart"
            operator = session.get("kasir_username", "admin")
            write_log("REMOTE_ACTION", f"Perintah {action_label} dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "action": action})
            return jsonify({"success": True, "message": f"Perintah {action_label} berhasil dikirim ke {pc.kode}"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/remote/batch", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def trigger_remote_action_batch():
        """Trigger remote action (shutdown atau restart) ke banyak PC client sekaligus."""
        try:
            data = request.get_json() or {}
            pc_ids = data.get("pc_ids") or []
            action = data.get("action")

            if action not in ["shutdown", "restart"]:
                return jsonify({"success": False, "error": "Aksi tidak valid (hanya shutdown/restart)"}), 400
            if not pc_ids or not isinstance(pc_ids, list):
                return jsonify({"success": False, "error": "Daftar PC (pc_ids) harus berupa array non-kosong"}), 400

            from app.repositories import PCRepository, SesiRepository
            from app.services import ClientService

            action_label = "Shutdown" if action == "shutdown" else "Restart"
            operator = session.get("kasir_username", "admin")
            success_list = []
            errors = []

            for pc_id in pc_ids:
                pc = PCRepository.get_by_id(pc_id)
                if not pc:
                    errors.append({"pc_id": pc_id, "error": "PC tidak ditemukan"})
                    continue

                # Skip jika PC dalam mode SYSTEM
                sesi = SesiRepository.get_aktif_by_pc(pc.id)
                if pc.is_admin_mode and sesi and (sesi.nama_guest or "").strip().upper() == "SYSTEM":
                    errors.append({"pc_id": pc_id, "pc_kode": pc.kode, "error": "Aksi operasional tidak diizinkan pada PC mode SYSTEM"})
                    continue

                try:
                    ClientService.queue_command(pc.id, action)
                    write_log("REMOTE_ACTION_BATCH", f"Perintah {action_label} batch dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "action": action})
                    success_list.append(pc.kode)
                except Exception as e:
                    errors.append({"pc_id": pc_id, "pc_kode": pc.kode, "error": str(e)})

            return jsonify({
                "success": len(success_list) > 0,
                "success_pcs": success_list,
                "errors": errors,
                "total_success": len(success_list),
                "total_failed": len(errors)
            }), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

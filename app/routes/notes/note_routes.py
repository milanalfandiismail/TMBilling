# app/routes/notes/note_routes.py
import os
from flask import Blueprint, jsonify, request, session, send_file
from app.services.notes.note_service import NoteService
from app.utils.logger import write_log

notes_api_bp = Blueprint("notes_api", __name__)

def is_authenticated():
    """Memeriksa apakah sesi kasir atau admin sedang aktif."""
    return bool(session.get("kasir_id") or session.get("kasir_username"))

@notes_api_bp.before_request
def check_auth():
    if not is_authenticated():
        return jsonify({"success": False, "error": "Akses Ditolak: Harap login terlebih dahulu"}), 401

@notes_api_bp.route("", methods=["GET"])
def list_notes():
    """Mengambil daftar seluruh berkas catatan dengan opsi filter pencarian."""
    query = request.args.get("q")
    try:
        notes = NoteService.list_notes(query=query)
        return jsonify({"success": True, "notes": notes})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>", methods=["GET"])
def get_note(filename):
    """Mengambil detail dan isi satu catatan."""
    try:
        note = NoteService.get_note(filename)
        return jsonify({"success": True, "note": note})
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("", methods=["POST"])
def create_note():
    """Membuat berkas catatan baru."""
    data = request.get_json() or {}
    title = data.get("title", "").strip() or "Catatan Baru"
    content = data.get("content", "")

    try:
        note = NoteService.create_note(title, content)
        operator = session.get("kasir_username", "system")
        write_log(
            "NOTE_CREATED",
            f"Membuat catatan baru: {note['filename']}",
            user=operator
        )
        return jsonify({"success": True, "note": note}), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>", methods=["PUT"])
def save_note(filename):
    """Menyimpan isi catatan dan update judul jika diubah."""
    data = request.get_json() or {}
    content = data.get("content", "")
    new_title = data.get("title")

    try:
        note = NoteService.save_note(filename, content, new_title)
        return jsonify({"success": True, "note": note})
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>", methods=["DELETE"])
def delete_note(filename):
    """Menghapus berkas catatan."""
    try:
        NoteService.delete_note(filename)
        operator = session.get("kasir_username", "system")
        write_log(
            "NOTE_DELETED",
            f"Menghapus catatan: {filename}",
            user=operator
        )
        return jsonify({"success": True, "message": f"Catatan '{filename}' berhasil dihapus"})
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>/download", methods=["GET"])
def download_note(filename):
    """Mengunduh berkas .txt catatan secara langsung."""
    try:
        file_path = NoteService.validate_path(filename)
        if not os.path.exists(file_path):
            return jsonify({"success": False, "error": "Berkas tidak ditemukan"}), 404
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path),
            mimetype="text/plain"
        )
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>/pin", methods=["POST"])
def toggle_pin_note(filename):
    """Menyematkan atau melepas sematan (pin/unpin) catatan."""
    try:
        result = NoteService.toggle_pin(filename)
        operator = session.get("kasir_username", "system")
        status_str = "menyematkan" if result['is_pinned'] else "melepas sematan"
        write_log(
            "NOTE_PIN_TOGGLED",
            f"{status_str.capitalize()} catatan: {filename}",
            user=operator
        )
        return jsonify({"success": True, "result": result})
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@notes_api_bp.route("/<filename>/duplicate", methods=["POST"])
def duplicate_note(filename):
    """Menduplikasi berkas catatan."""
    try:
        note = NoteService.duplicate_note(filename)
        operator = session.get("kasir_username", "system")
        write_log(
            "NOTE_DUPLICATED",
            f"Menduplikasi catatan {filename} -> {note['filename']}",
            user=operator
        )
        return jsonify({"success": True, "note": note}), 201
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


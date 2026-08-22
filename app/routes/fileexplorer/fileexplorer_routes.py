# app/routes/fileexplorer/fileexplorer_routes.py
from flask import Blueprint, jsonify, request, session
from app.services.fileexplorer.fileexplorer_service import FileExplorerService
from app.utils.logger import write_log

fileexplorer_api_bp = Blueprint("fileexplorer", __name__)

def admin_required():
    return session.get("kasir_role") == "admin"

@fileexplorer_api_bp.route("/roots", methods=["GET"])
def get_roots():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
    roots = FileExplorerService.get_allowed_roots()
    return jsonify({"success": True, "roots": roots})

@fileexplorer_api_bp.route("/roots", methods=["POST"])
def update_roots():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    data = request.get_json() or {}
    roots = data.get("roots")
    if not isinstance(roots, list):
        return jsonify({"success": False, "error": "roots harus berupa array/list"}), 400

    updated = FileExplorerService.set_allowed_roots(roots)
    operator = session.get("kasir_username", "system")
    write_log(
        "FILE_EXPLORER_ROOTS_UPDATE",
        f"Allowed roots diperbarui ke: {', '.join(updated)}",
        user=operator,
        detail_json={"roots": updated}
    )
    return jsonify({"success": True, "roots": updated})

@fileexplorer_api_bp.route("/list", methods=["GET"])
def list_dir():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    path = request.args.get("path")
    res = FileExplorerService.list_directory(path)
    if not res.get("success"):
        return jsonify(res), 400
    return jsonify(res)

@fileexplorer_api_bp.route("/read", methods=["GET"])
def read_file():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    path = request.args.get("path")
    res = FileExplorerService.read_file(path)
    if not res.get("success"):
        return jsonify(res), 400
    return jsonify(res)

@fileexplorer_api_bp.route("/save", methods=["POST"])
def save_file():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    data = request.get_json() or {}
    path = data.get("path")
    content = data.get("content", "")
    expected_mtime = data.get("expected_mtime")
    force = data.get("force", False)

    res = FileExplorerService.save_file(path, content, expected_mtime=expected_mtime, force=force)
    if not res.get("success"):
        return jsonify(res), 400

    operator = session.get("kasir_username", "system")
    write_log(
        "FILE_EXPLORER_SAVE",
        f"Berkas disimpan: {path}",
        user=operator,
        detail_json={"path": path}
    )
    return jsonify(res)

@fileexplorer_api_bp.route("/create", methods=["POST"])
def create_item():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    data = request.get_json() or {}
    parent_path = data.get("parent_path")
    name = data.get("name")
    is_dir = data.get("is_dir", False)

    res = FileExplorerService.create_item(parent_path, name, is_dir=is_dir)
    if not res.get("success"):
        return jsonify(res), 400

    operator = session.get("kasir_username", "system")
    item_type = "Folder" if is_dir else "Berkas"
    write_log(
        "FILE_EXPLORER_CREATE",
        f"{item_type} dibuat: {res['path']}",
        user=operator,
        detail_json={"path": res["path"], "is_dir": is_dir}
    )
    return jsonify(res)

@fileexplorer_api_bp.route("/rename", methods=["POST"])
def rename_item():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    data = request.get_json() or {}
    path = data.get("path")
    new_name = data.get("new_name")

    res = FileExplorerService.rename_item(path, new_name)
    if not res.get("success"):
        return jsonify(res), 400

    operator = session.get("kasir_username", "system")
    write_log(
        "FILE_EXPLORER_RENAME",
        f"Nama berkas/folder diubah dari {path} ke {res['path']}",
        user=operator,
        detail_json={"old_path": path, "new_path": res["path"]}
    )
    return jsonify(res)

@fileexplorer_api_bp.route("/delete", methods=["POST"])
def delete_item():
    if not admin_required():
        return jsonify({"success": False, "error": "Akses ditolak"}), 403
        
    data = request.get_json() or {}
    path = data.get("path")

    res = FileExplorerService.delete_item(path)
    if not res.get("success"):
        return jsonify(res), 400

    operator = session.get("kasir_username", "system")
    write_log(
        "FILE_EXPLORER_DELETE",
        f"Berkas/folder dihapus: {path}",
        user=operator,
        detail_json={"path": path}
    )
    return jsonify(res)

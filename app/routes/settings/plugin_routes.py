import os
import zipfile
import tempfile
import json
import shutil
import logging
from flask import Blueprint, request, jsonify, render_template, current_app
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services.plugins.plugin_manager import PluginManager

logger = logging.getLogger(__name__)
plugin_api_bp = Blueprint("plugins", __name__)

@plugin_api_bp.route("/page", methods=["GET"])
@login_required
@admin_required
def plugins_page():
    """Render the plugins management page."""
    return render_template("kasir/settings/plugins.html")

@plugin_api_bp.route("/", methods=["GET"])
@login_required
@admin_required
def get_plugins():
    """Get a list of all discovered plugins and their status."""
    manager = PluginManager.get_instance()
    plugins_info = manager.get_all_plugins_info()
    return jsonify({"success": True, "plugins": plugins_info})

@plugin_api_bp.route("/toggle", methods=["POST"])
@login_required
@admin_required
def toggle_plugin():
    """Enable or disable a plugin."""
    data = request.json
    plugin_id = data.get("plugin_id")
    enabled = data.get("enabled")
    
    if not plugin_id or enabled is None:
        return jsonify({"success": False, "error": "Missing plugin_id or enabled status"}), 400
        
    manager = PluginManager.get_instance()
    if enabled:
        manager.enable_plugin(plugin_id)
    else:
        manager.disable_plugin(plugin_id)
        
    return jsonify({"success": True, "message": "Plugin status updated. Restart backend to apply fully."})

import re

def _is_safe_path(base_dir: str, path: str) -> bool:
    """Verifikasi bahwa path berada di dalam base_dir setelah resolusi absolut."""
    base = os.path.abspath(base_dir)
    target = os.path.abspath(os.path.join(base, path))
    return os.path.commonpath([base]) == os.path.commonpath([base, target])

@plugin_api_bp.route("/upload", methods=["POST"])
@login_required
@admin_required
def upload_plugin():
    """Upload a plugin ZIP file and extract it."""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400
        
    if not file.filename.endswith('.zip'):
        return jsonify({"success": False, "error": "Only .zip files are allowed"}), 400
        
    manager = PluginManager.get_instance()
    plugins_dir = manager.plugins_dir
    
    if not plugins_dir:
        return jsonify({"success": False, "error": "Plugin directory not initialized"}), 500
        
    temp_fd, temp_path = tempfile.mkstemp(suffix='.zip')
    try:
        os.close(temp_fd)
        file.save(temp_path)
        
        with zipfile.ZipFile(temp_path, 'r') as zip_ref:
            # Validasi keamanan seluruh path di dalam ZIP sebelum diekstrak
            for member in zip_ref.namelist():
                norm = member.replace('\\', '/')
                if norm.startswith('/') or '..' in norm.split('/'):
                    return jsonify({"success": False, "error": "Invalid ZIP: unsafe path traversal detected"}), 400

            # Look for manifest.json
            manifest_info = None
            for info in zip_ref.infolist():
                if info.filename.endswith('manifest.json'):
                    manifest_info = info
                    break
                    
            if not manifest_info:
                return jsonify({"success": False, "error": "Invalid plugin: No manifest.json found in ZIP"}), 400
                
            # Extract manifest to read plugin ID
            with zip_ref.open(manifest_info) as f:
                try:
                    manifest_data = json.load(f)
                except Exception:
                    return jsonify({"success": False, "error": "Invalid manifest: Corrupted JSON"}), 400
                plugin_id = manifest_data.get('id')
                
                if not plugin_id or not re.match(r'^[a-zA-Z0-9_-]+$', str(plugin_id)):
                    return jsonify({"success": False, "error": "Invalid manifest: Missing or invalid 'id' format"}), 400
            
            target_dir = os.path.join(plugins_dir, plugin_id)
            if not _is_safe_path(plugins_dir, plugin_id):
                return jsonify({"success": False, "error": "Invalid plugin target directory"}), 400

            if not os.path.exists(target_dir):
                os.makedirs(target_dir, exist_ok=True)
                
            common_prefix = os.path.commonprefix(zip_ref.namelist())
            if common_prefix and common_prefix.endswith('/'):
                extract_root = plugins_dir
                for member in zip_ref.infolist():
                    if not _is_safe_path(extract_root, member.filename):
                        return jsonify({"success": False, "error": "Unsafe path detected during extraction"}), 400
                zip_ref.extractall(extract_root)
                extracted_folder = os.path.join(plugins_dir, common_prefix.strip('/'))
                if extracted_folder != target_dir and os.path.exists(extracted_folder):
                    shutil.move(extracted_folder, target_dir)
            else:
                for member in zip_ref.infolist():
                    if not _is_safe_path(target_dir, member.filename):
                        return jsonify({"success": False, "error": "Unsafe path detected during extraction"}), 400
                zip_ref.extractall(target_dir)
            
        return jsonify({"success": True, "message": "Plugin uploaded successfully!"})
    except zipfile.BadZipFile:
        return jsonify({"success": False, "error": "Invalid ZIP format"}), 400
    except Exception as e:
        logger.error(f"Plugin upload error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

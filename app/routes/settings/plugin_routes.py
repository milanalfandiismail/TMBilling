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
plugin_bp = Blueprint("plugins", __name__)

@plugin_bp.route("/kasir/settings/plugins", methods=["GET"])
@login_required
@admin_required
def plugins_page():
    """Render the plugins management page."""
    return render_template("kasir/settings/plugins.html")

@plugin_bp.route("/api/settings/plugins", methods=["GET"])
@login_required
@admin_required
def get_plugins():
    """Get a list of all discovered plugins and their status."""
    manager = PluginManager.get_instance()
    plugins_info = manager.get_all_plugins_info()
    return jsonify({"success": True, "plugins": plugins_info})

@plugin_bp.route("/api/settings/plugins/toggle", methods=["POST"])
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

@plugin_bp.route("/api/settings/plugins/upload", methods=["POST"])
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
                manifest_data = json.load(f)
                plugin_id = manifest_data.get('id')
                
                if not plugin_id:
                    return jsonify({"success": False, "error": "Invalid manifest: Missing 'id'"}), 400
            
            # The ZIP might contain a top-level folder or just files.
            # We want to extract it safely into plugins_dir / plugin_id
            target_dir = os.path.join(plugins_dir, plugin_id)
            if not os.path.exists(target_dir):
                os.makedirs(target_dir)
                
            # If ZIP has a top-level folder that is the same as plugin_id, we strip it.
            # Simplified approach: extract everything, if it creates a nested folder we could move it,
            # but for now let's just extract all directly into target_dir if the zip has no root folder.
            # For robustness, just extract directly to plugins_dir if the zip already contains a root folder.
            
            # Check if all files share a common root dir
            common_prefix = os.path.commonprefix(zip_ref.namelist())
            if common_prefix and common_prefix.endswith('/'):
                # Extract directly to plugins_dir, the folder should become plugin_id
                # (Assuming the zip root folder name matches plugin_id)
                zip_ref.extractall(plugins_dir)
                # If the folder name was different, we should rename it to plugin_id
                extracted_folder = os.path.join(plugins_dir, common_prefix.strip('/'))
                if extracted_folder != target_dir and os.path.exists(extracted_folder):
                    shutil.move(extracted_folder, target_dir)
            else:
                # No common root, extract into target_dir
                zip_ref.extractall(target_dir)
            
        return jsonify({"success": True, "message": "Plugin uploaded successfully!"})
    except Exception as e:
        logger.error(f"Plugin upload error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

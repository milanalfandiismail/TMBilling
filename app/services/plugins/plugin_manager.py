import os
import sys
import json
import importlib
import logging
from typing import Dict, List, Any

from app.services.plugins.base_plugin import BasePlugin
from app.services.settings.settings_service import SettingsService
from app.models import db

logger = logging.getLogger(__name__)

class PluginManager:
    _instance = None
    
    def __init__(self):
        self.plugins: Dict[str, BasePlugin] = {}
        self.plugin_manifests: Dict[str, dict] = {}
        self.app = None
        self.plugins_dir = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = PluginManager()
        return cls._instance

    def init_app(self, app):
        """Initialize the plugin manager and load enabled plugins."""
        self.app = app
        # Root path is TMBilling/app, so plugins is TMBilling/plugins
        self.plugins_dir = os.path.abspath(os.path.join(app.root_path, '..', 'plugins'))
        
        if not os.path.exists(self.plugins_dir):
            try:
                os.makedirs(self.plugins_dir)
            except Exception as e:
                logger.error(f"Could not create plugins directory: {e}")
            
        if self.plugins_dir not in sys.path:
            sys.path.insert(0, self.plugins_dir)
            
        self._discover_plugins()
        self._load_enabled_plugins()
        
        # Call on_start for all loaded plugins
        for pid, plugin in self.plugins.items():
            try:
                plugin.on_start(app)
            except Exception as e:
                logger.error(f"Error calling on_start for plugin {pid}: {e}")

    def _discover_plugins(self):
        """Scan the plugins directory for valid plugins with manifest.json."""
        self.plugin_manifests = {}
        
        if not os.path.exists(self.plugins_dir):
            return
            
        for item in os.listdir(self.plugins_dir):
            plugin_path = os.path.join(self.plugins_dir, item)
            if os.path.isdir(plugin_path):
                manifest_path = os.path.join(plugin_path, 'manifest.json')
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                            # Ensure required fields
                            if 'name' in manifest and 'id' in manifest:
                                # Force ID to match folder name for import resolution
                                manifest['id'] = item
                                self.plugin_manifests[item] = manifest
                    except Exception as e:
                        logger.error(f"Failed to load manifest for plugin {item}: {e}")

    def is_plugin_enabled(self, plugin_id: str) -> bool:
        """Check if a plugin is enabled in settings."""
        key = f"plugin_{plugin_id}_enabled"
        val = SettingsService.get(key, "false")
        return str(val).lower() == "true"

    def enable_plugin(self, plugin_id: str):
        key = f"plugin_{plugin_id}_enabled"
        SettingsService.set(key, "true")
        
    def disable_plugin(self, plugin_id: str):
        key = f"plugin_{plugin_id}_enabled"
        SettingsService.set(key, "false")

    def get_all_plugins_info(self) -> List[dict]:
        """Return info about all discovered plugins for the dashboard."""
        self._discover_plugins()
        result = []
        for pid, manifest in self.plugin_manifests.items():
            info = manifest.copy()
            info['enabled'] = self.is_plugin_enabled(pid)
            info['loaded'] = pid in self.plugins
            result.append(info)
        return result

    def _load_enabled_plugins(self):
        """Load and instantiate enabled plugins."""
        for pid, manifest in self.plugin_manifests.items():
            if self.is_plugin_enabled(pid):
                try:
                    # Import the package (folder name)
                    module = importlib.import_module(pid)
                    
                    # Find the class that inherits from BasePlugin
                    plugin_class = None
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if isinstance(attr, type) and issubclass(attr, BasePlugin) and attr is not BasePlugin:
                            plugin_class = attr
                            break
                            
                    if plugin_class:
                        plugin_instance = plugin_class()
                        self.plugins[pid] = plugin_instance
                        logger.info(f"Loaded plugin: {manifest['name']} v{manifest.get('version', '1.0')}")
                        
                        # Load models if any
                        plugin_instance.get_models()
                    else:
                        logger.error(f"Plugin {pid} does not export a BasePlugin class.")
                        
                except Exception as e:
                    logger.error(f"Failed to load plugin {pid}: {e}")

    def register_blueprints(self):
        """Register all blueprints from loaded plugins. Should be called after init_app."""
        for pid, plugin in self.plugins.items():
            try:
                blueprints = plugin.get_blueprints()
                for bp in blueprints:
                    self.app.register_blueprint(bp)
            except Exception as e:
                logger.error(f"Failed to register blueprints for plugin {pid}: {e}")

    def fire_event(self, event_name: str, *args, **kwargs):
        """Fire an event on all loaded plugins that implement it."""
        for pid, plugin in self.plugins.items():
            if hasattr(plugin, event_name) and callable(getattr(plugin, event_name)):
                try:
                    getattr(plugin, event_name)(*args, **kwargs)
                except Exception as e:
                    logger.error(f"Error in plugin {pid} handling event {event_name}: {e}")

    def get_active_menus(self) -> List[dict]:
        """Aggregate menus from all active plugins."""
        menus = []
        for pid, plugin in self.plugins.items():
            try:
                plugin_menus = plugin.get_menus()
                if isinstance(plugin_menus, list):
                    menus.extend(plugin_menus)
            except Exception as e:
                logger.error(f"Error getting menus from plugin {pid}: {e}")
        return menus

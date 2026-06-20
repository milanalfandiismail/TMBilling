from abc import ABC, abstractmethod
from typing import List, Any
from flask import Blueprint

class BasePlugin(ABC):
    """
    Abstract base class for TMBilling plugins.
    All plugins must inherit from this class to be recognized by the PluginManager.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the plugin"""
        pass

    def on_start(self, app: Any) -> None:
        """Called when the application starts up."""
        pass

    def get_blueprints(self) -> List[Blueprint]:
        """Return a list of Flask Blueprints to register."""
        return []

    def get_models(self) -> List[Any]:
        """Return a list of SQLAlchemy model classes to register."""
        return []

    def get_menus(self) -> List[dict]:
        """
        Return a list of dictionary menus to add to the Kasir Sidebar.
        Format: [{"title": "Poin", "url": "/plugin/poin", "icon": "🎁"}]
        """
        return []
        
    def on_session_start(self, session_data: Any) -> None:
        """Hook called when a billing session starts."""
        pass

    def on_transaction_commit(self, transaction_data: Any) -> None:
        """Hook called after a transaction is committed."""
        pass

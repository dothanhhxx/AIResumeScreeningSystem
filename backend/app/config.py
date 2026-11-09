"""Backward-compatible re-export of core application settings."""

from app.core.config import Settings, get_settings, settings

__all__ = ["Settings", "get_settings", "settings"]

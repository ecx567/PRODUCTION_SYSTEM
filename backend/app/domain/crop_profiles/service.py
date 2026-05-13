"""
CropProfileLoader — JSON file loader with Pydantic validation and in-memory cache.

Loads crop profiles from ``app/data/crop_profiles.json`` at first access,
validates every entry against ``CropProfile``, and caches the result
in-process for the lifetime of the application.

Design decisions:
    - JSON file (zero-migration, version-controllable) as an alternative
      to a DB table or hardcoded dicts.
    - In-memory cache (no Redis dependency) since the file is small
      (< 100 KB for 20-30 crops) and changes require a deployment.
    - Malformed entries are logged and skipped — the loader returns a
      partial result rather than failing entirely.
    - Thread-safe for concurrent FastAPI request handlers (read-only
      after initialization).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.domain.crop_profiles.schemas import CropProfile, CropProfileList

logger = logging.getLogger("crop.crop_profiles.service")


# ── Default path relative to this service file ────────────────
DEFAULT_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "crop_profiles.json"


class CropProfileLoader:
    """Load, validate, and cache crop profiles from a JSON data file.

    Thread-safe for concurrent reads after initialization. The loader
    populates its in-memory cache on first access (lazy load) and
    serves all subsequent requests from cache.

    Usage::

        loader = CropProfileLoader()
        profiles = loader.get_all()          # list of CropProfile
        profile = loader.get("maize")        # single CropProfile or None
        names = loader.list_names()          # list[str]
        total = loader.count()               # int

    Args:
        data_path: Path to the JSON crop profiles file. Defaults to
                   ``app/data/crop_profiles.json``.
    """

    def __init__(self, data_path: str | Path | None = None) -> None:
        self._data_path = Path(data_path) if data_path else DEFAULT_DATA_PATH
        self._cache: list[CropProfile] | None = None
        self._name_index: dict[str, CropProfile] | None = None
        self._load_errors: list[str] | None = None

    # ── Public API ────────────────────────────────────────────

    def get_all(self) -> CropProfileList:
        """Return all validated crop profiles.

        Returns:
            A ``CropProfileList`` with all successfully parsed profiles.

        Raises:
            RuntimeError: If the JSON file is missing or completely
                          unparseable (no entries could be loaded).
        """
        self._ensure_loaded()
        if self._cache is None:
            raise RuntimeError(
                f"Crop profiles could not be loaded from {self._data_path}. "
                "Check the file format and content."
            )
        return CropProfileList(items=list(self._cache), total=len(self._cache))

    def get(self, name: str) -> CropProfile | None:
        """Look up a single crop profile by name (case-insensitive).

        Args:
            name: Crop type name (e.g., ``"maize"``, ``"banana"``).

        Returns:
            The matching ``CropProfile`` or ``None`` if not found.
        """
        self._ensure_loaded()
        if self._name_index is None:
            return None
        return self._name_index.get(name.lower())

    def list_names(self) -> list[str]:
        """Return a sorted list of all available crop profile names."""
        self._ensure_loaded()
        if self._cache is None:
            return []
        return sorted(p.name for p in self._cache)

    def count(self) -> int:
        """Return the number of successfully loaded crop profiles."""
        self._ensure_loaded()
        return len(self._cache) if self._cache else 0

    def reload(self) -> None:
        """Force cache invalidation and reload from disk.

        Useful in development to pick up JSON edits without restarting
        the server. Call this if the underlying file has been modified.
        """
        self._cache = None
        self._name_index = None
        self._load_errors = None
        self._ensure_loaded()

    @property
    def load_errors(self) -> list[str]:
        """Return any non-fatal errors from the last load attempt."""
        if self._load_errors is None:
            return []
        return list(self._load_errors)

    # ── Internal: lazy load + validate ───────────────────────

    def _ensure_loaded(self) -> None:
        """Populate cache on first access if not already loaded."""
        if self._cache is not None:
            return
        self._load()

    def _load(self) -> None:
        """Read, parse, and validate the crop profiles JSON file.

        Malformed entries are logged and skipped. The loader always
        attempts to return a partial result rather than raising.
        """
        if not self._data_path.exists():
            logger.error("Crop profiles file not found: %s", self._data_path)
            self._cache = []
            self._name_index = {}
            self._load_errors = [f"File not found: {self._data_path}"]
            return

        try:
            raw_text = self._data_path.read_text(encoding="utf-8")
            raw_data: list[dict[str, Any]] = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            logger.error("Crop profiles JSON parse error: %s", exc)
            self._cache = []
            self._name_index = {}
            self._load_errors = [f"JSON parse error: {exc}"]
            return

        if not isinstance(raw_data, list):
            logger.error("Crop profiles file must contain a JSON array at top level.")
            self._cache = []
            self._name_index = {}
            self._load_errors = ["Top-level value is not a JSON array"]
            return

        valid: list[CropProfile] = []
        errors: list[str] = []

        for idx, entry in enumerate(raw_data):
            try:
                profile = CropProfile.model_validate(entry)
                valid.append(profile)
            except Exception as exc:
                entry_name = entry.get("name", f"<index {idx}>")
                msg = f"Entry #{idx} ({entry_name}): {exc}"
                logger.warning("Skipping malformed crop profile: %s", msg)
                errors.append(msg)

        # Build name index (last duplicate wins, with warning)
        name_index: dict[str, CropProfile] = {}
        for profile in valid:
            if profile.name in name_index:
                logger.warning(
                    "Duplicate crop profile name '%s' — keeping last occurrence.",
                    profile.name,
                )
            name_index[profile.name] = profile

        self._cache = valid
        self._name_index = name_index
        self._load_errors = errors

        logger.info(
            "Loaded %d / %d crop profiles from %s (errors: %d).",
            len(valid), len(raw_data), self._data_path, len(errors),
        )


# Module-level singleton for dependency injection
_profile_loader: CropProfileLoader | None = None


def get_profile_loader() -> CropProfileLoader:
    """Return the application-wide singleton ``CropProfileLoader``.

    The loader is lazily instantiated on first call and cached for
    the lifetime of the process. This avoids re-reading and re-validating
    the JSON file on every request.
    """
    global _profile_loader
    if _profile_loader is None:
        _profile_loader = CropProfileLoader()
    return _profile_loader

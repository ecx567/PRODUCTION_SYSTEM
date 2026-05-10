"""
Application configuration via pydantic-settings.

All sensitive values come from environment variables. RSA key pair is
auto-generated on first run if JWT_PRIVATE_KEY / JWT_PUBLIC_KEY are not set.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _generate_rsa_key_pair() -> tuple[str, str]:
    """Generate a 2048-bit RSA key pair and return (private_key_pem, public_key_pem)."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return private_pem, public_pem


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Environment ────────────────────────────────────────
    ENVIRONMENT: str = Field(default="development")
    CORS_ORIGINS: str = Field(default="*")

    # ── Database ───────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://cropuser:cropsecret@localhost:5432/cropproduction"
    )

    # ── Redis ──────────────────────────────────────────────
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # ── EMQX / MQTT ────────────────────────────────────────
    EMQX_HOST: str = Field(default="localhost")
    EMQX_PORT: int = Field(default=1883)
    EMQX_ADMIN_PASSWORD: str = Field(default="admin")

    # ── JWT ────────────────────────────────────────────────
    JWT_PRIVATE_KEY: Optional[str] = Field(default=None)
    JWT_PUBLIC_KEY: Optional[str] = Field(default=None)
    JWT_ALGORITHM: str = Field(default="RS256")
    JWT_SECRET: str = Field(default="change-me-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    JWT_ISSUER: str = Field(default="crop-production-system")
    JWT_AUDIENCE: str = Field(default="crop-production-api")

    # ── Internal caches (populated at startup) ─────────────
    _private_key_pem: str | None = None
    _public_key_pem: str | None = None
    _keys_loaded: bool = False

    @property
    def private_key_pem(self) -> str:
        """Return the RSA private key, generating if needed."""
        self._ensure_keys()
        return self._private_key_pem  # type: ignore

    @property
    def public_key_pem(self) -> str:
        """Return the RSA public key, generating if needed."""
        self._ensure_keys()
        return self._public_key_pem  # type: ignore

    def _ensure_keys(self) -> None:
        """Load or generate the RSA key pair once."""
        if self._keys_loaded:
            return

        if self.JWT_PRIVATE_KEY and self.JWT_PUBLIC_KEY:
            self._private_key_pem = self.JWT_PRIVATE_KEY
            self._public_key_pem = self.JWT_PUBLIC_KEY
        else:
            self._private_key_pem, self._public_key_pem = _generate_rsa_key_pair()

        self._keys_loaded = True


settings = Settings()

"""
Authentication service: password hashing, JWT creation/validation, refresh rotation.

Uses RS256 (asymmetric) JWT signing via PyJWT. Refresh tokens use a family-based
rotation scheme with replay detection — if an already-used token is presented,
the entire family is revoked and the user must re-authenticate.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from passlib.context import CryptContext
from redis.asyncio import Redis

from app.config import settings

logger = logging.getLogger("crop.auth.service")

# ── Password context ───────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Redis key prefixes ─────────────────────────────────────
_RT_JTI_PREFIX = "refresh_token:"       # refresh_token:{jti} → hash
_RT_FAMILY_PREFIX = "refresh_family:"   # refresh_family:{family_id} → set of jtis


def _load_private_key() -> Any:
    """Load the RSA private key from PEM string."""
    from cryptography.hazmat.primitives import serialization
    return serialization.load_pem_private_key(
        settings.private_key_pem.encode("utf-8"),
        password=None,
    )


def _load_public_key() -> Any:
    """Load the RSA public key from PEM string."""
    from cryptography.hazmat.primitives import serialization
    return serialization.load_pem_public_key(
        settings.public_key_pem.encode("utf-8"),
    )


# ── Password helpers ───────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


# ── JWT helpers ────────────────────────────────────────────

def _now() -> datetime:
    """Return current UTC datetime (offset-aware)."""
    return datetime.now(timezone.utc)


def _make_jti() -> str:
    """Generate a unique JWT ID (jti) for replay detection."""
    return uuid.uuid4().hex


def create_access_token(
    user_id: str,
    tenant_id: str,
    role: str,
    permissions: list[str] | None = None,
) -> str:
    """Create a short-lived JWT access token (15 min by default).

    Claims follow RFC 7519 standard fields:
      sub (user_id), tenant_id, role, permissions,
      jti, iat, exp, iss, aud
    """
    now = _now()
    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "permissions": permissions or [],
        "jti": _make_jti(),
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": "access",
    }
    return jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    tenant_id: str,
    family_id: str | None = None,
) -> tuple[str, str, str]:
    """Create a refresh token and return (token, jti, family_id).

    Each refresh token belongs to a *family*. When rotated, the old token's jti
    is marked as used, and a new jti within the same family is issued. If an
    already-used jti is replayed, the entire family is revoked.

    Args:
        user_id:   The user's UUID.
        tenant_id: The current tenant UUID.
        family_id: Existing family ID for rotation; ``None`` generates a new one.

    Returns:
        Tuple of (encoded_token, jti, family_id).
    """
    jti = _make_jti()
    family = family_id or uuid.uuid4().hex
    now = _now()

    payload: dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "jti": jti,
        "family": family,
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": "refresh",
    }
    token = jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALGORITHM)
    return token, jti, family


def decode_token(token: str, verify_exp: bool = True) -> dict[str, Any]:
    """Decode and verify a JWT token (access or refresh).

    Raises:
        jwt.ExpiredSignatureError: Token has expired.
        jwt.InvalidTokenError:     Token is malformed, wrong audience, etc.
    """
    return jwt.decode(
        token,
        _load_public_key(),
        algorithms=[settings.JWT_ALGORITHM],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={"verify_exp": verify_exp},
    )


def validate_token(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Decode and validate a token, checking its type claim.

    Args:
        token:         The JWT string.
        expected_type: ``"access"`` or ``"refresh"``.

    Returns:
        Decoded payload if valid.

    Raises:
        jwt.ExpiredSignatureError: Token has expired.
        jwt.InvalidTokenError:     Token type mismatch or other validation failure.
    """
    payload = decode_token(token)

    token_type = payload.get("type")
    if token_type != expected_type:
        raise jwt.InvalidTokenError(
            f"Expected token type '{expected_type}', got '{token_type}'"
        )

    return payload


# ── Refresh token rotation (Redis-backed) ──────────────────

async def store_refresh_token(
    redis: Redis,
    jti: str,
    user_id: str,
    family_id: str,
    ttl_seconds: int | None = None,
) -> None:
    """Store refresh token metadata in Redis for replay detection.

    Structure:
        refresh_token:{jti} → {user_id, family_id, used: false}
        refresh_family:{family_id} → SET of jtis
    """
    ttl = ttl_seconds or (settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)

    pipe = redis.pipeline()
    # Store token metadata as a hash
    await pipe.hset(
        f"{_RT_JTI_PREFIX}{jti}",
        mapping={
            "user_id": user_id,
            "family_id": family_id,
            "used": "false",
        },
    )
    await pipe.expire(f"{_RT_JTI_PREFIX}{jti}", ttl)

    # Add to family set
    await pipe.sadd(f"{_RT_FAMILY_PREFIX}{family_id}", jti)
    await pipe.expire(f"{_RT_FAMILY_PREFIX}{family_id}", ttl)
    await pipe.execute()


async def rotate_refresh_token(
    redis: Redis,
    current_refresh_token: str,
) -> tuple[str, str, str] | None:
    """Rotate a refresh token: validate, mark old as used, issue new.

    Returns (new_token, new_jti, new_family) on success.
    Returns ``None`` if the token is invalid, expired, or the family was revoked.

    **Replay detection**: if the old token's jti is already marked ``used``,
    the **entire family** is revoked (all jtis deleted) and ``None`` is returned.
    The caller should force the user to re-authenticate.
    """
    try:
        payload = validate_token(current_refresh_token, expected_type="refresh")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as exc:
        logger.warning("Refresh token validation failed: %s", exc)
        return None

    jti: str = payload["jti"]
    user_id: str = payload["sub"]
    tenant_id: str = payload["tenant_id"]
    family_id: str = payload.get("family", "")

    if not family_id:
        logger.warning("Refresh token missing 'family' claim — rejecting.")
        return None

    # ── Check for replay ────────────────────────────────────
    token_key = f"{_RT_JTI_PREFIX}{jti}"
    stored = await redis.hgetall(token_key)

    if not stored:
        # Token not in Redis — either expired out or never stored.
        # Treat as invalid (conservative).
        logger.warning("Refresh token jti=%s not found in Redis.", jti)
        return None

    if stored.get(b"used") == b"true":
        # ⚠ REPLAY DETECTED — revoke entire family
        logger.warning(
            "REPLAY DETECTED: refresh token jti=%s (family=%s) already used. "
            "Revoking entire family.",
            jti,
            family_id,
        )
        await _revoke_family(redis, family_id)
        return None

    # ── Mark current as used ────────────────────────────────
    await redis.hset(token_key, "used", "true")

    # ── Issue new token in same family ──────────────────────
    new_token, new_jti, _ = create_refresh_token(
        user_id=user_id,
        tenant_id=tenant_id,
        family_id=family_id,
    )

    await store_refresh_token(redis, new_jti, user_id, family_id)

    # Issue new access token too
    new_access = create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        role=payload.get("role", "farmer"),
    )

    return new_access, new_token, new_jti


async def revoke_refresh_token(redis: Redis, jti: str) -> None:
    """Revoke a single refresh token by jti."""
    token_key = f"{_RT_JTI_PREFIX}{jti}"
    stored = await redis.hgetall(token_key)
    if stored:
        family_id = stored.get(b"family_id", b"").decode()
        if family_id:
            await redis.srem(f"{_RT_FAMILY_PREFIX}{family_id}", jti)
        await redis.delete(token_key)


async def revoke_user_sessions(redis: Redis, user_id: str) -> int:
    """Revoke ALL refresh token families for a user (e.g., password change).

    .. note::
        This requires iterating all family keys. For production, consider
        maintaining a user→families index in Redis.

    Returns the number of families revoked.
    """
    # This is a best-effort scan. For scale, index families by user.
    count = 0
    async for key in redis.scan_iter(match=f"{_RT_FAMILY_PREFIX}*"):
        family_id = key.decode().replace(_RT_FAMILY_PREFIX, "")
        members = await redis.smembers(key)
        for member_jti in members:
            jti_key = f"{_RT_JTI_PREFIX}{member_jti.decode()}"
            stored = await redis.hgetall(jti_key)
            if stored and stored.get(b"user_id", b"").decode() == user_id:
                await _revoke_family(redis, family_id)
                count += 1
                break  # one family per scan iteration
    return count


async def _revoke_family(redis: Redis, family_id: str) -> None:
    """Delete all refresh tokens in a family (complete family revocation)."""
    family_key = f"{_RT_FAMILY_PREFIX}{family_id}"
    members = await redis.smembers(family_key)
    if members:
        pipe = redis.pipeline()
        for jti in members:
            pipe.delete(f"{_RT_JTI_PREFIX}{jti.decode()}")
        pipe.delete(family_key)
        await pipe.execute()
        logger.info("Revoked refresh token family=%s (%d tokens).", family_id, len(members))
    else:
        await redis.delete(family_key)

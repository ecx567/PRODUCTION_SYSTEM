"""
FastAPI dependencies for JWT authentication, tenant scoping, and RBAC.

Provides:
- ``get_current_user``: extracts and validates the access token from the
  ``Authorization: Bearer ...`` header.
- ``tenant_scoped``: ensures the authenticated user belongs to the requested
  tenant (or matches their own tenant_id claim).
- ``RoleChecker``: class-based dependency that verifies the user's role against
  allowed roles.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, Sequence

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.auth.models import User
from app.domain.auth.service import validate_token
from fastapi import Request

logger = logging.getLogger("crop.auth.middleware")

# ── Security scheme ────────────────────────────────────────
_security_scheme = HTTPBearer(auto_error=False)

# ── Exceptions ─────────────────────────────────────────────
_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

_FORBIDDEN_EXC = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Insufficient permissions for this resource",
)

_TENANT_DENIED_EXC = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Tenant access denied",
)


# ── Type alias for the authenticated user payload ──────────
class AuthPayload(dict):
    """Authenticated user claims from the JWT."""

    @property
    def user_id(self) -> str:
        return self.get("sub", "")

    @property
    def tenant_id(self) -> str:
        return self.get("tenant_id", "")

    @property
    def role(self) -> str:
        return self.get("role", "")

    @property
    def permissions(self) -> list[str]:
        return self.get("permissions", [])


# ── Dependencies ───────────────────────────────────────────

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_security_scheme)],
) -> AuthPayload:
    """Extract and validate the current user from the Bearer token.

    Expects an **access** token in the ``Authorization: Bearer <token>`` header.

    Raises:
        HTTPException(401): Missing, expired, or invalid token.
    """
    if credentials is None:
        raise _CREDENTIALS_EXC

    token = credentials.credentials
    try:
        payload = validate_token(token, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise _CREDENTIALS_EXC from None
    except jwt.InvalidTokenError:
        raise _CREDENTIALS_EXC from None

    return AuthPayload(payload)


async def get_current_user_from_cookie(
    request: Request,
) -> AuthPayload:
    """Extract and validate the current user from the ``session`` httpOnly cookie.

    Used by the web client's ``GET /session`` endpoint. The cookie carries an
    **access** JWT, validated identically to the ``Authorization`` header path.

    Raises:
        HTTPException(401): Missing, expired, or invalid cookie.
    """
    token = request.cookies.get("session")
    if not token:
        raise _CREDENTIALS_EXC

    try:
        payload = validate_token(token, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise _CREDENTIALS_EXC from None
    except jwt.InvalidTokenError:
        raise _CREDENTIALS_EXC from None

    return AuthPayload(payload)


async def optional_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_security_scheme)],
) -> AuthPayload | None:
    """Like ``get_current_user`` but returns ``None`` instead of 401.

    Useful for endpoints where authentication is optional (e.g., public read).
    """
    if credentials is None:
        return None
    try:
        payload = validate_token(credentials.credentials, expected_type="access")
        return AuthPayload(payload)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


async def tenant_scoped(
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    tenant_id: str | None = None,
) -> AuthPayload:
    """Ensure the current user operates within their own tenant scope.

    Callers can pass an explicit ``tenant_id`` (e.g., from a path parameter)
    to check against the user's JWT claim.

    Raises:
        HTTPException(403): Tenant mismatch.
    """
    if tenant_id is not None and current_user.tenant_id != tenant_id:
        raise _TENANT_DENIED_EXC
    return current_user


class RoleChecker:
    """Class-based FastAPI dependency that checks the user's role.

    Usage::

        farmer_only = RoleChecker("farmer")
        admin_or_agronomist = RoleChecker("admin", "agronomist")

        @router.get("/fields")
        async def list_fields(
            current_user: Annotated[AuthPayload, Depends(admin_or_agronomist)],
        ):
            ...
    """

    def __init__(self, *allowed_roles: str) -> None:
        self._allowed = allowed_roles

    async def __call__(
        self,
        current_user: Annotated[AuthPayload, Depends(get_current_user)],
    ) -> AuthPayload:
        if current_user.role not in self._allowed:
            logger.warning(
                "Role check failed: user=%s role=%s, need one of=%s",
                current_user.user_id,
                current_user.role,
                self._allowed,
            )
            raise _FORBIDDEN_EXC
        return current_user


# ── Helper: resolve the User ORM row from the JWT (rarely needed) ──

async def get_current_user_row(
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Resolve the authenticated user from the database.

    .. caution::
        Adds a DB round-trip. Use only when you need the real ORM object.
        For most cases, the JWT claims in ``AuthPayload`` are sufficient.
    """
    result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXC
    return user

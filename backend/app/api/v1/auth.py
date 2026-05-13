"""
Authentication endpoints: login, refresh, tenant-switch, signup, session, and logout.

All endpoints return JWT token pairs (access + refresh) with RS256 signing.
Refresh tokens use family-based rotation with replay detection.

Cookie-based auth (Phase 2 migration):
    Web clients receive httpOnly ``session`` and ``refresh`` cookies on login /
    signup, while mobile / legacy clients can still use the ``Authorization``
    header. The ``GET /session`` endpoint validates the cookie and is the
    canonical way for the web dashboard to check auth state.
"""

from __future__ import annotations

import logging
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.core.redis import get_redis
from app.domain.auth.middleware import (
    AuthPayload,
    _CREDENTIALS_EXC,
    _FORBIDDEN_EXC,
    _TENANT_DENIED_EXC,
    get_current_user,
    get_current_user_from_cookie,
)
from app.domain.auth.models import User, UserRole
from app.domain.auth.models_tenant import Tenant
from app.domain.auth.schemas import (
    ErrorResponse,
    LoginRequest,
    RefreshRequest,
    SessionResponse,
    SignupRequest,
    TenantSwitchRequest,
    TokenResponse,
)
from app.domain.auth.service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    rotate_refresh_token,
    store_refresh_token,
    validate_token,
    verify_password,
)

logger = logging.getLogger("crop.api.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Cookie helpers ─────────────────────────────────────────

_SESSION_COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # 900 s
_REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400  # 604800 s


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    """Set httpOnly ``session`` and ``refresh`` cookies on the response.

    Both cookies are:
        - ``HttpOnly`` (inaccessible to JavaScript)
        - ``Path=/`` (valid across the entire site)
        - ``SameSite=lax`` (sent for top-level navigations)

    The **session** cookie carries the access JWT (15 min).
    The **refresh** cookie carries the refresh JWT (7 days).
    """
    response.set_cookie(
        key="session",
        value=access_token,
        max_age=_SESSION_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # TODO: set to True in production behind HTTPS
        path="/",
    )
    response.set_cookie(
        key="refresh",
        value=refresh_token,
        max_age=_REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # TODO: set to True in production behind HTTPS
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Delete the ``session`` and ``refresh`` cookies immediately."""
    response.delete_cookie(key="session", path="/", httponly=True, samesite="lax")
    response.delete_cookie(key="refresh", path="/", httponly=True, samesite="lax")


# ── POST /login ────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
    },
    summary="Authenticate user and issue JWT pair",
)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[AsyncRedis, Depends(get_redis)],
) -> TokenResponse:
    """Validate email + password credentials and return an access/refresh token pair.

    Sets httpOnly ``session`` and ``refresh`` cookies for web clients while
    still returning the JSON body for mobile / legacy consumers.

    The access token is valid for 15 minutes (configurable). The refresh token
    is valid for 7 days and can be rotated once via ``POST /refresh``.
    """
    # ── Look up user ───────────────────────────────────────
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        logger.warning("Failed login attempt for email=%s", body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        logger.warning("Inactive user attempted login: email=%s", body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
        )

    # ── Issue tokens ───────────────────────────────────────
    user_id_str = str(user.id)
    tenant_id_str = str(user.tenant_id)

    access_token = create_access_token(
        user_id=user_id_str,
        tenant_id=tenant_id_str,
        role=user.role.value,
    )
    refresh_token, jti, family_id = create_refresh_token(
        user_id=user_id_str,
        tenant_id=tenant_id_str,
    )

    # Persist refresh metadata to Redis
    await store_refresh_token(redis, jti, user_id_str, family_id)

    # Set httpOnly cookies for web clients
    set_auth_cookies(response, access_token, refresh_token)

    logger.info("User %s logged in (tenant=%s).", user.email, tenant_id_str)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── POST /refresh ──────────────────────────────────────────

@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"},
    },
    summary="Rotate refresh token and issue new JWT pair",
)
async def refresh(
    body: RefreshRequest,
    redis: Annotated[AsyncRedis, Depends(get_redis)],
) -> TokenResponse:
    """Exchange a valid refresh token for a new access/refresh pair.

    **Rotation with replay detection**:
    Each refresh token can be used exactly once. If a used token is replayed,
    the entire token *family* is revoked — requiring the user to log in again.

    Send the refresh token in the request body::

        { "refresh_token": "<token>" }
    """
    result = await rotate_refresh_token(redis, body.refresh_token)

    if result is None:
        # Token could be invalid, expired, or family was revoked due to replay
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token. Please log in again.",
        )

    new_access, new_refresh, new_jti = result
    logger.info("Refresh token rotated (jti=%s).", new_jti)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
    )


# ── POST /tenant-switch ────────────────────────────────────

@router.post(
    "/tenant-switch",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid credentials"},
        403: {"model": ErrorResponse, "description": "Tenant access denied"},
    },
    summary="Exchange token for a different tenant scope",
)
async def tenant_switch(
    body: TenantSwitchRequest,
    current_user: Annotated[AuthPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[AsyncRedis, Depends(get_redis)],
) -> TokenResponse:
    """Issue a new JWT pair scoped to a different tenant.

    The target tenant must match the user's membership. This is useful for
    agronomist/admin roles that manage multiple tenants.

    .. caution::
        This replaces the *current* token pair. The old tokens remain valid
        until they expire naturally. For full session revocation, implement
        a token blocklist (see service.revoke_user_sessions).
    """
    target_tenant_id = body.tenant_id

    # ── Verify user belongs to target tenant ────────────────
    # For now, we check if the user's tenant_id matches. In a multi-tenant
    # setup with user→tenant membership, this would check the membership table.
    if current_user.tenant_id != target_tenant_id:
        logger.warning(
            "Tenant switch denied: user=%s tried to switch from tenant=%s to tenant=%s",
            current_user.user_id,
            current_user.tenant_id,
            target_tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant access denied",
        )

    # ── Issue new tokens for target tenant ──────────────────
    access_token = create_access_token(
        user_id=current_user.user_id,
        tenant_id=target_tenant_id,
        role=current_user.role,
    )
    refresh_token, jti, family_id = create_refresh_token(
        user_id=current_user.user_id,
        tenant_id=target_tenant_id,
    )

    await store_refresh_token(redis, jti, current_user.user_id, family_id)

    logger.info(
        "User %s switched to tenant=%s.",
        current_user.user_id,
        target_tenant_id,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── POST /signup ───────────────────────────────────────────

@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    response_model=TokenResponse,
    responses={
        409: {"model": ErrorResponse, "description": "Email already registered"},
    },
    summary="Register a new user and issue JWT pair",
)
async def signup(
    body: SignupRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[AsyncRedis, Depends(get_redis)],
) -> TokenResponse:
    """Create a new user, auto-assign to the default tenant, and issue tokens.

    Sets httpOnly ``session`` and ``refresh`` cookies for web clients while
    returning the JSON body for mobile / legacy consumers.

    The default tenant is resolved by name (*Default Farm*). If the tenant
    does not exist the endpoint fails with HTTP 500 — run the seed first.
    """
    # ── Check for duplicate email ──────────────────────────
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # ── Resolve default tenant ─────────────────────────────
    result = await db.execute(
        select(Tenant).where(Tenant.name == "Default Farm")
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        logger.error(
            "Default tenant 'Default Farm' not found. "
            "Run seed or create the tenant before signing up users."
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default tenant not configured. Contact an administrator.",
        )

    # ── Propagate signup country to tenant ─────────────────
    if body.country and body.country != tenant.country:
        logger.info(
            "Updating tenant %s country from %s to %s",
            tenant.name, tenant.country, body.country,
        )
        tenant.country = body.country

    # ── Create user ────────────────────────────────────────
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.FARMER,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # obtain the auto-generated PK

    logger.info(
        "User signed up: email=%s user_id=%s tenant=%s",
        body.email,
        user.id,
        tenant.name,
    )

    # ── Issue tokens ───────────────────────────────────────
    user_id_str = str(user.id)
    tenant_id_str = str(user.tenant_id)

    access_token = create_access_token(
        user_id=user_id_str,
        tenant_id=tenant_id_str,
        role=user.role.value,
    )
    refresh_token, jti, family_id = create_refresh_token(
        user_id=user_id_str,
        tenant_id=tenant_id_str,
    )

    await store_refresh_token(redis, jti, user_id_str, family_id)

    # ── Set cookies ────────────────────────────────────────
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── GET /session ───────────────────────────────────────────

@router.get(
    "/session",
    response_model=SessionResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid session cookie"},
    },
    summary="Validate the session cookie and return current user info",
)
async def check_session(
    current_user: Annotated[AuthPayload, Depends(get_current_user_from_cookie)],
) -> SessionResponse:
    """Return the authenticated user's profile derived from the ``session`` cookie.

    This is the canonical endpoint for the web dashboard to verify auth state
    after a page refresh — no in-memory token required.
    """
    return SessionResponse(
        user_id=current_user.user_id,
        email=current_user.get("email", ""),
        role=current_user.role,
        tenant_id=current_user.tenant_id,
    )


# ── POST /logout ───────────────────────────────────────────

@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear auth cookies and end the session",
)
async def logout(response: Response) -> None:
    """Delete the ``session`` and ``refresh`` httpOnly cookies.

    Call this when the user clicks *Sign Out*. Because the cookies are
    HttpOnly, the client cannot delete them — the server must issue the
    ``Set-Cookie`` with an empty value and ``Max-Age=0``.
    """
    clear_auth_cookies(response)
    logger.info("User logged out — auth cookies cleared.")

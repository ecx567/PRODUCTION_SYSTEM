"""
Authentication endpoints: login, refresh, and tenant-switch.

All endpoints return JWT token pairs (access + refresh) with RS256 signing.
Refresh tokens use family-based rotation with replay detection.
"""

from __future__ import annotations

import logging
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis as AsyncRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.domain.auth.middleware import (
    AuthPayload,
    get_current_user,
    _CREDENTIALS_EXC,
    _FORBIDDEN_EXC,
    _TENANT_DENIED_EXC,
)
from app.domain.auth.models import User
from app.domain.auth.schemas import (
    ErrorResponse,
    LoginRequest,
    RefreshRequest,
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
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[AsyncRedis, Depends(get_redis)],
) -> TokenResponse:
    """Validate email + password credentials and return an access/refresh token pair.

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

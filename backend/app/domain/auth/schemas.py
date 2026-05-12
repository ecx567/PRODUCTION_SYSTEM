"""
Pydantic schemas for authentication requests and responses.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic.functional_validators import AfterValidator
from typing_extensions import Annotated

from app.core.validators import relaxed_email_validator

# Custom EmailStr that accepts .local and special-use domains (dev-friendly)
EmailStr = Annotated[str, AfterValidator(relaxed_email_validator)]


class LoginRequest(BaseModel):
    """User credentials for login."""

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class TokenResponse(BaseModel):
    """Successful authentication response with JWT pair."""

    access_token: str = Field(..., description="Short-lived JWT access token")
    refresh_token: str = Field(..., description="Long-lived refresh token for rotation")
    token_type: str = Field(default="bearer", description="Token type")

    @property
    def authorization_header(self) -> str:
        return f"{self.token_type} {self.access_token}"


class RefreshRequest(BaseModel):
    """Request body for token refresh."""

    refresh_token: str = Field(..., description="Current refresh token to rotate")


class TenantSwitchRequest(BaseModel):
    """Request body for switching tenant scope."""

    tenant_id: str = Field(..., description="Target tenant UUID to switch into")


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str = Field(..., description="Human-readable error message")
    error_code: str | None = Field(default=None, description="Machine-readable error code")


class SignupRequest(BaseModel):
    """New user registration payload."""

    email: EmailStr = Field(..., description="New user email address")
    password: str = Field(..., min_length=8, description="Account password (min 8 chars)")
    name: str | None = Field(default=None, description="Optional display name")


class SessionResponse(BaseModel):
    """Current session info derived from the auth cookie."""

    user_id: str = Field(..., description="Authenticated user UUID")
    email: str = Field(..., description="User email address")
    role: str = Field(..., description="User role (admin, farmer, agronomist)")
    tenant_id: str = Field(..., description="Active tenant UUID")

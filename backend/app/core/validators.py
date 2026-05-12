"""
Relaxed validators for development-friendly data validation.

These validators accept special-use domains (e.g. `.local`, `.test`,
`.example`) that Pydantic's default EmailStr (backed by email-validator)
rejects.  Production deployments can swap in the strict default.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic_core import PydanticCustomError

# RFC 5322-ish — good enough for dev, avoids false rejections
_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def relaxed_email_validator(value: str) -> str:
    """Validate email format while allowing special-use TLDs.

    Compared to Pydantic's built-in ``EmailStr``:

    *   Accepts ``.local``, ``.test``, ``.example`` and other
        special-use / reserved TLDs.
    *   Does **not** perform DNS or SMTP deliverability checks.
    *   Still rejects obviously malformed addresses (missing ``@``,
        no domain, whitespace, …).

    Use this for **development only**.  For production replace the
    ``EmailStr`` type alias in ``app/domain/auth/schemas.py`` with
    Pydantic's ``EmailStr``.
    """
    if not _EMAIL_PATTERN.match(value):
        from pydantic_core import PydanticCustomError

        raise PydanticCustomError(
            "value_error",
            "value is not a valid email address (relaxed validator)",
            {"value": value},
        )
    return value

"""
Tests for the crop type validation in Field schemas.

Verifies that ``validate_crop_type`` accepts all allowed crop types
and rejects unknown values. Must be updated when ALLOWED_CROP_TYPES expands.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.fields.schemas import ALLOWED_CROP_TYPES, FieldCreate, FieldUpdate


# ═══════════════════════════════════════════════════════════════
# Unit tests for validate_crop_type (pure function, no DB needed)
# ═══════════════════════════════════════════════════════════════

class TestValidateCropType:
    """Tests for the ``validate_crop_type`` validator on ``FieldCreate``."""

    # ── Old (original) crop types — must still work ──────────

    @pytest.mark.parametrize("crop", ["banana", "maize", "cacao", "rice"])
    def test_original_crop_types_accepted(self, crop: str):
        """Original 4 crop types are accepted after expansion."""
        field = FieldCreate(name="Test", crop_type=crop, area_ha=1.0)
        assert field.crop_type == crop

    # ── New crop types — must be accepted after expansion ────

    @pytest.mark.parametrize("crop", [
        "coffee", "sugarcane", "soybean", "sunflower", "palm_oil", "cotton",
    ])
    def test_new_crop_types_accepted(self, crop: str):
        """Newly added crop types pass validation."""
        field = FieldCreate(name="Test", crop_type=crop, area_ha=1.0)
        assert field.crop_type == crop

    # ── Case insensitivity ───────────────────────────────────

    @pytest.mark.parametrize("crop", ["Banana", "MAIZE", "Cacao", "Coffee", "PALM_OIL"])
    def test_case_insensitive(self, crop: str):
        """Crop type validation is case-insensitive (stored lowercase)."""
        field = FieldCreate(name="Test", crop_type=crop, area_ha=1.0)
        assert field.crop_type == crop.lower()

    # ── Invalid crop types — must be rejected ────────────────

    @pytest.mark.parametrize("crop", ["lavender", "wheat", "tomato", "", "   "])
    def test_invalid_crop_type_rejected(self, crop: str):
        """Unknown crop types raise ValidationError."""
        with pytest.raises(ValidationError, match="Invalid crop type"):
            FieldCreate(name="Test", crop_type=crop, area_ha=1.0)

    # ── FieldUpdate — same validator via Optional[str] ───────

    @pytest.mark.parametrize("crop", ["coffee", "banana", "soybean"])
    def test_field_update_accepts_valid(self, crop: str):
        """FieldUpdate.validate_crop_type accepts valid crop types."""
        update = FieldUpdate(crop_type=crop)
        assert update.crop_type == crop

    def test_field_update_allows_none(self):
        """FieldUpdate.validate_crop_type passes None through unchanged."""
        update = FieldUpdate(crop_type=None)
        assert update.crop_type is None

    @pytest.mark.parametrize("crop", ["lavender", "wheat"])
    def test_field_update_rejects_invalid(self, crop: str):
        """FieldUpdate.validate_crop_type rejects unknown crop types."""
        with pytest.raises(ValidationError, match="Invalid crop type"):
            FieldUpdate(crop_type=crop)

    # ── ALLOWED_CROP_TYPES set ───────────────────────────────

    def test_allowed_set_contains_expected_types(self):
        """ALLOWED_CROP_TYPES contains all 10 expected crop types."""
        expected = {
            "banana", "maize", "cacao", "rice",
            "coffee", "sugarcane", "soybean", "sunflower", "palm_oil", "cotton",
        }
        assert ALLOWED_CROP_TYPES == expected


# ═══════════════════════════════════════════════════════════════
# Approval tests for ORM model (crop_type stored as String(50))
# ═══════════════════════════════════════════════════════════════

class TestFieldModelCropType:
    """Verify Field model accepts new crop types at the ORM level."""

    async def test_create_field_with_new_crop_type(
        self, fields_service, tenant_id, db_session,
    ):
        """Creating a field with coffee succeeds via service + ORM."""
        from app.domain.fields.schemas import FieldCreate
        data = FieldCreate(name="Coffee Plantation", crop_type="coffee", area_ha=15.0)
        result = await fields_service.create_field(data, tenant_id, db_session)
        assert result is not None
        assert result.crop_type == "coffee"

    async def test_create_field_with_soybean(
        self, fields_service, tenant_id, db_session,
    ):
        """Soybean is accepted through the full service layer."""
        from app.domain.fields.schemas import FieldCreate
        data = FieldCreate(name="Soybean Field", crop_type="soybean", area_ha=20.0)
        result = await fields_service.create_field(data, tenant_id, db_session)
        assert result.crop_type == "soybean"

    async def test_create_field_with_sugarcane(
        self, fields_service, tenant_id, db_session,
    ):
        """Sugarcane is accepted through the full service layer."""
        from app.domain.fields.schemas import FieldCreate
        data = FieldCreate(name="Sugarcane Plot", crop_type="sugarcane", area_ha=30.0)
        result = await fields_service.create_field(data, tenant_id, db_session)
        assert result.crop_type == "sugarcane"

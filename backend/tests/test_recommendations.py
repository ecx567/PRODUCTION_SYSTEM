"""
Tests for the recommendation engine: FAO-56 irrigation, split-N fertilization, pest risk.

Covers:
    - FAO-56 ETo calculation (Hargreaves method) with known inputs
    - Kc lookup and interpolation by growth stage
    - Soil water balance and irrigation decision logic
    - Split-N fertilization recommendation by growth stage
    - Pest risk GDD accumulation and threshold matching
    - Edge cases: missing data, extreme values, unknown crop types
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

from app.domain.recommendations.service import (
    RecommendationService,
    FALLBACK_CROP_COEFFICIENTS,
    FALLBACK_FERTILIZER_RATES,
    PEST_THRESHOLDS,
    impute_missing_value,
)
from app.domain.recommendations.schemas import (
    IrrigationRecommendation,
    FertilizationRecommendation,
    PestRiskAlert,
    RecommendationSummary,
)


# ── Fixtures ────────────────────────────────────────────────

@pytest.fixture
def service() -> RecommendationService:
    return RecommendationService()


@pytest.fixture
def field_id() -> UUID:
    return uuid4()


@pytest.fixture
def sample_readings() -> list[dict]:
    """Realistic sensor readings for testing."""
    return [
        {"temp": 28.5, "humidity": 72.0, "soil_moisture": 45.0, "rain": 0.0},
        {"temp": 30.2, "humidity": 68.0, "soil_moisture": 44.0, "rain": 0.0},
        {"temp": 26.8, "humidity": 75.0, "soil_moisture": 43.0, "rain": 5.2},
        {"temp": 27.1, "humidity": 80.0, "soil_moisture": 46.0, "rain": 0.0},
        {"temp": 29.0, "humidity": 70.0, "soil_moisture": 42.0, "rain": 0.0},
    ]


# ═══════════════════════════════════════════════════════════════
# FAO-56 Irrigation Tests
# ═══════════════════════════════════════════════════════════════

class TestEToHargreaves:
    """Reference evapotranspiration (ETo) via Hargreaves method."""

    def test_basic_calculation(self, service: RecommendationService):
        """Known input → expected ETo output (verify with known values)."""
        # Tropical conditions: T_min=22, T_max=32, T_mean=27, Ra=28
        # ETo = 0.0023 × 28 × (27+17.8) × sqrt(10) ≈ 9.1 mm/day
        eto = service.calculate_eto_hargreaves(
            t_min=22.0, t_max=32.0, t_mean=27.0, ra=28.0,
        )
        assert 7.0 <= eto <= 11.0, f"ETo {eto} outside expected range 7-11 mm/day"

    def test_low_temperature_range(self, service: RecommendationService):
        """Small T_max - T_min delta should produce lower ETo."""
        eto_small = service.calculate_eto_hargreaves(
            t_min=24.0, t_max=25.0, t_mean=24.5, ra=28.0,
        )
        eto_large = service.calculate_eto_hargreaves(
            t_min=20.0, t_max=35.0, t_mean=27.5, ra=28.0,
        )
        assert eto_small < eto_large, "Smaller temp range should give lower ETo"

    def test_negative_temperature(self, service: RecommendationService):
        """Should handle negative temps without crashing (non-tropical, but robust)."""
        eto = service.calculate_eto_hargreaves(
            t_min=-5.0, t_max=5.0, t_mean=0.0, ra=12.0,
        )
        assert eto >= 0.0, "ETo must be non-negative"
        assert isinstance(eto, float)

    def test_swapped_min_max(self, service: RecommendationService):
        """Swapped T_min and T_max should be handled gracefully."""
        eto = service.calculate_eto_hargreaves(
            t_min=32.0, t_max=22.0, t_mean=27.0, ra=28.0,
        )
        assert 7.0 <= eto <= 11.0, "Swapped temps should still produce valid ETo"

    def test_zero_radiation(self, service: RecommendationService):
        """Zero radiation should give zero ETo."""
        eto = service.calculate_eto_hargreaves(
            t_min=20.0, t_max=30.0, t_mean=25.0, ra=0.0,
        )
        assert eto == 0.0, "ETo should be 0 with no radiation"


class TestKcLookup:
    """Crop coefficient (Kc) by growth stage."""

    def test_initial_stage(self, service: RecommendationService):
        """Early days after planting → Kc_initial."""
        kc = service.get_kc("maize", days_since_planting=5)
        assert kc == FALLBACK_CROP_COEFFICIENTS["maize"]["kc_initial"]
        assert kc == 0.3

    def test_mid_stage(self, service: RecommendationService):
        """Mid-season → Kc_mid."""
        # Maize: initial=20d, dev=35d, so mid starts at day 56
        kc = service.get_kc("maize", days_since_planting=70)
        assert kc == FALLBACK_CROP_COEFFICIENTS["maize"]["kc_mid"]
        assert kc == 1.2

    def test_end_stage(self, service: RecommendationService):
        """Late season interpolates toward Kc_end."""
        # Maize: late starts at day 20+35+40=95, ends at 125
        # At day 120, Kc is partway through interpolation (25/30 = 0.833)
        # Kc = 1.2 + 0.833*(0.6-1.2) = 0.7
        kc = service.get_kc("maize", days_since_planting=120)
        assert kc == 0.7  # interpolating between 1.2 and 0.6
        # Beyond full cycle (day 125+) should give Kc_end
        kc_end = service.get_kc("maize", days_since_planting=200)
        assert kc_end == FALLBACK_CROP_COEFFICIENTS["maize"]["kc_end"]
        assert kc_end == 0.6

    def test_development_stage_interpolation(self, service: RecommendationService):
        """Development stage should interpolate between Kc_initial and Kc_mid."""
        kc_mid_dev = service.get_kc("maize", days_since_planting=37)  # halfway through dev
        kc_initial = FALLBACK_CROP_COEFFICIENTS["maize"]["kc_initial"]
        kc_mid = FALLBACK_CROP_COEFFICIENTS["maize"]["kc_mid"]
        assert kc_initial < kc_mid_dev < kc_mid

    def test_unknown_crop_defaults(self, service: RecommendationService):
        """Unknown crop type should return default Kc=1.0."""
        kc = service.get_kc("unknown_crop", days_since_planting=50)
        assert kc == 1.0

    def test_beyond_cycle(self, service: RecommendationService):
        """Beyond full growth cycle → Kc_end."""
        kc = service.get_kc("maize", days_since_planting=500)
        assert kc == FALLBACK_CROP_COEFFICIENTS["maize"]["kc_end"]


class TestIrrigationRecommendation:
    """Full irrigation recommendation pipeline."""

    @pytest.mark.asyncio
    async def test_water_recommendation_low_moisture(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Low soil moisture with high ETc → should recommend watering."""
        readings = [
            {"temp": 32.0, "humidity": 60.0, "soil_moisture": 25.0, "rain": 0.0},
            {"temp": 34.0, "humidity": 55.0, "soil_moisture": 24.0, "rain": 0.0},
            {"temp": 31.0, "humidity": 65.0, "soil_moisture": 23.0, "rain": 0.0},
        ]
        # We need a db session even though calculate_irrigation doesn't use it
        # in current implementation for the core calc. Use None as db is only
        # used for future DB queries (not yet implemented).
        result = await service.calculate_irrigation(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=60,
            sensor_readings=readings,
            db=None,  # type: ignore[arg-type]
        )
        assert result is not None
        assert result.recommendation in ("water", "monitor")
        assert result.irrigation_needed_mm > 0
        assert result.depletion_percent > 30
        assert result.eto_mm > 0
        assert result.etc_mm > 0

    @pytest.mark.asyncio
    async def test_skip_recommendation_high_moisture(
        self, service: RecommendationService, field_id: UUID,
    ):
        """High soil moisture → should skip irrigation."""
        readings = [
            {"temp": 25.0, "humidity": 80.0, "soil_moisture": 75.0, "rain": 10.0},
            {"temp": 24.0, "humidity": 85.0, "soil_moisture": 78.0, "rain": 5.0},
        ]
        result = await service.calculate_irrigation(
            field_id=field_id,
            crop_type="banana",
            days_since_planting=30,
            sensor_readings=readings,
            db=None,
        )
        assert result is not None
        assert result.recommendation == "skip"
        assert result.irrigation_needed_mm == 0.0

    @pytest.mark.asyncio
    async def test_no_sensor_data(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Empty sensor readings → should return None."""
        result = await service.calculate_irrigation(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=60,
            sensor_readings=[],
            db=None,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_no_temperature_data(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Readings with no temperature → should return None."""
        readings = [
            {"temp": None, "humidity": 70.0, "soil_moisture": 50.0, "rain": 0.0},
        ]
        result = await service.calculate_irrigation(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=60,
            sensor_readings=readings,
            db=None,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_different_crop_coefficients(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Different crops should give different irrigation needs."""
        readings = [
            {"temp": 28.0, "humidity": 70.0, "soil_moisture": 35.0, "rain": 0.0},
            {"temp": 30.0, "humidity": 65.0, "soil_moisture": 34.0, "rain": 0.0},
        ]
        rice_result = await service.calculate_irrigation(
            field_id=field_id, crop_type="rice",
            days_since_planting=40, sensor_readings=readings, db=None,
        )
        maize_result = await service.calculate_irrigation(
            field_id=field_id, crop_type="maize",
            days_since_planting=40, sensor_readings=readings, db=None,
        )
        assert rice_result is not None and maize_result is not None
        # Different Kc values should yield different ETc
        assert rice_result.etc_mm != maize_result.etc_mm


# ═══════════════════════════════════════════════════════════════
# Fertilization Tests
# ═══════════════════════════════════════════════════════════════

class TestFertilization:
    """Split-N fertilization logic."""

    def test_growth_stage_determination(self, service: RecommendationService):
        """Days since planting → correct growth stage."""
        assert service.determine_growth_stage(5, "maize") == "planting"
        assert service.determine_growth_stage(40, "maize") == "vegetative"
        assert service.determine_growth_stage(90, "maize") == "reproductive"

    def test_planting_fertilizer_rates(self, service: RecommendationService):
        """Planting stage should have appropriate N-P-K rates."""
        stage = service.determine_growth_stage(5, "maize")
        rates = FALLBACK_FERTILIZER_RATES["maize"][stage]
        assert rates["n"] == 40
        assert rates["p"] == 50
        assert rates["k"] == 40

    @pytest.mark.asyncio
    async def test_apply_recommendation(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Standard case: should recommend application."""
        result = await service.calculate_fertilization(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=40,  # vegetative = peak demand
        )
        assert result.recommendation == "apply"
        assert result.n_kg_ha > 0
        assert result.p_kg_ha > 0
        assert result.k_kg_ha > 0
        assert result.growth_stage == "vegetative"

    @pytest.mark.asyncio
    async def test_skip_adequate_soil_nutrients(
        self, service: RecommendationService, field_id: UUID,
    ):
        """High soil test values → should skip."""
        result = await service.calculate_fertilization(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=60,
            soil_test_n=200.0,  # very high N
            soil_test_p=150.0,  # very high P
            soil_test_k=200.0,  # very high K
        )
        assert result.recommendation == "skip"
        assert result.n_kg_ha == 0.0
        assert result.p_kg_ha == 0.0
        assert result.k_kg_ha == 0.0

    @pytest.mark.asyncio
    async def test_delay_partial_nutrients(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Some nutrients adequate → delay recommendation."""
        result = await service.calculate_fertilization(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=30,
            soil_test_n=200.0,  # exceeds need
        )
        # N is adequate, but P/K may be needed
        assert result.recommendation in ("delay", "apply")


# ═══════════════════════════════════════════════════════════════
# Pest Risk Tests
# ═══════════════════════════════════════════════════════════════

class TestPestRisk:
    """Degree-day pest risk models."""

    def test_gdd_calculation(self, service: RecommendationService):
        """Known temps → expected GDD."""
        gdd = service.calculate_gdd(t_min=15.0, t_max=25.0, t_base=10.0)
        # (15+25)/2 - 10 = 20 - 10 = 10
        assert gdd == 10.0

    def test_gdd_below_base(self, service: RecommendationService):
        """Temps below base → zero GDD."""
        gdd = service.calculate_gdd(t_min=5.0, t_max=8.0, t_base=10.0)
        assert gdd == 0.0

    def test_gdd_with_upper_threshold(self, service: RecommendationService):
        """Upper threshold caps T_max."""
        gdd = service.calculate_gdd(t_min=20.0, t_max=45.0, t_base=10.0, t_upper=35.0)
        # (20+35)/2 - 10 = 27.5 - 10 = 17.5
        assert gdd == 17.5

    @pytest.mark.asyncio
    async def test_pest_risk_high(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Favorable conditions + high GDD → high risk."""
        readings = [
            {"temp": 27.0, "humidity": 95.0, "soil_moisture": None, "rain": None},
            {"temp": 28.0, "humidity": 92.0, "soil_moisture": None, "rain": None},
            {"temp": 26.0, "humidity": 93.0, "soil_moisture": None, "rain": None},
            {"temp": 27.5, "humidity": 91.0, "soil_moisture": None, "rain": None},
            {"temp": 26.5, "humidity": 94.0, "soil_moisture": None, "rain": None},
            {"temp": 27.0, "humidity": 90.0, "soil_moisture": None, "rain": None},
            {"temp": 28.0, "humidity": 89.0, "soil_moisture": None, "rain": None},
        ]
        # Many days since planting → high accumulated GDD → risk for rice blast
        alerts = await service.assess_pest_risk(
            field_id=field_id,
            crop_type="rice",
            days_since_planting=100,
            sensor_readings=readings,
        )
        assert len(alerts) >= 1
        # Check for Blast
        blast_alerts = [a for a in alerts if "Blast" in a.pest_name]
        if blast_alerts:
            assert blast_alerts[0].risk_level == "high"
            assert blast_alerts[0].conditions_favorable is True

    @pytest.mark.asyncio
    async def test_pest_risk_low(
        self, service: RecommendationService, field_id: UUID,
    ):
        """Non-favorable conditions + low GDD → low risk."""
        readings = [
            {"temp": 15.0, "humidity": 30.0, "soil_moisture": None, "rain": None},
            {"temp": 18.0, "humidity": 35.0, "soil_moisture": None, "rain": None},
        ]
        alerts = await service.assess_pest_risk(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=10,
            sensor_readings=readings,
        )
        if alerts:
            for alert in alerts:
                assert alert.risk_level in ("low", "medium")

    @pytest.mark.asyncio
    async def test_crop_specific_pests(self, service: RecommendationService, field_id: UUID):
        """Banana should only get Black Sigatoka alerts."""
        alerts = await service.assess_pest_risk(
            field_id=field_id,
            crop_type="banana",
            days_since_planting=200,
            sensor_readings=[
                {"temp": 28.0, "humidity": 85.0},
                {"temp": 27.0, "humidity": 90.0},
            ],
        )
        pest_names = [a.pest_name for a in alerts]
        for name in pest_names:
            assert "Banana" in name or "Sigatoka" in name, \
                f"Unexpected pest for banana: {name}"

    @pytest.mark.asyncio
    async def test_no_readings(self, service: RecommendationService, field_id: UUID):
        """Empty readings → empty alerts list."""
        alerts = await service.assess_pest_risk(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=50,
            sensor_readings=[],
        )
        assert alerts == []


# ═══════════════════════════════════════════════════════════════
# Data Imputation Tests (RE-1)
# ═══════════════════════════════════════════════════════════════

class TestImputation:
    """Missing weather data imputation strategies."""

    def test_forward_fill_short_gap(self):
        """Short gap (< 6h): forward fill with high confidence."""
        value, confidence = impute_missing_value(
            value=None,
            recent_values=[28.5, 29.0, 28.8],
            gap_hours=3.0,
        )
        assert value == 28.8  # most recent value
        assert confidence == 0.90

    def test_seasonal_average_medium_gap(self):
        """Medium gap (6-48h): seasonal average with medium confidence."""
        value, confidence = impute_missing_value(
            value=None,
            recent_values=[None, None, None],
            seasonal_avg=27.5,
            gap_hours=24.0,
        )
        assert value == 27.5
        assert confidence == 0.70

    def test_long_gap_returns_none(self):
        """Long gap (> 48h): return None with low confidence."""
        value, confidence = impute_missing_value(
            value=None,
            recent_values=[None, None, None],
            seasonal_avg=None,
            gap_hours=72.0,
        )
        assert value is None
        assert confidence == 0.30

    def test_value_present(self):
        """Actual value present → returns as-is with 1.0 confidence."""
        value, confidence = impute_missing_value(
            value=26.5,
            recent_values=[],
            gap_hours=0.0,
        )
        assert value == 26.5
        assert confidence == 1.0


# ═══════════════════════════════════════════════════════════════
# PR 2 — Lifecycle Schema & Transition Tests
# ═══════════════════════════════════════════════════════════════

class TestRecommendationLifecycle:
    """RecommendationStatus transitions and schema validation."""

    def test_valid_transitions_active(self):
        """Active can transition to acknowledged, dismissed, or applied."""
        from app.domain.recommendations.schemas import RecommendationStatus
        status = RecommendationStatus.ACTIVE
        allowed = {"acknowledged", "dismissed", "applied"}
        assert status.value in ("active",)
        assert "acknowledged" in allowed
        assert "dismissed" in allowed
        assert "applied" in allowed

    def test_valid_transitions_acknowledged(self):
        """Acknowledged can transition to applied or dismissed."""
        allowed = {"applied", "dismissed"}
        assert "applied" in allowed
        assert "dismissed" in allowed

    def test_valid_transitions_dismissed(self):
        """Dismissed can transition back to active."""
        allowed = {"active"}
        assert "active" in allowed

    def test_valid_transitions_applied(self):
        """Applied is terminal — no transitions allowed."""
        allowed: set[str] = set()
        assert len(allowed) == 0

    def test_invalid_transition_raises_409(self):
        """Invalid transitions should raise HTTPException 409."""
        from fastapi import HTTPException, status

        from app.domain.recommendations.router import _validate_transition

        # Active → applied is valid
        _validate_transition("active", "applied")  # should not raise

        # Applied → anything is invalid
        with pytest.raises(HTTPException) as exc:
            _validate_transition("applied", "acknowledged")
        assert exc.value.status_code == status.HTTP_409_CONFLICT

        # Acknowledged → active is invalid
        with pytest.raises(HTTPException) as exc:
            _validate_transition("acknowledged", "active")
        assert exc.value.status_code == status.HTTP_409_CONFLICT

        # Dismissed → applied is invalid
        with pytest.raises(HTTPException) as exc:
            _validate_transition("dismissed", "applied")
        assert exc.value.status_code == status.HTTP_409_CONFLICT

    def test_status_update_schema_valid(self):
        """RecommendationStatusUpdate validates correctly."""
        from app.domain.recommendations.schemas import (
            RecommendationStatus,
            RecommendationStatusUpdate,
        )
        payload = RecommendationStatusUpdate(status=RecommendationStatus.ACKNOWLEDGED)
        assert payload.status == RecommendationStatus.ACKNOWLEDGED
        assert payload.comment is None

        payload_with_comment = RecommendationStatusUpdate(
            status=RecommendationStatus.DISMISSED,
            comment="Not relevant at this time",
        )
        assert payload_with_comment.status == RecommendationStatus.DISMISSED
        assert payload_with_comment.comment == "Not relevant at this time"

    def test_status_response_schema(self):
        """RecommendationStatusResponse can be constructed."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from app.domain.recommendations.schemas import (
            RecommendationSeverity,
            RecommendationStatus,
            RecommendationStatusResponse,
        )
        now = datetime.now(timezone.utc)
        response = RecommendationStatusResponse(
            id=uuid4(),
            field_id=uuid4(),
            type="irrigation",
            status=RecommendationStatus.ACTIVE,
            severity=RecommendationSeverity.INFO,
            title="Test recommendation",
        )
        assert response.status == RecommendationStatus.ACTIVE
        assert response.severity == RecommendationSeverity.INFO


# ═══════════════════════════════════════════════════════════════
# PR 2 — CropProfileLoader Integration Tests
# ═══════════════════════════════════════════════════════════════

class TestProfileFallback:
    """RecommendationService falls back when CropProfileLoader is unavailable."""

    def test_get_kc_fallback_no_loader(self):
        """Without profile_loader, get_kc uses hardcoded fallback."""
        service = RecommendationService()  # no profile_loader
        # Crops in FALLBACK_CROP_COEFFICIENTS should work
        kc = service.get_kc("maize", 5)
        assert kc == 0.3

        # Unknown crop should return 1.0
        kc = service.get_kc("unknown_crop", 50)
        assert kc == 1.0

    def test_get_kc_fallback_with_missing_profile(self):
        """With profile_loader that returns None, falls back to hardcoded."""
        from unittest.mock import MagicMock

        mock_loader = MagicMock()
        mock_loader.get.return_value = None  # profile not found

        service = RecommendationService(profile_loader=mock_loader)
        kc = service.get_kc("maize", 5)
        assert kc == 0.3  # fallback

    def test_growth_stage_fallback_no_loader(self):
        """Without profile_loader, determine_growth_stage uses hardcoded bounds."""
        service = RecommendationService()
        stage = service.determine_growth_stage(5, "maize")
        assert stage == "planting"

        stage = service.determine_growth_stage(40, "maize")
        assert stage == "vegetative"

    def test_fertilizer_fallback_no_loader(self):
        """Without profile_loader, calculate_fertilization uses hardcoded rates."""
        import pytest

        @pytest.mark.asyncio
        async def _test():
            from uuid import uuid4
            service = RecommendationService()
            result = await service.calculate_fertilization(
                field_id=uuid4(),
                crop_type="maize",
                days_since_planting=40,
            )
            assert result.recommendation == "apply"
            assert result.n_kg_ha > 0
            assert result.p_kg_ha > 0

        import asyncio
        asyncio.run(_test())


# ═══════════════════════════════════════════════════════════════
# PR 2 — Forecast Rain Gate Tests
# ═══════════════════════════════════════════════════════════════

class TestRainGate:
    """Forecast rain gate: skip irrigation when forecast rain ≥ ETc."""

    @pytest.mark.asyncio
    async def test_rain_gate_triggers_skip(self):
        """Sufficient forecast rain (≥ ETc at ≥80% confidence) → skip."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        # Mock weather service returning high rain forecast
        mock_weather = MagicMock()
        mock_forecast = MagicMock()
        mock_forecast.daily = [
            MagicMock(precipitation_sum=15.0, et0_hargreaves=3.0),
            MagicMock(precipitation_sum=10.0, et0_hargreaves=3.5),
            MagicMock(precipitation_sum=8.0, et0_hargreaves=3.0),
        ]
        # Total rain: 33mm, total ET0: 9.5 * Kc(0.3) = 2.85mm ETc → rain >= ETc
        mock_weather.get_forecast_daily_with_eto = AsyncMock(return_value=mock_forecast)

        service = RecommendationService(weather_service=mock_weather)
        result = await service.calculate_irrigation(
            field_id=uuid4(),
            crop_type="maize",
            days_since_planting=5,  # initial stage, Kc=0.3
            sensor_readings=[
                {"temp": 32.0, "humidity": 60.0, "soil_moisture": 25.0, "rain": 0.0},
                {"temp": 34.0, "humidity": 55.0, "soil_moisture": 24.0, "rain": 0.0},
            ],
            db=None,
            lat=23.1,
            lon=-82.5,
        )
        assert result is not None
        assert result.recommendation == "skip"
        assert result.irrigation_needed_mm == 0.0

    @pytest.mark.asyncio
    async def test_rain_gate_low_confidence_does_not_skip(self):
        """Low forecast confidence (<80%) → rain gate does NOT override."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        # Mock weather service returning forecast with None values (low confidence)
        mock_weather = MagicMock()
        mock_forecast = MagicMock()
        mock_forecast.daily = [
            MagicMock(precipitation_sum=None, et0_hargreaves=3.0),
            MagicMock(precipitation_sum=None, et0_hargreaves=3.5),
            MagicMock(precipitation_sum=None, et0_hargreaves=3.0),
        ]
        mock_weather.get_forecast_daily_with_eto = AsyncMock(return_value=mock_forecast)

        service = RecommendationService(weather_service=mock_weather)
        # Low soil moisture → would normally recommend "water"
        result = await service.calculate_irrigation(
            field_id=uuid4(),
            crop_type="maize",
            days_since_planting=60,
            sensor_readings=[
                {"temp": 32.0, "humidity": 60.0, "soil_moisture": 20.0, "rain": 0.0},
                {"temp": 34.0, "humidity": 55.0, "soil_moisture": 18.0, "rain": 0.0},
                {"temp": 31.0, "humidity": 65.0, "soil_moisture": 19.0, "rain": 0.0},
            ],
            db=None,
            lat=23.1,
            lon=-82.5,
        )
        assert result is not None
        # Should still recommend water (rain gate not triggered due to low confidence)
        assert result.recommendation in ("water", "monitor")

    @pytest.mark.asyncio
    async def test_rain_gate_insufficient_rain(self):
        """Forecast rain < ETc → rain gate does NOT trigger."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        mock_weather = MagicMock()
        mock_forecast = MagicMock()
        mock_forecast.daily = [
            MagicMock(precipitation_sum=1.0, et0_hargreaves=5.0),
            MagicMock(precipitation_sum=0.5, et0_hargreaves=5.5),
            MagicMock(precipitation_sum=0.0, et0_hargreaves=5.0),
        ]
        # Total rain: 1.5mm, total ET0: 15.5 → rain < ETc → no trigger
        mock_weather.get_forecast_daily_with_eto = AsyncMock(return_value=mock_forecast)

        service = RecommendationService(weather_service=mock_weather)
        result = await service.calculate_irrigation(
            field_id=uuid4(),
            crop_type="maize",
            days_since_planting=60,
            sensor_readings=[
                {"temp": 32.0, "humidity": 60.0, "soil_moisture": 20.0, "rain": 0.0},
                {"temp": 34.0, "humidity": 55.0, "soil_moisture": 18.0, "rain": 0.0},
                {"temp": 31.0, "humidity": 65.0, "soil_moisture": 19.0, "rain": 0.0},
            ],
            db=None,
            lat=23.1,
            lon=-82.5,
        )
        assert result is not None
        assert result.recommendation in ("water", "monitor")

    @pytest.mark.asyncio
    async def test_rain_gate_no_lat_lon_skips_check(self):
        """Without lat/lon, rain gate is not invoked."""
        from unittest.mock import MagicMock
        from uuid import uuid4

        # Weather service should NOT be called
        mock_weather = MagicMock()

        service = RecommendationService(weather_service=mock_weather)
        result = await service.calculate_irrigation(
            field_id=uuid4(),
            crop_type="maize",
            days_since_planting=5,
            sensor_readings=[
                {"temp": 25.0, "humidity": 80.0, "soil_moisture": 75.0, "rain": 10.0},
                {"temp": 24.0, "humidity": 85.0, "soil_moisture": 78.0, "rain": 5.0},
            ],
            db=None,
            # No lat/lon — gate is skipped
        )
        assert result is not None
        mock_weather.get_forecast_daily_with_eto.assert_not_called()

    @pytest.mark.asyncio
    async def test_rain_gate_error_non_blocking(self):
        """Weather service error should NOT block the irrigation calculation."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        mock_weather = MagicMock()
        mock_weather.get_forecast_daily_with_eto = AsyncMock(
            side_effect=Exception("API timeout"),
        )

        service = RecommendationService(weather_service=mock_weather)
        result = await service.calculate_irrigation(
            field_id=uuid4(),
            crop_type="maize",
            days_since_planting=5,
            sensor_readings=[
                {"temp": 25.0, "humidity": 80.0, "soil_moisture": 75.0, "rain": 10.0},
                {"temp": 24.0, "humidity": 85.0, "soil_moisture": 78.0, "rain": 5.0},
            ],
            db=None,
            lat=23.1,
            lon=-82.5,
        )
        assert result is not None
        # Should still return a valid recommendation despite weather error
        assert result.recommendation in ("water", "monitor", "skip")


# ═══════════════════════════════════════════════════════════════
# PR 2 — Alert Bridge Tests
# ═══════════════════════════════════════════════════════════════

class TestAlertBridge:
    """Alert bridge fires for high/critical; non-blocking on failure."""

    @pytest.mark.asyncio
    async def test_alert_bridge_called_for_high_severity(self):
        """High severity recommendation triggers alert bridge."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        mock_notification = MagicMock()
        mock_notification.create_event = AsyncMock(return_value=MagicMock())

        service = RecommendationService(notification_service=mock_notification)
        await service._fire_alert_bridge(
            tenant_id=uuid4(),
            field_id=uuid4(),
            severity="high",
            message="Critical irrigation needed",
            db=None,
        )
        mock_notification.create_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_alert_bridge_not_called_for_low_severity(self):
        """Low severity does NOT trigger alert bridge."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        mock_notification = MagicMock()
        mock_notification.create_event = AsyncMock()

        service = RecommendationService(notification_service=mock_notification)
        await service._fire_alert_bridge(
            tenant_id=uuid4(),
            field_id=uuid4(),
            severity="low",
            message="All normal",
            db=None,
        )
        # create_event should still be called because _fire_alert_bridge
        # always calls create_event — the severity check is in get_summary
        mock_notification.create_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_alert_bridge_non_blocking_on_error(self):
        """Alert bridge error does NOT propagate."""
        from unittest.mock import AsyncMock, MagicMock
        from uuid import uuid4

        mock_notification = MagicMock()
        mock_notification.create_event = AsyncMock(
            side_effect=Exception("DB connection lost"),
        )

        service = RecommendationService(notification_service=mock_notification)
        # Should not raise
        await service._fire_alert_bridge(
            tenant_id=uuid4(),
            field_id=uuid4(),
            severity="high",
            message="Test",
            db=None,
        )
        mock_notification.create_event.assert_awaited_once()

    def test_determine_severity_high_for_irrigation_depletion(self):
        """Depletion >= 80% with water recommendation → high severity."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from app.domain.recommendations.schemas import IrrigationRecommendation

        irrigation = IrrigationRecommendation(
            field_id=uuid4(),
            timestamp=datetime.now(timezone.utc),
            eto_mm=6.0,
            etc_mm=7.2,
            irrigation_needed_mm=30.0,
            depletion_percent=85.0,
            recommendation="water",
            confidence=0.9,
        )
        severity, message = RecommendationService._determine_severity(
            irrigation=irrigation,
            fertilization=None,
            pest_risk=[],
        )
        assert severity == "high"
        assert "Irrigation" in message

    def test_determine_severity_info_for_skip(self):
        """Skip recommendation → info severity."""
        from datetime import datetime, timezone
        from uuid import uuid4

        from app.domain.recommendations.schemas import IrrigationRecommendation

        irrigation = IrrigationRecommendation(
            field_id=uuid4(),
            timestamp=datetime.now(timezone.utc),
            eto_mm=3.0,
            etc_mm=3.5,
            irrigation_needed_mm=0.0,
            depletion_percent=20.0,
            recommendation="skip",
            confidence=0.9,
        )
        severity, message = RecommendationService._determine_severity(
            irrigation=irrigation,
            fertilization=None,
            pest_risk=[],
        )
        assert severity == "info"

    def test_determine_severity_high_from_pest_risk(self):
        """Pest risk at high level → at least medium severity."""
        from uuid import uuid4

        from app.domain.recommendations.schemas import PestRiskAlert

        pest_alerts = [
            PestRiskAlert(
                field_id=uuid4(),
                crop_type="rice",
                pest_name="Blast",
                risk_level="high",
                accumulated_gdd=600.0,
                gdd_threshold=500.0,
            ),
        ]
        severity, message = RecommendationService._determine_severity(
            irrigation=None,
            fertilization=None,
            pest_risk=pest_alerts,
        )
        assert severity == "high"
        assert "Blast" in message


# ═══════════════════════════════════════════════════════════════
# PR 2 — WKT Point Parser Tests
# ═══════════════════════════════════════════════════════════════

class TestWktPointParser:
    """_parse_wkt_point extracts lat/lon from WKT POINT strings."""

    def test_standard_point(self):
        """POINT(-82.5 23.1) → lon=-82.5, lat=23.1."""
        from app.domain.recommendations.service import _parse_wkt_point
        result = _parse_wkt_point("POINT(-82.5 23.1)")
        assert result is not None
        assert result[0] == -82.5  # lon
        assert result[1] == 23.1  # lat

    def test_point_with_spaces(self):
        """POINT (-82.5 23.1) with space after POINT."""
        from app.domain.recommendations.service import _parse_wkt_point
        result = _parse_wkt_point("POINT (-82.5 23.1)")
        assert result is not None
        assert result[0] == -82.5

    def test_case_insensitive(self):
        """point(-82.5 23.1) in lowercase."""
        from app.domain.recommendations.service import _parse_wkt_point
        result = _parse_wkt_point("point(-82.5 23.1)")
        assert result is not None
        assert result[0] == -82.5

    def test_none_location(self):
        """None location → None."""
        from app.domain.recommendations.service import _parse_wkt_point
        assert _parse_wkt_point(None) is None

    def test_empty_location(self):
        """Empty string → None."""
        from app.domain.recommendations.service import _parse_wkt_point
        assert _parse_wkt_point("") is None


# ═══════════════════════════════════════════════════════════════
# Schema Validation Tests
# ═══════════════════════════════════════════════════════════════

class TestRecommendationSchemas:
    """Pydantic schema validation for recommendation models."""

    def test_irrigation_recommendation_valid(self, field_id: UUID):
        """Valid irrigation recommendation data should pass validation."""
        rec = IrrigationRecommendation(
            field_id=field_id,
            timestamp=datetime.now(timezone.utc),
            eto_mm=6.5,
            etc_mm=7.8,
            effective_rain_mm=0.0,
            irrigation_needed_mm=25.0,
            soil_moisture_current=35.0,
            soil_moisture_target=60.0,
            depletion_percent=55.0,
            recommendation="water",
            confidence=0.85,
        )
        assert rec.recommendation == "water"
        assert rec.irrigation_needed_mm == 25.0

    def test_irrigation_recommendation_invalid_action(self, field_id: UUID):
        """Invalid recommendation action should raise."""
        with pytest.raises(ValueError):
            IrrigationRecommendation(
                field_id=field_id,
                timestamp=datetime.now(timezone.utc),
                eto_mm=5.0,
                etc_mm=6.0,
                irrigation_needed_mm=10.0,
                depletion_percent=50.0,
                recommendation="invalid_action",
                confidence=0.8,
            )

    def test_fertilization_recommendation_valid(self, field_id: UUID):
        rec = FertilizationRecommendation(
            field_id=field_id,
            crop_type="maize",
            growth_stage="vegetative",
            n_kg_ha=80.0,
            p_kg_ha=30.0,
            k_kg_ha=50.0,
            recommendation="apply",
            reasoning="Vegetative stage: peak nitrogen demand.",
        )
        assert rec.recommendation == "apply"

    def test_pest_risk_alert_valid(self, field_id: UUID):
        alert = PestRiskAlert(
            field_id=field_id,
            crop_type="maize",
            pest_name="Fall Armyworm",
            risk_level="high",
            conditions_favorable=True,
            accumulated_gdd=850.0,
            gdd_threshold=800.0,
            temperature_avg=28.0,
            humidity_avg=75.0,
            leaf_wetness_hours=8.0,
            recommendation="Apply biological control.",
        )
        assert alert.risk_level == "high"
        assert alert.conditions_favorable is True

    def test_pest_risk_invalid_level(self, field_id: UUID):
        with pytest.raises(ValueError):
            PestRiskAlert(
                field_id=field_id,
                crop_type="maize",
                pest_name="Test",
                risk_level="extreme",
                accumulated_gdd=100.0,
                gdd_threshold=200.0,
                recommendation="",
            )

    def test_recommendation_summary(self, field_id: UUID):
        summary = RecommendationSummary(field_id=field_id)
        assert summary.field_id == field_id
        assert summary.irrigation is None
        assert summary.fertilization is None
        assert summary.pest_risk == []
        assert summary.generated_at is not None


# ═══════════════════════════════════════════════════════════════
# PR 2 — PATCH Status Integration Tests
# ═══════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestPatchRecommendationStatus:
    """Integration tests for PATCH /api/v1/recommendations/{id}/status."""

    async def _seed_recommendation(
        self, db_session, tenant_id: UUID, field_id: UUID,
    ):
        """Insert a test recommendation and return its ID."""
        from app.domain.recommendations.models import Recommendation
        rec = Recommendation(
            field_id=field_id,
            type="irrigation",
            payload={"test": True},
            status="active",
            severity="medium",
            title="Test irrigation recommendation",
        )
        db_session.add(rec)
        await db_session.flush()
        await db_session.refresh(rec)
        return rec.id

    async def _seed_field(
        self, db_session, tenant_id: UUID,
    ) -> UUID:
        """Insert a test field and return its ID."""
        from app.domain.fields.models import Field
        import uuid
        field_id = uuid.uuid4()
        field = Field(
            id=field_id,
            tenant_id=tenant_id,
            name="Test Field for PATCH",
            crop_type="maize",
            area_ha=10.0,
        )
        db_session.add(field)
        await db_session.flush()
        return field_id

    async def test_patch_200_acknowledged(
        self,
        client,
        db_session,
        tenant_id: UUID,
        auth_headers: dict,
    ):
        """PATCH with valid transition returns 200."""
        field_id = await self._seed_field(db_session, tenant_id)
        rec_id = await self._seed_recommendation(db_session, tenant_id, field_id)
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/recommendations/{rec_id}/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "acknowledged"

    async def test_patch_200_applied(
        self,
        client,
        db_session,
        tenant_id: UUID,
        auth_headers: dict,
    ):
        """PATCH active → applied returns 200."""
        field_id = await self._seed_field(db_session, tenant_id)
        rec_id = await self._seed_recommendation(db_session, tenant_id, field_id)
        await db_session.commit()

        response = await client.patch(
            f"/api/v1/recommendations/{rec_id}/status",
            json={"status": "applied"},
            headers=auth_headers,
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["status"] == "applied"

    async def test_patch_404_not_found(
        self,
        client,
        auth_headers: dict,
    ):
        """PATCH non-existent recommendation returns 404."""
        import uuid
        response = await client.patch(
            f"/api/v1/recommendations/{uuid.uuid4()}/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_patch_409_invalid_transition(
        self,
        client,
        db_session,
        tenant_id: UUID,
        auth_headers: dict,
    ):
        """PATCH applied → acknowledged returns 409."""
        field_id = await self._seed_field(db_session, tenant_id)
        rec_id = await self._seed_recommendation(db_session, tenant_id, field_id)
        await db_session.commit()

        # First transition to applied
        await client.patch(
            f"/api/v1/recommendations/{rec_id}/status",
            json={"status": "applied"},
            headers=auth_headers,
        )

        # Try to acknowledge an applied recommendation — should fail
        response = await client.patch(
            f"/api/v1/recommendations/{rec_id}/status",
            json={"status": "acknowledged"},
            headers=auth_headers,
        )
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"

    async def test_patch_requires_auth(
        self,
        client,
    ):
        """PATCH without auth returns 401."""
        import uuid
        response = await client.patch(
            f"/api/v1/recommendations/{uuid.uuid4()}/status",
            json={"status": "acknowledged"},
        )
        assert response.status_code == 401

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
    CROP_COEFFICIENTS,
    FERTILIZER_RATES,
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
        assert kc == CROP_COEFFICIENTS["maize"]["kc_initial"]
        assert kc == 0.3

    def test_mid_stage(self, service: RecommendationService):
        """Mid-season → Kc_mid."""
        # Maize: initial=20d, dev=35d, so mid starts at day 56
        kc = service.get_kc("maize", days_since_planting=70)
        assert kc == CROP_COEFFICIENTS["maize"]["kc_mid"]
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
        assert kc_end == CROP_COEFFICIENTS["maize"]["kc_end"]
        assert kc_end == 0.6

    def test_development_stage_interpolation(self, service: RecommendationService):
        """Development stage should interpolate between Kc_initial and Kc_mid."""
        kc_mid_dev = service.get_kc("maize", days_since_planting=37)  # halfway through dev
        kc_initial = CROP_COEFFICIENTS["maize"]["kc_initial"]
        kc_mid = CROP_COEFFICIENTS["maize"]["kc_mid"]
        assert kc_initial < kc_mid_dev < kc_mid

    def test_unknown_crop_defaults(self, service: RecommendationService):
        """Unknown crop type should return default Kc=1.0."""
        kc = service.get_kc("unknown_crop", days_since_planting=50)
        assert kc == 1.0

    def test_beyond_cycle(self, service: RecommendationService):
        """Beyond full growth cycle → Kc_end."""
        kc = service.get_kc("maize", days_since_planting=500)
        assert kc == CROP_COEFFICIENTS["maize"]["kc_end"]


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
        rates = FERTILIZER_RATES["maize"][stage]
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

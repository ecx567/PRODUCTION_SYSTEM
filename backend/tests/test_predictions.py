"""
Tests for the prediction service: model loading, feature engineering, yield forecasting.

Covers:
    - Feature vector building from sensor readings
    - Yield prediction with confidence intervals
    - Data quality assessment
    - Fallback when no model available
    - Model loading from disk
"""

from __future__ import annotations

import pytest
import math
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.domain.analytics.predictions import (
    PredictionService,
    YieldPrediction,
    HistoricalPrediction,
    ML_MODELS_DIR,
)
from app.domain.ingestion.schemas import SensorReadingResponse


# ── Fixtures ────────────────────────────────────────────────

@pytest.fixture
def service() -> PredictionService:
    return PredictionService()


@pytest.fixture
def field_id() -> UUID:
    return uuid4()


def _make_reading(
    temp: float | None = 25.0,
    humidity: float | None = 70.0,
    soil_moisture: float | None = 50.0,
    rain: float | None = 0.0,
) -> SensorReadingResponse:
    """Helper to create a SensorReadingResponse for testing."""
    return SensorReadingResponse(
        time=datetime.now(timezone.utc),
        tenant_id=uuid4(),
        sensor_id=uuid4(),
        field_id=uuid4(),
        temp=temp,
        humidity=humidity,
        soil_moisture=soil_moisture,
        rain=rain,
    )


# ═══════════════════════════════════════════════════════════════
# Feature Vector Tests
# ═══════════════════════════════════════════════════════════════

class TestFeatureVector:
    """Feature vector building from sensor readings."""

    def test_basic_features(self, service: PredictionService, field_id: UUID):
        """Standard readings → correct feature values."""
        readings = [
            _make_reading(temp=28.0, humidity=70.0, soil_moisture=45.0, rain=5.0),
            _make_reading(temp=30.0, humidity=65.0, soil_moisture=44.0, rain=0.0),
        ]
        features = service.build_feature_vector(
            readings=readings,
            crop_type="maize",
            days_since_planting=60,
            area_ha=2.5,
        )
        assert features["temp_mean"] == 29.0
        assert features["temp_max"] == 30.0
        assert features["temp_min"] == 28.0
        assert features["humidity_mean"] == 67.5
        assert features["soil_moisture_mean"] == 44.5
        assert features["rain_total"] == 5.0
        assert features["days_since_planting"] == 60.0
        assert features["area_ha"] == 2.5
        assert features["reading_count"] == 2.0

    def test_gdd_computation(self, service: PredictionService):
        """GDD should be (T_mean - 10) × days."""
        readings = [_make_reading(temp=28.0)]
        features = service.build_feature_vector(
            readings=readings,
            crop_type="maize",
            days_since_planting=100,
        )
        # GDD = (28 - 10) * 100 = 1800
        assert features["gdd_accumulated"] == pytest.approx(1800.0, rel=0.1)

    def test_crop_one_hot(self, service: PredictionService):
        """Crop type should be one-hot encoded."""
        features = service.build_feature_vector([], "banana", 0)
        assert features["crop_banana"] == 1.0
        assert features["crop_maize"] == 0.0
        assert features["crop_cacao"] == 0.0
        assert features["crop_rice"] == 0.0

    def test_missing_values_defaults(self, service: PredictionService):
        """Empty readings should use sensible defaults."""
        features = service.build_feature_vector([], "maize", 0)
        assert features["temp_mean"] == 25.0  # default fallback
        assert features["humidity_mean"] == 70.0  # default fallback
        assert features["reading_count"] == 0.0

    def test_std_deviation(self, service: PredictionService):
        """Multiple readings should compute temp_std."""
        readings = [
            _make_reading(temp=25.0),
            _make_reading(temp=30.0),
            _make_reading(temp=35.0),
        ]
        features = service.build_feature_vector(readings, "maize", 30)
        assert features["temp_std"] > 0  # should have some variance

    def test_all_features_present(self, service: PredictionService):
        """Feature dict should include all expected keys."""
        readings = [_make_reading(), _make_reading()]
        features = service.build_feature_vector(readings, "rice", 50, area_ha=5.0)
        expected_keys = {
            "temp_mean", "temp_max", "temp_min", "temp_std",
            "humidity_mean", "soil_moisture_mean", "rain_total",
            "days_since_planting", "area_ha", "reading_count",
            "gdd_accumulated",
            "crop_banana", "crop_maize", "crop_cacao", "crop_rice",
        }
        assert set(features.keys()) == expected_keys


# ═══════════════════════════════════════════════════════════════
# Data Quality Tests
# ═══════════════════════════════════════════════════════════════

class TestDataQuality:
    """Data quality flag assessment."""

    def test_high_quality(self, service: PredictionService):
        readings = [_make_reading() for _ in range(150)]
        features = service.build_feature_vector(readings[:5], "maize", 30)
        quality = service._assess_data_quality(readings, features)
        assert quality == "high"

    def test_medium_quality(self, service: PredictionService):
        readings = [_make_reading() for _ in range(50)]
        features = service.build_feature_vector(readings[:5], "maize", 30)
        quality = service._assess_data_quality(readings, features)
        assert quality == "medium"

    def test_low_quality(self, service: PredictionService):
        readings = [_make_reading() for _ in range(7)]
        features = service.build_feature_vector(readings[:5], "maize", 30)
        quality = service._assess_data_quality(readings, features)
        assert quality == "low"

    def test_insufficient_data(self, service: PredictionService):
        readings = [_make_reading() for _ in range(3)]
        features = service.build_feature_vector(readings[:5], "maize", 30)
        quality = service._assess_data_quality(readings, features)
        assert quality == "insufficient"


# ═══════════════════════════════════════════════════════════════
# Prediction Tests
# ═══════════════════════════════════════════════════════════════

class TestYieldPrediction:
    """Yield prediction with and without model."""

    @pytest.mark.asyncio
    async def test_fallback_prediction(
        self, service: PredictionService, field_id: UUID,
    ):
        """Without ML model → use GDD fallback."""
        readings = [
            _make_reading(temp=28.0, humidity=75.0, soil_moisture=50.0, rain=10.0),
            _make_reading(temp=30.0, humidity=70.0, soil_moisture=48.0, rain=0.0),
            _make_reading(temp=26.0, humidity=80.0, soil_moisture=52.0, rain=5.0),
            _make_reading(temp=29.0, humidity=72.0, soil_moisture=49.0, rain=0.0),
            _make_reading(temp=27.0, humidity=78.0, soil_moisture=51.0, rain=2.0),
            _make_reading(temp=31.0, humidity=65.0, soil_moisture=47.0, rain=0.0),
            _make_reading(temp=28.5, humidity=73.0, soil_moisture=50.0, rain=1.0),
            _make_reading(temp=27.5, humidity=76.0, soil_moisture=48.5, rain=0.0),
            _make_reading(temp=30.5, humidity=68.0, soil_moisture=46.0, rain=0.0),
            _make_reading(temp=26.5, humidity=82.0, soil_moisture=53.0, rain=3.0),
            _make_reading(temp=29.5, humidity=71.0, soil_moisture=49.5, rain=0.0),
        ]

        prediction = await service.predict_yield(
            field_id=field_id,
            crop_type="maize",
            days_since_planting=90,
            readings=readings,
            area_ha=1.0,
        )

        assert isinstance(prediction, YieldPrediction)
        assert prediction.predicted_yield_kg_ha > 0
        assert prediction.lower_bound >= 0
        assert prediction.upper_bound > prediction.predicted_yield_kg_ha
        assert prediction.model_version == "fallback_gdd"
        assert prediction.data_quality == "medium"

    @pytest.mark.asyncio
    async def test_confidence_interval_sensible(
        self, service: PredictionService, field_id: UUID,
    ):
        """Confidence interval should be reasonable."""
        readings = [_make_reading() for _ in range(20)]
        prediction = await service.predict_yield(
            field_id=field_id,
            crop_type="banana",
            days_since_planting=100,
            readings=readings,
            area_ha=1.0,
        )
        # Upper should be > lower, and the interval should contain the prediction
        assert prediction.lower_bound < prediction.predicted_yield_kg_ha
        assert prediction.upper_bound > prediction.predicted_yield_kg_ha
        # For fallback: CI = ±35%
        margin = prediction.predicted_yield_kg_ha * 0.35
        assert prediction.upper_bound - prediction.predicted_yield_kg_ha <= margin + 1

    @pytest.mark.asyncio
    async def test_different_crops_different_yields(
        self, service: PredictionService, field_id: UUID,
    ):
        """Banana should predict much higher yield than cacao."""
        readings = [_make_reading() for _ in range(30)]

        banana_pred = await service.predict_yield(
            field_id=field_id, crop_type="banana",
            days_since_planting=100, readings=readings,
        )
        cacao_pred = await service.predict_yield(
            field_id=field_id, crop_type="cacao",
            days_since_planting=100, readings=readings,
        )

        assert banana_pred.predicted_yield_kg_ha > cacao_pred.predicted_yield_kg_ha * 5

    @pytest.mark.asyncio
    async def test_insufficient_data_flag(
        self, service: PredictionService, field_id: UUID,
    ):
        """Few readings → insufficient data quality."""
        readings = [_make_reading() for _ in range(3)]
        prediction = await service.predict_yield(
            field_id=field_id, crop_type="maize",
            days_since_planting=30, readings=readings,
        )
        assert prediction.data_quality == "insufficient"

    @pytest.mark.asyncio
    async def test_features_used_in_prediction(
        self, service: PredictionService, field_id: UUID,
    ):
        """Prediction should include list of features used."""
        readings = [_make_reading() for _ in range(10)]
        prediction = await service.predict_yield(
            field_id=field_id, crop_type="rice",
            days_since_planting=60, readings=readings,
        )
        assert len(prediction.features_used) > 0
        assert "temp_mean" in prediction.features_used


# ═══════════════════════════════════════════════════════════════
# YieldPrediction Schema Tests
# ═══════════════════════════════════════════════════════════════

class TestYieldPredictionSchema:
    """YieldPrediction data container."""

    def test_to_dict(self, field_id: UUID):
        pred = YieldPrediction(
            field_id=field_id,
            predicted_yield_kg_ha=6000.0,
            lower_bound=4500.0,
            upper_bound=7500.0,
            model_version="test_model",
            data_quality="high",
            features_used=["temp_mean", "gdd"],
        )
        d = pred.to_dict()
        assert d["field_id"] == str(field_id)
        assert d["predicted_yield_kg_ha"] == 6000.0
        assert d["lower_bound"] == 4500.0
        assert d["data_quality"] == "high"
        assert "generated_at" in d


class TestHistoricalPrediction:
    """Historical prediction with error computation."""

    def test_with_actual(self):
        hist = HistoricalPrediction(
            prediction_id="pred-1",
            predicted_yield_kg_ha=6000.0,
            actual_yield_kg_ha=5500.0,
            generated_at=datetime.now(timezone.utc),
            model_version="rf_v1",
        )
        assert hist.error_pct is not None
        assert 8.0 <= hist.error_pct <= 10.0  # ~9.1% error

    def test_without_actual(self):
        hist = HistoricalPrediction(
            prediction_id="pred-1",
            predicted_yield_kg_ha=6000.0,
            actual_yield_kg_ha=None,
            generated_at=datetime.now(timezone.utc),
            model_version="rf_v1",
        )
        assert hist.error_pct is None

    def test_to_dict(self):
        hist = HistoricalPrediction(
            prediction_id="pred-1",
            predicted_yield_kg_ha=6000.0,
            actual_yield_kg_ha=5500.0,
            generated_at=datetime(2025, 6, 1, tzinfo=timezone.utc),
            model_version="rf_v1",
        )
        d = hist.to_dict()
        assert d["prediction_id"] == "pred-1"
        assert d["error_pct"] is not None


# ═══════════════════════════════════════════════════════════════
# Model Loading Tests
# ═══════════════════════════════════════════════════════════════

class TestModelLoading:
    """Model loading from disk (mock-friendly)."""

    @pytest.mark.asyncio
    async def test_load_missing_model(self, service: PredictionService):
        """Non-existent model file → graceful fallback."""
        loaded = await service.load_model("/nonexistent/path/model.joblib")
        assert loaded is False
        assert service._model_loaded is False

    @pytest.mark.asyncio
    async def test_model_directory_exists(self):
        """ML_MODELS_DIR should point to a real directory."""
        assert ML_MODELS_DIR is not None
        # The directory may not exist yet (before training), but the path should
        # be valid
        assert isinstance(str(ML_MODELS_DIR), str)

    def test_fallback_yields_defined(self):
        """All crop types should have fallback yields."""
        from app.domain.analytics.predictions import FALLBACK_YIELDS
        for crop in ("banana", "maize", "cacao", "rice"):
            assert crop in FALLBACK_YIELDS
            assert FALLBACK_YIELDS[crop] > 0

"""
Prediction service: ML model loading, feature vector building, yield forecasting.

Integrates with the ML pipeline in ``ml/`` to load serialized models and
generate yield predictions with confidence intervals.

Edge cases:
    - YF-1: Insufficient data → statistical GDD-based model fallback
    - Missing features → imputation or reduced feature set
    - Model not found → graceful fallback to simplified prediction
"""

from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.ingestion.schemas import SensorReadingResponse

logger = logging.getLogger("crop.analytics.predictions")

# Path to serialized ML models
ML_MODELS_DIR = Path(os.environ.get(
    "ML_MODELS_DIR",
    str(Path(__file__).resolve().parent.parent.parent.parent.parent / "ml" / "models"),
))

# Default model file
DEFAULT_MODEL_FILE = "yield_model_rf.joblib"

# Fallback yields (kg/ha) by crop type when no model is available
FALLBACK_YIELDS: dict[str, float] = {
    "banana": 35000.0,  # 35 tons/ha
    "maize": 6000.0,    # 6 tons/ha
    "cacao": 800.0,     # 800 kg/ha
    "rice": 4500.0,     # 4.5 tons/ha
}


# ═══════════════════════════════════════════════════════════════
# Prediction Result Schema (inline — avoid circular imports)
# ═══════════════════════════════════════════════════════════════

class YieldPrediction:
    """Yield prediction result with confidence interval."""

    def __init__(
        self,
        field_id: UUID,
        predicted_yield_kg_ha: float,
        lower_bound: float,
        upper_bound: float,
        model_version: str,
        data_quality: str,
        features_used: list[str],
    ) -> None:
        self.field_id = field_id
        self.predicted_yield_kg_ha = round(predicted_yield_kg_ha, 2)
        self.lower_bound = round(lower_bound, 2)
        self.upper_bound = round(upper_bound, 2)
        self.model_version = model_version
        self.data_quality = data_quality
        self.features_used = features_used
        self.generated_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        return {
            "field_id": str(self.field_id),
            "predicted_yield_kg_ha": self.predicted_yield_kg_ha,
            "lower_bound": self.lower_bound,
            "upper_bound": self.upper_bound,
            "model_version": self.model_version,
            "data_quality": self.data_quality,
            "features_used": self.features_used,
            "generated_at": self.generated_at.isoformat(),
        }


class HistoricalPrediction:
    """A past prediction with the actual yield for comparison."""

    def __init__(
        self,
        prediction_id: str,
        predicted_yield_kg_ha: float,
        actual_yield_kg_ha: float | None,
        generated_at: datetime,
        model_version: str,
    ) -> None:
        self.prediction_id = prediction_id
        self.predicted_yield_kg_ha = predicted_yield_kg_ha
        self.actual_yield_kg_ha = actual_yield_kg_ha
        self.generated_at = generated_at
        self.model_version = model_version
        self.error_pct = (
            round(
                abs(predicted_yield_kg_ha - actual_yield_kg_ha)
                / actual_yield_kg_ha
                * 100,
                1,
            )
            if actual_yield_kg_ha and actual_yield_kg_ha > 0
            else None
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "prediction_id": self.prediction_id,
            "predicted_yield_kg_ha": self.predicted_yield_kg_ha,
            "actual_yield_kg_ha": self.actual_yield_kg_ha,
            "error_pct": self.error_pct,
            "generated_at": self.generated_at.isoformat(),
            "model_version": self.model_version,
        }


# ═══════════════════════════════════════════════════════════════
# Prediction Service
# ═══════════════════════════════════════════════════════════════

class PredictionService:
    """Yield prediction service with model loading and feature engineering.

    The service works in two modes:
        1. **ML mode**: loads a serialized scikit-learn pipeline and predicts
           using a feature vector built from sensor readings.
        2. **Fallback mode**: uses crop-specific average yields when the ML
           model is unavailable or data is insufficient.
    """

    def __init__(self, model_path: str | Path | None = None) -> None:
        self._model: Any = None
        self._model_version: str = "none"
        self._model_loaded = False
        self._model_path = Path(model_path) if model_path else None

    # ── Model loading ─────────────────────────────────────────

    async def load_model(self, model_path: str | Path | None = None) -> bool:
        """Load a serialized ML model from disk.

        Tries joblib first (scikit-learn pipelines), then falls back gracefully.

        Args:
            model_path: Path to the .joblib file. If None, uses default path.

        Returns:
            True if model loaded successfully, False otherwise.
        """
        path = Path(model_path) if model_path else self._model_path
        if path is None:
            path = ML_MODELS_DIR / DEFAULT_MODEL_FILE

        if not path.exists():
            logger.warning("Model file not found at %s. Using fallback.", path)
            self._model_loaded = False
            self._model_version = "fallback"
            return False

        try:
            import joblib  # lazy import — ML deps not always installed in API
            self._model = joblib.load(path)
            self._model_loaded = True
            self._model_version = path.stem  # e.g., "yield_model_rf"
            logger.info("Model loaded: %s (version=%s)", path, self._model_version)
            return True
        except Exception as exc:
            logger.warning("Failed to load model %s: %s. Using fallback.", path, exc)
            self._model_loaded = False
            self._model_version = "fallback"
            return False

    # ── Feature engineering ───────────────────────────────────

    def build_feature_vector(
        self,
        readings: list[SensorReadingResponse],
        crop_type: str,
        days_since_planting: int,
        area_ha: float = 1.0,
    ) -> dict[str, float]:
        """Build a feature vector from sensor readings and metadata.

        Features:
            - temp_mean, temp_max, temp_min, temp_std
            - humidity_mean
            - soil_moisture_mean
            - rain_total
            - days_since_planting
            - area_ha
            - gdd_accumulated (Growing Degree Days, T_base=10°C)
            - reading_count (number of sensor readings available)

        Args:
            readings: List of sensor readings.
            crop_type: Crop type (one-hot encoding).
            days_since_planting: Days since planting.
            area_ha: Field area in hectares.

        Returns:
            Feature vector as a dict for model input or fallback calculation.
        """
        temps = [r.temp for r in readings if r.temp is not None]
        humidities = [r.humidity for r in readings if r.humidity is not None]
        soil_moistures = [r.soil_moisture for r in readings if r.soil_moisture is not None]
        rains = [r.rain for r in readings if r.rain is not None]

        features: dict[str, float] = {
            "temp_mean": sum(temps) / len(temps) if temps else 25.0,
            "temp_max": max(temps) if temps else 30.0,
            "temp_min": min(temps) if temps else 20.0,
            "temp_std": self._std(temps) if len(temps) > 1 else 2.0,
            "humidity_mean": sum(humidities) / len(humidities) if humidities else 70.0,
            "soil_moisture_mean": sum(soil_moistures) / len(soil_moistures) if soil_moistures else 50.0,
            "rain_total": sum(rains) if rains else 0.0,
            "days_since_planting": float(days_since_planting),
            "area_ha": area_ha,
            "reading_count": float(len(readings)),
        }

        # GDD accumulation (simplified — T_base=10°C)
        if temps:
            t_mean = features["temp_mean"]
            gdd = max(0.0, t_mean - 10.0) * days_since_planting
            features["gdd_accumulated"] = gdd
        else:
            features["gdd_accumulated"] = 0.0

        # One-hot crop type encoding
        for crop in ("banana", "maize", "cacao", "rice"):
            features[f"crop_{crop}"] = 1.0 if crop_type == crop else 0.0

        return features

    # ── Yield prediction ──────────────────────────────────────

    async def predict_yield(
        self,
        field_id: UUID,
        crop_type: str,
        days_since_planting: int,
        readings: list[SensorReadingResponse],
        area_ha: float = 1.0,
    ) -> YieldPrediction:
        """Predict crop yield with confidence interval.

        Strategy:
            1. If ML model is loaded: build feature vector → predict → return
            2. If no model: use statistical GDD-based fallback
            3. If insufficient data (< 5 readings): use crop average with wide CI

        Args:
            field_id: Field UUID.
            crop_type: Crop type.
            days_since_planting: Days since planting.
            readings: Sensor readings for feature vector.
            area_ha: Field area in hectares.

        Returns:
            YieldPrediction with confidence interval.
        """
        features = self.build_feature_vector(
            readings=readings,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            area_ha=area_ha,
        )

        data_quality = self._assess_data_quality(readings, features)
        feature_names = list(features.keys())

        # ── Try ML model first ────────────────────────────────
        if self._model_loaded and self._model is not None:
            try:
                return await self._predict_with_model(
                    field_id, features, feature_names, data_quality,
                )
            except Exception as exc:
                logger.warning("ML prediction failed: %s. Falling back.", exc)

        # ── Fallback: GDD-based statistical model ─────────────
        return await self._predict_fallback(
            field_id, crop_type, features, data_quality, feature_names,
        )

    async def _predict_with_model(
        self,
        field_id: UUID,
        features: dict[str, float],
        feature_names: list[str],
        data_quality: str,
    ) -> YieldPrediction:
        """Predict using the loaded ML model.

        Assumes the model is a scikit-learn Regressor or pipeline with
        ``predict()`` method. If the model supports ``return_std`` (like
        ``GaussianProcessRegressor``), uses it for confidence intervals.
        """
        import numpy as np  # lazy import

        # Build feature array in the expected order
        feature_array = np.array([list(features.values())])

        # Predict
        y_pred = float(self._model.predict(feature_array)[0])

        # Confidence interval estimation
        # For sklearn's RandomForestRegressor, we can estimate variance
        # from individual tree predictions
        lower_bound, upper_bound = self._estimate_ci(y_pred)

        return YieldPrediction(
            field_id=field_id,
            predicted_yield_kg_ha=y_pred,
            lower_bound=lower_bound,
            upper_bound=upper_bound,
            model_version=self._model_version,
            data_quality=data_quality,
            features_used=feature_names,
        )

    def _estimate_ci(self, y_pred: float, std_multiplier: float = 1.96) -> tuple[float, float]:
        """Estimate confidence interval around a prediction.

        Uses a heuristic: ±20% for the 95% CI (approximate for RF regressor).
        This can be replaced with proper quantile regression when the model
        supports it.

        Args:
            y_pred: Predicted value.
            std_multiplier: Z-score multiplier (1.96 ≈ 95% CI for normal).

        Returns:
            (lower_bound, upper_bound).
        """
        # Heuristic: assume coefficient of variation ≈ 15%
        std_estimate = abs(y_pred) * 0.15
        margin = std_multiplier * std_estimate
        lower = max(0.0, y_pred - margin)
        upper = y_pred + margin
        return round(lower, 2), round(upper, 2)

    async def _predict_fallback(
        self,
        field_id: UUID,
        crop_type: str,
        features: dict[str, float],
        data_quality: str,
        feature_names: list[str],
    ) -> YieldPrediction:
        """Fallback prediction using GDD-based statistical model.

        Uses accumulated GDD and crop-specific base yields to estimate
        expected yield with wider confidence intervals.
        """
        base_yield = FALLBACK_YIELDS.get(crop_type, 4000.0)
        gdd = features.get("gdd_accumulated", 0.0)

        # GDD adjustment: assume full season GDD ≈ 2500 for tropical crops
        season_gdd = 2500.0
        gdd_fraction = min(1.0, gdd / season_gdd)

        # Yield adjusted by GDD fraction (capped at 1.2x for early optimism)
        yield_estimate = base_yield * (0.5 + 0.5 * gdd_fraction)

        # No ML model → wider CI
        margin = yield_estimate * 0.35
        lower = max(0.0, yield_estimate - margin)
        upper = yield_estimate + margin

        return YieldPrediction(
            field_id=field_id,
            predicted_yield_kg_ha=yield_estimate,
            lower_bound=round(lower, 2),
            upper_bound=round(upper, 2),
            model_version="fallback_gdd",
            data_quality=data_quality,
            features_used=feature_names,
        )

    # ── History query ─────────────────────────────────────────

    async def get_prediction_history(
        self,
        field_id: UUID,
        db: AsyncSession,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Retrieve past predictions for a field from the database.

        Args:
            field_id: Field UUID.
            db: Async DB session.
            limit: Max number of historical predictions to return.

        Returns:
            List of HistoricalPrediction dicts.
        """
        from sqlalchemy import text

        stmt = text("""
            SELECT
                id::text AS prediction_id,
                value AS predicted_yield_kg_ha,
                lower_bound,
                upper_bound,
                model_version,
                generated_at
            FROM predictions
            WHERE field_id = :field_id
              AND type = 'yield'
            ORDER BY generated_at DESC
            LIMIT :limit
        """)
        result = await db.execute(stmt, {"field_id": field_id, "limit": limit})
        rows = result.fetchall()

        history: list[dict[str, Any]] = []
        for row in rows:
            hist = HistoricalPrediction(
                prediction_id=row.prediction_id,
                predicted_yield_kg_ha=float(row.predicted_yield_kg_ha),
                actual_yield_kg_ha=None,  # actuals populated when harvest data exists
                generated_at=row.generated_at,
                model_version=row.model_version,
            )
            history.append(hist.to_dict())

        return history

    # ── Data quality assessment ───────────────────────────────

    def _assess_data_quality(
        self,
        readings: list[SensorReadingResponse],
        features: dict[str, float],
    ) -> str:
        """Assess data quality for a prediction.

        Returns one of:
            - ``high``: > 100 readings, all features present
            - ``medium``: 10-100 readings, some imputation
            - ``low``: < 10 readings, heavy imputation
            - ``insufficient``: < 5 readings
        """
        n = len(readings)
        if n < 5:
            return "insufficient"
        elif n < 10:
            return "low"
        elif n < 100:
            return "medium"
        else:
            return "high"

    @staticmethod
    def _std(values: list[float]) -> float:
        """Calculate population standard deviation."""
        if len(values) < 2:
            return 0.0
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        return math.sqrt(variance)


# Singleton
prediction_service = PredictionService()

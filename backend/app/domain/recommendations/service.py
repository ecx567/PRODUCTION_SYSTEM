"""
Recommendation engine: FAO-56 irrigation, split-N fertilization, pest degree-day models.

All services use domain knowledge from:
    - FAO-56 Irrigation and Drainage Paper (Allen et al., 1998)
    - Split-N fertilizer scheduling per crop growth stages
    - Degree-day pest emergence models (simplified)

Edge cases (RE-1: missing weather data):
    - Short gaps (< 6h): forward fill from last known value
    - Medium gaps (6-48h): seasonal average interpolation
    - Long gaps (> 48h): return None recommendation with low confidence
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.recommendations.schemas import (
    FertilizationRecommendation,
    IrrigationRecommendation,
    PestRiskAlert,
    RecommendationSummary,
)

logger = logging.getLogger("crop.recommendations.service")

# ── Constants ───────────────────────────────────────────────

# FAO-56 Kc values per crop type and growth stage
# Format: {crop: {"initial": Kc_ini, "mid": Kc_mid, "end": Kc_end, "stage_lengths_days": [ini, dev, mid, late]}}
CROP_COEFFICIENTS: dict[str, dict[str, Any]] = {
    "banana": {
        "kc_initial": 0.5, "kc_mid": 1.2, "kc_end": 1.1,
        "stage_lengths": [120, 90, 120, 60],  # total ~390 days
    },
    "maize": {
        "kc_initial": 0.3, "kc_mid": 1.2, "kc_end": 0.6,
        "stage_lengths": [20, 35, 40, 30],  # total ~125 days
    },
    "cacao": {
        "kc_initial": 0.8, "kc_mid": 1.05, "kc_end": 0.95,
        "stage_lengths": [30, 60, 120, 60],  # total ~270 days
    },
    "rice": {
        "kc_initial": 1.0, "kc_mid": 1.2, "kc_end": 0.8,
        "stage_lengths": [30, 30, 60, 30],  # total ~150 days
    },
}

# Total Available Water (TAW) by soil texture (mm/m)
# Default: medium loam = 150 mm/m
TAW_MM_PER_M: dict[str, float] = {
    "sand": 60, "loamy_sand": 80, "sandy_loam": 100,
    "loam": 150, "silt_loam": 170, "silty_clay_loam": 180,
    "clay_loam": 190, "clay": 200,
}

# Readily Available Water fraction (p) — depletion fraction before stress
# p = 0.5 for most crops (50% of TAW)
RAW_FRACTION: float = 0.5

# Fertilizer removal rates by crop and growth stage (kg/ha)
# Based on standard agronomic recommendations for tropical crops
FERTILIZER_RATES: dict[str, dict[str, dict[str, float]]] = {
    "banana": {
        "planting":    {"n": 30, "p": 40, "k": 60},
        "vegetative":  {"n": 120, "p": 30, "k": 200},
        "reproductive": {"n": 60, "p": 50, "k": 150},
    },
    "maize": {
        "planting":    {"n": 40, "p": 50, "k": 40},
        "vegetative":  {"n": 100, "p": 30, "k": 60},
        "reproductive": {"n": 50, "p": 20, "k": 30},
    },
    "cacao": {
        "planting":    {"n": 20, "p": 30, "k": 50},
        "vegetative":  {"n": 80, "p": 20, "k": 100},
        "reproductive": {"n": 60, "p": 30, "k": 120},
    },
    "rice": {
        "planting":    {"n": 30, "p": 30, "k": 30},
        "vegetative":  {"n": 60, "p": 20, "k": 40},
        "reproductive": {"n": 30, "p": 15, "k": 30},
    },
}

# Pest degree-day thresholds (simplified)
# GDD = sum of max((T_max + T_min)/2 - T_base, 0) for all days since planting
PEST_THRESHOLDS: dict[str, dict[str, Any]] = {
    "Fall Armyworm (Spodoptera frugiperda)": {
        "crop": "maize",
        "gdd_threshold": 800.0,
        "t_base": 10.0,  # base temperature for GDD calculation
        "optimal_temp_min": 20.0,
        "optimal_temp_max": 30.0,
        "requires_leaf_wetness": False,
        "min_humidity": 60.0,
        "recommendation": "Apply biological control (Bacillus thuringiensis) or insecticide if infestation detected. Monitor whorls for larvae.",
    },
    "Black Sigatoka (Mycosphaerella fijiensis)": {
        "crop": "banana",
        "gdd_threshold": 700.0,
        "t_base": 12.0,
        "optimal_temp_min": 22.0,
        "optimal_temp_max": 28.0,
        "requires_leaf_wetness": True,
        "leaf_wetness_hours_min": 6.0,
        "min_humidity": 80.0,
        "recommendation": "Apply protective fungicide (mancozeb or triazole). Improve air circulation by deleafing. Monitor youngest leaf spotted.",
    },
    "Witches' Broom (Moniliophthora perniciosa)": {
        "crop": "cacao",
        "gdd_threshold": 600.0,
        "t_base": 14.0,
        "optimal_temp_min": 22.0,
        "optimal_temp_max": 30.0,
        "requires_leaf_wetness": False,
        "min_humidity": 85.0,
        "recommendation": "Prune infected brooms. Apply copper-based fungicide. Improve canopy ventilation. Remove infected pods.",
    },
    "Blast (Magnaporthe grisea)": {
        "crop": "rice",
        "gdd_threshold": 500.0,
        "t_base": 10.0,
        "optimal_temp_min": 25.0,
        "optimal_temp_max": 28.0,
        "requires_leaf_wetness": True,
        "leaf_wetness_hours_min": 6.0,
        "min_humidity": 90.0,
        "recommendation": "Apply systemic fungicide (tricyclazole or azoxystrobin). Maintain proper water management. Avoid excessive nitrogen.",
    },
}


# ═══════════════════════════════════════════════════════════════
# Missing Data Imputation Helpers
# ═══════════════════════════════════════════════════════════════

def impute_missing_value(
    value: float | None,
    recent_values: list[float | None],
    seasonal_avg: float | None = None,
    gap_hours: float | None = None,
) -> tuple[float | None, float]:
    """Impute a missing sensor value with confidence scoring.

    Strategy (RE-1):
        - Short gap (< 6h): forward fill → high confidence (0.9)
        - Medium gap (6-48h): seasonal average → medium confidence (0.7)
        - Long gap (> 48h): return None with low confidence (0.3)

    Args:
        value: Current value (may be None).
        recent_values: Recent readings (oldest first) for forward fill.
        seasonal_avg: Long-term average for the same time window.
        gap_hours: Estimated gap duration since last valid reading.

    Returns:
        Tuple of (imputed_value or None, confidence 0.0-1.0).
    """
    if value is not None:
        return value, 1.0

    if gap_hours is None:
        gap_hours = 0.0

    # Short gap: forward fill
    if gap_hours < 6.0:
        # Find the most recent non-None value
        for v in reversed(recent_values):
            if v is not None:
                return v, 0.90
        # No valid recent data — try seasonal average
        if seasonal_avg is not None:
            return seasonal_avg, 0.70
        return None, 0.10

    # Medium gap: seasonal average
    if gap_hours <= 48.0:
        if seasonal_avg is not None:
            return seasonal_avg, 0.70
        # No seasonal data — try forward fill anyway with lower confidence
        for v in reversed(recent_values):
            if v is not None:
                return v, 0.50
        return None, 0.10

    # Long gap: insufficient data
    return None, 0.30


# ═══════════════════════════════════════════════════════════════
# Recommendation Service
# ═══════════════════════════════════════════════════════════════

class RecommendationService:
    """Agronomic recommendation engine.

    Provides:
        - FAO-56 irrigation scheduling (Hargreaves ETo method)
        - Split-N fertilization recommendations
        - Pest risk assessment via degree-day models
    """

    # ═══════════════════════════════════════════════════════════
    # FAO-56 Irrigation
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def calculate_eto_hargreaves(
        t_min: float,
        t_max: float,
        t_mean: float,
        ra: float,  # extraterrestrial radiation in MJ/m²/day
    ) -> float:
        """Calculate reference evapotranspiration (ETo) using Hargreaves method.

        The Hargreaves equation (Hargreaves & Samani, 1985):

            ETo = 0.0023 × Ra × (T_mean + 17.8) × sqrt(T_max - T_min)

        Where:
            - ETo = reference evapotranspiration (mm/day)
            - Ra = extraterrestrial radiation (MJ/m²/day)
            - T_mean = mean daily temperature (°C)
            - T_max - T_min = temperature range (°C)

        This method requires only temperature and radiation data, making it
        suitable for stations with limited weather data (unlike Pennman-Monteith
        which needs humidity, wind, and solar radiation).

        Args:
            t_min: Minimum daily temperature (°C).
            t_max: Maximum daily temperature (°C).
            t_mean: Mean daily temperature (°C).
            ra: Extraterrestrial radiation (MJ/m²/day).

        Returns:
            ETo in mm/day.
        """
        if t_max < t_min:
            t_max, t_min = t_min, t_max  # swap if reversed

        temp_diff = t_max - t_min
        if temp_diff < 0.5:
            temp_diff = 0.5  # minimum delta to avoid division issues

        eto = 0.0023 * ra * (t_mean + 17.8) * (temp_diff ** 0.5)
        return max(0.0, round(eto, 2))

    @staticmethod
    def get_kc(crop_type: str, days_since_planting: int) -> float:
        """Get the crop coefficient (Kc) for a given crop and growth stage.

        Uses FAO-56 tabulated Kc values. Growth stages:
            - Initial: from planting to ~10% ground cover
            - Development: from 10% cover to effective full cover
            - Mid-season: from full cover to start of maturity
            - Late-season: from maturity to harvest

        Args:
            crop_type: One of: banana, maize, cacao, rice.
            days_since_planting: Days since crop was planted.

        Returns:
            Kc value for the current growth stage.
        """
        coeff = CROP_COEFFICIENTS.get(crop_type)
        if coeff is None:
            logger.warning("Unknown crop type '%s', using default Kc=1.0", crop_type)
            return 1.0

        stages = coeff["stage_lengths"]
        cumulative = 0

        # Initial stage
        if days_since_planting <= stages[0]:
            return coeff["kc_initial"]

        cumulative += stages[0]

        # Development stage (linear interpolation from Kc_initial to Kc_mid)
        if days_since_planting <= cumulative + stages[1]:
            frac = (days_since_planting - cumulative) / stages[1]
            return round(coeff["kc_initial"] + frac * (coeff["kc_mid"] - coeff["kc_initial"]), 3)

        cumulative += stages[1]

        # Mid-season stage
        if days_since_planting <= cumulative + stages[2]:
            return coeff["kc_mid"]

        cumulative += stages[2]

        # Late-season stage (linear interpolation from Kc_mid to Kc_end)
        if days_since_planting <= cumulative + stages[3]:
            frac = (days_since_planting - cumulative) / stages[3]
            return round(coeff["kc_mid"] + frac * (coeff["kc_end"] - coeff["kc_mid"]), 3)

        # Beyond growth cycle — use Kc_end
        return coeff["kc_end"]

    async def calculate_irrigation(
        self,
        field_id: UUID,
        crop_type: str,
        days_since_planting: int,
        sensor_readings: list[dict[str, Any]],
        db: AsyncSession,
        root_depth_m: float = 0.6,
        soil_texture: str = "loam",
    ) -> IrrigationRecommendation | None:
        """Calculate FAO-56 irrigation recommendation.

        Implements the soil water balance approach:
            1. Calculate ETo (Hargreaves) from temperature data
            2. Get Kc for current growth stage
            3. ETc = ETo × Kc
            4. Effective rainfall (80% of total rain, capped)
            5. Soil water depletion (Dr) from previous balance
            6. Readily Available Water (RAW) = p × TAW
            7. If Dr > RAW → recommend irrigation (water_X_mm)
            8. If Dr > 0.5 × RAW → monitor
            9. Else → skip

        Args:
            field_id: Field UUID.
            crop_type: Crop type for Kc lookup.
            days_since_planting: Days since planting for growth stage.
            sensor_readings: Recent sensor readings (list of dicts with
                            temp, humidity, soil_moisture, rain keys).
            db: Async DB session.
            root_depth_m: Effective root depth in meters.
            soil_texture: Soil texture class for TAW lookup.

        Returns:
            IrrigationRecommendation or None if data insufficient.
        """
        if not sensor_readings:
            logger.warning("No sensor data for irrigation calculation (field=%s)", field_id)
            return None

        # ── Extract and impute weather data ──────────────────
        temps: list[float] = []
        rains: list[float] = []
        soil_moistures: list[float] = []

        for r in sensor_readings:
            t = r.get("temp")
            if t is not None:
                temps.append(t)
            rain = r.get("rain")
            if rain is not None:
                rains.append(rain)
            sm = r.get("soil_moisture")
            if sm is not None:
                soil_moistures.append(sm)

        if not temps:
            logger.warning("No temperature data for irrigation (field=%s)", field_id)
            return None

        # ── Calculate ETo (Hargreaves) ───────────────────────
        t_min = min(temps)
        t_max = max(temps)
        t_mean = sum(temps) / len(temps)

        # Approximate extraterrestrial radiation (Ra) based on latitude
        # Default: 25° tropical latitude → ~25-35 MJ/m²/day
        # Simplified: use 28 MJ/m²/day as typical tropical average
        ra = 28.0  # MJ/m²/day
        eto = self.calculate_eto_hargreaves(t_min, t_max, t_mean, ra)

        # ── Get Kc ───────────────────────────────────────────
        kc = self.get_kc(crop_type, days_since_planting)
        etc = round(eto * kc, 2)

        # ── Effective rainfall ────────────────────────────────
        # USDA SCS method: P_eff = P_total × (125 - 0.2 × P_total) / 125 for P_total ≤ 250mm
        # Simplified: 80% of total rainfall, max 50mm/day
        total_rain = sum(rains) if rains else 0.0
        effective_rain = round(min(total_rain * 0.8, 50.0), 2)

        # ── Soil water balance ────────────────────────────────
        taw = TAW_MM_PER_M.get(soil_texture, 150.0) * root_depth_m
        raw = RAW_FRACTION * taw

        # Estimate current soil moisture
        current_sm = sum(soil_moistures) / len(soil_moistures) if soil_moistures else None

        if current_sm is not None:
            # Convert soil moisture % to depletion
            # Assume field capacity ~ 60% soil moisture for loam
            field_capacity = 60.0 if soil_texture in ("loam", "silt_loam", "clay_loam") else 50.0
            depletion_mm = max(0.0, (field_capacity - current_sm) / 100.0 * taw)
            depletion_pct = (depletion_mm / taw * 100) if taw > 0 else 0.0
        else:
            depletion_mm = etc - effective_rain  # estimate from water balance
            if depletion_mm < 0:
                depletion_mm = 0.0
            depletion_pct = (depletion_mm / taw * 100) if taw > 0 else 0.0

        # ── Decision logic ────────────────────────────────────
        irrigation_needed = 0.0
        recommendation: str = "skip"
        confidence = 0.9

        if current_sm is None:
            confidence = 0.6  # lower confidence without soil moisture data

        if depletion_pct >= 80.0:
            # Severe depletion: immediate irrigation needed
            irrigation_needed = round(depletion_mm - raw + etc, 2)
            if irrigation_needed < 5.0:
                irrigation_needed = 5.0  # minimum practical irrigation
            recommendation = "water"
        elif depletion_pct >= raw:
            # RAW exceeded: irrigation recommended
            irrigation_needed = round(depletion_mm - raw + etc, 2)
            if irrigation_needed < 5.0:
                irrigation_needed = 5.0
            recommendation = "water"
        elif depletion_pct >= raw * 0.5:
            # Approaching RAW: monitor
            irrigation_needed = round(raw - depletion_mm, 2)
            recommendation = "monitor"
        else:
            # Sufficient soil moisture
            recommendation = "skip"

        # Confidence adjustment for data quality
        if len(temps) < 3:
            confidence *= 0.8
        if not rains:
            confidence *= 0.9  # no rain data

        return IrrigationRecommendation(
            field_id=field_id,
            timestamp=datetime.now(timezone.utc),
            eto_mm=round(eto, 2),
            etc_mm=etc,
            effective_rain_mm=effective_rain,
            irrigation_needed_mm=irrigation_needed,
            soil_moisture_current=current_sm,
            soil_moisture_target=round(field_capacity, 1) if current_sm is not None else None,
            depletion_percent=round(depletion_pct, 1),
            recommendation=recommendation,
            confidence=round(confidence, 2),
        )

    # ═══════════════════════════════════════════════════════════
    # Split-N Fertilization
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def determine_growth_stage(
        days_since_planting: int,
        crop_type: str,
    ) -> str:
        """Determine the current growth stage based on days since planting.

        Stage boundaries are approximate and crop-specific.

        Args:
            days_since_planting: Days since crop was planted.
            crop_type: Crop type.

        Returns:
            'planting', 'vegetative', or 'reproductive'.
        """
        # Typical stage durations (approximate) in days
        stage_boundaries: dict[str, list[int]] = {
            "banana": [90, 240, 390],      # planting: 0-90, veg: 90-240, repro: 240-390
            "maize": [25, 70, 125],         # planting: 0-25, veg: 25-70, repro: 70-125
            "cacao": [60, 180, 270],        # planting: 0-60, veg: 60-180, repro: 180-270
            "rice": [25, 80, 150],          # planting: 0-25, veg: 25-80, repro: 80-150
        }

        bounds = stage_boundaries.get(crop_type, [30, 90, 150])
        if days_since_planting <= bounds[0]:
            return "planting"
        elif days_since_planting <= bounds[1]:
            return "vegetative"
        else:
            return "reproductive"

    async def calculate_fertilization(
        self,
        field_id: UUID,
        crop_type: str,
        days_since_planting: int,
        soil_test_n: float | None = None,
        soil_test_p: float | None = None,
        soil_test_k: float | None = None,
    ) -> FertilizationRecommendation:
        """Calculate split-N fertilization recommendation.

        Uses crop-specific removal rates and subtracts available soil nutrients.

        Args:
            field_id: Field UUID.
            crop_type: Crop type.
            days_since_planting: Days since planting.
            soil_test_n: Soil test N (kg/ha), if available.
            soil_test_p: Soil test P (kg/ha), if available.
            soil_test_k: Soil test K (kg/ha), if available.

        Returns:
            FertilizationRecommendation.
        """
        growth_stage = self.determine_growth_stage(days_since_planting, crop_type)

        rates = FERTILIZER_RATES.get(crop_type, {}).get(growth_stage, {"n": 50, "p": 30, "k": 50})

        # Subtract available soil nutrients (or estimate 20% of requirement)
        n_needed = max(0.0, rates["n"] - (soil_test_n or rates["n"] * 0.2))
        p_needed = max(0.0, rates["p"] - (soil_test_p or rates["p"] * 0.2))
        k_needed = max(0.0, rates["k"] - (soil_test_k or rates["k"] * 0.2))

        # Decision logic
        recommendation: str = "apply"
        reasoning_parts: list[str] = []

        if growth_stage == "planting":
            reasoning_parts.append(
                f"Planting stage: apply basal fertilizer to establish root system."
            )
        elif growth_stage == "vegetative":
            reasoning_parts.append(
                f"Vegetative stage: peak nutrient demand for {crop_type}."
            )
        else:
            reasoning_parts.append(
                f"Reproductive stage: support flowering/fruiting development."
            )

        if n_needed < 10 and p_needed < 10 and k_needed < 10:
            recommendation = "skip"
            reasoning_parts.append("Soil nutrient levels adequate — no fertilization needed.")
        elif n_needed < 5 or p_needed < 5 or k_needed < 5:
            recommendation = "delay"
            reasoning_parts.append(
                f"Some nutrients adequate (N={n_needed:.0f}, P={p_needed:.0f}, K={k_needed:.0f} "
                f"kg/ha). Consider split application."
            )

        reasoning_parts.append(
            f"Recommended: N={n_needed:.0f}, P₂O₅={p_needed:.0f}, K₂O={k_needed:.0f} kg/ha."
        )

        return FertilizationRecommendation(
            field_id=field_id,
            crop_type=crop_type,
            growth_stage=growth_stage,
            n_kg_ha=round(n_needed, 1),
            p_kg_ha=round(p_needed, 1),
            k_kg_ha=round(k_needed, 1),
            recommendation=recommendation,
            reasoning=" ".join(reasoning_parts),
        )

    # ═══════════════════════════════════════════════════════════
    # Pest Risk (Degree-Day Models)
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def calculate_gdd(
        t_min: float,
        t_max: float,
        t_base: float,
        t_upper: float | None = None,
    ) -> float:
        """Calculate Growing Degree Days for a single day.

        GDD = max((T_max + T_min) / 2 - T_base, 0)

        If an upper threshold is provided:
            T_max_adj = min(T_max, T_upper)

        Args:
            t_min: Minimum daily temperature (°C).
            t_max: Maximum daily temperature (°C).
            t_base: Base temperature below which development stops.
            t_upper: Optional upper temperature threshold.

        Returns:
            GDD for the day (≥ 0).
        """
        if t_upper is not None:
            t_max = min(t_max, t_upper)

        t_avg = (t_max + t_min) / 2.0
        gdd = max(0.0, t_avg - t_base)
        return round(gdd, 2)

    async def assess_pest_risk(
        self,
        field_id: UUID,
        crop_type: str,
        days_since_planting: int,
        sensor_readings: list[dict[str, Any]],
    ) -> list[PestRiskAlert]:
        """Assess pest risk using degree-day accumulation and environmental conditions.

        For each pest known to affect this crop:
            1. Calculate accumulated GDD from temperature readings
            2. Compare against pest-specific GDD threshold
            3. Check environmental favorability (temp range, humidity, leaf wetness)
            4. Assign risk level (low / medium / high)

        Args:
            field_id: Field UUID.
            crop_type: Crop type.
            days_since_planting: Days since planting.
            sensor_readings: Recent sensor readings for environmental data.

        Returns:
            List of PestRiskAlert for this field.
        """
        if not sensor_readings:
            return []

        # Extract temperature and humidity data
        temps = [r.get("temp") for r in sensor_readings if r.get("temp") is not None]
        humidities = [r.get("humidity") for r in sensor_readings if r.get("humidity") is not None]

        if not temps:
            return []

        t_min = min(temps)
        t_max = max(temps)
        t_avg = sum(temps) / len(temps)
        humidity_avg = sum(humidities) / len(humidities) if humidities else None

        # Estimate leaf wetness hours from humidity (simplified):
        # Hours with humidity > 85% approximate leaf wetness
        leaf_wetness_hours = sum(
            1 for h in humidities if h > 85.0
        ) if humidities else None

        alerts: list[PestRiskAlert] = []

        for pest_name, pest_info in PEST_THRESHOLDS.items():
            if pest_info["crop"] != crop_type:
                continue

            # Calculate accumulated GDD over the growing period
            # Simplified: assume each day has similar temperature pattern
            daily_gdd = self.calculate_gdd(
                t_min=t_min,
                t_max=t_max,
                t_base=pest_info["t_base"],
            )
            accumulated_gdd = round(daily_gdd * days_since_planting, 1)
            gdd_threshold = pest_info["gdd_threshold"]

            # Check temperature favorability
            temp_favorable = (
                pest_info.get("optimal_temp_min", 0)
                <= t_avg
                <= pest_info.get("optimal_temp_max", 50)
            )

            # Check humidity favorability
            humidity_favorable = (
                humidity_avg is not None
                and humidity_avg >= pest_info.get("min_humidity", 0)
            )

            # Check leaf wetness
            wetness_favorable = True
            if pest_info.get("requires_leaf_wetness"):
                wetness_required = pest_info.get("leaf_wetness_hours_min", 6)
                wetness_favorable = (
                    leaf_wetness_hours is not None
                    and leaf_wetness_hours >= wetness_required
                )

            conditions_favorable = (
                temp_favorable and humidity_favorable and wetness_favorable
            )

            # ── Risk level assignment ────────────────────────
            if accumulated_gdd >= gdd_threshold and conditions_favorable:
                risk_level = "high"
            elif accumulated_gdd >= gdd_threshold * 0.8 or conditions_favorable:
                risk_level = "medium"
            else:
                risk_level = "low"

            alert = PestRiskAlert(
                field_id=field_id,
                crop_type=crop_type,
                pest_name=pest_name,
                risk_level=risk_level,
                conditions_favorable=conditions_favorable,
                accumulated_gdd=accumulated_gdd,
                gdd_threshold=gdd_threshold,
                temperature_avg=round(t_avg, 1),
                humidity_avg=round(humidity_avg, 1) if humidity_avg is not None else None,
                leaf_wetness_hours=leaf_wetness_hours,
                recommendation=pest_info.get("recommendation", ""),
            )
            alerts.append(alert)

        return alerts

    # ═══════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════

    async def get_summary(
        self,
        field_id: UUID,
        crop_type: str,
        days_since_planting: int,
        sensor_readings: list[dict[str, Any]],
        db: AsyncSession,
        soil_test_n: float | None = None,
        soil_test_p: float | None = None,
        soil_test_k: float | None = None,
    ) -> RecommendationSummary:
        """Generate a complete recommendation summary for a field.

        Combines irrigation, fertilization, and pest risk into a single response
        optimized for the dashboard view.

        Args:
            field_id: Field UUID.
            crop_type: Crop type.
            days_since_planting: Days since planting.
            sensor_readings: Recent sensor readings.
            db: Async DB session.
            soil_test_n/p/k: Optional soil test values.

        Returns:
            RecommendationSummary with all three recommendation types.
        """
        irrigation = await self.calculate_irrigation(
            field_id=field_id,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            sensor_readings=sensor_readings,
            db=db,
        )

        fertilization = await self.calculate_fertilization(
            field_id=field_id,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            soil_test_n=soil_test_n,
            soil_test_p=soil_test_p,
            soil_test_k=soil_test_k,
        )

        pest_risk = await self.assess_pest_risk(
            field_id=field_id,
            crop_type=crop_type,
            days_since_planting=days_since_planting,
            sensor_readings=sensor_readings,
        )

        return RecommendationSummary(
            field_id=field_id,
            irrigation=irrigation,
            fertilization=fertilization,
            pest_risk=pest_risk,
            generated_at=datetime.now(timezone.utc),
        )

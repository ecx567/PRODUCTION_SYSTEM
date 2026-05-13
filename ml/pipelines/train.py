"""
Script: train.py — Train and serialize the yield prediction model pipeline.

This script generates synthetic training data, engineers features (GDD,
temperature stress, moisture deficit), trains a Random Forest regressor,
evaluates against the R² ≥ 0.75 gate, and serializes the model to
``ml/models/yield_model_rf.joblib``.

Usage:
    python ml/pipelines/train.py [--samples 20000] [--output ../models]

The script can be run independently or as part of a CI/CD pipeline.
It requires the ml/requirements.txt dependencies (pandas, numpy, scikit-learn,
xgboost, joblib).
"""

# ── CLI ──────────────────────────────────────────────────────
# /// script
# dependencies = [
#   "pandas>=2.1",
#   "numpy>=1.26",
#   "scikit-learn>=1.4",
#   "xgboost>=2.0",
#   "joblib>=1.3",
# ]
# ///

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("train")

# ── Constants ───────────────────────────────────────────────
T_BASE = 10.0  # Base temperature for GDD calculation
FIELD_CAPACITY = 60.0  # % soil moisture at field capacity (loam)

CROP_TYPES = [
    "banana", "maize", "cacao", "rice",
    "coffee", "sugarcane", "soybean", "sunflower", "palm_oil", "cotton",
    "cassava", "sweet_potato",
]
BASE_YIELDS: dict[str, float] = {
    "banana": 35000.0,
    "maize": 6000.0,
    "cacao": 800.0,
    "rice": 4500.0,
    "coffee": 1200.0,
    "sugarcane": 70000.0,
    "soybean": 2800.0,
    "sunflower": 2000.0,
    "palm_oil": 18000.0,
    "cotton": 3000.0,
    "cassava": 18000.0,
    "sweet_potato": 15000.0,
}

FEATURE_COLS = [
    "temp_mean",
    "temp_max",
    "temp_min",
    "humidity_mean",
    "soil_moisture_mean",
    "rain_total",
    "days_since_planting",
    "area_ha",
    "daily_gdd",
    "gdd_accumulated",
    "heat_stress_days",
    "cold_stress_days",
    "diurnal_range",
    "moisture_deficit",
    "water_stress_index",
    "rain_moisture_interaction",
]


def generate_synthetic_data(n_samples: int = 20000) -> pd.DataFrame:
    """Generate synthetic crop sensor data for training.

    Creates realistic-ish sensor readings with known relationships to yield.
    """
    np.random.seed(42)

    df = pd.DataFrame({
        "crop_type": np.random.choice(CROP_TYPES, n_samples),
        "temp_mean": np.random.normal(25, 5, n_samples),
        "temp_max": np.random.normal(32, 4, n_samples),
        "temp_min": np.random.normal(18, 3, n_samples),
        "humidity_mean": np.random.normal(75, 10, n_samples),
        "soil_moisture_mean": np.random.normal(55, 15, n_samples),
        "rain_total": np.random.exponential(50, n_samples),
        "days_since_planting": np.random.randint(0, 365, n_samples),
        "area_ha": np.random.uniform(0.5, 20, n_samples),
    })

    # ── Feature engineering ──────────────────────────────────
    df["daily_gdd"] = np.maximum(
        0, (df["temp_max"] + df["temp_min"]) / 2.0 - T_BASE,
    )
    df["gdd_accumulated"] = df["daily_gdd"] * df["days_since_planting"]
    df["heat_stress_days"] = (df["temp_max"] > 35).astype(int) * df["days_since_planting"] / 30
    df["cold_stress_days"] = (df["temp_min"] < 15).astype(int) * df["days_since_planting"] / 30
    df["diurnal_range"] = df["temp_max"] - df["temp_min"]
    df["moisture_deficit"] = (FIELD_CAPACITY - df["soil_moisture_mean"]).clip(lower=0)
    df["water_stress_index"] = df["moisture_deficit"] / FIELD_CAPACITY
    df["rain_moisture_interaction"] = df["rain_total"] * df["soil_moisture_mean"] / 100

    # ── Target: yield with known relationships ───────────────
    df["yield_kg_ha"] = df["crop_type"].map(BASE_YIELDS)
    df["yield_kg_ha"] += df["gdd_accumulated"] * 0.5
    df["yield_kg_ha"] -= df["water_stress_index"] * 2000
    # Clip before adding noise to prevent negative scale in normal distribution
    df["yield_kg_ha"] = df["yield_kg_ha"].clip(lower=100)
    scale = df["yield_kg_ha"] * 0.1
    df["yield_kg_ha"] += np.random.normal(0, scale.values, n_samples)
    df["yield_kg_ha"] = df["yield_kg_ha"].clip(lower=0)

    logger.info("Generated %d training samples.", len(df))
    return df


def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Encode categoricals and split features/target."""
    df_ml = pd.get_dummies(df, columns=["crop_type"], prefix="crop")
    crop_cols = [c for c in df_ml.columns if c.startswith("crop_")]
    all_features = FEATURE_COLS + crop_cols

    X = df_ml[all_features]
    y = df_ml["yield_kg_ha"]
    return X, y


def train_rf(
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> tuple:
    """Train Random Forest with GridSearchCV."""
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import GridSearchCV

    param_grid = {
        "n_estimators": [100, 200],
        "max_depth": [10, 20, None],
        "min_samples_split": [2, 5],
        "min_samples_leaf": [1, 2],
    }

    grid = GridSearchCV(
        RandomForestRegressor(random_state=42, n_jobs=-1),
        param_grid=param_grid,
        cv=3,
        scoring="r2",
        verbose=0,
        n_jobs=-1,
    )
    grid.fit(X_train, y_train)
    logger.info("RF best params: %s (CV R²=%.4f)", grid.best_params_, grid.best_score_)
    return grid.best_estimator_, grid.best_params_


def train_xgb(
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> tuple | None:
    """Train XGBoost with GridSearchCV (optional fallback)."""
    try:
        from sklearn.model_selection import GridSearchCV
        from xgboost import XGBRegressor
    except ImportError:
        logger.info("XGBoost not available — skipping.")
        return None

    param_grid = {
        "n_estimators": [100, 200],
        "max_depth": [4, 6, 8],
        "learning_rate": [0.01, 0.1, 0.3],
        "subsample": [0.8, 1.0],
    }

    grid = GridSearchCV(
        XGBRegressor(random_state=42, n_jobs=-1),
        param_grid=param_grid,
        cv=3,
        scoring="r2",
        verbose=0,
        n_jobs=-1,
    )
    grid.fit(X_train, y_train)
    logger.info("XGBoost best params: %s (CV R²=%.4f)", grid.best_params_, grid.best_score_)
    return grid.best_estimator_, grid.best_params_


def evaluate_model(model, X_test, y_test, name: str) -> dict:
    """Evaluate a model and return metrics dict."""
    from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae = float(mean_absolute_error(y_test, y_pred))

    logger.info(
        "%s | R²=%.4f | RMSE=%.2f | MAE=%.2f | %s",
        name, r2, rmse, mae,
        "✓ PASS (≥ 0.75)" if r2 >= 0.75 else "✗ FAIL (< 0.75)",
    )

    return {"r2": r2, "rmse": rmse, "mae": mae, "name": name}


def save_model(model, path: Path, feature_cols: list[str]) -> None:
    """Serialize model and feature names."""
    path.parent.mkdir(parents=True, exist_ok=True)
    import joblib
    joblib.dump(model, path)
    logger.info("Model saved: %s (%.1f KB)", path, path.stat().st_size / 1024)

    # Save feature names
    feat_path = path.with_name("feature_names.txt")
    with open(feat_path, "w") as f:
        for feat in feature_cols:
            f.write(feat + "\n")
    logger.info("Feature names saved: %s", feat_path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Train and serialize yield prediction model.",
    )
    parser.add_argument(
        "--samples", type=int, default=20000,
        help="Number of synthetic training samples.",
    )
    parser.add_argument(
        "--output", type=str, default=str(Path(__file__).resolve().parent.parent / "models"),
        help="Output directory for serialized models.",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)
    logger.info("Output directory: %s", output_dir)

    # 1. Generate data
    df = generate_synthetic_data(args.samples)
    X, y = engineer_features(df)

    # 2. Train/test split
    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
    )
    logger.info("Train: %d samples | Test: %d samples", len(X_train), len(X_test))

    # 3. Train RF (MVP)
    logger.info("Training Random Forest...")
    t0 = time.time()
    rf_model, rf_params = train_rf(X_train, y_train)
    rf_time = time.time() - t0
    logger.info("RF training took %.1fs", rf_time)

    rf_metrics = evaluate_model(rf_model, X_test, y_test, "Random Forest")

    # 4. Train XGBoost (optional)
    xgb_result = train_xgb(X_train, y_train)
    if xgb_result:
        xgb_model, xgb_params = xgb_result
        xgb_metrics = evaluate_model(xgb_model, X_test, y_test, "XGBoost")

    # 5. Save models
    save_model(rf_model, output_dir / "yield_model_rf.joblib", list(X.columns))

    if xgb_result:
        save_model(xgb_model, output_dir / "yield_model_xgb.joblib", list(X.columns))

    # 6. Gate check
    if rf_metrics["r2"] < 0.75:
        logger.error(
            "R²=%.4f is BELOW the 0.75 gate. Model NOT suitable for production.",
            rf_metrics["r2"],
        )
        return 1

    logger.info(
        "✓ Training completed. RF R²=%.4f passes gate (≥ 0.75).",
        rf_metrics["r2"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

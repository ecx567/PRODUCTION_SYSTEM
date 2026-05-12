"""
Pydantic models for external weather data (Open-Meteo).

Provides structured schemas for current conditions, multi-day forecasts,
and derived weather alerts based on threshold conditions.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class CurrentWeather(BaseModel):
    """Real-time weather conditions from Open-Meteo."""

    latitude: float
    longitude: float
    temperature_2m: float
    relative_humidity_2m: int
    precipitation: float
    soil_moisture_0_to_7cm: float
    et0_fao_evapotranspiration: float
    vapour_pressure_deficit: float
    time: str
    units: dict[str, str]


class ForecastDay(BaseModel):
    """Single day forecast in a multi-day outlook."""

    date: str
    temperature_2m_max: float | None = None
    temperature_2m_min: float | None = None
    precipitation_sum: float | None = None
    et0_fao_evapotranspiration: float | None = None


class Forecast(BaseModel):
    """Multi-day weather forecast."""

    latitude: float
    longitude: float
    days: int
    units: dict[str, str]
    daily: list[ForecastDay]


class WeatherAlert(BaseModel):
    """Condition-based weather alert derived from forecast data.

    Alerts are generated client-side from threshold checks against
    the current/forecast weather data (e.g., heat wave, frost risk).
    """

    alert_type: str
    severity: str  # "info" | "warning" | "critical"
    title: str
    message: str
    start_time: str | None = None
    end_time: str | None = None
    metadata: dict[str, Any] | None = None

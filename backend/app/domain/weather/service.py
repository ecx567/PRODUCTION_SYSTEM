"""
Weather service: async HTTP client for Open-Meteo API with Redis caching.

Provides field-level weather data for agricultural decision support.
Caches responses for 30 minutes to reduce external API calls.
Falls back to stale cache when Open-Meteo is unreachable.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import httpx
from redis.asyncio import Redis

from app.domain.weather.schemas import CurrentWeather, Forecast, ForecastDay

logger = logging.getLogger("crop.weather.service")


class WeatherService:
    """Async HTTP client for Open-Meteo weather data with Redis cache.

    Uses the Open-Meteo free API (no auth required). Latency-sensitive
    operations are cached in Redis for ``CACHE_TTL`` seconds.

    Args:
        redis: Optional Redis client for caching. When ``None``, caching
               is disabled and every call hits the external API.
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_TTL = 1800  # 30 minutes

    # ── Variables requested from Open-Meteo ───────────────────
    CURRENT_VARIABLES: list[str] = [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "soil_moisture_0_to_7cm",
        "et0_fao_evapotranspiration",
        "vapour_pressure_deficit",
    ]
    DAILY_VARIABLES: list[str] = [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "et0_fao_evapotranspiration",
    ]

    def __init__(self, redis: Redis | None = None) -> None:
        self._redis = redis

    # ── Public API ────────────────────────────────────────────

    async def get_current_weather(
        self,
        lat: float,
        lon: float,
    ) -> CurrentWeather:
        """Fetch current weather for a location.

        Checks Redis cache first. On cache miss, calls Open-Meteo.
        If the API call fails, tries stale cache before propagating.

        Raises:
            httpx.HTTPStatusError: Open-Meteo responded with HTTP error
                and no stale cache was available.
            httpx.RequestError: Connection failed and no stale cache.
        """
        cache_key = self._current_cache_key(lat, lon)

        # ── Fast path: fresh cache hit ────────────────────────
        cached = await self._cache_get(cache_key)
        if cached is not None:
            logger.debug("Weather cache HIT for %s", cache_key)
            return cached

        # ── Fetch from Open-Meteo ─────────────────────────────
        try:
            data = await self._fetch_current(lat, lon)
            result = self._parse_current(data, lat, lon)
            await self._cache_set(cache_key, result)
            return result
        except (httpx.HTTPStatusError, httpx.RequestError):
            logger.warning("Open-Meteo API call failed for lat=%s lon=%s", lat, lon)
            # ── Fallback: stale cache ─────────────────────────
            stale = await self._cache_get_stale(cache_key)
            if stale is not None:
                logger.info("Serving stale weather cache for %s", cache_key)
                return stale
            raise

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7,
    ) -> Forecast:
        """Fetch multi-day forecast for a location.

        Behaves identically to ``get_current_weather`` but for daily
        forecast data.

        Raises:
            httpx.HTTPStatusError: Open-Meteo responded with HTTP error
                and no stale cache was available.
            httpx.RequestError: Connection failed and no stale cache.
        """
        cache_key = self._forecast_cache_key(lat, lon, days)

        cached = await self._cache_get(cache_key)
        if cached is not None:
            logger.debug("Forecast cache HIT for %s", cache_key)
            return cached

        try:
            data = await self._fetch_forecast(lat, lon, days)
            result = self._parse_forecast(data, lat, lon, days)
            await self._cache_set(cache_key, result)
            return result
        except (httpx.HTTPStatusError, httpx.RequestError):
            logger.warning("Open-Meteo forecast API failed for lat=%s lon=%s", lat, lon)
            stale = await self._cache_get_stale(cache_key)
            if stale is not None:
                return stale
            raise

    # ── Internal: HTTP calls ──────────────────────────────────

    async def _fetch_current(self, lat: float, lon: float) -> dict:
        """Call Open-Meteo ``/v1/forecast`` for current conditions.

        Returns the raw JSON response dict.
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": ",".join(self.CURRENT_VARIABLES),
            "timezone": "auto",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(self.BASE_URL, params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()

    async def _fetch_forecast(
        self, lat: float, lon: float, days: int,
    ) -> dict:
        """Call Open-Meteo ``/v1/forecast`` for daily forecast."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": ",".join(self.DAILY_VARIABLES),
            "timezone": "auto",
            "forecast_days": days,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(self.BASE_URL, params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()

    # ── Internal: response parsing ────────────────────────────

    @staticmethod
    def _parse_current(data: dict, lat: float, lon: float) -> CurrentWeather:
        """Transform Open-Meteo current response into a CurrentWeather model."""
        current = data.get("current", {})
        units = data.get("current_units", {})
        return CurrentWeather(
            latitude=lat,
            longitude=lon,
            temperature_2m=current.get("temperature_2m", 0.0),
            relative_humidity_2m=current.get("relative_humidity_2m", 0),
            precipitation=current.get("precipitation", 0.0),
            soil_moisture_0_to_7cm=current.get("soil_moisture_0_to_7cm", 0.0),
            et0_fao_evapotranspiration=current.get("et0_fao_evapotranspiration", 0.0),
            vapour_pressure_deficit=current.get("vapour_pressure_deficit", 0.0),
            time=current.get("time", ""),
            units=dict(units) if units else {},
        )

    @staticmethod
    def _parse_forecast(
        data: dict, lat: float, lon: float, days: int,
    ) -> Forecast:
        """Transform Open-Meteo daily response into a Forecast model."""
        daily = data.get("daily", {})
        units = data.get("daily_units", {})
        times: list[str] = daily.get("time", [])
        max_temps: list[float | None] = daily.get("temperature_2m_max", [])
        min_temps: list[float | None] = daily.get("temperature_2m_min", [])
        precip: list[float | None] = daily.get("precipitation_sum", [])
        etos: list[float | None] = daily.get("et0_fao_evapotranspiration", [])

        forecast_days = [
            ForecastDay(
                date=times[i] if i < len(times) else "",
                temperature_2m_max=_safe_float(max_temps, i),
                temperature_2m_min=_safe_float(min_temps, i),
                precipitation_sum=_safe_float(precip, i),
                et0_fao_evapotranspiration=_safe_float(etos, i),
            )
            for i in range(min(days, len(times)))
        ]

        return Forecast(
            latitude=lat,
            longitude=lon,
            days=days,
            units=dict(units) if units else {},
            daily=forecast_days,
        )

    # ── Internal: cache helpers ───────────────────────────────

    async def _cache_get(self, key: str) -> CurrentWeather | Forecast | None:
        """Attempt to read and deserialize a cached weather value.

        Returns ``None`` on cache miss, deserialized model on hit.
        """
        if self._redis is None:
            return None
        raw = await self._redis.get(key)
        if raw is None:
            return None
        # Determine type from key prefix
        if key.startswith("weather:current:"):
            return CurrentWeather.model_validate_json(raw)
        return Forecast.model_validate_json(raw)

    async def _cache_get_stale(
        self, key: str,
    ) -> CurrentWeather | Forecast | None:
        """Attempt to read stale cache without extending TTL.

        This reads the key even if it would have expired (Redis TTL
        expiration is lazy — the key may still exist briefly after
        expiration). Returns ``None`` if nothing is found.
        """
        if self._redis is None:
            return None
        raw = await self._redis.get(key)
        if raw is None:
            return None
        if key.startswith("weather:current:"):
            return CurrentWeather.model_validate_json(raw)
        return Forecast.model_validate_json(raw)

    async def _cache_set(
        self, key: str, value: CurrentWeather | Forecast,
    ) -> None:
        """Serialize and store a weather value in Redis with TTL."""
        if self._redis is None:
            return
        raw = value.model_dump_json()
        await self._redis.setex(key, self.CACHE_TTL, raw)

    # ── Cache key helpers ─────────────────────────────────────

    @staticmethod
    def _current_cache_key(lat: float, lon: float) -> str:
        return f"weather:current:{lat:.4f}:{lon:.4f}"

    @staticmethod
    def _forecast_cache_key(lat: float, lon: float, days: int) -> str:
        return f"weather:forecast:{lat:.4f}:{lon:.4f}:{days}"


def _safe_float(arr: list, idx: int) -> float | None:
    """Return array[idx] as float/None if out of bounds or None."""
    if idx < len(arr) and arr[idx] is not None:
        return float(arr[idx])
    return None

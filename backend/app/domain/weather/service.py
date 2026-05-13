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

from app.domain.weather.schemas import (
    CurrentWeather,
    Forecast,
    ForecastDay,
    ForecastDayHargreaves,
    HargreavesForecast,
)

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
    FORECAST_DAILY_CACHE_TTL = 3600  # 60 minutes (forecast/daily)

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

    # ═══════════════════════════════════════════════════════════
    # Hargreaves-Samani ET₀ methods
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def calculate_solar_declination(day_of_year: int) -> float:
        """Calculate solar declination (radians) from day of year.

        Uses FAO-56 Equation 24:
            δ = 0.409 × sin(2π/365 × J - 1.39)

        where J is the day of year.

        Args:
            day_of_year: Day of year (1-366).

        Returns:
            Solar declination in radians (range: ~±0.409).
        """
        import math
        return 0.409 * math.sin(2 * math.pi * day_of_year / 365 - 1.39)

    @staticmethod
    def calculate_extraterrestrial_radiation(
        lat_rad: float, solar_declination: float, day_of_year: int,
    ) -> float:
        """Calculate extraterrestrial radiation (Ra) in MJ/m²/day.

        Uses FAO-56 Equation 21.

        Args:
            lat_rad: Latitude in radians.
            solar_declination: Solar declination in radians.
            day_of_year: Day of year (1-366).

        Returns:
            Extraterrestrial radiation in MJ/m²/day.
        """
        import math

        g_sc = 0.0820  # Solar constant [MJ m-2 min-1]

        # Inverse relative distance Earth-Sun (Equation 23)
        d_r = 1 + 0.033 * math.cos(2 * math.pi * day_of_year / 365)

        # Solar declination (already calculated)
        dec = solar_declination

        # Sunset hour angle (Equation 25)
        # ω_s = arccos(-tan(φ) × tan(δ))
        cos_omega = -math.tan(lat_rad) * math.tan(dec)
        cos_omega = max(-1.0, min(1.0, cos_omega))
        omega_s = math.acos(cos_omega)

        # Ra = (24×60/π) × G_sc × d_r × [ω_s × sin(φ) × sin(δ) + cos(φ) × cos(δ) × sin(ω_s)]
        ra = (
            (24 * 60 / math.pi)
            * g_sc
            * d_r
            * (
                omega_s * math.sin(lat_rad) * math.sin(dec)
                + math.cos(lat_rad) * math.cos(dec) * math.sin(omega_s)
            )
        )

        return max(0.0, ra)

    @staticmethod
    def calculate_eto_hargreaves(
        t_min: float,
        t_max: float,
        t_mean: float,
        ra: float,
    ) -> float:
        """Calculate reference evapotranspiration (ETo) using Hargreaves-Samani.

        Hargreaves & Samani (1985):
            ET₀ = 0.0023 × Ra × (T_mean + 17.8) × sqrt(T_max - T_min)

        Args:
            t_min: Minimum daily temperature (°C).
            t_max: Maximum daily temperature (°C).
            t_mean: Mean daily temperature (°C).
            ra: Extraterrestrial radiation (MJ/m²/day).

        Returns:
            ET₀ in mm/day.
        """
        if t_max < t_min:
            t_max, t_min = t_min, t_max

        temp_diff = t_max - t_min
        if temp_diff < 0.5:
            temp_diff = 0.5

        eto = 0.0023 * ra * (t_mean + 17.8) * (temp_diff ** 0.5)
        return max(0.0, round(eto, 2))

    async def get_forecast_daily_with_eto(
        self,
        lat: float,
        lon: float,
        days: int = 7,
    ) -> HargreavesForecast:
        """Fetch daily forecast and compute Hargreaves-Samani ET₀.

        Differs from ``get_forecast()`` in two ways:
            1. Computes ET₀ server-side using Hargreaves-Samani (not FAO-56 PM)
            2. Caches for 60 minutes (instead of 30)

        Args:
            lat: Latitude (WGS84).
            lon: Longitude (WGS84).
            days: Number of forecast days (1-16).

        Returns:
            ``HargreavesForecast`` with per-day Hargreaves ET₀ values.

        Raises:
            httpx.HTTPStatusError: Open-Meteo responded with HTTP error.
            httpx.RequestError: Connection failed.
        """
        cache_key = self._forecast_daily_cache_key(lat, lon, days)

        # ── Fast path: fresh cache hit ────────────────────────
        cached = await self._cache_get_hargreaves(cache_key)
        if cached is not None:
            logger.debug("Forecast daily cache HIT for %s", cache_key)
            return cached

        # ── Fetch temperature data from Open-Meteo ───────────
        try:
            data = await self._fetch_forecast_temps(lat, lon, days)
            result = self._parse_hargreaves_forecast(data, lat, lon, days)
            await self._cache_set_hargreaves(cache_key, result)
            return result
        except (httpx.HTTPStatusError, httpx.RequestError):
            logger.warning(
                "Open-Meteo forecast daily API failed for lat=%s lon=%s", lat, lon,
            )
            stale = await self._cache_get_hargreaves_stale(cache_key)
            if stale is not None:
                return stale
            raise

    async def _fetch_forecast_temps(
        self, lat: float, lon: float, days: int,
    ) -> dict:
        """Call Open-Meteo for daily temperature data only."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
            "timezone": "auto",
            "forecast_days": days,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(self.BASE_URL, params=params, timeout=10.0)
            resp.raise_for_status()
            return resp.json()

    def _parse_hargreaves_forecast(
        self, data: dict, lat: float, lon: float, days: int,
    ) -> HargreavesForecast:
        """Transform Open-Meteo daily temp data into HargreavesForecast."""
        daily = data.get("daily", {})
        units = data.get("daily_units", {})
        times: list[str] = daily.get("time", [])
        max_temps: list[float | None] = daily.get("temperature_2m_max", [])
        min_temps: list[float | None] = daily.get("temperature_2m_min", [])
        precip: list[float | None] = daily.get("precipitation_sum", [])

        forecast_days: list[ForecastDayHargreaves] = []

        for i in range(min(days, len(times))):
            t_max = _safe_float(max_temps, i)
            t_min = _safe_float(min_temps, i)
            t_mean = None
            et0_hs = None

            if t_max is not None and t_min is not None:
                t_mean = round((t_max + t_min) / 2.0, 1)

                # Calculate Ra for this day
                # Use a rough day-of-year from the date string
                doy = self._estimate_day_of_year(times[i]) if times else 1
                lat_rad = lat * 3.14159 / 180.0
                dec = self.calculate_solar_declination(doy)
                ra = self.calculate_extraterrestrial_radiation(lat_rad, dec, doy)

                et0_hs = self.calculate_eto_hargreaves(t_min, t_max, t_mean, ra)

            forecast_days.append(
                ForecastDayHargreaves(
                    date=times[i] if i < len(times) else "",
                    temperature_2m_max=t_max,
                    temperature_2m_min=t_min,
                    temperature_2m_mean=t_mean,
                    precipitation_sum=_safe_float(precip, i),
                    et0_hargreaves=et0_hs,
                )
            )

        return HargreavesForecast(
            latitude=lat,
            longitude=lon,
            days=days,
            units=dict(units) if units else {},
            daily=forecast_days,
        )

    @staticmethod
    def _estimate_day_of_year(date_str: str) -> int:
        """Estimate day of year from a date string (YYYY-MM-DD)."""
        try:
            from datetime import datetime
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.timetuple().tm_yday
        except (ValueError, TypeError):
            return 172  # mid-year fallback (~June 21)

    # ── Hargreaves forecast cache helpers ─────────────────────

    async def _cache_get_hargreaves(
        self, key: str,
    ) -> HargreavesForecast | None:
        if self._redis is None:
            return None
        raw = await self._redis.get(key)
        if raw is None:
            return None
        return HargreavesForecast.model_validate_json(raw)

    async def _cache_get_hargreaves_stale(
        self, key: str,
    ) -> HargreavesForecast | None:
        if self._redis is None:
            return None
        raw = await self._redis.get(key)
        if raw is None:
            return None
        return HargreavesForecast.model_validate_json(raw)

    async def _cache_set_hargreaves(
        self, key: str, value: HargreavesForecast,
    ) -> None:
        if self._redis is None:
            return
        raw = value.model_dump_json()
        await self._redis.setex(key, self.FORECAST_DAILY_CACHE_TTL, raw)

    @staticmethod
    def _forecast_daily_cache_key(lat: float, lon: float, days: int) -> str:
        return f"weather:forecast:daily:{lat:.4f}:{lon:.4f}:{days}"

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

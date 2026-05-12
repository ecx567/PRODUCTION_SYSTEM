"""
Tests for the Open-Meteo weather module.

Covers WeatherService: API parsing, Redis caching (hit/miss),
stale-cache fallback, and API downtime handling.
"""

from __future__ import annotations

import copy
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.domain.weather.schemas import CurrentWeather, Forecast

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════════
# Mock Open-Meteo API responses (factory functions — deep copies
# to prevent test mutation side effects).
# ═══════════════════════════════════════════════════════════════

def _mock_current_response(
    lat: float = 23.1,
    lon: float = -82.5,
    temp: float = 25.5,
    humidity: int = 70,
    precip: float = 0.0,
    soil_moist: float = 0.35,
    eto: float = 0.2,
    vpd: float = 0.8,
) -> dict:
    """Return a fresh Open-Meteo /v1/forecast current-weather response dict."""
    return {
        "latitude": lat,
        "longitude": lon,
        "generationtime_ms": 0.5,
        "utc_offset_seconds": 0,
        "timezone": "GMT",
        "timezone_abbreviation": "GMT",
        "elevation": 10.0,
        "current_units": {
            "time": "iso8601",
            "interval": "seconds",
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "precipitation": "mm",
            "soil_moisture_0_to_7cm": "m³/m³",
            "et0_fao_evapotranspiration": "mm",
            "vapour_pressure_deficit": "kPa",
        },
        "current": {
            "time": "2026-05-11T10:00",
            "interval": 900,
            "temperature_2m": temp,
            "relative_humidity_2m": humidity,
            "precipitation": precip,
            "soil_moisture_0_to_7cm": soil_moist,
            "et0_fao_evapotranspiration": eto,
            "vapour_pressure_deficit": vpd,
        },
    }


def _mock_forecast_response(
    lat: float = 23.1,
    lon: float = -82.5,
    days: int = 3,
) -> dict:
    """Return a fresh Open-Meteo /v1/forecast daily response dict."""
    # Generate N days where each subsequent day has a slight variation
    dates = [f"2026-05-{11 + i:02d}" for i in range(days)]
    max_temps = [26.0 + i * 0.5 for i in range(days)]
    min_temps = [18.0 - i * 0.5 for i in range(days)]
    precip_sums = [0.0 if i % 2 == 0 else 2.5 for i in range(days)]
    etos = [3.5 + i * 0.2 for i in range(days)]

    return {
        "latitude": lat,
        "longitude": lon,
        "generationtime_ms": 1.2,
        "utc_offset_seconds": 0,
        "timezone": "GMT",
        "timezone_abbreviation": "GMT",
        "elevation": 10.0,
        "daily_units": {
            "time": "iso8601",
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
            "et0_fao_evapotranspiration": "mm",
        },
        "daily": {
            "time": dates,
            "temperature_2m_max": max_temps,
            "temperature_2m_min": min_temps,
            "precipitation_sum": precip_sums,
            "et0_fao_evapotranspiration": etos,
        },
    }


# ═══════════════════════════════════════════════════════════════
# CurrentWeather — parsing
# ═══════════════════════════════════════════════════════════════

class TestCurrentWeatherParsing:
    """Verify CurrentWeather parsing from Open-Meteo API response."""

    async def test_parses_current_weather(self):
        """Parses Open-Meteo current JSON into CurrentWeather model."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(service, "_fetch_current",
                          return_value=_mock_current_response()):
            result = await service.get_current_weather(lat=23.1, lon=-82.5)

        assert isinstance(result, CurrentWeather)
        assert result.temperature_2m == 25.5
        assert result.relative_humidity_2m == 70
        assert result.precipitation == 0.0
        assert result.soil_moisture_0_to_7cm == 0.35
        assert result.et0_fao_evapotranspiration == 0.2
        assert result.vapour_pressure_deficit == 0.8
        assert result.latitude == 23.1
        assert result.longitude == -82.5
        assert result.time == "2026-05-11T10:00"
        assert result.units["temperature_2m"] == "°C"

    async def test_parses_different_location(self):
        """Different lat/lon values are reflected in the parsed result."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(
            service, "_fetch_current",
            return_value=_mock_current_response(
                lat=40.7128, lon=-74.0060,
                temp=15.0, humidity=45,
            ),
        ):
            result = await service.get_current_weather(lat=40.7128, lon=-74.0060)

        assert result.temperature_2m == 15.0
        assert result.relative_humidity_2m == 45
        assert result.latitude == 40.7128
        assert result.longitude == -74.0060


# ═══════════════════════════════════════════════════════════════
# Forecast — parsing
# ═══════════════════════════════════════════════════════════════

class TestForecastParsing:
    """Verify Forecast parsing from Open-Meteo daily response."""

    async def test_parses_forecast(self):
        """Parses Open-Meteo daily JSON into Forecast model."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(service, "_fetch_forecast",
                          return_value=_mock_forecast_response()):
            result = await service.get_forecast(lat=23.1, lon=-82.5, days=3)

        assert isinstance(result, Forecast)
        assert result.latitude == 23.1
        assert result.longitude == -82.5
        assert len(result.daily) == 3
        assert result.daily[0].date == "2026-05-11"
        assert result.daily[0].temperature_2m_max == 26.0
        assert result.daily[0].temperature_2m_min == 18.0
        assert result.daily[1].precipitation_sum == 2.5
        assert result.daily[2].et0_fao_evapotranspiration == 3.9  # 3.5 + 2*0.2
        assert result.units["temperature_2m_max"] == "°C"

    async def test_forecast_with_different_days(self):
        """Requesting 5 days returns a 5-day forecast."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(
            service, "_fetch_forecast",
            return_value=_mock_forecast_response(days=5),
        ):
            result = await service.get_forecast(lat=23.1, lon=-82.5, days=5)

        assert len(result.daily) == 5


# ═══════════════════════════════════════════════════════════════
# Redis caching layer
# ═══════════════════════════════════════════════════════════════

class TestWeatherCache:
    """Verify Redis cache hit/miss behavior."""

    async def test_cache_hit_returns_cached_data(self):
        """When Redis has cached data, returns it without calling the API."""
        from app.domain.weather.service import WeatherService

        cached = CurrentWeather(
            latitude=23.1, longitude=-82.5,
            temperature_2m=25.5, relative_humidity_2m=70,
            precipitation=0.0, soil_moisture_0_to_7cm=0.35,
            et0_fao_evapotranspiration=0.2, vapour_pressure_deficit=0.8,
            time="2026-05-11T10:00",
            units={"temperature_2m": "°C", "relative_humidity_2m": "%",
                   "precipitation": "mm", "soil_moisture_0_to_7cm": "m³/m³",
                   "et0_fao_evapotranspiration": "mm",
                   "vapour_pressure_deficit": "kPa"},
        )
        mock_redis = AsyncMock()
        mock_redis.get.return_value = cached.model_dump_json().encode()

        service = WeatherService(redis=mock_redis)
        with patch.object(service, "_fetch_current",
                          side_effect=Exception("API should not be called")):
            result = await service.get_current_weather(lat=23.1, lon=-82.5)

        assert result.temperature_2m == 25.5
        mock_redis.get.assert_awaited_once()

    async def test_cache_miss_calls_api_and_stores(self):
        """Cache miss: service fetches from API and stores result in Redis."""
        from app.domain.weather.service import WeatherService

        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # cache miss

        service = WeatherService(redis=mock_redis)
        with patch.object(service, "_fetch_current",
                          return_value=_mock_current_response()):
            result = await service.get_current_weather(lat=23.1, lon=-82.5)

        assert result.temperature_2m == 25.5
        mock_redis.get.assert_awaited_once()
        # Should have cached the serialized result
        setex_call = mock_redis.setex.await_args
        assert setex_call is not None
        key, ttl, value = setex_call.args
        assert key.startswith("weather:current:")
        assert ttl == 1800
        assert isinstance(value, (str, bytes))

    async def test_no_redis_skips_cache(self):
        """When no Redis client is provided, service calls API directly."""
        from app.domain.weather.service import WeatherService

        service = WeatherService(redis=None)
        with patch.object(service, "_fetch_current",
                          return_value=_mock_current_response()):
            result = await service.get_current_weather(lat=23.1, lon=-82.5)

        assert result.temperature_2m == 25.5  # Still works without Redis

    async def test_forecast_cache_hit(self):
        """Forecast endpoint respects Redis cache."""
        from app.domain.weather.service import WeatherService
        from app.domain.weather.schemas import ForecastDay

        cached = Forecast(
            latitude=23.1, longitude=-82.5, days=3,
            units={"temperature_2m_max": "°C"},
            daily=[
                ForecastDay(date="2026-05-11", temperature_2m_max=26.0,
                            temperature_2m_min=18.0, precipitation_sum=0.0,
                            et0_fao_evapotranspiration=3.5),
            ],
        )
        mock_redis = AsyncMock()
        mock_redis.get.return_value = cached.model_dump_json().encode()

        service = WeatherService(redis=mock_redis)
        with patch.object(service, "_fetch_forecast",
                          side_effect=Exception("API should not be called")):
            result = await service.get_forecast(lat=23.1, lon=-82.5, days=3)

        assert len(result.daily) == 1
        assert result.daily[0].temperature_2m_max == 26.0
        mock_redis.get.assert_awaited_once()


# ═══════════════════════════════════════════════════════════════
# Open-Meteo downtime handling
# ═══════════════════════════════════════════════════════════════

class TestWeatherApiDown:
    """Verify graceful degradation when Open-Meteo is unreachable."""

    async def test_api_down_raises_when_no_stale_cache(self):
        """Without stale cache, HTTP errors propagate from the service."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(
            service, "_fetch_current",
            side_effect=httpx.HTTPStatusError(
                "503 Service Unavailable",
                request=MagicMock(),
                response=MagicMock(status_code=503),
            ),
        ):
            with pytest.raises(httpx.HTTPStatusError):
                await service.get_current_weather(lat=23.1, lon=-82.5)

    async def test_api_down_connection_error_raises(self):
        """httpx.RequestError (connection failure) propagates when no cache."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(
            service, "_fetch_current",
            side_effect=httpx.ConnectError("Connection refused"),
        ):
            with pytest.raises(httpx.RequestError):
                await service.get_current_weather(lat=23.1, lon=-82.5)

    async def test_stale_cache_served_when_api_down(self):
        """When API is down but stale cache exists, returns cached data."""
        from app.domain.weather.service import WeatherService

        serialized = (
            '{"latitude":23.1,"longitude":-82.5,"temperature_2m":25.5,'
            '"relative_humidity_2m":70,"precipitation":0.0,'
            '"soil_moisture_0_to_7cm":0.35,"et0_fao_evapotranspiration":0.2,'
            '"vapour_pressure_deficit":0.8,"time":"2026-05-11T10:00",'
            '"units":{"temperature_2m":"°C"}}'
        )
        mock_redis = AsyncMock()
        # First get for fresh cache → miss, second get for stale → hit
        mock_redis.get.side_effect = [None, serialized.encode()]

        service = WeatherService(redis=mock_redis)
        with patch.object(
            service, "_fetch_current",
            side_effect=httpx.HTTPStatusError(
                "503", request=MagicMock(),
                response=MagicMock(status_code=503),
            ),
        ):
            result = await service.get_current_weather(lat=23.1, lon=-82.5)

        assert result.temperature_2m == 25.5
        assert mock_redis.get.await_count == 2


# ═══════════════════════════════════════════════════════════════
# Router-level integration (optional — validates wiring)
# ═══════════════════════════════════════════════════════════════

class TestWeatherRouter:
    """Verify weather endpoints are wired and return correct status."""

    async def test_current_endpoint_returns_200(self, client):
        """GET /api/v1/weather/current returns 200 when weather works."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(service, "_fetch_current",
                          return_value=_mock_current_response()):
            with patch(
                "app.domain.weather.router._weather_service",
                service,
            ):
                resp = await client.get(
                    "/api/v1/weather/current",
                    params={"lat": 23.1, "lon": -82.5},
                )

        assert resp.status_code == 200
        data = resp.json()
        assert data["temperature_2m"] == 25.5
        assert data["latitude"] == 23.1
        assert data["longitude"] == -82.5

    async def test_current_endpoint_requires_lat_lon(self, client):
        """GET /api/v1/weather/current returns 422 without lat/lon."""
        resp = await client.get("/api/v1/weather/current")
        assert resp.status_code == 422

    async def test_forecast_endpoint_returns_200(self, client):
        """GET /api/v1/weather/forecast returns 200 and daily data."""
        from app.domain.weather.service import WeatherService

        service = WeatherService()
        with patch.object(service, "_fetch_forecast",
                          return_value=_mock_forecast_response()):
            with patch(
                "app.domain.weather.router._weather_service",
                service,
            ):
                resp = await client.get(
                    "/api/v1/weather/forecast",
                    params={"lat": 23.1, "lon": -82.5, "days": 3},
                )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["daily"]) == 3
        assert data["daily"][0]["temperature_2m_max"] == 26.0

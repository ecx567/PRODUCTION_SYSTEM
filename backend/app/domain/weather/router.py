"""
REST API endpoints for Open-Meteo weather data.

Endpoints:
    - ``GET /api/v1/weather/current`` — real-time conditions
    - ``GET /api/v1/weather/forecast`` — multi-day forecast
"""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from redis.asyncio import Redis

from app.core.redis import get_redis
from app.domain.weather.schemas import CurrentWeather, Forecast
from app.domain.weather.service import WeatherService

logger = logging.getLogger("crop.api.weather")

router = APIRouter(tags=["Weather"])

# Singleton service instance (shared across requests)
_weather_service = WeatherService()


@router.get(
    "/weather/current",
    response_model=CurrentWeather,
    summary="Current weather conditions for a location",
)
async def get_current_weather(
    lat: Annotated[
        float,
        Query(ge=-90.0, le=90.0, description="Latitude (WGS84)"),
    ],
    lon: Annotated[
        float,
        Query(ge=-180.0, le=180.0, description="Longitude (WGS84)"),
    ],
) -> CurrentWeather:
    """Fetch real-time weather from Open-Meteo for the given coordinates.

    Returns temperature, humidity, precipitation, soil moisture,
    evapotranspiration (ETo), and vapour pressure deficit (VPD).

    Data is cached in Redis for **30 minutes** on first request.
    """
    try:
        return await _weather_service.get_current_weather(lat=lat, lon=lon)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.error("Open-Meteo current weather request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Weather service is currently unavailable. "
                "Please try again later."
            ),
        ) from exc


@router.get(
    "/weather/forecast",
    response_model=Forecast,
    summary="Multi-day weather forecast for a location",
)
async def get_weather_forecast(
    lat: Annotated[
        float,
        Query(ge=-90.0, le=90.0, description="Latitude (WGS84)"),
    ],
    lon: Annotated[
        float,
        Query(ge=-180.0, le=180.0, description="Longitude (WGS84)"),
    ],
    days: Annotated[
        int,
        Query(ge=1, le=16, description="Number of forecast days"),
    ] = 7,
) -> Forecast:
    """Fetch a multi-day weather forecast from Open-Meteo.

    Returns daily high/low temperature, precipitation sum, and
    reference evapotranspiration (ETo).

    Data is cached in Redis for **30 minutes** on first request.
    """
    try:
        return await _weather_service.get_forecast(lat=lat, lon=lon, days=days)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.error("Open-Meteo forecast request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Weather forecast is currently unavailable. "
                "Please try again later."
            ),
        ) from exc

"""
Tests for the Crop Profiles module: schemas, loader, and API.

Covers:
    - CropProfile Pydantic schema validation
    - PestProfile Pydantic schema validation
    - CropProfileLoader: successful load, malformed JSON, missing field,
      unknown crop lookup, reload
    - GET /api/v1/crop-profiles integration (returns ≥18 entries)
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.domain.crop_profiles.schemas import CropProfile, CropProfileList, PestProfile
from app.domain.crop_profiles.service import CropProfileLoader


# ═══════════════════════════════════════════════════════════════
# PestProfile schema validation
# ═══════════════════════════════════════════════════════════════

class TestPestProfileSchema:
    """PestProfile Pydantic model validation tests."""

    def test_valid_pest_profile(self):
        """A fully populated pest profile validates successfully."""
        profile = PestProfile(
            name="Fall Armyworm",
            scientific_name="Spodoptera frugiperda",
            gdd_threshold=800.0,
            t_base=10.0,
            optimal_temp_min=20.0,
            optimal_temp_max=30.0,
            requires_leaf_wetness=False,
            min_humidity=60.0,
            recommendation="Apply biological control.",
        )
        assert profile.name == "Fall Armyworm"
        assert profile.gdd_threshold == 800.0

    def test_minimal_pest_profile(self):
        """A pest profile with only required fields validates."""
        profile = PestProfile(
            name="Test Pest",
            gdd_threshold=500.0,
            t_base=10.0,
            optimal_temp_min=15.0,
            optimal_temp_max=30.0,
        )
        assert profile.name == "Test Pest"
        assert profile.scientific_name is None
        assert profile.min_humidity is None
        assert profile.recommendation == ""

    def test_gdd_threshold_must_be_positive(self):
        """GDD threshold must be >= 0."""
        with pytest.raises(ValidationError, match="gdd_threshold"):
            PestProfile(
                name="Pest",
                gdd_threshold=-1.0,
                t_base=10.0,
                optimal_temp_min=15.0,
                optimal_temp_max=30.0,
            )

    def test_missing_required_fields_raises(self):
        """Missing required fields raise ValidationError."""
        with pytest.raises(ValidationError):
            PestProfile()  # type: ignore[call-arg]

    def test_t_base_can_be_zero(self):
        """t_base can be 0 (e.g., for temperate crops)."""
        profile = PestProfile(
            name="Pest",
            gdd_threshold=500.0,
            t_base=0.0,
            optimal_temp_min=10.0,
            optimal_temp_max=25.0,
        )
        assert profile.t_base == 0.0


# ═══════════════════════════════════════════════════════════════
# CropProfile schema validation
# ═══════════════════════════════════════════════════════════════

class TestCropProfileSchema:
    """CropProfile Pydantic model validation tests."""

    VALID_PROFILE = {
        "name": "maize",
        "kc_initial": 0.3,
        "kc_mid": 1.2,
        "kc_end": 0.6,
        "stage_lengths": [20, 35, 40, 30],
        "fertilizer_rates": {
            "planting": {"n": 40, "p": 50, "k": 40},
            "vegetative": {"n": 100, "p": 30, "k": 60},
            "reproductive": {"n": 50, "p": 20, "k": 30},
        },
        "pests": [],
        "taw_default": 150.0,
        "gdd_base_temp": 10.0,
    }

    def test_valid_crop_profile(self):
        """A fully populated crop profile validates successfully."""
        profile = CropProfile(**self.VALID_PROFILE)
        assert profile.name == "maize"
        assert profile.kc_mid == 1.2
        assert len(profile.stage_lengths) == 4

    def test_crop_profile_with_pests(self):
        """A crop profile with nested pests validates."""
        data = {**self.VALID_PROFILE}
        data["pests"] = [
            {
                "name": "Fall Armyworm",
                "scientific_name": "Spodoptera frugiperda",
                "gdd_threshold": 800.0,
                "t_base": 10.0,
                "optimal_temp_min": 20.0,
                "optimal_temp_max": 30.0,
            },
        ]
        profile = CropProfile(**data)
        assert len(profile.pests) == 1
        assert profile.pests[0].name == "Fall Armyworm"
        assert profile.pests[0].gdd_threshold == 800.0

    def test_stage_lengths_exactly_4_elements(self):
        """stage_lengths must have exactly 4 elements."""
        with pytest.raises(ValidationError):
            CropProfile(
                **{**self.VALID_PROFILE, "stage_lengths": [20, 35, 40]},
            )

    def test_fertilizer_rates_accepts_partial_npk(self):
        """Fertilizer rates accept any string keys with float values
        (detailed NPK validation is performed at the service layer)."""
        data = {**self.VALID_PROFILE}
        data["fertilizer_rates"] = {
            "planting": {"n": 10, "p": 20},  # partial keys are accepted
        }
        profile = CropProfile(**data)
        assert profile.fertilizer_rates["planting"]["n"] == 10
        assert profile.fertilizer_rates["planting"]["p"] == 20

    def test_missing_required_field_raises(self):
        """Missing required field raises ValidationError."""
        data = {**self.VALID_PROFILE}
        del data["kc_initial"]
        with pytest.raises(ValidationError, match="kc_initial"):
            CropProfile(**data)

    def test_empty_name_raises(self):
        """Empty name string raises validation error."""
        data = {**self.VALID_PROFILE, "name": ""}
        with pytest.raises(ValidationError):
            CropProfile(**data)

    def test_negative_kc_raises(self):
        """Negative Kc values raise validation error."""
        data = {**self.VALID_PROFILE, "kc_initial": -0.5}
        with pytest.raises(ValidationError):
            CropProfile(**data)

    def test_gdd_upper_temp_optional(self):
        """gdd_upper_temp is optional."""
        data = {**self.VALID_PROFILE}
        profile = CropProfile(**data)
        assert profile.gdd_upper_temp is None

    def test_display_name_defaults_to_none(self):
        """display_name defaults to None if not provided."""
        profile = CropProfile(**self.VALID_PROFILE)
        assert profile.display_name is None

    def test_metadata_field(self):
        """metadata dict is accepted and stored."""
        data = {**self.VALID_PROFILE, "metadata": {"family": "Poaceae", "notes": "Test"}}
        profile = CropProfile(**data)
        assert profile.metadata["family"] == "Poaceae"


# ═══════════════════════════════════════════════════════════════
# CropProfileLoader — unit tests
# ═══════════════════════════════════════════════════════════════

class TestCropProfileLoader:
    """CropProfileLoader behavior tests."""

    SAMPLE_PROFILES = [
        {
            "name": "maize",
            "kc_initial": 0.3, "kc_mid": 1.2, "kc_end": 0.6,
            "stage_lengths": [20, 35, 40, 30],
            "fertilizer_rates": {
                "planting": {"n": 40, "p": 50, "k": 40},
                "vegetative": {"n": 100, "p": 30, "k": 60},
                "reproductive": {"n": 50, "p": 20, "k": 30},
            },
            "pests": [],
            "taw_default": 150.0,
            "gdd_base_temp": 10.0,
        },
        {
            "name": "banana",
            "kc_initial": 0.5, "kc_mid": 1.2, "kc_end": 1.1,
            "stage_lengths": [120, 90, 120, 60],
            "fertilizer_rates": {
                "planting": {"n": 30, "p": 40, "k": 60},
                "vegetative": {"n": 120, "p": 30, "k": 200},
                "reproductive": {"n": 60, "p": 50, "k": 150},
            },
            "pests": [],
            "taw_default": 150.0,
            "gdd_base_temp": 14.0,
        },
    ]

    @pytest.fixture
    def temp_json_file(self):
        """Create a temporary JSON file with valid crop profiles."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8",
        ) as f:
            json.dump(self.SAMPLE_PROFILES, f)
            f.flush()
            path = Path(f.name)
        yield path
        path.unlink(missing_ok=True)

    def test_loads_all_valid_profiles(self, temp_json_file):
        """Loader returns all valid profiles from a JSON file."""
        loader = CropProfileLoader(data_path=temp_json_file)
        result = loader.get_all()
        assert isinstance(result, CropProfileList)
        assert result.total == 2
        assert len(result.items) == 2

    def test_get_by_name_found(self, temp_json_file):
        """get() returns correct profile by name."""
        loader = CropProfileLoader(data_path=temp_json_file)
        profile = loader.get("maize")
        assert profile is not None
        assert profile.name == "maize"
        assert profile.kc_initial == 0.3

    def test_get_by_name_case_insensitive(self, temp_json_file):
        """get() is case-insensitive."""
        loader = CropProfileLoader(data_path=temp_json_file)
        profile = loader.get("BANANA")
        assert profile is not None
        assert profile.name == "banana"

    def test_get_unknown_returns_none(self, temp_json_file):
        """get() for unknown crop returns None."""
        loader = CropProfileLoader(data_path=temp_json_file)
        profile = loader.get("nonexistent_crop")
        assert profile is None

    def test_list_names_returns_sorted(self, temp_json_file):
        """list_names() returns sorted names."""
        loader = CropProfileLoader(data_path=temp_json_file)
        names = loader.list_names()
        assert names == sorted(names)  # already sorted
        assert "banana" in names
        assert "maize" in names

    def test_count(self, temp_json_file):
        """count() returns number of profiles."""
        loader = CropProfileLoader(data_path=temp_json_file)
        assert loader.count() == 2

    def test_missing_file_returns_empty(self):
        """Loader returns empty list for missing file (does not crash)."""
        loader = CropProfileLoader(data_path=Path("/nonexistent/path/profiles.json"))
        result = loader.get_all()
        assert result.total == 0
        assert result.items == []

    def test_malformed_json_returns_empty(self):
        """Loader handles malformed JSON gracefully."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8",
        ) as f:
            f.write("this is not valid json {{{")
            f.flush()
            path = Path(f.name)

        try:
            loader = CropProfileLoader(data_path=path)
            result = loader.get_all()
            assert result.total == 0
        finally:
            path.unlink(missing_ok=True)

    def test_not_a_list_returns_empty(self):
        """Top-level non-array JSON returns empty."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8",
        ) as f:
            json.dump({"not": "a list"}, f)
            f.flush()
            path = Path(f.name)

        try:
            loader = CropProfileLoader(data_path=path)
            result = loader.get_all()
            assert result.total == 0
        finally:
            path.unlink(missing_ok=True)

    def test_skips_malformed_entry(self, temp_json_file):
        """Loader skips entries with missing fields and logs errors."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8",
        ) as f:
            data = [
                *self.SAMPLE_PROFILES,
                {"name": "bad_entry"},  # missing required fields
            ]
            json.dump(data, f)
            f.flush()
            path = Path(f.name)

        try:
            loader = CropProfileLoader(data_path=path)
            result = loader.get_all()
            assert result.total == 2  # only the 2 valid ones
            assert len(loader.load_errors) == 1
            assert "bad_entry" in loader.load_errors[0]
        finally:
            path.unlink(missing_ok=True)

    def test_reload_picks_up_changes(self, temp_json_file):
        """reload() re-reads the file after modifications."""
        loader = CropProfileLoader(data_path=temp_json_file)
        assert loader.count() == 2

        # Append a new valid profile
        new_entry = {
            "name": "rice",
            "kc_initial": 1.0, "kc_mid": 1.2, "kc_end": 0.8,
            "stage_lengths": [30, 30, 60, 30],
            "fertilizer_rates": {
                "planting": {"n": 30, "p": 30, "k": 30},
                "vegetative": {"n": 60, "p": 20, "k": 40},
                "reproductive": {"n": 30, "p": 15, "k": 30},
            },
            "pests": [],
            "taw_default": 200.0,
            "gdd_base_temp": 10.0,
        }
        with open(temp_json_file, "r", encoding="utf-8") as f:
            current = json.load(f)
        current.append(new_entry)
        with open(temp_json_file, "w", encoding="utf-8") as f:
            json.dump(current, f)

        loader.reload()
        assert loader.count() == 3

    def test_real_profiles_file_loads(self):
        """Integration: the actual crop_profiles.json loads successfully."""
        loader = CropProfileLoader()
        result = loader.get_all()
        assert result.total >= 18, f"Expected ≥18 profiles, got {result.total}"
        # Verify key crops present
        names = {p.name for p in result.items}
        for required in ("banana", "maize", "cacao", "rice", "coffee",
                         "sugarcane", "soybean", "sunflower", "palm_oil", "cotton",
                         "cassava", "sweet_potato", "coconut", "pineapple",
                         "mango", "papaya", "tomato", "beans"):
            assert required in names, f"Missing required crop: {required}"


# ═══════════════════════════════════════════════════════════════
# Hargreaves-Samani ET₀ unit tests
# ═══════════════════════════════════════════════════════════════

class TestHargreavesETo:
    """WeatherService Hargreaves-Samani calculation tests."""

    def test_basic_eto_calculation(self):
        """Basic Hargreaves ET₀ calculation with typical values."""
        from app.domain.weather.service import WeatherService

        ra = 28.0  # MJ/m²/day, typical tropical
        eto = WeatherService.calculate_eto_hargreaves(
            t_min=18.0, t_max=32.0, t_mean=25.0, ra=ra,
        )
        assert eto > 0
        # Expected: 0.0023 × 28 × (25 + 17.8) × sqrt(32-18)
        # = 0.0023 × 28 × 42.8 × 3.742 ≈ 10.31
        assert round(eto, 1) == pytest.approx(10.3, abs=0.5)

    def test_small_temp_range(self):
        """Very small temperature range still produces positive ET₀."""
        from app.domain.weather.service import WeatherService

        eto = WeatherService.calculate_eto_hargreaves(
            t_min=24.0, t_max=24.5, t_mean=24.25, ra=25.0,
        )
        assert eto > 0

    def test_swapped_min_max(self):
        """Swapped min/max temperatures produce same result."""
        from app.domain.weather.service import WeatherService

        eto1 = WeatherService.calculate_eto_hargreaves(
            t_min=15.0, t_max=30.0, t_mean=22.5, ra=25.0,
        )
        eto2 = WeatherService.calculate_eto_hargreaves(
            t_min=30.0, t_max=15.0, t_mean=22.5, ra=25.0,
        )
        assert eto1 == eto2

    def test_zero_ra_returns_zero(self):
        """Zero extraterrestrial radiation returns zero ET₀."""
        from app.domain.weather.service import WeatherService

        eto = WeatherService.calculate_eto_hargreaves(
            t_min=20.0, t_max=30.0, t_mean=25.0, ra=0.0,
        )
        assert eto == 0.0

    def test_solar_declination_range(self):
        """Solar declination is within expected bounds."""
        from app.domain.weather.service import WeatherService

        # Summer solstice (day 172)
        dec_jun = WeatherService.calculate_solar_declination(172)
        assert -0.41 <= dec_jun <= 0.41  # ~23.5° in radians

        # Winter solstice (day 355)
        dec_dec = WeatherService.calculate_solar_declination(355)
        assert -0.41 <= dec_dec <= 0.41

    def test_extraterrestrial_radiation_positive(self):
        """Extraterrestrial radiation is always >= 0."""
        from app.domain.weather.service import WeatherService

        lat_rad = 0.4  # ~23° latitude
        dec = WeatherService.calculate_solar_declination(172)
        ra = WeatherService.calculate_extraterrestrial_radiation(
            lat_rad, dec, 172,
        )
        assert ra >= 0
        assert ra < 50  # reasonable max for Earth


# ═══════════════════════════════════════════════════════════════
# Forecast Daily endpoint — router level
# ═══════════════════════════════════════════════════════════════

class TestForecastDailyEndpoint:
    """Verify /weather/forecast/daily endpoint behavior."""

    async def test_forecast_daily_returns_200(self, client):
        """GET /api/v1/weather/forecast/daily returns 200."""
        from app.domain.weather.service import WeatherService
        from unittest.mock import patch

        service = WeatherService()
        # Mock the HTTP fetch to return minimal temp data
        mock_data = {
            "latitude": 23.1,
            "longitude": -82.5,
            "daily": {
                "time": ["2026-05-12", "2026-05-13", "2026-05-14"],
                "temperature_2m_max": [30.0, 31.0, 29.0],
                "temperature_2m_min": [20.0, 21.0, 19.0],
                "precipitation_sum": [0.0, 2.5, 0.0],
            },
            "daily_units": {
                "temperature_2m_max": "°C",
                "temperature_2m_min": "°C",
                "precipitation_sum": "mm",
            },
        }

        with patch.object(service, "_fetch_forecast_temps",
                          return_value=mock_data):
            with patch(
                "app.domain.weather.router._weather_service",
                service,
            ):
                resp = await client.get(
                    "/api/v1/weather/forecast/daily",
                    params={"lat": 23.1, "lon": -82.5, "days": 3},
                )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["daily"]) == 3
        assert data["daily"][0]["et0_hargreaves"] is not None
        assert data["daily"][0]["temperature_2m_max"] == 30.0
        assert data["daily"][0]["temperature_2m_mean"] == pytest.approx(25.0, abs=0.5)

    async def test_forecast_daily_requires_lat_lon(self, client):
        """GET /api/v1/weather/forecast/daily returns 422 without lat/lon."""
        resp = await client.get("/api/v1/weather/forecast/daily")
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════════
# Integration: GET /api/v1/crop-profiles returns profiles
# ═══════════════════════════════════════════════════════════════

class TestCropProfilesAPI:
    """Integration tests for the crop profiles API endpoint."""

    async def test_list_crop_profiles_returns_200_with_profiles(
        self, client, auth_headers,
    ):
        """GET /api/v1/crop-profiles returns 200 with profiles list."""
        resp = await client.get(
            "/api/v1/crop-profiles",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 18, (
            f"Expected ≥18 crop profiles, got {data['total']}. "
            "Run with the actual crop_profiles.json file."
        )

    async def test_crop_profiles_requires_auth(self, client):
        """GET /api/v1/crop-profiles returns 401 without auth."""
        resp = await client.get("/api/v1/crop-profiles")
        assert resp.status_code == 401

    async def test_crop_profiles_has_expected_fields(self, client, auth_headers):
        """Each profile has required fields."""
        resp = await client.get(
            "/api/v1/crop-profiles",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert "name" in item
            assert "kc_initial" in item
            assert "kc_mid" in item
            assert "kc_end" in item
            assert "stage_lengths" in item
            assert "fertilizer_rates" in item
            assert "taw_default" in item
            assert "gdd_base_temp" in item

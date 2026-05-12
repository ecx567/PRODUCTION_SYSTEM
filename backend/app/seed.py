"""
Database seeding for development and test environments.

Idempotent: safe to call on every startup when ``ENVIRONMENT != "production"``.
Seeds: tenants, users, fields, sensor readings, and alert rules.
"""

from __future__ import annotations

import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.auth.models import User, UserRole
from app.domain.auth.models_tenant import Tenant
from app.domain.auth.service import hash_password
from app.domain.fields.models import Field
from app.domain.notifications.models import AlertRule

logger = logging.getLogger("crop.seed")

# ── Seed data ───────────────────────────────────────────────

SEED_TENANTS: list[dict] = [
    {"name": "Default Farm"},
]

SEED_USERS: list[dict] = [
    {"email": "admin@crop.local", "password": "admin1234", "role": UserRole.ADMIN, "tenant_name": "Default Farm"},
    {"email": "farmer@crop.local", "password": "farmer1234", "role": UserRole.FARMER, "tenant_name": "Default Farm"},
]

SEED_FIELDS: list[dict] = [
    {"name": "North Field",  "crop_type": "maize", "area_ha": 42.5, "location": "POINT(-79.5 8.9)"},
    {"name": "South Field",  "crop_type": "rice",  "area_ha": 28.3, "location": "POINT(-79.4 8.8)"},
    {"name": "East Block",   "crop_type": "banana","area_ha": 35.0, "location": "POINT(-79.3 8.7)"},
    {"name": "West Block",   "crop_type": "cacao", "area_ha": 18.7, "location": "POINT(-79.6 8.9)"},
]

SENSOR_MAP: dict[str, dict[str, tuple[float, float]]] = {
    "maize":  {"temp": (22, 34), "humidity": (50, 85), "soil_moisture": (25, 55), "rain": (0, 15)},
    "rice":   {"temp": (24, 36), "humidity": (60, 95), "soil_moisture": (30, 70), "rain": (0, 25)},
    "banana": {"temp": (22, 32), "humidity": (65, 90), "soil_moisture": (35, 65), "rain": (0, 20)},
    "cacao":  {"temp": (20, 30), "humidity": (70, 95), "soil_moisture": (30, 60), "rain": (0, 18)},
}

TENANT_WIDE_RULES: list[dict] = [
    {"name": "Alta Temperatura",         "metric_type": "temp",          "condition": "gt", "threshold": 35.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Temperatura Extrema",      "metric_type": "temp",          "condition": "gt", "threshold": 40.0, "severity": "critical", "cooldown_minutes": 60},
    {"name": "Baja Temperatura",         "metric_type": "temp",          "condition": "lt", "threshold": 10.0, "severity": "critical", "cooldown_minutes": 60},
    {"name": "Humedad Baja",             "metric_type": "humidity",      "condition": "lt", "threshold": 50.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Humedad Alta",             "metric_type": "humidity",      "condition": "gt", "threshold": 90.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Humedad de Suelo Baja",    "metric_type": "soil_moisture", "condition": "lt", "threshold": 25.0, "severity": "warning",  "cooldown_minutes": 60},
    {"name": "Humedad de Suelo Critica", "metric_type": "soil_moisture", "condition": "lt", "threshold": 15.0, "severity": "critical", "cooldown_minutes": 120},
    {"name": "Lluvia Fuerte",            "metric_type": "rain",          "condition": "gt", "threshold": 20.0, "severity": "warning",  "cooldown_minutes": 60},
]

FIELD_RULES_BY_CROP: dict[str, list[dict]] = {
    "maize": [
        {"name": "Maiz: Estrés por Calor",     "metric_type": "temp",          "condition": "gt", "threshold": 38.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Maiz: Humedad Critica Baja", "metric_type": "humidity",      "condition": "lt", "threshold": 40.0, "severity": "critical", "cooldown_minutes": 30},
        {"name": "Maiz: Riesgo Tizón",         "metric_type": "humidity",      "condition": "gt", "threshold": 85.0, "severity": "warning",  "cooldown_minutes": 60},
    ],
    "rice": [
        {"name": "Arroz: Estrés Térmico Alto", "metric_type": "temp",          "condition": "gt", "threshold": 38.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Arroz: Baja Humedad Ambiental","metric_type": "humidity",    "condition": "lt", "threshold": 55.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Arroz: Riesgo de Helada",     "metric_type": "temp",         "condition": "lt", "threshold": 15.0, "severity": "critical", "cooldown_minutes": 60},
    ],
    "banana": [
        {"name": "Banano: Estrés por Frío",   "metric_type": "temp",          "condition": "lt", "threshold": 18.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Banano: Estrés Hídrico",    "metric_type": "soil_moisture", "condition": "lt", "threshold": 30.0, "severity": "warning",  "cooldown_minutes": 60},
        {"name": "Banano: Sigatoka Favorable", "metric_type": "humidity",     "condition": "gt", "threshold": 85.0, "severity": "warning",  "cooldown_minutes": 30},
    ],
    "cacao": [
        {"name": "Cacao: Estrés por Frío",    "metric_type": "temp",          "condition": "lt", "threshold": 18.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Cacao: Baja Humedad Crítica","metric_type": "humidity",     "condition": "lt", "threshold": 70.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Cacao: Riesgo Escoba Bruja", "metric_type": "humidity",     "condition": "gt", "threshold": 90.0, "severity": "warning",  "cooldown_minutes": 60},
    ],
}


# ── Public API ──────────────────────────────────────────────

async def seed_database(db: AsyncSession) -> None:
    """Run all seed operations idempotently."""
    logger.info("Seeding database…")

    tenants = await _seed_tenants(db)
    users = await _seed_users(db, tenants)

    if tenants:
        tenant = list(tenants.values())[0]
        fields = await _seed_fields(db, tenant)
        await _seed_sensor_readings(db, tenant, fields)
        await _seed_alert_rules(db, tenant, fields)

    logger.info("Database seeding complete.")


# ── Tenants ─────────────────────────────────────────────────

async def _seed_tenants(db: AsyncSession) -> dict[str, Tenant]:
    seeded: dict[str, Tenant] = {}
    for spec in SEED_TENANTS:
        name = spec["name"]
        result = await db.execute(select(Tenant).where(Tenant.name == name))
        tenant = result.scalar_one_or_none()
        if tenant is None:
            tenant = Tenant(name=name)
            db.add(tenant)
            await db.flush()
            logger.info("  Created tenant: %s (id=%s)", name, tenant.id)
        seeded[name] = tenant
    return seeded


# ── Users ───────────────────────────────────────────────────

async def _seed_users(db: AsyncSession, tenants: dict[str, Tenant]) -> list[User]:
    created: list[User] = []
    for spec in SEED_USERS:
        email = spec["email"]
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            continue
        tenant = tenants.get(spec["tenant_name"])
        if tenant is None:
            continue
        user = User(
            tenant_id=tenant.id,
            email=email,
            password_hash=hash_password(spec["password"]),
            role=spec["role"],
            is_active=True,
        )
        db.add(user)
        await db.flush()
        logger.info("  Created user: %s (role=%s)", email, spec["role"].value)
        created.append(user)
    return created


# ── Fields ──────────────────────────────────────────────────

async def _seed_fields(db: AsyncSession, tenant: Tenant) -> dict[str, Field]:
    """Create seed fields. Returns ``{field_name: Field}``."""
    seeded: dict[str, Field] = {}
    for spec in SEED_FIELDS:
        result = await db.execute(
            select(Field).where(Field.tenant_id == tenant.id, Field.name == spec["name"])
        )
        field = result.scalar_one_or_none()
        if field is None:
            field = Field(
                tenant_id=tenant.id,
                name=spec["name"],
                crop_type=spec["crop_type"],
                area_ha=spec["area_ha"],
                location=spec.get("location"),
                planted_at=datetime.now(timezone.utc) - timedelta(days=random.randint(30, 90)),
            )
            db.add(field)
            await db.flush()
            logger.info("  Created field: %s (%s, %.1f ha)", field.name, field.crop_type, field.area_ha)
        seeded[field.name] = field
    return seeded


# ── Sensor readings ─────────────────────────────────────────

async def _seed_sensor_readings(
    db: AsyncSession,
    tenant: Tenant,
    fields: dict[str, Field],
) -> None:
    """Insert 7 days × 24h of realistic sensor readings per field."""

    # Check if readings already exist for any field
    for field in fields.values():
        result = await db.execute(
            text("SELECT COUNT(*) FROM sensor_readings WHERE field_id = :fid AND tenant_id = :tid"),
            {"fid": field.id, "tid": tenant.id},
        )
        count = result.scalar()
        if count and count > 0:
            logger.info("  Sensor readings already exist for %s (%d rows), skipping.", field.name, count)
            return

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    total = 0

    for field in fields.values():
        crop = field.crop_type
        config = SENSOR_MAP.get(crop, SENSOR_MAP["maize"])
        rows: list[dict[str, Any]] = []

        for day_offset in range(7):
            base_date = now - timedelta(days=day_offset)
            max_hour = 24 if day_offset > 0 else min(now.hour + 1, 24)
            for hour in range(max_hour):
                ts = base_date.replace(hour=hour)
                hour_factor = abs(hour - 13) / 13  # peak temp at 13:00
                bt = config["temp"][0] + (config["temp"][1] - config["temp"][0]) * (1 - hour_factor * 0.4)

                sensor_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sensor.{crop}-{hour}"))
                rows.append({
                    "time": ts,
                    "tenant_id": tenant.id,
                    "sensor_id": sensor_id,
                    "field_id": field.id,
                    "temp": round(bt + random.uniform(-2, 2), 1),
                    "humidity": round(random.uniform(config["humidity"][0], config["humidity"][1]), 1),
                    "soil_moisture": round(random.uniform(config["soil_moisture"][0], config["soil_moisture"][1]), 1),
                    "rain": round(random.random() ** 3 * config["rain"][1], 1),
                    "ingestion_ts": now,
                    "validation_status": "valid",
                    "signal_quality": json.dumps({"score": 1.0, "all_metrics_present": True}),
                })

        if not rows:
            continue

        # Batch INSERT with ON CONFLICT DO NOTHING
        placeholders = ", ".join(
            f"(:time_{i}, :tenant_id_{i}, :sensor_id_{i}, :field_id_{i}, "
            f":temp_{i}, :humidity_{i}, :soil_moisture_{i}, :rain_{i}, "
            f":ingestion_ts_{i}, :validation_status_{i}, CAST(:signal_quality_{i} AS jsonb))"
            for i in range(len(rows))
        )
        flat_params: dict[str, Any] = {}
        for i, row in enumerate(rows):
            for k, v in row.items():
                flat_params[f"{k}_{i}"] = v

        stmt = text(f"""
            INSERT INTO sensor_readings
                (time, tenant_id, sensor_id, field_id,
                 temp, humidity, soil_moisture, rain,
                 ingestion_ts, validation_status, signal_quality)
            VALUES {placeholders}
            ON CONFLICT ON CONSTRAINT uq_sensor_readings_time_sensor DO NOTHING
        """)
        result = await db.execute(stmt, flat_params)
        stored = result.rowcount or 0
        total += stored
        logger.info("  %s: %d sensor readings stored", field.name, stored)

    if total > 0:
        await db.commit()
        logger.info("  Total: %d sensor readings seeded across %d fields", total, len(fields))


# ── Alert rules ─────────────────────────────────────────────

async def _seed_alert_rules(
    db: AsyncSession,
    tenant: Tenant,
    fields: dict[str, Field],
) -> None:
    """Create tenant-wide + field-specific alert rules."""

    # Check if rules already exist
    result = await db.execute(
        text("SELECT COUNT(*) FROM alert_rules WHERE tenant_id = :tid"),
        {"tid": tenant.id},
    )
    count = result.scalar()
    if count and count > 0:
        logger.info("  Alert rules already exist (%d), skipping.", count)
        return

    # Tenant-wide rules
    for spec in TENANT_WIDE_RULES:
        rule = AlertRule(tenant_id=tenant.id, field_id=None, **spec)
        db.add(rule)
        await db.flush()
        logger.info("  Created rule: %s (tenant-wide, %s)", rule.name, rule.severity)

    # Field-specific rules
    for field in fields.values():
        rules = FIELD_RULES_BY_CROP.get(field.crop_type, [])
        for spec in rules:
            rule = AlertRule(tenant_id=tenant.id, field_id=field.id, **spec)
            db.add(rule)
            await db.flush()
            logger.info("  Created rule: %s (%s, %s)", rule.name, field.name, rule.severity)

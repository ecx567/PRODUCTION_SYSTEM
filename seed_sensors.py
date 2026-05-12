"""
Generate 7 days of realistic sensor data for all 4 fields.
Uses proper UUIDs for sensor_ids.
"""
import http.client, json, random, datetime, uuid

# ── Auth ────────────────────────────────────────────────────
conn = http.client.HTTPConnection("localhost", 8001)
body = json.dumps({"email": "admin@crop.local", "password": "admin1234"})
conn.request("POST", "/api/v1/auth/login", body, {"Content-Type": "application/json"})
token = json.loads(conn.getresponse().read())["access_token"]
print("✓ Logged in")

# ── Fields ──────────────────────────────────────────────────
conn.request("GET", "/api/v1/fields", headers={"Authorization": f"Bearer {token}"})
fields = json.loads(conn.getresponse().read())["items"]
print(f"✓ Found {len(fields)} fields")

# ── Sensor config per crop ──────────────────────────────────
# Each sensor gets a stable UUID (deterministic from name)
def sensor_uuid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sensor.{name}.crop.local"))

SENSOR_MAP = {
    "maize":  {"temp": (22, 34), "humidity": (50, 85), "soil_moisture": (25, 55), "rain": (0, 15)},
    "rice":   {"temp": (24, 36), "humidity": (60, 95), "soil_moisture": (30, 70), "rain": (0, 25)},
    "banana": {"temp": (22, 32), "humidity": (65, 90), "soil_moisture": (35, 65), "rain": (0, 20)},
    "cacao":  {"temp": (20, 30), "humidity": (70, 95), "soil_moisture": (30, 60), "rain": (0, 18)},
}

# Day 1 = 7 days ago, Day 7 = today
now = datetime.datetime.now(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)
days_back = 7

for field in fields:
    crop = field["crop_type"]
    fid = field["id"]
    fname = field["name"]
    config = SENSOR_MAP[crop]
    temp_sid = sensor_uuid(f"{crop}-temp")
    hum_sid = sensor_uuid(f"{crop}-humidity")
    soil_sid = sensor_uuid(f"{crop}-soil")
    rain_sid = sensor_uuid(f"{crop}-rain")
    print(f"\n--- {fname} ({crop}) ---")

    for day_offset in range(days_back):
        base_date = now - datetime.timedelta(days=day_offset)
        readings = []

        # 24 readings per day (every hour) for the main sensor
        # Skip future hours to avoid ts_not_in_future validation
        max_hour = 24
        if day_offset == 0:  # today
            max_hour = now.hour

        for hour in range(max_hour):
            ts = base_date.replace(hour=hour).isoformat()
            hour_factor = abs(hour - 13) / 13
            temp_range = config["temp"]
            base_temp = temp_range[0] + (temp_range[1] - temp_range[0]) * (1 - hour_factor * 0.4)
            temp = round(base_temp + random.uniform(-2, 2), 1)
            humidity = round(random.uniform(config["humidity"][0], config["humidity"][1]), 1)
            soil_moisture = round(random.uniform(config["soil_moisture"][0], config["soil_moisture"][1]), 1)
            rain = round(random.random() ** 3 * config["rain"][1], 1)
            if hour < 8 or hour > 18:
                rain = round(rain * 0.3, 1)

            readings.append({
                "ts": ts,
                "sensor_id": temp_sid,
                "field_id": fid,
                "temp": temp,
                "humidity": humidity,
                "soil_moisture": soil_moisture,
                "rain": rain,
            })

        # Every 3 hours, individual sensor readings
        for hour in range(0, max_hour, 3):
            ts = base_date.replace(hour=hour).isoformat()
            readings.append({
                "ts": ts,
                "sensor_id": hum_sid,
                "field_id": fid,
                "temp": None,
                "humidity": round(random.uniform(config["humidity"][0], config["humidity"][1]), 1),
                "soil_moisture": None,
                "rain": None,
            })
            readings.append({
                "ts": ts,
                "sensor_id": soil_sid,
                "field_id": fid,
                "temp": None,
                "humidity": None,
                "soil_moisture": round(random.uniform(config["soil_moisture"][0], config["soil_moisture"][1]), 1),
                "rain": None,
            })
            readings.append({
                "ts": ts,
                "sensor_id": rain_sid,
                "field_id": fid,
                "temp": None,
                "humidity": None,
                "soil_moisture": None,
                "rain": round(random.random() ** 3 * config["rain"][1], 1),
            })

        # POST batch (max 1000 per request - we're well under)
        payload = json.dumps({"readings": readings})
        conn.request("POST", "/api/v1/sensors/data", payload.encode(), {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })
        resp = conn.getresponse()
        result = json.loads(resp.read())

        if "stored_count" in result:
            print(f"  Day {day_offset+1}: {result['stored_count']} stored / {result['total_submitted']} total", end="")
            if result['isolated_count'] > 0:
                print(f" (isolated={result['isolated_count']})", end="")
            print()
        else:
            print(f"  Day {day_offset+1}: ERROR {resp.status} - {json.dumps(result)[:200]}")

print(f"\n{'='*50}")
print("DONE!")
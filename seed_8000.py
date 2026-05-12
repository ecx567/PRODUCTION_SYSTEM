"""
Seed data into backend 8000 (dev).
"""
import http.client, json, random, datetime, uuid

conn = http.client.HTTPConnection("localhost", 8000)
body = json.dumps({"email": "admin@crop.local", "password": "admin1234"})
conn.request("POST", "/api/v1/auth/login", body, {"Content-Type": "application/json"})
token = json.loads(conn.getresponse().read())["access_token"]

SENSOR_MAP = {
    "maize":  {"temp": (22, 34), "humidity": (50, 85), "soil_moisture": (25, 55), "rain": (0, 15)},
    "rice":   {"temp": (24, 36), "humidity": (60, 95), "soil_moisture": (30, 70), "rain": (0, 25)},
    "banana": {"temp": (22, 32), "humidity": (65, 90), "soil_moisture": (35, 65), "rain": (0, 20)},
    "cacao":  {"temp": (20, 30), "humidity": (70, 95), "soil_moisture": (30, 60), "rain": (0, 18)},
}

conn.request("GET", "/api/v1/fields", headers={"Authorization": f"Bearer {token}"})
fields = json.loads(conn.getresponse().read())["items"]

for field in fields:
    crop = field["crop_type"]
    fid = field["id"]
    config = SENSOR_MAP[crop]
    now = datetime.datetime.now(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)
    readings = []

    for day_offset in range(7):
        base_date = now - datetime.timedelta(days=day_offset)
        max_hour = 24 if day_offset > 0 else now.hour
        for hour in range(max_hour):
            ts = base_date.replace(hour=hour).isoformat()
            hour_factor = abs(hour - 13) / 13
            tr = config["temp"]
            bt = tr[0] + (tr[1] - tr[0]) * (1 - hour_factor * 0.4)
            readings.append({
                "ts": ts,
                "sensor_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"sensor.{crop}-{hour}")),
                "field_id": fid,
                "temp": round(bt + random.uniform(-2, 2), 1),
                "humidity": round(random.uniform(config["humidity"][0], config["humidity"][1]), 1),
                "soil_moisture": round(random.uniform(config["soil_moisture"][0], config["soil_moisture"][1]), 1),
                "rain": round(random.random() ** 3 * config["rain"][1], 1),
            })

    payload = json.dumps({"readings": readings})
    conn.request("POST", "/api/v1/sensors/data", payload.encode(), {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    resp = conn.getresponse()
    result = json.loads(resp.read())
    stored = result.get("stored_count", 0)
    total = result.get("total_submitted", len(readings))
    print(f"  {crop}: {stored}/{total} stored")

print("DONE")

"""
Seed alert rules on backend 8000 from research thresholds.
"""
import http.client, json, time

conn = http.client.HTTPConnection("localhost", 8000)

def api(method, path, body=None, headers=None):
    """Make an HTTP API call. Always consumes the full response body."""
    for attempt in range(3):
        try:
            conn.request(method, path, body, headers)
            resp = conn.getresponse()
            data = resp.read()
            return resp.status, data
        except http.client.ResponseNotReady as e:
            if attempt == 2:
                raise
            time.sleep(1)
    return 0, b""

# Login
body = json.dumps({"email": "admin@crop.local", "password": "admin1234"})
status, data = api("POST", "/api/v1/auth/login", body.encode(), {"Content-Type": "application/json"})
token = json.loads(data)["access_token"]
HEADERS = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ── Tenant-wide rules ───────────────────────────────────────

tenant_rules = [
    {"name": "Alta Temperatura",            "metric_type": "temp",          "condition": "gt", "threshold": 35.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Temperatura Extrema",         "metric_type": "temp",          "condition": "gt", "threshold": 40.0, "severity": "critical", "cooldown_minutes": 60},
    {"name": "Baja Temperatura",            "metric_type": "temp",          "condition": "lt", "threshold": 10.0, "severity": "critical", "cooldown_minutes": 60},
    {"name": "Humedad Baja",                "metric_type": "humidity",      "condition": "lt", "threshold": 50.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Humedad Alta",                "metric_type": "humidity",      "condition": "gt", "threshold": 90.0, "severity": "warning",  "cooldown_minutes": 30},
    {"name": "Humedad de Suelo Baja",       "metric_type": "soil_moisture", "condition": "lt", "threshold": 25.0, "severity": "warning",  "cooldown_minutes": 60},
    {"name": "Humedad de Suelo Critica",    "metric_type": "soil_moisture", "condition": "lt", "threshold": 15.0, "severity": "critical", "cooldown_minutes": 120},
    {"name": "Lluvia Fuerte",               "metric_type": "rain",          "condition": "gt", "threshold": 20.0, "severity": "warning",  "cooldown_minutes": 60},
]

print("=== Tenant-wide rules ===")
for rule in tenant_rules:
    status, data = api("POST", "/api/v1/alerts/rules", json.dumps(rule).encode(), HEADERS)
    if status == 201:
        print(f"  ✅ {rule['name']} ({rule['metric_type']} {rule['condition']} {rule['threshold']})")
    else:
        print(f"  ❌ {rule['name']}: {status} {data.decode()[:200]}")

# ── Field-specific rules per crop ───────────────────────────

status, data = api("GET", "/api/v1/fields", headers=HEADERS)
fields = json.loads(data)["items"]

CROP_RULES = {
    "maize": [
        {"name": "Maiz: Estrés por Calor",      "metric_type": "temp",          "condition": "gt", "threshold": 38.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Maiz: Humedad Critica Baja",  "metric_type": "humidity",      "condition": "lt", "threshold": 40.0, "severity": "critical", "cooldown_minutes": 30},
        {"name": "Maiz: Riesgo Tizón",          "metric_type": "humidity",      "condition": "gt", "threshold": 85.0, "severity": "warning",  "cooldown_minutes": 60},
    ],
    "rice": [
        {"name": "Arroz: Estrés Térmico Alto",  "metric_type": "temp",          "condition": "gt", "threshold": 38.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Arroz: Baja Humedad Ambiental","metric_type": "humidity",      "condition": "lt", "threshold": 55.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Arroz: Riesgo de Helada",      "metric_type": "temp",          "condition": "lt", "threshold": 15.0, "severity": "critical", "cooldown_minutes": 60},
    ],
    "banana": [
        {"name": "Banano: Estrés por Frío",     "metric_type": "temp",          "condition": "lt", "threshold": 18.0, "severity": "critical", "cooldown_minutes": 60},
        {"name": "Banano: Estrés Hídrico",      "metric_type": "soil_moisture", "condition": "lt", "threshold": 30.0, "severity": "warning",  "cooldown_minutes": 60},
        {"name": "Banano: Sigatoka Favorable",  "metric_type": "humidity",      "condition": "gt", "threshold": 85.0, "severity": "warning",  "cooldown_minutes": 30},
    ],
    "cacao": [
        {"name": "Cacao: Estrés por Frío",     "metric_type": "temp",          "condition": "lt", "threshold": 18.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Cacao: Baja Humedad Crítica", "metric_type": "humidity",      "condition": "lt", "threshold": 70.0, "severity": "warning",  "cooldown_minutes": 30},
        {"name": "Cacao: Riesgo Escoba Bruja",  "metric_type": "humidity",      "condition": "gt", "threshold": 90.0, "severity": "warning",  "cooldown_minutes": 60},
    ],
}

print("\n=== Field-specific rules ===")
for field in fields:
    crop = field["crop_type"]
    fid = field["id"]
    rules = CROP_RULES.get(crop, [])
    for rule in rules:
        payload = {**rule, "field_id": fid}
        status, data = api("POST", "/api/v1/alerts/rules", json.dumps(payload).encode(), HEADERS)
        if status == 201:
            print(f"  ✅ {field['name']}: {rule['name']}")
        else:
            print(f"  ❌ {field['name']}: {rule['name']}: {status} {data.decode()[:200]}")

print("\nDONE")

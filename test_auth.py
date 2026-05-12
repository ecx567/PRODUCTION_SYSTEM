"""Test auth bypass and data endpoints."""
import asyncio
from app.main import create_app
from app.config import settings
from app.core.database import db

async def test():
    await db.initialize(settings.DATABASE_URL)
    app = create_app()

    from fastapi.testclient import TestClient
    client = TestClient(app)

    resp = client.get('/api/v1/fields?page_size=20')
    print(f"Fields: {resp.status_code}")
    data = resp.json()
    print(f"  total: {data.get('total')}")
    for f in data.get("items", []):
        print(f"  - {f['name']} ({f['crop_type']})")

    resp = client.get('/api/v1/alerts/events?page_size=50')
    print(f"\nAlerts: {resp.status_code}")
    data = resp.json()
    print(f"  total: {data.get('total')}")

    resp = client.get('/health')
    print(f"\nHealth: {resp.status_code} - {resp.json()}")

    await db.close()
    print("\n¡Todo ok!")

asyncio.run(test())
